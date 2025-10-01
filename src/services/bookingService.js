import axios from "axios";
import Booking from "../models/Booking.js";
import { errorResponse } from "../utils/apiResponse.js";

export const createBookingService = async (bookingData) => {
  const { customerId, driverId, startTime, endTime, pickupLocation, dropoffLocation, price } = bookingData;
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
    createdAt: new Date(),
  };
  console.log(newBookingData);
  const booking = await Booking.create(newBookingData);
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


export const calculateFareService = async (origin, destination, startTime) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(
    origin
  )}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;

  const response = await axios.get(url);
  console.log("Google API response:", response.data);

  if (response.data.status !== "OK") {
    throw new Error(response.data.error_message || "Lỗi từ Google Maps API");
  }

  const element = response.data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    throw new Error("Không tìm thấy lộ trình cho địa chỉ đã nhập");
  }

  const distanceValue = element.distance.value; // mét
  const distanceText = element.distance.text;
  const durationText = element.duration.text;

  const hour = new Date(startTime).getHours();
  let ratePerKm = 15000;
  if (hour >= 16 && hour < 21) ratePerKm = 20000;
  else if (hour >= 22 || hour < 6) ratePerKm = 30000;
  else if (hour >= 7 && hour < 9) ratePerKm = 12000;

  const distanceKm = distanceValue / 1000;
  const fare = Math.round(distanceKm * ratePerKm);

  return {
    pickupLocation: origin,
    dropoffLocation: destination,
    distance: distanceText,
    duration: durationText,
    ratePerKm,
    fare,
  };
};