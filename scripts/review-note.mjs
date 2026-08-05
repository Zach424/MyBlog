import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { resolveContentBuildDate } from "../build/content-build-date.ts";
import {
  createContentReviewProof,
  fingerprintContentReviewCandidate,
  inspectContentReview,
  PUBLISHED_NOTE_PATTERN,
} from "../lib/content/review-note.ts";
import { classifyContentReviewWorktree } from "../lib/content/review-worktree.ts";
import { inspectContentReviewDeliveryFromGit } from "./review-delivery-git.mjs";

function fail(message) {
  console.error(`[review] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    input: options.input,
    maxBuffer: 5_000_000,
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} 失败，退出码 ${result.status}`);
  }
  return result;
}

function runGit(args, options = {}) {
  return run("git", args, options);
}

function runNpm(args, options = {}) {
  if (process.platform === "win32") {
    return run(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", "npm", ...args],
      options,
    );
  }
  return run("npm", args, options);
}

function nulPaths(value) {
  return value.split("\0").filter(Boolean).map((path) => path.replaceAll("\\", "/"));
}

function capturedGit(args, options = {}) {
  return runGit(args, { ...options, capture: true });
}

function inspectReviewWorktree(sourcePath) {
  const branch = capturedGit(["branch", "--show-current"]).stdout.trim();
  if (branch !== "main") {
    throw new Error(
      `正式内容复核只能在 main 分支执行；当前分支：${branch || "detached HEAD"}`,
    );
  }
  const delivery = inspectContentReviewDeliveryFromGit();
  if (delivery.relation.status === "pending-review") {
    throw new Error(
      `已有待同步正式内容复核：${delivery.pendingReview.sourcePath} · ${delivery.pendingReview.commitOid.slice(0, 12)}；先运行 npm run content:review:status，并恢复已有提交的交付`,
    );
  }
  if (delivery.relation.status !== "synchronized") {
    throw new Error(
      `本地 main 无法证明与 origin/main tracking ref 同步：${delivery.relation.status} · behind ${delivery.relation.behind ?? "unknown"} · ahead ${delivery.relation.ahead ?? "unknown"}；先运行 npm run content:review:status 检查`,
    );
  }
  if (
    capturedGit(["ls-files", "--error-unmatch", "--", sourcePath], {
      allowFailure: true,
    }).status !== 0
  ) {
    throw new Error(`正式内容必须已被 Git 跟踪：${sourcePath}`);
  }

  const stagedPaths = nulPaths(
    capturedGit([
      "diff",
      "--cached",
      "--name-only",
      "--ita-visible-in-index",
      "-z",
    ]).stdout,
  );
  const untrackedPaths = nulPaths(
    capturedGit(["ls-files", "--others", "--exclude-standard", "-z"]).stdout,
  );
  const changedPaths = nulPaths(
    capturedGit(["diff", "--name-only", "-z"]).stdout,
  );
  const impact = classifyContentReviewWorktree({
    changedPaths,
    sourcePath,
    stagedPaths,
    untrackedPaths,
  });
  if (impact.stagedPaths.length > 0) {
    throw new Error(`暂存区必须为空；发现：${impact.stagedPaths.join("、")}`);
  }
  if (!impact.targetChanged) {
    throw new Error(`当前正式笔记必须有未暂存修改：${sourcePath}`);
  }
  if (impact.blockingPaths.length > 0) {
    throw new Error(
      `工作区包含会影响正式内容复核的阻断路径：${impact.blockingPaths.join("、")}；只允许并行保留稳定 inbox 草稿和未跟踪的根暂存图片`,
    );
  }
  if (
    impact.committablePaths.length !== 1 ||
    impact.committablePaths[0] !== sourcePath
  ) {
    throw new Error(`工作区无法证明唯一可提交路径：${sourcePath}`);
  }
  return impact;
}

function printDeferredEvidence(impact) {
  console.log(
    `[review] 隔离作者工作（不进入本次提交）：${impact.deferredPaths.length}`,
  );
  const untracked = new Set(impact.untrackedPaths);
  for (const path of impact.deferredPaths) {
    console.log(`[review] - ${untracked.has(path) ? "untracked" : "modified"} · ${path}`);
  }
}

