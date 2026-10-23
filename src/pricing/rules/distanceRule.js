export const applySingleBracket = (distanceKm, brackets = []) => {
  if (!brackets.length) return { amount: 0, bracket: null, rate: 0, mode: "SINGLE" };
  const km = Number(distanceKm) || 0;
  const hit =
    brackets.find((b) => {
      const from = Number(b.fromKm ?? b.from ?? 0);
      const to = b.toKm ?? b.to;
      return km >= from && (to == null || km <= Number(to));
    }) || brackets.at(-1);
  const rate = Number(hit?.pricePerKm || 0);
  return { amount: km * rate, bracket: hit, rate, mode: "SINGLE" };
};

export const applyCumulativeBrackets = (distanceKm, brackets = []) => {
  const km = Number(distanceKm) || 0;
  const sorted = [...brackets].sort(
    (a, b) => Number(a.fromKm ?? a.from ?? 0) - Number(b.fromKm ?? b.from ?? 0)
  );
  let amount = 0;
  const parts = [];
  for (const b of sorted) {
    const from = Number(b.fromKm ?? b.from ?? 0);
    const to = b.toKm ?? b.to;
    if (km <= from) continue;
    const cap = to == null ? km : Math.min(km, Number(to));
    const span = Math.max(0, cap - from);
    if (span <= 0) continue;
    if (b.flatFee != null && from === 0) {
      amount += Number(b.flatFee);
      parts.push({ from, to: cap, flatFee: Number(b.flatFee) });
      continue;
    }
    const piece = span * Number(b.pricePerKm || 0);
    amount += piece;
    parts.push({ from, to: cap, km: span, rate: Number(b.pricePerKm || 0), amount: piece });
  }
  return { amount, parts, mode: "CUMULATIVE" };
};
