import { parseArgs } from "node:util";
import { inspectAuthorEnvironment } from "./author-doctor-environment.mjs";

function fail(message) {
  console.error(`[author-doctor] ${message}`);
  process.exit(2);
}

function formatText(report) {
  const lines = [
    "[author-doctor] 证据边界：只读本机运行时、Git、本地工作区与 Vault；未安装依赖、未修改配置或文件、未读取凭据、未访问网络。",
    `[author-doctor] ${report.status === "ready" ? "AUTHOR READY" : "HOLD"} · ${report.summary.passed}/${report.summary.total} pass · ${report.summary.attention} attention`,
  ];
  for (const check of report.checks) {
    lines.push(
      `[author-doctor] ${check.status === "pass" ? "PASS" : "ATTENTION"} · ${check.group.toUpperCase()} · ${check.label} · ${check.observed}`,
    );
    if (check.resolution) {
      lines.push(`[author-doctor]   修复：${check.resolution}`);
    }
  }
  lines.push(
    "[author-doctor] 该报告只检查发布前置条件；不替代 content status、delivery status 或 release:check。",
  );
  return lines.join("\n");
}

let args;
try {
  args = parseArgs({
    options: {
      format: { default: "text", type: "string" },
      "plugin-bundle": { default: false, type: "boolean" },
      "plugin-provenance": { default: false, type: "boolean" },
    },
    strict: true,
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
if (args.positionals.length !== 0) fail("该命令不接受位置参数");
if (!new Set(["json", "text"]).has(args.values.format)) {
  fail("--format 只能是 text 或 json");
}
if (args.values["plugin-bundle"] && args.values["plugin-provenance"]) {
  fail("--plugin-bundle 与 --plugin-provenance 不能同时使用");
}

let report;
try {
  report = await inspectAuthorEnvironment(process.cwd(), {
    pluginBundle:
      args.values["plugin-bundle"] ||
      args.values["plugin-provenance"] ||
      args.values.format === "text",
    pluginProvenance:
      args.values["plugin-provenance"] || args.values.format === "text",
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
console.log(
  args.values.format === "json"
    ? JSON.stringify(report, null, 2)
    : formatText(report),
);
if (report.status !== "ready") process.exitCode = 1;
