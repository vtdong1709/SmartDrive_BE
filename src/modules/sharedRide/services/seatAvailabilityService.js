import SharedRideSeatOccupancy from "../models/SharedRideSeatOccupancy.js";
import { OCCUPANCY_STATUS, SEAT_AVAILABILITY } from "../constants.js";
import { httpError } from "../httpError.js";
import redis from "../../../redis.js";
import { findOverlapping, segmentsOverlap } from "./occupancyMath.js";

export { findOverlapping, segmentsOverlap };

export const expireStaleOccupancies = async (tripId) => {
  const now = new Date();
  await SharedRideSeatOccupancy.updateMany(
    {
      tripId,
      status: OCCUPANCY_STATUS.HELD,
      expiresAt: { $lte: now },
    },
    { $set: { status: OCCUPANCY_STATUS.RELEASED } }
  );
};

const lockKey = (tripId, seatId) => `shared-ride:seat:${tripId}:${seatId}`;

const acquireLocks = async (tripId, seatIds) => {
  const keys = seatIds.map((id) => lockKey(tripId, id)).sort();
  const locked = [];
  try {
    for (const key of keys) {
      const ok = await redis.set(key, "1", "PX", 8000, "NX");
      if (!ok) {
        throw httpError("Ghế đang được người khác giữ, vui lòng thử lại", 409);
      }
      locked.push(key);
    }
    return locked;
  } catch (error) {
    await Promise.all(locked.map((key) => redis.del(key).catch(() => null)));
    throw error;
  }
};

const releaseLocks = async (keys) => {
  await Promise.all((keys || []).map((key) => redis.del(key).catch(() => null)));
};

export const claimSeatsForSegment = async ({
  tripId,
  seats,
  userId,
  start,
  end,
  holdId = null,
  bookingId = null,
  status = OCCUPANCY_STATUS.HELD,
  expiresAt = null,
}) => {
  if (!seats?.length) throw httpError("Cần chọn ít nhất một ghế", 400);
  if (!(start < end)) throw httpError("Điểm đón phải nằm trước điểm trả trên lộ trình", 400);

  await expireStaleOccupancies(tripId);
  const seatIds = seats.map((s) => s._id || s.seatId);
  let locks = [];
  try {
    locks = await acquireLocks(tripId, seatIds);
  } catch (error) {
    if (error.statusCode === 409) throw error;
    console.warn("[sharedRide] Redis lock skipped:", error.message);
  }

  try {
    const existing = await SharedRideSeatOccupancy.find({
      tripId,
      seatId: { $in: seatIds },
      status: { $in: [OCCUPANCY_STATUS.HELD, OCCUPANCY_STATUS.CONFIRMED] },
    });

    const conflicts = findOverlapping(existing, seatIds[0], start, end);
    const anyConflict = seatIds.some((seatId) => findOverlapping(existing, seatId, start, end).length > 0);
    if (anyConflict || conflicts.length > 0) {
      const conflicted = seatIds.filter((seatId) => findOverlapping(existing, seatId, start, end).length);
      throw httpError(`Ghế đã được đặt trên đoạn này: ${conflicted.join(", ")}`, 409);
    }

    const docs = await SharedRideSeatOccupancy.insertMany(
      seats.map((seat) => ({
        tripId,
        seatId: seat._id || seat.seatId,
        seatCode: seat.code,
        userId,
        pickupDistance: start,
        dropoffDistance: end,
        status,
        holdId,
        bookingId,
        expiresAt,
      }))
    );

    const after = await SharedRideSeatOccupancy.find({
      tripId,
      seatId: { $in: seatIds },
      status: { $in: [OCCUPANCY_STATUS.HELD, OCCUPANCY_STATUS.CONFIRMED] },
    });
    const raced = seatIds.some(
      (seatId) => findOverlapping(after, seatId, start, end).length > 1
    );
    if (raced) {
      await SharedRideSeatOccupancy.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
      console.warn("[sharedRide] seat conflict race", { tripId, seatIds });
      throw httpError("Ghế vừa được người khác giữ, vui lòng chọn ghế khác", 409);
    }

    return docs;
  } finally {
    await releaseLocks(locks);
  }
};

export const releaseOccupancies = async ({ holdId, bookingId, tripId, seatIds }) => {
  const filter = { status: { $in: [OCCUPANCY_STATUS.HELD, OCCUPANCY_STATUS.CONFIRMED] } };
  if (holdId) filter.holdId = holdId;
  if (bookingId) filter.bookingId = bookingId;
  if (tripId) filter.tripId = tripId;
  if (seatIds) filter.seatId = { $in: seatIds };
  await SharedRideSeatOccupancy.updateMany(filter, { $set: { status: OCCUPANCY_STATUS.RELEASED } });
};

export const confirmOccupancies = async ({ holdId, bookingId }) => {
  await SharedRideSeatOccupancy.updateMany(
    { holdId, status: OCCUPANCY_STATUS.HELD },
    { $set: { status: OCCUPANCY_STATUS.CONFIRMED, bookingId, expiresAt: null } }
  );
};

export const countConfirmedOnTrip = async (tripId) => {
  return SharedRideSeatOccupancy.countDocuments({
    tripId,
    status: OCCUPANCY_STATUS.CONFIRMED,
  });
};

export const buildSeatMap = ({ trip, occupancies, start, end, quoteSeat }) => {
  return (trip.seats || [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((seat) => {
      if (seat.isDriverSeat || !seat.isBookable || seat.enabled === false) {
        return {
          id: seat._id,
          code: seat.code,
          row: seat.row,
          column: seat.column,
          type: seat.seatType,
          isBookable: false,
          availability: SEAT_AVAILABILITY.BLOCKED,
          priceForSelectedSegment: null,
        };
      }

      const overlaps = findOverlapping(occupancies, seat._id, start, end);
      let availability = SEAT_AVAILABILITY.AVAILABLE;
      if (overlaps.some((o) => o.status === OCCUPANCY_STATUS.CONFIRMED)) {
        availability = SEAT_AVAILABILITY.BOOKED;
      } else if (overlaps.some((o) => o.status === OCCUPANCY_STATUS.HELD)) {
        availability = SEAT_AVAILABILITY.HELD;
      }

      return {
        id: seat._id,
        code: seat.code,
        row: seat.row,
        column: seat.column,
        type: seat.seatType,
        isBookable: availability === SEAT_AVAILABILITY.AVAILABLE,
        availability,
        priceForSelectedSegment:
          availability === SEAT_AVAILABILITY.AVAILABLE && quoteSeat
            ? quoteSeat(seat)
            : null,
      };
    });
};

export const countAvailableSeats = ({ trip, occupancies, start, end }) => {
  return buildSeatMap({ trip, occupancies, start, end }).filter(
    (s) => s.availability === SEAT_AVAILABILITY.AVAILABLE
  ).length;
};
