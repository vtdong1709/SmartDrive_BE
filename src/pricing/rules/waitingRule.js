export const computeWaitingFee = ({ arrivedAt, startedAt, freeMinutes = 0, perMinuteFee = 0, enabled = false }) => {
  if (!enabled || !arrivedAt || !startedAt) return 0;
  const waitMin = (new Date(startedAt) - new Date(arrivedAt)) / 60000;
  const billable = Math.max(0, waitMin - Number(freeMinutes || 0));
  return Math.round(billable * Number(perMinuteFee || 0));
};
