import { errorResponse, successResponse } from "../../../utils/apiResponse.js";
import {
  configureVehicleSeatsService,
  createVehicleService,
  getVehicleService,
  listMyVehiclesService,
  listSeatTemplatesService,
  updateVehicleService,
} from "../services/vehicleService.js";
import {
  cancelTripService,
  completeTripService,
  configureTripSeatsService,
  createDraftTripService,
  getTripDetailService,
  listDriverTripsService,
  publishTripService,
  startTripService,
  trackTripService,
  tripDashboardService,
  tripRevenueSummaryService,
  updateTripService,
} from "../services/tripService.js";
import { popularRoutesService, searchTripsService } from "../services/searchService.js";
import { holdSeatsService, quoteTripService, releaseHoldService } from "../services/holdService.js";
import {
  cancelPassengerBookingService,
  createBookingFromHoldService,
  driverCancelPassengerBookingService,
  getBookingForUser,
  getPublicSeatMapService,
  getTicketForUser,
  listTripPassengersService,
  passengerHistoryService,
  serializeBooking,
  tripManifestService,
} from "../services/bookingService.js";
import {
  charterQuoteService,
  createCharterService,
  getCharterForUser,
  listCharterCapableDriversService,
  listDriverChartersService,
  listPassengerChartersService,
  respondCharterService,
} from "../services/charterService.js";
import { createVNPayPaymentService } from "../../../services/vnpayService.js";
import { createPaymentLinkService } from "../../../services/payOSService.js";
import SharedRideTrip from "../models/SharedRideTrip.js";
import SharedRideBooking from "../models/SharedRideBooking.js";

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error("[sharedRide]", error.message);
    return res
      .status(error.statusCode || error.code || 500)
      .json(errorResponse(error.message, error.statusCode || error.code || 500));
  }
};

const clientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  req.ip;

export const listSeatTemplates = handle(async (_req, res) => {
  res.json(successResponse("Seat templates", listSeatTemplatesService()));
});

export const createVehicle = handle(async (req, res) => {
  const vehicle = await createVehicleService(req.user._id, req.body);
  res.status(200).json(successResponse("Tạo xe thành công", vehicle));
});

export const listMyVehicles = handle(async (req, res) => {
  const items = await listMyVehiclesService(req.user._id);
  res.json(successResponse("Danh sách xe", items));
});

export const getVehicle = handle(async (req, res) => {
  const vehicle = await getVehicleService(req.params.vehicleId, req.user._id);
  res.json(successResponse("Chi tiết xe", vehicle));
});

export const updateVehicle = handle(async (req, res) => {
  const vehicle = await updateVehicleService(req.params.vehicleId, req.user._id, req.body);
  res.json(successResponse("Cập nhật xe thành công", vehicle));
});

export const configureVehicleSeats = handle(async (req, res) => {
  const vehicle = await configureVehicleSeatsService(
    req.params.vehicleId,
    req.user._id,
    req.body.seats
  );
  res.json(successResponse("Cập nhật ghế thành công", vehicle));
});

export const createDraftTrip = handle(async (req, res) => {
  const trip = await createDraftTripService(req.user._id, req.body);
  res.json(successResponse("Tạo chuyến nháp thành công", trip));
});

export const updateTrip = handle(async (req, res) => {
  const trip = await updateTripService(req.params.tripId, req.user._id, req.body);
  res.json(successResponse("Cập nhật chuyến thành công", trip));
});

export const configureTripSeats = handle(async (req, res) => {
  const trip = await configureTripSeatsService(req.params.tripId, req.user._id, req.body.seats);
  res.json(successResponse("Cập nhật ghế chuyến thành công", trip));
});

export const publishTrip = handle(async (req, res) => {
  const trip = await publishTripService(req.params.tripId, req.user._id);
  res.json(successResponse("Đăng chuyến thành công", trip));
});

export const listDriverTrips = handle(async (req, res) => {
  const data = await listDriverTripsService(req.user._id, req.query);
  res.json(successResponse("Danh sách chuyến", data));
});

export const tripDashboard = handle(async (req, res) => {
  const data = await tripDashboardService(req.params.tripId, req.user._id);
  res.json(successResponse("Trip dashboard", data));
});

export const tripPassengers = handle(async (req, res) => {
  const items = await listTripPassengersService(req.params.tripId, req.user._id);
  res.json(successResponse("Danh sách khách", items));
});

export const tripManifest = handle(async (req, res) => {
  const data = await tripManifestService(req.params.tripId, req.user._id);
  res.json(successResponse("Passenger manifest", data));
});

export const startTrip = handle(async (req, res) => {
  const trip = await startTripService(req.params.tripId, req.user._id);
  res.json(successResponse("Đã bắt đầu chuyến", trip));
});

export const completeTrip = handle(async (req, res) => {
  const trip = await completeTripService(req.params.tripId, req.user._id);
  res.json(successResponse("Đã hoàn thành chuyến", trip));
});

export const cancelTrip = handle(async (req, res) => {
  const trip = await cancelTripService(req.params.tripId, req.user._id, req.body.reason);
  res.json(successResponse("Đã hủy chuyến", trip));
});

export const driverCancelBooking = handle(async (req, res) => {
  const booking = await driverCancelPassengerBookingService(
    req.params.bookingId,
    req.user._id,
    req.body.reason
  );
  res.json(successResponse("Đã hủy booking", booking));
});

export const driverRevenue = handle(async (req, res) => {
  const data = await tripRevenueSummaryService(req.user._id, req.query);
  res.json(successResponse("Doanh thu xe ghép", data));
});

export const searchTrips = handle(async (req, res) => {
  const data = await searchTripsService(req.query);
  res.json(successResponse("Kết quả tìm chuyến", data));
});

