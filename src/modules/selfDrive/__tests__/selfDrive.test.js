import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bookingBlocksRequest,
  intervalsOverlap,
  isVehicleFreeForInterval,
} from "../services/availabilityMath.js";
import {
  computeQuote,
  computeReturnCharges,
  isWithinDeliveryRadius,
} from "../services/quoteMath.js";
import { assertTransition, canTransition, shouldApplyPayment } from "../services/stateMachine.js";
import { assertOwner } from "../httpError.js";

describe("booking interval overlap", () => {
  it("overlaps when ranges intersect", () => {
    assert.equal(intervalsOverlap(10, 20, 15, 25), true);
  });

  it("exact boundary is NOT overlap", () => {
    assert.equal(intervalsOverlap(10, 20, 20, 30), false);
    assert.equal(
      bookingBlocksRequest({
        existingStart: "2026-10-22T10:00:00Z",
        existingEnd: "2026-10-22T12:00:00Z",
        requestedStart: "2026-10-22T12:00:00Z",
        requestedEnd: "2026-10-22T14:00:00Z",
        turnaroundMinutes: 0,
      }),
      false
    );
  });

  it("turnaround buffer makes touching intervals conflict", () => {
    assert.equal(
      bookingBlocksRequest({
        existingStart: "2026-10-22T10:00:00Z",
        existingEnd: "2026-10-22T12:00:00Z",
        requestedStart: "2026-10-22T12:00:00Z",
        requestedEnd: "2026-10-22T14:00:00Z",
        turnaroundMinutes: 60,
      }),
      true
    );
  });
});

describe("search exclusion", () => {
  it("excludes car already booked in interval", () => {
    const free = isVehicleFreeForInterval({
      requestedStart: "2026-10-22T10:00:00Z",
      requestedEnd: "2026-10-22T18:00:00Z",
      bookings: [{ startAt: "2026-10-22T08:00:00Z", endAt: "2026-10-22T12:00:00Z" }],
      blocks: [],
      windows: [],
      turnaroundMinutes: 0,
    });
    assert.equal(free, false);
  });
});

describe("instant vs request", () => {
  it("instant booking starts at AWAITING_PAYMENT", () => {
    assert.equal(canTransition("AWAITING_PAYMENT", "CONFIRMED"), true);
  });

  it("request-to-book can be approved then paid", () => {
    assert.equal(canTransition("PENDING_OWNER_APPROVAL", "AWAITING_PAYMENT"), true);
    assert.equal(canTransition("PENDING_OWNER_APPROVAL", "REJECTED"), true);
  });
});

describe("owner permission", () => {
  it("other owner cannot edit vehicle", () => {
    assert.throws(() => assertOwner("ownerA", "ownerB"), (e) => e.statusCode === 403);
  });
});

describe("delivery radius", () => {
  it("rejects destination outside radius", () => {
    assert.equal(
      isWithinDeliveryRadius({
        vehicleLat: 10.76,
        vehicleLng: 106.66,
        destLat: 21.02,
        destLng: 105.84,
        radiusKm: 10,
      }),
      false
    );
  });

  it("accepts nearby delivery", () => {
    assert.equal(
      isWithinDeliveryRadius({
        vehicleLat: 10.76,
        vehicleLng: 106.66,
        destLat: 10.77,
        destLng: 106.67,
        radiusKm: 10,
      }),
      true
    );
  });
});

describe("quote accuracy", () => {
  it("computes 2 full days + long discount 5%", () => {
    const q = computeQuote({
      dailyPrice: 1000000,
      hourlyOveragePrice: 0,
      startAt: "2026-10-22T08:00:00Z",
      endAt: "2026-10-25T08:00:00Z",
      deliveryFee: 50000,
      insuranceDaily: 20000,
      platformFee: 10000,
      taxRate: 0,
      longDiscountRules: [{ minDays: 3, rate: 0.05 }],
    });
    assert.equal(q.fullDays, 3);
    assert.equal(q.baseRental, 3000000);
    assert.equal(q.longRentalDiscount, 150000);
    assert.equal(q.insurance, 60000);
    assert.equal(q.delivery, 50000);
    assert.equal(q.fees, 10000);
    assert.equal(q.total, 2970000);
  });
});

describe("payment webhook idempotency", () => {
  it("ignores second webhook when already PAID", () => {
    assert.equal(shouldApplyPayment({ paymentStatus: "PAID" }), false);
  });
});

describe("handover transition", () => {
  it("IN_USE only from READY_FOR_PICKUP", () => {
    assert.equal(canTransition("READY_FOR_PICKUP", "IN_USE"), true);
    assert.equal(canTransition("AWAITING_PAYMENT", "IN_USE"), false);
    assert.throws(() => assertTransition("CONFIRMED", "IN_USE"), (e) => e.statusCode === 400);
  });
});

describe("return additional charges", () => {
  it("computes excess mileage and late fee", () => {
    const charges = computeReturnCharges({
      includedKm: 200,
      usedKm: 250,
      excessMileagePrice: 5000,
      scheduledEndAt: "2026-10-22T18:00:00Z",
      actualReturnAt: "2026-10-22T20:00:00Z",
      lateFeePerHour: 100000,
      fuelFee: 50000,
      damageFee: 0,
    });
    assert.equal(charges.excessKm, 50);
    assert.equal(charges.excessMileage, 250000);
    assert.equal(charges.lateHours, 2);
    assert.equal(charges.lateFee, 200000);
    assert.equal(charges.fuelFee, 50000);
    assert.equal(charges.total, 500000);
  });
});
