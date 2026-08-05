import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createStudioMaintenanceSnapshot } from "../lib/studio-maintenance.ts";
import {
  createStudioMaintenanceView,
  parseStudioMaintenanceSnapshot,
  requestStudioMaintenance,
} from "../studio/maintenance.mjs";

function contentRecord({
  draft = false,
  freshness = "current",
  kind = "post",
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
    kind,
    publishedAt,
    readingMinutes: 1,
    reviewedAt,
    slug,
    sourcePath: `content/${kind === "post" ? "posts" : "projects"}/${slug}.md`,
    tags: ["Personal Knowledge"],
    title,
    type: kind === "post" ? "article" : undefined,
    url: `/${kind === "post" ? "posts" : "projects"}/${slug}`,
    wordCount: 2,
  };
}

test("derives a public-only Studio queue with stable edit targets", () => {
  const snapshot = createStudioMaintenanceSnapshot(
    [
      contentRecord({ slug: "healthy", reviewedAt: "2026-06-01" }),
      contentRecord({ slug: "overdue", reviewedAt: "2026-01-01" }),
      contentRecord({ kind: "project", slug: "due", reviewedAt: "2026-02-01" }),
      contentRecord({ freshness: "historical", slug: "history" }),
      contentRecord({ draft: true, slug: "draft" }),
      contentRecord({ publishedAt: "2027-01-01", slug: "future" }),
    ],
    "2026-07-01",
  );

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.reportDate, "2026-07-01");
  assert.equal(snapshot.currentCount, 3);
  assert.equal(snapshot.historicalCount, 1);
  assert.deepEqual(snapshot.counts, {
    healthy: 1,
    "review-soon": 0,
    "due-soon": 1,
    overdue: 1,
  });
  assert.deepEqual(
    snapshot.records.map((record) => [record.slug, record.editUrl]),
    [
      ["overdue", "/studio/#/collections/posts/entries/overdue"],
      ["due", "/studio/#/collections/projects/entries/due"],
      ["healthy", "/studio/#/collections/posts/entries/healthy"],
    ],
  );
  assert.ok(snapshot.records.every((record) => !("sourcePath" in record)));
  assert.ok(snapshot.records.every((record) => !("body" in record)));
});

test("validates the browser contract and rejects unsafe navigation targets", () => {
  const snapshot = createStudioMaintenanceSnapshot(
    [contentRecord({ slug: "safe-entry", reviewedAt: "2026-06-01" })],
    "2026-07-01",
  );

  assert.deepEqual(parseStudioMaintenanceSnapshot(snapshot), snapshot);
  assert.throws(
    () =>
      parseStudioMaintenanceSnapshot({
        ...snapshot,
        records: [{ ...snapshot.records[0], editUrl: "https://attacker.example" }],
      }),
    /未知响应/u,
  );
  assert.throws(
    () => parseStudioMaintenanceSnapshot({ ...snapshot, version: 2 }),
    /未知响应/u,
  );
  assert.throws(
    () => parseStudioMaintenanceSnapshot({ ...snapshot, counts: { ...snapshot.counts, healthy: 0, overdue: 1 } }),
    /未知响应/u,
  );
});

test("requests the no-store queue and exposes recoverable view states", async () => {
  const snapshot = createStudioMaintenanceSnapshot(
    [contentRecord({ slug: "review", reviewedAt: "2026-05-15" })],
    "2026-07-01",
  );
  const calls = [];
  const result = await requestStudioMaintenance({
    fetcher: async (url, options) => {
      calls.push([url, options]);
      return {
        ok: true,
        json: async () => snapshot,
      };
    },
  });

  assert.deepEqual(result, snapshot);
  assert.deepEqual(calls, [["/studio/maintenance.json", { cache: "no-store", credentials: "same-origin" }]]);
  const ready = createStudioMaintenanceView(snapshot);
  assert.equal(ready.state, "ready");
  assert.match(ready.summary, /1 条 Current/u);
  assert.equal(ready.records[0].remainingLabel, "剩余 133 天");

  const empty = createStudioMaintenanceView({ ...snapshot, currentCount: 0, records: [] });
  assert.equal(empty.state, "empty");
  assert.match(empty.summary, /没有需要持续复核/u);

  await assert.rejects(
    requestStudioMaintenance({ fetcher: async () => ({ ok: false, status: 503, json: async () => ({}) }) }),
    /HTTP 503/u,
  );
});

test("ships a semantic responsive maintenance page without HTML injection", async () => {
  const [html, css, module, studioHtml] = await Promise.all([
    readFile(new URL("../studio/maintenance.html", import.meta.url), "utf8"),
    readFile(new URL("../studio/maintenance.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/maintenance.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(html, /<main id="main-content"/u);
  assert.match(html, /aria-live="polite"/u);
  assert.match(html, /data-maintenance-records/u);
  assert.match(html, /href="\/studio"/u);
  assert.match(html, /src="\/studio\/maintenance\.mjs"/u);
  assert.match(css, /:focus-visible/u);
  assert.match(css, /prefers-color-scheme:\s*dark/u);
  assert.match(css, /max-width:\s*42rem/u);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*14rem\)\s+minmax\(0,\s*1fr\)/u);
  assert.doesNotMatch(css, /(?:^|\n)(?:html|body)[^{]*\{[^}]*\bmin-width:/su);
  assert.match(module, /textContent/u);
  assert.doesNotMatch(module, /innerHTML|insertAdjacentHTML|document\.write/u);
  assert.match(studioHtml, /href="\/studio\/maintenance"/u);
  assert.match(studioHtml, /复核队列/u);
});
