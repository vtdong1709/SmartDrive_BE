import multer from "multer";
import { errorResponse, successResponse } from "../../../utils/apiResponse.js";
import { uploadToCloudinary } from "../../../config/cloudinaryConfig.js";
import {
  addPhotoService,
  createVehicleService,
  getOwnedVehicle,
  getPublicVehicleService,
  listMyVehiclesService,
  publishVehicleService,
  removePhotoService,
  updateVehicleService,
} from "../services/vehicleService.js";
import {
  deleteAvailabilityService,
  listAvailabilityService,
  upsertAvailabilityService,
} from "../services/availabilityService.js";
import { searchVehiclesService } from "../services/searchService.js";
import { quoteVehicleService } from "../services/quoteService.js";
import {
  cancelBookingService,
  createBookingService,
  getBookingForUser,
  listMyRentalsService,
  listOwnerBookingsService,
  markReadyForPickupService,
  ownerRespondService,
} from "../services/bookingService.js";
import { getHandoverService, upsertHandoverService } from "../services/handoverService.js";
import {
  confirmReturnService,
  createReturnInspectionService,
  getReturnService,
} from "../services/returnService.js";
import SelfDriveDeposit from "../models/SelfDriveDeposit.js";
import { createVNPayPaymentService } from "../../../services/vnpayService.js";
import { createPaymentLinkService } from "../../../services/payOSService.js";
import SelfDriveBooking from "../models/SelfDriveBooking.js";
import { VEHICLE_STATUS } from "../constants.js";

export const uploadPhotosMw = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
}).array("photos", 6);

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error("[selfDrive]", error.message);
    return res
      .status(error.statusCode || error.code || 500)
      .json(errorResponse(error.message, error.statusCode || error.code || 500));
  }
};

const ip = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip;

export const createVehicle = handle(async (req, res) => {
  const data = await createVehicleService(req.user._id, req.body);
  res.json(successResponse("Tạo xe thành công", data));
});

export const listMyVehicles = handle(async (req, res) => {
  res.json(successResponse("Xe của tôi", await listMyVehiclesService(req.user._id)));
});

export const getMyVehicle = handle(async (req, res) => {
  res.json(successResponse("Chi tiết xe", await getOwnedVehicle(req.params.vehicleId, req.user._id)));
});

export const updateVehicle = handle(async (req, res) => {
  res.json(successResponse("Đã cập nhật xe", await updateVehicleService(req.params.vehicleId, req.user._id, req.body)));
});

export const publishVehicle = handle(async (req, res) => {
  const publish = req.body.publish !== false;
  res.json(successResponse(publish ? "Đã đăng xe" : "Đã ẩn xe", await publishVehicleService(req.params.vehicleId, req.user._id, publish)));
});

export const uploadVehiclePhotos = handle(async (req, res) => {
  await getOwnedVehicle(req.params.vehicleId, req.user._id);
  if (!req.files?.length) return res.status(400).json(errorResponse("Không có file", 400));
  let vehicle;
  for (const file of req.files) {
    const uploaded = await uploadToCloudinary(file, "self_drive", `sdv_${req.params.vehicleId}_${Date.now()}`);
    vehicle = await addPhotoService(req.params.vehicleId, req.user._id, {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    });
  }
  res.json(successResponse("Đã tải ảnh", vehicle));
});

export const addPhotoUrl = handle(async (req, res) => {
  res.json(successResponse("Đã thêm ảnh", await addPhotoService(req.params.vehicleId, req.user._id, req.body)));
});

export const removePhoto = handle(async (req, res) => {
  res.json(successResponse("Đã xóa ảnh", await removePhotoService(req.params.vehicleId, req.user._id, req.params.photoId)));
});

export const listAvailability = handle(async (req, res) => {
  await getOwnedVehicle(req.params.vehicleId, req.user._id);
  res.json(successResponse("Availability", await listAvailabilityService(req.params.vehicleId)));
});

export const addAvailability = handle(async (req, res) => {
  await getOwnedVehicle(req.params.vehicleId, req.user._id);
  res.json(successResponse("Đã lưu availability", await upsertAvailabilityService(req.params.vehicleId, req.user._id, req.body)));
});

