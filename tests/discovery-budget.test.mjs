import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertDiscoveryBudgetCoverage,
  assertDiscoveryBudgets,
  deriveDiscoveryGzipLimit,
  deriveDiscoveryRawLimit,
  DISCOVERY_BUDGET_BASELINE_PROVENANCE,
  DISCOVERY_BUDGET_ORIGIN,
  DISCOVERY_BUDGET_POLICY,
  DISCOVERY_ROUTE_BASELINES,
  formatDiscoveryBudgetReport,
  measureDiscoveryBudget,
} from "../scripts/discovery-budget.mjs";

function deterministicNoise(byteLength) {
  let value = "";
  for (let index = 0; value.length < byteLength; index += 1) {
    value += createHash("sha256").update(String(index)).digest("hex");
  }
  return value.slice(0, byteLength);
}

const fixtureBaseline = { rawBytes: 10_000, gzipBytes: 1_000 };

test("derives every discovery limit from explicit rounded headroom rules", () => {
  assert.deepEqual(DISCOVERY_BUDGET_POLICY, {
    rawHeadroomRatio: 0.5,
    rawMinimumHeadroomBytes: 4_096,
    rawRoundingBytes: 1_024,
    gzipHeadroomRatio: 0.5,
    gzipMinimumHeadroomBytes: 1_024,
    gzipRoundingBytes: 512,
  });
  assert.equal(deriveDiscoveryRawLimit(3_009), 7_168);
  assert.equal(deriveDiscoveryRawLimit(20_697), 31_744);
  assert.equal(deriveDiscoveryGzipLimit(921), 2_048);
  assert.equal(deriveDiscoveryGzipLimit(9_876), 14_848);

  for (const [pathname, baseline] of Object.entries(DISCOVERY_ROUTE_BASELINES)) {
    assert.ok(pathname.startsWith("/"));
    assert.ok(Number.isSafeInteger(baseline.rawBytes) && baseline.rawBytes > 0);
    assert.ok(Number.isSafeInteger(baseline.gzipBytes) && baseline.gzipBytes > 0);
    assert.equal(baseline.rawLimitBytes, deriveDiscoveryRawLimit(baseline.rawBytes));
    assert.equal(
      baseline.gzipLimitBytes,
      deriveDiscoveryGzipLimit(baseline.gzipBytes),
    );
  }
});

test("accepts a discovery body inside both byte envelopes", () => {
  const report = measureDiscoveryBudget({
    baseline: fixtureBaseline,
    body: JSON.stringify({ items: ["bounded"] }),
    pathname: "/fixtures/passing.json",
  });

  assert.equal(report.raw.ok, true);
  assert.equal(report.gzip.ok, true);
  assert.equal(report.ok, true);
  assert.doesNotThrow(() => assertDiscoveryBudgets([report]));
});

test("rejects compressible raw growth beyond its route limit", () => {
  const rawLimitBytes = deriveDiscoveryRawLimit(fixtureBaseline.rawBytes);
  const report = measureDiscoveryBudget({
    baseline: fixtureBaseline,
    body: "x".repeat(rawLimitBytes + 1),
    pathname: "/fixtures/raw-growth.json",
  });

  assert.equal(report.raw.bytes, rawLimitBytes + 1);
  assert.equal(report.raw.ok, false);
  assert.equal(report.gzip.ok, true);
  assert.equal(report.ok, false);
  assert.throws(
    () => assertDiscoveryBudgets([report]),
    /\/fixtures\/raw-growth\.json.*raw/u,
  );
});

test("rejects high-entropy transfer growth before its raw limit", () => {
  const report = measureDiscoveryBudget({
    baseline: fixtureBaseline,
    body: deterministicNoise(14_000),
    pathname: "/fixtures/gzip-growth.json",
  });

  assert.equal(report.raw.ok, true);
  assert.equal(report.gzip.ok, false);
  assert.equal(report.ok, false);
  assert.throws(
    () => assertDiscoveryBudgets([report]),
    /\/fixtures\/gzip-growth\.json.*gzip/u,
  );
});

