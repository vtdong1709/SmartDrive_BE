import { errorResponse, successResponse } from "../../../utils/apiResponse.js";
import { createVNPayPaymentService } from "../../../services/vnpayService.js";
import { createPaymentLinkService } from "../../../services/payOSService.js";
import { listCategoriesService, updateCategoryService } from "../services/categoryService.js";
import { createQuoteService } from "../services/quoteService.js";
import {
  acceptOfferService,
  adminListRides,
  cancelRideService,
  completeRideService,
  createRideService,
  driverEarningsSummary,
  driverLocationForRide,
  getDriverActiveRide,
  getRideForUser,
  listCustomerRides,
  listDriverOffers,
  listDriverRides,
  markArrivedService,
  rateRideService,
  rejectOfferService,
  revealOtpForCustomer,
  serializeRide,
  verifyOtpAndStartService,
} from "../services/bookingService.js";
import { getDriverVehicle, upsertDriverVehicle } from "../services/vehicleService.js";
import { updateDriverLocationService } from "../services/locationService.js";

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error("[rideHailing]", error.message);
    return res
      .status(error.statusCode || error.code || 500)
      .json(errorResponse(error.message, error.statusCode || error.code || 500, error.errorCode));
  }
};

const ip = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip;

export const listCategories = handle(async (_req, res) => {
  res.json(successResponse("Loại xe", await listCategoriesService()));
});

export const quoteRide = handle(async (req, res) => {
  res.json(successResponse("Báo giá", await createQuoteService(req.user._id, req.body)));
});

export const createRide = handle(async (req, res) => {
  const ride = await createRideService(req.user._id, req.body);
  res.json(successResponse("Tạo chuyến thành công", await serializeRide(ride, req.user)));
});

export const getRide = handle(async (req, res) => {
  const ride = await getRideForUser(req.params.id, req.user);
  res.json(successResponse("Chi tiết chuyến", await serializeRide(ride, req.user)));
});

export const getRideStatus = handle(async (req, res) => {
  const ride = await getRideForUser(req.params.id, req.user);
  const location = await driverLocationForRide(ride);
  res.json(
    successResponse("Trạng thái chuyến", {
      id: ride._id,
      rideCode: ride.rideCode,
      status: ride.status,
      paymentStatus: ride.paymentStatus,
      quotedFare: ride.quotedFare,
      finalFare: ride.finalFare,
      driver: location,
    })
  );
});

export const getDriverLocation = handle(async (req, res) => {
  const ride = await getRideForUser(req.params.id, req.user);
  res.json(successResponse("Vị trí tài xế", await driverLocationForRide(ride)));
});

export const getOtp = handle(async (req, res) => {
  res.json(successResponse("OTP nhận xe", await revealOtpForCustomer(req.params.id, req.user)));
});

export const cancelRide = handle(async (req, res) => {
  const ride = await cancelRideService(req.params.id, req.user, req.body.reason);
  res.json(successResponse("Đã hủy chuyến", await serializeRide(ride, req.user)));
});

export const rateRide = handle(async (req, res) => {
  res.json(successResponse("Đã đánh giá", await rateRideService(req.params.id, req.user, req.body)));
});

export const myHistory = handle(async (req, res) => {
  const data = await listCustomerRides(req.user._id, req.query);
  const items = await Promise.all(data.items.map((ride) => serializeRide(ride, req.user)));
  res.json(successResponse("Lịch sử chuyến", { ...data, items }));
});

export const payRide = handle(async (req, res) => {
  const ride = await getRideForUser(req.params.id, req.user);
  if (String(ride.customerId) !== String(req.user._id)) {
    return res.status(403).json(errorResponse("Chỉ khách được thanh toán", 403, "FORBIDDEN"));
  }
  if (ride.paymentMethod === "cash") {
    return res.json(successResponse("Thanh toán tiền mặt", { paymentMethod: "cash", paymentStatus: ride.paymentStatus }));
  }
  const provider = req.body.provider || ride.paymentMethod || "vnpay";
  if (provider === "vnpay") {
    const payment = await createVNPayPaymentService({
      purpose: "ride_hailing",
      referenceId: ride.rideCode,
      ipAddr: ip(req),
    });
    return res.json(successResponse("Tạo thanh toán VNPay", payment));
  }
  const payment = await createPaymentLinkService({
    purpose: "ride_hailing",
    referenceId: ride.rideCode,
  });
  res.json(successResponse("Tạo thanh toán PayOS", payment));
});

export const driverOffers = handle(async (req, res) => {
  res.json(successResponse("Offer đang chờ", await listDriverOffers(req.user._id)));
});

export const acceptOffer = handle(async (req, res) => {
  const result = await acceptOfferService(req.params.offerId, req.user._id);
  res.json(successResponse("Đã nhận chuyến", await serializeRide(result.ride, req.user)));
});

export const rejectOffer = handle(async (req, res) => {
  res.json(successResponse("Đã từ chối offer", await rejectOfferService(req.params.offerId, req.user._id)));
});

export const arriveRide = handle(async (req, res) => {
  const ride = await markArrivedService(req.params.id, req.user._id);
  res.json(successResponse("Đã đến điểm đón", await serializeRide(ride, req.user)));
});

export const verifyOtp = handle(async (req, res) => {
  const ride = await verifyOtpAndStartService(req.params.id, req.user._id, req.body.otp);
  res.json(successResponse("OTP hợp lệ, chuyến đã bắt đầu", await serializeRide(ride, req.user)));
});

export const startRide = handle(async (req, res) => {
  const ride = await verifyOtpAndStartService(req.params.id, req.user._id, req.body.otp);
  res.json(successResponse("Chuyến đã bắt đầu", await serializeRide(ride, req.user)));
});

export const completeRide = handle(async (req, res) => {
  const ride = await completeRideService(req.params.id, req.user._id, req.body);
  res.json(successResponse("Hoàn thành chuyến", await serializeRide(ride, req.user)));
});

export const driverActive = handle(async (req, res) => {
  const ride = await getDriverActiveRide(req.user._id);
  res.json(successResponse("Chuyến đang chạy", ride ? await serializeRide(ride, req.user) : null));
});

export const driverHistory = handle(async (req, res) => {
  const data = await listDriverRides(req.user._id, req.query);
  const items = await Promise.all(data.items.map((ride) => serializeRide(ride, req.user)));
  res.json(successResponse("Lịch sử tài xế", { ...data, items }));
});

export const driverEarnings = handle(async (req, res) => {
  res.json(successResponse("Thu nhập", await driverEarningsSummary(req.user._id)));
});

export const upsertVehicle = handle(async (req, res) => {
  res.json(successResponse("Xe đặt xe", await upsertDriverVehicle(req.user._id, req.body)));
});

export const myVehicle = handle(async (req, res) => {
  res.json(successResponse("Xe của tôi", await getDriverVehicle(req.user._id)));
});

export const updateLocation = handle(async (req, res) => {
  res.json(successResponse("Đã cập nhật vị trí", await updateDriverLocationService(req.user._id, req.body)));
});

export const adminRides = handle(async (req, res) => {
  res.json(successResponse("Admin rides", await adminListRides(req.query)));
});

export const adminRideDetail = handle(async (req, res) => {
  const ride = await getRideForUser(req.params.id, req.user);
  res.json(successResponse("Admin ride detail", ride));
});

export const adminUpdateCategory = handle(async (req, res) => {
  res.json(successResponse("Đã cập nhật loại xe", await updateCategoryService(req.params.code, req.body)));
});
