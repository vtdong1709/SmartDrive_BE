import PricingQuote from "../models/PricingQuote.js";
import { ERROR_CODE } from "../constants.js";
import { pricingError } from "../httpError.js";

export const toPublicQuote = ({ service, computed, plan, expiresAt, quoteId }) => ({
  quoteId: quoteId || null,
  service,
  subType: computed.subType,
  currency: plan?.currency || "VND",
  baseFare: computed.items?.find((i) => i.code === "BASE_FARE")?.amount || 0,
  items: computed.items || [],
  subtotal: computed.subtotal,
  multiplier: computed.multiplier,
  platformFee: computed.platformFee,
  discount: computed.discount,
  finalFare: computed.finalFare,
  deposit: computed.deposit || 0,
  amountPayableNow: computed.amountPayableNow ?? computed.finalFare + (computed.deposit || 0),
  distanceKm: computed.distanceKm ?? null,
  durationSeconds: computed.durationSeconds ?? null,
  expiresAt,
  pricingVersionId: plan?._id ? String(plan._id) : null,
  metadata: computed.metadata || {},
});

export const persistQuote = async ({ userId, service, computed, plan, inputSnapshot, expiresAt }) => {
  return PricingQuote.create({
    userId: userId || null,
    service,
    subType: computed.subType,
    pricingVersionId: plan?._id ? String(plan._id) : null,
    inputSnapshot,
    items: computed.items,
    subtotal: computed.subtotal,
    multiplier: computed.multiplier,
    platformFee: computed.platformFee,
    discount: computed.discount,
    finalFare: computed.finalFare,
    deposit: computed.deposit || 0,
    amountPayableNow: computed.amountPayableNow,
    distanceKm: computed.distanceKm,
    durationSeconds: computed.durationSeconds,
    metadata: computed.metadata,
    expiresAt,
  });
};

export const loadQuote = async (quoteId) => {
  if (!quoteId) throw pricingError("Thiếu quoteId", 400, ERROR_CODE.QUOTE_NOT_FOUND);
  const or = [{ quoteCode: quoteId }];
  if (String(quoteId).match(/^[a-f0-9]{24}$/i)) or.push({ _id: quoteId });
  const quote = await PricingQuote.findOne({ $or: or });
  if (!quote) throw pricingError("Không tìm thấy quote", 404, ERROR_CODE.QUOTE_NOT_FOUND);
  return quote;
};

export const assertQuoteUsable = (quote, { userId, service, now = new Date() } = {}) => {
  if (!quote) throw pricingError("Không tìm thấy quote", 404, ERROR_CODE.QUOTE_NOT_FOUND);
  if (quote.consumedAt) throw pricingError("Quote đã được dùng", 400, ERROR_CODE.QUOTE_ALREADY_CONSUMED);
  if (new Date(quote.expiresAt) <= now) throw pricingError("Quote đã hết hạn", 400, ERROR_CODE.QUOTE_EXPIRED);
  if (userId && quote.userId && String(quote.userId) !== String(userId)) {
    throw pricingError("Quote không thuộc user hiện tại", 403, ERROR_CODE.QUOTE_USER_MISMATCH);
  }
  if (service && quote.service !== service) {
    throw pricingError("Quote không đúng dịch vụ", 400, ERROR_CODE.QUOTE_SERVICE_MISMATCH);
  }
  return true;
};

export const consumeQuote = async ({ quoteId, userId, service }) => {
  const quote = await loadQuote(quoteId);
  assertQuoteUsable(quote, { userId, service });
  quote.consumedAt = new Date();
  await quote.save();
  console.log("[pricing] pricing_quote_consumed", quote.quoteCode);
  return quote;
};

export const snapshotFromQuote = (quote) => ({
  quoteId: quote.quoteCode || quote._id,
  pricingVersionId: quote.pricingVersionId,
  items: quote.items,
  subtotal: quote.subtotal,
  discount: quote.discount,
  platformFee: quote.platformFee,
  finalFare: quote.finalFare,
  deposit: quote.deposit,
});
