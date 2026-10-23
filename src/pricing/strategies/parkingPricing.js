import { ERROR_CODE } from "../constants.js";
import { pricingError } from "../httpError.js";
import { applyProgressiveHours, hoursBetween } from "../rules/durationRule.js";
import { applyPlatformFee } from "../rules/platformFeeRule.js";
import { applyRounding } from "../rules/roundingRule.js";
import { requirePlan } from "../services/pricingPlanService.js";

export const computeParking = async ({ context, plan }) => {
  const startAt = context.startAt;
  const endAt = context.endAt;
  if (!startAt || !endAt) throw pricingError("Parking cần startAt và endAt", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  const hours = hoursBetween(startAt, endAt);
  if (hours <= 0) throw pricingError("endAt phải sau startAt", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  const rules = plan.rules || {};
  const mode = String(context.mode || rules.mode || "HOURLY").toUpperCase();
  let fare = 0;
  if (mode === "DAILY" || mode === "OVERNIGHT") {
    fare = Number(rules.dailyRate || 0) * Math.ceil(hours / 24);
  } else if (mode === "MONTHLY") {
    fare = Number(rules.monthlyRate || 0);
  } else if (mode === "BLOCK") {
    fare = Number(rules.blockRate || 0);
  } else {
    const progressive = applyProgressiveHours(hours, rules.hourBrackets || []);
    fare = progressive.amount;
  }
  const dailyMax = Number(rules.dailyMax || 0);
  if (dailyMax > 0) {
    const days = Math.max(Math.ceil(hours / 24), 1);
    const hourlyTotal = fare;
    const capped = dailyMax * days;
    fare = Math.min(hourlyTotal, capped);
  }
  const reservationFee = context.reservation || rules.reservationFeeEnabled ? Number(rules.reservationFee || 0) : 0;
  const platformFee = applyPlatformFee(fare, rules.platformFee || { type: "FIXED", fixed: 0 });
  const finalFare = applyRounding(fare + reservationFee + platformFee, plan.rounding || "NEAREST");
  return {
    subType: String(context.vehicleType || "CAR").toUpperCase(),
    items: [
      { code: "PARKING_FARE", label: "Phí gửi xe", amount: Math.round(fare) },
      { code: "RESERVATION_FEE", label: "Phí giữ chỗ", amount: reservationFee },
      { code: "PLATFORM_FEE", label: "Phí dịch vụ", amount: platformFee },
    ].filter((i) => i.amount),
    subtotal: Math.round(fare),
    multiplier: 1,
    platformFee,
    discount: 0,
    finalFare,
    deposit: 0,
    distanceKm: 0,
    durationSeconds: Math.round(hours * 3600),
    metadata: { mode, hours, dailyMax, quotedFare: finalFare },
  };
};

export const finalizeParking = ({ quoted, actualContext = {}, plan }) => {
  const rules = plan?.rules || {};
  if (!actualContext.actualExitAt) {
    return { quotedFare: quoted.finalFare, adjustments: [], finalFare: quoted.finalFare };
  }
  const extraHours = Math.max(
    0,
    hoursBetween(quoted.metadata?.endAt || actualContext.scheduledEndAt, actualContext.actualExitAt)
  );
  const overstay = Math.round(extraHours * Number(rules.overstayPerHour || 0));
  return {
    quotedFare: quoted.finalFare,
    adjustments: overstay ? [{ code: "OVERSTAY", amount: overstay }] : [],
    finalFare: quoted.finalFare + overstay,
  };
};

export const quoteParking = async ({ context, now = new Date() }) => {
  if (context.plan) return { plan: context.plan, computed: await computeParking({ context, plan: context.plan }) };
  const plan = await requirePlan({
    service: "PARKING",
    subType: context.parkingLotId || context.vehicleType || null,
    at: now,
  });
  return { plan, computed: await computeParking({ context, plan }) };
};
