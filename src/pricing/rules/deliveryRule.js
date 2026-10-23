export const deliveryFee = ({ enabled, baseFee = 0, distanceKm = 0, perKm = 0 }) => {
  if (!enabled) return 0;
  return Math.round(Number(baseFee || 0) + Number(distanceKm || 0) * Number(perKm || 0));
};