export const removeAvailability = handle(async (req, res) => {
  await getOwnedVehicle(req.params.vehicleId, req.user._id);
  res.json(successResponse("Đã xóa", await deleteAvailabilityService(req.params.availabilityId, req.params.vehicleId)));
});

export const ownerBookings = handle(async (req, res) => {
  res.json(successResponse("Booking chủ xe", await listOwnerBookingsService(req.user._id)));
});

export const respondBooking = handle(async (req, res) => {
  res.json(successResponse("Đã cập nhật booking", await ownerRespondService(req.params.bookingId, req.user._id, req.body)));
});

export const markReady = handle(async (req, res) => {
  res.json(successResponse("Xe sẵn sàng nhận", await markReadyForPickupService(req.params.bookingId, req.user._id)));
});

export const searchVehicles = handle(async (req, res) => {
  res.json(successResponse("Xe còn trống", await searchVehiclesService(req.query)));
});

export const getPublicVehicle = handle(async (req, res) => {
  res.json(successResponse("Chi tiết xe", await getPublicVehicleService(req.params.vehicleId)));
});

export const publicAvailability = handle(async (req, res) => {
  const vehicle = await getPublicVehicleService(req.params.vehicleId);
  res.json(successResponse("Availability", await listAvailabilityService(vehicle._id)));
});

export const quoteVehicle = handle(async (req, res) => {
  res.json(successResponse("Báo giá", await quoteVehicleService(req.params.vehicleId, req.body)));
});

export const createBooking = handle(async (req, res) => {
  res.json(successResponse("Tạo booking thành công", await createBookingService(req.user, req.body)));
});

export const getBooking = handle(async (req, res) => {
  res.json(successResponse("Chi tiết booking", await getBookingForUser(req.params.bookingId, req.user)));
});

export const myRentals = handle(async (req, res) => {
  res.json(successResponse("Thuê xe của tôi", await listMyRentalsService(req.user._id)));
});

export const cancelBooking = handle(async (req, res) => {
  res.json(successResponse("Đã hủy", await cancelBookingService(req.params.bookingId, req.user, req.body.reason)));
});

export const payBooking = handle(async (req, res) => {
  const booking = await getBookingForUser(req.params.bookingId, req.user);
  if (String(booking.customerId) !== String(req.user._id)) {
    return res.status(403).json(errorResponse("Chỉ khách thuê được thanh toán", 403));
  }
  const purpose = req.body.purpose === "deposit" ? "self_drive_deposit" : "self_drive";
  const provider = req.body.provider || "vnpay";
  if (provider === "vnpay") {
    const payment = await createVNPayPaymentService({
      purpose,
      referenceId: booking.bookingCode,
      ipAddr: ip(req),
    });
    return res.json(successResponse("Tạo thanh toán VNPay", payment));
  }
  const payment = await createPaymentLinkService({
    purpose,
    referenceId: booking.bookingCode,
  });
  res.json(successResponse("Tạo thanh toán PayOS", payment));
});

export const getDeposit = handle(async (req, res) => {
  const booking = await getBookingForUser(req.params.bookingId, req.user);
  const deposit = await SelfDriveDeposit.findOne({ bookingId: booking._id });
  res.json(successResponse("Cọc", deposit));
});

export const handover = handle(async (req, res) => {
  res.json(successResponse("Handover", await upsertHandoverService(req.params.bookingId, req.user, req.body)));
});

export const getHandover = handle(async (req, res) => {
  res.json(successResponse("Handover", await getHandoverService(req.params.bookingId, req.user)));
});

export const returnInspect = handle(async (req, res) => {
  res.json(successResponse("Return inspection", await createReturnInspectionService(req.params.bookingId, req.user._id, req.body)));
});

export const confirmReturn = handle(async (req, res) => {
  res.json(successResponse("Đã xác nhận trả xe", await confirmReturnService(req.params.bookingId, req.user)));
});

export const getReturn = handle(async (req, res) => {
  await getBookingForUser(req.params.bookingId, req.user);
  res.json(successResponse("Return", await getReturnService(req.params.bookingId)));
});

export const adminListBookings = handle(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = status ? { status } : {};
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    SelfDriveBooking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    SelfDriveBooking.countDocuments(filter),
  ]);
  res.json(successResponse("Admin bookings", { items, total, page: Number(page), limit: Number(limit) }));
});

export { VEHICLE_STATUS };
