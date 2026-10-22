import SharedRideCharter from "../models/SharedRideCharter.js";
import SharedRideVehicle from "../models/SharedRideVehicle.js";
import SharedRideTrip from "../models/SharedRideTrip.js";
import SharedRideBooking from "../models/SharedRideBooking.js";
import {
  CHARTER_STATUS,
  CONFIRMED_BOOKING_STATUSES,
  PAYMENT_STATUS,
  TRIP_STATUS,
} from "../constants.js";
import { httpError, assertOwner } from "../httpError.js";
import { quoteCharterPrice } from "./pricingService.js";
import { canCharterExistingTrip, isTimeInWindows, rangesOverlap } from "./charterRules.js";
import { countConfirmedOnTrip } from "./seatAvailabilityService.js";
import { haversineMeters } from "./geoService.js";
import { issueTicket } from "./ticketService.js";
import { emitSharedRideEvent, SHARED_RIDE_EVENTS } from "../events.js";
import { notifyUsers } from "./notify.js";

const toPlace = (p) => ({
  address: p.address,
  latitude: Number(p.lat ?? p.latitude),
  longitude: Number(p.lng ?? p.longitude),
});

export const findDriverTimeConflict = async (driverId, requestedAt, durationMs = 2 * 60 * 60 * 1000) => {
  const start = new Date(requestedAt);
  const end = new Date(start.getTime() + durationMs);
  const trips = await SharedRideTrip.find({
    driverId,
    status: { $nin: [TRIP_STATUS.CANCELLED, TRIP_STATUS.COMPLETED, TRIP_STATUS.DRAFT] },
  });
  const tripConflict = trips.find((trip) => {
    const tripStart = new Date(trip.departureAt);
    const tripEnd = new Date(tripStart.getTime() + (trip.routeDuration || 2 * 3600) * 1000);
    return rangesOverlap(start, end, tripStart, tripEnd);
  });
  const charters = await SharedRideCharter.find({
    driverId,
    status: { $in: [CHARTER_STATUS.ACCEPTED, CHARTER_STATUS.AWAITING_PAYMENT, CHARTER_STATUS.PAID, CHARTER_STATUS.CONFIRMED] },
  });
  const charterConflict = charters.find((c) => {
    const cStart = new Date(c.requestedDepartureAt);
    const cEnd = new Date(cStart.getTime() + durationMs);
    return rangesOverlap(start, end, cStart, cEnd);
  });
  return tripConflict || charterConflict || null;
};

export const charterQuoteService = async (payload) => {
  const { driverId, vehicleId, tripId, pickup, destination, requestedDepartureAt, passengerCount } = payload;
  if (!pickup || !destination || !requestedDepartureAt || !passengerCount) {
    throw httpError("Thiếu pickup, destination, requestedDepartureAt hoặc passengerCount", 400);
  }

  if (tripId) {
    const trip = await SharedRideTrip.findById(tripId);
    if (!trip) throw httpError("Không tìm thấy chuyến", 404);
    const confirmed = await countConfirmedOnTrip(tripId);
    const gate = canCharterExistingTrip({ trip, confirmedSeatCount: confirmed });
    if (!gate.ok) {
      throw httpError(
        gate.reason === "trip_has_confirmed_passengers"
          ? "Chuyến đã có khách ghế, không thể bao toàn bộ chuyến này. Hãy tạo yêu cầu bao xe giờ khác."
          : "Chuyến này không nhận bao xe",
        400
      );
    }
    if (trip.charterWindowStart && trip.charterWindowEnd) {
      if (!isTimeInWindows(requestedDepartureAt, [{ start: trip.charterWindowStart, end: trip.charterWindowEnd }])) {
        throw httpError("Giờ bao xe nằm ngoài khung nhận của tài xế", 400);
      }
    }
    const vehicle = await SharedRideVehicle.findById(trip.vehicleId);
    return {
      tripId: trip._id,
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      quotedPrice: trip.charterPrice || quoteCharterPrice({ vehicle, trip, passengerCount }).total,
      source: trip.charterPrice ? "trip.charterPrice" : "estimated",
    };
  }

  const vehicle = await SharedRideVehicle.findById(vehicleId);
  if (!vehicle || (driverId && String(vehicle.driverId) !== String(driverId))) {
    throw httpError("Không tìm thấy xe", 404);
  }
  if (!vehicle.charterEnabled) throw httpError("Tài xế/xe này chưa nhận bao xe", 400);
  if (!isTimeInWindows(requestedDepartureAt, vehicle.charterWindows)) {
    throw httpError("Giờ bao xe nằm ngoài khung nhận của tài xế", 400);
  }
  const distance = haversineMeters(
    Number(pickup.lat ?? pickup.latitude),
    Number(pickup.lng ?? pickup.longitude),
    Number(destination.lat ?? destination.latitude),
    Number(destination.lng ?? destination.longitude)
  );
  const quote = quoteCharterPrice({
    vehicle,
    trip: { baseSeatPrice: 150000, pricePerKm: 12000, pricingMode: "DISTANCE_BASED" },
    passengerCount,
    distanceMeters: distance,
  });
  return {
    driverId: vehicle.driverId,
    vehicleId: vehicle._id,
    quotedPrice: quote.total,
    source: quote.source,
    estimatedDistanceKm: Number((distance / 1000).toFixed(2)),
  };
};

