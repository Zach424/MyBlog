import { gzipSync } from "node:zlib";

export const DISCOVERY_BUDGET_ORIGIN = new URL(
  "https://blog-iota-five-59.vercel.app",
);

export const DISCOVERY_BUDGET_BASELINE_PROVENANCE = Object.freeze({
  measuredAt: "2026-08-11",
  sourceRevision: "d0f216505d707877457bf948fe471e174a367600",
});

export const DISCOVERY_BUDGET_POLICY = Object.freeze({
  rawHeadroomRatio: 0.5,
  rawMinimumHeadroomBytes: 4_096,
  rawRoundingBytes: 1_024,
  gzipHeadroomRatio: 0.5,
  gzipMinimumHeadroomBytes: 1_024,
  gzipRoundingBytes: 512,
});

const measuredRouteBaselines = {
  "/content.json": { rawBytes: 3_009, gzipBytes: 921 },
  "/content.schema.json": { rawBytes: 3_278, gzipBytes: 755 },
  "/feed.json": { rawBytes: 20_697, gzipBytes: 9_876 },
  "/rss.xml": { rawBytes: 3_400, gzipBytes: 1_284 },
  "/tags/typescript/rss.xml": { rawBytes: 2_059, gzipBytes: 923 },
  "/series/build-my-blog/rss.xml": { rawBytes: 2_065, gzipBytes: 983 },
  "/feeds.opml": { rawBytes: 5_193, gzipBytes: 962 },
  "/sitemap.xml": { rawBytes: 5_059, gzipBytes: 532 },
  "/robots.txt": { rawBytes: 155, gzipBytes: 127 },
  "/opensearch.xml": { rawBytes: 700, gzipBytes: 462 },
};

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
}

function deriveLimit(baselineBytes, ratio, minimumHeadroomBytes, roundingBytes) {
  assertPositiveInteger(baselineBytes, "baselineBytes");
  assertPositiveInteger(minimumHeadroomBytes, "minimumHeadroomBytes");
  assertPositiveInteger(roundingBytes, "roundingBytes");
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 0) {
    throw new TypeError("ratio must be a positive finite number");
  }

  const proportionalHeadroom = Math.ceil(baselineBytes * ratio);
  const headroom = Math.max(proportionalHeadroom, minimumHeadroomBytes);
  return Math.ceil((baselineBytes + headroom) / roundingBytes) * roundingBytes;
}

export function deriveDiscoveryRawLimit(baselineRawBytes) {
  return deriveLimit(
    baselineRawBytes,
    DISCOVERY_BUDGET_POLICY.rawHeadroomRatio,
    DISCOVERY_BUDGET_POLICY.rawMinimumHeadroomBytes,
    DISCOVERY_BUDGET_POLICY.rawRoundingBytes,
  );
}

export function deriveDiscoveryGzipLimit(baselineGzipBytes) {
  return deriveLimit(
    baselineGzipBytes,
    DISCOVERY_BUDGET_POLICY.gzipHeadroomRatio,
    DISCOVERY_BUDGET_POLICY.gzipMinimumHeadroomBytes,
    DISCOVERY_BUDGET_POLICY.gzipRoundingBytes,
  );
}

export const DISCOVERY_ROUTE_BASELINES = Object.freeze(
  Object.fromEntries(
    Object.entries(measuredRouteBaselines).map(([pathname, baseline]) => [
      pathname,
      Object.freeze({
        ...baseline,
        rawLimitBytes: deriveDiscoveryRawLimit(baseline.rawBytes),
        gzipLimitBytes: deriveDiscoveryGzipLimit(baseline.gzipBytes),
      }),
    ]),
  ),
);

function resolveBaseline(pathname, baseline) {
  const resolved = baseline ?? DISCOVERY_ROUTE_BASELINES[pathname];
  if (!resolved) throw new Error(`No discovery budget baseline for ${pathname}`);
  assertPositiveInteger(resolved.rawBytes, `${pathname} raw baseline`);
  assertPositiveInteger(resolved.gzipBytes, `${pathname} gzip baseline`);
  return resolved;
}

