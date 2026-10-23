import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import {
  computeEarnings,
  computeFare,
  computeWaitingFee,
  isQuoteFresh,
  routeDistanceKm,
} from "../services/fareMath.js";
import { isDriverEligible, isLocationFresh, vehicleMatchesCategory } from "../services/eligibility.js";
import { rankDrivers } from "../services/matchingMath.js";
import { assertTransition, canTransition, tryAssignDriver } from "../services/stateMachine.js";
import { applyRidePayment, shouldApplyPayment } from "../services/paymentRules.js";
import { isOfferExpired, verifyRideOtp } from "../services/otpMath.js";
import { shouldSearchScheduledNow, validateSchedule } from "../services/scheduleRules.js";
import { assertOwner } from "../httpError.js";

const car4 = { kind: "CAR", minSeats: 4, energyType: "gasoline" };
const ev4 = { kind: "EV", minSeats: 4, energyType: "electric" };
const bike = { kind: "MOTORBIKE", minSeats: 1 };

describe("quote calculation", () => {
  it("computes base + distance + time + booking fee with min fare", () => {
    const fare = computeFare({
      distanceKm: 5,
      durationMinutes: 12,
      baseFare: 15000,
      perKmRate: 12000,
      perMinuteRate: 400,
      bookingFee: 5000,
      surgeMultiplier: 1,
      minimumFare: 25000,
    });
    assert.equal(fare.distanceFare, 60000);
    assert.equal(fare.timeFare, 4800);
    assert.equal(fare.estimatedFare, 84800);
  });

  it("applies surge and discount", () => {
    const fare = computeFare({
      distanceKm: 2,
      durationMinutes: 5,
      baseFare: 10000,
      perKmRate: 5000,
      perMinuteRate: 300,
      bookingFee: 2000,
      surgeMultiplier: 1.5,
      minimumFare: 15000,
      discount: 3000,
    });
    assert.equal(fare.surgeMultiplier, 1.5);
    assert.equal(fare.discount, 3000);
    assert.ok(fare.estimatedFare >= 15000 - 3000);
  });
});

describe("category eligibility", () => {
  it("motorbike driver cannot take CAR_4", () => {
    assert.equal(vehicleMatchesCategory({ kind: "MOTORBIKE", seatCount: 2, energyType: "gasoline", active: true, verified: true }, car4), false);
  });

  it("CAR_4 requires non-electric car with >= 4 seats", () => {
    assert.equal(vehicleMatchesCategory({ kind: "CAR", seatCount: 4, energyType: "gasoline", active: true, verified: true }, car4), true);
    assert.equal(vehicleMatchesCategory({ kind: "CAR", seatCount: 4, energyType: "electric", active: true, verified: true }, car4), false);
    assert.equal(vehicleMatchesCategory({ kind: "CAR", seatCount: 2, energyType: "gasoline", active: true, verified: true }, car4), false);
  });

  it("EV_4 matches electric vehicles with enough seats", () => {
    assert.equal(vehicleMatchesCategory({ kind: "EV", seatCount: 4, energyType: "electric", active: true, verified: true }, ev4), true);
    assert.equal(vehicleMatchesCategory({ kind: "CAR", seatCount: 4, energyType: "electric", active: true, verified: true }, ev4), true);
    assert.equal(vehicleMatchesCategory({ kind: "MOTORBIKE", seatCount: 2, energyType: "electric", active: true, verified: true }, ev4), false);
  });

  it("bike matches MOTORBIKE only", () => {
    assert.equal(vehicleMatchesCategory({ kind: "MOTORBIKE", seatCount: 2, energyType: "gasoline", active: true, verified: true }, bike), true);
    assert.equal(vehicleMatchesCategory({ kind: "CAR", seatCount: 4, energyType: "gasoline", active: true, verified: true }, bike), false);
  });
});

