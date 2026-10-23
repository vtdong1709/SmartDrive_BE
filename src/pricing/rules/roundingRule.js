import { ROUNDING } from "../constants.js";

export const applyRounding = (amount, mode = ROUNDING.NEAREST) => {
  const n = Number(amount) || 0;
  switch (mode) {
    case ROUNDING.NONE:
      return n;
    case ROUNDING.NEAREST_100:
      return Math.round(n / 100) * 100;
    case ROUNDING.NEAREST_500:
      return Math.round(n / 500) * 500;
    case ROUNDING.NEAREST_1000:
      return Math.round(n / 1000) * 1000;
    case ROUNDING.CEIL_1000:
      return Math.ceil(n / 1000) * 1000;
    case ROUNDING.NEAREST:
    default:
      return Math.round(n);
  }
};
