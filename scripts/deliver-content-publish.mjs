import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import {
  createPostDeliveryHandoff,
  createPostDeliveryHandoffTarget,
  formatPostDeliveryHandoffLine,
} from "../lib/content/post-delivery-handoff.ts";
import { createContentPublishDeliveryReceipt } from "../lib/content/publish-delivery.ts";
import { PRODUCTION_CONTENT_DEFAULT_ORIGIN } from "../lib/content/production-sync.ts";
import {
  inspectContentPublishDeliveryFromGit,
  readContentPublishCommitFromGit,
} from "./publish-delivery-git.mjs";

function stop(message, code = 1) {
  console.error(`[publish-delivery] ${message}`);
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

function samePendingPublication(left, right) {
  return (
    left.relation.status === "pending-publication" &&
    right.relation.status === "pending-publication" &&
    left.observation.currentBranch === "main" &&
    right.observation.currentBranch === "main" &&
    left.observation.localHead === right.observation.localHead &&
    left.observation.trackingHead === right.observation.trackingHead &&
    JSON.stringify(left.pendingPublication) ===
      JSON.stringify(right.pendingPublication)
  );
}

function sameManifest(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatText(receipt) {
  return [
    `[publish-delivery] 已重新同步新内容发布：${receipt.publication.targetPath}`,
    `[publish-delivery] 提交：${receipt.publication.commitOid}`,
    `[publish-delivery] tree：${receipt.publication.treeOid}`,
    `[publish-delivery] target blob：${receipt.publication.targetBlobOid}`,
    `[publish-delivery] 原子清单：${receipt.publication.changes.length} 条路径，${receipt.publication.attachmentCount} 个归档媒体。`,
    `[publish-delivery] 精确命令：${receipt.transition.command}`,
    "[publish-delivery] 后置证据：local main 与 origin/main tracking ref synchronized；HEAD/index/worktree/manifest 保持不变。",
    "[publish-delivery] 未执行 fetch、rebase 或 reset。",
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
  before = inspectContentPublishDeliveryFromGit();
} catch (error) {
  stop(error instanceof Error ? error.message : String(error));
}
if (before.observation.currentBranch !== "main") {
  stop("只能在 main 分支重新同步待交付新内容发布");
}
if (
  before.relation.status !== "pending-publication" ||
  before.pendingPublication === null
) {
  stop(
    `当前没有可安全重新同步的精确待交付发布包：${before.relation.status}；先运行 npm run content:publish:status`,
  );
}

const initialSnapshot = repositorySnapshot();
const initialManifest = readContentPublishCommitFromGit(
  before.pendingPublication.commitOid,
);
let confirmed;
try {
  confirmed = inspectContentPublishDeliveryFromGit();
} catch (error) {
  stop(`重新同步前状态复查失败：${error instanceof Error ? error.message : String(error)}`);
}
if (!samePendingPublication(before, confirmed)) {
  stop("待交付发布包在执行前发生变化；未运行 push，请重新查看交付状态");
}
const confirmedManifest = readContentPublishCommitFromGit(
  confirmed.pendingPublication.commitOid,
);
if (!sameManifest(initialManifest, confirmedManifest)) {
  stop("待交付发布路径与 blob 清单在执行前发生变化；未运行 push，请重新查看交付状态");
}

const publication = confirmed.pendingPublication;
const refspec = `${publication.commitOid}:refs/heads/main`;
const push = git(["push", "origin", refspec], { allowFailure: true });
if (push.status !== 0) {
  if (push.stdout) process.stderr.write(push.stdout);
  if (push.stderr) process.stderr.write(push.stderr);
  const currentMain = git(["rev-parse", "refs/heads/main"], {
    allowFailure: true,
  }).stdout?.trim();
  stop(
    currentMain === publication.commitOid
      ? "精确发布提交同步失败；本地发布提交保持不变，请修复连接或远端冲突后重新查看状态"
      : "精确发布提交同步失败，且本地 main 已发生变化；请保留现场检查 Git 状态",
  );
}

let after;
try {
  after = inspectContentPublishDeliveryFromGit();
} catch (error) {
  stop(
    `push 可能已完成，但无法读取后置交付证据；请运行 npm run content:publish:status。${error instanceof Error ? ` ${error.message}` : ""}`,
  );
}
const finalManifest = readContentPublishCommitFromGit(publication.commitOid);
const finalSnapshot = repositorySnapshot();
let receipt;
try {
  receipt = createContentPublishDeliveryReceipt({
    after,
    before: confirmed,
    indexStable: Buffer.compare(initialSnapshot.index, finalSnapshot.index) === 0,
    manifestStable:
      sameManifest(initialManifest, confirmedManifest) &&
      sameManifest(confirmedManifest, finalManifest),
    worktreeStable:
      Buffer.compare(initialSnapshot.worktree, finalSnapshot.worktree) === 0,
  });
} catch (error) {
  stop(
    `push 可能已完成，但后置证据不完整；请运行 npm run content:publish:status。${error instanceof Error ? ` ${error.message}` : ""}`,
  );
}

let handoff = null;
if (args.values.handoff) {
  try {
    const source = git(
      ["cat-file", "blob", receipt.publication.targetBlobOid],
      { buffer: true },
    ).stdout;
    const target = createPostDeliveryHandoffTarget({
      origin: PRODUCTION_CONTENT_DEFAULT_ORIGIN,
      source,
      sourcePath: receipt.publication.targetPath,
    });
    handoff = createPostDeliveryHandoff({
      commitOid: receipt.publication.commitOid,
      delivery: "publication",
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
