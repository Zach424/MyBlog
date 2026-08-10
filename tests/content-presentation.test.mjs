import assert from "node:assert/strict";
import test from "node:test";
import { getProjectStatusPresentation } from "../lib/content-presentation.ts";

test("presents every project status with one human and machine identity", () => {
  const expectations = {
    planning: { label: "规划中", code: "PLANNING", meta: "规划中 · PLANNING" },
    building: { label: "构建中", code: "BUILDING", meta: "构建中 · BUILDING" },
    maintained: {
      label: "持续维护",
      code: "MAINTAINED",
      meta: "持续维护 · MAINTAINED",
    },
    archived: { label: "已归档", code: "ARCHIVED", meta: "已归档 · ARCHIVED" },
  };

  for (const [status, expected] of Object.entries(expectations)) {
    assert.deepEqual(getProjectStatusPresentation(status), expected);
  }
});
