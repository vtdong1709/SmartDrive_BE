import RideHailingVehicle from "../models/RideHailingVehicle.js";
import { ENERGY_TYPE, ERROR_CODE, VEHICLE_KIND } from "../constants.js";
import { httpError } from "../httpError.js";

const KIND = Object.values(VEHICLE_KIND);

export const upsertDriverVehicle = async (driverId, payload) => {
  const kind = String(payload.kind || payload.type || "").toUpperCase();
  if (!KIND.includes(kind)) throw httpError("Loại xe không hợp lệ", 400, ERROR_CODE.VEHICLE_CATEGORY_UNAVAILABLE);
  const seatCount = Number(payload.seatCount);
  if (!seatCount || seatCount < 1) throw httpError("seatCount không hợp lệ", 400);
  const energyType = String(payload.energyType || payload.fuelType || (kind === VEHICLE_KIND.EV ? ENERGY_TYPE.ELECTRIC : ENERGY_TYPE.GASOLINE)).toLowerCase();
  if (!payload.plate) throw httpError("Biển số bắt buộc", 400);

  return RideHailingVehicle.findOneAndUpdate(
    { driverId },
    {
      driverId,
      kind,
      seatCount,
      energyType,
      plate: String(payload.plate).toUpperCase(),
      make: payload.make || "",
      model: payload.model || "",
      color: payload.color || "",
      verified: payload.verified !== false,
      active: payload.active !== false,
    },
    { upsert: true, new: true }
  );
};

export const getDriverVehicle = async (driverId) => RideHailingVehicle.findOne({ driverId });
