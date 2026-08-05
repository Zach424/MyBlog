import { spawnSync } from "node:child_process";
import {
  analyzeContentReviewDelivery,
} from "../lib/content/review-delivery.ts";
import { readContentDeliveryGitSnapshot } from "./delivery-git-snapshot.mjs";

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

export function readContentReviewCommitFromGit(
  commitOid,
  cwd = process.cwd(),
) {
  return readPendingCommit(cwd, commitOid);
}

export function inspectContentReviewDeliveryFromGit(cwd = process.cwd()) {
  const snapshot = readContentDeliveryGitSnapshot(cwd);
  const { ahead, behind, localHead } = snapshot;
  const pendingCommit = ahead === 1 && behind === 0
    ? readPendingCommit(cwd, localHead)
    : null;
  return analyzeContentReviewDelivery({
    ...snapshot,
    pendingCommit,
  });
}
