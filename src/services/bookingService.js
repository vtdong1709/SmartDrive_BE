import axios from "axios";
import Booking from "../models/Booking.js";
import { errorResponse } from "../utils/apiResponse.js";
import Pricing from "../models/Pricing.js";
import { onlineDrivers, pendingRequests } from "../sockets/socketHandler.js";
import { v4 as uuidv4 } from "uuid";
import { io } from "../../server.js";
import { createAndSendNotification } from "./notificationService.js";
import User from "../models/User.js";

export const createBookingService = async (bookingData) => {
  const { customerId, driverId, startTime, endTime, pickupLocation, dropoffLocation, price, distance, duration } = bookingData;
  const newBookingData = {
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
    createdAt: new Date(),
  };
  console.log(newBookingData);
  const booking = await Booking.create(newBookingData);

  // Gửi thông báo cho khách hàng
  await createAndSendNotification(
    booking.customerId,
    "Đặt xe thành công",
    `Bạn đã đặt thành công chuyến đi từ ${booking.pickupLocation} đến ${booking.dropoffLocation}.`,
    "booking_created"
  );

  // Gửi thông báo cho tài xế
  const driver = await User.findById(booking.driverId);
  if (driver) {
    await createAndSendNotification(
      booking.driverId,
      "Bạn có cuốc xe mới",
      `Bạn có một cuốc xe mới từ ${booking.pickupLocation} đến ${booking.dropoffLocation}.`,
      "booking_created"
    );
  }
  return booking;
};



