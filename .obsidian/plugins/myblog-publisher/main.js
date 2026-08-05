/* eslint-disable @typescript-eslint/no-require-imports */
const { FileSystemAdapter, Modal, Notice, Plugin } = require("obsidian");
const { spawn } = require("node:child_process");

const MAX_CAPTURED_OUTPUT = 200_000;

class ReadOnlyReportModal extends Modal {
  constructor(app, { description, report, title }) {
    super(app);
    this.description = description;
    this.report = report;
    this.title = title;
  }

  onOpen() {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: this.title });
    this.contentEl.createEl("p", { text: this.description });
    const output = this.contentEl.createEl("pre");
    output.setText(this.report || "没有报告输出。");
    output.style.whiteSpace = "pre-wrap";
    output.style.overflowWrap = "anywhere";
    output.style.maxHeight = "65vh";
    output.style.overflow = "auto";
  }
}

class InboxReadinessModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description: "只读检查；不会移动、改写、提交或推送文件。",
      report,
      title: "收件箱发布就绪状态",
    });
  }
}

class ContentMaintenanceModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description: "只读检查；不会修改 reviewedAt、内容、提交或推送文件。",
      report,
      title: "已发布内容复核队列",
    });
  }
}

module.exports = class MyBlogPublisher extends Plugin {
  onload() {
    this.activeRuns = new Map();

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

    this.addCommand({
      id: "inspect-published-maintenance",
      name: "查看已发布内容复核队列",
      checkCallback: (checking) => this.inspectPublishedMaintenance(checking),
    });
  }

  onunload() {
    for (const [child, run] of [...this.activeRuns]) {
      run.cancel();
      this.terminateChild(child);
    }
    this.activeRuns.clear();
  }

  terminateChild(child) {
    const killDirectly = () => {
      try {
        child.kill();
      } catch {
        // The process may already have exited between the snapshot and kill.
      }
    };

    if (process.platform !== "win32" || !Number.isInteger(child.pid)) {
      killDirectly();
      return;
    }

    try {
      const killer = spawn(
        "taskkill.exe",
        ["/pid", String(child.pid), "/t", "/f"],
        { shell: false, stdio: "ignore", windowsHide: true },
      );
      killer.on("error", killDirectly);
    } catch {
      killDirectly();
    }
  }

  isDesktopVault() {
    return this.app.vault.adapter instanceof FileSystemAdapter;
  }

  runRepositoryCommand(npmArgs, messages, onSuccess) {
    const root = this.app.vault.adapter.getBasePath();
    const executable = process.platform === "win32"
      ? (process.env.ComSpec || "cmd.exe")
      : "npm";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npm", ...npmArgs]
      : npmArgs;
    const progressNotice = new Notice(messages.progress, 0);

    let child;
    try {
      child = spawn(executable, args, {
        cwd: root,
        windowsHide: true,
        shell: false,
      });
    } catch (error) {
      progressNotice.hide();
      new Notice(`${messages.startFailure}: ${error.message}`, 10000);
      return true;
    }

    let output = "";
    let outputTruncated = false;
    let settled = false;
    const appendOutput = (chunk) => {
      if (output.length >= MAX_CAPTURED_OUTPUT) {
        outputTruncated = true;
        return;
      }
      const text = chunk.toString();
      const remaining = MAX_CAPTURED_OUTPUT - output.length;
      output += text.slice(0, remaining);
      if (text.length > remaining) outputTruncated = true;
    };
    const report = () => {
      const captured = output.trim();
      if (!outputTruncated) return captured;
      return `${captured}\n[plugin] 输出超过 ${MAX_CAPTURED_OUTPUT} 字符，后续内容已截断。`;
    };
    const cancel = () => {
      if (settled) return false;
      settled = true;
      progressNotice.hide();
      this.activeRuns.delete(child);
      return true;
    };

    this.activeRuns.set(child, { cancel, progressNotice });
    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    child.on("error", (error) => {
      if (!cancel()) return;
      new Notice(`${messages.startFailure}: ${error.message}`, 10000);
    });
    child.on("close", (code) => {
      if (!cancel()) return;
      if (code === 0) {
        new Notice(messages.success, messages.successDuration ?? 5000);
        onSuccess(report());
        return;
      }
      const summary = report().split(/\r?\n/u).slice(-4).join("\n");
      new Notice(
        `${messages.failure}:\n${summary || `命令退出码 ${code}`}`,
        15000,
      );
    });
    return true;
  }

  inspectInboxReadiness(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;

    return this.runRepositoryCommand(
      ["--silent", "run", "content:inbox"],
      {
        failure: "收件箱检查未完成",
        progress: "正在检查全部收件箱草稿…",
        startFailure: "收件箱检查无法启动",
        success: "收件箱检查完成。",
      },
      (report) => new InboxReadinessModal(this.app, report).open(),
    );
  }

  inspectPublishedMaintenance(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;

    return this.runRepositoryCommand(
      ["--silent", "run", "content:status"],
      {
        failure: "内容复核检查未完成",
        progress: "正在读取已发布内容复核队列…",
        startFailure: "内容复核检查无法启动",
        success: "已发布内容复核队列已更新。",
      },
      (report) => new ContentMaintenanceModal(this.app, report).open(),
    );
  }

  publishCurrentNote(checking, push) {
    const file = this.app.workspace.getActiveFile();
    const isInboxNote =
      file?.extension === "md" &&
      /^content\/inbox\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(file.path);
    if (!isInboxNote || !this.isDesktopVault()) return false;
    if (checking) return true;

    return this.runRepositoryCommand(
      ["run", "content:publish", "--", file.path, push ? "--push" : "--check-only"],
      {
        failure: "发布未完成",
        progress: push ? "正在检查、提交并发布…" : "正在检查当前草稿…",
        startFailure: "发布命令无法启动",
        success: push ? "已提交并同步，等待线上部署完成。" : "草稿通过发布前检查。",
        successDuration: 8000,
      },
      () => this.app.vault.adapter.reconcile?.(),
    );
  }
};
