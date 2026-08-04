import { appendFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { resolveContentBuildDate } from "../build/content-build-date.ts";
import {
  STAGING_MEDIA_STALE_DAYS,
  formatStagingMediaAnnotations,
  formatStagingMediaMarkdown,
  formatStagingMediaText,
  inspectStagingMediaRepository,
} from "../lib/content/staging-media.ts";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function help() {
  return `用法：npm run media:staging -- [选项]

选项：
  --date YYYY-MM-DD    使用固定报告日期（默认：Asia/Shanghai 今天）
  --stale-days N       陈旧复核阈值（默认：${STAGING_MEDIA_STALE_DAYS}）
  --format text|json   输出人类可读文本或 JSON（默认：text）
  --github-summary     写入 GITHUB_STEP_SUMMARY 并输出 Actions 注解
  --help               显示帮助

报告只提供库存、引用和年龄证据，不会自动删除文件。`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      date: { type: "string" },
      format: { type: "string", default: "text" },
      "github-summary": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      "stale-days": { type: "string", default: String(STAGING_MEDIA_STALE_DAYS) },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    console.log(help());
    return;
  }

  const reportDate = values.date ?? resolveContentBuildDate();
  if (!isIsoDate(reportDate)) {
    throw new Error(`--date 必须是有效的 YYYY-MM-DD 日期，收到：${reportDate}`);
  }
  if (!["text", "json"].includes(values.format)) {
    throw new Error(`--format 只支持 text 或 json，收到：${values.format}`);
  }
  const staleAfterDays = Number(values["stale-days"]);
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1) {
    throw new Error(`--stale-days 必须是大于 0 的整数，收到：${values["stale-days"]}`);
  }

  const report = await inspectStagingMediaRepository(process.cwd(), reportDate, {
    staleAfterDays,
  });
  console.log(
    values.format === "json"
      ? JSON.stringify(report, null, 2)
      : formatStagingMediaText(report),
  );

  if (values["github-summary"]) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
      throw new Error("--github-summary 需要 GITHUB_STEP_SUMMARY 环境变量");
    }
    await appendFile(summaryPath, `${formatStagingMediaMarkdown(report)}\n`, "utf8");
    for (const annotation of formatStagingMediaAnnotations(report)) {
      console.log(annotation);
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(`[staging] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
