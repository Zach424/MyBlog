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
import {
  createPostDeliveryHandoff,
  createPostDeliveryHandoffTarget,
  formatPostDeliveryHandoffLine,
} from "../lib/content/post-delivery-handoff.ts";
import { PRODUCTION_CONTENT_DEFAULT_ORIGIN } from "../lib/content/production-sync.ts";
import { inspectContentPublishDeliveryFromGit } from "./publish-delivery-git.mjs";

function fail(message) {
  console.error(`[publish] ${message}`);
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
      .map((entry) => ({
        body: readFileSync(resolve(process.cwd(), directory, entry.name), "utf8"),
        kind,
        slug: entry.name.slice(0, -3),
      })),
  );
}

const args = process.argv.slice(2);
const sourceArgument = args.find((argument) => !argument.startsWith("--"));
const checkOnly = args.includes("--check-only");
const push = args.includes("--push");
const handoffRequested = args.includes("--handoff");
const kindFlag = args.indexOf("--kind");
const requestedKind = kindFlag >= 0 ? args[kindFlag + 1] : undefined;

if (!sourceArgument) fail("用法：npm run content:publish -- content/inbox/<slug>.md [--check-only|--push] [--handoff]");
if (requestedKind && !["post", "project"].includes(requestedKind)) fail("--kind 只能是 post 或 project");
if (handoffRequested && !push) fail("--handoff 只用于已确认 Git 同步的 --push 交付");

let deliveryBaseline = null;
if (push) {
  try {
    deliveryBaseline = inspectContentPublishDeliveryFromGit();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  if (deliveryBaseline.observation.currentBranch !== "main") {
    fail(
      `新内容发布只能在 main 分支执行；当前分支：${deliveryBaseline.observation.currentBranch ?? "detached HEAD"}`,
    );
  }
  if (
    deliveryBaseline.relation.status === "pending-publication" &&
    deliveryBaseline.pendingPublication
  ) {
    fail(
      `已有待同步新内容发布：${deliveryBaseline.pendingPublication.targetPath} · ${deliveryBaseline.pendingPublication.commitOid.slice(0, 12)}；先运行 npm run content:publish:status，不要创建第二个发布提交`,
    );
  }
  if (deliveryBaseline.relation.status !== "synchronized") {
    fail(
      `本地 main 无法证明与 origin/main tracking ref 同步：${deliveryBaseline.relation.status} · behind ${deliveryBaseline.relation.behind ?? "unknown"} · ahead ${deliveryBaseline.relation.ahead ?? "unknown"}；先运行 npm run content:publish:status 检查`,
    );
  }
}

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
let handoffTarget = null;
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
  if (push && deliveryBaseline) {
    const confirmedDelivery = inspectContentPublishDeliveryFromGit();
    if (
      confirmedDelivery.observation.currentBranch !== "main" ||
      confirmedDelivery.relation.status !== "synchronized" ||
      confirmedDelivery.observation.localHead !==
        deliveryBaseline.observation.localHead ||
      confirmedDelivery.observation.trackingHead !==
        deliveryBaseline.observation.trackingHead
    ) {
      throw new Error(
        "完整质量门期间 main 或 tracking ref 发生变化；未创建发布提交",
      );
    }
  }
  if (handoffRequested) {
    handoffTarget = createPostDeliveryHandoffTarget({
      origin: PRODUCTION_CONTENT_DEFAULT_ORIGIN,
      source: readFileSync(resolve(process.cwd(), prepared.targetPath)),
      sourcePath: prepared.targetPath,
    });
  }
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
  const pending = inspectContentPublishDeliveryFromGit();
  if (
    pending.relation.status !== "pending-publication" ||
    pending.pendingPublication?.slug !== prepared.slug ||
    pending.pendingPublication.parentOid !== deliveryBaseline?.observation.localHead
  ) {
    throw new Error(
      "本地发布提交未通过原子发布包身份验证；未执行 push，请检查 Git 状态",
    );
  }
  const pendingHead = pending.pendingPublication.commitOid;
  if (handoffRequested) {
    const currentBytes = readFileSync(resolve(process.cwd(), prepared.targetPath));
    const currentTarget = createPostDeliveryHandoffTarget({
      origin: PRODUCTION_CONTENT_DEFAULT_ORIGIN,
      source: currentBytes,
      sourcePath: prepared.targetPath,
    });
    const filteredBlobOid = run(
      "git",
      ["hash-object", `--path=${prepared.targetPath}`, "--stdin"],
      { capture: true, input: currentBytes },
    ).stdout.trim();
    if (
      JSON.stringify(currentTarget) !== JSON.stringify(handoffTarget) ||
      filteredBlobOid !== pending.pendingPublication.targetBlobOid
    ) {
      throw new Error(
        "发布提交与 post-delivery handoff 冻结来源不一致；未执行 push",
      );
    }
  }
  run("git", ["push", "origin", `${pendingHead}:refs/heads/main`]);
  const delivered = inspectContentPublishDeliveryFromGit();
  if (
    delivered.relation.status !== "synchronized" ||
    delivered.observation.localHead !== pendingHead ||
    delivered.observation.trackingHead !== pendingHead
  ) {
    throw new Error(
      "push 可能已完成，但无法证明 local main 与 tracking ref 已同步；请运行 npm run content:publish:status",
    );
  }
  console.log(`[publish] 已同步 GitHub：${prepared.slug}`);
  if (handoffRequested) {
    console.log(formatPostDeliveryHandoffLine(createPostDeliveryHandoff({
      commitOid: pendingHead,
      delivery: "publication",
      target: handoffTarget,
    })));
  }
} catch (error) {
  fail(`发布提交已保留在本地，但 Git 同步失败；请运行 npm run content:publish:status。${error instanceof Error ? ` ${error.message}` : ""}`);
}
