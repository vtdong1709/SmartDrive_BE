import SharedRideTrip from "../models/SharedRideTrip.js";
import SharedRideSeatOccupancy from "../models/SharedRideSeatOccupancy.js";
import User from "../../../models/User.js";
import { BOOKABLE_TRIP_STATUSES } from "../constants.js";
import { httpError } from "../httpError.js";
import { computeRouteMatchPercent, matchPassengerToTrip } from "./geoService.js";
import { countAvailableSeats, expireStaleOccupancies } from "./seatAvailabilityService.js";
import { buildQuote } from "./pricingService.js";

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export { matchPassengerToTrip };

export const searchTripsService = async ({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  date,
  passengerCount = 1,
  departureFrom,
  departureTo,
  pickupAddress,
  dropoffAddress,
}) => {
  if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null || !date) {
    throw httpError("Cần pickupLat, pickupLng, dropoffLat, dropoffLng và date", 400);
  }

  const day = new Date(date);
  const filter = {
    status: { $in: BOOKABLE_TRIP_STATUSES },
    allowSeatBooking: true,
    departureAt: {
      $gte: departureFrom ? new Date(departureFrom) : startOfDay(day),
      $lte: departureTo ? new Date(departureTo) : endOfDay(day),
    },
  };

  const trips = await SharedRideTrip.find(filter).limit(200);
  const pickup = { lat: Number(pickupLat), lng: Number(pickupLng), address: pickupAddress };
  const dropoff = { lat: Number(dropoffLat), lng: Number(dropoffLng), address: dropoffAddress };
  const results = [];

  for (const trip of trips) {
    if (trip.bookingCutoffAt && new Date(trip.bookingCutoffAt) <= new Date()) continue;
    const matched = matchPassengerToTrip(trip, pickup, dropoff);
    if (!matched.ok) continue;

    await expireStaleOccupancies(trip._id);
    const occupancies = await SharedRideSeatOccupancy.find({
      tripId: trip._id,
      status: { $in: ["HELD", "CONFIRMED"] },
    });
    const start = matched.pickupMatch.distanceFromTripOrigin;
    const end = matched.dropoffMatch.distanceFromTripOrigin;
    const available = countAvailableSeats({ trip, occupancies, start, end });
    if (available < Number(passengerCount || 1)) continue;

    const sampleSeats = trip.seats.filter((s) => s.isBookable && s.enabled).slice(0, 1);
    const quote = sampleSeats.length
      ? buildQuote({
          trip,
          seats: sampleSeats,
          pickup: { distanceFromOrigin: start },
          dropoff: { distanceFromOrigin: end },
        })
      : { total: trip.baseSeatPrice };

    const driver = await User.findById(trip.driverId).select("fullName avatar");
    results.push({
      id: trip._id,
      tripCode: trip.tripCode,
      origin: trip.origin,
      destination: trip.destination,
      departureAt: trip.departureAt,
      estimatedArrivalAt: trip.estimatedArrivalAt,
      vehicle: trip.vehicleSnapshot,
      driver,
      availableSeats: available,
      priceFrom: quote.seatPrices?.[0]?.price ?? quote.total,
      allowCharter: trip.allowCharter,
      routeMatch: {
        routeMatchPercent: computeRouteMatchPercent(
          matched.pickupMatch.deviationMeters,
          matched.dropoffMatch.deviationMeters,
          trip.maxPickupDeviationKm,
          trip.maxDropoffDeviationKm
        ),
        pickupDeviationMeters: matched.pickupMatch.deviationMeters,
        dropoffDeviationMeters: matched.dropoffMatch.deviationMeters,
      },
      estimatedPickupAt: matched.pickupMatch.estimatedPickupTime,
      estimatedDropoffAt: matched.dropoffMatch.estimatedPickupTime,
      seatsAvailableForSegment: available,
      startingPrice: quote.seatPrices?.[0]?.price ?? quote.total,
    });
  }

  results.sort((a, b) => b.routeMatch.routeMatchPercent - a.routeMatch.routeMatchPercent);
  return results;
};

export const popularRoutesService = async () => {
  const rows = await SharedRideTrip.aggregate([
    { $match: { status: { $in: [...BOOKABLE_TRIP_STATUSES, "COMPLETED"] } } },
    {
      $group: {
        _id: {
          origin: "$origin.address",
          destination: "$destination.address",
        },
        count: { $sum: 1 },
        nextDeparture: { $min: "$departureAt" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  return rows.map((r) => ({
    origin: r._id.origin,
    destination: r._id.destination,
    tripCount: r.count,
    nextDeparture: r.nextDeparture,
  }));
};
