export const PRICING_SERVICE = {
  DRIVER_BOOKING: "DRIVER_BOOKING",
  RIDE_HAILING: "RIDE_HAILING",
  SELF_DRIVE: "SELF_DRIVE",
  DELIVERY: "DELIVERY",
  ROADSIDE_ASSISTANCE: "ROADSIDE_ASSISTANCE",
  PARKING: "PARKING",
};

export const DRIVER_SUBTYPE = {
  PER_KM: "PER_KM",
  MOTORCYCLE: "MOTORCYCLE",
  INTERCITY: "INTERCITY",
  HOURLY: "HOURLY",
  DAILY: "DAILY",
};

export const DRIVER_SUBTYPE_FROM_LEGACY = {
  per_km: DRIVER_SUBTYPE.PER_KM,
  motorcycle: DRIVER_SUBTYPE.MOTORCYCLE,
  intercity: DRIVER_SUBTYPE.INTERCITY,
  hourly: DRIVER_SUBTYPE.HOURLY,
  daily: DRIVER_SUBTYPE.DAILY,
};

export const LEGACY_FROM_SUBTYPE = {
  PER_KM: "per_km",
  MOTORCYCLE: "motorcycle",
  INTERCITY: "intercity",
  HOURLY: "hourly",
  DAILY: "daily",
};

export const ERROR_CODE = {
  PRICING_NOT_FOUND: "PRICING_NOT_FOUND",
  PRICING_CONFIG_INVALID: "PRICING_CONFIG_INVALID",
  QUOTE_NOT_FOUND: "QUOTE_NOT_FOUND",
  QUOTE_EXPIRED: "QUOTE_EXPIRED",
  QUOTE_ALREADY_CONSUMED: "QUOTE_ALREADY_CONSUMED",
  QUOTE_USER_MISMATCH: "QUOTE_USER_MISMATCH",
  QUOTE_SERVICE_MISMATCH: "QUOTE_SERVICE_MISMATCH",
  ROUTE_CALCULATION_FAILED: "ROUTE_CALCULATION_FAILED",
  INVALID_PRICING_INPUT: "INVALID_PRICING_INPUT",
};

export const PLATFORM_FEE_TYPE = {
  FIXED: "FIXED",
  PERCENT: "PERCENT",
  FIXED_PLUS_PERCENT: "FIXED_PLUS_PERCENT",
};

export const ROUNDING = {
  NONE: "NONE",
  NEAREST: "NEAREST",
  NEAREST_100: "NEAREST_100",
  NEAREST_500: "NEAREST_500",
  NEAREST_1000: "NEAREST_1000",
  CEIL_1000: "CEIL_1000",
};

export const DEFAULT_QUOTE_TTL_SECONDS = {
  DRIVER_BOOKING: 600,
  RIDE_HAILING: 300,
  SELF_DRIVE: 1200,
  DELIVERY: 600,
  ROADSIDE_ASSISTANCE: 600,
  PARKING: 600,
};

export const getQuoteTtlSeconds = (service) => {
  const envKey = `PRICING_QUOTE_TTL_${service}_SECONDS`;
  const fromEnv = Number(process.env[envKey]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return DEFAULT_QUOTE_TTL_SECONDS[service] || 600;
};

export const getHourlyAllowedHours = () => {
  const raw = process.env.DRIVER_BOOKING_HOURLY_ALLOWED || "4,8";
  return raw.split(",").map((n) => Number(n.trim())).filter((n) => n > 0);
};

export const getDailyMinDays = () => Number(process.env.DRIVER_BOOKING_DAILY_MIN) || 1;
export const getDailyMaxDays = () => Number(process.env.DRIVER_BOOKING_DAILY_MAX) || 3;
export const getHourlyMaxHours = () => Number(process.env.DRIVER_BOOKING_HOURLY_MAX) || 8;
