import { createContentManifestDocument } from "../content-manifest.ts";
import type { ContentRecord } from "./contract.ts";
import {
  compareProductionContent,
  fetchProductionContentManifestConditional,
  resolveProductionOrigin,
  type ProductionContentDifference,
  type ProductionContentManifestFetchResult,
} from "./production-sync.ts";

export const PRODUCTION_CONTENT_CONVERGENCE_VERSION = 1 as const;
export const PRODUCTION_CONTENT_CONVERGENCE_DEFAULTS = Object.freeze({
  intervalMs: 5_000,
  requestTimeoutMs: 10_000,
  timeoutMs: 180_000,
});

const PUBLISHED_SOURCE_PATTERN =
  /^content\/(posts|projects)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export interface ProductionContentConvergenceTarget {
  id: string;
  kind: "post" | "project";
  type: "article" | "project" | "til";
  title: string;
  sourcePath: string;
  markdownUrl: string;
  localEtag: string;
  sourceSha256: string;
}

export interface ProductionContentConvergenceObservation {
  attempt: number;
  checkedAt: string;
  elapsedMs: number;
  remainingMs: number;
  state: "deployed" | "missing" | "pending";
  response: "modified" | "not-modified";
  manifestEtag: string;
  productionEtag: string | null;
  differences: ProductionContentDifference[];
}

export interface ProductionContentConvergenceReport {
  version: typeof PRODUCTION_CONTENT_CONVERGENCE_VERSION;
  mode: "read-only";
  status: "deployed" | "timeout";
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  timeoutMs: number;
  intervalMs: number;
  requestTimeoutMs: number;
  attemptCount: number;
  origin: string;
  manifestUrl: string;
  localBuildDate: string;
  target: ProductionContentConvergenceTarget;
  production: {
    etag: string;
    lastModified: string;
  };
  observations: ProductionContentConvergenceObservation[];
  safety: {
    networkChecked: true;
    sourceFrozen: true;
    authorFilesChanged: false;
    commitCreated: false;
    pushExecuted: false;
  };
}

interface CreateTargetOptions {
  localRecords: ContentRecord[];
  origin: string | URL;
  sourcePath: string;
  sourceSha256: string;
}

interface WaitOptions {
  fetchManifest?: (
    origin: string | URL,
    options: {
      ifNoneMatch?: string;
      signal?: AbortSignal;
      timeoutMs: number;
    },
  ) => Promise<ProductionContentManifestFetchResult>;
  intervalMs: number;
  localBuildDate: string;
  localRecords: ContentRecord[];
  now?: () => number;
  onProgress?: (observation: ProductionContentConvergenceObservation) => void;
  origin: string | URL;
  readSourceSha256: () => Promise<string>;
  requestTimeoutMs: number;
  signal?: AbortSignal;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  target: ProductionContentConvergenceTarget;
  timeoutMs: number;
}

export class ProductionContentConvergenceCancelledError extends Error {
  constructor() {
    super("生产内容收敛等待已取消");
    this.name = "ProductionContentConvergenceCancelledError";
  }
}

function assertIsoDate(value: string, label: string) {
  if (!ISO_DATE_PATTERN.test(value)) throw new Error(`${label} 必须是 YYYY-MM-DD 日期`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} 必须是有效日期`);
  }
}

function assertPositiveInteger(value: number, label: string, maximum: number) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} 必须是 1–${maximum} 的整数`);
  }
}

export function normalizeProductionConvergenceSourcePath(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (!PUBLISHED_SOURCE_PATTERN.test(normalized)) {
    throw new Error(
      `收敛来源必须是安全的 content/posts 或 content/projects 下稳定 Markdown 路径，收到：${value}`,
    );
  }
  return normalized;
}

function sameTarget(
  left: ProductionContentConvergenceTarget,
  right: ProductionContentConvergenceTarget,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createProductionContentConvergenceTarget(
  options: CreateTargetOptions,
): ProductionContentConvergenceTarget {
  const origin = resolveProductionOrigin(options.origin);
  const sourcePath = normalizeProductionConvergenceSourcePath(options.sourcePath);
  if (!SHA256_PATTERN.test(options.sourceSha256)) {
    throw new Error("收敛来源 SHA-256 必须是 64 位小写十六进制摘要");
  }
  const matching = options.localRecords.filter((record) => record.sourcePath === sourcePath);
  if (matching.length !== 1) {
    throw new Error(`目标正式内容不在本地公开范围或来源不唯一：${sourcePath}`);
  }
  const record = matching[0];
  const item = createContentManifestDocument(origin, [record]).items[0];
  return {
    id: item.id,
    kind: item.kind,
    type: item.type,
    title: item.title,
    sourcePath,
    markdownUrl: item.markdown_url,
    localEtag: item.markdown_etag,
    sourceSha256: options.sourceSha256,
  };
}

function assertNotCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new ProductionContentConvergenceCancelledError();
}

