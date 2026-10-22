import { PRICING_MODE } from "../constants.js";
import { httpError } from "../httpError.js";

export const quoteSeatPrice = ({ trip, seat, passengerDistance, start, end }) => {
  const modifier = Number(seat?.priceModifier || 0);
  let base = Number(trip.baseSeatPrice || 0);

  if (trip.pricingMode === PRICING_MODE.DISTANCE_BASED) {
    const perKm = Number(trip.pricePerKm || 0);
    if (perKm > 0) {
      base = Math.round((passengerDistance / 1000) * perKm);
    } else if (trip.routeDistance > 0) {
      base = Math.round((passengerDistance / trip.routeDistance) * Number(trip.baseSeatPrice || 0));
    }
  } else if (trip.pricingMode === PRICING_MODE.SEGMENT_BASED) {
    base = findSegmentPrice(trip, start, end) ?? base;
  }

  return Math.max(0, Math.round(base + modifier));
};

export const findSegmentPrice = (trip, start, end) => {
  const segments = trip.segmentPrices || [];
  if (!segments.length) return null;

  const exactDistance = segments.find(
    (seg) =>
      seg.fromDistance != null &&
      seg.toDistance != null &&
      Math.abs(seg.fromDistance - start) < 50 &&
      Math.abs(seg.toDistance - end) < 50
  );
  if (exactDistance) return exactDistance.price;

  const covering = segments
    .filter((seg) => {
      const from = seg.fromDistance ?? 0;
      const to = seg.toDistance ?? Number.MAX_SAFE_INTEGER;
      return from <= start && to >= end;
    })
    .sort((a, b) => (a.toDistance - a.fromDistance) - (b.toDistance - b.fromDistance));
  if (covering[0]) return covering[0].price;

  const overlapping = segments.filter((seg) => {
    const from = seg.fromDistance ?? 0;
    const to = seg.toDistance ?? 0;
    return from < end && start < to;
  });
  if (overlapping.length) {
    return overlapping.reduce((sum, seg) => sum + Number(seg.price || 0), 0);
  }
  return null;
};

export const buildQuote = ({ trip, seats, pickup, dropoff }) => {
  const start = pickup.distanceFromOrigin;
  const end = dropoff.distanceFromOrigin;
  if (!(start < end)) {
    throw httpError("Điểm đón phải nằm trước điểm trả", 400);
  }

  const passengerDistance = end - start;
  const seatPrices = seats.map((seat) => {
    let base = Number(trip.baseSeatPrice || 0);
    if (trip.pricingMode === PRICING_MODE.DISTANCE_BASED) {
      const perKm = Number(trip.pricePerKm || 0);
      base = perKm > 0
        ? Math.round((passengerDistance / 1000) * perKm)
        : Math.round((passengerDistance / Math.max(trip.routeDistance, 1)) * Number(trip.baseSeatPrice || 0));
    } else if (trip.pricingMode === PRICING_MODE.SEGMENT_BASED) {
      base = findSegmentPrice(trip, start, end) ?? base;
    }
    const modifier = Number(seat.priceModifier || 0);
    const price = Math.max(0, Math.round(base + modifier));
    return {
      seatId: seat._id,
      code: seat.code,
      base,
      modifier,
      price,
    };
  });

  const seatsTotal = seatPrices.reduce((sum, s) => sum + s.price, 0);
  const platformFee = Number(trip.platformFee || 0);
  const total = seatsTotal + platformFee;

  return {
    pricingMode: trip.pricingMode,
    routeDistance: trip.routeDistance,
    passengerDistance,
    passengerDistanceKm: Number((passengerDistance / 1000).toFixed(2)),
    basePrice: Number(trip.baseSeatPrice || 0),
    seatPrices,
    fees: { platformFee },
    discount: 0,
    total,
  };
};

export const quoteCharterPrice = ({ vehicle, trip, passengerCount, distanceMeters }) => {
  if (trip?.charterPrice) {
    return {
      total: Math.round(Number(trip.charterPrice)),
      source: "trip.charterPrice",
      passengerCount,
    };
  }
  const bookable = (vehicle?.seats || []).filter((s) => s.isBookable && s.enabled !== false).length;
  const base = trip?.baseSeatPrice || 0;
  let total = Math.round(base * Math.max(bookable, passengerCount || 1));
  if (trip?.pricingMode === PRICING_MODE.DISTANCE_BASED && trip.pricePerKm && distanceMeters) {
    total = Math.round((distanceMeters / 1000) * trip.pricePerKm * Math.max(bookable, 1));
  }
  return {
    total,
    source: "estimated",
    passengerCount,
    seats: bookable,
  };
};
