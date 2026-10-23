import RideBooking from "../models/RideBooking.js";
import RideQuote from "../models/RideQuote.js";
import RideDriverOffer from "../models/RideDriverOffer.js";
import RideHailingVehicle from "../models/RideHailingVehicle.js";
import RideRating from "../models/RideRating.js";
import DriverProfile from "../../../models/DriverProfile.js";
import User from "../../../models/User.js";
import {
  BOOKING_TYPE,
  ERROR_CODE,
  getFreeWaitMinutes,
  getScheduleLeadMinutes,
  getWaitFeePerMin,
  OFFER_STATUS,
  PAYMENT_STATUS,
  RIDE_STATUS,
  getCommissionRate,
} from "../constants.js";
import { httpError, assertOwner } from "../httpError.js";
import { assertTransition } from "./stateMachine.js";
import { applyRidePayment, shouldApplyPayment } from "./paymentRules.js";
import { isQuoteFresh, computeFare, computeWaitingFee, computeEarnings, haversineKm } from "./fareMath.js";
import { getCategoryByCode } from "./categoryService.js";
import { sendOffersForRide } from "./matchingService.js";
import { emitRide, notifyUsers } from "./notify.js";
import { validateSchedule, shouldSearchScheduledNow } from "./scheduleRules.js";
import { generateRideOtp, hashRideOtp, otpExpiry, verifyRideOtp } from "./otpMath.js";
import { consumeQuote } from "../../../pricing/pricingEngine.js";
import { PRICING_SERVICE } from "../../../pricing/constants.js";

const pushHistory = (ride, status, by) => {
  ride.statusHistory.push({ status, at: new Date(), by });
};

export const createRideService = async (customerId, payload) => {
  let pricingSnapshot = null;
  if (payload.quoteId && String(payload.quoteId).startsWith("QT_")) {
    const consumed = await consumeQuote({
      quoteId: payload.quoteId,
      userId: customerId,
      service: PRICING_SERVICE.RIDE_HAILING,
    });
    pricingSnapshot = consumed;
  }

  const quote = pricingSnapshot
    ? await RideQuote.findOne({ pricingQuoteId: pricingSnapshot.quoteCode, customerId })
    : await RideQuote.findById(payload.quoteId || payload.rideQuoteId);
  if (!quote || String(quote.customerId) !== String(customerId)) {
    throw httpError("Quote không hợp lệ", 400, ERROR_CODE.QUOTE_EXPIRED);
  }
  if (!isQuoteFresh(quote.expiresAt)) throw httpError("Quote đã hết hạn", 400, ERROR_CODE.QUOTE_EXPIRED);

  const category = await getCategoryByCode(quote.categoryCode);
  if (!category) throw httpError("Loại xe không khả dụng", 400, ERROR_CODE.VEHICLE_CATEGORY_UNAVAILABLE);

  const bookingType = payload.bookingType || quote.bookingType || BOOKING_TYPE.IMMEDIATE;
  let scheduledAt = null;
  if (bookingType === BOOKING_TYPE.SCHEDULED) {
    scheduledAt = validateSchedule(payload.scheduledAt || quote.scheduledAt);
  }

  const shouldSearchNow =
    bookingType === BOOKING_TYPE.IMMEDIATE || shouldSearchScheduledNow(scheduledAt);

  const stops = [
    { type: "PICKUP", location: quote.pickup, sequence: 0 },
    ...quote.stops.map((s, i) => ({ type: "STOP", location: s, sequence: i + 1 })),
    { type: "DESTINATION", location: quote.destination, sequence: quote.stops.length + 1 },
  ];

  const ride = await RideBooking.create({
    customerId,
    vehicleCategoryId: category._id,
    categoryCode: category.code,
    bookingType,
    pickupLocation: quote.pickup,
    destinationLocation: quote.destination,
    stops,
    scheduledAt,
    estimatedDistance: quote.distanceKm,
    estimatedDuration: quote.durationMinutes,
    quotedFare: pricingSnapshot?.finalFare ?? quote.estimatedFare,
    fareBreakdown: pricingSnapshot
      ? { items: pricingSnapshot.items, finalFare: pricingSnapshot.finalFare }
      : quote.breakdown,
    paymentMethod: payload.paymentMethod || "vnpay",
    status: shouldSearchNow ? RIDE_STATUS.SEARCHING_DRIVER : RIDE_STATUS.QUOTE_READY,
    quoteId: quote._id,
    pricingQuoteId: pricingSnapshot?.quoteCode || payload.quoteId || null,
    pricingSnapshot: pricingSnapshot
      ? {
          quoteId: pricingSnapshot.quoteCode,
          items: pricingSnapshot.items,
          subtotal: pricingSnapshot.subtotal,
          platformFee: pricingSnapshot.platformFee,
          discount: pricingSnapshot.discount,
          finalFare: pricingSnapshot.finalFare,
        }
      : null,
    searchStartedAt: shouldSearchNow ? new Date() : null,
    statusHistory: [{ status: shouldSearchNow ? RIDE_STATUS.SEARCHING_DRIVER : RIDE_STATUS.QUOTE_READY, at: new Date(), by: "customer" }],
  });

  console.log("[rideHailing] ride_created", ride.rideCode);
  emitRide("ride.created", { rideId: ride._id, customerId, status: ride.status });

  if (shouldSearchNow) {
    emitRide("ride.searching_driver", { rideId: ride._id, customerId });
    const offers = await sendOffersForRide(ride, category);
    if (!offers.length && ride.offeredDriverIds.length === 0) {
      ride.status = RIDE_STATUS.NO_DRIVER_FOUND;
      pushHistory(ride, RIDE_STATUS.NO_DRIVER_FOUND, "system");
      await ride.save();
      throw httpError("Không tìm thấy tài xế phù hợp", 404, ERROR_CODE.NO_DRIVER_AVAILABLE);
    }
  }
  return ride;
};

