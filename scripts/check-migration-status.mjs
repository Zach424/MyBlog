import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function command(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
}

const failures = [];
const branch = command("git", ["branch", "--show-current"]);
if (branch.output !== "main") failures.push(`当前分支是 ${branch.output || "unknown"}`);

const status = command("git", ["status", "--porcelain"]);
if (status.output) failures.push("工作区不是干净状态");

const sync = command("git", ["rev-list", "--left-right", "--count", "origin/main...HEAD"]);
if (sync.status !== 0 || sync.output !== "0\t0") failures.push(`本地与 origin/main 未同步：${sync.output}`);

const wrangler = command(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"), "whoami"]);
if (wrangler.status !== 0 || /not authenticated/iu.test(wrangler.output)) {
  failures.push("Cloudflare 尚未登录；运行 npx wrangler login 并由所有者完成浏览器授权");
}

if (failures.length) {
  for (const failure of failures) console.error(`[migration] ${failure}`);
  process.exit(1);
}

console.log("[migration] Git 与 Cloudflare 本地身份均已就绪。");
