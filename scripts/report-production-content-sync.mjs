import { parseArgs } from "node:util";

import { resolveContentBuildDate } from "../build/content-build-date.ts";
import { loadContentRepository } from "../build/validate-content.ts";
import { isPublished } from "../lib/content/contract.ts";
import {
  PRODUCTION_CONTENT_SYNC_DEFAULTS,
  compareProductionContent,
  fetchProductionContentManifest,
  formatProductionContentSyncText,
  resolveProductionOrigin,
} from "../lib/content/production-sync.ts";

const DEFAULT_PRODUCTION_ORIGIN = "https://blog-iota-five-59.vercel.app";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function help() {
  return `用法：npm run content:production -- [选项]

选项：
  --origin URL          生产站点 origin（默认：${DEFAULT_PRODUCTION_ORIGIN}）
  --date YYYY-MM-DD     本地公开范围日期（默认：Asia/Shanghai 今天）
  --format text|json    输出人类可读文本或 JSON（默认：text）
  --timeout-ms N        生产清单请求超时（500–30000，默认：${PRODUCTION_CONTENT_SYNC_DEFAULTS.timeoutMs}）
  --fail-on-drift       待部署、缺失或多出内容存在时返回非零
  --help                显示帮助

该命令只读取本地正式内容并请求生产 /content.json；不会改写文章、提交或推送。`;
}

function validIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function timeoutOption(value) {
  if (!/^\d+$/u.test(value)) {
    throw new Error(`--timeout-ms 必须是 500–30000 的整数，收到：${value}`);
  }
  const timeoutMs = Number(value);
  if (timeoutMs < 500 || timeoutMs > 30_000) {
    throw new Error(`--timeout-ms 必须是 500–30000 的整数，收到：${value}`);
  }
  return timeoutMs;
}

async function main() {
  const { values } = parseArgs({
    options: {
      date: { type: "string" },
      "fail-on-drift": { type: "boolean", default: false },
      format: { type: "string", default: "text" },
      help: { type: "boolean", short: "h", default: false },
      origin: { type: "string", default: DEFAULT_PRODUCTION_ORIGIN },
      "timeout-ms": {
        type: "string",
        default: String(PRODUCTION_CONTENT_SYNC_DEFAULTS.timeoutMs),
      },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    console.log(help());
    return;
  }
  const localBuildDate = values.date ?? resolveContentBuildDate();
  if (!validIsoDate(localBuildDate)) {
    throw new Error(`--date 必须是有效的 YYYY-MM-DD 日期，收到：${localBuildDate}`);
  }
  if (!new Set(["text", "json"]).has(values.format)) {
    throw new Error(`--format 只支持 text 或 json，收到：${values.format}`);
  }
  const origin = resolveProductionOrigin(values.origin);
  const timeoutMs = timeoutOption(values["timeout-ms"]);
  const { posts, projects } = await loadContentRepository(process.cwd());
  const buildTime = new Date(`${localBuildDate}T12:00:00.000Z`);
  const localRecords = [...posts, ...projects].filter((record) =>
    isPublished(record, buildTime),
  );
  const remote = await fetchProductionContentManifest(origin, { timeoutMs });
  const report = compareProductionContent({
    checkedAt: new Date().toISOString(),
    localBuildDate,
    localRecords,
    origin,
    production: remote.manifest,
    productionEtag: remote.etag,
    productionLastModified: remote.lastModified,
  });

  console.log(
    values.format === "json"
      ? JSON.stringify(report, null, 2)
      : formatProductionContentSyncText(report),
  );
  if (values["fail-on-drift"] && report.status === "attention") {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(`[production-sync] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