export const acceptOfferService = async (offerId, driverId) => {
  const offer = await RideDriverOffer.findById(offerId);
  if (!offer) throw httpError("Không tìm thấy offer", 404);
  assertOwner(offer.driverId, driverId);
  if (offer.status !== OFFER_STATUS.PENDING || offer.expiresAt <= new Date()) {
    throw httpError("Offer đã hết hạn", 400, ERROR_CODE.OFFER_EXPIRED);
  }

  const assigned = await RideBooking.findOneAndUpdate(
    { _id: offer.rideId, driverId: null, status: RIDE_STATUS.SEARCHING_DRIVER },
    {
      $set: {
        driverId,
        status: RIDE_STATUS.DRIVER_ASSIGNED,
        vehicleId: (await RideHailingVehicle.findOne({ driverId }))?._id || null,
      },
      $push: { statusHistory: { status: RIDE_STATUS.DRIVER_ASSIGNED, at: new Date(), by: "driver" } },
    },
    { new: true }
  );

  if (!assigned) {
    offer.status = OFFER_STATUS.CANCELLED;
    await offer.save();
    throw httpError("Chuyến đã có tài xế nhận", 409, ERROR_CODE.RIDE_ALREADY_ASSIGNED);
  }

  offer.status = OFFER_STATUS.ACCEPTED;
  await offer.save();
  await RideDriverOffer.updateMany(
    { rideId: offer.rideId, _id: { $ne: offer._id }, status: OFFER_STATUS.PENDING },
    { $set: { status: OFFER_STATUS.CANCELLED } }
  );

  const otp = generateRideOtp();
  assigned.otpHash = await hashRideOtp(otp);
  assigned.otpExpiresAt = otpExpiry();
  assigned.status = RIDE_STATUS.DRIVER_EN_ROUTE;
  pushHistory(assigned, RIDE_STATUS.DRIVER_EN_ROUTE, "driver");
  await assigned.save();

  console.log("[rideHailing] offer_accepted / driver_assigned", assigned.rideCode);
  emitRide("ride.driver_assigned", { rideId: assigned._id, customerId: assigned.customerId, driverId });
  await notifyUsers({
    userIds: [assigned.customerId],
    title: "Đã tìm thấy tài xế",
    message: `Mã OTP nhận xe sẽ hiện trên chi tiết chuyến.`,
    meta: { rideId: assigned._id },
  });
  return { ride: assigned, otpForCustomerOnly: true };
};

export const rejectOfferService = async (offerId, driverId) => {
  const offer = await RideDriverOffer.findById(offerId);
  if (!offer) throw httpError("Không tìm thấy offer", 404);
  assertOwner(offer.driverId, driverId);
  offer.status = OFFER_STATUS.REJECTED;
  await offer.save();
  const ride = await RideBooking.findById(offer.rideId);
  if (ride?.status === RIDE_STATUS.SEARCHING_DRIVER) {
    const category = await getCategoryByCode(ride.categoryCode);
    if (category) await sendOffersForRide(ride, category);
  }
  return offer;
};

