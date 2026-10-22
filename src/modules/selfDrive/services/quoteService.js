import { getPlatformFee, getTaxRate } from "../constants.js";
import { httpError } from "../httpError.js";
import { computeQuote, haversineKm, isWithinDeliveryRadius } from "./quoteMath.js";
import { getPublicVehicleService } from "./vehicleService.js";
import { assertVehicleAvailable } from "./availabilityService.js";

export const buildDeliveryFee = (vehicle, deliveryLocation) => {
  if (!deliveryLocation) return { eligible: true, fee: 0, distanceKm: 0 };
  if (!vehicle.deliveryEnabled) throw httpError("Xe này không hỗ trợ giao xe", 400);
  const [lng, lat] = vehicle.location.geo.coordinates;
  const destLat = Number(deliveryLocation.lat ?? deliveryLocation.latitude);
  const destLng = Number(deliveryLocation.lng ?? deliveryLocation.longitude);
  const eligible = isWithinDeliveryRadius({
    vehicleLat: lat,
    vehicleLng: lng,
    destLat,
    destLng,
    radiusKm: vehicle.deliveryRadius,
  });
  if (!eligible) throw httpError("Địa điểm giao xe nằm ngoài bán kính cho phép", 400);
  const distanceKm = haversineKm(lat, lng, destLat, destLng);
  const fee = Math.round(
    Number(vehicle.deliveryPricing?.baseFee || 0) +
      distanceKm * Number(vehicle.deliveryPricing?.perKm || 0)
  );
  return { eligible: true, fee, distanceKm: Number(distanceKm.toFixed(2)) };
};

export const quoteVehicleService = async (vehicleId, payload) => {
  const { startAt, endAt, deliveryLocation, includeInsurance = true } = payload;
  if (!startAt || !endAt) throw httpError("Thiếu startAt hoặc endAt", 400);
  if (!(new Date(startAt) < new Date(endAt))) throw httpError("startAt phải nhỏ hơn endAt", 400);

  const vehicle = await getPublicVehicleService(vehicleId);
  await assertVehicleAvailable(vehicle, startAt, endAt);
  const delivery = deliveryLocation ? buildDeliveryFee(vehicle, deliveryLocation) : { fee: 0, distanceKm: 0, eligible: true };

  const quote = computeQuote({
    dailyPrice: vehicle.dailyPrice,
    hourlyOveragePrice: vehicle.hourlyOveragePrice,
    startAt,
    endAt,
    deliveryFee: delivery.fee,
    insuranceDaily: includeInsurance ? vehicle.insuranceDaily : 0,
    platformFee: getPlatformFee(),
    taxRate: getTaxRate(),
    longDiscountRules: vehicle.longDiscountRules,
  });

  return {
    vehicleId: vehicle._id,
    startAt,
    endAt,
    delivery,
    depositAmount: vehicle.depositAmount,
    quote,
    note: "Deposit không nằm trong total. Thanh toán thuê xe và cọc tách biệt.",
  };
};
