import { parseArgs } from "node:util";
import { inspectContentPublishDeliveryFromGit } from "./publish-delivery-git.mjs";

function fail(message) {
  console.error(`[publish-delivery] ${message}`);
  process.exit(2);
}

function shortOid(oid) {
  return `${oid.slice(0, 12)}…${oid.slice(-8)}`;
}

function formatText(report) {
  const { observation, pendingPublication, recovery, relation } = report;
  const lines = [
    "[publish-delivery] 证据边界：只读本地 Git refs；未执行 fetch、push 或历史修改。",
    `[publish-delivery] 当前分支：${observation.currentBranch ?? "detached HEAD"}`,
    `[publish-delivery] origin/main（最后本地观察）：${observation.trackingHead ? shortOid(observation.trackingHead) : "missing"}`,
    `[publish-delivery] local main：${shortOid(observation.localHead)}`,
    `[publish-delivery] 关系：${relation.status} · behind ${relation.behind ?? "unknown"} · ahead ${relation.ahead ?? "unknown"}`,
  ];
  if (pendingPublication) {
    lines.push(
      `[publish-delivery] 待同步发布：${pendingPublication.title} · ${pendingPublication.targetPath}`,
      `[publish-delivery] 提交：${shortOid(pendingPublication.commitOid)} · ${pendingPublication.subject}`,
      `[publish-delivery] tree：${pendingPublication.treeOid}`,
      `[publish-delivery] 发布包：${pendingPublication.changes.length} 条路径 · ${pendingPublication.attachmentCount} 个附件 · inbox 删除 ${pendingPublication.sourceDeletionTracked ? "tracked" : "not-in-commit"}`,
    );
    for (const change of pendingPublication.changes) {
      lines.push(
        `[publish-delivery] ${change.status.toUpperCase()} · ${change.path} · ${change.newBlobOid ?? change.oldBlobOid}`,
      );
    }
    lines.push(`[publish-delivery] 恢复命令：${recovery.command}`);
  } else if (relation.status === "synchronized") {
    lines.push("[publish-delivery] 没有待同步新内容发布。");
  } else {
    lines.push(
      "[publish-delivery] 当前关系不能证明为单个原子发布包；请先人工检查 Git 状态。",
    );
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
  report = inspectContentPublishDeliveryFromGit();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
console.log(
  args.values.format === "json"
    ? JSON.stringify(report, null, 2)
    : formatText(report),
);
if (report.relation.status !== "synchronized") process.exitCode = 1;
