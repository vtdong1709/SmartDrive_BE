export const applyDiscount = (amount, discount = 0) => Math.max(0, Number(amount) - Math.round(Number(discount || 0)));

export const longRentalDiscount = (days, rules = []) => {
  const sorted = [...rules].sort((a, b) => Number(b.minimumDays ?? b.minDays) - Number(a.minimumDays ?? a.minDays));
  const hit = sorted.find((r) => days >= Number(r.minimumDays ?? r.minDays));
  if (!hit) return { rate: 0, amount: 0 };
  return { rate: Number(hit.discountPercent ?? hit.rate ?? 0), rule: hit };
};