export function measureDiscoveryBudget({ pathname, body, baseline }) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) {
    throw new TypeError("pathname must start with /");
  }
  if (typeof body !== "string") throw new TypeError("body must be a string");

  const resolvedBaseline = resolveBaseline(pathname, baseline);
  const rawBytes = Buffer.byteLength(body);
  const gzipBytes = gzipSync(Buffer.from(body)).byteLength;
  const rawLimitBytes =
    resolvedBaseline.rawLimitBytes ??
    deriveDiscoveryRawLimit(resolvedBaseline.rawBytes);
  const gzipLimitBytes =
    resolvedBaseline.gzipLimitBytes ??
    deriveDiscoveryGzipLimit(resolvedBaseline.gzipBytes);
  const rawHeadroomBytes = rawLimitBytes - rawBytes;
  const gzipHeadroomBytes = gzipLimitBytes - gzipBytes;
  const rawOk = rawHeadroomBytes >= 0;
  const gzipOk = gzipHeadroomBytes >= 0;

  return {
    pathname,
    ok: rawOk && gzipOk,
    raw: {
      baselineBytes: resolvedBaseline.rawBytes,
      bytes: rawBytes,
      headroomBytes: rawHeadroomBytes,
      limitBytes: rawLimitBytes,
      ok: rawOk,
    },
    gzip: {
      baselineBytes: resolvedBaseline.gzipBytes,
      bytes: gzipBytes,
      headroomBytes: gzipHeadroomBytes,
      limitBytes: gzipLimitBytes,
      ok: gzipOk,
    },
  };
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

export function formatDiscoveryBudgetReport(reports) {
  const policy = DISCOVERY_BUDGET_POLICY;
  const provenance = DISCOVERY_BUDGET_BASELINE_PROVENANCE;
  const lines = [
    `[discovery-budget] policy origin=${DISCOVERY_BUDGET_ORIGIN.origin} revision=${provenance.sourceRevision.slice(0, 8)} measured=${provenance.measuredAt} raw-headroom=max(${policy.rawHeadroomRatio * 100}%,${policy.rawMinimumHeadroomBytes}) round=${policy.rawRoundingBytes} gzip-headroom=max(${policy.gzipHeadroomRatio * 100}%,${policy.gzipMinimumHeadroomBytes}) round=${policy.gzipRoundingBytes}`,
  ];

  for (const report of reports) {
    lines.push(
      `[discovery-budget] ${report.pathname} raw=${report.raw.bytes}/${report.raw.limitBytes} headroom=${signed(report.raw.headroomBytes)} baseline=${report.raw.baselineBytes} gzip=${report.gzip.bytes}/${report.gzip.limitBytes} headroom=${signed(report.gzip.headroomBytes)} baseline=${report.gzip.baselineBytes} ${report.ok ? "PASS" : "FAIL"}`,
    );
  }

  return lines.join("\n");
}

export function assertDiscoveryBudgetCoverage(reports) {
  const expected = Object.keys(DISCOVERY_ROUTE_BASELINES);
  const actual = reports.map((report) => report.pathname);
  const actualCounts = new Map();
  for (const pathname of actual) {
    actualCounts.set(pathname, (actualCounts.get(pathname) ?? 0) + 1);
  }

  const missing = expected.filter((pathname) => !actualCounts.has(pathname));
  const unexpected = actual.filter(
    (pathname) => !(pathname in DISCOVERY_ROUTE_BASELINES),
  );
  const duplicate = [...actualCounts]
    .filter(([, count]) => count > 1)
    .map(([pathname]) => pathname);

  if (missing.length > 0 || unexpected.length > 0 || duplicate.length > 0) {
    throw new Error(
      `Discovery budget coverage failed: missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}; duplicate=${duplicate.join(",") || "none"}`,
    );
  }
}

export function assertDiscoveryBudgets(reports) {
  const failures = [];

  for (const report of reports) {
    if (!report.raw.ok) {
      failures.push(
        `${report.pathname} raw ${report.raw.bytes} > ${report.raw.limitBytes}`,
      );
    }
    if (!report.gzip.ok) {
      failures.push(
        `${report.pathname} gzip ${report.gzip.bytes} > ${report.gzip.limitBytes}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Discovery budget failed: ${failures.join("; ")}\n${formatDiscoveryBudgetReport(reports)}`,
    );
  }
}