describe("driver search", () => {
  const pickup = { lat: 10.77, lng: 106.7 };
  const now = Date.now();
  const drivers = [
    { driverId: "near", online: true, approved: true, suspended: false, busy: false, vehicleOk: true, lat: 10.772, lng: 106.701, locationUpdatedAt: now },
    { driverId: "far", online: true, approved: true, suspended: false, busy: false, vehicleOk: true, lat: 10.9, lng: 106.9, locationUpdatedAt: now },
    { driverId: "busy", online: true, approved: true, suspended: false, busy: true, vehicleOk: true, lat: 10.771, lng: 106.7, locationUpdatedAt: now },
  ];

  it("ranks nearest eligible driver within radius", () => {
    const ranked = rankDrivers({ drivers, pickup, radiusKm: 2, maxAgeMs: 120000, now });
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].driverId, "near");
  });

  it("returns empty when no driver in radius (no driver found)", () => {
    const ranked = rankDrivers({ drivers: [drivers[1]], pickup, radiusKm: 2, maxAgeMs: 120000, now });
    assert.equal(ranked.length, 0);
  });
});

describe("accept race condition", () => {
  it("second driver cannot claim assigned ride", () => {
    const ride = { driverId: null, status: "SEARCHING_DRIVER" };
    const first = tryAssignDriver(ride, "A");
    assert.equal(first.ok, true);
    ride.driverId = "A";
    ride.status = "DRIVER_ASSIGNED";
    const second = tryAssignDriver(ride, "B");
    assert.equal(second.ok, false);
    assert.equal(second.reason, "RIDE_ALREADY_ASSIGNED");
  });
});

describe("offer expiry", () => {
  it("pending offer past expiresAt is expired", () => {
    assert.equal(isOfferExpired({ status: "PENDING", expiresAt: new Date(Date.now() - 1000) }), true);
    assert.equal(isOfferExpired({ status: "PENDING", expiresAt: new Date(Date.now() + 10_000) }), false);
  });
});

describe("OTP", () => {
  it("rejects invalid OTP", async () => {
    const hash = await bcrypt.hash("123456", 10);
    await assert.rejects(
      () => verifyRideOtp({ otp: "000000", otpHash: hash, otpExpiresAt: new Date(Date.now() + 60_000) }),
      (e) => e.errorCode === "INVALID_OTP"
    );
  });

  it("accepts valid OTP", async () => {
    const hash = await bcrypt.hash("654321", 10);
    const ok = await verifyRideOtp({ otp: "654321", otpHash: hash, otpExpiresAt: new Date(Date.now() + 60_000) });
    assert.equal(ok, true);
  });

  it("rejects expired OTP", async () => {
    const hash = await bcrypt.hash("111111", 10);
    await assert.rejects(
      () => verifyRideOtp({ otp: "111111", otpHash: hash, otpExpiresAt: new Date(Date.now() - 1000) }),
      (e) => e.errorCode === "OTP_EXPIRED"
    );
  });
});

describe("state transitions", () => {
  it("cannot start trip from DRIVER_ASSIGNED without arrived/OTP", () => {
    assert.equal(canTransition("DRIVER_ASSIGNED", "IN_PROGRESS"), false);
    assert.throws(() => assertTransition("DRIVER_ASSIGNED", "IN_PROGRESS"), (e) => e.errorCode === "INVALID_RIDE_STATE");
  });

  it("allows arrived -> in progress after OTP", () => {
    assert.equal(canTransition("DRIVER_ARRIVED", "IN_PROGRESS"), true);
    assert.equal(canTransition("WAITING_FOR_PASSENGER", "IN_PROGRESS"), true);
    assert.equal(canTransition("IN_PROGRESS", "COMPLETED"), true);
  });
});

describe("cancellation", () => {
  it("customer can cancel while searching or assigned", () => {
    assert.equal(canTransition("SEARCHING_DRIVER", "CANCELLED_BY_CUSTOMER"), true);
    assert.equal(canTransition("DRIVER_EN_ROUTE", "CANCELLED_BY_CUSTOMER"), true);
    assert.equal(canTransition("DRIVER_ARRIVED", "CANCELLED_BY_CUSTOMER"), true);
  });

  it("cannot cancel after completed", () => {
    assert.equal(canTransition("COMPLETED", "CANCELLED_BY_CUSTOMER"), false);
    assert.equal(canTransition("IN_PROGRESS", "CANCELLED_BY_CUSTOMER"), false);
  });
});

