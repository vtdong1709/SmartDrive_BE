import { PLATFORM_FEE_TYPE } from "../constants.js";

export const applyPlatformFee = (baseAmount, config = {}) => {
  const type = config.type || PLATFORM_FEE_TYPE.FIXED;
  const fixed = Number(config.fixed ?? config.amount ?? 0);
  const percent = Number(config.percent ?? 0);
  if (type === PLATFORM_FEE_TYPE.PERCENT) return Math.round(Number(baseAmount) * percent);
  if (type === PLATFORM_FEE_TYPE.FIXED_PLUS_PERCENT) {
    return Math.round(fixed + Number(baseAmount) * percent);
  }
  return Math.round(fixed);
};
