import { gzipSync } from "node:zlib";

export const HTML_BUDGET_ORIGIN = new URL(
  "https://blog-iota-five-59.vercel.app",
);

export const HTML_BUDGET_BASELINE_PROVENANCE = Object.freeze({
  measuredAt: "2026-08-10",
  sourceRevision: "49e92a61a6f66bafd5316eb291c0599818209671",
});

export const HTML_BUDGET_POLICY = Object.freeze({
  gzipHeadroomRatio: 0.2,
  gzipMinimumHeadroomBytes: 2_048,
  gzipRoundingBytes: 1_024,
  rawEmergencyBytes: 160 * 1_024,
});

const measuredRouteBaselines = {
  "/": { rawBytes: 27_407, gzipBytes: 6_016 },
  "/posts": { rawBytes: 17_960, gzipBytes: 4_265 },
  "/posts/building-a-maintainable-blog": { rawBytes: 51_963, gzipBytes: 12_277 },
  "/projects/myblog": { rawBytes: 108_127, gzipBytes: 24_492 },
  "/archive": { rawBytes: 20_374, gzipBytes: 4_742 },
  "/series/build-my-blog": { rawBytes: 17_609, gzipBytes: 4_182 },
  "/tags/typescript": { rawBytes: 17_430, gzipBytes: 4_155 },
  "/search?q=cloudflare": { rawBytes: 36_292, gzipBytes: 13_846 },
  "/knowledge": { rawBytes: 36_006, gzipBytes: 7_265 },
  "/about": { rawBytes: 15_010, gzipBytes: 3_869 },
};

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
}

export function deriveGzipLimit(baselineGzipBytes) {
  assertPositiveInteger(baselineGzipBytes, "baselineGzipBytes");
  const proportionalHeadroom = Math.ceil(
    baselineGzipBytes * HTML_BUDGET_POLICY.gzipHeadroomRatio,
  );
  const headroom = Math.max(
    proportionalHeadroom,
    HTML_BUDGET_POLICY.gzipMinimumHeadroomBytes,
  );
  const unroundedLimit = baselineGzipBytes + headroom;
  return (
    Math.ceil(unroundedLimit / HTML_BUDGET_POLICY.gzipRoundingBytes) *
    HTML_BUDGET_POLICY.gzipRoundingBytes
  );
}

export const HTML_ROUTE_BASELINES = Object.freeze(
  Object.fromEntries(
    Object.entries(measuredRouteBaselines).map(([pathname, baseline]) => [
      pathname,
      Object.freeze({
        ...baseline,
        gzipLimitBytes: deriveGzipLimit(baseline.gzipBytes),
      }),
    ]),
  ),
);

function resolveBaseline(pathname, baseline) {
  const resolved = baseline ?? HTML_ROUTE_BASELINES[pathname];
  if (!resolved) throw new Error(`No HTML budget baseline for ${pathname}`);
  assertPositiveInteger(resolved.rawBytes, `${pathname} raw baseline`);
  assertPositiveInteger(resolved.gzipBytes, `${pathname} gzip baseline`);
  return resolved;
}

export function measureHtmlBudget({ pathname, html, baseline }) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) {
    throw new TypeError("pathname must start with /");
  }
  if (typeof html !== "string") throw new TypeError("html must be a string");

  const resolvedBaseline = resolveBaseline(pathname, baseline);
  const rawBytes = Buffer.byteLength(html);
  const gzipBytes = gzipSync(Buffer.from(html)).byteLength;
  const rawLimitBytes = HTML_BUDGET_POLICY.rawEmergencyBytes;
  const gzipLimitBytes =
    resolvedBaseline.gzipLimitBytes ?? deriveGzipLimit(resolvedBaseline.gzipBytes);
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

export function formatHtmlBudgetReport(reports) {
  const policy = HTML_BUDGET_POLICY;
  const provenance = HTML_BUDGET_BASELINE_PROVENANCE;
  const lines = [
    `[html-budget] policy origin=${HTML_BUDGET_ORIGIN.origin} revision=${provenance.sourceRevision.slice(0, 8)} measured=${provenance.measuredAt} raw=${policy.rawEmergencyBytes} gzip-headroom=max(${policy.gzipHeadroomRatio * 100}%,${policy.gzipMinimumHeadroomBytes}) round=${policy.gzipRoundingBytes}`,
  ];

  for (const report of reports) {
    lines.push(
      `[html-budget] ${report.pathname} raw=${report.raw.bytes}/${report.raw.limitBytes} headroom=${signed(report.raw.headroomBytes)} baseline=${report.raw.baselineBytes} gzip=${report.gzip.bytes}/${report.gzip.limitBytes} headroom=${signed(report.gzip.headroomBytes)} baseline=${report.gzip.baselineBytes} ${report.ok ? "PASS" : "FAIL"}`,
    );
  }

  return lines.join("\n");
}

export function assertHtmlBudgetCoverage(reports) {
  const expected = Object.keys(HTML_ROUTE_BASELINES);
  const actual = reports.map((report) => report.pathname);
  const actualCounts = new Map();
  for (const pathname of actual) {
    actualCounts.set(pathname, (actualCounts.get(pathname) ?? 0) + 1);
  }

  const missing = expected.filter((pathname) => !actualCounts.has(pathname));
  const unexpected = actual.filter((pathname) => !(pathname in HTML_ROUTE_BASELINES));
  const duplicate = [...actualCounts]
    .filter(([, count]) => count > 1)
    .map(([pathname]) => pathname);

  if (missing.length > 0 || unexpected.length > 0 || duplicate.length > 0) {
    throw new Error(
      `HTML budget coverage failed: missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}; duplicate=${duplicate.join(",") || "none"}`,
    );
  }
}

export function assertHtmlBudgets(reports) {
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
      `HTML budget failed: ${failures.join("; ")}\n${formatHtmlBudgetReport(reports)}`,
    );
  }
}
