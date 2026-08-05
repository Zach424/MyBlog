import { parseArgs } from "node:util";

import { resolveContentBuildDate } from "../build/content-build-date.ts";
import {
  formatInboxReadinessText,
  inspectInboxReadiness,
} from "../lib/content/inbox-readiness.ts";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function help() {
  return `用法：npm run content:inbox -- [选项]

选项：
  --date YYYY-MM-DD    使用固定报告日期（默认：Asia/Shanghai 今天）
  --format text|json   输出人类可读文本或 JSON（默认：text）
  --source PATH        只返回一个 inbox 草稿；仍扫描全库碰撞与共享附件
  --help               显示帮助

blocked 是需要作者处理的诊断，不改变命令退出码。报告不会移动、改写、提交或推送文件。`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      date: { type: "string" },
      format: { type: "string", default: "text" },
      help: { type: "boolean", short: "h", default: false },
      source: { type: "string" },
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

  const report = await inspectInboxReadiness(process.cwd(), reportDate, {
    ...(values.source === undefined ? {} : { sourcePath: values.source }),
  });
  console.log(
    values.format === "json"
      ? JSON.stringify(report, null, 2)
      : formatInboxReadinessText(report),
  );
}

try {
  await main();
} catch (error) {
  console.error(`[inbox] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
