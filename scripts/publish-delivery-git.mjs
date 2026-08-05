import { spawnSync } from "node:child_process";
import {
  analyzeContentPublishDelivery,
} from "../lib/content/publish-delivery.ts";
import { parsePostFile, parseProjectFile } from "../lib/content/contract.ts";
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
  const snapshot = readContentDeliveryGitSnapshot(cwd);
  const { ahead, behind, localHead } = snapshot;
  return analyzeContentPublishDelivery({
    ...snapshot,
    pendingCommit:
      ahead === 1 && behind === 0 ? readPendingCommit(cwd, localHead) : null,
  });
}
