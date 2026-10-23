import redis from "../../../redis.js";
import SelfDriveBooking from "../models/SelfDriveBooking.js";
import SelfDriveDeposit from "../models/SelfDriveDeposit.js";
import {
  BLOCKING_BOOKING_STATUSES,
  BOOKING_STATUS,
  BOOKING_TYPE,
  PAYMENT_STATUS,
  VEHICLE_STATUS,
} from "../constants.js";
import { httpError, assertOwner } from "../httpError.js";
import { assertTransition, shouldApplyPayment } from "./stateMachine.js";
import { assertCustomerEligible, publicKycSummary } from "./kycService.js";
import { assertVehicleAvailable } from "./availabilityService.js";
import { quoteVehicleService } from "./quoteService.js";
import { consumeQuote } from "../../../pricing/pricingEngine.js";
import { PRICING_SERVICE } from "../../../pricing/constants.js";
import { snapshotFromQuote } from "../../../pricing/services/quoteService.js";
import { getPublicVehicleService } from "./vehicleService.js";
import { notifyUsers, emitSelfDrive } from "./notify.js";

const lockVehicle = async (vehicleId) => {
  const key = `self-drive:vehicle:${vehicleId}`;
  try {
    const ok = await redis.set(key, "1", "PX", 8000, "NX");
    if (!ok) throw httpError("Xe đang được đặt bởi người khác, thử lại", 409);
    return key;
  } catch (error) {
    if (error.statusCode === 409) throw error;
    console.warn("[selfDrive] redis lock skipped", error.message);
    return null;
  }
};

export const createBookingService = async (user, payload) => {
  const { vehicleId, startAt, endAt, deliveryLocation, notes, includeInsurance } = payload;
  const kyc = await assertCustomerEligible(user);
  const vehicle = await getPublicVehicleService(vehicleId);
  if (String(vehicle.ownerId._id || vehicle.ownerId) === String(user._id)) {
    throw httpError("Không thể tự thuê xe của mình", 400);
  }

  const quoted = await quoteVehicleService(vehicleId, {
    startAt,
    endAt,
    deliveryLocation,
    includeInsurance,
    persist: !payload.quoteId,
  });
  let pricingSnapshot = null;
  if (payload.quoteId) {
    const consumed = await consumeQuote({
      quoteId: payload.quoteId,
      userId: user._id,
      service: PRICING_SERVICE.SELF_DRIVE,
    });
    quoted.quote.total = consumed.finalFare;
    quoted.depositAmount = consumed.deposit;
    pricingSnapshot = snapshotFromQuote(consumed);
  }

  const type = vehicle.instantBookingEnabled
    ? BOOKING_TYPE.INSTANT_BOOK
    : BOOKING_TYPE.REQUEST_TO_BOOK;
  const status = vehicle.instantBookingEnabled
    ? BOOKING_STATUS.AWAITING_PAYMENT
    : BOOKING_STATUS.PENDING_OWNER_APPROVAL;

  const lock = await lockVehicle(vehicle._id);
  try {
    await assertVehicleAvailable(vehicle, startAt, endAt);
    const booking = await SelfDriveBooking.create({
      type,
      vehicleId: vehicle._id,
      ownerId: vehicle.ownerId._id || vehicle.ownerId,
      customerId: user._id,
      startAt,
      endAt,
      deliveryRequested: Boolean(deliveryLocation),
      deliveryLocation: deliveryLocation
        ? {
            address: deliveryLocation.address,
            latitude: deliveryLocation.lat ?? deliveryLocation.latitude,
            longitude: deliveryLocation.lng ?? deliveryLocation.longitude,
          }
        : null,
      quote: quoted.quote,
      quoteId: payload.quoteId || quoted.quoteId || null,
      pricingSnapshot,
      totalAmount: quoted.quote.total,
      depositAmount: quoted.depositAmount,
      status,
      paymentStatus: PAYMENT_STATUS.PENDING,
      notes: notes || null,
      vehicleSnapshot: {
        make: vehicle.make,
        model: vehicle.model,
        plate: vehicle.plate,
        year: vehicle.year,
        dailyPrice: vehicle.dailyPrice,
      },
    });

    if (quoted.depositAmount > 0) {
      await SelfDriveDeposit.create({
        bookingId: booking._id,
        customerId: user._id,
        ownerId: booking.ownerId,
        amount: quoted.depositAmount,
      });
    }

    await notifyUsers({
      userIds: [booking.ownerId, booking.customerId],
      title: type === BOOKING_TYPE.INSTANT_BOOK ? "Yêu cầu thuê xe (instant)" : "Yêu cầu thuê xe mới",
      message: `Booking ${booking.bookingCode} ${startAt} → ${endAt}`,
      meta: { bookingId: booking._id, kyc: publicKycSummary(kyc) },
    });
    emitSelfDrive("selfDrive.booking.created", { bookingId: booking._id, vehicleId: vehicle._id });
    return booking;
  } finally {
    if (lock) await redis.del(lock).catch(() => null);
  }
};

