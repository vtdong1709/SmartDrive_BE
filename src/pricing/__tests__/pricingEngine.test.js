import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDriverBooking } from "../strategies/driverBookingPricing.js";
import { computeRideHailing } from "../strategies/rideHailingPricing.js";
import { computeSelfDrive, finalizeSelfDrive } from "../strategies/selfDrivePricing.js";
import { computeDelivery } from "../strategies/deliveryPricing.js";
import { computeRoadside } from "../strategies/roadsidePricing.js";
import { computeParking, finalizeParking } from "../strategies/parkingPricing.js";
import { applyCumulativeBrackets } from "../rules/distanceRule.js";
import { assertQuoteUsable } from "../services/quoteService.js";
import { getCommissionRate } from "../services/commissionService.js";
import { PRICING_SERVICE } from "../constants.js";

const weekday2130 = new Date("2026-10-21T21:30:00+07:00");

const driverPerKmPlan = {
  rounding: "NEAREST",
  rules: {
    baseFare: 50000,
    fareBrackets: [{ fromKm: 0, toKm: null, pricePerKm: 12000 }],
    multipliers: { after21h: 1.08, after23h: 1.12, weekend: 1.1, holiday: 1.15 },
    platformFee: { type: "FIXED", fixed: 30000 },
  },
};

describe("driver booking regression", () => {
  it("per_km 10km 21:30 weekday = 213600", async () => {
    const { computed } = { computed: await computeDriverBooking({
      context: { serviceType: "per_km", route: { distanceKm: 10, durationSeconds: 1200 }, startTime: weekday2130, holidays: [] },
      plan: driverPerKmPlan,
      now: weekday2130,
    }) };
    assert.equal(computed.finalFare, 213600);
    assert.equal(computed.multiplier, 1.08);
  });

  it("motorcycle uses single bracket like per_km", async () => {
    const computed = await computeDriverBooking({
      context: { serviceType: "motorcycle", route: { distanceKm: 5 }, startTime: new Date("2026-10-21T10:00:00+07:00"), holidays: [] },
      plan: driverPerKmPlan,
    });
    assert.equal(computed.finalFare, Math.round((50000 + 5 * 12000) * 1 + 30000));
  });

  it("intercity is cumulative from config brackets not hardcoded 70/100", async () => {
    const computed = await computeDriverBooking({
      context: { serviceType: "intercity", route: { distanceKm: 120 }, startTime: new Date("2026-10-21T10:00:00+07:00"), holidays: [] },
      plan: {
        rounding: "NEAREST",
        rules: {
          baseFare: 0,
          fareBrackets: [
            { fromKm: 0, toKm: 70, pricePerKm: 10000 },
            { fromKm: 70, toKm: 100, pricePerKm: 8000 },
            { fromKm: 100, toKm: null, pricePerKm: 6000 },
          ],
          multipliers: {},
          platformFee: { type: "FIXED", fixed: 0 },
        },
      },
    });
    assert.equal(computed.finalFare, 70 * 10000 + 30 * 8000 + 20 * 6000);
  });

  it("hourly 4h uses hour bracket", async () => {
    const start = new Date("2026-10-21T08:00:00+07:00");
    const end = new Date("2026-10-21T12:00:00+07:00");
    const computed = await computeDriverBooking({
      context: { serviceType: "hourly", startTime: start, endTime: end, holidays: [] },
      plan: {
        rounding: "NEAREST",
        rules: {
          baseFare: 10000,
          hourBrackets: [{ fromHour: 1, toHour: null, pricePerHour: 50000 }],
          multipliers: {},
          platformFee: { type: "FIXED", fixed: 0 },
        },
      },
    });
    assert.equal(computed.finalFare, 10000 + 4 * 50000);
  });

  it("hourly 5h rejected when only 4 or 8 allowed", async () => {
    const start = new Date("2026-10-21T08:00:00+07:00");
    const end = new Date("2026-10-21T13:00:00+07:00");
    await assert.rejects(
      () => computeDriverBooking({
        context: { serviceType: "hourly", startTime: start, endTime: end, holidays: [] },
        plan: driverPerKmPlan,
      }),
      (e) => e.errorCode === "INVALID_PRICING_INPUT"
    );
  });

  it("daily ceil hours/24 and 1-3 days", async () => {
    const start = new Date("2026-10-21T08:00:00+07:00");
    const end = new Date("2026-10-23T08:00:00+07:00");
    const computed = await computeDriverBooking({
      context: { serviceType: "daily", startTime: start, endTime: end, holidays: [] },
      plan: {
        rounding: "NEAREST",
        rules: {
          baseFare: 0,
          dayBrackets: [{ fromDay: 1, toDay: null, pricePerDay: 800000 }],
          multipliers: {},
          platformFee: { type: "FIXED", fixed: 0 },
        },
      },
    });
    assert.equal(computed.finalFare, 1600000);
  });

  it("after23 weekend holiday stack", async () => {
    const satNight = new Date("2026-10-24T23:30:00+07:00");
    const computed = await computeDriverBooking({
      context: {
        serviceType: "per_km",
        route: { distanceKm: 10 },
        startTime: satNight,
        holidays: ["2026-10-24"],
      },
      plan: driverPerKmPlan,
    });
    const expected = Math.round((50000 + 120000) * 1.12 * 1.1 * 1.15 + 30000);
    assert.equal(computed.finalFare, expected);
  });
});

