import axios from "axios";
import { ERROR_CODE } from "../constants.js";
import { pricingError } from "../httpError.js";

const toText = (location) => {
  if (!location) return "";
  if (typeof location === "string") return location;
  if (location.address) return location.address;
  const lat = location.lat ?? location.latitude;
  const lng = location.lng ?? location.longitude;
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) return `${lat},${lng}`;
  return "";
};

export const calculateRoute = async ({ pickup, destination, stops = [] }) => {
  if (pickup?.distanceKm != null || destination?.__route) {
    return pickup.__route || destination.__route;
  }
  const origin = toText(pickup);
  const dest = toText(destination);
  if (!origin || !dest) {
    throw pricingError("Thiếu điểm đi hoặc điểm đến", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  }
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw pricingError("Chưa cấu hình Google Maps", 500, ERROR_CODE.ROUTE_CALCULATION_FAILED);
  }
  try {
    const mid = (stops || []).map(toText).filter(Boolean).join("|");
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}&key=${apiKey}`;
    const { data } = await axios.get(url);
    if (data.status !== "OK") throw new Error(data.status);
    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") throw new Error("NO_ROUTE");
    const distanceMeters = element.distance.value;
    const durationSeconds = element.duration.value;
    return {
      distanceMeters,
      distanceKm: distanceMeters / 1000,
      durationSeconds,
      waypoints: mid,
    };
  } catch (error) {
    console.error("[pricing] routing failed", error.message);
    throw pricingError("Không tính được lộ trình", 400, ERROR_CODE.ROUTE_CALCULATION_FAILED);
  }
};