export const updateBookingService = async (id, updateData) => {
  const { customerId, driverId, startTime, endTime, pickupLocation, dropoffLocation, price, status, timestamp } = updateData;
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

  // Nếu trạng thái là "Cancelled"
  if (updateData.status === "Cancelled" && booking) {
    const customer = await User.findById(booking.customerId);
    const driver = await User.findById(booking.driverId);

    // Thông báo cho người còn lại
    // Giả sử người hủy là req.user.id (logic này cần được thêm vào controller)
    // Ví dụ: customer hủy
    if (driver) {
      await createAndSendNotification(
        driver._id,
        "Chuyến đi đã bị hủy",
        `Chuyến đi từ ${booking.pickupLocation} đã bị khách hàng hủy.`,
        "booking_cancelled"
      );
    }
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

export const getAllBookingsService = async () => {
  const bookings = await Booking.find().populate("customerId").populate("driverId");
  return bookings;
};

export const getBookingByIdService = async (id) => {
  if (!id) {
    throw new errorResponse("Không tìm thấy booking", 404);
  }
  const booking = await Booking.findById(id).populate("customerId").populate("driverId");
  return booking;
};

export const getBookingsByUserIdService = async (userId) => {
  if (!userId) {
    throw new errorResponse("Không tìm thấy người dùng", 404);
  }
  const bookings = await Booking.find({ customerId: userId }).populate("customerId").populate("driverId");
  return bookings;
};

export const getBookingsByDriverIdService = async (driverId) => {
  if (!driverId) {
    throw new errorResponse("Không tìm thấy tài xế", 404);
  }
  const bookings = await Booking.find({ driverId: driverId }).populate("customerId").populate("driverId");
  return bookings;
};

export const getBookingsByStatusService = async (status) => {
  if (!status) {
    throw new errorResponse("Không tìm thấy trạng thái", 404);
  }
  const bookings = await Booking.find({ status: status }).populate("customerId").populate("driverId");
  return bookings;
};


// export const calculateFareService = async (pickupLocation, dropoffLocation, startTime) => {
//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;
//   const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
//       pickupLocation
//     )}&destinations=${encodeURIComponent(dropoffLocation)}&key=${apiKey}`;
//     const response = await axios.get(url);
//     if (response.data.rows[0].elements[0].status !== "OK") {
//       throw new errorResponse("Không tính được khoảng cách từ Google Maps", 400);
//     }
//     const distanceMeters = response.data.rows[0].elements[0].distance.value;
//     const distanceKm = distanceMeters / 1000;
//     const hour = new Date(startTime).getHours();
// let pricePerKm;

// if (hour >= 9 && hour < 16) {
//   pricePerKm = 15000;
// } else if (hour >= 16 && hour < 21) {
//   pricePerKm = 20000;
// } else if (hour >= 22 || hour < 6) {
//   pricePerKm = 30000;
// } else if (hour >= 7 && hour < 9) {
//   pricePerKm = 12000;
// } else {
//   pricePerKm = 15000; // mặc định
// }

// const totalPrice = distanceKm * pricePerKm;

// return {
//   pickupLocation,
//   dropoffLocation,
//   distanceKm,
//   pricePerKm,
//   totalPrice,
// };
// };


// export const calculateFareService = async (origin, destination, startTime) => {
//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;
//   const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(
//     origin
//   )}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;

//   const response = await axios.get(url);
//   console.log("Google API response:", response.data);

//   if (response.data.status !== "OK") {
//     throw new Error(response.data.error_message || "Lỗi từ Google Maps API");
//   }

//   const element = response.data.rows?.[0]?.elements?.[0];
//   if (!element || element.status !== "OK") {
//     throw new Error("Không tìm thấy lộ trình cho địa chỉ đã nhập");
//   }

//   const distanceValue = element.distance.value; // mét
//   const distanceText = element.distance.text;
//   const durationText = element.duration.text;

//   const hour = new Date(startTime).getHours();
//   let ratePerKm = 15000;
//   if (hour >= 16 && hour < 21) ratePerKm = 20000;
//   else if (hour >= 22 || hour < 6) ratePerKm = 30000;
//   else if (hour >= 7 && hour < 9) ratePerKm = 12000;

//   const distanceKm = distanceValue / 1000;
//   const fare = Math.round(distanceKm * ratePerKm);

//   return {
//     pickupLocation: origin,
//     dropoffLocation: destination,
//     distance: distanceText,
//     duration: durationText,
//     ratePerKm,
//     fare,
//   };
// };

export const calculateFareService = async (
  pickupLocation,
  dropoffLocation,
  startTime,
  serviceType,
) => {
  if (!serviceType) throw new Error("Vui lòng chọn loại dịch vụ trước khi tính giá");

  // === Lấy dữ liệu từ Google Maps API ===
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(
    pickupLocation
  )}&destinations=${encodeURIComponent(dropoffLocation)}&key=${apiKey}`;

  const response = await axios.get(url);
  if (response.data.status !== "OK") throw new Error("Lỗi từ Google Maps API");

  const element = response.data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") throw new Error("Không tìm thấy lộ trình");

  const distanceValue = element.distance.value; // mét
  const durationValue = element.duration.value; // giây
  const distanceKm = distanceValue / 1000;

  // Thêm phần tính thời gian dự kiến (định dạng đọc được)
  const hours = Math.floor(durationValue / 3600);
  const minutes = Math.floor((durationValue % 3600) / 60);
  const seconds = durationValue % 60;
  const estimatedDuration =
    (hours > 0 ? `${hours} giờ ` : "") +
    (minutes > 0 ? `${minutes} phút ` : "") +
    (seconds > 0 ? `${seconds} giây` : "");

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
    maxKmPerHour,
    maxKmPerDay,
    surchargePerKm,
    turnBackFees,
    platformFee,
  } = activePricing;

  // === Áp dụng hệ số thời gian ===
  let multiplier = 1;
  if (hour >= 21 && hour < 23) multiplier *= multipliers.after21h || 1;
  if (hour >= 23 || hour < 6) multiplier *= multipliers.after23h || 1;
  if (dayOfWeek === 0 || dayOfWeek === 6) multiplier *= multipliers.weekend || 1;

  const holidays = ["2025-01-01", "2025-04-30", "2025-05-01", "2025-09-02"];
  const isHoliday = holidays.some(
    (d) => currentTime.toISOString().slice(0, 10) === d
  );
  if (isHoliday) multiplier *= multipliers.holiday || 1;

  // === Tính giá cơ bản ===
  let fare = baseFare;
  const durationHours = durationValue / 3600;
  const durationDays = Math.ceil(durationValue / (3600 * 24));
  let extraKmCharge = 0;
  let turnBackFee = 0;

  switch (serviceType) {
    case "per_km": {
      const bracket =
        fareBrackets.find(
          (b) => distanceKm >= b.from && (b.to === null || distanceKm <= b.to)
        ) || fareBrackets.at(-1);
      fare += distanceKm * bracket.pricePerKm;
      break;
    }

    case "hourly": {
      const bracket =
        hourBrackets.find(
          (b) =>
            durationHours >= b.fromHour &&
            (b.toHour === null || durationHours <= b.toHour)
        ) || hourBrackets.at(-1);
      fare += durationHours * bracket.pricePerHour;

      // Phụ phí vượt km nếu có
      if (distanceKm > maxKmPerHour * durationHours) {
        const exceededKm = distanceKm - maxKmPerHour * durationHours;
        extraKmCharge = exceededKm * surchargePerKm;
        fare += extraKmCharge;
      }
      break;
    }

    case "daily": {
      const bracket =
        dayBrackets.find(
          (b) =>
            durationDays >= b.fromDay &&
            (b.toDay === null || durationDays <= b.toDay)
        ) || dayBrackets.at(-1);
      fare += durationDays * bracket.pricePerDay;

      // Phụ phí vượt km nếu có
      if (distanceKm > maxKmPerDay * durationDays) {
        const exceededKm = distanceKm - maxKmPerDay * durationDays;
        extraKmCharge = exceededKm * surchargePerKm;
        fare += extraKmCharge;
      }
      break;
    }

    case "intercity": {
      const bracket =
        fareBrackets.find(
          (b) => distanceKm >= b.from && (b.to === null || distanceKm <= b.to)
        ) || fareBrackets.at(-1);
      fare += distanceKm * bracket.pricePerKm;

      // Tính phí quay đầu nếu có
      const turnFee =
        turnBackFees.find(
          (f) => distanceKm >= f.fromKm && (f.toKm === null || distanceKm <= f.toKm)
        ) || null;
      if (turnFee) {
        turnBackFee = turnFee.fee;
        fare += turnBackFee;
      }
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

  // === Trả kết quả ===
  return {
    pickupLocation: pickupLocation,
    dropoffLocation: dropoffLocation,
    distanceKm,
    estimatedDuration, // Thời gian dự kiến (đã format)
    durationSeconds: durationValue, // Tổng thời gian (giây)
    durationHours,
    durationDays,
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

