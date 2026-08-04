import { parseArgs } from "node:util";

import { resolveContentBuildDate } from "../build/content-build-date.ts";
import { loadContentRepository } from "../build/validate-content.ts";
import { isPublished } from "../lib/content/contract.ts";
import {
  EXTERNAL_LINK_CHECK_DEFAULTS,
  checkExternalLinks,
  createExternalLinkInventory,
  externalLinkReportHasBrokenEntries,
  formatExternalLinkReportText,
} from "../lib/content/external-links.ts";

function help() {
  return `用法：npm run links:external -- [选项]

选项：
  --check                 显式发送 HEAD 请求检查当前健康状态
  --format text|json      输出人类可读文本或 JSON（默认：text）
  --timeout-ms N          每次 HEAD 超时（500–30000，默认：${EXTERNAL_LINK_CHECK_DEFAULTS.timeoutMs}）
  --concurrency N         最大并发（1–8，默认：${EXTERNAL_LINK_CHECK_DEFAULTS.concurrency}）
  --retries N             瞬时失败重试次数（0–2，默认：${EXTERNAL_LINK_CHECK_DEFAULTS.retries}）
  --max-redirects N       单 URL 重定向上限（0–10，默认：${EXTERNAL_LINK_CHECK_DEFAULTS.maxRedirects}）
  --fail-on-broken        显式检查后发现异常/本地问题时返回非零
  --help                  显示帮助

默认模式只读取公开 Markdown 并生成确定性库存，不访问网络。
--check 只发送 HEAD、固定公网 DNS 地址并逐跳验证 HTTPS；不下载正文，不自动改写链接。`;
}

function integerOption(name, value) {
  if (!/^\d+$/u.test(value)) throw new Error(`${name} 必须是非负整数，收到：${value}`);
  return Number(value);
}

async function main() {
  const { values } = parseArgs({
    options: {
      check: { type: "boolean", default: false },
      concurrency: {
        type: "string",
        default: String(EXTERNAL_LINK_CHECK_DEFAULTS.concurrency),
      },
      "fail-on-broken": { type: "boolean", default: false },
      format: { type: "string", default: "text" },
      help: { type: "boolean", short: "h", default: false },
      "max-redirects": {
        type: "string",
        default: String(EXTERNAL_LINK_CHECK_DEFAULTS.maxRedirects),
      },
      retries: {
        type: "string",
        default: String(EXTERNAL_LINK_CHECK_DEFAULTS.retries),
      },
      "timeout-ms": {
        type: "string",
        default: String(EXTERNAL_LINK_CHECK_DEFAULTS.timeoutMs),
      },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    console.log(help());
    return;
  }
  if (!values.check && values["fail-on-broken"]) {
    throw new Error("--fail-on-broken 只能与 --check 一起使用");
  }
  if (!["text", "json"].includes(values.format)) {
    throw new Error(`--format 只支持 text 或 json，收到：${values.format}`);
  }

  const buildDate = resolveContentBuildDate();
  const buildTime = new Date(`${buildDate}T12:00:00Z`);
  const { posts, projects } = await loadContentRepository(process.cwd());
  const publishedRecords = [...posts, ...projects].filter((record) =>
    isPublished(record, buildTime),
  );
  const inventory = createExternalLinkInventory(publishedRecords);
  const report = values.check
    ? await checkExternalLinks(inventory, {
        concurrency: integerOption("--concurrency", values.concurrency),
        maxRedirects: integerOption("--max-redirects", values["max-redirects"]),
        retries: integerOption("--retries", values.retries),
        timeoutMs: integerOption("--timeout-ms", values["timeout-ms"]),
      })
    : inventory;

  console.log(
    values.format === "json"
      ? JSON.stringify(report, null, 2)
      : formatExternalLinkReportText(report),
  );
  if (values["fail-on-broken"] && externalLinkReportHasBrokenEntries(report)) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(`[links] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
