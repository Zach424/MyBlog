import assert from "node:assert/strict";
import test from "node:test";
import {
  getContentDatePresentation,
  getProjectStatusPresentation,
} from "../lib/content-presentation.ts";

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

test("presents a later content update without mutating the record", () => {
  const record = {
    publishedAt: "2026-07-18",
    updatedAt: "2026-08-06",
  };
  const snapshot = structuredClone(record);

  assert.deepEqual(getContentDatePresentation(record), {
    label: "UPDATED",
    date: "2026-08-06",
  });
  assert.deepEqual(record, snapshot);
});

test("keeps missing and same-day updates on the published date", () => {
  assert.deepEqual(
    getContentDatePresentation({ publishedAt: "2026-07-18" }),
    { label: "PUBLISHED", date: "2026-07-18" },
  );
  assert.deepEqual(
    getContentDatePresentation({
      publishedAt: "2026-07-18",
      updatedAt: "2026-07-18",
    }),
    { label: "PUBLISHED", date: "2026-07-18" },
  );
});
