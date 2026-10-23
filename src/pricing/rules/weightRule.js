export const applyWeightBracket = (kg, brackets = []) => {
  const w = Number(kg) || 0;
  const hit =
    brackets.find((b) => w >= Number(b.fromKg ?? 0) && (b.toKg == null || w <= Number(b.toKg))) ||
    brackets.at(-1);
  return { amount: Number(hit?.fee || 0), bracket: hit };
};
