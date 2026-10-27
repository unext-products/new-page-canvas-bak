import { it } from "node:test";
import { strict as assert } from "node:assert";
import { formatApprovalTimestamp } from "./approvalTimestamp";

it("includes the recorded date and time down to seconds for approved entries", () => {
  assert.equal(formatApprovalTimestamp("approved", "2026-10-27T14:45:09"), "Oct 27, 2026 14:45:09");
});
it("does not treat rejection or pending processing times as approvals", () => {
  for (const status of ["rejected", "submitted", "draft"]) {
    assert.equal(formatApprovalTimestamp(status, "2026-10-27T14:45:09"), "");
  }
});
it("never fabricates missing or invalid historical approval times", () => {
  assert.equal(formatApprovalTimestamp("approved", null), "");
  assert.equal(formatApprovalTimestamp("approved", "invalid"), "");
});