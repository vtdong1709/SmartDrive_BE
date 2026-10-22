import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertOwner } from "../httpError.js";

describe("driver permission", () => {
  it("driver B cannot update trip of driver A", () => {
    assert.throws(
      () => assertOwner("driverA", "driverB", "Bạn không được chỉnh chuyến của tài xế khác"),
      (err) => err.statusCode === 403
    );
  });

  it("owner can update own trip", () => {
    assert.doesNotThrow(() => assertOwner("driverA", "driverA"));
  });
});
