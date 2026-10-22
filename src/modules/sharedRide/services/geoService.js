import axios from "axios";

const EARTH_RADIUS_M = 6371000;

export const toRad = (deg) => (deg * Math.PI) / 180;

export const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
};

export const decodePolyline = (encoded) => {
  if (!encoded) return [];
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
};

const projectOnSegment = (p, a, b) => {
  const ax = a.longitude;
  const ay = a.latitude;
  const bx = b.longitude;
  const by = b.latitude;
  const px = p.longitude;
  const py = p.latitude;
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  let t = 0;
  if (length2 > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / length2;
    t = Math.max(0, Math.min(1, t));
  }
  return {
    latitude: ay + t * dy,
    longitude: ax + t * dx,
    t,
  };
};

export const buildRouteMetrics = (points) => {
  const result = [];
  let distance = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      distance += haversineMeters(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude
      );
    }
    result.push({
      latitude: points[i].latitude,
      longitude: points[i].longitude,
      address: points[i].address || "",
      sequence: i,
      distanceFromOrigin: Math.round(distance),
      type: points[i].type || (i === 0 ? "origin" : i === points.length - 1 ? "destination" : "waypoint"),
      isOfficialStop: points[i].isOfficialStop !== false,
      estimatedArrivalAt: points[i].estimatedArrivalAt || null,
    });
  }
  return result;
};

export const matchLocationToTripRoute = (location, trip, maxDeviationKm) => {
  const lat = Number(location.lat ?? location.latitude);
  const lng = Number(location.lng ?? location.longitude);
  const route = trip.routePoints || [];

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || route.length < 2) {
    return {
      matched: false,
      deviationMeters: null,
      projectedPositionOnRoute: null,
      distanceFromTripOrigin: null,
      estimatedPickupTime: null,
    };
  }

  let best = null;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const projected = projectOnSegment(
      { latitude: lat, longitude: lng },
      a,
      b
    );
    const deviation = haversineMeters(lat, lng, projected.latitude, projected.longitude);
    const segmentLen = Math.max(1, b.distanceFromOrigin - a.distanceFromOrigin);
    const distanceFromOrigin = a.distanceFromOrigin + projected.t * segmentLen;
    if (!best || deviation < best.deviationMeters) {
      best = {
        deviationMeters: Math.round(deviation),
        projectedPositionOnRoute: {
          latitude: projected.latitude,
          longitude: projected.longitude,
          segmentIndex: i,
        },
        distanceFromTripOrigin: Math.round(distanceFromOrigin),
      };
    }
  }

  const maxMeters = (maxDeviationKm ?? trip.maxPickupDeviationKm ?? 2) * 1000;
  const matched = Boolean(best && best.deviationMeters <= maxMeters);
  let estimatedPickupTime = null;
  if (matched && trip.departureAt && trip.routeDuration && trip.routeDistance) {
    const ratio = best.distanceFromTripOrigin / Math.max(trip.routeDistance, 1);
    estimatedPickupTime = new Date(
      new Date(trip.departureAt).getTime() + ratio * trip.routeDuration * 1000
    );
  } else if (matched && trip.departureAt) {
    estimatedPickupTime = new Date(trip.departureAt);
  }

  return {
    matched,
    deviationMeters: best?.deviationMeters ?? null,
    projectedPositionOnRoute: best?.projectedPositionOnRoute ?? null,
    distanceFromTripOrigin: best?.distanceFromTripOrigin ?? null,
    estimatedPickupTime,
  };
};

export const matchPassengerToTrip = (trip, pickup, dropoff) => {
  const pickupMatch = matchLocationToTripRoute(pickup, trip, trip.maxPickupDeviationKm);
  const dropoffMatch = matchLocationToTripRoute(dropoff, trip, trip.maxDropoffDeviationKm);
  if (!pickupMatch.matched || !dropoffMatch.matched) {
    return { ok: false, reason: "too_far", pickupMatch, dropoffMatch };
  }
  if (!(pickupMatch.distanceFromTripOrigin < dropoffMatch.distanceFromTripOrigin)) {
    return { ok: false, reason: "wrong_direction", pickupMatch, dropoffMatch };
  }
  return { ok: true, pickupMatch, dropoffMatch };
};

export const computeRouteMatchPercent = (pickupDeviation, dropoffDeviation, maxPickupKm, maxDropoffKm) => {
  const pickupScore = 1 - Math.min(1, pickupDeviation / Math.max(maxPickupKm * 1000, 1));
  const dropoffScore = 1 - Math.min(1, dropoffDeviation / Math.max(maxDropoffKm * 1000, 1));
  return Math.round(((pickupScore + dropoffScore) / 2) * 100);
};

export const fetchGoogleRoute = async ({ origin, destination, waypoints = [] }) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const originStr = `${origin.lat},${origin.lng}`;
  const destStr = `${destination.lat},${destination.lng}`;
  const waypointStr = waypoints
    .map((w) => `${w.lat},${w.lng}`)
    .join("|");
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    originStr
  )}&destination=${encodeURIComponent(destStr)}${
    waypointStr ? `&waypoints=${encodeURIComponent(waypointStr)}` : ""
  }&key=${apiKey}`;

  const { data } = await axios.get(url);
  if (data.status !== "OK" || !data.routes?.[0]) return null;

  const route = data.routes[0];
  const legDistance = route.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
  const legDuration = route.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
  const decoded = decodePolyline(route.overview_polyline?.points);
  return {
    polyline: route.overview_polyline?.points || "",
    distance: legDistance,
    duration: legDuration,
    points: decoded,
  };
};

export const toPlace = (input) => {
  const lat = Number(input.lat ?? input.latitude);
  const lng = Number(input.lng ?? input.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !input.address) {
    throw Object.assign(new Error("Địa điểm cần address, lat, lng"), { statusCode: 400 });
  }
  return {
    address: input.address,
    location: { type: "Point", coordinates: [lng, lat] },
  };
};

export const placeLatLng = (place) => ({
  lat: place?.location?.coordinates?.[1],
  lng: place?.location?.coordinates?.[0],
  address: place?.address,
});