function readReviewCandidate(absoluteSource, sourcePath) {
  const bytes = readFileSync(absoluteSource);
  return {
    blobOid: capturedGit(
      ["hash-object", `--path=${sourcePath}`, "--stdin"],
      { input: bytes },
    ).stdout.trim(),
    bytes,
    digest: fingerprintContentReviewCandidate(bytes),
  };
}

function assertCandidateUnchanged(absoluteSource, candidate) {
  const currentDigest = fingerprintContentReviewCandidate(
    readFileSync(absoluteSource),
  );
  if (currentDigest !== candidate.digest) {
    throw new Error(
      "正式内容在质量门期间发生变化，候选指纹不再匹配；请等待编辑完成后重新检查",
    );
  }
}

function assertHeadUnchanged(baseHead) {
  const currentHead = capturedGit(["rev-parse", "HEAD"]).stdout.trim();
  if (currentHead !== baseHead) {
    throw new Error(
      "质量门期间 HEAD 已变化；复核必须基于同一个历史快照重新执行",
    );
  }
}

function shortCandidateDigest(digest) {
  return `${digest.slice(0, 12)}…${digest.slice(-8)}`;
}

function printCandidateEvidence(candidate) {
  console.log(
    `[review] 候选指纹：sha256:${shortCandidateDigest(candidate.digest)} · 门前/门后一致`,
  );
}

function rollbackInvalidReviewCommit(baseHead, sourcePath) {
  const invalidHead = capturedGit(["rev-parse", "HEAD"]).stdout.trim();
  const parent = capturedGit(["rev-parse", "HEAD^"]).stdout.trim();
  if (parent !== baseHead) {
    throw new Error("新提交的父提交已经变化，无法自动撤回复核提交");
  }
  runGit(["update-ref", "refs/heads/main", baseHead, invalidHead]);
  runGit(["restore", "--staged", "--", sourcePath]);
}

