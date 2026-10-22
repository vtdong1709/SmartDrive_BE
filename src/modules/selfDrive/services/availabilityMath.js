/** Overlap: existing.start < requested.end AND requested.start < existing.end */
export const intervalsOverlap = (existingStart, existingEnd, requestedStart, requestedEnd) => {
  return existingStart < requestedEnd && requestedStart < existingEnd;
};

export const expandWithBuffer = (startAt, endAt, turnaroundMinutes = 0) => {
  const bufferMs = Number(turnaroundMinutes || 0) * 60 * 1000;
  return {
    startAt: new Date(new Date(startAt).getTime() - bufferMs),
    endAt: new Date(new Date(endAt).getTime() + bufferMs),
  };
};

export const bookingBlocksRequest = ({
  existingStart,
  existingEnd,
  requestedStart,
  requestedEnd,
  turnaroundMinutes = 0,
}) => {
  const blocked = expandWithBuffer(existingStart, existingEnd, turnaroundMinutes);
  return intervalsOverlap(
    blocked.startAt.getTime(),
    blocked.endAt.getTime(),
    new Date(requestedStart).getTime(),
    new Date(requestedEnd).getTime()
  );
};

export const isCoveredByWindows = (startAt, endAt, windows = []) => {
  if (!windows.length) return true;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  return windows.some((w) => new Date(w.startAt).getTime() <= start && new Date(w.endAt).getTime() >= end);
};

export const isVehicleFreeForInterval = ({
  requestedStart,
  requestedEnd,
  bookings = [],
  blocks = [],
  windows = [],
  turnaroundMinutes = 0,
}) => {
  if (!(new Date(requestedStart) < new Date(requestedEnd))) return false;
  if (!isCoveredByWindows(requestedStart, requestedEnd, windows)) return false;

  const hitBooking = bookings.some((b) =>
    bookingBlocksRequest({
      existingStart: b.startAt,
      existingEnd: b.endAt,
      requestedStart,
      requestedEnd,
      turnaroundMinutes,
    })
  );
  if (hitBooking) return false;

  const hitBlock = blocks.some((b) =>
    intervalsOverlap(
      new Date(b.startAt).getTime(),
      new Date(b.endAt).getTime(),
      new Date(requestedStart).getTime(),
      new Date(requestedEnd).getTime()
    )
  );
  return !hitBlock;
};

const parseHm = (value) => {
  const [h, m] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

export const expandRecurringWindows = (rules, from, to) => {
  const result = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  while (cursor <= end) {
    for (const rule of rules) {
      if (!rule.recurring?.enabled) continue;
      const days = rule.recurring.daysOfWeek || [];
      if (!days.includes(cursor.getDay())) continue;
      const startMin = parseHm(rule.recurring.startHm);
      const endMin = parseHm(rule.recurring.endHm);
      if (startMin == null || endMin == null) continue;
      const startAt = new Date(cursor);
      startAt.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
      const endAt = new Date(cursor);
      endAt.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
      result.push({ type: rule.type, startAt, endAt });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
};
