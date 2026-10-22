import SharedRideBooking from "../models/SharedRideBooking.js";
import SharedRideTrip from "../models/SharedRideTrip.js";
import SharedRideSeatHold from "../models/SharedRideSeatHold.js";
import User from "../../../models/User.js";
import {
  BOOKING_STATUS,
  BOOKING_TYPE,
  CONFIRMED_BOOKING_STATUSES,
  PAYMENT_STATUS,
} from "../constants.js";
import { shouldApplyPayment } from "./paymentRules.js";
import { httpError, assertOwner } from "../httpError.js";
import { getActiveHold, expireHolds } from "./holdService.js";
import { confirmOccupancies, releaseOccupancies } from "./seatAvailabilityService.js";
import { refreshTripFullness } from "./tripService.js";
import { issueTicket, getTicketForUser } from "./ticketService.js";
import { emitSharedRideEvent, SHARED_RIDE_EVENTS } from "../events.js";
import { notifyUsers } from "./notify.js";

export const createBookingFromHoldService = async (userId, { holdId, notes, paymentMethod }) => {
  const hold = await getActiveHold(holdId, userId);
  const trip = await SharedRideTrip.findById(hold.tripId);
  if (!trip) throw httpError("Chuyến không còn tồn tại", 404);

  const existing = await SharedRideBooking.findOne({
    holdId: hold._id,
    status: { $nin: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.EXPIRED] },
  });
  if (existing) return existing;

  const seats = trip.seats
    .filter((s) => hold.seatIds.some((id) => String(id) === String(s._id)))
    .map((s) => {
      const priced = (hold.pricing?.seatPrices || []).find((p) => String(p.seatId) === String(s._id));
      return {
        seatId: s._id,
        code: s.code,
        row: s.row,
        column: s.column,
        seatType: s.seatType,
        price: priced?.price ?? 0,
      };
    });

  const booking = await SharedRideBooking.create({
    type: BOOKING_TYPE.SHARED_SEAT,
    tripId: trip._id,
    driverId: trip.driverId,
    passengerId: userId,
    holdId: hold._id,
    seats,
    pickup: hold.pickup,
    dropoff: hold.dropoff,
    passengerCount: hold.passengerCount,
    notes: notes || null,
    status: BOOKING_STATUS.AWAITING_PAYMENT,
    paymentStatus: PAYMENT_STATUS.PENDING,
    pricing: hold.pricing,
    totalAmount: hold.pricing?.total || 0,
    payment: { provider: paymentMethod || null },
  });

  hold.bookingId = booking._id;
  await hold.save();

  console.log("[sharedRide] booking created", booking.bookingCode);
  emitSharedRideEvent(SHARED_RIDE_EVENTS.BOOKING_CREATED, {
    tripId: trip._id,
    bookingId: booking._id,
    userId,
    driverId: trip.driverId,
  });
  return booking;
};

export { shouldApplyPayment };

export const confirmSharedRideBookingPayment = async (booking, { amount, isSuccess }) => {
  if (!shouldApplyPayment(booking)) {
    return { booking, duplicate: true };
  }

  if (!isSuccess) {
    booking.paymentStatus = PAYMENT_STATUS.FAILED;
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cancelledBy = "system";
    booking.cancelReason = "Thanh toán thất bại";
    await booking.save();
    await releaseOccupancies({ holdId: booking.holdId, bookingId: booking._id });
    await SharedRideSeatHold.updateMany({ _id: booking.holdId }, { $set: { status: "RELEASED" } });
    emitSharedRideEvent(SHARED_RIDE_EVENTS.BOOKING_CANCELLED, {
      tripId: booking.tripId,
      bookingId: booking._id,
      userId: booking.passengerId,
    });
    return { booking, duplicate: false };
  }

  try {
    await confirmOccupancies({ holdId: booking.holdId, bookingId: booking._id });
    booking.paymentStatus = PAYMENT_STATUS.PAID;
    booking.status = BOOKING_STATUS.CONFIRMED;
    booking.payment = {
      ...(booking.payment?.toObject?.() || booking.payment || {}),
      amount,
      paidAt: new Date(),
    };
    const ticket = await issueTicket({ type: "SHARED_SEAT", booking });
    booking.ticketId = ticket._id;
    await booking.save();
    await SharedRideSeatHold.updateMany({ _id: booking.holdId }, { $set: { status: "CONVERTED" } });
    await refreshTripFullness(booking.tripId);

    await notifyUsers({
      userIds: [booking.passengerId],
      title: "Đặt xe ghép thành công",
      message: `Booking ${booking.bookingCode} đã được thanh toán.`,
      type: "payment",
      meta: { bookingId: booking._id, bookingCode: booking.bookingCode },
    });
    await notifyUsers({
      userIds: [booking.driverId],
      title: "Có khách đặt xe ghép",
      message: `Khách vừa thanh toán booking ${booking.bookingCode}.`,
      type: "booking",
      meta: { bookingId: booking._id },
    });
    emitSharedRideEvent(SHARED_RIDE_EVENTS.BOOKING_CONFIRMED, {
      tripId: booking.tripId,
      bookingId: booking._id,
      userId: booking.passengerId,
      driverId: booking.driverId,
    });
    console.log("[sharedRide] payment confirmed", booking.bookingCode);
    return { booking, duplicate: false, ticket };
  } catch (error) {
    console.error("[sharedRide] payment success but confirm failed", error.message);
    booking.status = BOOKING_STATUS.REFUNDED;
    booking.paymentStatus = PAYMENT_STATUS.REFUNDED;
    booking.cancelReason = "Không giữ được ghế sau thanh toán, cần hoàn tiền";
    await booking.save();
    throw Object.assign(
      new Error("Thanh toán thành công nhưng không xác nhận được ghế. Hệ thống đã đánh dấu hoàn tiền."),
      { statusCode: 409, booking }
    );
  }
};

