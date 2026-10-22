import SharedRideTrip from "../models/SharedRideTrip.js";
import SharedRideBooking from "../models/SharedRideBooking.js";
import SharedRideVehicle from "../models/SharedRideVehicle.js";
import DriverProfile from "../../../models/DriverProfile.js";
import User from "../../../models/User.js";
import {
  BOOKABLE_TRIP_STATUSES,
  CONFIRMED_BOOKING_STATUSES,
  TRIP_STATUS,
} from "../constants.js";
import { httpError, assertOwner } from "../httpError.js";
import {
  buildRouteMetrics,
  fetchGoogleRoute,
  placeLatLng,
  toPlace,
} from "./geoService.js";
import { countConfirmedOnTrip, expireStaleOccupancies } from "./seatAvailabilityService.js";
import { emitSharedRideEvent, SHARED_RIDE_EVENTS } from "../events.js";
import { notifyUsers } from "./notify.js";

const snapshotSeats = (vehicle) =>
  vehicle.seats.map((seat) => ({
    vehicleSeatId: seat._id,
    code: seat.code,
    row: seat.row,
    column: seat.column,
    seatType: seat.seatType,
    isDriverSeat: seat.isDriverSeat,
    isBookable: seat.isBookable,
    enabled: seat.enabled !== false,
    priceModifier: seat.defaultPriceModifier || 0,
    sortOrder: seat.sortOrder,
  }));

const applyRouteToTrip = (trip, { origin, destination, waypoints, route }) => {
  const official = [
    { ...origin, type: "origin", isOfficialStop: true },
    ...(waypoints || []).map((w) => ({ ...w, type: "stop", isOfficialStop: true })),
    { ...destination, type: "destination", isOfficialStop: true },
  ];

  if (route?.points?.length) {
    const metrics = buildRouteMetrics(route.points);
    trip.routePoints = metrics;
    official.forEach((stop) => {
      let nearest = metrics[0];
      let best = Infinity;
      for (const p of metrics) {
        const d = (p.latitude - stop.lat) ** 2 + (p.longitude - stop.lng) ** 2;
        if (d < best) {
          best = d;
          nearest = p;
        }
      }
      nearest.address = stop.address || nearest.address;
      nearest.isOfficialStop = true;
      nearest.type = stop.type;
    });
    trip.routePolyline = route.polyline || "";
    trip.routeDistance = route.distance || metrics.at(-1)?.distanceFromOrigin || 0;
    trip.routeDuration = route.duration || 0;
  } else {
    trip.routePoints = buildRouteMetrics(
      official.map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
        address: p.address,
        type: p.type,
        isOfficialStop: true,
      }))
    );
    trip.routeDistance = trip.routePoints.at(-1)?.distanceFromOrigin || 0;
    trip.routeDuration = 0;
  }

  if (trip.departureAt && trip.routeDuration) {
    trip.estimatedArrivalAt = new Date(
      new Date(trip.departureAt).getTime() + trip.routeDuration * 1000
    );
    const total = Math.max(trip.routeDistance, 1);
    trip.routePoints = trip.routePoints.map((p) => ({
      ...(typeof p.toObject === "function" ? p.toObject() : p),
      estimatedArrivalAt: new Date(
        new Date(trip.departureAt).getTime() +
          (p.distanceFromOrigin / total) * trip.routeDuration * 1000
      ),
    }));
  }
};

export const getTripOrThrow = async (tripId) => {
  const trip = await SharedRideTrip.findById(tripId);
  if (!trip) throw httpError("Không tìm thấy chuyến", 404);
  return trip;
};

export const assertTripDriver = async (tripId, driverId) => {
  const trip = await getTripOrThrow(tripId);
  assertOwner(trip.driverId, driverId, "Bạn không được chỉnh chuyến của tài xế khác");
  return trip;
};

