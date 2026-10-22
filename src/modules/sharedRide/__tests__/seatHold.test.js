import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findOverlapping, segmentsOverlap } from "../services/occupancyMath.js";

const claimAgainstList = (list, seatId, start, end, now = new Date()) => {
  const active = list.filter((row) => {
    if (row.status === "HELD" && row.expiresAt && new Date(row.expiresAt) <= now) return false;
    return ["HELD", "CONFIRMED"].includes(row.status);
  });
  if (findOverlapping(active, seatId, start, end).length) {
    throw new Error("conflict");
  }
  const row = { seatId, pickupDistance: start, dropoffDistance: end, status: "HELD", expiresAt: new Date(now.getTime() + 10 * 60 * 1000) };
  list.push(row);
  return row;
};

describe("seat hold concurrency rules", () => {
  it("user B cannot hold same seat on overlapping segment", () => {
    const ledger = [];
    claimAgainstList(ledger, "A1", 0, 100);
    assert.throws(() => claimAgainstList(ledger, "A1", 50, 150), /conflict/);
  });

  it("after hold expires, user B can book the seat", () => {
    const now = new Date();
    const ledger = [
      {
        seatId: "A1",
        pickupDistance: 0,
        dropoffDistance: 100,
        status: "HELD",
        expiresAt: new Date(now.getTime() - 1000),
      },
    ];
    const next = claimAgainstList(ledger, "A1", 0, 100, now);
    assert.equal(next.status, "HELD");
  });

  it("non-overlap after expiry boundary still uses half-open rule", () => {
    assert.equal(segmentsOverlap(0, 80, 80, 160), false);
  });
});
