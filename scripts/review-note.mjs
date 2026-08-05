import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveContentBuildDate } from "../build/content-build-date.ts";
import {
  inspectContentReview,
  PUBLISHED_NOTE_PATTERN,
} from "../lib/content/review-note.ts";

function fail(message) {
  console.error(`[review] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
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

function runNpm(args) {
  if (process.platform === "win32") {
    return run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm", ...args]);
  }
  return run("npm", args);
}

function nulPaths(value) {
  return value.split("\0").filter(Boolean).map((path) => path.replaceAll("\\", "/"));
}

function capturedGit(args, options = {}) {
  return runGit(args, { ...options, capture: true });
}

function assertSingleReviewChange(sourcePath) {
  const branch = capturedGit(["branch", "--show-current"]).stdout.trim();
  if (branch !== "main") {
    fail(`正式内容复核只能在 main 分支执行；当前分支：${branch || "detached HEAD"}`);
  }
  if (
    capturedGit(["ls-files", "--error-unmatch", "--", sourcePath], {
      allowFailure: true,
    }).status !== 0
  ) {
    fail(`正式内容必须已被 Git 跟踪：${sourcePath}`);
  }

  const staged = nulPaths(
    capturedGit(["diff", "--cached", "--name-only", "-z"]).stdout,
  );
  if (staged.length > 0) {
    fail(`暂存区必须为空；发现：${staged.join("、")}`);
  }
  const untracked = nulPaths(
    capturedGit(["ls-files", "--others", "--exclude-standard", "-z"]).stdout,
  );
  if (untracked.length > 0) {
    fail(`存在未跟踪文件；复核前请先处理：${untracked.join("、")}`);
  }
  const changed = nulPaths(capturedGit(["diff", "--name-only", "-z"]).stdout);
  if (changed.length !== 1 || changed[0] !== sourcePath) {
    const evidence = changed.length === 0 ? "没有工作区修改" : changed.join("、");
    fail(`工作区只能修改当前正式笔记 ${sourcePath}；发现：${evidence}`);
  }
}

const args = process.argv.slice(2);
const sourceArguments = args.filter((argument) => !argument.startsWith("--"));
const checkOnly = args.includes("--check-only");
const push = args.includes("--push");
const unknownFlags = args.filter(
  (argument) => argument.startsWith("--") && !["--check-only", "--push"].includes(argument),
);
if (
  sourceArguments.length !== 1 ||
  checkOnly === push ||
  unknownFlags.length > 0
) {
  fail(
    "用法：npm run content:review -- content/posts|projects/<slug>.md (--check-only|--push)",
  );
}

const sourcePath = sourceArguments[0].replaceAll("\\", "/").replace(/^\.\//u, "");
if (!PUBLISHED_NOTE_PATTERN.test(sourcePath)) {
  fail("只接受 content/posts 或 content/projects 中稳定 kebab-case 文件名的 Markdown");
}
const absoluteSource = resolve(process.cwd(), sourcePath);
if (!existsSync(absoluteSource)) fail(`找不到正式内容：${sourcePath}`);

let inspection;
try {
  assertSingleReviewChange(sourcePath);
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

console.log(`[review] 正式内容：${inspection.sourcePath}`);
console.log(
  `[review] 复核日期：${inspection.previousReviewedAt} -> ${inspection.reviewedAt}`,
);
console.log(
  `[review] 事实变化：${inspection.substantiveChanged ? `有 · updatedAt ${inspection.updatedAt}` : "无 · 仅推进 reviewedAt"}`,
);

try {
  runNpm(["run", "check"]);
  assertSingleReviewChange(sourcePath);
} catch (error) {
  fail(`全量检查失败；文件保持未暂存。${error instanceof Error ? ` ${error.message}` : ""}`);
}

if (checkOnly) {
  console.log("[review] 正式内容复核检查通过；未暂存、未提交、未推送。");
  process.exit(0);
}

let committed = false;
try {
  runGit(["add", "--", sourcePath]);
  const staged = nulPaths(
    capturedGit(["diff", "--cached", "--name-only", "-z"]).stdout,
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