describe("ride hailing", () => {
  it("cumulative 15km CAR_4", async () => {
    const computed = await computeRideHailing({
      context: { vehicleCategory: "CAR_4", route: { distanceKm: 15, durationSeconds: 0 } },
      plan: {
        rounding: "NEAREST",
        rules: {
          baseFare: 0,
          fareBrackets: [
            { fromKm: 0, toKm: 2, flatFee: 20000 },
            { fromKm: 2, toKm: 10, pricePerKm: 9000 },
            { fromKm: 10, toKm: null, pricePerKm: 7500 },
          ],
          pricePerMinute: 0,
          surgeMultiplier: 1,
          platformFee: { type: "FIXED", fixed: 0 },
        },
      },
    });
    assert.equal(computed.items.find((i) => i.code === "DISTANCE_FARE").amount, 20000 + 8 * 9000 + 5 * 7500);
    assert.equal(computed.finalFare, 129500);
  });

  it("applies surge and time fare", async () => {
    const computed = await computeRideHailing({
      context: { vehicleCategory: "CAR_4", route: { distanceKm: 2, durationSeconds: 600 }, surgeMultiplier: 1.2 },
      plan: {
        rounding: "NEAREST",
        rules: {
          baseFare: 15000,
          fareBrackets: [{ fromKm: 0, toKm: null, pricePerKm: 10000 }],
          pricePerMinute: 300,
          surgeMultiplier: 1,
          platformFee: { type: "FIXED", fixed: 0 },
        },
      },
    });
    assert.equal(computed.multiplier, 1.2);
    assert.ok(computed.items.find((i) => i.code === "TIME_FARE").amount > 0);
  });
});

describe("self drive", () => {
  it("36h = 1 day + 12 extra hours", async () => {
    const computed = await computeSelfDrive({
      context: {
        startAt: "2026-10-22T08:00:00+07:00",
        endAt: "2026-10-23T20:00:00+07:00",
        dailyRate: 850000,
        hourlyOverageRate: 40000,
        deposit: 5000000,
        includeInsurance: false,
      },
      plan: { rules: { platformFee: { fixed: 0 }, taxRate: 0 }, rounding: "NEAREST" },
    });
    assert.equal(computed.metadata.fullDays, 1);
    assert.equal(computed.metadata.remainingHours, 12);
    assert.equal(computed.finalFare, 850000 + 12 * 40000);
    assert.equal(computed.deposit, 5000000);
    assert.equal(computed.amountPayableNow, computed.finalFare + 5000000);
  });

  it("extra mileage settlement", () => {
    const result = finalizeSelfDrive({
      quoted: { finalFare: 1000000, metadata: { fullDays: 1 } },
      actualContext: { usedKm: 380, includedKmPerDay: 300, pricePerExtraKm: 3000, enabledMileage: true },
      plan: { rules: { extraMileageRule: { enabled: true }, includedKmPerDay: 300, pricePerExtraKm: 3000 } },
    });
    assert.equal(result.adjustments.find((a) => a.code === "EXTRA_MILEAGE").amount, 240000);
    assert.equal(result.finalFare, 1240000);
  });
});

describe("delivery", () => {
  it("distance + weight + express", async () => {
    const computed = await computeDelivery({
      context: { vehicleType: "MOTORBIKE", distanceKm: 8, weightKg: 8, deliverySpeed: "EXPRESS" },
      plan: {
        rounding: "NEAREST",
        rules: {
          baseFare: 15000,
          fareBrackets: [{ fromKm: 0, toKm: null, pricePerKm: 5000 }],
          distanceMode: "SINGLE",
          weightBrackets: [
            { fromKg: 0, toKg: 5, fee: 0 },
            { fromKg: 5, toKg: 20, fee: 20000 },
          ],
          speedMultipliers: { STANDARD: 1, EXPRESS: 1.3 },
          platformFee: { type: "FIXED", fixed: 0 },
        },
      },
    });
    assert.equal(computed.multiplier, 1.3);
    assert.equal(computed.finalFare, Math.round((15000 + 40000 + 20000) * 1.3));
  });
});

