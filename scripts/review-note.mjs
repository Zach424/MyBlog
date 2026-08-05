import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { resolveContentBuildDate } from "../build/content-build-date.ts";
import {
  createContentReviewProof,
  inspectContentReview,
  PUBLISHED_NOTE_PATTERN,
} from "../lib/content/review-note.ts";
import { classifyContentReviewWorktree } from "../lib/content/review-worktree.ts";

function fail(message) {
  console.error(`[review] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
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
try {
  impact = inspectReviewWorktree(sourcePath);
  const previousContent = capturedGit(["show", `HEAD:${sourcePath}`]).stdout;
  inspection = inspectContentReview({
    currentContent: readFileSync(absoluteSource, "utf8"),
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
  impact = inspectReviewWorktree(sourcePath);
} catch (error) {
  fail(`全量检查失败；文件保持未暂存。${error instanceof Error ? ` ${error.message}` : ""}`);
}

if (checkOnly) {
  if (format === "json") {
    console.log(JSON.stringify(createContentReviewProof(inspection, impact), null, 2));
  } else {
    printDeferredEvidence(impact);
    console.log("[review] 正式内容复核检查通过；未暂存、未提交、未推送。");
  }
  process.exit(0);
}

let committed = false;
try {
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
  runGit(["commit", "--only", "-m", `content: review ${inspection.slug}`, "--", sourcePath]);
  committed = true;
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
  runGit(["push", "origin", "main"]);
  console.log(`[review] 已提交并同步正式内容复核：${inspection.slug}`);
} catch (error) {
  if (!committed) {
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