export const createCharterService = async (passengerId, payload) => {
  const quote = await charterQuoteService(payload);
  const conflict = await findDriverTimeConflict(quote.driverId, payload.requestedDepartureAt);
  if (conflict) {
    throw httpError("Tài xế đã có lịch trùng giờ này", 409);
  }
  const charter = await SharedRideCharter.create({
    driverId: quote.driverId,
    vehicleId: quote.vehicleId,
    tripId: payload.tripId || null,
    passengerId,
    pickup: toPlace(payload.pickup),
    destination: toPlace(payload.destination),
    requestedDepartureAt: payload.requestedDepartureAt,
    passengerCount: payload.passengerCount,
    notes: payload.notes || null,
    quotedPrice: quote.quotedPrice,
    pricing: quote,
    status: CHARTER_STATUS.PENDING_DRIVER_ACCEPTANCE,
    paymentStatus: PAYMENT_STATUS.PENDING,
  });
  await notifyUsers({
    userIds: [quote.driverId],
    title: "Yêu cầu bao xe mới",
    message: `Khách muốn bao xe lúc ${new Date(payload.requestedDepartureAt).toISOString()}`,
    type: "request",
    meta: { charterId: charter._id, charterCode: charter.charterCode },
  });
  emitSharedRideEvent(SHARED_RIDE_EVENTS.CHARTER_CREATED, {
    driverId: quote.driverId,
    userId: passengerId,
    charterId: charter._id,
  });
  return charter;
};

export const getCharterForUser = async (charterId, user) => {
  const charter = await SharedRideCharter.findById(charterId);
  if (!charter) throw httpError("Không tìm thấy yêu cầu bao xe", 404);
  const allowed =
    ["admin", "staff"].includes(user.role) ||
    String(charter.passengerId) === String(user._id) ||
    String(charter.driverId) === String(user._id);
  if (!allowed) throw httpError("Không được xem yêu cầu này", 403);
  return charter;
};

export const respondCharterService = async (charterId, driverId, { accept, reason }) => {
  const charter = await SharedRideCharter.findById(charterId);
  if (!charter) throw httpError("Không tìm thấy yêu cầu bao xe", 404);
  assertOwner(charter.driverId, driverId);
  if (charter.status !== CHARTER_STATUS.PENDING_DRIVER_ACCEPTANCE) {
    throw httpError("Yêu cầu không còn chờ xác nhận", 400);
  }
  if (!accept) {
    charter.status = CHARTER_STATUS.REJECTED;
    charter.rejectReason = reason || "Tài xế từ chối";
    await charter.save();
    await notifyUsers({
      userIds: [charter.passengerId],
      title: "Yêu cầu bao xe bị từ chối",
      message: charter.rejectReason,
      type: "warning",
      meta: { charterId: charter._id },
    });
    return charter;
  }
  const conflict = await findDriverTimeConflict(driverId, charter.requestedDepartureAt);
  if (conflict && String(conflict._id) !== String(charter._id)) {
    throw httpError("Tài xế đã có lịch trùng giờ này", 409);
  }
  if (charter.tripId) {
    const confirmed = await countConfirmedOnTrip(charter.tripId);
    const trip = await SharedRideTrip.findById(charter.tripId);
    const gate = canCharterExistingTrip({ trip, confirmedSeatCount: confirmed });
    if (!gate.ok) {
      throw httpError("Không thể bao chuyến vì đã có khách ghế", 400);
    }
  }
  charter.status = CHARTER_STATUS.AWAITING_PAYMENT;
  await charter.save();
  await notifyUsers({
    userIds: [charter.passengerId],
    title: "Tài xế đã nhận bao xe",
    message: `Vui lòng thanh toán yêu cầu ${charter.charterCode}`,
    type: "booking",
    meta: { charterId: charter._id },
  });
  emitSharedRideEvent(SHARED_RIDE_EVENTS.CHARTER_UPDATED, {
    charterId: charter._id,
    driverId,
    userId: charter.passengerId,
    status: charter.status,
  });
  return charter;
};

export const confirmCharterPayment = async (charter, { amount, isSuccess }) => {
  if (charter.paymentStatus === PAYMENT_STATUS.PAID) {
    return { charter, duplicate: true };
  }
  if (!isSuccess) {
    charter.paymentStatus = PAYMENT_STATUS.FAILED;
    charter.status = CHARTER_STATUS.CANCELLED;
    await charter.save();
    return { charter, duplicate: false };
  }
  charter.paymentStatus = PAYMENT_STATUS.PAID;
  charter.status = CHARTER_STATUS.CONFIRMED;
  charter.payment = {
    ...(charter.payment?.toObject?.() || charter.payment || {}),
    amount,
    paidAt: new Date(),
  };
  const ticket = await issueTicket({ type: "CHARTER", charter });
  charter.ticketId = ticket._id;
  await charter.save();
  if (charter.tripId) {
    await SharedRideTrip.updateOne(
      { _id: charter.tripId },
      { $set: { allowSeatBooking: false, status: TRIP_STATUS.FULL } }
    );
  }
  await notifyUsers({
    userIds: [charter.passengerId, charter.driverId],
    title: "Bao xe đã thanh toán",
    message: `Yêu cầu ${charter.charterCode} đã được xác nhận.`,
    type: "payment",
    meta: { charterId: charter._id },
  });
  return { charter, duplicate: false, ticket };
};

export const listDriverChartersService = async (driverId) => {
  return SharedRideCharter.find({ driverId }).sort({ createdAt: -1 });
};

export const listPassengerChartersService = async (passengerId) => {
  return SharedRideCharter.find({ passengerId }).sort({ createdAt: -1 });
};

export const listCharterCapableDriversService = async () => {
  return SharedRideVehicle.find({ isActive: true, charterEnabled: true }).select(
    "driverId name plate vehicleType charterWindows"
  );
};
