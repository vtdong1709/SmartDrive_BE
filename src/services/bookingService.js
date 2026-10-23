import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { errorResponse } from "../utils/apiResponse.js";
import { onlineDrivers, pendingRequests } from "../sockets/socketHandler.js";
import { v4 as uuidv4 } from "uuid";
import { io } from "../../server.js";
import DriverWallet from "../models/DriverWallet.js";
import { sendNotification } from "../services/notificationService.js";
import { createQuote, consumeQuote } from "../pricing/pricingEngine.js";
import { snapshotFromQuote } from "../pricing/services/quoteService.js";
import { calculateCommission } from "../pricing/services/commissionService.js";
import { PRICING_SERVICE } from "../pricing/constants.js";

const resolveDriverBookingPrice = async (bookingData) => {
  if (bookingData.quoteId) {
    const quote = await consumeQuote({
      quoteId: bookingData.quoteId,
      userId: bookingData.customerId,
      service: PRICING_SERVICE.DRIVER_BOOKING,
    });
    return {
      price: quote.finalFare,
      quoteId: quote.quoteCode,
      pricingSnapshot: snapshotFromQuote(quote),
      distance: quote.distanceKm ?? bookingData.distance,
      duration: quote.durationSeconds ?? bookingData.duration,
    };
  }
  const quote = await createQuote({
    service: PRICING_SERVICE.DRIVER_BOOKING,
    userId: bookingData.customerId,
    context: {
      serviceType: bookingData.serviceType,
      pickupLocation: bookingData.pickupLocation,
      dropoffLocation: bookingData.dropoffLocation,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      persist: true,
      route:
        Number(bookingData.distance) > 0
          ? {
              distanceKm: Number(bookingData.distance),
              durationSeconds: Number(bookingData.durationSeconds || bookingData.duration || 0),
            }
          : undefined,
      distanceKm: bookingData.distance,
    },
  });
  return {
    price: quote.finalFare,
    quoteId: quote.quoteId,
    pricingSnapshot: {
      quoteId: quote.quoteId,
      pricingVersionId: quote.pricingVersionId,
      items: quote.items,
      subtotal: quote.subtotal,
      discount: quote.discount,
      platformFee: quote.platformFee,
      finalFare: quote.finalFare,
    },
    distance: quote.distanceKm ?? bookingData.distance,
    duration: quote.durationSeconds ?? bookingData.duration,
  };
};

export const createBookingService = async (bookingData) => {
  const { customerId, driverId, startTime, endTime, pickupLocation, dropoffLocation, serviceType, paymentMethod } = bookingData;
  const priced = await resolveDriverBookingPrice(bookingData);
  const price = priced.price;
  const newBookingData  = {
    customerId,
    driverId,
    startTime,
    endTime,
    pickupLocation,
    dropoffLocation,
    distance: priced.distance,
    duration: priced.duration,
    status: "Pending",
    price,
    quoteId: priced.quoteId,
    pricingSnapshot: priced.pricingSnapshot,
    serviceType,
    paymentMethod,
    paymentStatus: "Pending",
    createdAt: new Date(),
  };
  const booking = await Booking.create(newBookingData);

  console.log("Booking created:", booking.bookingCode);

  if (paymentMethod === "toDriver") {
    const { commission: commissionDebt } = await calculateCommission({
      service: PRICING_SERVICE.DRIVER_BOOKING,
      subType: serviceType,
      amount: price,
      partnerType: "driver",
    });

    const wallet = await DriverWallet.findOne({ driver: driverId });
    if (!wallet) {
      throw new Error("Không tìm thấy ví của tài xế để cộng nợ hoa hồng");
    }

    wallet.debt += commissionDebt;
    await wallet.save();

    console.log(
      `Đã cộng nợ hoa hồng ${commissionDebt}₫ cho tài xế ${driverId}`
    );
  }
  if (driverId) {
    await sendNotification(io, {
      userId: driverId,
      title: "🚗 Có cuốc xe mới",
      message: "Bạn có cuốc xe mới gần vị trí của bạn"
    });
  }
  
  if (customerId) {
    await sendNotification(io, {
      userId: customerId,
      title: "Đặt xe thành công",
      message: "Hệ thống đang tìm tài xế cho bạn"
    });
  }
  
  return booking;
};



