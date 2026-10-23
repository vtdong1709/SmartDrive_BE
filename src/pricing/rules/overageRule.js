export const extraMileageFee = ({ includedKm = 0, usedKm = 0, pricePerExtraKm = 0, enabled = false }) => {
  if (!enabled) return 0;
  const extra = Math.max(0, Number(usedKm || 0) - Number(includedKm || 0));
  return Math.round(extra * Number(pricePerExtraKm || 0));
};

export const extraMileageForRental = ({ includedKmPerDay = 0, days = 1, usedKm = 0, pricePerExtraKm = 0, enabled = false }) => {
  if (!enabled) return { extraKm: 0, amount: 0 };
  const included = Number(includedKmPerDay || 0) * Math.max(Number(days) || 1, 1);
  const extraKm = Math.max(0, Number(usedKm || 0) - included);
  return { extraKm, amount: Math.round(extraKm * Number(pricePerExtraKm || 0)), includedKm: included };
};
