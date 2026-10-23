import { ERROR_CODE } from "../constants.js";
import { pricingError } from "../httpError.js";
import { applyCumulativeBrackets } from "../rules/distanceRule.js";
import { applyPlatformFee } from "../rules/platformFeeRule.js";
import { applyRounding } from "../rules/roundingRule.js";
import { applyDiscount } from "../rules/discountRule.js";
import { computeWaitingFee } from "../rules/waitingRule.js";
import { calculateRoute } from "../services/routingService.js";
import { getActivePlan } from "../services/pricingPlanService.js";
import { getCategoryByCode } from "../../modules/rideHailing/services/categoryService.js";

const categoryToPlan = (category) => ({
  _id: category._id,
  rounding: "NEAREST",
  rules: {
    baseFare: category.baseFare,
    fareBrackets: category.fareBrackets?.length
      ? category.fareBrackets
      : [{ fromKm: 0, toKm: null, pricePerKm: category.perKmRate }],
    pricePerMinute: category.perMinuteRate,
    bookingFee: category.bookingFee || 0,
    surgeMultiplier: category.surgeMultiplier || 1,
    minimumFare: category.minimumFare || 0,
    platformFee: { type: "FIXED", fixed: 0 },
    waitingRule: { enabled: false, freeMinutes: 5, perMinuteFee: 3000 },
  },
  source: "ride_category",
});

export const computeRideHailing = async ({ context, plan, now }) => {
  const subType = String(context.vehicleCategory || context.categoryCode || context.subType || "").toUpperCase();
  if (!subType) throw pricingError("Thiếu vehicleCategory", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  const rules = plan.rules || {};

  let distanceKm = Number(context.distanceKm ?? context.route?.distanceKm ?? 0);
  let durationSeconds = Number(context.durationSeconds ?? context.route?.durationSeconds ?? 0);
  if (!context.route && context.pickup && context.destination) {
    const route = await calculateRoute({
      pickup: context.pickup,
      destination: context.destination,
      stops: context.stops || [],
    });
    distanceKm = route.distanceKm;
    durationSeconds = route.durationSeconds;
  }

  const distance = applyCumulativeBrackets(distanceKm, rules.fareBrackets || []);
  const durationMinutes = durationSeconds / 60;
  const timeFare = Math.round(durationMinutes * Number(rules.pricePerMinute || 0));
  const waitingFee = computeWaitingFee({
    arrivedAt: context.arrivedAt,
    startedAt: context.startedAt || context.tripStartedAt,
    freeMinutes: rules.waitingRule?.freeMinutes,
    perMinuteFee: rules.waitingRule?.perMinuteFee,
    enabled: Boolean(rules.waitingRule?.enabled) || Boolean(context.settleWaiting),
  });
  const bookingFee = Number(rules.bookingFee || 0);
  const tollFee = Number(context.tollFee || 0);
  const extraFee = Number(context.extraFee || 0);
  const baseFare = Number(rules.baseFare || 0);
  const subtotal = baseFare + distance.amount + timeFare + waitingFee + tollFee + extraFee + bookingFee;
  const timeMultiplier = Number(rules.timeMultiplier || 1);
  const surgeMultiplier = Number(context.surgeMultiplier || rules.surgeMultiplier || 1);
  const afterMultiplier = subtotal * timeMultiplier * surgeMultiplier;
  const platformFee = applyPlatformFee(afterMultiplier, rules.platformFee || { type: "FIXED", fixed: 0 });
  const discount = Number(context.discount || 0);
  let finalFare = applyRounding(applyDiscount(afterMultiplier + platformFee, discount), plan.rounding || "NEAREST");
  if (rules.minimumFare) finalFare = Math.max(finalFare, Number(rules.minimumFare));

  const items = [
    { code: "BASE_FARE", label: "Giá mở cửa", amount: baseFare },
    { code: "DISTANCE_FARE", label: "Cước quãng đường", amount: Math.round(distance.amount) },
    { code: "TIME_FARE", label: "Cước thời gian", amount: timeFare },
  ];
  if (bookingFee) items.push({ code: "BOOKING_FEE", label: "Phí đặt xe", amount: bookingFee });
  if (waitingFee) items.push({ code: "WAITING_FEE", label: "Phí chờ", amount: waitingFee });
  if (platformFee) items.push({ code: "PLATFORM_FEE", label: "Phí dịch vụ", amount: platformFee });
  if (discount) items.push({ code: "PROMOTION", label: "Ưu đãi", amount: -discount });

  return {
    subType,
    items,
    subtotal: Math.round(subtotal),
    multiplier: timeMultiplier * surgeMultiplier,
    platformFee,
    discount,
    finalFare,
    deposit: 0,
    distanceKm,
    durationSeconds,
    metadata: { distanceParts: distance.parts, surgeMultiplier, timeMultiplier, waitingFee },
  };
};

export const quoteRideHailing = async ({ context, now = new Date() }) => {
  const subType = String(context.vehicleCategory || context.categoryCode || context.subType || "").toUpperCase();
  let plan = context.plan || (await getActivePlan({ service: "RIDE_HAILING", subType, at: now }));
  if (!plan) {
    const category = await getCategoryByCode(subType);
    if (!category) throw pricingError("Loại xe không khả dụng", 400, ERROR_CODE.PRICING_NOT_FOUND);
    plan = categoryToPlan(category);
  }
  return { plan, computed: await computeRideHailing({ context, plan, now }) };
};
