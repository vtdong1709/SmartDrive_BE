import SelfDriveHandover from "../models/SelfDriveHandover.js";
import SelfDriveBooking from "../models/SelfDriveBooking.js";
import { BOOKING_STATUS } from "../constants.js";
import { httpError, assertOwner } from "../httpError.js";
import { assertTransition } from "./stateMachine.js";
import { notifyUsers } from "./notify.js";

export const upsertHandoverService = async (bookingId, user, payload) => {
  const booking = await SelfDriveBooking.findById(bookingId);
  if (!booking) throw httpError("Không tìm thấy booking", 404);
  const isOwner = String(booking.ownerId) === String(user._id);
  const isCustomer = String(booking.customerId) === String(user._id);
  if (!isOwner && !isCustomer && user.role !== "admin") {
    throw httpError("Không có quyền handover booking này", 403);
  }
  if (![BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.READY_FOR_PICKUP].includes(booking.status)) {
    throw httpError("Booking chưa sẵn sàng bàn giao", 400);
  }

  let handover = await SelfDriveHandover.findOne({ bookingId });
  if (!handover) {
    if (!isOwner && user.role !== "admin") {
      throw httpError("Chủ xe phải tạo biên bản bàn giao trước", 403);
    }
    if (payload.odometer == null) throw httpError("Thiếu odometer", 400);
    handover = await SelfDriveHandover.create({
      bookingId,
      odometer: payload.odometer,
      fuelLevel: payload.fuelLevel,
      batteryLevel: payload.batteryLevel,
      photos: payload.photos || [],
      existingDamage: payload.existingDamage || "",
      accessories: payload.accessories || [],
      notes: payload.notes || "",
      ownerConfirmedAt: new Date(),
      timestamp: new Date(),
    });
    if (booking.status === BOOKING_STATUS.CONFIRMED) {
      assertTransition(booking.status, BOOKING_STATUS.READY_FOR_PICKUP);
      booking.status = BOOKING_STATUS.READY_FOR_PICKUP;
      await booking.save();
    }
    await notifyUsers({
      userIds: [booking.customerId],
      title: "Biên bản bàn giao xe",
      message: "Vui lòng xác nhận handover để bắt đầu thuê.",
      meta: { bookingId },
    });
    return handover;
  }

  if (isOwner) {
    Object.assign(handover, {
      odometer: payload.odometer ?? handover.odometer,
      fuelLevel: payload.fuelLevel ?? handover.fuelLevel,
      batteryLevel: payload.batteryLevel ?? handover.batteryLevel,
      photos: payload.photos || handover.photos,
      existingDamage: payload.existingDamage ?? handover.existingDamage,
      accessories: payload.accessories || handover.accessories,
      ownerConfirmedAt: new Date(),
    });
  }
  if (isCustomer) {
    handover.customerConfirmedAt = new Date();
  }
  await handover.save();

  if (handover.ownerConfirmedAt && handover.customerConfirmedAt) {
    assertTransition(booking.status, BOOKING_STATUS.IN_USE);
    booking.status = BOOKING_STATUS.IN_USE;
    await booking.save();
    await notifyUsers({
      userIds: [booking.customerId, booking.ownerId],
      title: "Đã bàn giao xe",
      message: `Booking ${booking.bookingCode} đang IN_USE`,
      meta: { bookingId },
    });
  }
  return handover;
};

export const getHandoverService = async (bookingId, user) => {
  const booking = await SelfDriveBooking.findById(bookingId);
  if (!booking) throw httpError("Không tìm thấy booking", 404);
  if (
    String(booking.customerId) !== String(user._id) &&
    String(booking.ownerId) !== String(user._id) &&
    !["admin", "staff"].includes(user.role)
  ) {
    throw httpError("Không được xem handover", 403);
  }
  return SelfDriveHandover.findOne({ bookingId });
};
