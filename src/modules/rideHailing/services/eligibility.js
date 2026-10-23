export const vehicleMatchesCategory = (vehicle, category) => {
  if (!vehicle || !category) return false;
  if (vehicle.active === false || vehicle.verified === false) return false;
  const kind = String(vehicle.kind || vehicle.type || "").toUpperCase();
  const energy = String(vehicle.energyType || vehicle.fuelType || "").toLowerCase();
  const seats = Number(vehicle.seatCount || 0);

  if (category.kind === "MOTORBIKE") {
    return kind === "MOTORBIKE";
  }
  if (category.kind === "EV") {
    return (kind === "EV" || energy === "electric") && seats >= Number(category.minSeats || 0);
  }
  if (category.kind === "CAR") {
    return kind === "CAR" && energy !== "electric" && seats >= Number(category.minSeats || 0);
  }
  return false;
};

export const isLocationFresh = (updatedAt, maxAgeMs, now = Date.now()) => {
  if (!updatedAt) return false;
  return now - new Date(updatedAt).getTime() <= maxAgeMs;
};

export const isDriverEligible = ({
  online,
  approved,
  suspended,
  busy,
  locationFresh,
  vehicleOk,
}) => online && approved && !suspended && !busy && locationFresh && vehicleOk;
