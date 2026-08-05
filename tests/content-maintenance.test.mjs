import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadContentRepository } from "../build/validate-content.ts";
import {
  createContentMaintenanceReport,
  formatContentMaintenanceAnnotations,
  formatContentMaintenanceMarkdown,
  formatContentMaintenanceText,
} from "../lib/content/maintenance.ts";

function contentRecord({
  draft = false,
  freshness = "current",
  publishedAt = "2025-01-01",
  reviewedAt = "2026-01-01",
  slug = "record",
  title = "维护记录",
} = {}) {
  return {
    body: "## 正文\n\n内容。",
    description: "测试维护状态。",
    draft,
    featured: false,
    freshness,
    kind: "post",
    publishedAt,
    readingMinutes: 1,
    reviewedAt,
    slug,
    sourcePath: `content/posts/${slug}.md`,
    tags: ["Personal Knowledge"],
    title,
    type: "article",
    url: `/posts/${slug}`,
    wordCount: 2,
  };
}

test("derives every maintenance tier at the exact day boundary", () => {
  const record = contentRecord();
  const cases = [
    ["2026-04-30", "healthy", 61],
    ["2026-05-01", "review-soon", 60],
    ["2026-05-31", "due-soon", 30],
    ["2026-06-30", "due-soon", 0],
    ["2026-07-01", "overdue", -1],
  ];

  for (const [buildDate, status, remainingDays] of cases) {
    const report = createContentMaintenanceReport([record], buildDate);
    assert.equal(report.records[0].status, status);
    assert.equal(report.records[0].remainingDays, remainingDays);
    assert.equal(report.records[0].reviewBy, "2026-06-30");
  }
});

test("reports only published current records and sorts urgency first", () => {
  const report = createContentMaintenanceReport(
    [
      contentRecord({ slug: "healthy", reviewedAt: "2026-06-01" }),
      contentRecord({ slug: "overdue", reviewedAt: "2026-01-01" }),
      contentRecord({ slug: "historical", freshness: "historical" }),
      contentRecord({ slug: "draft", draft: true }),
      contentRecord({ slug: "future", publishedAt: "2027-01-01" }),
    ],
    "2026-07-01",
  );

  assert.deepEqual(
    report.records.map((record) => record.slug),
    ["overdue", "healthy"],
  );
  assert.equal(report.version, 1);
  assert.equal(report.currentCount, 2);
  assert.equal(report.historicalCount, 1);
  assert.equal(report.excludedCount, 2);
  assert.deepEqual(report.counts, {
    healthy: 1,
    "review-soon": 0,
    "due-soon": 0,
    overdue: 1,
  });
});

test("formats local output, Actions summary, and source annotations", () => {
  const report = createContentMaintenanceReport(
    [
      contentRecord({ slug: "overdue", title: "过期 | 记录", reviewedAt: "2026-01-01" }),
      contentRecord({ slug: "due", title: "即将复核", reviewedAt: "2026-02-01" }),
    ],
    "2026-07-01",
  );
  const text = formatContentMaintenanceText(report);
  const markdown = formatContentMaintenanceMarkdown(report);
  const annotations = formatContentMaintenanceAnnotations(report);

  assert.match(text, /已过期.*content\/posts\/overdue\.md.*逾期 1 天/u);
  assert.match(text, /复核清单/u);
  assert.match(markdown, /## Content maintenance/u);
  assert.match(markdown, /过期 \\| 记录/u);
  assert.match(markdown, /- \[ \] 核对正文中的架构/u);
  assert.equal(annotations.length, 2);
  assert.match(annotations[0], /^::error file=content\/posts\/overdue\.md/u);
  assert.match(annotations[1], /^::warning file=content\/posts\/due\.md/u);
});

test("rejects future review dates and inconsistent thresholds", () => {
  assert.throws(
    () =>
      createContentMaintenanceReport(
        [contentRecord({ reviewedAt: "2026-07-02" })],
        "2026-07-01",
      ),
    /reviewedAt 不能晚于报告日期/u,
  );
  assert.throws(
    () =>
      createContentMaintenanceReport([], "2026-07-01", {
        dueSoonDays: 61,
        reviewSoonDays: 60,
      }),
    /内容维护阈值/u,
  );
});

test("loads maintenance sources relative to an explicit repository root", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "myblog-maintenance-"));
  try {
    await Promise.all([
      mkdir(join(projectRoot, "content", "posts"), { recursive: true }),
      mkdir(join(projectRoot, "content", "projects"), { recursive: true }),
    ]);
    await writeFile(
      join(projectRoot, "content", "posts", "portable-report.md"),
      `---
title: "Portable report"
description: "验证维护报告不会把调用进程目录写进内容源路径。"
type: article
publishedAt: 2026-01-01
freshness: current
reviewedAt: 2026-01-01
tags: ["Personal Knowledge"]
draft: false
featured: false
---

## Evidence

Repository-relative source path.`,
      "utf8",
    );

    const repository = await loadContentRepository(projectRoot);
    assert.equal(repository.posts[0].sourcePath, "content/posts/portable-report.md");
    assert.equal(repository.projects.length, 0);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