async function defaultSleep(milliseconds: number, signal?: AbortSignal) {
  assertNotCancelled(signal);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, milliseconds);
    const cancel = () => {
      clearTimeout(timeout);
      reject(new ProductionContentConvergenceCancelledError());
    };
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

async function assertSourceFrozen(
  target: ProductionContentConvergenceTarget,
  readSourceSha256: () => Promise<string>,
) {
  const current = await readSourceSha256();
  if (!SHA256_PATTERN.test(current) || current !== target.sourceSha256) {
    throw new Error(
      `来源字节在等待期间发生变化：${target.sourcePath}；已停止，必须重新冻结本地 ETag`,
    );
  }
}

function createReport(
  options: WaitOptions,
  origin: URL,
  startedAtMs: number,
  completedAtMs: number,
  status: "deployed" | "timeout",
  observations: ProductionContentConvergenceObservation[],
  productionEtag: string,
  productionLastModified: string,
): ProductionContentConvergenceReport {
  return {
    version: PRODUCTION_CONTENT_CONVERGENCE_VERSION,
    mode: "read-only",
    status,
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    elapsedMs: Math.max(0, completedAtMs - startedAtMs),
    timeoutMs: options.timeoutMs,
    intervalMs: options.intervalMs,
    requestTimeoutMs: options.requestTimeoutMs,
    attemptCount: observations.length,
    origin: origin.origin,
    manifestUrl: new URL("content.json", origin).href,
    localBuildDate: options.localBuildDate,
    target: options.target,
    production: {
      etag: productionEtag,
      lastModified: productionLastModified,
    },
    observations,
    safety: {
      networkChecked: true,
      sourceFrozen: true,
      authorFilesChanged: false,
      commitCreated: false,
      pushExecuted: false,
    },
  };
}

