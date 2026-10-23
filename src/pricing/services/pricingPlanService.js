import Pricing from "../../models/Pricing.js";
import PricingPlan from "../models/PricingPlan.js";
import { DRIVER_SUBTYPE_FROM_LEGACY, ERROR_CODE, PRICING_SERVICE } from "../constants.js";
import { pricingError } from "../httpError.js";
import { getActivePricingByServiceType } from "../../services/pricingService.js";

export const legacyPricingToPlan = (legacy, subType) => {
  if (!legacy) return null;
  return {
    _id: legacy._id,
    service: PRICING_SERVICE.DRIVER_BOOKING,
    subType,
    version: 1,
    status: "ACTIVE",
    effectiveFrom: legacy.effectiveFrom,
    effectiveTo: legacy.effectiveTo,
    rounding: "NEAREST",
    rules: {
      baseFare: legacy.baseFare,
      fareBrackets: (legacy.fareBrackets || []).map((b) => ({
        fromKm: b.from,
        toKm: b.to,
        pricePerKm: b.pricePerKm,
      })),
      hourBrackets: legacy.hourBrackets || [],
      dayBrackets: legacy.dayBrackets || [],
      turnBackFees: legacy.turnBackFees || [],
      multipliers: legacy.multipliers || {},
      platformFee: { type: "FIXED", fixed: legacy.platformFee || 0 },
      extraMileageRule: { enabled: false, maxKmPerHour: legacy.maxKmPerHour, maxKmPerDay: legacy.maxKmPerDay, surchargePerKm: legacy.surchargePerKm },
      waitingRule: { enabled: false, perMinuteFee: legacy.waitingFeePerMin, freeMinutes: 0 },
    },
    source: "legacy_pricing",
  };
};

export const getActivePlan = async ({ service, subType, at = new Date() }) => {
  const plan = await PricingPlan.findOne({
    service,
    status: "ACTIVE",
    effectiveFrom: { $lte: at },
    $and: [
      { $or: [{ subType: subType || null }, { subType: null }] },
      { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: at } }] },
    ],
  }).sort({ effectiveFrom: -1, version: -1 });

  if (plan) return plan;

  if (service === PRICING_SERVICE.DRIVER_BOOKING) {
    const legacyType = Object.entries(DRIVER_SUBTYPE_FROM_LEGACY).find(([, v]) => v === subType)?.[0];
    if (legacyType) {
      const legacy = await getActivePricingByServiceType(legacyType, at);
      if (legacy) {
        console.warn("[pricing] pricing_version_missing using legacy Pricing", { service, subType });
        return legacyPricingToPlan(legacy, subType);
      }
    }
  }

  const fallback = await PricingPlan.findOne({ service, $or: [{ subType }, { subType: null }] }).sort({
    effectiveFrom: -1,
    version: -1,
  });
  if (fallback) {
    console.warn("[pricing] pricing_version_missing fallback latest", { service, subType });
    return fallback;
  }
  return null;
};

export const requirePlan = async (args) => {
  const plan = await getActivePlan(args);
  if (!plan) throw pricingError("Không tìm thấy bảng giá", 404, ERROR_CODE.PRICING_NOT_FOUND);
  return plan;
};

export const createPlanVersion = async (payload, userId) => {
  const last = await PricingPlan.findOne({ service: payload.service, subType: payload.subType || null }).sort({ version: -1 });
  return PricingPlan.create({
    ...payload,
    version: (last?.version || 0) + 1,
    createdBy: userId || null,
    status: payload.status || "ACTIVE",
  });
};
