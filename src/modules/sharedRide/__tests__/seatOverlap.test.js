import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findOverlapping, segmentsOverlap } from "../services/occupancyMath.js";

describe("seat segment overlap", () => {
  it("A→C then C→B on same seat is allowed (touching boundary)", () => {
    assert.equal(segmentsOverlap(0, 1, 1, 2), false);
  });

  it("A→C then A→B on same seat conflicts", () => {
    assert.equal(segmentsOverlap(0, 1, 0, 2), true);
  });

  it("findOverlapping treats confirmed A→C as conflict for A→B", () => {
    const occupancies = [
      { seatId: "A1", pickupDistance: 0, dropoffDistance: 100, status: "CONFIRMED" },
    ];
    const conflicts = findOverlapping(occupancies, "A1", 0, 200);
    assert.equal(conflicts.length, 1);
  });

  it("findOverlapping allows C→B after A→C", () => {
    const occupancies = [
      { seatId: "A1", pickupDistance: 0, dropoffDistance: 100, status: "CONFIRMED" },
    ];
    const conflicts = findOverlapping(occupancies, "A1", 100, 200);
    assert.equal(conflicts.length, 0);
  });

  it("expired hold is ignored", () => {
    const occupancies = [
      {
        seatId: "A1",
        pickupDistance: 0,
        dropoffDistance: 200,
        status: "HELD",
        expiresAt: new Date(Date.now() - 1000),
      },
    ];
    assert.equal(findOverlapping(occupancies, "A1", 0, 200).length, 0);
  });
});