export const getBookingForUser = async (bookingId, user) => {
  const booking = await SelfDriveBooking.findById(bookingId);
  if (!booking) throw httpError("Không tìm thấy booking", 404);
  const allowed =
    ["admin", "staff"].includes(user.role) ||
    String(booking.customerId) === String(user._id) ||
    String(booking.ownerId) === String(user._id);
  if (!allowed) throw httpError("Không được xem booking này", 403);
  return booking;
};

export const ownerRespondService = async (bookingId, ownerId, { accept, reason }) => {
  const booking = await SelfDriveBooking.findById(bookingId);
  if (!booking) throw httpError("Không tìm thấy booking", 404);
  assertOwner(booking.ownerId, ownerId);
  if (booking.status !== BOOKING_STATUS.PENDING_OWNER_APPROVAL) {
    throw httpError("Booking không còn chờ duyệt", 400);
  }
  if (!accept) {
    assertTransition(booking.status, BOOKING_STATUS.REJECTED);
    booking.status = BOOKING_STATUS.REJECTED;
    booking.rejectReason = reason || "Chủ xe từ chối";
    await booking.save();
    await notifyUsers({
      userIds: [booking.customerId],
      title: "Yêu cầu thuê xe bị từ chối",
      message: booking.rejectReason,
      type: "warning",
      meta: { bookingId: booking._id },
    });
    return booking;
  }
  assertTransition(booking.status, BOOKING_STATUS.AWAITING_PAYMENT);
  booking.status = BOOKING_STATUS.AWAITING_PAYMENT;
  await booking.save();
  await notifyUsers({
    userIds: [booking.customerId],
    title: "Chủ xe đã chấp nhận",
    message: `Vui lòng thanh toán ${booking.bookingCode}`,
    type: "payment",
    meta: { bookingId: booking._id },
  });
  return booking;
};

export const confirmRentalPayment = async (booking, { amount, isSuccess }) => {
  if (!shouldApplyPayment(booking)) return { booking, duplicate: true };
  if (!isSuccess) {
    booking.paymentStatus = PAYMENT_STATUS.FAILED;
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancelledBy = "system";
    booking.cancelReason = "Thanh toán thất bại";
    await booking.save();
    return { booking, duplicate: false };
  }
  assertTransition(booking.status, BOOKING_STATUS.CONFIRMED);
  booking.paymentStatus = PAYMENT_STATUS.PAID;
  booking.status = BOOKING_STATUS.CONFIRMED;
  booking.payment = {
    ...(booking.payment?.toObject?.() || booking.payment || {}),
    amount,
    paidAt: new Date(),
  };
  await booking.save();
  await notifyUsers({
    userIds: [booking.customerId, booking.ownerId],
    title: "Thanh toán thuê xe thành công",
    message: `Booking ${booking.bookingCode} đã CONFIRMED`,
    type: "payment",
    meta: { bookingId: booking._id },
  });
  emitSelfDrive("selfDrive.booking.confirmed", { bookingId: booking._id });
  return { booking, duplicate: false };
};

export const markReadyForPickupService = async (bookingId, ownerId) => {
  const booking = await SelfDriveBooking.findById(bookingId);
  if (!booking) throw httpError("Không tìm thấy booking", 404);
  assertOwner(booking.ownerId, ownerId);
  assertTransition(booking.status, BOOKING_STATUS.READY_FOR_PICKUP);
  booking.status = BOOKING_STATUS.READY_FOR_PICKUP;
  await booking.save();
  await notifyUsers({
    userIds: [booking.customerId],
    title: "Xe sẵn sàng nhận",
    message: `Booking ${booking.bookingCode} READY_FOR_PICKUP`,
    meta: { bookingId: booking._id },
  });
  return booking;
};

export const cancelBookingService = async (bookingId, user, reason) => {
  const booking = await getBookingForUser(bookingId, user);
  const next = BOOKING_STATUS.CANCELLED;
  assertTransition(booking.status, next);
  booking.status = next;
  booking.cancelledAt = new Date();
  booking.cancelledBy = String(booking.customerId) === String(user._id) ? "customer" : "owner";
  booking.cancelReason = reason || "Hủy booking";
  await booking.save();
  await notifyUsers({
    userIds: [booking.customerId, booking.ownerId],
    title: "Booking thuê xe đã hủy",
    message: booking.cancelReason,
    type: "warning",
    meta: { bookingId: booking._id },
  });
  return booking;
};

export const listMyRentalsService = async (userId) => {
  return SelfDriveBooking.find({ customerId: userId }).sort({ createdAt: -1 });
};

export const listOwnerBookingsService = async (ownerId) => {
  return SelfDriveBooking.find({ ownerId }).sort({ createdAt: -1 });
};

export { shouldApplyPayment, BLOCKING_BOOKING_STATUSES, VEHICLE_STATUS };
