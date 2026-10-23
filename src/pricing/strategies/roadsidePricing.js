import { ERROR_CODE } from "../constants.js";
import { pricingError } from "../httpError.js";
import { applyPlatformFee } from "../rules/platformFeeRule.js";
import { applyRounding } from "../rules/roundingRule.js";
import { applyDiscount } from "../rules/discountRule.js";
import { stackMultipliers, timeFlagsFromDate } from "../rules/multiplierRule.js";
import { requirePlan } from "../services/pricingPlanService.js";
import { getVietnamHolidays } from "../services/holidayService.js";

export const computeRoadside = async ({ context, plan, now }) => {
  const subType = String(context.assistanceType || context.subType || "OTHER").toUpperCase();
  const rules = plan.rules || plan.types?.[subType] || {};
  const typeRules = plan.types?.[subType] || rules;
  const dispatchFee = Number(typeRules.dispatchFee ?? typeRules.serviceBaseFare ?? rules.baseFare ?? 0);
  const travelKm = Number(context.travelDistanceKm || 0);
  const towingKm = Number(context.towingDistanceKm || 0);
  const travelFare = travelKm * Number(typeRules.travelRate ?? rules.travelRate ?? 0);
  const towingFare = towingKm * Number(typeRules.towingRate ?? rules.towingRate ?? 0);
  const vehicleKey = String(context.vehicleCategory || context.rescuedVehicle || "").toUpperCase();
  const vehicleMultiplier = Number((rules.vehicleModifiers || {})[vehicleKey] || 1);
  const startAt = context.startAt || now;
  const holidays = context.holidays || (await getVietnamHolidays(new Date(startAt).getFullYear()));
  const flags = timeFlagsFromDate(startAt, holidays);
  flags.urgent = Boolean(context.urgent);
  flags.vehicle = vehicleMultiplier !== 1;
  const stacked = stackMultipliers(
    { ...flags, vehicle: vehicleMultiplier !== 1, urgent: Boolean(context.urgent) },
    {
      night: rules.multipliers?.night,
      holiday: rules.multipliers?.holiday,
      urgent: rules.multipliers?.urgent,
      vehicle: vehicleMultiplier,
    }
  );
  const subtotal = dispatchFee + travelFare + towingFare;
  const after = subtotal * stacked.value;
  const platformFee = applyPlatformFee(after, rules.platformFee || { type: "FIXED", fixed: 0 });
  const discount = Number(context.discount || 0);
  const finalFare = applyRounding(applyDiscount(after + platformFee, discount), plan.rounding || "NEAREST");
  return {
    subType,
    items: [
      { code: "DISPATCH_FEE", label: "Phí điều xe", amount: Math.round(dispatchFee) },
      { code: "TRAVEL_FARE", label: "Cước di chuyển tới khách", amount: Math.round(travelFare) },
      { code: "TOWING_FARE", label: "Cước kéo xe", amount: Math.round(towingFare) },
      { code: "PLATFORM_FEE", label: "Phí dịch vụ", amount: platformFee },
    ].filter((i) => i.amount),
    subtotal: Math.round(subtotal),
    multiplier: stacked.value,
    platformFee,
    discount,
    finalFare,
    deposit: 0,
    distanceKm: travelKm + towingKm,
    durationSeconds: 0,
    metadata: { vehicleKey, vehicleMultiplier, flags },
  };
};

export const quoteRoadside = async ({ context, now = new Date() }) => {
  const subType = String(context.assistanceType || context.subType || "OTHER").toUpperCase();
  if (!subType) throw pricingError("Thiếu assistanceType", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  if (context.plan) return { plan: context.plan, computed: await computeRoadside({ context, plan: context.plan, now }) };
  const plan = await requirePlan({ service: "ROADSIDE_ASSISTANCE", subType, at: now });
  return { plan, computed: await computeRoadside({ context, plan, now }) };
};
