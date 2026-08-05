import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const pluginUrl = new URL(
  "../.obsidian/plugins/myblog-publisher/main.js",
  import.meta.url,
);
const manifestUrl = new URL(
  "../.obsidian/plugins/myblog-publisher/manifest.json",
  import.meta.url,
);

function createEmitter() {
  const listeners = new Map();
  return {
    emit(name, ...args) {
      for (const listener of listeners.get(name) ?? []) listener(...args);
    },
    on(name, listener) {
      const current = listeners.get(name) ?? [];
      current.push(listener);
      listeners.set(name, current);
      return this;
    },
  };
}

function createElement(tag, options = {}) {
  return {
    children: [],
    style: {},
    tag,
    text: options.text ?? "",
    createEl(childTag, childOptions = {}) {
      const child = createElement(childTag, childOptions);
      this.children.push(child);
      return child;
    },
    empty() {
      this.children.length = 0;
    },
    setText(value) {
      this.text = value;
    },
  };
}

async function createPluginHarness({ desktop = true, platform = "win32" } = {}) {
  const source = await readFile(pluginUrl, "utf8");
  const commands = [];
  const modals = [];
  const notices = [];
  const spawned = [];

  class FileSystemAdapter {
    getBasePath() {
      return "D:\\Study\\blog";
    }

    reconcile() {}
  }

  class Modal {
    constructor(app) {
      this.app = app;
      this.contentEl = createElement("div");
    }

    open() {
      this.onOpen();
      modals.push(this);
    }
  }

  class Notice {
    constructor(message, duration) {
      this.duration = duration;
      this.hidden = false;
      this.message = message;
      notices.push(this);
    }

    hide() {
      this.hidden = true;
    }
  }

  class Plugin {
    constructor(app) {
      this.app = app;
    }

    addCommand(command) {
      commands.push(command);
    }
  }

  const spawn = (executable, args, options) => {
    const child = createEmitter();
    child.pid = 1000 + spawned.length;
    child.stdout = createEmitter();
    child.stderr = createEmitter();
    child.killed = false;
    child.kill = () => {
      child.killed = true;
      return true;
    };
    spawned.push({ args, child, executable, options });
    return child;
  };

  const adapter = desktop ? new FileSystemAdapter() : {};
  const app = {
    vault: { adapter },
    workspace: { getActiveFile: () => undefined },
  };
  const context = vm.createContext({
    module: { exports: {} },
    process: { env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" }, platform },
    require(specifier) {
      if (specifier === "obsidian") {
        return { FileSystemAdapter, Modal, Notice, Plugin };
      }
      if (specifier === "node:child_process") return { spawn };
      throw new Error(`Unexpected require: ${specifier}`);
    },
  });
  new vm.Script(source, { filename: pluginUrl.pathname }).runInContext(context);
  const PluginClass = context.module.exports;
  const plugin = new PluginClass(app);
  plugin.onload();

  return { commands, modals, notices, plugin, spawned };
}

function childText(modal, tag) {
  return modal.contentEl.children
    .filter((element) => element.tag === tag)
    .map((element) => element.text);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("registers a read-only published-maintenance command with a hidden Windows process", async () => {
  const [manifestSource, harness] = await Promise.all([
    readFile(manifestUrl, "utf8"),
    createPluginHarness(),
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.version, "1.2.0");
  assert.equal(manifest.isDesktopOnly, true);

  const command = harness.commands.find(
    (candidate) => candidate.id === "inspect-published-maintenance",
  );
  assert.ok(command);
  assert.equal(command.name, "查看已发布内容复核队列");
  assert.equal(command.checkCallback(true), true);
  assert.equal(command.checkCallback(false), true);
  assert.equal(harness.spawned.length, 1);
  assert.deepEqual(plain(harness.spawned[0].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:status",
  ]);
  assert.equal(
    harness.spawned[0].executable,
    "C:\\Windows\\System32\\cmd.exe",
  );
  assert.deepEqual(plain(harness.spawned[0].options), {
    cwd: "D:\\Study\\blog",
    shell: false,
    windowsHide: true,
  });

  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from("[maintenance] 健康 · content/projects/myblog.md · review by 2027-02-01"),
  );
  harness.spawned[0].child.emit("close", 0);
  assert.equal(harness.notices[0].hidden, true);
  assert.equal(harness.notices.at(-1).message, "已发布内容复核队列已更新。");
  assert.equal(harness.modals.length, 1);
  assert.deepEqual(childText(harness.modals[0], "h2"), ["已发布内容复核队列"]);
  assert.match(childText(harness.modals[0], "p")[0], /不会修改 reviewedAt/u);
  assert.match(childText(harness.modals[0], "pre")[0], /content\/projects\/myblog\.md/u);
});

test("keeps reports desktop-only and cleans up failures and active children", async () => {
  const mobile = await createPluginHarness({ desktop: false });
  const mobileCommand = mobile.commands.find(
    (candidate) => candidate.id === "inspect-published-maintenance",
  );
  assert.equal(mobileCommand.checkCallback(true), false);
  assert.equal(mobile.spawned.length, 0);

  const harness = await createPluginHarness();
  const maintenance = harness.commands.find(
    (candidate) => candidate.id === "inspect-published-maintenance",
  );
  const inbox = harness.commands.find(
    (candidate) => candidate.id === "inspect-inbox-readiness",
  );
  maintenance.checkCallback(false);
  inbox.checkCallback(false);
  assert.equal(harness.spawned.length, 2);
  assert.equal(harness.plugin.activeRuns.size, 2);

  harness.spawned[0].child.emit("error", new Error("spawn unavailable"));
  assert.equal(harness.plugin.activeRuns.size, 1);
  assert.equal(harness.notices[0].hidden, true);
  assert.match(harness.notices.at(-1).message, /内容复核检查无法启动.*spawn unavailable/su);
  const noticeCountAfterError = harness.notices.length;
  harness.spawned[0].child.emit("close", 1);
  assert.equal(harness.notices.length, noticeCountAfterError);

  harness.plugin.onunload();
  assert.equal(harness.plugin.activeRuns.size, 0);
  assert.equal(harness.notices[1].hidden, true);
  assert.equal(harness.spawned.length, 3);
  assert.equal(harness.spawned[2].executable, "taskkill.exe");
  assert.deepEqual(plain(harness.spawned[2].args), [
    "/pid",
    String(harness.spawned[1].child.pid),
    "/t",
    "/f",
  ]);
  assert.deepEqual(plain(harness.spawned[2].options), {
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  harness.spawned[2].child.emit("error", new Error("taskkill unavailable"));
  assert.equal(harness.spawned[1].child.killed, true);
});

test("runs the maintenance report without a shell on POSIX desktops", async () => {
  const harness = await createPluginHarness({ platform: "linux" });
  const command = harness.commands.find(
    (candidate) => candidate.id === "inspect-published-maintenance",
  );
  command.checkCallback(false);
  assert.equal(harness.spawned[0].executable, "npm");
  assert.deepEqual(plain(harness.spawned[0].args), [
    "--silent",
    "run",
    "content:status",
  ]);
  assert.equal(harness.spawned[0].options.shell, false);
  assert.equal(harness.spawned[0].options.windowsHide, true);
  harness.plugin.onunload();
  assert.equal(harness.spawned.length, 1);
  assert.equal(harness.spawned[0].child.killed, true);
});
