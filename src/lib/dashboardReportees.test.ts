import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolveDashboardReportees } from "./dashboardReportees";

describe("dashboard direct reportees", () => {
  it("includes inactive users who remain mapped to the same manager", () => {
    const result = resolveDashboardReportees(
      [{ manager_id: "manager", user_id: "inactive" }, { manager_id: "manager", user_id: "active" }],
      [{ id: "inactive", full_name: "Former colleague", is_active: false }, { id: "active", full_name: "Current colleague", is_active: true }],
      "manager",
    );
    assert.equal(result.length, 2);
    assert.equal(result.find(row => row.id === "inactive")?.is_active, false);
  });

  it("counts unique direct mappings, not another manager's or transitive reportees", () => {
    const result = resolveDashboardReportees(
      [{ manager_id: "manager", user_id: "direct" }, { manager_id: "manager", user_id: "direct" }, { manager_id: "direct", user_id: "indirect" }],
      [{ id: "direct", full_name: "Direct", is_active: true }, { id: "indirect", full_name: "Indirect", is_active: true }],
      "manager",
    );
    assert.deepEqual(result.map(row => row.id), ["direct"]);
  });

  it("returns no reportees for a user without mappings regardless of profile availability", () => {
    assert.equal(resolveDashboardReportees([], [{ id: "other", full_name: "Other", is_active: true }], "user").length, 0);
  });
});