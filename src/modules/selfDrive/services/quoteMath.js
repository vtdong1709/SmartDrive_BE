export const rentalDuration = (startAt, endAt) => {
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  const hours = ms / (1000 * 60 * 60);
  const fullDays = Math.floor(hours / 24);
  const leftoverHours = hours - fullDays * 24;
  return { hours, fullDays, leftoverHours };
};

export const longRentalDiscountRate = (days, rules = []) => {
  const sorted = [...rules].sort((a, b) => b.minDays - a.minDays);
  const hit = sorted.find((r) => days >= r.minDays);
  return hit ? Number(hit.rate || 0) : 0;
};

export const computeQuote = ({
  dailyPrice,
  hourlyOveragePrice = 0,
  startAt,
  endAt,
  deliveryFee = 0,
  insuranceDaily = 0,
  platformFee = 0,
  taxRate = 0,
  discountAmount = 0,
  longDiscountRules = [],
}) => {
  const { hours, fullDays, leftoverHours } = rentalDuration(startAt, endAt);
  let extra = 0;
  if (leftoverHours > 0) {
    extra = hourlyOveragePrice > 0
      ? leftoverHours * hourlyOveragePrice
      : dailyPrice;
  }
  const chargeableDays = Math.max(fullDays + (leftoverHours > 0 && hourlyOveragePrice <= 0 ? 1 : 0), leftoverHours > 0 && hourlyOveragePrice > 0 ? fullDays : fullDays || (hours > 0 ? 0 : 1));
  const baseRental = Math.round(fullDays * dailyPrice + extra);
  const durationDaysForDiscount = Math.max(fullDays + (leftoverHours > 0 ? 1 : 0), 1);
  const longRate = longRentalDiscountRate(durationDaysForDiscount, longDiscountRules);
  const longDiscount = Math.round(baseRental * longRate);
  const insurance = Math.round(insuranceDaily * durationDaysForDiscount);
  const fees = Math.round(Number(platformFee || 0));
  const subtotal = baseRental - longDiscount + deliveryFee + insurance + fees - Number(discountAmount || 0);
  const tax = Math.round(Math.max(subtotal, 0) * Number(taxRate || 0));
  const total = Math.max(0, subtotal + tax);

  return {
    hours: Number(hours.toFixed(2)),
    fullDays,
    leftoverHours: Number(leftoverHours.toFixed(2)),
    chargeableDays: durationDaysForDiscount,
    baseRental,
    longRentalDiscount: longDiscount,
    delivery: Math.round(deliveryFee),
    insurance,
    fees,
    tax,
    discount: Math.round(Number(discountAmount || 0)),
    total,
  };
};

export const computeReturnCharges = ({
  includedKm,
  usedKm,
  excessMileagePrice = 0,
  scheduledEndAt,
  actualReturnAt,
  lateFeePerHour = 0,
  fuelFee = 0,
  damageFee = 0,
  otherCharges = 0,
}) => {
  const excessKm = Math.max(0, Number(usedKm || 0) - Number(includedKm || 0));
  const excessMileage = Math.round(excessKm * Number(excessMileagePrice || 0));
  const lateMs = new Date(actualReturnAt).getTime() - new Date(scheduledEndAt).getTime();
  const lateHours = lateMs > 0 ? lateMs / (1000 * 60 * 60) : 0;
  const lateFee = Math.round(lateHours * Number(lateFeePerHour || 0));
  const extras = {
    excessMileage,
    lateFee,
    fuelFee: Math.round(Number(fuelFee || 0)),
    damageFee: Math.round(Number(damageFee || 0)),
    otherCharges: Math.round(Number(otherCharges || 0)),
  };
  extras.total = extras.excessMileage + extras.lateFee + extras.fuelFee + extras.damageFee + extras.otherCharges;
  extras.usedKm = Number(usedKm || 0);
  extras.includedKm = Number(includedKm || 0);
  extras.excessKm = excessKm;
  extras.lateHours = Number(lateHours.toFixed(2));
  return extras;
};

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

export const isWithinDeliveryRadius = ({ vehicleLat, vehicleLng, destLat, destLng, radiusKm }) => {
  if (!radiusKm || radiusKm <= 0) return false;
  return haversineKm(vehicleLat, vehicleLng, destLat, destLng) <= radiusKm;
};