export const createDraftTripService = async (driverId, payload) => {
  if (!payload.origin || !payload.destination || !payload.departureAt || !payload.vehicleId) {
    throw httpError("Thiếu origin, destination, departureAt hoặc vehicleId", 400);
  }
  const vehicle = await SharedRideVehicle.findOne({ _id: payload.vehicleId, driverId, isActive: true });
  if (!vehicle) throw httpError("Xe không tồn tại hoặc không thuộc tài xế", 404);

  const origin = toPlace(payload.origin);
  const destination = toPlace(payload.destination);
  const waypoints = (payload.waypoints || []).map((w) => ({
    lat: Number(w.lat ?? w.latitude),
    lng: Number(w.lng ?? w.longitude),
    address: w.address,
  }));

  const trip = new SharedRideTrip({
    driverId,
    vehicleId: vehicle._id,
    vehicleSnapshot: {
      name: vehicle.name,
      plate: vehicle.plate,
      color: vehicle.color,
      vehicleType: vehicle.vehicleType,
      brand: vehicle.brand,
      model: vehicle.model,
    },
    origin,
    destination,
    departureAt: payload.departureAt,
    boardingStartAt: payload.boardingStartAt || null,
    bookingCutoffAt: payload.bookingCutoffAt || null,
    allowSeatBooking: payload.allowSeatBooking !== false,
    allowCharter: Boolean(payload.allowCharter),
    charterWindowStart: payload.charterWindowStart || null,
    charterWindowEnd: payload.charterWindowEnd || null,
    maxPickupDeviationKm: payload.maxPickupDeviationKm ?? 2,
    maxDropoffDeviationKm: payload.maxDropoffDeviationKm ?? 2,
    pricingMode: payload.pricingMode || "FIXED_TRIP",
    baseSeatPrice: payload.baseSeatPrice || 0,
    pricePerKm: payload.pricePerKm || 0,
    charterPrice: payload.charterPrice || 0,
    platformFee: payload.platformFee || 0,
    segmentPrices: payload.segmentPrices || [],
    seats: snapshotSeats(vehicle),
    status: TRIP_STATUS.DRAFT,
  });

  const googleRoute = await fetchGoogleRoute({
    origin: { lat: payload.origin.lat ?? payload.origin.latitude, lng: payload.origin.lng ?? payload.origin.longitude },
    destination: { lat: payload.destination.lat ?? payload.destination.latitude, lng: payload.destination.lng ?? payload.destination.longitude },
    waypoints,
  });

  applyRouteToTrip(trip, {
    origin: { ...placeLatLng(origin), lat: origin.location.coordinates[1], lng: origin.location.coordinates[0] },
    destination: {
      ...placeLatLng(destination),
      lat: destination.location.coordinates[1],
      lng: destination.location.coordinates[0],
    },
    waypoints,
    route: googleRoute,
  });

  await trip.save();
  console.log("[sharedRide] trip draft created", trip.tripCode);
  return trip;
};

export const updateTripService = async (tripId, driverId, payload) => {
  const trip = await assertTripDriver(tripId, driverId);
  if ([TRIP_STATUS.COMPLETED, TRIP_STATUS.CANCELLED, TRIP_STATUS.IN_PROGRESS].includes(trip.status)) {
    throw httpError("Không thể sửa chuyến ở trạng thái hiện tại", 400);
  }

  const scalar = [
    "departureAt",
    "boardingStartAt",
    "bookingCutoffAt",
    "allowSeatBooking",
    "allowCharter",
    "charterWindowStart",
    "charterWindowEnd",
    "maxPickupDeviationKm",
    "maxDropoffDeviationKm",
    "pricingMode",
    "baseSeatPrice",
    "pricePerKm",
    "charterPrice",
    "platformFee",
  ];
  for (const key of scalar) {
    if (payload[key] !== undefined) trip[key] = payload[key];
  }
  if (payload.segmentPrices) trip.segmentPrices = payload.segmentPrices;

  if (payload.origin) trip.origin = toPlace(payload.origin);
  if (payload.destination) trip.destination = toPlace(payload.destination);

  if (payload.origin || payload.destination || payload.waypoints) {
    const origin = placeLatLng(trip.origin);
    const destination = placeLatLng(trip.destination);
    const waypoints = (payload.waypoints || []).map((w) => ({
      lat: Number(w.lat ?? w.latitude),
      lng: Number(w.lng ?? w.longitude),
      address: w.address,
    }));
    const googleRoute = await fetchGoogleRoute({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      waypoints,
    });
    applyRouteToTrip(trip, {
      origin: { lat: origin.lat, lng: origin.lng, address: origin.address },
      destination: { lat: destination.lat, lng: destination.lng, address: destination.address },
      waypoints,
      route: googleRoute,
    });
  }

  await trip.save();
  emitSharedRideEvent(SHARED_RIDE_EVENTS.TRIP_UPDATED, { tripId: trip._id, driverId, status: trip.status });
  return trip;
};

