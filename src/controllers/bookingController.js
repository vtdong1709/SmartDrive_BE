import { calculateFareService, createBookingService, deleteBookingService, getAllBookingsService, getBookingByIdService, getBookingsByDriverIdService, getBookingsByStatusService, getBookingsByUserIdService, updateBookingService, updateBookingStatusService } from "../services/bookingService.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

export const createBooking = async (req, res) => {
    try {
        const { driverId, startTime, endTime, pickupLocation, dropoffLocation, price, distance, duration } = req.body;
        const customerId = req.user.id;
        const bookingData = {
            customerId,
            driverId,
            startTime,
            endTime,
            pickupLocation,
            dropoffLocation,
            distance,
            duration,
            price,
            createdAt: new Date(),
        };
        console.log(bookingData);
        const booking = await createBookingService(bookingData);
        res.status(200).json(successResponse("Đặt tài xế thành công", booking));
    } catch (error) {
        res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code));
    }
};

export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await getBookingByIdService(id);
  res.status(200).json(successResponse("Booking fetched successfully", booking));
} catch (error) {
  res
  .status(error.code || 500)
  .json(errorResponse(error.message, error.code));
}
};

export const updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const bookingData = req.body;
        const booking = await updateBookingService(id, bookingData);
        res.status(200).json(successResponse("Booking updated successfully", booking));
    } catch (error) {
        res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code));
    }
};

export const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await deleteBookingService(id);
        res.status(200).json(successResponse("Booking deleted successfully", booking));
    } catch (error) {
        res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code));
    }
};

export const getAllBookings = async (req, res) => {
    try {
        const bookings = await getAllBookingsService();
        res.status(200).json(successResponse("Bookings fetched successfully", bookings));
    } catch (error) {
        res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code));
    }
};

export const getBookingsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const bookings = await getBookingsByUserIdService(userId);
        res.status(200).json(successResponse("Bookings fetched successfully", bookings));
    } catch (error) {
        res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code));
    }
};

export const getBookingsByDriverId = async (req, res) => {
    try {
        const { driverId } = req.params;
        const bookings = await getBookingsByDriverIdService(driverId);
        res.status(200).json(successResponse("Bookings fetched successfully", bookings));
  } catch (error) {
    res
    .status(error.code || 500)
    .json(errorResponse(error.message, error.code));
  }
};

export const getBookingsByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const bookings = await getBookingsByStatusService(status);
        res.status(200).json(successResponse("Bookings fetched successfully", bookings));
    } catch (error) {
        res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code));
    }
};

export const calculateFare = async (req, res) => {
    try {
      const { pickupLocation, dropoffLocation, startTime, endTime, serviceType } = req.body;
      const result = await calculateFareService(
        pickupLocation,
        dropoffLocation,
        startTime,
        endTime,
        serviceType
      );
  
      res.status(200).json(successResponse("Tính toán giá cước thành công", result));
    } catch (error) {
      res.status(error.code || 500).json(errorResponse(error.message, error.code));
    }
  };

export const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const booking = await updateBookingStatusService(id, status);
        res.status(200).json(successResponse("Booking status updated successfully", booking));
    } catch (error) {
        res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code));
    }
};