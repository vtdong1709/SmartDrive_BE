import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRouteMetrics } from "../services/geoService.js";
import { matchPassengerToTrip } from "../services/geoService.js";

const routeABC = buildRouteMetrics([
  { latitude: 10.76, longitude: 106.66, address: "A" },
  { latitude: 10.80, longitude: 106.70, address: "C" },
  { latitude: 10.85, longitude: 106.75, address: "B" },
]);

const trip = {
  routePoints: routeABC,
  routeDistance: routeABC.at(-1).distanceFromOrigin,
  routeDuration: 3600,
  departureAt: new Date("2026-10-22T20:00:00.000Z"),
  maxPickupDeviationKm: 2,
  maxDropoffDeviationKm: 2,
};

describe("search route matching", () => {
  it("passenger C→B matches trip A→C→B", () => {
    const result = matchPassengerToTrip(
      trip,
      { lat: 10.80, lng: 106.70 },
      { lat: 10.85, lng: 106.75 }
    );
    assert.equal(result.ok, true);
    assert.ok(result.pickupMatch.distanceFromTripOrigin < result.dropoffMatch.distanceFromTripOrigin);
  });

  it("passenger B→C is rejected (wrong direction)", () => {
    const result = matchPassengerToTrip(
      trip,
      { lat: 10.85, lng: 106.75 },
      { lat: 10.80, lng: 106.70 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, "wrong_direction");
  });

  it("passenger too far from route is rejected", () => {
    const result = matchPassengerToTrip(
      trip,
      { lat: 21.02, lng: 105.84 },
      { lat: 21.03, lng: 105.85 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, "too_far");
  });
});
