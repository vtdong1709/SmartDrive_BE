export const VEHICLE_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  UNPUBLISHED: "UNPUBLISHED",
  SUSPENDED: "SUSPENDED",
};

export const BOOKING_TYPE = {
  REQUEST_TO_BOOK: "REQUEST_TO_BOOK",
  INSTANT_BOOK: "INSTANT_BOOK",
};

export const BOOKING_STATUS = {
  PENDING_OWNER_APPROVAL: "PENDING_OWNER_APPROVAL",
  APPROVED: "APPROVED",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  CONFIRMED: "CONFIRMED",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  IN_USE: "IN_USE",
  RETURN_INSPECTION: "RETURN_INSPECTION",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
  DISPUTED: "DISPUTED",
};

export const BLOCKING_BOOKING_STATUSES = [
  BOOKING_STATUS.AWAITING_PAYMENT,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.READY_FOR_PICKUP,
  BOOKING_STATUS.IN_USE,
  BOOKING_STATUS.RETURN_INSPECTION,
];

export const DEPOSIT_STATUS = {
  PENDING: "PENDING",
  HELD: "HELD",
  COLLECTED: "COLLECTED",
  PARTIALLY_DEDUCTED: "PARTIALLY_DEDUCTED",
  REFUNDED: "REFUNDED",
  FORFEITED: "FORFEITED",
};

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
};

export const AVAILABILITY_TYPE = {
  AVAILABLE: "AVAILABLE",
  BLOCKED: "BLOCKED",
};

export const TRANSMISSION = ["manual", "automatic"];
export const FUEL_TYPE = ["gasoline", "diesel", "electric", "hybrid"];
export const BODY_TYPE = ["sedan", "suv", "mpv", "hatchback", "pickup", "other"];

export const getTurnaroundMinutes = (vehicle) => {
  const fromVehicle = Number(vehicle?.turnaroundMinutes);
  if (Number.isFinite(fromVehicle) && fromVehicle >= 0) return fromVehicle;
  const fromEnv = Number(process.env.SELF_DRIVE_TURNAROUND_MINUTES);
  return Number.isFinite(fromEnv) && fromEnv >= 0 ? fromEnv : 60;
};

export const getTaxRate = () => {
  const raw = Number(process.env.SELF_DRIVE_TAX_RATE);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
};

export const getPlatformFee = () => {
  const raw = Number(process.env.SELF_DRIVE_PLATFORM_FEE);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
};
