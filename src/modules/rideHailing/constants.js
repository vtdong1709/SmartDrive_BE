export const RIDE_STATUS = {
  DRAFT: "DRAFT",
  QUOTE_READY: "QUOTE_READY",
  SEARCHING_DRIVER: "SEARCHING_DRIVER",
  DRIVER_ASSIGNED: "DRIVER_ASSIGNED",
  DRIVER_EN_ROUTE: "DRIVER_EN_ROUTE",
  DRIVER_ARRIVED: "DRIVER_ARRIVED",
  WAITING_FOR_PASSENGER: "WAITING_FOR_PASSENGER",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED_BY_CUSTOMER: "CANCELLED_BY_CUSTOMER",
  CANCELLED_BY_DRIVER: "CANCELLED_BY_DRIVER",
  NO_DRIVER_FOUND: "NO_DRIVER_FOUND",
  NO_SHOW: "NO_SHOW",
};

export const BOOKING_TYPE = {
  IMMEDIATE: "IMMEDIATE",
  SCHEDULED: "SCHEDULED",
};

export const OFFER_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
};

export const STOP_TYPE = {
  PICKUP: "PICKUP",
  STOP: "STOP",
  DESTINATION: "DESTINATION",
};

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  CASH_PENDING: "CASH_PENDING",
};

export const PAYMENT_METHOD = {
  VNPAY: "vnpay",
  PAYOS: "payos",
  CASH: "cash",
};

export const ENERGY_TYPE = {
  GASOLINE: "gasoline",
  DIESEL: "diesel",
  ELECTRIC: "electric",
  HYBRID: "hybrid",
};

export const VEHICLE_KIND = {
  MOTORBIKE: "MOTORBIKE",
  CAR: "CAR",
  EV: "EV",
};

export const ERROR_CODE = {
  NO_DRIVER_AVAILABLE: "NO_DRIVER_AVAILABLE",
  RIDE_ALREADY_ASSIGNED: "RIDE_ALREADY_ASSIGNED",
  INVALID_RIDE_STATE: "INVALID_RIDE_STATE",
  VEHICLE_CATEGORY_UNAVAILABLE: "VEHICLE_CATEGORY_UNAVAILABLE",
  INVALID_OTP: "INVALID_OTP",
  OTP_EXPIRED: "OTP_EXPIRED",
  DRIVER_TOO_FAR: "DRIVER_TOO_FAR",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  RIDE_CANCELLED: "RIDE_CANCELLED",
  LOCATION_INVALID: "LOCATION_INVALID",
  QUOTE_EXPIRED: "QUOTE_EXPIRED",
  SCHEDULE_TIME_INVALID: "SCHEDULE_TIME_INVALID",
  OFFER_EXPIRED: "OFFER_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
};

export const ACTIVE_RIDE_STATUSES = [
  RIDE_STATUS.SEARCHING_DRIVER,
  RIDE_STATUS.DRIVER_ASSIGNED,
  RIDE_STATUS.DRIVER_EN_ROUTE,
  RIDE_STATUS.DRIVER_ARRIVED,
  RIDE_STATUS.WAITING_FOR_PASSENGER,
  RIDE_STATUS.IN_PROGRESS,
];

export const parseKmRadii = () => {
  const raw = process.env.RIDE_SEARCH_RADII_KM || "2,4,7,10";
  return raw.split(",").map((n) => Number(n.trim())).filter((n) => n > 0);
};

export const getOfferSeconds = () => Number(process.env.RIDE_OFFER_SECONDS) || 20;
export const getQuoteTtlSeconds = () => Number(process.env.RIDE_QUOTE_TTL_SECONDS) || 120;
export const getScheduleLeadMinutes = () => Number(process.env.RIDE_SCHEDULE_LEAD_MINUTES) || 20;
export const getMaxStops = () => Number(process.env.RIDE_MAX_STOPS) || 3;
export const getOtpTtlMinutes = () => Number(process.env.RIDE_OTP_TTL_MINUTES) || 15;
export const getFreeWaitMinutes = () => Number(process.env.RIDE_FREE_WAIT_MINUTES) || 5;
export const getWaitFeePerMin = () => Number(process.env.RIDE_WAIT_FEE_PER_MIN) || 3000;
export const getLocationMaxAgeMs = () => Number(process.env.RIDE_LOCATION_MAX_AGE_MS) || 120000;
export const getMaxScheduleDays = () => Number(process.env.RIDE_MAX_SCHEDULE_DAYS) || 7;
export const getMinLeadMinutes = () => Number(process.env.RIDE_MIN_LEAD_MINUTES) || 10;
export const getCommissionRate = () => {
  const raw = process.env.BOOKING_COMMISSION_RATE;
  const percent = raw != null ? Number(raw) : 15;
  return Number.isNaN(percent) ? 0.15 : Math.min(Math.max(percent, 0), 100) / 100;
};

export const DEFAULT_CATEGORIES = [
  { code: "MOTORBIKE", name: "Xe máy", maxPassengers: 2, energyType: "gasoline", kind: "MOTORBIKE", minSeats: 1, baseFare: 10000, minimumFare: 15000, perKmRate: 5000, perMinuteRate: 300, bookingFee: 2000, cancellationFee: 5000, sortOrder: 1 },
  { code: "CAR_4", name: "Ô tô 4 chỗ", maxPassengers: 4, energyType: "gasoline", kind: "CAR", minSeats: 4, baseFare: 15000, minimumFare: 25000, perKmRate: 12000, perMinuteRate: 400, bookingFee: 5000, cancellationFee: 15000, sortOrder: 2 },
  { code: "CAR_6", name: "Ô tô 6 chỗ", maxPassengers: 6, energyType: "gasoline", kind: "CAR", minSeats: 6, baseFare: 20000, minimumFare: 35000, perKmRate: 15000, perMinuteRate: 500, bookingFee: 5000, cancellationFee: 20000, sortOrder: 3 },
  { code: "EV_2", name: "Ô tô điện 2 chỗ", maxPassengers: 2, energyType: "electric", kind: "EV", minSeats: 2, baseFare: 12000, minimumFare: 20000, perKmRate: 9000, perMinuteRate: 350, bookingFee: 4000, cancellationFee: 10000, sortOrder: 4 },
  { code: "EV_4", name: "Ô tô điện 4 chỗ", maxPassengers: 4, energyType: "electric", kind: "EV", minSeats: 4, baseFare: 14000, minimumFare: 23000, perKmRate: 11000, perMinuteRate: 380, bookingFee: 4000, cancellationFee: 12000, sortOrder: 5 },
  { code: "EV_6", name: "Ô tô điện 6 chỗ", maxPassengers: 6, energyType: "electric", kind: "EV", minSeats: 6, baseFare: 18000, minimumFare: 30000, perKmRate: 14000, perMinuteRate: 450, bookingFee: 5000, cancellationFee: 18000, sortOrder: 6 },
];