export const updateBookingService = async (id, updateData) => {
  const { customerId, driverId, startTime, endTime, pickupLocation, dropoffLocation, price, status, timestamp, serviceType, paymentMethod, paymentStatus } = updateData;
  const allowedUpdates = {
    customerId,
    driverId,
    startTime,
    endTime,
    pickupLocation,
    dropoffLocation,
    distance,
    duration,
    status,
    price,
    serviceType,
    paymentMethod,
    paymentStatus,
    updatedAt: timestamp || new Date(),
  };
  Object.keys(allowedUpdates).forEach(
    (key) => allowedUpdates[key] === undefined && delete allowedUpdates[key]
  );
  
  console.log(allowedUpdates);
  const booking = await Booking.findByIdAndUpdate(id, { $set: allowedUpdates }, {
    new: true,
    runValidators: true,
    context: 'query'
  });
  if (!booking) {
    throw new errorResponse("Không tìm thấy booking", 404);
  }
   // Notify khách
   if (booking.customerId) {
    await sendNotification(io, {
      userId: booking.customerId,
      title: "📢 Cập nhật cuốc xe",
      message: `Trạng thái chuyến đi đã được cập nhật: ${status}`
    });
  }

  // Notify tài xế
  if (booking.driverId) {
    await sendNotification(io, {
      userId: booking.driverId,
      title: "📢 Cập nhật chuyến",
      message: `Trạng thái chuyến đi đã được cập nhật: ${status}`
    });
  }
  return booking;
};


/**
 *  Xóa booking
 * @param {string} id - ID của booking cần xóa
 * @returns {Promise<boolean>}
 */
export const deleteBookingService = async (id) => {
  if (!id) {
    throw new errorResponse("ID không hợp lệ", 400);
  }
  const booking = await Booking.findByIdAndDelete(id);
  if (!booking) {
    throw new errorResponse("Không tìm thấy booking", 404);
  }
  return booking;
};

export const getAllBookingsService = async (page = 1, limit = 10) => {
  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;
  const bookings = await Booking.find().populate("customerId").populate("driverId") .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
  const totalBookings = await Booking.countDocuments();
  return {
    bookings,
    pagination: {
      total: totalBookings,
      page,
      limit,
      totalPages: Math.ceil(totalBookings / limit),
    },
  };
};

  export const getBookingByIdService = async (id) => {
    if (!id) {
      throw new errorResponse("Không tìm thấy booking", 404);
    }
      const booking = await Booking.findById(id)
      .populate({ path: "customerId", model: "users" })
      .populate({ path: "driverId", model: "users" });
      return booking;
    };

export const getBookingsByUserIdService = async (userId, page = 1, limit = 10) => {
  if (!userId) {
    throw new errorResponse("Không tìm thấy người dùng", 404);
  }
  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;
  const bookings = await Booking.find({ customerId: userId }).populate("customerId").populate("driverId") .sort({ createdAt: -1 }) // lấy mới nhất trước
  .skip(skip)
  .limit(limit);
  const totalBookings = await Booking.countDocuments({ customerId: userId });

  return {
    bookings,
    pagination: {
      total: totalBookings,
      page,
      limit,
      totalPages: Math.ceil(totalBookings / limit),
    },
  };
};

