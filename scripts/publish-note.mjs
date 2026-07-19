import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareObsidianNote } from "../lib/obsidian-publishing.ts";

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
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const attachment of prepared.attachments) {
  if (!existsSync(resolve(process.cwd(), attachment))) fail(`正文引用的附件不存在：${attachment}`);
}

if (checkOnly) {
  console.log(`[publish] 草稿有效：${prepared.targetPath}`);
  console.log(`[publish] 引用附件：${prepared.attachments.length} 个`);
  process.exit(0);
}

if (existsSync(resolve(process.cwd(), prepared.targetPath))) fail(`目标已存在：${prepared.targetPath}`);
if (push) {
  const staged = run("git", ["diff", "--cached", "--name-only"], { capture: true });
  if (staged.stdout.trim()) fail("暂存区已有其他更改；请先提交或取消暂存后再使用 --push");
}

writeFileSync(resolve(process.cwd(), prepared.targetPath), prepared.content, { flag: "wx" });
rmSync(absoluteSource);

try {
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "check"]);
} catch (error) {
  writeFileSync(absoluteSource, sourceContent);
  rmSync(resolve(process.cwd(), prepared.targetPath));
  fail(`全量检查失败，草稿已恢复到收件箱。${error instanceof Error ? ` ${error.message}` : ""}`);
}

console.log(`[publish] 已准备：${prepared.targetPath}`);
if (!push) {
  console.log("[publish] 检查通过。使用 --push 可提交并同步 GitHub，或用你的 Git 客户端提交。 ");
  process.exit(0);
}

try {
  run("git", ["add", "-A", "--", prepared.sourcePath, prepared.targetPath, ...prepared.attachments]);
  run("git", ["commit", "-m", `content: publish ${prepared.slug}`]);
  run("git", ["push", "origin", "main"]);
  console.log(`[publish] 已同步 GitHub：${prepared.slug}`);
} catch (error) {
  fail(`内容已通过检查并保留在本地，但 Git 同步失败。${error instanceof Error ? ` ${error.message}` : ""}`);
}
