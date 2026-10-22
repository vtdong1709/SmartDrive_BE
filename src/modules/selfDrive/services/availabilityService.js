import SelfDriveAvailability from "../models/SelfDriveAvailability.js";
import SelfDriveBooking from "../models/SelfDriveBooking.js";
import {
  AVAILABILITY_TYPE,
  BLOCKING_BOOKING_STATUSES,
  getTurnaroundMinutes,
} from "../constants.js";
import { httpError } from "../httpError.js";
import {
  expandRecurringWindows,
  isVehicleFreeForInterval,
} from "./availabilityMath.js";

export const listAvailabilityService = async (vehicleId) => {
  return SelfDriveAvailability.find({ vehicleId }).sort({ startAt: 1 });
};

export const upsertAvailabilityService = async (vehicleId, ownerId, payload) => {
  if (!payload.type) throw httpError("Thiếu type AVAILABLE|BLOCKED", 400);
  if (!payload.recurring?.enabled && (!payload.startAt || !payload.endAt)) {
    throw httpError("Cần startAt/endAt hoặc recurring", 400);
  }
  if (payload.startAt && payload.endAt && !(new Date(payload.startAt) < new Date(payload.endAt))) {
    throw httpError("startAt phải nhỏ hơn endAt", 400);
  }
  return SelfDriveAvailability.create({
    vehicleId,
    type: payload.type,
    startAt: payload.startAt || null,
    endAt: payload.endAt || null,
    recurring: payload.recurring || { enabled: false },
    note: payload.note || "",
    createdBy: ownerId,
  });
};

export const deleteAvailabilityService = async (availabilityId, vehicleId) => {
  const row = await SelfDriveAvailability.findOneAndDelete({ _id: availabilityId, vehicleId });
  if (!row) throw httpError("Không tìm thấy khoảng availability", 404);
  return row;
};

export const loadCalendarContext = async (vehicle, startAt, endAt) => {
  const rows = await SelfDriveAvailability.find({ vehicleId: vehicle._id });
  const windows = [];
  const blocks = [];
  for (const row of rows) {
    if (row.recurring?.enabled) {
      const expanded = expandRecurringWindows([row], startAt, endAt);
      for (const item of expanded) {
        (item.type === AVAILABILITY_TYPE.AVAILABLE ? windows : blocks).push(item);
      }
    } else if (row.startAt && row.endAt) {
      (row.type === AVAILABILITY_TYPE.AVAILABLE ? windows : blocks).push(row);
    }
  }
  const bookings = await SelfDriveBooking.find({
    vehicleId: vehicle._id,
    status: { $in: BLOCKING_BOOKING_STATUSES },
    startAt: { $lt: new Date(endAt) },
    endAt: { $gt: new Date(startAt) },
  }).select("startAt endAt status bookingCode");

  return { windows, blocks, bookings };
};

export const assertVehicleAvailable = async (vehicle, startAt, endAt, { ignoreBookingId } = {}) => {
  const ctx = await loadCalendarContext(vehicle, startAt, endAt);
  const bookings = ignoreBookingId
    ? ctx.bookings.filter((b) => String(b._id) !== String(ignoreBookingId))
    : ctx.bookings;
  const free = isVehicleFreeForInterval({
    requestedStart: startAt,
    requestedEnd: endAt,
    bookings,
    blocks: ctx.blocks,
    windows: ctx.windows,
    turnaroundMinutes: getTurnaroundMinutes(vehicle),
  });
  if (!free) throw httpError("Xe không còn trống trong khoảng thời gian này", 409);
  return ctx;
};
