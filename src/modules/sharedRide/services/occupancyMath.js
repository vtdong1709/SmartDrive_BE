export const ACTIVE_OCCUPANCY = ["HELD", "CONFIRMED"];

/** Half-open interval: [start, end). Touching at a stop is NOT overlap. */
export const segmentsOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

export const findOverlapping = (occupancies, seatId, start, end, now = new Date()) => {
  const seatKey = String(seatId);
  return occupancies.filter((item) => {
    if (String(item.seatId) !== seatKey) return false;
    if (!ACTIVE_OCCUPANCY.includes(item.status)) return false;
    if (item.status === "HELD" && item.expiresAt && new Date(item.expiresAt) <= now) {
      return false;
    }
    return segmentsOverlap(item.pickupDistance, item.dropoffDistance, start, end);
  });
};
