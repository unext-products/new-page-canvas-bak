import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canExportReport } from "./reportExportAccess";

test("L3 can export a generated report even when no timesheet entries exist", () => {
  assert.equal(canExportReport("l3", { entries: [] }, false), true);
  assert.equal(canExportReport("hod", { facultyBreakdown: [], nonStarters: [] }, false), true);
});

test("export waits for a successful report and is unavailable while loading", () => {
  assert.equal(canExportReport("l3", null, false), false);
  assert.equal(canExportReport("l3", { entries: [] }, true), false);
});

test("export preserves access for other reporting roles and excludes L1", () => {
  for (const role of ["l2", "program_manager", "admin", "org_admin", "super_admin"]) {
    assert.equal(canExportReport(role, {}, false), true);
  }
  assert.equal(canExportReport("l1", {}, false), false);
});