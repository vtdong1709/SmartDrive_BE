import redis from "../../../redis.js";
import DriverProfile from "../../../models/DriverProfile.js";
import RideHailingVehicle from "../models/RideHailingVehicle.js";
import RideBooking from "../models/RideBooking.js";
import RideDriverOffer from "../models/RideDriverOffer.js";
import {
  ACTIVE_RIDE_STATUSES,
  ERROR_CODE,
  getLocationMaxAgeMs,
  getOfferSeconds,
  OFFER_STATUS,
  parseKmRadii,
} from "../constants.js";
import { httpError } from "../httpError.js";
import { vehicleMatchesCategory } from "./eligibility.js";
import { emitRide, notifyUsers } from "./notify.js";
import { rankDrivers } from "./matchingMath.js";

export { rankDrivers };

export const collectOnlineCandidates = async (category) => {
  const profiles = await DriverProfile.find({
    approved: true,
    availability: "online",
    location: { $exists: true },
  }).lean();

  const busyIds = new Set(
    (
      await RideBooking.find({
        status: { $in: ACTIVE_RIDE_STATUSES.filter((s) => s !== "SEARCHING_DRIVER") },
        driverId: { $ne: null },
      }).distinct("driverId")
    ).map(String)
  );

  const vehicles = await RideHailingVehicle.find({
    driverId: { $in: profiles.map((p) => p.userId) },
    active: true,
  }).lean();
  const vehicleByDriver = new Map(vehicles.map((v) => [String(v.driverId), v]));

  const now = Date.now();
  const maxAge = getLocationMaxAgeMs();
  const candidates = [];

  for (const profile of profiles) {
    const driverId = String(profile.userId);
    const coords = profile.location?.coordinates;
    if (!coords?.length) continue;
    let lat = coords[1];
    let lng = coords[0];
    let updatedAt = profile.updatedAt;
    try {
      const cached = await redis.get(`driver:${driverId}`);
      if (cached) {
        const info = JSON.parse(cached);
        lat = info.location?.lat ?? info.lat ?? lat;
        lng = info.location?.lng ?? info.lng ?? lng;
        updatedAt = info.lastSeen || info.timestamp || updatedAt;
      }
    } catch {
      /* redis optional */
    }
    const vehicle = vehicleByDriver.get(driverId);
    candidates.push({
      driverId,
      lat,
      lng,
      locationUpdatedAt: updatedAt,
      online: true,
      approved: profile.approved,
      suspended: false,
      busy: busyIds.has(driverId),
      vehicleOk: vehicleMatchesCategory(vehicle, category),
      vehicle,
    });
  }
  return { candidates, now, maxAge };
};

export const sendOffersForRide = async (ride, category) => {
  const radii = parseKmRadii();
  const currentRadius = ride.searchRadiusKm || radii[0];
  const { candidates, now, maxAge } = await collectOnlineCandidates(category);
  const ranked = rankDrivers({
    drivers: candidates,
    pickup: { lat: ride.pickupLocation.latitude, lng: ride.pickupLocation.longitude },
    radiusKm: currentRadius,
    maxAgeMs: maxAge,
    now,
  }).filter((d) => !ride.offeredDriverIds.some((id) => String(id) === String(d.driverId)));

  if (!ranked.length) {
    const next = radii.find((r) => r > currentRadius);
    if (next) {
      ride.searchRadiusKm = next;
      await ride.save();
      console.log("[rideHailing] driver_search expand", ride.rideCode, next);
      return sendOffersForRide(ride, category);
    }
    return [];
  }

  const target = ranked[0];
  const offer = await RideDriverOffer.create({
    rideId: ride._id,
    driverId: target.driverId,
    expiresAt: new Date(Date.now() + getOfferSeconds() * 1000),
    distanceKm: target.distanceKm,
    status: OFFER_STATUS.PENDING,
  });
  ride.offeredDriverIds.push(target.driverId);
  await ride.save();

  emitRide("driver.ride_offer", {
    rideId: ride._id,
    driverId: target.driverId,
    offerId: offer._id,
    expiresAt: offer.expiresAt,
    pickup: ride.pickupLocation,
    destination: ride.destinationLocation,
    quotedFare: ride.quotedFare,
    categoryCode: ride.categoryCode,
  });
  await notifyUsers({
    userIds: [target.driverId],
    title: "Chuyến mới gần bạn",
    message: `${ride.pickupLocation.address} → ${ride.destinationLocation.address}`,
    type: "request",
    meta: { rideId: ride._id, offerId: offer._id },
  });
  console.log("[rideHailing] offer_sent", ride.rideCode, target.driverId);
  return [offer];
};

export const expireOffersAndContinue = async () => {
  const expired = await RideDriverOffer.find({
    status: OFFER_STATUS.PENDING,
    expiresAt: { $lte: new Date() },
  });
  for (const offer of expired) {
    offer.status = OFFER_STATUS.EXPIRED;
    await offer.save();
    emitRide("driver.offer_expired", { rideId: offer.rideId, driverId: offer.driverId, offerId: offer._id });
    const ride = await RideBooking.findById(offer.rideId);
    if (ride?.status === "SEARCHING_DRIVER") {
      const { getCategoryByCode } = await import("./categoryService.js");
      const category = await getCategoryByCode(ride.categoryCode);
      if (category) await sendOffersForRide(ride, category);
    }
  }
  return expired.length;
};

export const markNoDriver = async (ride) => {
  ride.status = "NO_DRIVER_FOUND";
  ride.statusHistory.push({ status: "NO_DRIVER_FOUND", at: new Date(), by: "system" });
  await ride.save();
  emitRide("ride.cancelled", { rideId: ride._id, customerId: ride.customerId, status: ride.status });
  throw httpError("Không tìm thấy tài xế phù hợp", 404, ERROR_CODE.NO_DRIVER_AVAILABLE);
};
