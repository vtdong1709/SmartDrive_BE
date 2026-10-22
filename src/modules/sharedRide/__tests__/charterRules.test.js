import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canCharterExistingTrip, isTimeInWindows } from "../services/charterRules.js";

describe("charter rules", () => {
  it("rejects time outside driver availability", () => {
    const at = new Date("2026-10-22T10:00:00+07:00");
    assert.equal(isTimeInWindows(at, [{ start: "18:00", end: "23:00" }]), false);
  });

  it("accepts time inside driver availability", () => {
    const at = new Date("2026-10-22T20:00:00+07:00");
    assert.equal(isTimeInWindows(at, [{ start: "18:00", end: "23:00" }]), true);
  });

  it("rejects charter of a trip that already has confirmed passengers", () => {
    const gate = canCharterExistingTrip({
      trip: { allowCharter: true },
      confirmedSeatCount: 1,
    });
    assert.equal(gate.ok, false);
    assert.equal(gate.reason, "trip_has_confirmed_passengers");
  });

  it("allows charter of empty trip that accepts charter", () => {
    const gate = canCharterExistingTrip({
      trip: { allowCharter: true },
      confirmedSeatCount: 0,
    });
    assert.equal(gate.ok, true);
  });
});