export const markArrivedService = async (rideId, driverId) => {
  const ride = await RideBooking.findById(rideId);
  if (!ride) throw httpError("Không tìm thấy chuyến", 404);
  assertOwner(ride.driverId, driverId);
  assertTransition(ride.status, RIDE_STATUS.DRIVER_ARRIVED);
  ride.status = RIDE_STATUS.DRIVER_ARRIVED;
  ride.driverArrivedAt = new Date();
  pushHistory(ride, RIDE_STATUS.DRIVER_ARRIVED, "driver");
  await ride.save();
  emitRide("ride.driver_arrived", { rideId: ride._id, customerId: ride.customerId, driverId });
  return ride;
};

export const verifyOtpAndStartService = async (rideId, driverId, otp) => {
  const ride = await RideBooking.findById(rideId);
  if (!ride) throw httpError("Không tìm thấy chuyến", 404);
  assertOwner(ride.driverId, driverId);
  if (![RIDE_STATUS.DRIVER_ARRIVED, RIDE_STATUS.WAITING_FOR_PASSENGER].includes(ride.status)) {
    throw httpError("Chưa đến điểm đón / chưa sẵn sàng OTP", 400, ERROR_CODE.INVALID_RIDE_STATE);
  }
  await verifyRideOtp({ otp, otpHash: ride.otpHash, otpExpiresAt: ride.otpExpiresAt });
  assertTransition(ride.status, RIDE_STATUS.IN_PROGRESS);
  ride.status = RIDE_STATUS.IN_PROGRESS;
  ride.tripStartedAt = new Date();
  pushHistory(ride, RIDE_STATUS.IN_PROGRESS, "driver");
  await ride.save();
  console.log("[rideHailing] otp_verified / trip_started", ride.rideCode);
  emitRide("ride.trip_started", { rideId: ride._id, customerId: ride.customerId, driverId });
  return ride;
};

export const completeRideService = async (rideId, driverId, payload = {}) => {
  const ride = await RideBooking.findById(rideId);
  if (!ride) throw httpError("Không tìm thấy chuyến", 404);
  assertOwner(ride.driverId, driverId);
  assertTransition(ride.status, RIDE_STATUS.COMPLETED);
  const category = await getCategoryByCode(ride.categoryCode);
  const actualDistance = Number(payload.actualDistance ?? ride.estimatedDistance);
  const actualDuration = Number(payload.actualDuration ?? ride.estimatedDuration);
  const waitingFee = computeWaitingFee({
    arrivedAt: ride.driverArrivedAt,
    startedAt: ride.tripStartedAt,
    freeMinutes: getFreeWaitMinutes(),
    perMinuteFee: getWaitFeePerMin(),
  });
  const breakdown = computeFare({
    distanceKm: actualDistance,
    durationMinutes: actualDuration,
    baseFare: category.baseFare,
    perKmRate: category.perKmRate,
    perMinuteRate: category.perMinuteRate,
    bookingFee: category.bookingFee,
    surgeMultiplier: category.surgeMultiplier || 1,
    minimumFare: category.minimumFare,
    waitingFee,
  });
  ride.actualDistance = actualDistance;
  ride.actualDuration = actualDuration;
  ride.finalFare = breakdown.estimatedFare;
  ride.fareBreakdown = { ...breakdown, waitingFee };
  ride.earnings = computeEarnings({ finalFare: ride.finalFare, commissionRate: getCommissionRate() });
  ride.status = RIDE_STATUS.COMPLETED;
  ride.tripCompletedAt = new Date();
  if (ride.paymentMethod === "cash") ride.paymentStatus = PAYMENT_STATUS.CASH_PENDING;
  pushHistory(ride, RIDE_STATUS.COMPLETED, "driver");
  await ride.save();
  console.log("[rideHailing] trip_completed", ride.rideCode, ride.finalFare);
  emitRide("ride.trip_completed", { rideId: ride._id, customerId: ride.customerId, driverId, finalFare: ride.finalFare });
  await notifyUsers({
    userIds: [ride.customerId],
    title: "Chuyến đi đã kết thúc",
    message: `Cước ${ride.finalFare}₫. Vui lòng thanh toán nếu chưa trả.`,
    type: "payment",
    meta: { rideId: ride._id },
  });
  return ride;
};

