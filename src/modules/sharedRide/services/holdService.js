import crypto from "crypto";
import SharedRideSeatHold from "../models/SharedRideSeatHold.js";
import SharedRideSeatOccupancy from "../models/SharedRideSeatOccupancy.js";
import { getHoldMinutes, OCCUPANCY_STATUS } from "../constants.js";
import { httpError } from "../httpError.js";
import { getTripOrThrow } from "./tripService.js";
import { matchPassengerToTrip } from "./geoService.js";
import { buildQuote } from "./pricingService.js";
import { claimSeatsForSegment, releaseOccupancies } from "./seatAvailabilityService.js";
import { emitSharedRideEvent, SHARED_RIDE_EVENTS } from "../events.js";

export const expireHolds = async (tripId) => {
  const now = new Date();
  const filter = { status: "ACTIVE", expiresAt: { $lte: now } };
  if (tripId) filter.tripId = tripId;
  const expired = await SharedRideSeatHold.find(filter);
  if (!expired.length) return 0;
  const ids = expired.map((h) => h._id);
  await SharedRideSeatHold.updateMany({ _id: { $in: ids } }, { $set: { status: "EXPIRED" } });
  await SharedRideSeatOccupancy.updateMany(
    { holdId: { $in: ids }, status: OCCUPANCY_STATUS.HELD },
    { $set: { status: OCCUPANCY_STATUS.RELEASED } }
  );
  for (const hold of expired) {
    emitSharedRideEvent(SHARED_RIDE_EVENTS.SEAT_RELEASED, {
      tripId: hold.tripId,
      holdId: hold._id,
      userId: hold.userId,
      reason: "expired",
    });
  }
  return expired.length;
};

const resolveSegment = (trip, pickup, dropoff) => {
  const matched = matchPassengerToTrip(trip, pickup, dropoff);
  if (!matched.ok) {
    throw httpError(
      matched.reason === "wrong_direction"
        ? "Điểm đón phải nằm trước điểm trả theo hướng chuyến"
        : "Điểm đón/trả quá xa lộ trình chuyến",
      400
    );
  }
  return {
    pickup: {
      address: pickup.address,
      latitude: Number(pickup.lat ?? pickup.latitude),
      longitude: Number(pickup.lng ?? pickup.longitude),
      distanceFromOrigin: matched.pickupMatch.distanceFromTripOrigin,
      estimatedAt: matched.pickupMatch.estimatedPickupTime,
      deviationMeters: matched.pickupMatch.deviationMeters,
    },
    dropoff: {
      address: dropoff.address,
      latitude: Number(dropoff.lat ?? dropoff.latitude),
      longitude: Number(dropoff.lng ?? dropoff.longitude),
      distanceFromOrigin: matched.dropoffMatch.distanceFromTripOrigin,
      estimatedAt: matched.dropoffMatch.estimatedPickupTime,
      deviationMeters: matched.dropoffMatch.deviationMeters,
    },
  };
};

export const quoteTripService = async (tripId, payload) => {
  const trip = await getTripOrThrow(tripId);
  const { pickup, dropoff } = resolveSegment(trip, payload.pickup, payload.dropoff);
  const seatIds = payload.seatIds || [];
  const seats = seatIds.length
    ? trip.seats.filter((s) => seatIds.some((id) => String(s._id) === String(id)))
    : trip.seats.filter((s) => s.isBookable && s.enabled).slice(0, payload.passengerCount || 1);
  if (seatIds.length && seats.length !== seatIds.length) {
    throw httpError("Ghế không thuộc chuyến này", 400);
  }
  return {
    tripId: trip._id,
    pickup,
    dropoff,
    ...buildQuote({ trip, seats, pickup, dropoff }),
  };
};

export const holdSeatsService = async (tripId, userId, payload) => {
  const trip = await getTripOrThrow(tripId);
  if (!trip.allowSeatBooking) throw httpError("Chuyến này không bán ghế lẻ", 400);
  if (!["PUBLISHED", "OPEN", "BOARDING"].includes(trip.status)) {
    throw httpError("Chuyến không còn nhận booking", 400);
  }
  if (trip.bookingCutoffAt && new Date(trip.bookingCutoffAt) <= new Date()) {
    throw httpError("Đã hết hạn đặt chỗ", 400);
  }
  await expireHolds(tripId);

  const { pickup, dropoff } = resolveSegment(trip, payload.pickup, payload.dropoff);
  const seatIds = payload.seatIds || [];
  if (!seatIds.length) throw httpError("Cần chọn ghế", 400);
  const seats = trip.seats.filter((s) => seatIds.some((id) => String(s._id) === String(id)));
  if (seats.length !== seatIds.length) throw httpError("Ghế không thuộc chuyến này", 400);
  if (seats.some((s) => s.isDriverSeat || !s.isBookable || s.enabled === false)) {
    throw httpError("Có ghế không thể đặt", 400);
  }
  if ((payload.passengerCount || seats.length) !== seats.length) {
    throw httpError("Số hành khách phải khớp số ghế", 400);
  }

  const pricing = buildQuote({ trip, seats, pickup, dropoff });
  const expiresAt = new Date(Date.now() + getHoldMinutes() * 60 * 1000);
  const hold = await SharedRideSeatHold.create({
    holdCode: `HLD${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    tripId,
    userId,
    seatIds: seats.map((s) => s._id),
    pickup,
    dropoff,
    passengerCount: seats.length,
    pricing,
    expiresAt,
    status: "ACTIVE",
  });

  try {
    await claimSeatsForSegment({
      tripId,
      seats,
      userId,
      start: pickup.distanceFromOrigin,
      end: dropoff.distanceFromOrigin,
      holdId: hold._id,
      status: "HELD",
      expiresAt,
    });
  } catch (error) {
    hold.status = "RELEASED";
    await hold.save();
    throw error;
  }

  console.log("[sharedRide] seat hold", hold.holdCode, { tripId, userId });
  emitSharedRideEvent(SHARED_RIDE_EVENTS.SEAT_HELD, {
    tripId,
    holdId: hold._id,
    userId,
    seatIds: hold.seatIds,
    expiresAt,
  });
  return hold;
};

export const releaseHoldService = async (holdId, userId) => {
  const hold = await SharedRideSeatHold.findById(holdId);
  if (!hold) throw httpError("Không tìm thấy hold", 404);
  if (userId && String(hold.userId) !== String(userId)) {
    throw httpError("Không thể hủy hold của người khác", 403);
  }
  if (hold.status !== "ACTIVE") return hold;
  hold.status = "RELEASED";
  await hold.save();
  await releaseOccupancies({ holdId: hold._id });
  emitSharedRideEvent(SHARED_RIDE_EVENTS.SEAT_RELEASED, {
    tripId: hold.tripId,
    holdId: hold._id,
    userId: hold.userId,
  });
  return hold;
};

export const getActiveHold = async (holdId, userId) => {
  await expireHolds();
  const hold = await SharedRideSeatHold.findById(holdId);
  if (!hold) throw httpError("Không tìm thấy hold", 404);
  if (String(hold.userId) !== String(userId)) throw httpError("Hold không thuộc về bạn", 403);
  if (hold.status !== "ACTIVE" || hold.expiresAt <= new Date()) {
    throw httpError("Hold đã hết hạn", 400);
  }
  return hold;
};
