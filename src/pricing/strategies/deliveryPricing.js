import { ERROR_CODE } from "../constants.js";
import { pricingError } from "../httpError.js";
import { applyCumulativeBrackets, applySingleBracket } from "../rules/distanceRule.js";
import { applyWeightBracket } from "../rules/weightRule.js";
import { applyPlatformFee } from "../rules/platformFeeRule.js";
import { applyRounding } from "../rules/roundingRule.js";
import { applyDiscount } from "../rules/discountRule.js";
import { computeWaitingFee } from "../rules/waitingRule.js";
import { stackMultipliers } from "../rules/multiplierRule.js";
import { calculateRoute } from "../services/routingService.js";
import { requirePlan } from "../services/pricingPlanService.js";

export const computeDelivery = async ({ context, plan }) => {
  const subType = String(context.vehicleType || context.subType || "MOTORBIKE").toUpperCase();
  const rules = plan.rules || {};
  let distanceKm = Number(context.distanceKm ?? context.route?.distanceKm ?? 0);
  if (!context.route && context.pickup && context.destination) {
    const route = await calculateRoute({
      pickup: context.pickup,
      destination: context.destination,
      stops: context.stops || [],
    });
    distanceKm = route.distanceKm;
  }
  const distance = (rules.distanceMode === "SINGLE" ? applySingleBracket : applyCumulativeBrackets)(
    distanceKm,
    rules.fareBrackets || []
  );
  const weight = applyWeightBracket(context.weightKg ?? context.weight, rules.weightBrackets || []);
  const sizeFee = Number(context.sizeFee ?? rules.sizeFee ?? 0);
  const stopFee = Number(rules.stopFee || 0) * Number((context.stops || []).length);
  const speed = String(context.deliverySpeed || "STANDARD").toUpperCase();
  const speedMultiplier = Number((rules.speedMultipliers || {})[speed] || 1);
  let codFee = 0;
  if (context.codAmount) {
    if (rules.cod?.type === "PERCENT") {
      codFee = Math.round(Number(context.codAmount) * Number(rules.cod.percent || 0));
    } else {
      codFee = Number(rules.cod?.fixed || 0);
    }
    if (rules.cod?.min != null) codFee = Math.max(codFee, Number(rules.cod.min));
    if (rules.cod?.max != null) codFee = Math.min(codFee, Number(rules.cod.max));
  }
  const waitingFee = computeWaitingFee({
    arrivedAt: context.arrivedAt,
    startedAt: context.startedAt,
    freeMinutes: rules.waitingRule?.freeMinutes,
    perMinuteFee: rules.waitingRule?.perMinuteFee,
    enabled: Boolean(rules.waitingRule?.enabled),
  });
  const baseFare = Number(rules.baseFare || 0);
  const subtotal = baseFare + distance.amount + weight.amount + sizeFee + stopFee + codFee + waitingFee;
  const stacked = stackMultipliers({ speed: true }, { speed: speedMultiplier, ...(rules.multipliers || {}) });
  const after = subtotal * stacked.value;
  const platformFee = applyPlatformFee(after, rules.platformFee || { type: "FIXED", fixed: 0 });
  const discount = Number(context.discount || 0);
  const finalFare = applyRounding(applyDiscount(after + platformFee, discount), plan.rounding || "NEAREST");
  return {
    subType,
    items: [
      { code: "BASE_FARE", label: "Giá mở cửa", amount: baseFare },
      { code: "DISTANCE_FARE", label: "Cước quãng đường", amount: Math.round(distance.amount) },
      { code: "WEIGHT_FEE", label: "Phí khối lượng", amount: weight.amount },
      { code: "STOP_FEE", label: "Phí điểm dừng", amount: stopFee },
      { code: "COD_FEE", label: "Phí COD", amount: codFee },
      { code: "PLATFORM_FEE", label: "Phí dịch vụ", amount: platformFee },
    ].filter((i) => i.amount),
    subtotal: Math.round(subtotal),
    multiplier: stacked.value,
    platformFee,
    discount,
    finalFare,
    deposit: 0,
    distanceKm,
    durationSeconds: Number(context.durationSeconds || 0),
    metadata: { speed, codAmount: context.codAmount || 0, weightKg: context.weightKg || context.weight || 0 },
  };
};

export const quoteDelivery = async ({ context, now = new Date() }) => {
  const subType = String(context.vehicleType || context.subType || "MOTORBIKE").toUpperCase();
  if (context.plan) return { plan: context.plan, computed: await computeDelivery({ context, plan: context.plan }) };
  const plan = await requirePlan({ service: "DELIVERY", subType, at: now });
  return { plan, computed: await computeDelivery({ context, plan }) };
};
