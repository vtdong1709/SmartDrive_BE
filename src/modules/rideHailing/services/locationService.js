import redis from "../../../redis.js";
import DriverProfile from "../../../models/DriverProfile.js";
import { ERROR_CODE } from "../constants.js";
import { httpError } from "../httpError.js";
import { emitRide } from "./notify.js";

export const updateDriverLocationService = async (driverId, { latitude, longitude, heading, speed }) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw httpError("Tọa độ không hợp lệ", 400, ERROR_CODE.LOCATION_INVALID);
  }

  const profile = await DriverProfile.findOneAndUpdate(
    { userId: driverId },
    { $set: { location: { type: "Point", coordinates: [lng, lat] } } },
    { new: true }
  );
  if (!profile) throw httpError("Tài xế chưa có hồ sơ", 404);

  try {
    await redis.set(
      `driver:${driverId}`,
      JSON.stringify({
        location: { lat, lng, heading: heading || 0, speed: speed || 0 },
        lastSeen: Date.now(),
      })
    );
  } catch {
    /* redis optional */
  }

  emitRide("ride.driver_location_updated", { driverId, latitude: lat, longitude: lng, heading, speed });
  return { latitude: lat, longitude: lng, heading, speed, updatedAt: new Date() };
};
