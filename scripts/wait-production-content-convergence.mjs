import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { resolveContentBuildDate } from "../build/content-build-date.ts";
import { loadContentRepository } from "../build/validate-content.ts";
import { isPublished } from "../lib/content/contract.ts";
import {
  createProductionContentConvergenceTarget,
  formatProductionContentConvergenceProgress,
  formatProductionContentConvergenceText,
  normalizeProductionConvergenceSourcePath,
  PRODUCTION_CONTENT_CONVERGENCE_DEFAULTS,
  ProductionContentConvergenceCancelledError,
  waitForProductionContentConvergence,
} from "../lib/content/production-convergence.ts";
import { resolveProductionOrigin } from "../lib/content/production-sync.ts";

const DEFAULT_PRODUCTION_ORIGIN = "https://blog-iota-five-59.vercel.app";
const PROGRESS_PREFIX = "[production-convergence-progress] ";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function help() {
  return `用法：npm run content:production:wait -- --source PATH [选项]

选项：
  --source PATH          必填；content/posts|projects/<slug>.md
  --origin URL           生产站点 origin（默认：${DEFAULT_PRODUCTION_ORIGIN}）
  --date YYYY-MM-DD      本地公开范围日期（默认：Asia/Shanghai 今天）
  --format text|json     最终回执格式（默认：text）
  --timeout-ms N         总等待时限（1000–900000，默认：${PRODUCTION_CONTENT_CONVERGENCE_DEFAULTS.timeoutMs}）
  --interval-ms N        轮询间隔（250–60000，默认：${PRODUCTION_CONTENT_CONVERGENCE_DEFAULTS.intervalMs}）
  --request-timeout-ms N 单次请求时限（500–30000，默认：${PRODUCTION_CONTENT_CONVERGENCE_DEFAULTS.requestTimeoutMs}）
  --help                 显示帮助

退出码：0 已上线；2 在总时限内仍待部署/缺失；1 协议、来源或网络失败；130 已取消。
该命令冻结精确来源字节与公开 Markdown ETag，只读轮询生产 /content.json；不会改写文章、提交或推送。`;
}

function validIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function integerOption(value, name, minimum, maximum) {
  if (!/^\d+$/u.test(value)) {
    throw new Error(`${name} 必须是 ${minimum}–${maximum} 的整数，收到：${value}`);
  }
  const result = Number(value);
  if (result < minimum || result > maximum) {
    throw new Error(`${name} 必须是 ${minimum}–${maximum} 的整数，收到：${value}`);
  }
  return result;
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function main(signal) {
  const { values } = parseArgs({
    options: {
      date: { type: "string" },
      format: { type: "string", default: "text" },
      help: { type: "boolean", short: "h", default: false },
      "interval-ms": {
        type: "string",
        default: String(PRODUCTION_CONTENT_CONVERGENCE_DEFAULTS.intervalMs),
      },
      origin: { type: "string", default: DEFAULT_PRODUCTION_ORIGIN },
      "request-timeout-ms": {
        type: "string",
        default: String(PRODUCTION_CONTENT_CONVERGENCE_DEFAULTS.requestTimeoutMs),
      },
      source: { type: "string" },
      "timeout-ms": {
        type: "string",
        default: String(PRODUCTION_CONTENT_CONVERGENCE_DEFAULTS.timeoutMs),
      },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    console.log(help());
    return;
  }
  if (!values.source) throw new Error("必须提供 --source PATH");
  if (!new Set(["text", "json"]).has(values.format)) {
    throw new Error(`--format 只支持 text 或 json，收到：${values.format}`);
  }
  const localBuildDate = values.date ?? resolveContentBuildDate();
  if (!validIsoDate(localBuildDate)) {
    throw new Error(`--date 必须是有效的 YYYY-MM-DD 日期，收到：${localBuildDate}`);
  }
  const timeoutMs = integerOption(values["timeout-ms"], "--timeout-ms", 1_000, 900_000);
  const intervalMs = integerOption(values["interval-ms"], "--interval-ms", 250, 60_000);
  const requestTimeoutMs = integerOption(
    values["request-timeout-ms"],
    "--request-timeout-ms",
    500,
    30_000,
  );
  if (intervalMs >= timeoutMs) {
    throw new Error("--interval-ms 必须小于 --timeout-ms");
  }
  if (requestTimeoutMs >= timeoutMs) {
    throw new Error("--request-timeout-ms 必须小于 --timeout-ms");
  }

  const origin = resolveProductionOrigin(values.origin);
  const sourcePath = normalizeProductionConvergenceSourcePath(values.source);
  const absoluteSource = resolve(process.cwd(), sourcePath);
  const sourceSha256 = await sha256File(absoluteSource);
  const { posts, projects } = await loadContentRepository(process.cwd());
  const buildTime = new Date(`${localBuildDate}T12:00:00.000Z`);
  const localRecords = [...posts, ...projects].filter((record) =>
    isPublished(record, buildTime),
  );
  const target = createProductionContentConvergenceTarget({
    localRecords,
    origin,
    sourcePath,
    sourceSha256,
  });
  const report = await waitForProductionContentConvergence({
    intervalMs,
    localBuildDate,
    localRecords,
    onProgress: (observation) => {
      console.error(
        values.format === "json"
          ? `${PROGRESS_PREFIX}${JSON.stringify(observation)}`
          : `[production-convergence] ${formatProductionContentConvergenceProgress(observation)}`,
      );
    },
    origin,
    readSourceSha256: () => sha256File(absoluteSource),
    requestTimeoutMs,
    signal,
    target,
    timeoutMs,
  });

  console.log(
    values.format === "json"
      ? JSON.stringify(report, null, 2)
      : formatProductionContentConvergenceText(report),
  );
  if (report.status === "timeout") process.exitCode = 2;
}

const controller = new AbortController();
const cancel = () => controller.abort();
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);

try {
  await main(controller.signal);
} catch (error) {
  if (
    error instanceof ProductionContentConvergenceCancelledError ||
    controller.signal.aborted
  ) {
    console.error("[production-convergence] 已取消；没有改写文章、提交或推送。");
    process.exitCode = 130;
  } else {
    console.error(
      `[production-convergence] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
} finally {
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
