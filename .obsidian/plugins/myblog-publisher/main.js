/* eslint-disable @typescript-eslint/no-require-imports */
const { FileSystemAdapter, Notice, Plugin } = require("obsidian");
const { spawn } = require("node:child_process");

module.exports = class MyBlogPublisher extends Plugin {
  onload() {
    this.addCommand({
      id: "validate-current-note",
      name: "检查当前草稿",
      checkCallback: (checking) => this.publishCurrentNote(checking, false),
    });

    this.addCommand({
      id: "publish-current-note",
      name: "发布当前草稿并同步 GitHub",
      checkCallback: (checking) => this.publishCurrentNote(checking, true),
    });
  }

  publishCurrentNote(checking, push) {
    const file = this.app.workspace.getActiveFile();
    const isInboxNote = file?.extension === "md" && file.path.startsWith("content/inbox/");
    const isDesktopVault = this.app.vault.adapter instanceof FileSystemAdapter;
    if (!isInboxNote || !isDesktopVault) return false;
    if (checking) return true;

    const root = this.app.vault.adapter.getBasePath();
    const executable = process.platform === "win32" ? "npm.cmd" : "npm";
    const args = ["run", "content:publish", "--", file.path, "--check-only"];
    if (push) args.splice(args.length - 1, 1, "--push");

    new Notice(push ? "正在检查、提交并发布…" : "正在检查当前草稿…", 0);
    const child = spawn(executable, args, {
      cwd: root,
      windowsHide: true,
      shell: false,
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", (error) => new Notice(`发布命令无法启动：${error.message}`, 10000));
    child.on("close", (code) => {
      if (code === 0) {
        new Notice(push ? "已提交并同步，等待线上部署完成。" : "草稿通过发布前检查。", 8000);
        this.app.vault.adapter.reconcile?.();
        return;
      }
      const summary = output.trim().split(/\r?\n/u).slice(-4).join("\n");
      new Notice(`发布未完成：\n${summary || `命令退出码 ${code}`}`, 15000);
    });
    return true;
  }
};
