import { calculateFareService, createBookingService, deleteBookingService, getAllBookingsService, getBookingByIdService, getBookingsByDriverIdService, getBookingsByStatusService, getBookingsByUserIdService, getDriverStatsService, updateBookingService, updateBookingStatusService, updatePaymentStatusService } from "../services/bookingService.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";


export const createBooking = async (req, res) => {
    try {
      const {
        driverId,
        serviceType, // per_km | hourly | daily | intercity | motorcycle
        startTime,
        endTime,
        pickupLocation,
        dropoffLocation,
        price,
        distance,
        duration,
        paymentMethod,
        paymentStatus,
      } = req.body;
  
      const customerId = req.user.id;
  
      if (!driverId || !serviceType || !startTime || !pickupLocation) {
        return res.status(400).json(
          errorResponse(
            "Thiếu thông tin bắt buộc: driverId, serviceType, startTime, pickupLocation.",
            400
          )
        );
      }
  
      switch (serviceType) {
        case "per_km":
        case "intercity":
        case "motorcycle":
          if (!dropoffLocation) {
            return res
              .status(400)
              .json(errorResponse("Vui lòng nhập điểm đến (dropoffLocation).", 400));
          }
          break;
  
        case "hourly":
          if (!endTime) {
            return res
              .status(400)
              .json(errorResponse("Vui lòng nhập thời gian kết thúc (endTime).", 400));
          }
  
          const hourlyDuration =
            new Date(endTime).getTime() - new Date(startTime).getTime();
  
          const hours = hourlyDuration / (1000 * 60 * 60);
  
          if (hours !== 4 && hours !== 8) {
            return res.status(400).json(
              errorResponse(
                "Thời gian thuê theo giờ chỉ cho phép 4 tiếng hoặc 8 tiếng.",
                400
              )
            );
          }
          break;
  
        case "daily":
          if (!endTime) {
            return res
              .status(400)
              .json(errorResponse("Vui lòng nhập thời gian kết thúc (endTime).", 400));
          }
  
          const dailyDuration =
            new Date(endTime).getTime() - new Date(startTime).getTime();
  
          const days = dailyDuration / (1000 * 60 * 60 * 24);
  
          if (days < 1 || days > 3) {
            return res.status(400).json(
              errorResponse(
                "Thời gian thuê theo ngày chỉ được phép từ 1 đến 3 ngày.",
                400
              )
            );
          }
          break;
  
        default:
          return res
            .status(400)
            .json(errorResponse("Loại đặt xe (serviceType) không hợp lệ.", 400));
      }
  
      const bookingData = {
        customerId,
        driverId,
        serviceType,
        startTime,
        endTime: endTime || null,
        pickupLocation,
        dropoffLocation: dropoffLocation || null,
        distance: distance || null,
        duration: duration || null,
        price,
        paymentMethod,
        paymentStatus,
        createdAt: new Date(),
      };
  
      console.log("Booking data:", bookingData);
  
      const booking = await createBookingService(bookingData);
      res.status(200).json(successResponse("Đặt tài xế thành công", booking));
    } catch (error) {
      res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code || 500));
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
        const { page = 1, limit = 10 } = req.query;
        const result = await getAllBookingsService(page, limit);
        res.status(200).json(successResponse("Bookings fetched successfully", { data: result.bookings, pagination: result.pagination }));
    } catch (error) {
        res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code));
    }
};

export const getBookingsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const result = await getBookingsByUserIdService(userId, page, limit);
        res.status(200).json(successResponse("Bookings fetched successfully", { data: result.bookings, pagination: result.pagination }));
    } catch (error) {
        res
        .status(error.code || 500)
        .json(errorResponse(error.message, error.code));
    }
};

export const getBookingsByDriverId = async (req, res) => {
    try {
        const { driverId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const result = await getBookingsByDriverIdService(driverId, page, limit);
        res.status(200).json(successResponse("Bookings fetched successfully", { data: result.bookings, pagination: result.pagination }));
  } catch (error) {
    res
    .status(error.code || 500)
    .json(errorResponse(error.message, error.code));
  }
};

export const getBookingsByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const result = await getBookingsByStatusService(status, page, limit);
        res.status(200).json(successResponse("Bookings fetched successfully", { data: result.bookings, pagination: result.pagination }));
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

export const getDriverStats = async (req, res) => {
  try {
    const driverId = req.user._id.toString();

    const stats = await getDriverStatsService(driverId);
    return res.status(200).json(successResponse("Driver stats", stats));
  } catch (error) {
    console.error(error);
    return res.status(500).json(errorResponse(error.message));
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const result = await updatePaymentStatusService(id, paymentStatus);
    res.status(200).json(successResponse("Update Payment Status success",result));
  } catch (error) {
    res.status(400).json(errorResponse(error.message));
  }
};