export const getBookingsByDriverIdService = async (driverId, page = 1, limit = 10) => {
  if (!driverId) {
    throw new errorResponse("Không tìm thấy tài xế", 404);
  }
  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;
  const bookings = await Booking.find({ driverId: driverId }).populate("customerId").populate("driverId") .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
  const totalBookings = await Booking.countDocuments({ driverId: driverId });
  return {
    bookings,
    pagination: {
      total: totalBookings,
      page,
      limit,
      totalPages: Math.ceil(totalBookings / limit),
    },
  };
};

export const getBookingsByStatusService = async (status, page = 1, limit = 10) => {
  if (!status) {
    throw new errorResponse("Không tìm thấy trạng thái", 404);
  }
  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;
  const bookings = await Booking.find({ status: status }).populate("customerId").populate("driverId") .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
  const totalBookings = await Booking.countDocuments({ status: status });
  return {
    bookings,
    pagination: {
      total: totalBookings,
      page,
      limit,
      totalPages: Math.ceil(totalBookings / limit),
    },
  };
};

export const calculateFareService = async (
  pickupLocation,
  dropoffLocation,
  startTime,
  endTime,       
  serviceType,
  extra = {},
) => {
  if (!serviceType) throw new Error("Vui lòng chọn loại dịch vụ trước khi tính giá");

  const quote = await createQuote({
    service: PRICING_SERVICE.DRIVER_BOOKING,
    userId: extra.userId || null,
    context: {
      serviceType,
      pickupLocation,
      dropoffLocation,
      pickup: extra.pickup,
      destination: extra.destination,
      startTime,
      endTime,
      route: extra.route,
      distanceKm: extra.distanceKm,
      durationSeconds: extra.durationSeconds,
    },
  });

  const hours = quote.durationSeconds ? quote.durationSeconds / 3600 : quote.metadata?.durationHours || 0;
  const seconds = Number(quote.durationSeconds || 0);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const estimatedDuration =
    seconds > 0
      ? `${h > 0 ? `${h} giờ ` : ""}${m > 0 ? `${m} phút ` : ""}${s > 0 ? `${s} giây` : ""}`.trim()
      : "";

  return {
    pickupLocation,
    dropoffLocation,
    distanceKm: quote.distanceKm,
    estimatedDuration,
    durationSeconds: quote.durationSeconds,
    durationHours: quote.metadata?.durationHours || hours,
    durationDays: quote.metadata?.durationDays || 0,
    baseFare: quote.baseFare,
    multiplier: quote.multiplier,
    extraKmCharge: 0,
    turnBackFee: quote.metadata?.turnBackFee || 0,
    platformFee: quote.platformFee,
    finalFare: quote.finalFare,
    serviceType,
    quoteId: quote.quoteId,
    items: quote.items,
    expiresAt: quote.expiresAt,
    estimatedFare: quote.finalFare,
  };
};

