import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  gitPathsForPublishedNote,
  prepareObsidianNote,
} from "../lib/obsidian-publishing.ts";
import {
  formatMediaPreparation,
  prepareMediaForPublishing,
} from "../lib/media-policy.ts";

function fail(message) {
  console.error(`[publish] ${message}`);
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

function runNpm(args) {
  if (process.platform === "win32") {
    return run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm", ...args]);
  }
  return run("npm", args);
}

function contentLinkTargets() {
  return [
    ["post", "content/posts"],
    ["project", "content/projects"],
  ].flatMap(([kind, directory]) =>
    readdirSync(resolve(process.cwd(), directory), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => ({ kind, slug: entry.name.slice(0, -3) })),
  );
}

const args = process.argv.slice(2);
const sourceArgument = args.find((argument) => !argument.startsWith("--"));
const checkOnly = args.includes("--check-only");
const push = args.includes("--push");
const kindFlag = args.indexOf("--kind");
const requestedKind = kindFlag >= 0 ? args[kindFlag + 1] : undefined;

if (!sourceArgument) fail("用法：npm run content:publish -- content/inbox/<slug>.md [--check-only|--push]");
if (requestedKind && !["post", "project"].includes(requestedKind)) fail("--kind 只能是 post 或 project");

const sourcePath = sourceArgument.replaceAll("\\", "/").replace(/^\.\//u, "");
const absoluteSource = resolve(process.cwd(), sourcePath);
if (!existsSync(absoluteSource)) fail(`找不到草稿：${sourcePath}`);

let prepared;
const sourceContent = readFileSync(absoluteSource, "utf8");
try {
  prepared = prepareObsidianNote(
    sourcePath,
    sourceContent,
    requestedKind,
    contentLinkTargets(),
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const attachment of prepared.attachments) {
  const absoluteAttachmentSource = resolve(process.cwd(), attachment.sourcePath);
  const absoluteAttachmentTarget = resolve(process.cwd(), attachment.targetPath);
  if (!existsSync(absoluteAttachmentSource)) {
    fail(`正文引用的附件不存在：${attachment.sourcePath}`);
  }
  if (
    attachment.sourcePath !== attachment.targetPath &&
    existsSync(absoluteAttachmentTarget)
  ) {
    fail(`附件目标已存在：${attachment.targetPath}`);
  }
  if (
    attachment.sourcePath !== attachment.targetPath &&
    run("git", ["ls-files", "--error-unmatch", "--", attachment.sourcePath], {
      capture: true,
      allowFailure: true,
    }).status === 0
  ) {
    fail(`附件已被其他内容跟踪，拒绝移动：${attachment.sourcePath}`);
  }
}

if (!checkOnly && existsSync(resolve(process.cwd(), prepared.targetPath))) {
  fail(`目标已存在：${prepared.targetPath}`);
}
const sourceWasTracked = !checkOnly && push
  ? run("git", ["ls-files", "--error-unmatch", "--", prepared.sourcePath], {
      capture: true,
      allowFailure: true,
    }).status === 0
  : false;
if (!checkOnly && push) {
  const staged = run("git", ["diff", "--cached", "--name-only"], { capture: true });
  if (staged.stdout.trim()) fail("暂存区已有其他更改；请先提交或取消暂存后再使用 --push");
}

const stagingParent = resolve(process.cwd(), "node_modules", ".cache");
mkdirSync(stagingParent, { recursive: true });
const stagingDirectory = mkdtempSync(join(stagingParent, "myblog-publish-"));
const attachmentPreparations = [];
try {
  for (const [index, attachment] of prepared.attachments.entries()) {
    const stagedPath = join(
      stagingDirectory,
      "outputs",
      String(index),
      basename(attachment.targetPath),
    );
    const backupPath = join(
      stagingDirectory,
      "backups",
      String(index),
      basename(attachment.sourcePath),
    );
    mkdirSync(dirname(stagedPath), { recursive: true });
    const media = await prepareMediaForPublishing(
      resolve(process.cwd(), attachment.sourcePath),
      stagedPath,
      attachment.sourcePath,
      attachment.targetPath,
    );
    attachmentPreparations.push({ attachment, backupPath, media, stagedPath });
  }
} catch (error) {
  rmSync(stagingDirectory, { force: true, recursive: true });
  fail(error instanceof Error ? error.message : String(error));
}

if (checkOnly) {
  console.log(`[publish] 草稿有效：${prepared.targetPath}`);
  console.log(`[publish] 引用附件：${prepared.attachments.length} 个`);
  for (const { attachment, media } of attachmentPreparations) {
    console.log(`[publish] 附件归档：${attachment.sourcePath} -> ${attachment.targetPath}`);
    console.log(`[publish] 媒体处理：${formatMediaPreparation(media)}`);
  }
  rmSync(stagingDirectory, { force: true, recursive: true });
  process.exit(0);
}

let noteWritten = false;
let sourceRemoved = false;
const installedAttachments = [];
try {
  writeFileSync(resolve(process.cwd(), prepared.targetPath), prepared.content, { flag: "wx" });
  noteWritten = true;
  rmSync(absoluteSource);
  sourceRemoved = true;

  for (const preparation of attachmentPreparations) {
    const { attachment, backupPath, stagedPath } = preparation;
    const transaction = {
      attachment,
      backupMoved: false,
      backupPath,
      targetInstalled: false,
    };
    installedAttachments.push(transaction);
    mkdirSync(dirname(backupPath), { recursive: true });
    renameSync(resolve(process.cwd(), attachment.sourcePath), backupPath);
    transaction.backupMoved = true;
    const absoluteAttachmentTarget = resolve(process.cwd(), attachment.targetPath);
    mkdirSync(dirname(absoluteAttachmentTarget), { recursive: true });
    renameSync(stagedPath, absoluteAttachmentTarget);
    transaction.targetInstalled = true;
  }
  runNpm(["run", "check"]);
} catch (error) {
  const rollbackErrors = [];
  for (const transaction of installedAttachments.reverse()) {
    try {
      if (transaction.targetInstalled) {
        rmSync(resolve(process.cwd(), transaction.attachment.targetPath), { force: true });
      }
      if (transaction.backupMoved) {
        const absoluteAttachmentSource = resolve(
          process.cwd(),
          transaction.attachment.sourcePath,
        );
        mkdirSync(dirname(absoluteAttachmentSource), { recursive: true });
        renameSync(transaction.backupPath, absoluteAttachmentSource);
      }
    } catch (rollbackError) {
      rollbackErrors.push(
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      );
    }
  }
  try {
    if (noteWritten) rmSync(resolve(process.cwd(), prepared.targetPath), { force: true });
    if (sourceRemoved) writeFileSync(absoluteSource, sourceContent, { flag: "wx" });
  } catch (rollbackError) {
    rollbackErrors.push(
      rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
    );
  }
  rmSync(stagingDirectory, { force: true, recursive: true });
  const rollbackMessage = rollbackErrors.length === 0
    ? "草稿与附件已恢复到原位置。"
    : `自动恢复未完整：${rollbackErrors.join("；")}`;
  fail(`全量检查失败，${rollbackMessage}${error instanceof Error ? ` ${error.message}` : ""}`);
}

rmSync(stagingDirectory, { force: true, recursive: true });

console.log(`[publish] 已准备：${prepared.targetPath}`);
if (!push) {
  console.log("[publish] 检查通过。使用 --push 可提交并同步 GitHub，或用你的 Git 客户端提交。 ");
  process.exit(0);
}

try {
  const pathsToStage = gitPathsForPublishedNote(
    prepared.sourcePath,
    prepared.targetPath,
    prepared.attachments.map((attachment) => attachment.targetPath),
    sourceWasTracked,
  );
  run("git", ["add", "-A", "--", ...pathsToStage]);
  run("git", ["commit", "-m", `content: publish ${prepared.slug}`]);
  run("git", ["push", "origin", "main"]);
  console.log(`[publish] 已同步 GitHub：${prepared.slug}`);
} catch (error) {
  fail(`内容已通过检查并保留在本地，但 Git 同步失败。${error instanceof Error ? ` ${error.message}` : ""}`);
}
