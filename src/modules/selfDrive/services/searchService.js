import SelfDriveVehicle from "../models/SelfDriveVehicle.js";
import { VEHICLE_STATUS } from "../constants.js";
import { httpError } from "../httpError.js";
import { loadCalendarContext } from "./availabilityService.js";
import { isVehicleFreeForInterval } from "./availabilityMath.js";
import { getTurnaroundMinutes } from "../constants.js";

export const searchVehiclesService = async (query) => {
  const { startAt, endAt, lat, lng, seatCount, bodyType, transmission, fuelType, minPrice, maxPrice, delivery, instantBooking, radiusKm = 30 } = query;
  if (!startAt || !endAt) throw httpError("Cần startAt và endAt để tìm xe trống", 400);
  if (!(new Date(startAt) < new Date(endAt))) throw httpError("startAt phải nhỏ hơn endAt", 400);

  const filter = { status: VEHICLE_STATUS.PUBLISHED };
  if (seatCount) filter.seatCount = { $gte: Number(seatCount) };
  if (bodyType) filter.bodyType = bodyType;
  if (transmission) filter.transmission = transmission;
  if (fuelType) filter.fuelType = fuelType;
  if (minPrice || maxPrice) {
    filter.dailyPrice = {};
    if (minPrice) filter.dailyPrice.$gte = Number(minPrice);
    if (maxPrice) filter.dailyPrice.$lte = Number(maxPrice);
  }
  if (delivery === "true" || delivery === true) filter.deliveryEnabled = true;
  if (instantBooking === "true" || instantBooking === true) filter.instantBookingEnabled = true;

  if (lat != null && lng != null) {
    filter["location.geo"] = {
      $near: {
        $geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] },
        $maxDistance: Number(radiusKm) * 1000,
      },
    };
  }

  const vehicles = await SelfDriveVehicle.find(filter).limit(100);
  const available = [];
  for (const vehicle of vehicles) {
    const ctx = await loadCalendarContext(vehicle, startAt, endAt);
    const free = isVehicleFreeForInterval({
      requestedStart: startAt,
      requestedEnd: endAt,
      bookings: ctx.bookings,
      blocks: ctx.blocks,
      windows: ctx.windows,
      turnaroundMinutes: getTurnaroundMinutes(vehicle),
    });
    if (free) available.push(vehicle);
  }
  return available;
};
