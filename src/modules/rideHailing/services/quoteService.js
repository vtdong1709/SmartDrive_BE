import axios from "axios";
import RideQuote from "../models/RideQuote.js";
import { ERROR_CODE, getMaxStops, getQuoteTtlSeconds } from "../constants.js";
import { httpError } from "../httpError.js";
import { estimateDurationMinutes, routeDistanceKm } from "./fareMath.js";
import { getCategoryByCode } from "./categoryService.js";
import { createQuote } from "../../../pricing/pricingEngine.js";
import { PRICING_SERVICE } from "../../../pricing/constants.js";

const toPoint = (p, name) => {
  const lat = Number(p?.lat ?? p?.latitude);
  const lng = Number(p?.lng ?? p?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !p?.address) {
    throw httpError(`${name} không hợp lệ`, 400, ERROR_CODE.LOCATION_INVALID);
  }
  return { latitude: lat, longitude: lng, address: p.address, placeId: p.placeId || null, lat, lng };
};

export const calculateRideRoute = async ({ pickup, stops = [], destination }) => {
  const points = [pickup, ...stops, destination].map((p) => ({
    lat: Number(p.lat ?? p.latitude),
    lng: Number(p.lng ?? p.longitude),
    address: p.address,
  }));
  let distanceKm = routeDistanceKm(points);
  let durationMinutes = estimateDurationMinutes(distanceKm);
  let polyline = "";

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey && points.length >= 2) {
    try {
      const origin = `${points[0].lat},${points[0].lng}`;
      const dest = `${points.at(-1).lat},${points.at(-1).lng}`;
      const mid = points.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join("|");
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${dest}${mid ? `&waypoints=${encodeURIComponent(mid)}` : ""}&key=${apiKey}`;
      const { data } = await axios.get(url);
      if (data.status === "OK" && data.routes?.[0]) {
        const legs = data.routes[0].legs || [];
        const meters = legs.reduce((s, l) => s + (l.distance?.value || 0), 0);
        const seconds = legs.reduce((s, l) => s + (l.duration?.value || 0), 0);
        distanceKm = Number((meters / 1000).toFixed(3));
        durationMinutes = Number((seconds / 60).toFixed(1));
        polyline = data.routes[0].overview_polyline?.points || "";
      }
    } catch (error) {
      console.warn("[rideHailing] directions fallback", error.message);
    }
  }

  return { distanceKm, durationMinutes, polyline, points };
};

export const createQuoteService = async (customerId, payload) => {
  const category = await getCategoryByCode(payload.categoryCode);
  if (!category) throw httpError("Loại xe không khả dụng", 400, ERROR_CODE.VEHICLE_CATEGORY_UNAVAILABLE);

  const pickup = toPoint(payload.pickup, "pickup");
  const destination = toPoint(payload.destination, "destination");
  const stops = (payload.stops || []).map((s, i) => toPoint(s, `stop[${i}]`));
  if (stops.length > getMaxStops()) throw httpError(`Tối đa ${getMaxStops()} điểm dừng`, 400);

  const route = await calculateRideRoute({ pickup, stops, destination });
  const engineQuote = await createQuote({
    service: PRICING_SERVICE.RIDE_HAILING,
    userId: customerId,
    context: {
      vehicleCategory: category.code,
      pickup,
      destination,
      stops,
      bookingType: payload.bookingType,
      scheduledAt: payload.scheduledAt,
      route: { distanceKm: route.distanceKm, durationSeconds: route.durationMinutes * 60 },
      promoCode: payload.promoCode || null,
    },
  });

  const quote = await RideQuote.create({
    customerId,
    categoryCode: category.code,
    bookingType: payload.bookingType || "IMMEDIATE",
    scheduledAt: payload.scheduledAt || null,
    pickup,
    destination,
    stops,
    distanceKm: engineQuote.distanceKm,
    durationMinutes: (engineQuote.durationSeconds || 0) / 60,
    breakdown: {
      baseFare: engineQuote.baseFare,
      items: engineQuote.items,
      estimatedFare: engineQuote.finalFare,
    },
    estimatedFare: engineQuote.finalFare,
    expiresAt: engineQuote.expiresAt || new Date(Date.now() + getQuoteTtlSeconds() * 1000),
    pricingQuoteId: engineQuote.quoteId,
  });

  console.log("[rideHailing] ride_quote", quote._id.toString(), category.code);
  return {
    ...engineQuote,
    quoteId: engineQuote.quoteId,
    rideQuoteId: quote._id,
    expiresAt: quote.expiresAt,
    categoryCode: category.code,
    distance: engineQuote.distanceKm,
    duration: (engineQuote.durationSeconds || 0) / 60,
    polyline: route.polyline,
    estimatedFare: engineQuote.finalFare,
    minFare: category.minimumFare,
    priceRange: { min: engineQuote.finalFare, max: Math.round(engineQuote.finalFare * 1.15) },
  };
};
