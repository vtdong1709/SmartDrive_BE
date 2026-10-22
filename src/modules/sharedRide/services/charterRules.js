export const parseHm = (value) => {
  if (!value || typeof value !== "string") return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

export const minutesOnDate = (date, timeZone = "Asia/Ho_Chi_Minh") => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(date));
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return hour * 60 + minute;
};

export const isTimeInWindows = (requestedAt, windows = []) => {
  if (!windows.length) return false;
  const minutes = minutesOnDate(requestedAt);
  return windows.some((w) => {
    const start = parseHm(w.start);
    const end = parseHm(w.end);
    if (start == null || end == null) return false;
    if (start <= end) return minutes >= start && minutes <= end;
    return minutes >= start || minutes <= end;
  });
};

export const canCharterExistingTrip = ({ trip, confirmedSeatCount }) => {
  if (!trip?.allowCharter) return { ok: false, reason: "trip_not_allow_charter" };
  if (confirmedSeatCount > 0) return { ok: false, reason: "trip_has_confirmed_passengers" };
  return { ok: true };
};

export const rangesOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA;