test("reports actual bytes, limits, baselines, and signed headroom", () => {
  const passing = measureDiscoveryBudget({
    baseline: fixtureBaseline,
    body: "bounded",
    pathname: "/fixtures/passing.json",
  });
  const failing = measureDiscoveryBudget({
    baseline: fixtureBaseline,
    body: deterministicNoise(14_000),
    pathname: "/fixtures/failing.json",
  });
  const output = formatDiscoveryBudgetReport([passing, failing]);

  assert.match(
    output,
    /^\[discovery-budget\] policy origin=https:\/\/blog-iota-five-59\.vercel\.app revision=97eabcea measured=2026-08-11/u,
  );
  assert.match(
    output,
    /\/fixtures\/passing\.json raw=\d+\/15360 headroom=\+\d+ baseline=10000 gzip=\d+\/2048 headroom=\+\d+ baseline=1000 PASS/u,
  );
  assert.match(output, /\/fixtures\/failing\.json .*headroom=-\d+.*FAIL/u);
});

test("fails closed when a verifier misses, duplicates, or invents an endpoint", () => {
  const reports = Object.entries(DISCOVERY_ROUTE_BASELINES).map(
    ([pathname, baseline]) =>
      measureDiscoveryBudget({ baseline, body: pathname, pathname }),
  );

  assert.doesNotThrow(() => assertDiscoveryBudgetCoverage(reports));
  assert.throws(
    () => assertDiscoveryBudgetCoverage(reports.slice(1)),
    /missing=\/content\.json/u,
  );
  assert.throws(
    () => assertDiscoveryBudgetCoverage([...reports, reports[0]]),
    /duplicate=\/content\.json/u,
  );
  assert.throws(
    () =>
      assertDiscoveryBudgetCoverage([
        ...reports,
        { ...reports[0], pathname: "/unexpected.json" },
      ]),
    /unexpected=\/unexpected\.json/u,
  );
});

test("pins measured endpoint baselines to the stable production revision", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.equal(
    DISCOVERY_BUDGET_ORIGIN.origin,
    "https://blog-iota-five-59.vercel.app",
  );
  assert.deepEqual(DISCOVERY_BUDGET_BASELINE_PROVENANCE, {
    measuredAt: "2026-08-11",
    sourceRevision: "97eabcea94283dfbf436677f4e7b7612f7325483",
  });
  assert.ok(readme.includes(DISCOVERY_BUDGET_ORIGIN.origin));
  assert.deepEqual(DISCOVERY_ROUTE_BASELINES, {
    "/content.json": {
      rawBytes: 3_009,
      gzipBytes: 921,
      rawLimitBytes: 7_168,
      gzipLimitBytes: 2_048,
    },
    "/content.schema.json": {
      rawBytes: 3_278,
      gzipBytes: 755,
      rawLimitBytes: 8_192,
      gzipLimitBytes: 2_048,
    },
    "/feed.json": {
      rawBytes: 20_697,
      gzipBytes: 9_876,
      rawLimitBytes: 31_744,
      gzipLimitBytes: 14_848,
    },
    "/rss.xml": {
      rawBytes: 3_536,
      gzipBytes: 1_298,
      rawLimitBytes: 8_192,
      gzipLimitBytes: 2_560,
    },
    "/sitemap.xml": {
      rawBytes: 5_059,
      gzipBytes: 532,
      rawLimitBytes: 9_216,
      gzipLimitBytes: 2_048,
    },
    "/robots.txt": {
      rawBytes: 155,
      gzipBytes: 127,
      rawLimitBytes: 5_120,
      gzipLimitBytes: 1_536,
    },
    "/opensearch.xml": {
      rawBytes: 700,
      gzipBytes: 462,
      rawLimitBytes: 5_120,
      gzipLimitBytes: 1_536,
    },
  });
});
