import SharedRideVehicle from "../models/SharedRideVehicle.js";
import { getSeatTemplate, listVehicleTypes } from "../seatTemplates.js";
import { httpError, assertOwner } from "../httpError.js";

export const listSeatTemplatesService = () => listVehicleTypes();

export const createVehicleService = async (driverId, payload) => {
  const { name, brand, model, plate, color, vehicleType, charterEnabled, charterWindows } = payload;
  if (!name || !plate || !vehicleType) {
    throw httpError("Thiếu name, plate hoặc vehicleType", 400);
  }
  const seats = getSeatTemplate(vehicleType);
  const vehicle = await SharedRideVehicle.create({
    driverId,
    name,
    brand,
    model,
    plate: String(plate).toUpperCase(),
    color,
    vehicleType: String(vehicleType),
    seats,
    charterEnabled: Boolean(charterEnabled),
    charterWindows: charterWindows || [],
  });
  return vehicle;
};

export const listMyVehiclesService = async (driverId) => {
  return SharedRideVehicle.find({ driverId, isActive: true }).sort({ createdAt: -1 });
};

export const getVehicleService = async (vehicleId, driverId) => {
  const vehicle = await SharedRideVehicle.findById(vehicleId);
  if (!vehicle) throw httpError("Không tìm thấy xe", 404);
  if (driverId) assertOwner(vehicle.driverId, driverId);
  return vehicle;
};

export const updateVehicleService = async (vehicleId, driverId, payload) => {
  const vehicle = await getVehicleService(vehicleId, driverId);
  const allowed = ["name", "brand", "model", "color", "charterEnabled", "charterWindows", "isActive"];
  for (const key of allowed) {
    if (payload[key] !== undefined) vehicle[key] = payload[key];
  }
  if (payload.plate) vehicle.plate = String(payload.plate).toUpperCase();
  await vehicle.save();
  return vehicle;
};

export const configureVehicleSeatsService = async (vehicleId, driverId, seats) => {
  const vehicle = await getVehicleService(vehicleId, driverId);
  if (!Array.isArray(seats)) throw httpError("seats phải là mảng", 400);
  for (const patch of seats) {
    const seat = vehicle.seats.id(patch.seatId || patch._id);
    if (!seat) continue;
    if (patch.enabled !== undefined) seat.enabled = Boolean(patch.enabled);
    if (patch.defaultPriceModifier !== undefined) {
      seat.defaultPriceModifier = Number(patch.defaultPriceModifier);
    }
    if (patch.isBookable !== undefined && !seat.isDriverSeat) {
      seat.isBookable = Boolean(patch.isBookable);
    }
  }
  await vehicle.save();
  return vehicle;
};