export const getBookingForUser = async (bookingId, user) => {
  const booking = await SharedRideBooking.findById(bookingId);
  if (!booking) throw httpError("Không tìm thấy booking", 404);
  const allowed =
    ["admin", "staff"].includes(user.role) ||
    String(booking.passengerId) === String(user._id) ||
    String(booking.driverId) === String(user._id);
  if (!allowed) throw httpError("Không được xem booking này", 403);
  return booking;
};

export const passengerHistoryService = async (userId, { page = 1, limit = 20 }) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    SharedRideBooking.find({ passengerId: userId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    SharedRideBooking.countDocuments({ passengerId: userId }),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
};

export const cancelPassengerBookingService = async (bookingId, user) => {
  const booking = await getBookingForUser(bookingId, user);
  if (String(booking.passengerId) !== String(user._id) && user.role !== "admin") {
    throw httpError("Chỉ hành khách hoặc admin được hủy booking này", 403);
  }
  if (CONFIRMED_BOOKING_STATUSES.includes(booking.status) && booking.status !== BOOKING_STATUS.PAID) {
    const trip = await SharedRideTrip.findById(booking.tripId);
    if (trip && new Date(trip.departureAt) - Date.now() < 60 * 60 * 1000) {
      throw httpError("Không thể hủy trong vòng 1 giờ trước giờ xuất phát", 400);
    }
  }
  const wasPaid = booking.paymentStatus === PAYMENT_STATUS.PAID;
  booking.status = wasPaid ? BOOKING_STATUS.REFUNDED : BOOKING_STATUS.CANCELLED;
  booking.paymentStatus = wasPaid ? PAYMENT_STATUS.REFUNDED : booking.paymentStatus;
  booking.cancelledAt = new Date();
  booking.cancelledBy = String(booking.passengerId) === String(user._id) ? "passenger" : "admin";
  await booking.save();
  await releaseOccupancies({ bookingId: booking._id, holdId: booking.holdId });
  await notifyUsers({
    userIds: [booking.driverId],
    title: "Khách hủy booking xe ghép",
    message: `Booking ${booking.bookingCode} đã bị hủy.`,
    type: "warning",
    meta: { bookingId: booking._id },
  });
  emitSharedRideEvent(SHARED_RIDE_EVENTS.BOOKING_CANCELLED, {
    tripId: booking.tripId,
    bookingId: booking._id,
    userId: booking.passengerId,
    driverId: booking.driverId,
  });
  return booking;
};

export const driverCancelPassengerBookingService = async (bookingId, driverId, reason) => {
  const booking = await SharedRideBooking.findById(bookingId);
  if (!booking) throw httpError("Không tìm thấy booking", 404);
  assertOwner(booking.driverId, driverId);
  const wasPaid = booking.paymentStatus === PAYMENT_STATUS.PAID;
  booking.status = wasPaid ? BOOKING_STATUS.REFUNDED : BOOKING_STATUS.CANCELLED;
  booking.paymentStatus = wasPaid ? PAYMENT_STATUS.REFUNDED : booking.paymentStatus;
  booking.cancelledAt = new Date();
  booking.cancelledBy = "driver";
  booking.cancelReason = reason || "Tài xế hủy booking";
  await booking.save();
  await releaseOccupancies({ bookingId: booking._id, holdId: booking.holdId });
  await notifyUsers({
    userIds: [booking.passengerId],
    title: "Tài xế đã hủy booking",
    message: booking.cancelReason,
    type: "warning",
    meta: { bookingId: booking._id },
  });
  return booking;
};

export const listTripPassengersService = async (tripId, driverId) => {
  const trip = await SharedRideTrip.findById(tripId);
  if (!trip) throw httpError("Không tìm thấy chuyến", 404);
  assertOwner(trip.driverId, driverId);
  return SharedRideBooking.find({ tripId }).sort({ "pickup.distanceFromOrigin": 1 });
};

export const tripManifestService = async (tripId, driverId) => {
  const trip = await SharedRideTrip.findById(tripId);
  if (!trip) throw httpError("Không tìm thấy chuyến", 404);
  assertOwner(trip.driverId, driverId);
  const bookings = await SharedRideBooking.find({
    tripId,
    status: { $in: [...CONFIRMED_BOOKING_STATUSES, BOOKING_STATUS.IN_PROGRESS] },
  }).populate("passengerId", "fullName phone avatar");

  const stops = [
    {
      at: trip.departureAt,
      type: "origin",
      address: trip.origin.address,
      passengers: [],
    },
    ...bookings
      .map((b) => ({
        at: b.pickup.estimatedAt || trip.departureAt,
        type: "pickup",
        address: b.pickup.address,
        distanceFromOrigin: b.pickup.distanceFromOrigin,
        passenger: b.passengerId,
        seats: b.seats.map((s) => s.code),
        pickup: b.pickup.address,
        dropoff: b.dropoff.address,
        status: b.status,
        paymentStatus: b.paymentStatus,
        bookingCode: b.bookingCode,
      }))
      .sort((a, b) => (a.distanceFromOrigin || 0) - (b.distanceFromOrigin || 0)),
  ];
  return { tripId: trip._id, tripCode: trip.tripCode, departureAt: trip.departureAt, itinerary: stops };
};

export const getPublicSeatMapService = async (tripId, query) => {
  await expireHolds(tripId);
  const trip = await SharedRideTrip.findById(tripId);
  if (!trip) throw httpError("Không tìm thấy chuyến", 404);
  const { matchPassengerToTrip } = await import("./geoService.js");
  const matched = matchPassengerToTrip(trip, {
    lat: query.pickupLat,
    lng: query.pickupLng,
    address: query.pickupAddress,
  }, {
    lat: query.dropoffLat,
    lng: query.dropoffLng,
    address: query.dropoffAddress,
  });
  if (!matched.ok) {
    throw httpError(
      matched.reason === "wrong_direction"
        ? "Điểm đón phải trước điểm trả"
        : "Điểm đón/trả không khớp lộ trình",
      400
    );
  }
  const SharedRideSeatOccupancy = (await import("../models/SharedRideSeatOccupancy.js")).default;
  const { buildSeatMap } = await import("./seatAvailabilityService.js");
  const { buildQuote } = await import("./pricingService.js");
  const occupancies = await SharedRideSeatOccupancy.find({
    tripId,
    status: { $in: ["HELD", "CONFIRMED"] },
  });
  const pickup = { distanceFromOrigin: matched.pickupMatch.distanceFromTripOrigin };
  const dropoff = { distanceFromOrigin: matched.dropoffMatch.distanceFromTripOrigin };
  return {
    tripId: trip._id,
    pickup: {
      distanceFromOrigin: pickup.distanceFromOrigin,
      estimatedAt: matched.pickupMatch.estimatedPickupTime,
      deviationMeters: matched.pickupMatch.deviationMeters,
    },
    dropoff: {
      distanceFromOrigin: dropoff.distanceFromOrigin,
      estimatedAt: matched.dropoffMatch.estimatedPickupTime,
      deviationMeters: matched.dropoffMatch.deviationMeters,
    },
    seats: buildSeatMap({
      trip,
      occupancies,
      start: pickup.distanceFromOrigin,
      end: dropoff.distanceFromOrigin,
      quoteSeat: (seat) => buildQuote({ trip, seats: [seat], pickup, dropoff }).seatPrices[0].price,
    }),
  };
};

export const serializeBooking = async (booking) => {
  const trip = await SharedRideTrip.findById(booking.tripId);
  const passenger = await User.findById(booking.passengerId).select("fullName phone avatar");
  return {
    id: booking._id,
    code: booking.bookingCode,
    type: booking.type,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    trip: trip
      ? {
          id: trip._id,
          tripCode: trip.tripCode,
          origin: trip.origin,
          destination: trip.destination,
          departureAt: trip.departureAt,
          vehicle: trip.vehicleSnapshot,
        }
      : null,
    seats: booking.seats,
    pickup: booking.pickup,
    dropoff: booking.dropoff,
    departureAt: trip?.departureAt,
    estimatedPickupAt: booking.pickup?.estimatedAt,
    pricing: booking.pricing,
    totalAmount: booking.totalAmount,
    payment: booking.payment,
    ticketId: booking.ticketId,
    passenger,
  };
};

export { getTicketForUser };
