export const hoursBetween = (startAt, endAt) => {
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  return ms / (1000 * 60 * 60);
};

export const ceilDays = (startAt, endAt) => Math.ceil(hoursBetween(startAt, endAt) / 24);

export const applyHourBracket = (durationHours, brackets = []) => {
  const h = Number(durationHours) || 0;
  const hit =
    brackets.find((b) => h >= Number(b.fromHour ?? 0) && (b.toHour == null || h <= Number(b.toHour))) ||
    brackets.at(-1);
  return { amount: h * Number(hit?.pricePerHour || 0), bracket: hit };
};

export const applyDayBracket = (durationDays, brackets = []) => {
  const d = Number(durationDays) || 0;
  const hit =
    brackets.find((b) => d >= Number(b.fromDay ?? 0) && (b.toDay == null || d <= Number(b.toDay))) ||
    brackets.at(-1);
  return { amount: d * Number(hit?.pricePerDay || 0), bracket: hit };
};

export const applyProgressiveHours = (hours, brackets = []) => {
  const h = Number(hours) || 0;
  const sorted = [...brackets].sort((a, b) => Number(a.fromHour ?? 0) - Number(b.fromHour ?? 0));
  let amount = 0;
  const parts = [];
  for (const b of sorted) {
    const from = Number(b.fromHour ?? 0);
    const to = b.toHour == null ? h : Math.min(h, Number(b.toHour));
    if (h <= from) continue;
    const span = Math.max(0, to - from);
    if (span <= 0) continue;
    if (b.flatFee != null && from === 0) {
      amount += Number(b.flatFee);
      parts.push({ from, to, flatFee: Number(b.flatFee) });
      continue;
    }
    const piece = span * Number(b.pricePerHour || 0);
    amount += piece;
    parts.push({ from, to, hours: span, rate: Number(b.pricePerHour || 0), amount: piece });
  }
  return { amount, parts };
};
