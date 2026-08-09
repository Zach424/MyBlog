import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import {
  createPostDeliveryHandoff,
  createPostDeliveryHandoffTarget,
  formatPostDeliveryHandoffLine,
} from "../lib/content/post-delivery-handoff.ts";
import { PRODUCTION_CONTENT_DEFAULT_ORIGIN } from "../lib/content/production-sync.ts";
import { createContentReviewDeliveryReceipt } from "../lib/content/review-delivery.ts";
import { inspectContentReviewDeliveryFromGit } from "./review-delivery-git.mjs";

function stop(message, code = 1) {
  console.error(`[review-delivery] ${message}`);
  process.exit(code);
}

function git(args, { allowFailure = false, buffer = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: buffer ? null : "utf8",
    maxBuffer: 2_000_000,
    shell: false,
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} 失败，退出码 ${result.status}`);
  }
  return result;
}

function repositorySnapshot() {
  return {
    index: git(["ls-files", "--stage", "-z"], { buffer: true }).stdout,
    worktree: git(
      ["status", "--porcelain=v2", "-z", "--untracked-files=all"],
      { buffer: true },
    ).stdout,
  };
}

function samePendingReview(left, right) {
  return (
    left.relation.status === "pending-review" &&
    right.relation.status === "pending-review" &&
    left.observation.currentBranch === "main" &&
    right.observation.currentBranch === "main" &&
    left.observation.localHead === right.observation.localHead &&
    left.observation.trackingHead === right.observation.trackingHead &&
    JSON.stringify(left.pendingReview) === JSON.stringify(right.pendingReview)
  );
}

function formatText(receipt) {
  return [
    `[review-delivery] 已重新同步正式内容复核：${receipt.review.sourcePath}`,
    `[review-delivery] 提交：${receipt.review.commitOid}`,
    `[review-delivery] tree：${receipt.review.treeOid}`,
    `[review-delivery] blob：${receipt.review.blobOid}`,
    `[review-delivery] 精确命令：${receipt.transition.command}`,
    "[review-delivery] 后置证据：local main 与 origin/main tracking ref synchronized；HEAD/index/worktree 保持不变。",
    "[review-delivery] 未执行 fetch、rebase 或 reset。",
  ].join("\n");
}

let args;
try {
  args = parseArgs({
    options: {
      format: { type: "string", default: "text" },
      handoff: { type: "boolean", default: false },
    },
    strict: true,
  });
} catch (error) {
  stop(error instanceof Error ? error.message : String(error), 2);
}
if (args.positionals.length !== 0) stop("该命令不接受位置参数", 2);
if (!new Set(["json", "text"]).has(args.values.format)) {
  stop("--format 只能是 text 或 json", 2);
}

let before;
try {
  before = inspectContentReviewDeliveryFromGit();
} catch (error) {
  stop(error instanceof Error ? error.message : String(error));
}
if (before.observation.currentBranch !== "main") {
  stop("只能在 main 分支重新同步待交付正式复核");
}
if (before.relation.status !== "pending-review" || before.pendingReview === null) {
  stop(
    `当前没有可安全重新同步的精确待交付复核：${before.relation.status}；先运行 npm run content:review:status`,
  );
}

const initialSnapshot = repositorySnapshot();
let confirmed;
try {
  confirmed = inspectContentReviewDeliveryFromGit();
} catch (error) {
  stop(`重新同步前状态复查失败：${error instanceof Error ? error.message : String(error)}`);
}
if (!samePendingReview(before, confirmed)) {
  stop("待交付复核在执行前发生变化；未运行 push，请重新查看交付状态");
}

const review = confirmed.pendingReview;
const refspec = `${review.commitOid}:refs/heads/main`;
const push = git(["push", "origin", refspec], { allowFailure: true });
if (push.status !== 0) {
  if (push.stdout) process.stderr.write(push.stdout);
  if (push.stderr) process.stderr.write(push.stderr);
  const currentMain = git(["rev-parse", "refs/heads/main"], {
    allowFailure: true,
  }).stdout?.trim();
  stop(
    currentMain === review.commitOid
      ? "精确复核提交同步失败；本地提交保持不变，请修复连接或远端冲突后重新查看状态"
      : "精确复核提交同步失败，且本地 main 已发生变化；请保留现场检查 Git 状态",
  );
}

let after;
try {
  after = inspectContentReviewDeliveryFromGit();
} catch (error) {
  stop(
    `push 可能已完成，但无法读取后置交付证据；请运行 npm run content:review:status。${error instanceof Error ? ` ${error.message}` : ""}`,
  );
}
const finalSnapshot = repositorySnapshot();
let receipt;
try {
  receipt = createContentReviewDeliveryReceipt({
    after,
    before: confirmed,
    indexStable: Buffer.compare(initialSnapshot.index, finalSnapshot.index) === 0,
    worktreeStable:
      Buffer.compare(initialSnapshot.worktree, finalSnapshot.worktree) === 0,
  });
} catch (error) {
  stop(
    `push 可能已完成，但后置证据不完整；请运行 npm run content:review:status。${error instanceof Error ? ` ${error.message}` : ""}`,
  );
}

let handoff = null;
if (args.values.handoff) {
  try {
    const source = git(["cat-file", "blob", receipt.review.blobOid], {
      buffer: true,
    }).stdout;
    const target = createPostDeliveryHandoffTarget({
      origin: PRODUCTION_CONTENT_DEFAULT_ORIGIN,
      source,
      sourcePath: receipt.review.sourcePath,
    });
    handoff = createPostDeliveryHandoff({
      commitOid: receipt.review.commitOid,
      delivery: "review",
      target,
    });
  } catch (error) {
    stop(
      `Git 交付已经完成，但无法从已交付 commit 生成生产等待接力；请手动运行等待命令，不会重新提交或推送。${error instanceof Error ? ` ${error.message}` : ""}`,
    );
  }
}

console.log(
  args.values.format === "json"
    ? JSON.stringify(receipt, null, 2)
    : formatText(receipt),
);
if (handoff) console.log(formatPostDeliveryHandoffLine(handoff));
