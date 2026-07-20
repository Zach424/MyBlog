import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function command(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
}

function npx(args) {
  if (process.platform === "win32") {
    return command(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npx", ...args]);
  }
  return command("npx", args);
}

const failures = [];
const branch = command("git", ["branch", "--show-current"]);
if (branch.output !== "main") failures.push(`当前分支是 ${branch.output || "unknown"}`);

const status = command("git", ["status", "--porcelain"]);
if (status.output) failures.push("工作区不是干净状态");

const sync = command("git", ["rev-list", "--left-right", "--count", "origin/main...HEAD"]);
if (sync.status !== 0 || sync.output !== "0\t0") failures.push(`本地与 origin/main 未同步：${sync.output}`);

if (!existsSync(".vercel/project.json")) {
  failures.push("Vercel 项目尚未关联；运行 npx --yes vercel@56.3.2 link 并由所有者完成授权");
} else {
  const vercel = npx(["--yes", "vercel@56.3.2", "whoami"]);
  if (vercel.status !== 0 || /not currently logged in|not authenticated/iu.test(vercel.output)) {
    failures.push("Vercel 尚未登录；运行 npx --yes vercel@56.3.2 login 并由所有者完成浏览器授权");
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`[migration] ${failure}`);
  process.exit(1);
}

console.log("[migration] Git 与 Vercel 本地身份均已就绪。");
