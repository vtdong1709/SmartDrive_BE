import RideVehicleCategory from "../models/RideVehicleCategory.js";
import { DEFAULT_CATEGORIES } from "../constants.js";

export const ensureCategories = async () => {
  const count = await RideVehicleCategory.countDocuments();
  if (count === 0) {
    await RideVehicleCategory.insertMany(DEFAULT_CATEGORIES);
    console.log("[rideHailing] seeded vehicle categories");
  }
};

export const listCategoriesService = async () => {
  await ensureCategories();
  return RideVehicleCategory.find({ enabled: true }).sort({ sortOrder: 1 });
};

export const getCategoryByCode = async (code) => {
  await ensureCategories();
  return RideVehicleCategory.findOne({ code: String(code).toUpperCase(), enabled: true });
};

export const updateCategoryService = async (code, payload) => {
  await ensureCategories();
  const allowed = [
    "name",
    "maxPassengers",
    "enabled",
    "baseFare",
    "minimumFare",
    "perKmRate",
    "perMinuteRate",
    "bookingFee",
    "cancellationFee",
    "surgeMultiplier",
    "sortOrder",
    "iconKey",
  ];
  const $set = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) $set[key] = payload[key];
  }
  const category = await RideVehicleCategory.findOneAndUpdate(
    { code: String(code).toUpperCase() },
    { $set },
    { new: true }
  );
  if (!category) throw Object.assign(new Error("Không tìm thấy loại xe"), { statusCode: 404, errorCode: "VEHICLE_CATEGORY_UNAVAILABLE" });
  return category;
};