export const configureTripSeatsService = async (tripId, driverId, seats) => {
  const trip = await assertTripDriver(tripId, driverId);
  for (const patch of seats || []) {
    const seat = trip.seats.id(patch.seatId || patch._id);
    if (!seat || seat.isDriverSeat) continue;
    if (patch.enabled !== undefined) seat.enabled = Boolean(patch.enabled);
    if (patch.isBookable !== undefined) seat.isBookable = Boolean(patch.isBookable);
    if (patch.priceModifier !== undefined) seat.priceModifier = Number(patch.priceModifier);
  }
  await trip.save();
  return trip;
};

export const publishTripService = async (tripId, driverId) => {
  const trip = await assertTripDriver(tripId, driverId);
  if (!trip.allowSeatBooking && !trip.allowCharter) {
    throw httpError("Chuyến phải cho phép bán ghế hoặc bao xe", 400);
  }
  if (!trip.routePoints?.length) throw httpError("Chuyến chưa có lộ trình", 400);
  if (!trip.seats.some((s) => s.isBookable && s.enabled)) {
    throw httpError("Chuyến chưa có ghế mở bán", 400);
  }
  trip.status = TRIP_STATUS.OPEN;
  trip.publishedAt = new Date();
  await trip.save();
  console.log("[sharedRide] trip published", trip.tripCode);
  emitSharedRideEvent(SHARED_RIDE_EVENTS.TRIP_UPDATED, { tripId: trip._id, driverId, status: trip.status });
  return trip;
};

