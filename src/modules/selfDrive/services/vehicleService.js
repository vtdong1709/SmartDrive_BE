import SelfDriveVehicle from "../models/SelfDriveVehicle.js";
import { VEHICLE_STATUS } from "../constants.js";
import { httpError, assertOwner } from "../httpError.js";

const toGeo = (location) => {
  const lat = Number(location.lat ?? location.latitude);
  const lng = Number(location.lng ?? location.longitude);
  if (!location?.address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw httpError("location cần address, lat, lng", 400);
  }
  return { address: location.address, geo: { type: "Point", coordinates: [lng, lat] } };
};

export const createVehicleService = async (ownerId, payload) => {
  const required = ["make", "model", "year", "plate", "seatCount", "transmission", "fuelType", "dailyPrice", "location"];
  for (const key of required) {
    if (payload[key] == null) throw httpError(`Thiếu ${key}`, 400);
  }
  return SelfDriveVehicle.create({
    ownerId,
    make: payload.make,
    model: payload.model,
    year: payload.year,
    plate: String(payload.plate).toUpperCase(),
    color: payload.color,
    seatCount: payload.seatCount,
    transmission: payload.transmission,
    fuelType: payload.fuelType,
    bodyType: payload.bodyType || "sedan",
    location: toGeo(payload.location),
    instantBookingEnabled: Boolean(payload.instantBookingEnabled),
    dailyPrice: payload.dailyPrice,
    hourlyOveragePrice: payload.hourlyOveragePrice || 0,
    depositAmount: payload.depositAmount || 0,
    dailyMileageLimit: payload.dailyMileageLimit ?? 200,
    excessMileagePrice: payload.excessMileagePrice || 0,
    lateFeePerHour: payload.lateFeePerHour || 0,
    insuranceDaily: payload.insuranceDaily || 0,
    turnaroundMinutes: payload.turnaroundMinutes ?? 60,
    deliveryEnabled: Boolean(payload.deliveryEnabled),
    deliveryRadius: payload.deliveryRadius || 0,
    deliveryPricing: payload.deliveryPricing || { baseFee: 0, perKm: 0 },
    longDiscountRules: payload.longDiscountRules || [
      { minDays: 3, rate: 0.05 },
      { minDays: 7, rate: 0.1 },
      { minDays: 30, rate: 0.2 },
    ],
    description: payload.description || "",
    status: VEHICLE_STATUS.DRAFT,
  });
};

export const getOwnedVehicle = async (vehicleId, ownerId) => {
  const vehicle = await SelfDriveVehicle.findById(vehicleId);
  if (!vehicle) throw httpError("Không tìm thấy xe", 404);
  if (ownerId) assertOwner(vehicle.ownerId, ownerId);
  return vehicle;
};

export const updateVehicleService = async (vehicleId, ownerId, payload) => {
  const vehicle = await getOwnedVehicle(vehicleId, ownerId);
  const scalars = [
    "make", "model", "year", "color", "seatCount", "transmission", "fuelType", "bodyType",
    "instantBookingEnabled", "dailyPrice", "hourlyOveragePrice", "depositAmount",
    "dailyMileageLimit", "excessMileagePrice", "lateFeePerHour", "insuranceDaily",
    "turnaroundMinutes", "deliveryEnabled", "deliveryRadius", "description",
  ];
  for (const key of scalars) {
    if (payload[key] !== undefined) vehicle[key] = payload[key];
  }
  if (payload.plate) vehicle.plate = String(payload.plate).toUpperCase();
  if (payload.location) vehicle.location = toGeo(payload.location);
  if (payload.deliveryPricing) vehicle.deliveryPricing = payload.deliveryPricing;
  if (payload.longDiscountRules) vehicle.longDiscountRules = payload.longDiscountRules;
  await vehicle.save();
  return vehicle;
};

export const addPhotoService = async (vehicleId, ownerId, { url, publicId, caption }) => {
  const vehicle = await getOwnedVehicle(vehicleId, ownerId);
  if (!url) throw httpError("Thiếu url ảnh", 400);
  vehicle.photos.push({
    url,
    publicId,
    caption: caption || "",
    sortOrder: vehicle.photos.length,
    uploadedBy: ownerId,
  });
  await vehicle.save();
  return vehicle;
};

export const removePhotoService = async (vehicleId, ownerId, photoId) => {
  const vehicle = await getOwnedVehicle(vehicleId, ownerId);
  const photo = vehicle.photos.id(photoId);
  if (!photo) throw httpError("Không tìm thấy ảnh", 404);
  photo.deleteOne();
  await vehicle.save();
  return vehicle;
};

export const publishVehicleService = async (vehicleId, ownerId, publish = true) => {
  const vehicle = await getOwnedVehicle(vehicleId, ownerId);
  if (publish) {
    if (!vehicle.photos.length) throw httpError("Cần ít nhất 1 ảnh trước khi đăng xe", 400);
    vehicle.status = VEHICLE_STATUS.PUBLISHED;
    vehicle.publishedAt = new Date();
  } else {
    vehicle.status = VEHICLE_STATUS.UNPUBLISHED;
  }
  await vehicle.save();
  return vehicle;
};

export const listMyVehiclesService = async (ownerId) => {
  return SelfDriveVehicle.find({ ownerId }).sort({ createdAt: -1 });
};

export const getPublicVehicleService = async (vehicleId) => {
  const vehicle = await SelfDriveVehicle.findById(vehicleId).populate("ownerId", "fullName avatar");
  if (!vehicle || vehicle.status !== VEHICLE_STATUS.PUBLISHED) {
    throw httpError("Không tìm thấy xe đang đăng", 404);
  }
  return vehicle;
};
