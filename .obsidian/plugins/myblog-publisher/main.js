/* eslint-disable @typescript-eslint/no-require-imports */
const { FileSystemAdapter, Modal, Notice, Plugin } = require("obsidian");
const { spawn } = require("node:child_process");

class InboxReadinessModal extends Modal {
  constructor(app, report) {
    super(app);
    this.report = report;
  }

  onOpen() {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "收件箱发布就绪状态" });
    this.contentEl.createEl("p", {
      text: "只读检查；不会移动、改写、提交或推送文件。",
    });
    const output = this.contentEl.createEl("pre");
    output.setText(this.report || "没有报告输出。");
    output.style.whiteSpace = "pre-wrap";
    output.style.overflowWrap = "anywhere";
    output.style.maxHeight = "65vh";
    output.style.overflow = "auto";
  }
}

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

    this.addCommand({
      id: "inspect-inbox-readiness",
      name: "查看全部草稿发布就绪状态",
      checkCallback: (checking) => this.inspectInboxReadiness(checking),
    });
  }

  inspectInboxReadiness(checking) {
    const isDesktopVault = this.app.vault.adapter instanceof FileSystemAdapter;
    if (!isDesktopVault) return false;
    if (checking) return true;

    const root = this.app.vault.adapter.getBasePath();
    const npmArgs = ["--silent", "run", "content:inbox"];
    const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm", ...npmArgs] : npmArgs;

    const progressNotice = new Notice("正在检查全部收件箱草稿…", 0);
    const child = spawn(executable, args, {
      cwd: root,
      windowsHide: true,
      shell: false,
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", (error) => {
      progressNotice.hide();
      new Notice(`收件箱检查无法启动：${error.message}`, 10000);
    });
    child.on("close", (code) => {
      progressNotice.hide();
      if (code === 0) {
        new Notice("收件箱检查完成。", 5000);
        new InboxReadinessModal(this.app, output.trim()).open();
        return;
      }
      const summary = output.trim().split(/\r?\n/u).slice(-4).join("\n");
      new Notice(`收件箱检查未完成：\n${summary || `命令退出码 ${code}`}`, 15000);
    });
    return true;
  }

  publishCurrentNote(checking, push) {
    const file = this.app.workspace.getActiveFile();
    const isInboxNote =
      file?.extension === "md" &&
      /^content\/inbox\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(file.path);
    const isDesktopVault = this.app.vault.adapter instanceof FileSystemAdapter;
    if (!isInboxNote || !isDesktopVault) return false;
    if (checking) return true;

    const root = this.app.vault.adapter.getBasePath();
    const npmArgs = ["run", "content:publish", "--", file.path, push ? "--push" : "--check-only"];
    const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm", ...npmArgs] : npmArgs;

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
