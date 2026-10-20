import { describe, expect, test } from "bun:test";
import { getReportLevel } from "./reportLevel";

describe("report member levels", () => {
  test("L1 members and legacy faculty resolve to L1", () => {
    expect(getReportLevel("l1")).toBe("L1");
    expect(getReportLevel("faculty")).toBe("L1");
  });
  test("L2 members and legacy program managers resolve to L2", () => {
    expect(getReportLevel("l2")).toBe("L2");
    expect(getReportLevel("program_manager")).toBe("L2");
  });
  test("L3 members and legacy HODs resolve to L3", () => {
    expect(getReportLevel("l3")).toBe("L3");
    expect(getReportLevel("hod")).toBe("L3");
  });
  test("administrators and missing roles are not assigned a faculty level", () => {
    expect(getReportLevel("org_admin")).toBe("—");
    expect(getReportLevel(null)).toBe("—");
  });
});