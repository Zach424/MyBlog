import { spawnSync } from "node:child_process";
import {
  analyzeContentReviewDelivery,
  CONTENT_REVIEW_LOCAL_REF,
  CONTENT_REVIEW_TRACKING_REF,
} from "../lib/content/review-delivery.ts";

function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
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

function nulPaths(value) {
  return value
    .split("\0")
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"));
}

function readPendingCommit(cwd, localHead) {
  const paths = nulPaths(
    git(cwd, [
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      "-z",
      localHead,
    ]).stdout,
  );
  let blobOid = null;
  if (paths.length === 1) {
    const blob = git(cwd, ["rev-parse", `${localHead}:${paths[0]}`], {
      allowFailure: true,
    });
    if (blob.status === 0) blobOid = blob.stdout.trim();
  }
  return {
    blobOid,
    commitOid: localHead,
    parentOids: git(cwd, ["show", "-s", "--format=%P", localHead])
      .stdout.trim()
      .split(/\s+/u)
      .filter(Boolean),
    paths,
    subject: git(cwd, ["show", "-s", "--format=%s", localHead]).stdout.trim(),
    treeOid: git(cwd, ["show", "-s", "--format=%T", localHead]).stdout.trim(),
  };
}

export function inspectContentReviewDeliveryFromGit(cwd = process.cwd()) {
  const local = git(cwd, ["rev-parse", "--verify", CONTENT_REVIEW_LOCAL_REF], {
    allowFailure: true,
  });
  if (local.status !== 0) {
    throw new Error("找不到本地 main；无法检查正式复核交付状态");
  }
  const localHead = local.stdout.trim();
  const branchValue = git(cwd, ["branch", "--show-current"]).stdout.trim();
  const currentBranch = branchValue || null;
  const tracking = git(
    cwd,
    ["rev-parse", "--verify", CONTENT_REVIEW_TRACKING_REF],
    { allowFailure: true },
  );
  if (tracking.status !== 0) {
    return analyzeContentReviewDelivery({
      ahead: null,
      behind: null,
      currentBranch,
      localHead,
      pendingCommit: null,
      trackingHead: null,
    });
  }

  const trackingHead = tracking.stdout.trim();
  const counts = git(cwd, [
    "rev-list",
    "--left-right",
    "--count",
    `${CONTENT_REVIEW_TRACKING_REF}...${CONTENT_REVIEW_LOCAL_REF}`,
  ]).stdout.trim().split(/\s+/u).map(Number);
  if (
    counts.length !== 2 ||
    counts.some((value) => !Number.isInteger(value) || value < 0)
  ) {
    throw new Error("无法解析 main 与 origin/main tracking ref 的提交关系");
  }
  const [behind, ahead] = counts;
  const pendingCommit = ahead === 1 && behind === 0
    ? readPendingCommit(cwd, localHead)
    : null;
  return analyzeContentReviewDelivery({
    ahead,
    behind,
    currentBranch,
    localHead,
    pendingCommit,
    trackingHead,
  });
}