export const cancelRideService = async (rideId, user, reason) => {
  const ride = await RideBooking.findById(rideId);
  if (!ride) throw httpError("Không tìm thấy chuyến", 404);
  const isCustomer = String(ride.customerId) === String(user._id);
  const isDriver = ride.driverId && String(ride.driverId) === String(user._id);
  if (!isCustomer && !isDriver && !["admin", "staff"].includes(user.role)) {
    throw httpError("Không có quyền hủy chuyến", 403, ERROR_CODE.FORBIDDEN);
  }
  const next = isDriver ? RIDE_STATUS.CANCELLED_BY_DRIVER : RIDE_STATUS.CANCELLED_BY_CUSTOMER;
  assertTransition(ride.status, next);
  const category = await getCategoryByCode(ride.categoryCode);
  const afterAssign = [RIDE_STATUS.DRIVER_ASSIGNED, RIDE_STATUS.DRIVER_EN_ROUTE, RIDE_STATUS.DRIVER_ARRIVED, RIDE_STATUS.WAITING_FOR_PASSENGER].includes(ride.status);
  ride.status = next;
  ride.cancellationReason = reason || (isDriver ? "Tài xế hủy" : "Khách hủy");
  ride.cancelledBy = isDriver ? "driver" : "customer";
  ride.cancellationFee = afterAssign ? category?.cancellationFee || 0 : 0;
  pushHistory(ride, next, ride.cancelledBy);
  await ride.save();
  await RideDriverOffer.updateMany({ rideId, status: OFFER_STATUS.PENDING }, { $set: { status: OFFER_STATUS.CANCELLED } });
  emitRide("ride.cancelled", { rideId: ride._id, customerId: ride.customerId, driverId: ride.driverId, status: next });
  console.log("[rideHailing] ride_cancelled", ride.rideCode, ride.cancelledBy);
  return ride;
};

export const getRideForUser = async (rideId, user) => {
  const ride = await RideBooking.findById(rideId);
  if (!ride) throw httpError("Không tìm thấy chuyến", 404);
  const allowed =
    ["admin", "staff"].includes(user.role) ||
    String(ride.customerId) === String(user._id) ||
    (ride.driverId && String(ride.driverId) === String(user._id));
  if (!allowed) throw httpError("Không được xem chuyến này", 403, ERROR_CODE.FORBIDDEN);
  return ride;
};

export const customerOtpView = async (ride, user) => {
  if (String(ride.customerId) !== String(user._id)) return null;
  if (!ride.otpHash || !ride.otpExpiresAt || ride.otpExpiresAt <= new Date()) return null;
  return { hasOtp: true, expiresAt: ride.otpExpiresAt, hint: "OTP đã được tạo. Dùng API /rides/:id/otp để lấy mã." };
};

export const revealOtpForCustomer = async (rideId, user) => {
  const ride = await getRideForUser(rideId, user);
  if (String(ride.customerId) !== String(user._id)) throw httpError("Chỉ khách được xem OTP", 403, ERROR_CODE.FORBIDDEN);
  if (!ride.driverId) throw httpError("Chưa có tài xế", 400, ERROR_CODE.INVALID_RIDE_STATE);
  const otp = generateRideOtp();
  ride.otpHash = await hashRideOtp(otp);
  ride.otpExpiresAt = otpExpiry();
  await ride.save();
  return { otp, expiresAt: ride.otpExpiresAt };
};

export const serializeRide = async (ride, viewer) => {
  const assigned = Boolean(ride.driverId);
  let driver = null;
  let vehicle = null;
  if (assigned) {
    const user = await User.findById(ride.driverId).select("fullName avatar phone");
    vehicle = await RideHailingVehicle.findOne({ driverId: ride.driverId }).select("plate make model color kind seatCount");
    driver = user
      ? {
          displayName: user.fullName,
          avatar: user.avatar,
          phoneMasked: user.phone ? `${String(user.phone).slice(0, 3)}***${String(user.phone).slice(-2)}` : null,
        }
      : null;
  }
  let otp = undefined;
  if (viewer && String(ride.customerId) === String(viewer._id) && ride.driverId && ride.otpHash && ride.otpExpiresAt > new Date() && ride.status !== RIDE_STATUS.IN_PROGRESS && ride.status !== RIDE_STATUS.COMPLETED) {
    otp = { expiresAt: ride.otpExpiresAt, retrievePath: `/api/rides/${ride._id}/otp` };
  }
  return {
    id: ride._id,
    rideCode: ride.rideCode,
    status: ride.status,
    bookingType: ride.bookingType,
    categoryCode: ride.categoryCode,
    pickup: ride.pickupLocation,
    destination: ride.destinationLocation,
    stops: ride.stops,
    scheduledAt: ride.scheduledAt,
    estimatedDistance: ride.estimatedDistance,
    estimatedDuration: ride.estimatedDuration,
    quotedFare: ride.quotedFare,
    finalFare: ride.finalFare,
    fareBreakdown: ride.fareBreakdown,
    paymentMethod: ride.paymentMethod,
    paymentStatus: ride.paymentStatus,
    driver,
    vehicle,
    earnings: viewer && ride.driverId && String(ride.driverId) === String(viewer._id) ? ride.earnings : undefined,
    otp,
    createdAt: ride.createdAt,
  };
};