describe("scheduled ride", () => {
  it("rejects past scheduledAt", () => {
    assert.throws(() => validateSchedule(new Date(Date.now() - 60_000)), (e) => e.errorCode === "SCHEDULE_TIME_INVALID");
  });

  it("starts search only within lead time", () => {
    const soon = new Date(Date.now() + 10 * 60 * 1000);
    const later = new Date(Date.now() + 3 * 60 * 60 * 1000);
    assert.equal(shouldSearchScheduledNow(soon, Date.now(), 20), true);
    assert.equal(shouldSearchScheduledNow(later, Date.now(), 20), false);
  });
});

describe("payment webhook idempotency", () => {
  it("second webhook on PAID ride is ignored", () => {
    const ride = { paymentStatus: "PAID", payment: { amount: 10000 } };
    assert.equal(shouldApplyPayment(ride), false);
    const result = applyRidePayment(ride, { amount: 10000, isSuccess: true });
    assert.equal(result.duplicate, true);
  });

  it("first webhook applies payment", () => {
    const ride = { paymentStatus: "PENDING", payment: {} };
    const result = applyRidePayment(ride, { amount: 50000, isSuccess: true });
    assert.equal(result.duplicate, false);
    assert.equal(result.ride.paymentStatus, "PAID");
  });
});

describe("final fare and waiting fee", () => {
  it("charges waiting after free minutes", () => {
    const arrivedAt = new Date("2026-10-22T08:00:00Z");
    const startedAt = new Date("2026-10-22T08:12:00Z");
    assert.equal(computeWaitingFee({ arrivedAt, startedAt, freeMinutes: 5, perMinuteFee: 3000 }), 21000);
  });

  it("recomputes final fare from actual distance/time + waiting", () => {
    const fare = computeFare({
      distanceKm: 8.2,
      durationMinutes: 22,
      baseFare: 15000,
      perKmRate: 12000,
      perMinuteRate: 400,
      bookingFee: 5000,
      waitingFee: 21000,
      surgeMultiplier: 1,
      minimumFare: 25000,
    });
    assert.equal(fare.waitingFee, 21000);
    assert.ok(fare.estimatedFare > 100000);
  });
});

describe("driver earnings", () => {
  it("splits platform fee from env commission", () => {
    const e = computeEarnings({ finalFare: 100000, commissionRate: 0.15 });
    assert.equal(e.grossFare, 100000);
    assert.equal(e.platformFee, 15000);
    assert.equal(e.driverEarning, 85000);
  });
});

describe("permission checks", () => {
  it("other user cannot act as owner", () => {
    assert.throws(() => assertOwner("driverA", "driverB"), (e) => e.statusCode === 403 && e.errorCode === "FORBIDDEN");
  });

  it("ineligible driver is filtered", () => {
    assert.equal(
      isDriverEligible({ online: true, approved: true, suspended: false, busy: false, locationFresh: false, vehicleOk: true }),
      false
    );
    assert.equal(isLocationFresh(Date.now() - 200000, 120000), false);
  });
});

describe("multiple stops", () => {
  it("sums haversine across pickup + stops + destination", () => {
    const km = routeDistanceKm([
      { lat: 10.77, lng: 106.7 },
      { lat: 10.78, lng: 106.71 },
      { lat: 10.8, lng: 106.72 },
    ]);
    assert.ok(km > 0);
    const direct = routeDistanceKm([
      { lat: 10.77, lng: 106.7 },
      { lat: 10.8, lng: 106.72 },
    ]);
    assert.ok(km >= direct);
  });
});

describe("quote expiry", () => {
  it("rejects stale quote", () => {
    assert.equal(isQuoteFresh(new Date(Date.now() - 1000)), false);
    assert.equal(isQuoteFresh(new Date(Date.now() + 60_000)), true);
  });
});
