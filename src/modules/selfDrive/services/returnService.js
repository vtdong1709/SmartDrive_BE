import SelfDriveReturn from "../models/SelfDriveReturn.js";
import SelfDriveHandover from "../models/SelfDriveHandover.js";
import SelfDriveBooking from "../models/SelfDriveBooking.js";
import SelfDriveDeposit from "../models/SelfDriveDeposit.js";
import SelfDriveVehicle from "../models/SelfDriveVehicle.js";
import { BOOKING_STATUS, DEPOSIT_STATUS } from "../constants.js";
import { httpError, assertOwner } from "../httpError.js";
import { assertTransition } from "./stateMachine.js";
import { computeReturnCharges } from "./quoteMath.js";
import { notifyUsers } from "./notify.js";

export const createReturnInspectionService = async (bookingId, ownerId, payload) => {
  const booking = await SelfDriveBooking.findById(bookingId);
  if (!booking) throw httpError("Không tìm thấy booking", 404);
  assertOwner(booking.ownerId, ownerId);
  if (booking.status !== BOOKING_STATUS.IN_USE) {
    throw httpError("Chỉ kiểm tra trả xe khi booking IN_USE", 400);
  }
  const handover = await SelfDriveHandover.findOne({ bookingId });
  if (!handover) throw httpError("Chưa có biên bản bàn giao", 400);
  if (payload.returnOdometer == null) throw httpError("Thiếu returnOdometer", 400);

  const vehicle = await SelfDriveVehicle.findById(booking.vehicleId);
  const usedKm = Math.max(0, Number(payload.returnOdometer) - Number(handover.odometer));
  const days = Math.max(1, booking.quote?.chargeableDays || 1);
  const includedKm = Number(vehicle?.dailyMileageLimit || 0) * days;
  const damageFee = (payload.damages || []).reduce((s, d) => s + Number(d.estimatedFee || 0), 0);
  const charges = computeReturnCharges({
    includedKm,
    usedKm,
    excessMileagePrice: vehicle?.excessMileagePrice || 0,
    scheduledEndAt: booking.endAt,
    actualReturnAt: payload.actualReturnAt || new Date(),
    lateFeePerHour: vehicle?.lateFeePerHour || 0,
    fuelFee: payload.fuelFee || 0,
    damageFee,
    otherCharges: payload.otherCharges || 0,
  });

  const doc = await SelfDriveReturn.findOneAndUpdate(
    { bookingId },
    {
      bookingId,
      returnOdometer: payload.returnOdometer,
      fuelLevel: payload.fuelLevel,
      batteryLevel: payload.batteryLevel,
      actualReturnAt: payload.actualReturnAt || new Date(),
      photos: payload.photos || [],
      damages: payload.damages || [],
      notes: payload.notes || "",
      fuelFee: payload.fuelFee || 0,
      otherCharges: payload.otherCharges || 0,
      charges,
      ownerConfirmedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  assertTransition(booking.status, BOOKING_STATUS.RETURN_INSPECTION);
  booking.status = BOOKING_STATUS.RETURN_INSPECTION;
  await booking.save();
  await notifyUsers({
    userIds: [booking.customerId],
    title: "Biên bản trả xe",
    message: `Phí phát sinh ${charges.total}₫. Vui lòng xác nhận.`,
    meta: { bookingId, charges },
  });
  return doc;
};

export const confirmReturnService = async (bookingId, user) => {
  const booking = await SelfDriveBooking.findById(bookingId);
  if (!booking) throw httpError("Không tìm thấy booking", 404);
  if (String(booking.customerId) !== String(user._id) && user.role !== "admin") {
    throw httpError("Chỉ khách thuê được xác nhận trả xe", 403);
  }
  const inspection = await SelfDriveReturn.findOne({ bookingId });
  if (!inspection) throw httpError("Chưa có biên bản trả xe", 400);
  inspection.customerConfirmedAt = new Date();
  await inspection.save();

  assertTransition(booking.status, BOOKING_STATUS.COMPLETED);
  booking.status = BOOKING_STATUS.COMPLETED;
  await booking.save();

  const deposit = await SelfDriveDeposit.findOne({ bookingId });
  if (deposit && deposit.status === DEPOSIT_STATUS.HELD) {
    const deduct = Math.min(deposit.amount, inspection.charges?.total || 0);
    deposit.deductedAmount = deduct;
    deposit.status =
      deduct <= 0
        ? DEPOSIT_STATUS.REFUNDED
        : deduct >= deposit.amount
          ? DEPOSIT_STATUS.FORFEITED
          : DEPOSIT_STATUS.PARTIALLY_DEDUCTED;
    deposit.note = "Tự động đối trừ sau trả xe";
    await deposit.save();
  }

  await notifyUsers({
    userIds: [booking.customerId, booking.ownerId],
    title: "Hoàn tất thuê xe",
    message: `Booking ${booking.bookingCode} COMPLETED`,
    meta: { bookingId },
  });
  return { booking, inspection, deposit };
};

export const getReturnService = async (bookingId) => SelfDriveReturn.findOne({ bookingId });
