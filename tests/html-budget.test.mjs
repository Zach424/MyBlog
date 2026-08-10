import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertHtmlBudgetCoverage,
  assertHtmlBudgets,
  deriveGzipLimit,
  formatHtmlBudgetReport,
  HTML_BUDGET_BASELINE_PROVENANCE,
  HTML_BUDGET_ORIGIN,
  HTML_BUDGET_POLICY,
  HTML_ROUTE_BASELINES,
  measureHtmlBudget,
} from "../scripts/html-budget.mjs";

function deterministicNoise(byteLength) {
  let value = "";
  for (let index = 0; value.length < byteLength; index += 1) {
    value += createHash("sha256").update(String(index)).digest("hex");
  }
  return value.slice(0, byteLength);
}

const fixtureBaseline = { rawBytes: 1_000, gzipBytes: 1_000 };

test("derives every gzip limit from an explicit, rounded headroom rule", () => {
  assert.deepEqual(HTML_BUDGET_POLICY, {
    gzipHeadroomRatio: 0.2,
    gzipMinimumHeadroomBytes: 2_048,
    gzipRoundingBytes: 1_024,
    rawEmergencyBytes: 160 * 1_024,
  });
  assert.equal(deriveGzipLimit(10_000), 12_288);
  assert.equal(deriveGzipLimit(20_000), 24_576);

  for (const [pathname, baseline] of Object.entries(HTML_ROUTE_BASELINES)) {
    assert.ok(pathname.startsWith("/"));
    assert.ok(Number.isSafeInteger(baseline.rawBytes) && baseline.rawBytes > 0);
    assert.ok(Number.isSafeInteger(baseline.gzipBytes) && baseline.gzipBytes > 0);
    assert.equal(baseline.gzipLimitBytes, deriveGzipLimit(baseline.gzipBytes));
  }
});

test("allows a large repetitive document when transfer cost stays bounded", () => {
  const report = measureHtmlBudget({
    baseline: fixtureBaseline,
    html: `<main>${"repeatable evidence ".repeat(7_000)}</main>`,
    pathname: "/fixtures/compressible",
  });

  assert.ok(report.raw.bytes > 100_000);
  assert.ok(report.raw.bytes < HTML_BUDGET_POLICY.rawEmergencyBytes);
  assert.equal(report.raw.ok, true);
  assert.equal(report.gzip.ok, true);
  assert.equal(report.ok, true);
  assert.doesNotThrow(() => assertHtmlBudgets([report]));
});

test("rejects equal-scale high-entropy growth through the gzip layer", () => {
  const report = measureHtmlBudget({
    baseline: fixtureBaseline,
    html: `<main>${deterministicNoise(120_000)}</main>`,
    pathname: "/fixtures/incompressible",
  });

  assert.ok(report.raw.bytes < HTML_BUDGET_POLICY.rawEmergencyBytes);
  assert.equal(report.raw.ok, true);
  assert.equal(report.gzip.ok, false);
  assert.equal(report.ok, false);
  assert.throws(
    () => assertHtmlBudgets([report]),
    /\/fixtures\/incompressible.*gzip/u,
  );
});

test("keeps the raw emergency ceiling independent from compression", () => {
  const report = measureHtmlBudget({
    baseline: fixtureBaseline,
    html: `<main>${"x".repeat(HTML_BUDGET_POLICY.rawEmergencyBytes)}</main>`,
    pathname: "/fixtures/raw-emergency",
  });

  assert.equal(report.raw.ok, false);
  assert.equal(report.gzip.ok, true);
  assert.equal(report.ok, false);
});

test("reports actual bytes, limits, baselines, and signed headroom per route", () => {
  const passing = measureHtmlBudget({
    baseline: fixtureBaseline,
    html: "<main>evidence</main>",
    pathname: "/fixtures/passing",
  });
  const failing = measureHtmlBudget({
    baseline: fixtureBaseline,
    html: `<main>${deterministicNoise(8_000)}</main>`,
    pathname: "/fixtures/failing",
  });
  const output = formatHtmlBudgetReport([passing, failing]);

  assert.match(output, /^\[html-budget\] policy origin=https:\/\/blog-iota-five-59\.vercel\.app revision=1f0b6ce5 measured=2026-08-10 raw=/u);
  assert.match(output, /\/fixtures\/passing raw=\d+\/163840 headroom=\+\d+ baseline=1000 gzip=\d+\/3072 headroom=\+\d+ baseline=1000/u);
  assert.match(output, /\/fixtures\/failing .*headroom=-\d+.*FAIL/u);
});

test("fails closed when a verifier misses, duplicates, or invents a key route", () => {
  const reports = Object.entries(HTML_ROUTE_BASELINES).map(([pathname, baseline]) =>
    measureHtmlBudget({ baseline, html: `<main>${pathname}</main>`, pathname }),
  );

  assert.doesNotThrow(() => assertHtmlBudgetCoverage(reports));
  assert.throws(
    () => assertHtmlBudgetCoverage(reports.slice(1)),
    /missing=\//u,
  );
  assert.throws(
    () => assertHtmlBudgetCoverage([...reports, reports[0]]),
    /duplicate=\//u,
  );
  assert.throws(
    () =>
      assertHtmlBudgetCoverage([
        ...reports,
        { ...reports[0], pathname: "/unexpected" },
      ]),
    /unexpected=\/unexpected/u,
  );
});

test("pins the deterministic local origin to the documented stable production site", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.equal(HTML_BUDGET_ORIGIN.origin, "https://blog-iota-five-59.vercel.app");
  assert.deepEqual(HTML_BUDGET_BASELINE_PROVENANCE, {
    measuredAt: "2026-08-10",
    sourceRevision: "1f0b6ce5f5dd6418afdf401326a2eb7df23ce77e",
  });
  assert.ok(readme.includes(HTML_BUDGET_ORIGIN.origin));
  assert.deepEqual(Object.keys(HTML_ROUTE_BASELINES), [
    "/",
    "/posts",
    "/posts/building-a-maintainable-blog",
    "/projects/myblog",
    "/series/build-my-blog",
    "/tags/typescript",
    "/search?q=cloudflare",
    "/knowledge",
    "/about",
  ]);
});
