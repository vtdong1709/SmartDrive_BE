import {
  DRIVER_SUBTYPE,
  DRIVER_SUBTYPE_FROM_LEGACY,
  ERROR_CODE,
  getDailyMaxDays,
  getDailyMinDays,
  getHourlyAllowedHours,
  getHourlyMaxHours,
} from "../constants.js";
import { pricingError } from "../httpError.js";
import { applyCumulativeBrackets, applySingleBracket } from "../rules/distanceRule.js";
import { applyDayBracket, applyHourBracket, ceilDays, hoursBetween } from "../rules/durationRule.js";
import { stackMultipliers, timeFlagsFromDate } from "../rules/multiplierRule.js";
import { applyPlatformFee } from "../rules/platformFeeRule.js";
import { applyRounding } from "../rules/roundingRule.js";
import { calculateRoute } from "../services/routingService.js";
import { getVietnamHolidays } from "../services/holidayService.js";
import { requirePlan } from "../services/pricingPlanService.js";

export const resolveDriverSubType = (context) => {
  const raw = context.subType || context.serviceType || context.vehicleCategory;
  if (!raw) throw pricingError("Thiếu subType / serviceType", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  const mapped = DRIVER_SUBTYPE_FROM_LEGACY[String(raw).toLowerCase()] || String(raw).toUpperCase();
  if (!Object.values(DRIVER_SUBTYPE).includes(mapped)) {
    throw pricingError("Loại dịch vụ đặt tài xế không hợp lệ", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  }
  return mapped;
};

const validateDuration = (subType, startAt, endAt) => {
  if (subType === DRIVER_SUBTYPE.HOURLY) {
    if (!startAt || !endAt) throw pricingError("Hourly cần startTime và endTime", 400, ERROR_CODE.INVALID_PRICING_INPUT);
    const hours = hoursBetween(startAt, endAt);
    if (hours <= 0) throw pricingError("endTime phải lớn hơn startTime", 400, ERROR_CODE.INVALID_PRICING_INPUT);
    const allowed = getHourlyAllowedHours();
    const max = getHourlyMaxHours();
    if (hours > max) throw pricingError(`Dịch vụ theo giờ tối đa ${max} tiếng`, 400, ERROR_CODE.INVALID_PRICING_INPUT);
    if (allowed.length && !allowed.some((h) => Math.abs(hours - h) < 0.01)) {
      throw pricingError(`Thuê theo giờ chỉ cho phép ${allowed.join(" hoặc ")} tiếng`, 400, ERROR_CODE.INVALID_PRICING_INPUT);
    }
    return { hours, days: 0 };
  }
  if (subType === DRIVER_SUBTYPE.DAILY) {
    if (!startAt || !endAt) throw pricingError("Daily cần startTime và endTime", 400, ERROR_CODE.INVALID_PRICING_INPUT);
    const days = ceilDays(startAt, endAt);
    if (days < getDailyMinDays() || days > getDailyMaxDays()) {
      throw pricingError(`Thuê theo ngày chỉ từ ${getDailyMinDays()} đến ${getDailyMaxDays()} ngày`, 400, ERROR_CODE.INVALID_PRICING_INPUT);
    }
    return { hours: hoursBetween(startAt, endAt), days };
  }
  return { hours: 0, days: 0 };
};

export const computeDriverBooking = async ({ context, plan, now }) => {
  const subType = resolveDriverSubType(context);
  const startAt = context.startAt || context.startTime || now;
  const endAt = context.endAt || context.endTime;
  const rules = plan.rules || {};
  const duration = validateDuration(subType, startAt, endAt);

  let distanceKm = Number(context.distanceKm ?? context.route?.distanceKm ?? 0);
  let durationSeconds = Number(context.durationSeconds ?? context.route?.durationSeconds ?? 0);
  let turnBackFee = 0;
  let serviceFare = 0;
  const items = [{ code: "BASE_FARE", label: "Phí mở cửa", amount: Number(rules.baseFare || 0) }];

  if ([DRIVER_SUBTYPE.PER_KM, DRIVER_SUBTYPE.MOTORCYCLE, DRIVER_SUBTYPE.INTERCITY].includes(subType)) {
    if (!context.route && (context.pickup || context.pickupLocation)) {
      const route = await calculateRoute({
        pickup: context.pickup || context.pickupLocation,
        destination: context.destination || context.dropoffLocation,
        stops: context.stops || [],
      });
      distanceKm = route.distanceKm;
      durationSeconds = route.durationSeconds;
    }
    if (!distanceKm && !context.route) {
      throw pricingError("Không có quãng đường", 400, ERROR_CODE.INVALID_PRICING_INPUT);
    }
    if (subType === DRIVER_SUBTYPE.INTERCITY) {
      const cum = applyCumulativeBrackets(distanceKm, rules.fareBrackets || []);
      serviceFare = cum.amount;
      items.push({ code: "DISTANCE_FARE", label: "Cước liên tỉnh", amount: Math.round(serviceFare) });
      const turn = (rules.turnBackFees || []).find(
        (f) => distanceKm >= Number(f.fromKm ?? 0) && (f.toKm == null || distanceKm <= Number(f.toKm))
      );
      if (turn) {
        turnBackFee = Number(turn.fee || 0);
        items.push({ code: "TURN_BACK_FEE", label: "Phí quay đầu", amount: turnBackFee });
      }
    } else {
      const single = applySingleBracket(distanceKm, rules.fareBrackets || []);
      serviceFare = single.amount;
      items.push({ code: "DISTANCE_FARE", label: "Cước quãng đường", amount: Math.round(serviceFare) });
    }
  } else if (subType === DRIVER_SUBTYPE.HOURLY) {
    const hourly = applyHourBracket(duration.hours, rules.hourBrackets || []);
    serviceFare = hourly.amount;
    items.push({ code: "TIME_FARE", label: "Cước theo giờ", amount: Math.round(serviceFare) });
  } else if (subType === DRIVER_SUBTYPE.DAILY) {
    const daily = applyDayBracket(duration.days, rules.dayBrackets || []);
    serviceFare = daily.amount;
    items.push({ code: "TIME_FARE", label: "Cước theo ngày", amount: Math.round(serviceFare) });
  }

  const holidays = context.holidays || (await getVietnamHolidays(new Date(startAt).getFullYear()));
  const flags = timeFlagsFromDate(startAt, holidays);
  const stacked = stackMultipliers(flags, rules.multipliers || {});
  const subtotal = Number(rules.baseFare || 0) + serviceFare + turnBackFee;
  const afterMultiplier = subtotal * stacked.value;
  const platformFee = applyPlatformFee(afterMultiplier, rules.platformFee || { type: "FIXED", fixed: 0 });
  items.push({ code: "PLATFORM_FEE", label: "Phí nền tảng", amount: platformFee });
  const finalFare = applyRounding(afterMultiplier + platformFee, plan.rounding || "NEAREST");

  return {
    subType,
    items,
    subtotal: Math.round(subtotal),
    multiplier: stacked.value,
    platformFee,
    discount: 0,
    finalFare,
    deposit: 0,
    distanceKm,
    durationSeconds: durationSeconds || Math.round((duration.hours || 0) * 3600),
    metadata: {
      flags,
      appliedMultipliers: stacked.applied,
      durationHours: duration.hours,
      durationDays: duration.days,
      turnBackFee,
      order: "serviceSubtotal * multiplier + platformFee - discount",
    },
  };
};

export const quoteDriverBooking = async ({ context, now = new Date() }) => {
  const subType = resolveDriverSubType(context);
  const plan = context.plan || (await requirePlan({ service: "DRIVER_BOOKING", subType, at: now }));
  return { plan, computed: await computeDriverBooking({ context, plan, now }) };
};