export const listDriverTripsService = async (driverId, { status, from, to, page = 1, limit = 20 }) => {
  const filter = { driverId };
  if (status) filter.status = status;
  if (from || to) {
    filter.departureAt = {};
    if (from) filter.departureAt.$gte = new Date(from);
    if (to) filter.departureAt.$lte = new Date(to);
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    SharedRideTrip.find(filter).sort({ departureAt: -1 }).skip(skip).limit(Number(limit)),
    SharedRideTrip.countDocuments(filter),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
};

export const getTripDetailService = async (tripId) => {
  const trip = await getTripOrThrow(tripId);
  const driver = await User.findById(trip.driverId).select("fullName phone avatar");
  return { trip, driver };
};

export const startTripService = async (tripId, driverId) => {
  const trip = await assertTripDriver(tripId, driverId);
  if (!BOOKABLE_TRIP_STATUSES.includes(trip.status) && trip.status !== TRIP_STATUS.FULL) {
    throw httpError("Không thể bắt đầu chuyến ở trạng thái này", 400);
  }
  trip.status = TRIP_STATUS.IN_PROGRESS;
  await trip.save();
  await SharedRideBooking.updateMany(
    { tripId, status: { $in: CONFIRMED_BOOKING_STATUSES } },
    { $set: { status: "IN_PROGRESS" } }
  );
  const bookings = await SharedRideBooking.find({ tripId, status: "IN_PROGRESS" }).select("passengerId");
  await notifyUsers({
    userIds: bookings.map((b) => b.passengerId),
    title: "Chuyến xe ghép đã khởi hành",
    message: `Chuyến ${trip.tripCode} đã bắt đầu.`,
    type: "booking",
    meta: { tripId, tripCode: trip.tripCode },
  });
  emitSharedRideEvent(SHARED_RIDE_EVENTS.TRIP_STARTED, { tripId: trip._id, driverId });
  return trip;
};

export const completeTripService = async (tripId, driverId) => {
  const trip = await assertTripDriver(tripId, driverId);
  trip.status = TRIP_STATUS.COMPLETED;
  await trip.save();
  await SharedRideBooking.updateMany(
    { tripId, status: { $in: ["IN_PROGRESS", "CONFIRMED", "PAID"] } },
    { $set: { status: "COMPLETED" } }
  );
  emitSharedRideEvent(SHARED_RIDE_EVENTS.TRIP_COMPLETED, { tripId: trip._id, driverId });
  return trip;
};

export const cancelTripService = async (tripId, driverId, reason) => {
  const trip = await assertTripDriver(tripId, driverId);
  if (trip.status === TRIP_STATUS.COMPLETED) {
    throw httpError("Không thể hủy chuyến đã hoàn thành", 400);
  }
  trip.status = TRIP_STATUS.CANCELLED;
  trip.cancelledAt = new Date();
  trip.cancelReason = reason || "Tài xế hủy chuyến";
  await trip.save();

  const bookings = await SharedRideBooking.find({
    tripId,
    status: { $nin: ["CANCELLED", "EXPIRED", "REFUNDED", "COMPLETED"] },
  });
  for (const booking of bookings) {
    const wasPaid = ["PAID", "CONFIRMED", "IN_PROGRESS"].includes(booking.status);
    booking.status = wasPaid ? "REFUNDED" : "CANCELLED";
    booking.paymentStatus = wasPaid ? "REFUNDED" : booking.paymentStatus;
    booking.cancelledAt = new Date();
    booking.cancelledBy = "driver";
    booking.cancelReason = reason || "Tài xế hủy chuyến";
    await booking.save();
  }

  await notifyUsers({
    userIds: bookings.map((b) => b.passengerId),
    title: "Chuyến xe ghép đã bị hủy",
    message: `Chuyến ${trip.tripCode} đã bị hủy.${wasPaidNote(bookings)}`,
    type: "warning",
    meta: { tripId },
  });
  emitSharedRideEvent(SHARED_RIDE_EVENTS.TRIP_UPDATED, { tripId: trip._id, driverId, status: trip.status });
  console.log("[sharedRide] trip cancelled", trip.tripCode);
  return trip;
};

const wasPaidNote = (bookings) =>
  bookings.some((b) => b.paymentStatus === "REFUNDED")
    ? " Booking đã thanh toán được đánh dấu hoàn tiền (cần xử lý hoàn trên cổng thanh toán)."
    : "";

export const tripDashboardService = async (tripId, driverId) => {
  const trip = await assertTripDriver(tripId, driverId);
  await expireStaleOccupancies(tripId);
  const bookings = await SharedRideBooking.find({ tripId }).sort({ createdAt: -1 });
  const confirmed = bookings.filter((b) => CONFIRMED_BOOKING_STATUSES.includes(b.status));
  const revenue = confirmed.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
  const bookable = trip.seats.filter((s) => s.isBookable && s.enabled).length;
  return {
    trip,
    totals: {
      bookings: bookings.length,
      confirmed: confirmed.length,
      revenue,
      bookableSeats: bookable,
      confirmedSeatSegments: await countConfirmedOnTrip(tripId),
    },
    bookings,
  };
};

export const tripRevenueSummaryService = async (driverId, { from, to }) => {
  const filter = { driverId, status: { $in: CONFIRMED_BOOKING_STATUSES } };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  const bookings = await SharedRideBooking.find(filter);
  const revenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
  return {
    bookingCount: bookings.length,
    revenue,
    from: from || null,
    to: to || null,
  };
};

export const trackTripService = async (tripId) => {
  const trip = await getTripOrThrow(tripId);
  const profile = await DriverProfile.findOne({ userId: trip.driverId });
  return {
    tripId: trip._id,
    status: trip.status,
    departureAt: trip.departureAt,
    driverLocation: profile?.location || null,
  };
};

export const refreshTripFullness = async (tripId) => {
  const trip = await SharedRideTrip.findById(tripId);
  if (!trip || !BOOKABLE_TRIP_STATUSES.includes(trip.status)) return trip;
  const originStart = 0;
  const end = trip.routeDistance || trip.routePoints.at(-1)?.distanceFromOrigin || 1;
  const SharedRideSeatOccupancy = (await import("../models/SharedRideSeatOccupancy.js")).default;
  const occ = await SharedRideSeatOccupancy.find({
    tripId,
    status: { $in: ["HELD", "CONFIRMED"] },
  });
  const { countAvailableSeats } = await import("./seatAvailabilityService.js");
  const available = countAvailableSeats({ trip, occupancies: occ, start: originStart, end });
  if (available === 0 && trip.status !== TRIP_STATUS.FULL) {
    trip.status = TRIP_STATUS.FULL;
    await trip.save();
  } else if (available > 0 && trip.status === TRIP_STATUS.FULL) {
    trip.status = TRIP_STATUS.OPEN;
    await trip.save();
  }
  return trip;
};
