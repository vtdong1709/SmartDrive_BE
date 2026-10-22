import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldApplyPayment } from "../services/paymentRules.js";

describe("payment webhook idempotency", () => {
  it("second webhook on already PAID booking is ignored", () => {
    assert.equal(shouldApplyPayment({ paymentStatus: "PAID" }), false);
  });

  it("first webhook on pending booking is applied", () => {
    assert.equal(shouldApplyPayment({ paymentStatus: "PENDING" }), true);
  });
});