export const popularRoutes = handle(async (_req, res) => {
  const data = await popularRoutesService();
  res.json(successResponse("Tuyến phổ biến", data));
});

export const getTripDetail = handle(async (req, res) => {
  const data = await getTripDetailService(req.params.tripId);
  res.json(successResponse("Chi tiết chuyến", data));
});

export const getSeatMap = handle(async (req, res) => {
  const data = await getPublicSeatMapService(req.params.tripId, req.query);
  res.json(successResponse("Sơ đồ ghế theo chặng", data));
});

export const quoteTrip = handle(async (req, res) => {
  const data = await quoteTripService(req.params.tripId, req.body);
  res.json(successResponse("Báo giá", data));
});

export const holdSeats = handle(async (req, res) => {
  const data = await holdSeatsService(req.params.tripId, req.user._id, req.body);
  res.json(successResponse("Đã giữ ghế", data));
});

export const releaseHold = handle(async (req, res) => {
  const data = await releaseHoldService(req.params.holdId, req.user._id);
  res.json(successResponse("Đã bỏ giữ ghế", data));
});

export const createBooking = handle(async (req, res) => {
  const booking = await createBookingFromHoldService(req.user._id, req.body);
  res.json(successResponse("Tạo booking thành công", await serializeBooking(booking)));
});

export const payBooking = handle(async (req, res) => {
  const booking = await getBookingForUser(req.params.bookingId, req.user);
  if (String(booking.passengerId) !== String(req.user._id)) {
    return res.status(403).json(errorResponse("Chỉ hành khách được thanh toán booking này", 403));
  }
  const provider = req.body.provider || "vnpay";
  if (provider === "vnpay") {
    const payment = await createVNPayPaymentService({
      purpose: "shared_ride",
      referenceId: booking.bookingCode,
      ipAddr: clientIp(req),
    });
    return res.json(successResponse("Tạo thanh toán VNPay thành công", payment));
  }
  const payment = await createPaymentLinkService({
    purpose: "shared_ride",
    referenceId: booking.bookingCode,
  });
  return res.json(successResponse("Tạo thanh toán PayOS thành công", payment));
});

export const getBooking = handle(async (req, res) => {
  const booking = await getBookingForUser(req.params.bookingId, req.user);
  res.json(successResponse("Chi tiết booking", await serializeBooking(booking)));
});

export const getTicket = handle(async (req, res) => {
  const ticket = await getTicketForUser(req.params.ticketId, req.user);
  res.json(successResponse("Vé xe ghép", ticket));
});

export const myBookings = handle(async (req, res) => {
  const data = await passengerHistoryService(req.user._id, req.query);
  res.json(successResponse("Lịch sử booking", data));
});

export const cancelBooking = handle(async (req, res) => {
  const booking = await cancelPassengerBookingService(req.params.bookingId, req.user);
  res.json(successResponse("Đã hủy booking", booking));
});

export const trackTrip = handle(async (req, res) => {
  const data = await trackTripService(req.params.tripId);
  res.json(successResponse("Trạng thái chuyến", data));
});

export const charterQuote = handle(async (req, res) => {
  const data = await charterQuoteService(req.body);
  res.json(successResponse("Báo giá bao xe", data));
});

export const createCharter = handle(async (req, res) => {
  const data = await createCharterService(req.user._id, req.body);
  res.json(successResponse("Đã gửi yêu cầu bao xe", data));
});

export const getCharter = handle(async (req, res) => {
  const data = await getCharterForUser(req.params.charterId, req.user);
  res.json(successResponse("Chi tiết bao xe", data));
});

export const payCharter = handle(async (req, res) => {
  const charter = await getCharterForUser(req.params.charterId, req.user);
  if (String(charter.passengerId) !== String(req.user._id)) {
    return res.status(403).json(errorResponse("Chỉ hành khách được thanh toán", 403));
  }
  const provider = req.body.provider || "vnpay";
  if (provider === "vnpay") {
    const payment = await createVNPayPaymentService({
      purpose: "shared_ride_charter",
      referenceId: charter.charterCode,
      ipAddr: clientIp(req),
    });
    return res.json(successResponse("Tạo thanh toán VNPay thành công", payment));
  }
  const payment = await createPaymentLinkService({
    purpose: "shared_ride_charter",
    referenceId: charter.charterCode,
  });
  return res.json(successResponse("Tạo thanh toán PayOS thành công", payment));
});

export const respondCharter = handle(async (req, res) => {
  const data = await respondCharterService(req.params.charterId, req.user._id, req.body);
  res.json(successResponse("Cập nhật yêu cầu bao xe", data));
});

export const listDriverCharters = handle(async (req, res) => {
  const data = await listDriverChartersService(req.user._id);
  res.json(successResponse("Yêu cầu bao xe", data));
});

export const listMyCharters = handle(async (req, res) => {
  const data = await listPassengerChartersService(req.user._id);
  res.json(successResponse("Yêu cầu bao xe của tôi", data));
});

export const listCharterDrivers = handle(async (_req, res) => {
  const data = await listCharterCapableDriversService();
  res.json(successResponse("Xe nhận bao", data));
});

export const adminListTrips = handle(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = status ? { status } : {};
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    SharedRideTrip.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    SharedRideTrip.countDocuments(filter),
  ]);
  res.json(successResponse("Admin trips", { items, total, page: Number(page), limit: Number(limit) }));
});

export const adminListBookings = handle(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = status ? { status } : {};
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    SharedRideBooking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    SharedRideBooking.countDocuments(filter),
  ]);
  res.json(successResponse("Admin bookings", { items, total, page: Number(page), limit: Number(limit) }));
});
