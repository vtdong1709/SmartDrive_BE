import { haversineKm } from "./fareMath.js";
import { isDriverEligible, isLocationFresh } from "./eligibility.js";

export const rankDrivers = ({ drivers, pickup, radiusKm, maxAgeMs, now }) => {
  return drivers
    .filter((d) =>
      isDriverEligible({
        online: d.online,
        approved: d.approved,
        suspended: d.suspended,
        busy: d.busy,
        locationFresh: isLocationFresh(d.locationUpdatedAt, maxAgeMs, now),
        vehicleOk: d.vehicleOk,
      })
    )
    .map((d) => ({
      ...d,
      distanceKm: haversineKm(pickup.lat, pickup.lng, d.lat, d.lng),
    }))
    .filter((d) => d.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
};
