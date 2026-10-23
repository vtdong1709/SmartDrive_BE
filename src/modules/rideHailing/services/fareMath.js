export const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

export const routeDistanceKm = (points) => {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    km += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return Number(km.toFixed(3));
};

export const estimateDurationMinutes = (distanceKm, avgKmh = 25) =>
  Number(((distanceKm / avgKmh) * 60).toFixed(1));

export const computeFare = ({
  distanceKm,
  durationMinutes,
  baseFare,
  perKmRate,
  perMinuteRate,
  bookingFee = 0,
  surgeMultiplier = 1,
  minimumFare = 0,
  discount = 0,
  waitingFee = 0,
  tolls = 0,
}) => {
  const distanceFare = Math.round(distanceKm * perKmRate);
  const timeFare = Math.round(durationMinutes * perMinuteRate);
  const raw = (baseFare + distanceFare + timeFare + bookingFee + waitingFee + tolls) * surgeMultiplier;
  const afterMin = Math.max(Math.round(raw), minimumFare);
  const estimatedFare = Math.max(0, afterMin - Math.round(discount || 0));
  return {
    baseFare,
    distanceFare,
    timeFare,
    bookingFee,
    waitingFee,
    tolls,
    surgeMultiplier,
    discount: Math.round(discount || 0),
    minimumFare,
    estimatedFare,
  };
};

export const computeWaitingFee = ({ arrivedAt, startedAt, freeMinutes, perMinuteFee }) => {
  if (!arrivedAt || !startedAt) return 0;
  const waitMin = (new Date(startedAt) - new Date(arrivedAt)) / 60000;
  const billable = Math.max(0, waitMin - Number(freeMinutes || 0));
  return Math.round(billable * Number(perMinuteFee || 0));
};

export const computeEarnings = ({ finalFare, commissionRate }) => {
  const platformFee = Math.round(Number(finalFare) * Number(commissionRate));
  return {
    grossFare: Math.round(finalFare),
    platformFee,
    driverEarning: Math.round(finalFare) - platformFee,
  };
};

export const isQuoteFresh = (expiresAt, now = new Date()) => new Date(expiresAt) > now;