let parsedArgs;
try {
  parsedArgs = parseArgs({
    allowPositionals: true,
    options: {
      "check-only": { type: "boolean" },
      format: { type: "string" },
      push: { type: "boolean" },
    },
    strict: true,
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
const checkOnly = parsedArgs.values["check-only"] === true;
const push = parsedArgs.values.push === true;
const format = parsedArgs.values.format ?? "text";
if (parsedArgs.positionals.length !== 1 || checkOnly === push) {
  fail(
    "用法：npm run content:review -- content/posts|projects/<slug>.md (--check-only|--push) [--format text|json]",
  );
}
if (!["text", "json"].includes(format)) fail("--format 只能是 text 或 json");
if (push && format === "json") fail("--format json 只用于 --check-only 证据");

const sourcePath = parsedArgs.positionals[0]
  .replaceAll("\\", "/")
  .replace(/^\.\//u, "");
if (!PUBLISHED_NOTE_PATTERN.test(sourcePath)) {
  fail("只接受 content/posts 或 content/projects 中稳定 kebab-case 文件名的 Markdown");
}
const absoluteSource = resolve(process.cwd(), sourcePath);
if (!existsSync(absoluteSource)) fail(`找不到正式内容：${sourcePath}`);

let inspection;
let impact;
let candidate;
let baseHead;
try {
  impact = inspectReviewWorktree(sourcePath);
  baseHead = capturedGit(["rev-parse", "HEAD"]).stdout.trim();
  const previousContent = capturedGit([
    "show",
    `${baseHead}:${sourcePath}`,
  ]).stdout;
  candidate = readReviewCandidate(absoluteSource, sourcePath);
  inspection = inspectContentReview({
    currentContent: candidate.bytes.toString("utf8"),
    previousContent,
    reviewDate: resolveContentBuildDate(),
    sourcePath,
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (format === "text") {
  console.log(`[review] 正式内容：${inspection.sourcePath}`);
  console.log(
    `[review] 复核日期：${inspection.previousReviewedAt} -> ${inspection.reviewedAt}`,
  );
  console.log(
    `[review] 事实变化：${inspection.substantiveChanged ? `有 · updatedAt ${inspection.updatedAt}` : "无 · 仅推进 reviewedAt"}`,
  );
}

try {
  if (format === "json") {
    const quality = runNpm(["run", "check"], {
      allowFailure: true,
      capture: true,
    });
    if (quality.status !== 0) {
      if (quality.stdout) process.stderr.write(quality.stdout);
      if (quality.stderr) process.stderr.write(quality.stderr);
      throw new Error(`npm run check 失败，退出码 ${quality.status}`);
    }
  } else {
    runNpm(["run", "check"]);
  }
  assertHeadUnchanged(baseHead);
  impact = inspectReviewWorktree(sourcePath);
  assertCandidateUnchanged(absoluteSource, candidate);
} catch (error) {
  fail(`全量检查失败；文件保持未暂存。${error instanceof Error ? ` ${error.message}` : ""}`);
}

if (checkOnly) {
  if (format === "json") {
    console.log(
      JSON.stringify(
        createContentReviewProof(inspection, impact, candidate.digest),
        null,
        2,
      ),
    );
  } else {
    printCandidateEvidence(candidate);
    printDeferredEvidence(impact);
    console.log("[review] 正式内容复核检查通过；未暂存、未提交、未推送。");
  }
  process.exit(0);
}

let commitCreated = false;
let commitVerified = false;
try {
  assertHeadUnchanged(baseHead);
  printCandidateEvidence(candidate);
  printDeferredEvidence(impact);
  runGit(["add", "--", sourcePath]);
  const staged = nulPaths(
    capturedGit([
      "diff",
      "--cached",
      "--name-only",
      "--ita-visible-in-index",
      "-z",
    ]).stdout,
  );
  if (staged.length !== 1 || staged[0] !== sourcePath) {
    throw new Error(`暂存结果不唯一：${staged.join("、") || "空"}`);
  }
  const stagedBlobOid = capturedGit(["rev-parse", `:${sourcePath}`]).stdout.trim();
  if (stagedBlobOid !== candidate.blobOid) {
    throw new Error("暂存内容与通过质量门的候选指纹不一致");
  }
  runGit(["commit", "--only", "-m", `content: review ${inspection.slug}`, "--", sourcePath]);
  commitCreated = true;
  const committedParent = capturedGit(["rev-parse", "HEAD^"]).stdout.trim();
  if (committedParent !== baseHead) {
    throw new Error("复核提交没有直接基于检查时的 HEAD");
  }
  const committedPaths = nulPaths(
    capturedGit([
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      "-z",
      "HEAD",
    ]).stdout,
  );
  if (committedPaths.length !== 1 || committedPaths[0] !== sourcePath) {
    throw new Error(`复核提交包含意外路径：${committedPaths.join("、") || "空"}`);
  }
  const committedBlobOid = capturedGit([
    "rev-parse",
    `HEAD:${sourcePath}`,
  ]).stdout.trim();
  if (committedBlobOid !== candidate.blobOid) {
    throw new Error("复核提交内容与通过质量门的候选指纹不一致");
  }
  commitVerified = true;
  runGit(["push", "origin", "main"]);
  console.log(`[review] 已提交并同步正式内容复核：${inspection.slug}`);
} catch (error) {
  if (commitCreated && !commitVerified) {
    try {
      rollbackInvalidReviewCommit(baseHead, sourcePath);
    } catch (rollbackError) {
      fail(
        `复核提交未通过候选指纹验证，且无法自动撤回；请保留现场人工检查 HEAD 和暂存区。${rollbackError instanceof Error ? ` ${rollbackError.message}` : ""}`,
      );
    }
    fail(
      `复核提交未通过候选指纹验证；已撤回本地提交并保留工作区。${error instanceof Error ? ` ${error.message}` : ""}`,
    );
  }
  if (!commitCreated) {
    capturedGit(["restore", "--staged", "--", sourcePath], {
      allowFailure: true,
    });
    fail(
      `复核提交失败；文件保留且已取消暂存。${error instanceof Error ? ` ${error.message}` : ""}`,
    );
  }
  fail(
    `复核提交已保留在本地，但 GitHub 同步失败；修复连接后运行 git push origin main。${error instanceof Error ? ` ${error.message}` : ""}`,
  );
}