export const driverLocationForRide = async (ride) => {
  if (!ride.driverId) return null;
  const profile = await DriverProfile.findOne({ userId: ride.driverId });
  const coords = profile?.location?.coordinates;
  if (!coords) return null;
  const lat = coords[1];
  const lng = coords[0];
  const distanceKm = haversineKm(lat, lng, ride.pickupLocation.latitude, ride.pickupLocation.longitude);
  return {
    latitude: lat,
    longitude: lng,
    driverDistanceToPickup: Number(distanceKm.toFixed(2)),
    driverEtaMinutes: Number(((distanceKm / 25) * 60).toFixed(1)),
    updatedAt: profile.updatedAt,
  };
};

export const rateRideService = async (rideId, user, { stars, comment }) => {
  const ride = await getRideForUser(rideId, user);
  if (ride.status !== RIDE_STATUS.COMPLETED) throw httpError("Chỉ đánh giá chuyến đã hoàn thành", 400, ERROR_CODE.INVALID_RIDE_STATE);
  const toUserId = String(ride.customerId) === String(user._id) ? ride.driverId : ride.customerId;
  return RideRating.findOneAndUpdate(
    { rideId },
    { rideId, fromUserId: user._id, toUserId, stars, comment: comment || "" },
    { upsert: true, new: true }
  );
};

export const startScheduledSearches = async () => {
  const lead = getScheduleLeadMinutes() * 60 * 1000;
  const until = new Date(Date.now() + lead);
  const rides = await RideBooking.find({
    bookingType: BOOKING_TYPE.SCHEDULED,
    status: RIDE_STATUS.QUOTE_READY,
    scheduledAt: { $lte: until, $gte: new Date() },
  });
  for (const ride of rides) {
    ride.status = RIDE_STATUS.SEARCHING_DRIVER;
    ride.searchStartedAt = new Date();
    pushHistory(ride, RIDE_STATUS.SEARCHING_DRIVER, "system");
    await ride.save();
    const category = await getCategoryByCode(ride.categoryCode);
    if (category) await sendOffersForRide(ride, category);
    emitRide("ride.searching_driver", { rideId: ride._id, customerId: ride.customerId });
  }
  return rides.length;
};

export const listCustomerRides = async (customerId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    RideBooking.find({ customerId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    RideBooking.countDocuments({ customerId }),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
};

export const listDriverRides = async (driverId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    RideBooking.find({ driverId }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    RideBooking.countDocuments({ driverId }),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
};

export const listDriverOffers = async (driverId) =>
  RideDriverOffer.find({
    driverId,
    status: OFFER_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  }).sort({ offeredAt: -1 });

export const getDriverActiveRide = async (driverId) =>
  RideBooking.findOne({
    driverId,
    status: { $in: [RIDE_STATUS.DRIVER_ASSIGNED, RIDE_STATUS.DRIVER_EN_ROUTE, RIDE_STATUS.DRIVER_ARRIVED, RIDE_STATUS.WAITING_FOR_PASSENGER, RIDE_STATUS.IN_PROGRESS] },
  }).sort({ updatedAt: -1 });

export const driverEarningsSummary = async (driverId) => {
  const rides = await RideBooking.find({
    driverId,
    status: RIDE_STATUS.COMPLETED,
    "earnings.driverEarning": { $ne: null },
  }).select("finalFare earnings tripCompletedAt rideCode");
  const totalGross = rides.reduce((s, r) => s + Number(r.earnings?.grossFare || 0), 0);
  const totalFee = rides.reduce((s, r) => s + Number(r.earnings?.platformFee || 0), 0);
  const totalNet = rides.reduce((s, r) => s + Number(r.earnings?.driverEarning || 0), 0);
  return {
    trips: rides.length,
    grossFare: totalGross,
    platformFee: totalFee,
    driverEarning: totalNet,
    recent: rides.slice(0, 10),
  };
};

export const confirmRidePayment = async (ride, { amount, isSuccess }) => {
  const result = applyRidePayment(ride, { amount, isSuccess });
  await ride.save();
  return result;
};

export const adminListRides = async ({ status, page = 1, limit = 20 } = {}) => {
  const filter = status ? { status } : {};
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    RideBooking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    RideBooking.countDocuments(filter),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
};

export { shouldApplyPayment };
