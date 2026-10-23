import { ERROR_CODE } from "../constants.js";
import { pricingError } from "../httpError.js";
import { hoursBetween } from "../rules/durationRule.js";
import { applyDiscount, longRentalDiscount } from "../rules/discountRule.js";
import { deliveryFee } from "../rules/deliveryRule.js";
import { extraMileageForRental } from "../rules/overageRule.js";
import { applyRounding } from "../rules/roundingRule.js";
import { getActivePlan } from "../services/pricingPlanService.js";
import { getPublicVehicleService } from "../../modules/selfDrive/services/vehicleService.js";
import { getPlatformFee, getTaxRate } from "../../modules/selfDrive/constants.js";
import { haversineKm, isWithinDeliveryRadius } from "../../modules/selfDrive/services/quoteMath.js";

export const computeSelfDrive = async ({ context, plan }) => {
  const startAt = context.startAt;
  const endAt = context.endAt;
  if (!startAt || !endAt || !(new Date(startAt) < new Date(endAt))) {
    throw pricingError("startAt phải nhỏ hơn endAt", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  }
  const vehicle = context.vehicle || (context.vehicleId ? await getPublicVehicleService(context.vehicleId) : null);
  if (!vehicle && !context.dailyRate && !plan?.rules?.dailyRate) {
    throw pricingError("Thiếu vehicleId hoặc dailyRate", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  }
  const rules = plan?.rules || {};
  const dailyRate = Number(context.dailyRate ?? vehicle?.dailyPrice ?? rules.dailyRate ?? 0);
  const hourlyOverage = Number(context.hourlyOverageRate ?? vehicle?.hourlyOveragePrice ?? rules.hourlyOverageRate ?? 0);
  const hours = hoursBetween(startAt, endAt);
  const fullDays = Math.floor(hours / 24);
  const remainingHours = hours - fullDays * 24;
  const rentalFare = fullDays * dailyRate + remainingHours * (hourlyOverage || (remainingHours > 0 ? dailyRate / remainingHours : 0) && 0);
  const extra = remainingHours > 0 ? (hourlyOverage > 0 ? remainingHours * hourlyOverage : dailyRate) : 0;
  const baseRental = Math.round(fullDays * dailyRate + extra);
  const chargeableDays = Math.max(fullDays + (remainingHours > 0 ? 1 : 0), 1);
  const longRules = rules.longRentalDiscount || vehicle?.longDiscountRules || [];
  const long = longRentalDiscount(chargeableDays, longRules);
  const longAmount = Math.round(baseRental * (long.rate > 1 ? long.rate / 100 : long.rate));

  let deliveryAmount = 0;
  let deliveryDistanceKm = 0;
  const pickupMode = context.pickupMode || (context.deliveryLocation ? "DELIVERY" : "PICKUP_AT_CAR");
  if (pickupMode === "DELIVERY" && context.deliveryLocation && vehicle) {
    if (!vehicle.deliveryEnabled) throw pricingError("Xe không hỗ trợ giao xe", 400, ERROR_CODE.INVALID_PRICING_INPUT);
    const [lng, lat] = vehicle.location.geo.coordinates;
    const destLat = Number(context.deliveryLocation.lat ?? context.deliveryLocation.latitude);
    const destLng = Number(context.deliveryLocation.lng ?? context.deliveryLocation.longitude);
    if (!isWithinDeliveryRadius({ vehicleLat: lat, vehicleLng: lng, destLat, destLng, radiusKm: vehicle.deliveryRadius })) {
      throw pricingError("Ngoài bán kính giao xe", 400, ERROR_CODE.INVALID_PRICING_INPUT);
    }
    deliveryDistanceKm = haversineKm(lat, lng, destLat, destLng);
    deliveryAmount = deliveryFee({
      enabled: true,
      baseFee: vehicle.deliveryPricing?.baseFee || rules.baseDeliveryFee || 0,
      distanceKm: deliveryDistanceKm,
      perKm: vehicle.deliveryPricing?.perKm || rules.deliveryPricePerKm || 0,
    });
  } else if (pickupMode === "DELIVERY" && context.deliveryDistanceKm != null) {
    deliveryAmount = deliveryFee({
      enabled: true,
      baseFee: rules.baseDeliveryFee || 0,
      distanceKm: context.deliveryDistanceKm,
      perKm: rules.deliveryPricePerKm || 0,
    });
  }

  const insurance = Math.round(Number(context.includeInsurance === false ? 0 : vehicle?.insuranceDaily || rules.insuranceDaily || 0) * chargeableDays);
  const platformFee = Number(rules.platformFee?.fixed ?? getPlatformFee());
  const taxRate = Number(rules.taxRate ?? getTaxRate());
  const discount = Number(context.discount || 0);
  const subtotal = baseRental - longAmount + deliveryAmount + insurance + platformFee - discount;
  const tax = Math.round(Math.max(subtotal, 0) * taxRate);
  const finalFare = applyRounding(Math.max(0, subtotal + tax), plan?.rounding || "NEAREST");
  const deposit = Number(context.deposit ?? vehicle?.depositAmount ?? rules.deposit ?? 0);

  const items = [
    { code: "RENTAL_FARE", label: "Tiền thuê xe", amount: baseRental },
  ];
  if (longAmount) items.push({ code: "LONG_RENTAL_DISCOUNT", label: "Giảm thuê dài ngày", amount: -longAmount });
  if (deliveryAmount) items.push({ code: "DELIVERY_FEE", label: "Phí giao xe", amount: deliveryAmount });
  if (insurance) items.push({ code: "INSURANCE", label: "Bảo hiểm", amount: insurance });
  if (platformFee) items.push({ code: "PLATFORM_FEE", label: "Phí nền tảng", amount: platformFee });
  if (tax) items.push({ code: "TAX", label: "Thuế", amount: tax });
  if (discount) items.push({ code: "PROMOTION", label: "Ưu đãi", amount: -discount });

  return {
    subType: context.vehicleId || "SELF_DRIVE",
    items,
    subtotal: Math.round(baseRental + deliveryAmount + insurance),
    multiplier: 1,
    platformFee,
    discount: longAmount + discount,
    finalFare,
    deposit,
    amountPayableNow: finalFare + deposit,
    distanceKm: deliveryDistanceKm,
    durationSeconds: Math.round(hours * 3600),
    metadata: {
      fullDays,
      remainingHours: Number(remainingHours.toFixed(2)),
      hours: Number(hours.toFixed(2)),
      depositPaymentMode: rules.depositPaymentMode || "ONLINE",
      pickupMode,
    },
  };
};

export const finalizeSelfDrive = ({ quoted, actualContext = {}, plan }) => {
  const rules = plan?.rules || {};
  const days = Number(quoted.metadata?.fullDays || 1);
  const mileage = extraMileageForRental({
    includedKmPerDay: rules.includedKmPerDay || actualContext.includedKmPerDay || 0,
    days,
    usedKm: actualContext.usedKm || 0,
    pricePerExtraKm: rules.pricePerExtraKm || actualContext.pricePerExtraKm || 0,
    enabled: Boolean(rules.extraMileageRule?.enabled || actualContext.enabledMileage),
  });
  const lateHours = Math.max(
    0,
    (new Date(actualContext.actualReturnAt) - new Date(actualContext.scheduledEndAt || 0)) / 3600000
  );
  const lateReturnFee = actualContext.actualReturnAt
    ? Math.round(lateHours * Number(rules.lateFeePerHour || actualContext.lateFeePerHour || 0))
    : 0;
  const adjustments = [
    { code: "EXTRA_MILEAGE", amount: mileage.amount },
    { code: "LATE_RETURN", amount: lateReturnFee },
    { code: "FUEL", amount: Math.round(actualContext.fuelFee || 0) },
    { code: "CHARGING", amount: Math.round(actualContext.chargingFee || 0) },
    { code: "CLEANING", amount: Math.round(actualContext.cleaningFee || 0) },
    { code: "DAMAGE", amount: Math.round(actualContext.damageFee || 0) },
  ].filter((a) => a.amount);
  const extra = adjustments.reduce((s, a) => s + a.amount, 0);
  return {
    quotedFare: quoted.finalFare,
    adjustments,
    finalFare: quoted.finalFare + extra,
  };
};

export const quoteSelfDrive = async ({ context, now = new Date() }) => {
  const plan = context.plan || (await getActivePlan({ service: "SELF_DRIVE", subType: null, at: now }));
  return { plan: plan || { rules: {}, rounding: "NEAREST" }, computed: await computeSelfDrive({ context, plan: plan || { rules: {} } }) };
};