describe("roadside", () => {
  it("towing dispatch + travel + tow + vehicle modifier", async () => {
    const computed = await computeRoadside({
      context: {
        assistanceType: "TOWING",
        travelDistanceKm: 4,
        towingDistanceKm: 10,
        vehicleCategory: "SUV",
        startAt: new Date("2026-10-21T10:00:00+07:00"),
        holidays: [],
      },
      plan: {
        rounding: "NEAREST",
        types: { TOWING: { dispatchFee: 80000, travelRate: 10000, towingRate: 15000 } },
        rules: { vehicleModifiers: { SUV: 1.2 }, multipliers: {}, platformFee: { type: "FIXED", fixed: 0 } },
      },
      now: new Date("2026-10-21T10:00:00+07:00"),
    });
    assert.equal(computed.finalFare, Math.round((80000 + 40000 + 150000) * 1.2));
  });
});

describe("parking", () => {
  it("4 hours progressive 20000 + 2*8000 = 36000", async () => {
    const computed = await computeParking({
      context: {
        startAt: "2026-10-21T08:00:00+07:00",
        endAt: "2026-10-21T12:00:00+07:00",
        mode: "HOURLY",
      },
      plan: {
        rounding: "NEAREST",
        rules: {
          hourBrackets: [
            { fromHour: 0, toHour: 2, flatFee: 20000 },
            { fromHour: 2, toHour: null, pricePerHour: 8000 },
          ],
          platformFee: { type: "FIXED", fixed: 0 },
        },
      },
    });
    assert.equal(computed.finalFare, 36000);
  });

  it("overstay adds to quoted fare", () => {
    const result = finalizeParking({
      quoted: { finalFare: 36000, metadata: { endAt: "2026-10-21T12:00:00+07:00" } },
      actualContext: { actualExitAt: "2026-10-21T13:00:00+07:00", scheduledEndAt: "2026-10-21T12:00:00+07:00" },
      plan: { rules: { overstayPerHour: 10000 } },
    });
    assert.equal(result.finalFare, 46000);
  });
});

describe("quote security", () => {
  it("rejects expired / consumed / wrong user / wrong service", () => {
    const base = { userId: "U1", service: "DRIVER_BOOKING", expiresAt: new Date(Date.now() + 60000), consumedAt: null };
    assert.throws(() => assertQuoteUsable({ ...base, consumedAt: new Date() }, { userId: "U1" }), (e) => e.errorCode === "QUOTE_ALREADY_CONSUMED");
    assert.throws(() => assertQuoteUsable({ ...base, expiresAt: new Date(Date.now() - 1000) }, { userId: "U1" }), (e) => e.errorCode === "QUOTE_EXPIRED");
    assert.throws(() => assertQuoteUsable(base, { userId: "U2" }), (e) => e.errorCode === "QUOTE_USER_MISMATCH");
    assert.throws(() => assertQuoteUsable(base, { userId: "U1", service: "RIDE_HAILING" }), (e) => e.errorCode === "QUOTE_SERVICE_MISMATCH");
  });

  it("FE price is not used by engine compute", async () => {
    const computed = await computeDriverBooking({
      context: { serviceType: "per_km", route: { distanceKm: 10 }, startTime: weekday2130, holidays: [], price: 1 },
      plan: driverPerKmPlan,
    });
    assert.equal(computed.finalFare, 213600);
    assert.notEqual(computed.finalFare, 1);
  });
});

describe("commission", () => {
  it("uses BOOKING_COMMISSION_RATE not hardcoded 0.15", () => {
    assert.equal(getCommissionRate("20"), 0.2);
    assert.equal(getCommissionRate("15"), 0.15);
  });
});

describe("shared ride excluded", () => {
  it("engine service list does not include SHARED_RIDE", () => {
    assert.equal(PRICING_SERVICE.SHARED_RIDE, undefined);
    assert.ok(PRICING_SERVICE.DRIVER_BOOKING);
  });

  it("cumulative helper matches acceptance 15km", () => {
    const { amount } = applyCumulativeBrackets(15, [
      { fromKm: 0, toKm: 2, flatFee: 20000 },
      { fromKm: 2, toKm: 10, pricePerKm: 9000 },
      { fromKm: 10, toKm: null, pricePerKm: 7500 },
    ]);
    assert.equal(amount, 129500);
  });
});