export async function waitForProductionContentConvergence(
  options: WaitOptions,
): Promise<ProductionContentConvergenceReport> {
  const origin = resolveProductionOrigin(options.origin);
  assertIsoDate(options.localBuildDate, "本地构建日期");
  assertPositiveInteger(options.timeoutMs, "收敛等待 timeoutMs", 3_600_000);
  assertPositiveInteger(options.intervalMs, "收敛等待 intervalMs", 300_000);
  assertPositiveInteger(options.requestTimeoutMs, "收敛等待 requestTimeoutMs", 30_000);
  if (options.intervalMs >= options.timeoutMs) {
    throw new Error("收敛等待 intervalMs 必须小于 timeoutMs");
  }
  const expectedTarget = createProductionContentConvergenceTarget({
    localRecords: options.localRecords,
    origin,
    sourcePath: options.target.sourcePath,
    sourceSha256: options.target.sourceSha256,
  });
  if (!sameTarget(expectedTarget, options.target)) {
    throw new Error("收敛目标与本地公开内容快照不一致");
  }

  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const fetchManifest = options.fetchManifest ?? fetchProductionContentManifestConditional;
  const startedAtMs = now();
  if (!Number.isFinite(startedAtMs)) throw new Error("收敛等待时钟无效");
  const deadlineMs = startedAtMs + options.timeoutMs;
  const observations: ProductionContentConvergenceObservation[] = [];
  let manifestSnapshot = null;
  let productionEtag = "";
  let productionLastModified = "";

  while (true) {
    assertNotCancelled(options.signal);
    await assertSourceFrozen(options.target, options.readSourceSha256);
    const beforeAttemptMs = now();
    if (observations.length > 0 && beforeAttemptMs >= deadlineMs) {
      return createReport(
        options,
        origin,
        startedAtMs,
        beforeAttemptMs,
        "timeout",
        observations,
        productionEtag,
        productionLastModified,
      );
    }

    const remainingBeforeAttempt = deadlineMs - beforeAttemptMs;
    const effectiveRequestTimeoutMs = Math.min(
      options.requestTimeoutMs,
      remainingBeforeAttempt,
    );
    let fetched: ProductionContentManifestFetchResult;
    try {
      fetched = await fetchManifest(origin, {
        ...(productionEtag ? { ifNoneMatch: productionEtag } : {}),
        signal: options.signal,
        timeoutMs: effectiveRequestTimeoutMs,
      });
    } catch (error) {
      if (options.signal?.aborted) {
        throw new ProductionContentConvergenceCancelledError();
      }
      if (
        observations.length > 0 &&
        effectiveRequestTimeoutMs < options.requestTimeoutMs &&
        error instanceof Error &&
        error.message ===
          `生产清单请求在 ${effectiveRequestTimeoutMs}ms 后超时`
      ) {
        await assertSourceFrozen(options.target, options.readSourceSha256);
        return createReport(
          options,
          origin,
          startedAtMs,
          Math.max(deadlineMs, now()),
          "timeout",
          observations,
          productionEtag,
          productionLastModified,
        );
      }
      throw error;
    }
    if (fetched.status === "modified") {
      manifestSnapshot = fetched.manifest;
    } else if (!manifestSnapshot) {
      throw new Error("生产清单在首个有效快照前错误返回 304");
    }
    productionEtag = fetched.etag;
    productionLastModified = fetched.lastModified;

    const checkedAtMs = now();
    const sync = compareProductionContent({
      checkedAt: new Date(checkedAtMs).toISOString(),
      localBuildDate: options.localBuildDate,
      localRecords: options.localRecords,
      origin,
      production: manifestSnapshot,
      productionEtag,
      productionLastModified,
    });
    if (sync.counts.unexpected > 0) {
      throw new Error(
        `生产清单包含 ${sync.counts.unexpected} 条生产多出记录；已停止 source-scoped 等待`,
      );
    }
    const targetRecord = sync.records.find(
      (record) => record.sourcePath === options.target.sourcePath,
    );
    if (
      !targetRecord ||
      targetRecord.state === "unexpected" ||
      !["deployed", "pending", "missing"].includes(targetRecord.state)
    ) {
      throw new Error("生产同步报告未能唯一定位冻结目标");
    }
    await assertSourceFrozen(options.target, options.readSourceSha256);
    assertNotCancelled(options.signal);

    const observation: ProductionContentConvergenceObservation = {
      attempt: observations.length + 1,
      checkedAt: new Date(checkedAtMs).toISOString(),
      elapsedMs: Math.max(0, checkedAtMs - startedAtMs),
      remainingMs: Math.max(0, deadlineMs - checkedAtMs),
      state: targetRecord.state,
      response: fetched.status,
      manifestEtag: productionEtag,
      productionEtag: targetRecord.productionEtag,
      differences: [...targetRecord.differences],
    };
    observations.push(observation);
    options.onProgress?.(observation);

    if (targetRecord.state === "deployed") {
      return createReport(
        options,
        origin,
        startedAtMs,
        checkedAtMs,
        "deployed",
        observations,
        productionEtag,
        productionLastModified,
      );
    }
    if (checkedAtMs >= deadlineMs) {
      return createReport(
        options,
        origin,
        startedAtMs,
        checkedAtMs,
        "timeout",
        observations,
        productionEtag,
        productionLastModified,
      );
    }

    await sleep(
      Math.min(options.intervalMs, deadlineMs - checkedAtMs),
      options.signal,
    );
  }
}

const STATE_LABELS = {
  deployed: "已上线",
  pending: "待部署",
  missing: "生产缺失",
} as const;

export function formatProductionContentConvergenceText(
  report: ProductionContentConvergenceReport,
) {
  const latest = report.observations.at(-1);
  return [
    `生产内容收敛 · ${report.status === "deployed" ? "DEPLOYED" : "TIMEOUT"}`,
    `目标：${report.target.title}`,
    `来源：${report.target.sourcePath}`,
    `本地 ETag：${report.target.localEtag}`,
    `来源 SHA-256：${report.target.sourceSha256}`,
    `耗时：${report.elapsedMs}ms · ${report.attemptCount} 次尝试`,
    `最后状态：${latest ? STATE_LABELS[latest.state] : "没有有效观测"}`,
    `生产快照：${report.production.etag} · ${report.production.lastModified}`,
    "边界：只读取冻结的正式内容来源并请求生产 content.json；不会改写文章、提交或推送。",
  ].join("\n");
}

export function formatProductionContentConvergenceProgress(
  observation: ProductionContentConvergenceObservation,
) {
  return `第 ${observation.attempt} 次 · ${STATE_LABELS[observation.state]} · 剩余 ${Math.ceil(observation.remainingMs / 1000)} 秒`;
}
