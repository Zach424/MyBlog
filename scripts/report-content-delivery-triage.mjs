import { parseArgs } from "node:util";
import { inspectContentDeliveryTriageFromGit } from "./delivery-triage-git.mjs";

function fail(message) {
  console.error(`[delivery-triage] ${message}`);
  process.exit(2);
}

function shortOid(oid) {
  return `${oid.slice(0, 12)}…${oid.slice(-8)}`;
}

function formatText(report) {
  const { observation, pending, relation, route } = report;
  const lines = [
    "[delivery-triage] 证据边界：只读同一个本地 Git refs/HEAD 快照；未执行 fetch、push、status 或 deliver 命令。",
    `[delivery-triage] 当前分支：${observation.currentBranch ?? "detached HEAD"}`,
    `[delivery-triage] origin/main（最后本地观察）：${observation.trackingHead ? shortOid(observation.trackingHead) : "missing"}`,
    `[delivery-triage] local main：${shortOid(observation.localHead)}`,
    `[delivery-triage] 关系：${relation.status} · behind ${relation.behind ?? "unknown"} · ahead ${relation.ahead ?? "unknown"}`,
    `[delivery-triage] 路由：${route.kind}`,
  ];
  if (pending?.kind === "review") {
    lines.push(
      `[delivery-triage] 待同步正式复核：${pending.review.sourcePath}`,
      `[delivery-triage] 提交：${shortOid(pending.review.commitOid)} · ${pending.review.subject}`,
    );
  } else if (pending?.kind === "publication") {
    lines.push(
      `[delivery-triage] 待同步新内容发布：${pending.publication.title} · ${pending.publication.targetPath}`,
      `[delivery-triage] 提交：${shortOid(pending.publication.commitOid)} · ${pending.publication.changes.length} 条路径`,
    );
  }
  if (route.statusCommand) {
    lines.push(`[delivery-triage] 先读状态：${route.statusCommand}`);
  }
  if (route.deliverCommand) {
    lines.push(`[delivery-triage] 确认后执行：${route.deliverCommand}`);
  } else if (pending && !route.deliverable) {
    lines.push(
      "[delivery-triage] 写入锁：当前不在 main；只保留状态命令，不给 deliver 命令。",
    );
  } else if (relation.status === "synchronized") {
    lines.push("[delivery-triage] 没有待同步的正式复核或新内容发布。");
  } else if (pending === null) {
    lines.push("[delivery-triage] 当前提交需要人工检查 Git 状态。");
  }
  return lines.join("\n");
}

let args;
try {
  args = parseArgs({
    options: { format: { type: "string", default: "text" } },
    strict: true,
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
if (args.positionals.length !== 0) fail("该命令不接受位置参数");
if (!new Set(["json", "text"]).has(args.values.format)) {
  fail("--format 只能是 text 或 json");
}

let report;
try {
  report = inspectContentDeliveryTriageFromGit();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
console.log(
  args.values.format === "json"
    ? JSON.stringify(report, null, 2)
    : formatText(report),
);
if (report.relation.status !== "synchronized") process.exitCode = 1;
