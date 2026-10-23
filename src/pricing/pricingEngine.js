import { ERROR_CODE, PRICING_SERVICE, getQuoteTtlSeconds } from "./constants.js";
import { pricingError } from "./httpError.js";
import { quoteDriverBooking } from "./strategies/driverBookingPricing.js";
import { quoteRideHailing } from "./strategies/rideHailingPricing.js";
import { finalizeSelfDrive, quoteSelfDrive } from "./strategies/selfDrivePricing.js";
import { quoteDelivery } from "./strategies/deliveryPricing.js";
import { quoteRoadside } from "./strategies/roadsidePricing.js";
import { finalizeParking, quoteParking } from "./strategies/parkingPricing.js";
import { persistQuote, consumeQuote as consumeStoredQuote, toPublicQuote } from "./services/quoteService.js";

const STRATEGIES = {
  [PRICING_SERVICE.DRIVER_BOOKING]: quoteDriverBooking,
  [PRICING_SERVICE.RIDE_HAILING]: quoteRideHailing,
  [PRICING_SERVICE.SELF_DRIVE]: quoteSelfDrive,
  [PRICING_SERVICE.DELIVERY]: quoteDelivery,
  [PRICING_SERVICE.ROADSIDE_ASSISTANCE]: quoteRoadside,
  [PRICING_SERVICE.PARKING]: quoteParking,
};

export const computeOnly = async ({ service, context = {}, now = new Date() }) => {
  if (service === "SHARED_RIDE") {
    throw pricingError("Xe ghép không dùng Pricing Engine", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  }
  const fn = STRATEGIES[service];
  if (!fn) throw pricingError("Service pricing không hỗ trợ", 400, ERROR_CODE.INVALID_PRICING_INPUT);
  const { plan, computed } = await fn({ context, now });
  return { plan, computed };
};

export const createQuote = async ({ service, context = {}, userId = null, persist = true, now = new Date() }) => {
  const { plan, computed } = await computeOnly({ service, context, now });
  const ttl = plan?.quoteTtlSeconds || getQuoteTtlSeconds(service);
  const publicQuote = toPublicQuote({
    service,
    computed,
    plan,
    expiresAt: new Date(now.getTime() + ttl * 1000),
  });
  if (persist !== false && context.persist !== false) {
    const saved = await persistQuote({
      userId,
      service,
      computed,
      plan,
      inputSnapshot: context,
      expiresAt: publicQuote.expiresAt,
    });
    publicQuote.quoteId = saved.quoteCode || String(saved._id);
    publicQuote.id = saved._id;
  }
  console.log("[pricing] pricing_quote_created", { service, subType: computed.subType, finalFare: computed.finalFare });
  return publicQuote;
};

export const consumeQuote = async ({ quoteId, userId, service }) => consumeStoredQuote({ quoteId, userId, service });

export const finalizePricing = async ({ service, quoted, actualContext = {}, plan }) => {
  let result = { quotedFare: quoted.finalFare, adjustments: [], finalFare: quoted.finalFare };
  if (service === PRICING_SERVICE.SELF_DRIVE) result = finalizeSelfDrive({ quoted, actualContext, plan });
  if (service === PRICING_SERVICE.PARKING) result = finalizeParking({ quoted, actualContext, plan });
  if (service === PRICING_SERVICE.RIDE_HAILING && actualContext.settleWaiting) {
    const { computeRideHailing } = await import("./strategies/rideHailingPricing.js");
    const recomputed = await computeRideHailing({
      context: { ...quoted.inputSnapshot, ...actualContext, settleWaiting: true },
      plan: plan || { rules: quoted.metadata?.rules || {}, rounding: "NEAREST" },
    });
    result = {
      quotedFare: quoted.finalFare,
      adjustments: [{ code: "WAITING_FEE", amount: recomputed.metadata.waitingFee || 0 }],
      finalFare: recomputed.finalFare,
    };
  }
  console.log("[pricing] pricing_finalize", { service, quotedFare: result.quotedFare, finalFare: result.finalFare });
  return { originalQuote: quoted, ...result };
};