export const findDriver = async (req, res) => {
  try {
    const { pickupLocation, dropoffLocation, distanceKm, finalFare, customerSocketId } = req.body;

    // Giả lập danh sách tài xế gần (ở thực tế, bạn dùng geocode để tính khoảng cách)
    const candidates = Array.from(onlineDrivers.entries()).map(([driverId, info]) => ({
      driverId,
      socketId: info.socketId,
    }));

    if (candidates.length === 0) {
      return res.status(404).json({ success: false, message: "Không có tài xế nào khả dụng" });
    }

    const requestId = uuidv4();
    const reqObj = {
      queue: candidates,
      currentIndex: 0,
      timerId: null,
      data: { pickupLocation, dropoffLocation, distanceKm, finalFare },
      customerSocketId,
    };

    pendingRequests.set(requestId, reqObj);

    // Gửi tới tài xế đầu tiên
    const first = candidates[0];
    io.to(first.socketId).emit("newBookingRequest", {
      requestId,
      pickupLocation,
      dropoffLocation,
      estimatedFare: finalFare,
    });

    // Set timeout 15s nếu không phản hồi
    const timerId = setTimeout(() => {
      reqObj.currentIndex++;
      const next = candidates[1];
      if (next) {
        io.to(next.socketId).emit("newBookingRequest", { requestId, pickupLocation, dropoffLocation, estimatedFare: finalFare });
      } else {
        io.to(customerSocketId).emit("noDriverAvailable", { message: "Không tìm thấy tài xế." });
      }
    }, 15000);

    reqObj.timerId = timerId;
    pendingRequests.set(requestId, reqObj);

    return res.status(200).json({ success: true, message: "Đang tìm tài xế...", data: { requestId } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

export const updateBookingStatusService = async (bookingId, status) => {
  const booking = await Booking.findByIdAndUpdate(bookingId, { status }, { new: true });
  return booking;
};


// thống kê cho tài xế
export const getDriverStatsService = async (driverId) => {
  if (!driverId || !mongoose.Types.ObjectId.isValid(driverId)) {
    throw new Error("Valid driverId is required");
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Lấy tất cả booking hôm nay của tài xế
  const bookings = await Booking.find({
    driverId,
    status: "Completed",
    startTime: { $gte: startOfDay, $lte: endOfDay },
  });

  const tripsToday = bookings.length;
  const incomeToday = bookings.reduce((sum, b) => {
    const tripIncome = (b.price || 0) * 0.85; // trừ 15%
    return sum + tripIncome;
  }, 0);
  const durationToday = bookings.reduce((sum, b) => {
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    return sum + (end - start) / 3600000; // giờ
  }, 0);

  const ratingSum = bookings.reduce((sum, b) => sum + (b.rating || 0), 0);
  const ratingAverage = bookings.length > 0 ? (ratingSum / bookings.length).toFixed(1) : 0;

  return {
    tripsToday,
    incomeToday,
    durationToday: durationToday.toFixed(1),
    ratingAverage: parseFloat(ratingAverage),
  };
};
export const updatePaymentStatusService = async (id, paymentStatus) => {
  try {
    if (!id || !paymentStatus) {
      throw new Error("Thiếu thông tin bookingId hoặc trạng thái thanh toán.");
    }
    if (paymentStatus !== "Pending" && paymentStatus !== "Paid" && paymentStatus !== "Failed") {
      throw new Error("Trạng thái thanh toán không hợp lệ.");
    }
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new Error("Không tìm thấy booking.");
    }
    if (booking.paymentStatus === paymentStatus) {
      return {
        message: `Booking đã ở trạng thái ${paymentStatus}.`,
        booking,
      };
    }
    booking.paymentStatus = paymentStatus;

    if (paymentStatus === "Paid" && booking.status === "Pending") {
      booking.status = "Confirmed";
    }
    if (paymentStatus === "Failed" && booking.status !== "Cancelled") {
      booking.status = "PaymentFailed";
    }
    await booking.save();
    if (paymentStatus === "Paid") {
      if (booking.customerId) {
        await sendNotification(io, {
          userId: booking.customerId._id || booking.customerId,
          title: "💰 Thanh toán thành công",
          message: "Bạn đã thanh toán thành công cho cuốc xe!"
        });
      }
    
      if (booking.driverId) {
        await sendNotification(io, {
          userId: booking.driverId,
          title: "💵 Có chuyến đã được thanh toán",
          message: "Một cuốc xe của bạn đã được thanh toán"
        });
      }
    }
    

    if (io && booking.customerId?._id) {
      const payload = {
        bookingId: booking._id.toString(),
        update: { paymentStatus },
        actor: "driver",
        timeStamp: new Date().toISOString(),
      };
      io.to(booking.customerId._id.toString()).emit("paymentStatusUpdated", payload);
      console.log("send message paymentStatus thành công", payload)
    }

    return {
      message: "Cập nhật trạng thái thanh toán thành công.",
      booking,
    };
  } catch (error) {
    console.error("Lỗi khi cập nhật paymentStatus:", error.message);
    throw new Error(error.message);
  }
};