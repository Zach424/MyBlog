import { spawnSync } from "node:child_process";
import {
  analyzeContentPublishDelivery,
  CONTENT_PUBLISH_LOCAL_REF,
  CONTENT_PUBLISH_TRACKING_REF,
} from "../lib/content/publish-delivery.ts";
import { parsePostFile, parseProjectFile } from "../lib/content/contract.ts";

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

function objectId(value) {
  return /^0+$/u.test(value) ? null : value;
}

function readChanges(cwd, localHead) {
  const fields = git(cwd, [
    "diff-tree",
    "--no-commit-id",
    "--raw",
    "-r",
    "-z",
    "--no-renames",
    "--no-abbrev",
    localHead,
  ]).stdout.split("\0");
  if (fields.at(-1) === "") fields.pop();
  if (fields.length % 2 !== 0) {
    throw new Error("无法解析待交付发布提交的 raw diff");
  }
  const changes = [];
  for (let index = 0; index < fields.length; index += 2) {
    const metadata = fields[index];
    const path = fields[index + 1].replaceAll("\\", "/");
    const match = metadata.match(
      /^:\d{6} \d{6} ([a-f0-9]+) ([a-f0-9]+) ([A-Z])$/u,
    );
    if (!match) throw new Error("无法解析待交付发布提交的 raw diff 元数据");
    changes.push({
      newBlobOid: objectId(match[2]),
      oldBlobOid: objectId(match[1]),
      path,
      status:
        match[3] === "A" ? "added" : match[3] === "D" ? "deleted" : "modified",
    });
  }
  return changes.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

function readPublication(cwd, localHead, changes) {
  const targets = changes.filter(
    ({ path, status }) =>
      status === "added" &&
      /^content\/(?:posts|projects)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(path),
  );
  if (targets.length !== 1) return null;
  const targetPath = targets[0].path;
  const content = git(cwd, ["show", `${localHead}:${targetPath}`], {
    allowFailure: true,
  });
  if (content.status !== 0) return null;
  try {
    const record = targetPath.startsWith("content/posts/")
      ? parsePostFile(targetPath, content.stdout)
      : parseProjectFile(targetPath, content.stdout);
    if (record.draft) return null;
    return {
      kind: record.kind,
      slug: record.slug,
      targetPath,
      title: record.title,
    };
  } catch {
    return null;
  }
}

function readPendingCommit(cwd, localHead) {
  const changes = readChanges(cwd, localHead);
  return {
    changes,
    commitOid: localHead,
    parentOids: git(cwd, ["show", "-s", "--format=%P", localHead])
      .stdout.trim()
      .split(/\s+/u)
      .filter(Boolean),
    publication: readPublication(cwd, localHead, changes),
    subject: git(cwd, ["show", "-s", "--format=%s", localHead]).stdout.trim(),
    treeOid: git(cwd, ["show", "-s", "--format=%T", localHead]).stdout.trim(),
  };
}

export function readContentPublishCommitFromGit(
  commitOid,
  cwd = process.cwd(),
) {
  return readPendingCommit(cwd, commitOid);
}

export function inspectContentPublishDeliveryFromGit(cwd = process.cwd()) {
  const local = git(cwd, ["rev-parse", "--verify", CONTENT_PUBLISH_LOCAL_REF], {
    allowFailure: true,
  });
  if (local.status !== 0) {
    throw new Error("找不到本地 main；无法检查新内容发布交付状态");
  }
  const localHead = local.stdout.trim();
  const branchValue = git(cwd, ["branch", "--show-current"]).stdout.trim();
  const currentBranch = branchValue || null;
  const tracking = git(
    cwd,
    ["rev-parse", "--verify", CONTENT_PUBLISH_TRACKING_REF],
    { allowFailure: true },
  );
  if (tracking.status !== 0) {
    return analyzeContentPublishDelivery({
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
    `${CONTENT_PUBLISH_TRACKING_REF}...${CONTENT_PUBLISH_LOCAL_REF}`,
  ]).stdout.trim().split(/\s+/u).map(Number);
  if (
    counts.length !== 2 ||
    counts.some((value) => !Number.isInteger(value) || value < 0)
  ) {
    throw new Error("无法解析 main 与 origin/main tracking ref 的提交关系");
  }
  const [behind, ahead] = counts;
  return analyzeContentPublishDelivery({
    ahead,
    behind,
    currentBranch,
    localHead,
    pendingCommit:
      ahead === 1 && behind === 0 ? readPendingCommit(cwd, localHead) : null,
    trackingHead,
  });
}
