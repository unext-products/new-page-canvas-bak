import { strict as assert } from "node:assert";
import { test } from "node:test";
import { usesExpandedReportingScope } from "./reportingScopeMode";

test("L3 and legacy L3 roles include indirect faculty in Reports and Team", () => {
  for (const role of ["l3", "hod", "manager"]) assert.equal(usesExpandedReportingScope(role), true);
});
test("L2 and other roles do not gain expanded reporting scope", () => {
  for (const role of ["l2", "program_manager", "l1", "admin", null]) assert.equal(usesExpandedReportingScope(role), false);
});