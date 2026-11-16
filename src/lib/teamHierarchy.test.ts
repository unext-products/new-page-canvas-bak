import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildTeamHierarchy } from "./teamHierarchy";

test("84 team members reconcile to six direct and 78 indirect", () => {
  const members = Array.from({ length: 84 }, (_, i) => ({ id: String(i), fullName: `Member ${i}` }));
  const links = members.map((member, i) => ({ user_id: member.id, manager_id: i < 6 ? "viewer" : String(i % 6) }));
  const result = buildTeamHierarchy(members, links, "viewer");
  assert.equal(result.total, 84);
  assert.equal(result.direct.length, 6);
  assert.equal(result.other.length, 78);
  assert.equal([...result.groups.values()].flat().length, 78);
});
test("duplicate mappings and multiple managers never double-count a reportee", () => {
  const members = [{ id: "a", fullName: "A" }, { id: "b", fullName: "B" }, { id: "b", fullName: "B" }];
  const result = buildTeamHierarchy(members, [{ user_id: "a", manager_id: "viewer" }, { user_id: "b", manager_id: "a" }, { user_id: "b", manager_id: "viewer" }], "viewer");
  assert.equal(result.total, 2);
  assert.equal(result.direct.length, 2);
  assert.equal(result.other.length, 0);
});
test("unmapped visible members remain visible and outside links add nobody", () => {
  const result = buildTeamHierarchy([{ id: "a", fullName: "A" }], [{ user_id: "outside", manager_id: "viewer" }], "viewer");
  assert.equal(result.total, 1);
  assert.equal(result.groups.get("unassigned")?.length, 1);
});