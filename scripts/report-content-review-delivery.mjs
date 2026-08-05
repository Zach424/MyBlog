import { parseArgs } from "node:util";
import { inspectContentReviewDeliveryFromGit } from "./review-delivery-git.mjs";

function fail(message) {
  console.error(`[review-delivery] ${message}`);
  process.exit(2);
}

function shortOid(oid) {
  return `${oid.slice(0, 12)}…${oid.slice(-8)}`;
}

function formatText(report) {
  const { observation, pendingReview, recovery, relation } = report;
  const tracking = observation.trackingHead
    ? shortOid(observation.trackingHead)
    : "missing";
  const lines = [
    "[review-delivery] 证据边界：只读本地 Git refs；未执行 fetch、push 或历史修改。",
    `[review-delivery] 当前分支：${observation.currentBranch ?? "detached HEAD"}`,
    `[review-delivery] origin/main（最后本地观察）：${tracking}`,
    `[review-delivery] local main：${shortOid(observation.localHead)}`,
    `[review-delivery] 关系：${relation.status} · behind ${relation.behind ?? "unknown"} · ahead ${relation.ahead ?? "unknown"}`,
  ];
  if (pendingReview) {
    lines.push(
      `[review-delivery] 待同步复核：${pendingReview.sourcePath}`,
      `[review-delivery] 提交：${shortOid(pendingReview.commitOid)} · ${pendingReview.subject}`,
      `[review-delivery] tree：${pendingReview.treeOid}`,
      `[review-delivery] blob：${pendingReview.blobOid}`,
      `[review-delivery] 恢复命令：${recovery.command}`,
    );
  } else if (relation.status === "synchronized") {
    lines.push("[review-delivery] 没有待同步正式内容复核。");
  } else {
    lines.push(
      "[review-delivery] 当前关系不能证明为单个待交付复核；请先人工检查 Git 状态。",
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
  report = inspectContentReviewDeliveryFromGit();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
console.log(
  args.values.format === "json"
    ? JSON.stringify(report, null, 2)
    : formatText(report),
);
if (report.relation.status !== "synchronized") process.exitCode = 1;
