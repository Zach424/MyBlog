import { appendFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { resolveContentBuildDate } from "../build/content-build-date.ts";
import { loadContentRepository } from "../build/validate-content.ts";
import {
  createContentMaintenanceReport,
  formatContentMaintenanceAnnotations,
  formatContentMaintenanceMarkdown,
  formatContentMaintenanceText,
} from "../lib/content/maintenance.ts";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function help() {
  return `用法：npm run content:status -- [选项]

选项：
  --date YYYY-MM-DD    使用固定报告日期（默认：Asia/Shanghai 今天）
  --format text|json   输出人类可读文本或 JSON（默认：text）
  --github-summary     写入 GITHUB_STEP_SUMMARY 并输出 Actions 注解
  --help               显示帮助`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      date: { type: "string" },
      format: { type: "string", default: "text" },
      "github-summary": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    console.log(help());
    return;
  }

  const buildDate = values.date ?? resolveContentBuildDate();
  if (!isIsoDate(buildDate)) {
    throw new Error(`--date 必须是有效的 YYYY-MM-DD 日期，收到：${buildDate}`);
  }
  if (!["text", "json"].includes(values.format)) {
    throw new Error(`--format 只支持 text 或 json，收到：${values.format}`);
  }

  const { posts, projects } = await loadContentRepository(process.cwd());
  const report = createContentMaintenanceReport(
    [...posts, ...projects],
    buildDate,
  );

  console.log(
    values.format === "json"
      ? JSON.stringify(report, null, 2)
      : formatContentMaintenanceText(report),
  );

  if (values["github-summary"]) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
      throw new Error("--github-summary 需要 GITHUB_STEP_SUMMARY 环境变量");
    }
    await appendFile(
      summaryPath,
      `${formatContentMaintenanceMarkdown(report)}\n`,
      "utf8",
    );
    for (const annotation of formatContentMaintenanceAnnotations(report)) {
      console.log(annotation);
    }
  }

  if (report.counts.overdue > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(`[maintenance] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
