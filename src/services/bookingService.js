import axios from "axios";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { errorResponse } from "../utils/apiResponse.js";
import Pricing from "../models/Pricing.js";
import { onlineDrivers, pendingRequests } from "../sockets/socketHandler.js";
import { v4 as uuidv4 } from "uuid";
import { io } from "../../server.js";
import DriverWallet from "../models/DriverWallet.js";
import { sendNotification } from "../services/notificationService.js";

export const createBookingService = async (bookingData) => {
  const { customerId, driverId, startTime, endTime, pickupLocation, dropoffLocation, price, distance ,duration, serviceType, paymentMethod} = bookingData;
  const newBookingData  = {
    customerId,
    driverId,
    startTime,
    endTime,
    pickupLocation,
    dropoffLocation,
    distance,
    duration,
    status: "Pending",
    price,
    serviceType,
    paymentMethod,
    paymentStatus: "Pending",
    createdAt: new Date(),
  };
  const booking = await Booking.create(newBookingData);

  console.log("Booking created:", booking.bookingCode);

  if (paymentMethod === "toDriver") {
    const commissionDebt = Math.round(price * 15/100);

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

let cachedHolidays = {};

async function getVietnamHolidays(year) {
  if (cachedHolidays[year]) return cachedHolidays[year];

  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/VN`;
  const { data } = await axios.get(url);

  // data = [{ date: "2025-01-01", localName: "...", name: "...", ... }]

  const holidayDates = data.map((h) => h.date); // lấy YYYY-MM-DD

  cachedHolidays[year] = holidayDates;
  return holidayDates;
}

export const calculateFareService = async (
  pickupLocation,
  dropoffLocation,
  startTime,
  endTime,       
  serviceType,
) => {
  if (!serviceType) throw new Error("Vui lòng chọn loại dịch vụ trước khi tính giá");

  // === Lấy thời gian bắt đầu ===
  const currentTime = new Date(startTime);
  const hour = currentTime.getHours();
  const dayOfWeek = currentTime.getDay();

  // === Lấy bảng giá đang áp dụng ===
  const activePricing = await Pricing.findOne({
    serviceType,
    $or: [
      { effectiveTo: null },
      {
        $and: [
          { effectiveFrom: { $lte: currentTime } },
          { effectiveTo: { $gte: currentTime } },
        ],
      },
    ],
  }).sort({ effectiveFrom: -1 });

  if (!activePricing)
    throw new Error(`Không tìm thấy bảng giá cho loại dịch vụ: ${serviceType}`);

  const {
    baseFare,
    fareBrackets,
    hourBrackets,
    dayBrackets,
    multipliers,
    turnBackFees,
    platformFee,
  } = activePricing;

  // === Áp dụng hệ số thời gian ===
  let multiplier = 1;
  if (hour >= 21 && hour < 23) multiplier *= multipliers.after21h || 1;
  if (hour >= 23 || hour < 6) multiplier *= multipliers.after23h || 1;
  if (dayOfWeek === 0 || dayOfWeek === 6) multiplier *= multipliers.weekend || 1;

  // const holidays = ["2025-01-01", "2025-04-30", "2025-05-01", "2025-09-02"];
  // const isHoliday = holidays.some(
  //   (d) => currentTime.toISOString().slice(0, 10) === d
  // );
  // if (isHoliday) multiplier *= multipliers.holiday || 1;

  // === Lấy năm hiện tại theo startTime ===
const year = currentTime.getFullYear();
const holidays = await getVietnamHolidays(year);

const today = currentTime.toISOString().slice(0, 10);
const isHoliday = holidays.includes(today);

if (isHoliday) {
  multiplier *= multipliers.holiday || 1;
}


  // === Khởi tạo các giá trị trả về ===
  let fare = baseFare;
  let distanceKm = 0;
  let durationValue = 0;
  let estimatedDuration = "";
  let extraKmCharge = 0;
  let turnBackFee = 0;

  // === Tính theo loại dịch vụ ===
  switch (serviceType) {
    case "per_km":
    case "intercity": {
      if (!pickupLocation || !dropoffLocation) 
        throw new Error("Vui lòng nhập đầy đủ điểm đi và điểm đến");

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(
        pickupLocation
      )}&destinations=${encodeURIComponent(dropoffLocation)}&key=${apiKey}`;

      const response = await axios.get(url);
      if (response.data.status !== "OK") throw new Error("Lỗi từ Google Maps API");

      const element = response.data.rows?.[0]?.elements?.[0];
      if (!element || element.status !== "OK") throw new Error("Không tìm thấy lộ trình");

      const distanceValue = element.distance.value;
      durationValue = element.duration.value;
      distanceKm = distanceValue / 1000;

      const hours = Math.floor(durationValue / 3600);
      const minutes = Math.floor((durationValue % 3600) / 60);
      const seconds = durationValue % 60;
      estimatedDuration =
        (hours > 0 ? `${hours} giờ ` : "") +
        (minutes > 0 ? `${minutes} phút ` : "") +
        (seconds > 0 ? `${seconds} giây` : "");

      if (serviceType === "per_km") {
        const bracket =
          fareBrackets.find(
            (b) => distanceKm >= b.from && (b.to === null || distanceKm <= b.to)
          ) || fareBrackets.at(-1);
        fare += distanceKm * bracket.pricePerKm;
      } else {
        // intercity
        let intercityFare = 0;
        if (distanceKm <= 70) {
          intercityFare = distanceKm * fareBrackets[0].pricePerKm;
        } else if (distanceKm <= 100) {
          intercityFare =
            70 * fareBrackets[0].pricePerKm +
            (distanceKm - 70) * fareBrackets[1].pricePerKm;
        } else {
          intercityFare =
            70 * fareBrackets[0].pricePerKm +
            30 * fareBrackets[1].pricePerKm +
            (distanceKm - 100) * fareBrackets[2].pricePerKm;
        }
        fare += intercityFare;

        const turnFee =
          turnBackFees.find(
            (f) => distanceKm >= f.fromKm && (f.toKm === null || distanceKm <= f.toKm)
          ) || null;

        if (turnFee) {
          turnBackFee = turnFee.fee;
          fare += turnBackFee;
        }
      }
      break;
    }

    case "hourly": {
      if (!startTime || !endTime) throw new Error("Dịch vụ theo giờ cần startTime và endTime");

      const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
      if (durationMs <= 0) throw new Error("endTime phải lớn hơn startTime");

      const durationHours = durationMs / (1000 * 60 * 60);
      if (durationHours > 8) throw new Error("Dịch vụ theo giờ tối đa 8 tiếng mỗi ngày");

      const bracket =
        hourBrackets.find(
          (b) =>
            durationHours >= b.fromHour &&
            (b.toHour === null || durationHours <= b.toHour)
        ) || hourBrackets.at(-1);

      fare += durationHours * bracket.pricePerHour;
      break;
    }

    case "daily": {
      if (!startTime || !endTime) throw new Error("Dịch vụ theo ngày cần startTime và endTime");

      const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      const durationDays = Math.ceil(durationHours / 24);

      if (durationDays > 3) throw new Error("Dịch vụ theo ngày tối đa 3 ngày");

      const bracket =
        dayBrackets.find(
          (b) =>
            durationDays >= b.fromDay &&
            (b.toDay === null || durationDays <= b.toDay)
        ) || dayBrackets.at(-1);

      fare += durationDays * bracket.pricePerDay;
      break;
    }

    default:
      throw new Error(`Loại dịch vụ ${serviceType} chưa được hỗ trợ.`);
  }

  // === Áp dụng hệ số nhân ===
  fare *= multiplier;

  // === Cộng phí nền tảng ===
  fare += platformFee;

  // === Làm tròn ===
  fare = Math.round(fare);

  return {
    pickupLocation,
    dropoffLocation,
    distanceKm,
    estimatedDuration,
    durationSeconds: durationValue,
    durationHours: serviceType === "hourly" ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000*60*60) : 0,
    durationDays: serviceType === "daily" ? Math.ceil((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000*60*60*24)) : 0,
    baseFare,
    multiplier,
    extraKmCharge,
    turnBackFee,
    platformFee,
    finalFare: fare,
    serviceType,
   
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