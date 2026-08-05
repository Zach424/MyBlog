import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const pluginUrl = new URL(
  "../.obsidian/plugins/myblog-publisher/main.js",
  import.meta.url,
);
const manifestUrl = new URL(
  "../.obsidian/plugins/myblog-publisher/manifest.json",
  import.meta.url,
);
const stylesUrl = new URL(
  "../.obsidian/plugins/myblog-publisher/styles.css",
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
  const classes = new Set(
    typeof options.cls === "string" ? options.cls.split(/\s+/u).filter(Boolean) : [],
  );
  const events = new Map();
  return {
    attributes: {},
    children: [],
    classes,
    style: {},
    tag,
    text: options.text ?? "",
    addClass(...names) {
      for (const name of names) classes.add(name);
    },
    addEventListener(name, listener) {
      const current = events.get(name) ?? [];
      current.push(listener);
      events.set(name, current);
    },
    createDiv(childOptions = {}) {
      return this.createEl("div", childOptions);
    },
    createEl(childTag, childOptions = {}) {
      const child = createElement(childTag, childOptions);
      this.children.push(child);
      return child;
    },
    empty() {
      this.children.length = 0;
    },
    setAttr(name, value) {
      this.attributes[name] = String(value);
    },
    setText(value) {
      this.text = String(value);
    },
    async trigger(name) {
      for (const listener of events.get(name) ?? []) await listener();
    },
  };
}

async function createPluginHarness({
  activeFilePath,
  desktop = true,
  files = ["content/projects/myblog.md"],
  platform = "win32",
} = {}) {
  const source = await readFile(pluginUrl, "utf8");
  const commands = [];
  const modals = [];
  const notices = [];
  const openedFiles = [];
  let reconciliations = 0;
  const spawned = [];

  class FileSystemAdapter {
    getBasePath() {
      return "D:\\Study\\blog";
    }

    reconcile() {
      reconciliations += 1;
    }
  }

  class Modal {
    constructor(app) {
      this.app = app;
      this.closed = false;
      this.contentEl = createElement("div");
    }

    close() {
      this.closed = true;
      this.onClose?.();
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

  const fileMap = new Map(
    files.map((path) => [
      path,
      { extension: path.endsWith(".md") ? "md" : "", path },
    ]),
  );
  const adapter = desktop ? new FileSystemAdapter() : {};
  const app = {
    vault: {
      adapter,
      getAbstractFileByPath(path) {
        return fileMap.get(path) ?? null;
      },
    },
    workspace: {
      getActiveFile: () =>
        activeFilePath
          ? {
              extension: activeFilePath.endsWith(".md") ? "md" : "",
              path: activeFilePath,
            }
          : undefined,
      getLeaf: () => ({
        async openFile(file) {
          openedFiles.push(file);
        },
      }),
    },
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

  return {
    commands,
    get reconciliations() {
      return reconciliations;
    },
    modals,
    notices,
    openedFiles,
    plugin,
    spawned,
  };
}

function allElements(root) {
  return root.children.flatMap((child) => [child, ...allElements(child)]);
}

function elementsByTag(modal, tag) {
  return allElements(modal.contentEl).filter((element) => element.tag === tag);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function maintenanceRecord({
  ageDays = 0,
  kind = "project",
  maxAgeDays = 180,
  slug = "myblog",
  status = "healthy",
} = {}) {
  const buildDate = "2026-08-05";
  const reviewedAt = shiftDate(buildDate, -ageDays);
  const sourceDirectory = kind === "post" ? "posts" : "projects";
  return {
    ageDays,
    kind,
    remainingDays: maxAgeDays - ageDays,
    reviewedAt,
    reviewBy: shiftDate(reviewedAt, maxAgeDays),
    slug,
    sourcePath: `content/${sourceDirectory}/${slug}.md`,
    status,
    title: slug === "myblog" ? "MyBlog 项目复盘" : slug,
    url: `/${sourceDirectory}/${slug}`,
  };
}

function maintenanceReport({ records = [maintenanceRecord()], version = 1 } = {}) {
  const counts = {
    healthy: records.filter((record) => record.status === "healthy").length,
    "review-soon": records.filter((record) => record.status === "review-soon").length,
    "due-soon": records.filter((record) => record.status === "due-soon").length,
    overdue: records.filter((record) => record.status === "overdue").length,
  };
  return {
    version,
    buildDate: "2026-08-05",
    counts,
    currentCount: records.length,
    excludedCount: 0,
    historicalCount: 0,
    maxAgeDays: 180,
    records,
    reviewChecklist: [
      "核对结论是否仍然成立",
      "复查链接、命令和截图",
      "更新 reviewedAt 后再发布",
    ],
    thresholds: { dueSoonDays: 7, reviewSoonDays: 30 },
  };
}

function contentReviewProof({
  candidateAlgorithm = "sha256",
  candidateDigest = "0123456789abcdef".repeat(4),
  candidateStable = true,
  deferredPaths = [],
  sourcePath = "content/projects/myblog.md",
  untrackedPaths = [],
  version = 3,
} = {}) {
  const untrackedSet = new Set(untrackedPaths);
  const changedPaths = [
    sourcePath,
    ...deferredPaths.filter((path) => !untrackedSet.has(path)),
  ].sort((left, right) => left.localeCompare(right, "en"));
  return {
    version,
    mode: "check-only",
    candidate: {
      algorithm: candidateAlgorithm,
      digest: candidateDigest,
      stableAfterQualityGate: candidateStable,
    },
    review: {
      kind: "project",
      previousReviewedAt: "2026-08-04",
      previousUpdatedAt: "2026-08-04",
      reviewedAt: "2026-08-05",
      slug: "myblog",
      sourcePath,
      substantiveChanged: true,
      title: "MyBlog 项目复盘",
      updatedAt: "2026-08-05",
    },
    git: {
      branch: "main",
      changedPaths,
      committablePaths: [sourcePath],
      deferredPaths,
      stagedPaths: [],
      untrackedPaths,
    },
    qualityGate: {
      command: "npm run check",
      status: "passed",
    },
  };
}

function reviewDeliveryReport({
  ahead = 1,
  behind = 0,
  networkChecked = false,
  pending = true,
  status = "pending-review",
  version = 1,
} = {}) {
  const trackingHead = "a".repeat(40);
  const localHead = pending ? "b".repeat(40) : trackingHead;
  return {
    version,
    mode: "read-only",
    observation: {
      currentBranch: "main",
      localHead,
      localRef: "refs/heads/main",
      networkChecked,
      trackingHead,
      trackingRef: "refs/remotes/origin/main",
    },
    relation: { ahead, behind, status },
    pendingReview: pending
      ? {
          blobOid: "d".repeat(40),
          commitOid: localHead,
          parentOid: trackingHead,
          slug: "myblog",
          sourcePath: "content/projects/myblog.md",
          subject: "content: review myblog",
          treeOid: "c".repeat(40),
        }
      : null,
    recovery: pending
      ? {
          action: "push-origin-main",
          autoExecuted: false,
          command: "git push origin main",
        }
      : { action: "none", autoExecuted: false, command: null },
  };
}

function reviewDeliveryReceipt() {
  const parentOid = "a".repeat(40);
  const commitOid = "b".repeat(40);
  return {
    version: 1,
    mode: "delivered",
    review: {
      blobOid: "d".repeat(40),
      commitOid,
      parentOid,
      slug: "myblog",
      sourcePath: "content/projects/myblog.md",
      subject: "content: review myblog",
      treeOid: "c".repeat(40),
    },
    transition: {
      after: {
        localHead: commitOid,
        relation: "synchronized",
        trackingHead: commitOid,
      },
      before: {
        localHead: commitOid,
        relation: "pending-review",
        trackingHead: parentOid,
      },
      command: `git push origin ${commitOid}:refs/heads/main`,
    },
    safety: {
      fetchExecuted: false,
      headStable: true,
      indexStable: true,
      rebaseExecuted: false,
      resetExecuted: false,
      worktreeStable: true,
    },
  };
}

function findCommand(harness, id) {
  const command = harness.commands.find((candidate) => candidate.id === id);
  assert.ok(command, `Expected command ${id}`);
  return command;
}

test("renders a versioned maintenance ledger and opens an exact Vault note", async () => {
  const [manifestSource, styles, harness] = await Promise.all([
    readFile(manifestUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
    createPluginHarness(),
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.version, "1.9.0");
  assert.equal(manifest.isDesktopOnly, true);
  assert.match(styles, /^\.myblog-maintenance \{/mu);
  assert.match(styles, /\[data-status="overdue"\]/u);
  assert.match(styles, /font-family: var\(--font-interface\)/u);
  assert.match(styles, /^\.myblog-review-proof \{/mu);
  assert.match(styles, /myblog-review-proof__transition/u);
  assert.match(styles, /myblog-review-proof__deferred/u);
  assert.match(styles, /myblog-review-proof__candidate/u);
  assert.match(styles, /^\.myblog-review-delivery \{/mu);
  assert.match(styles, /^\.myblog-review-delivery-receipt \{/mu);
  assert.doesNotMatch(styles, /(?:linear-gradient|@keyframes|animation:)/u);

  const command = findCommand(harness, "inspect-published-maintenance");
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
    "--",
    "--format",
    "json",
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
    Buffer.from(JSON.stringify(maintenanceReport())),
  );
  harness.spawned[0].child.emit("close", 0);
  assert.equal(harness.notices[0].hidden, true);
  assert.equal(harness.modals.length, 1);
  assert.equal(
    harness.modals[0].contentEl.classes.has("myblog-maintenance"),
    true,
  );
  assert.deepEqual(
    elementsByTag(harness.modals[0], "h2").map((element) => element.text),
    ["已发布内容复核台账"],
  );
  assert.match(
    elementsByTag(harness.modals[0], "h3")[0].text,
    /MyBlog 项目复盘/u,
  );
  assert.equal(
    elementsByTag(harness.modals[0], "code")[0].text,
    "content/projects/myblog.md",
  );
  const openButton = elementsByTag(harness.modals[0], "button").find(
    (button) => button.text === "打开笔记",
  );
  assert.ok(openButton);
  assert.equal(openButton.attributes["aria-label"], "打开 content/projects/myblog.md");
  await openButton.trigger("click");
  assert.deepEqual(
    harness.openedFiles.map((file) => file.path),
    ["content/projects/myblog.md"],
  );
  assert.equal(harness.modals[0].closed, true);
});

test("shows a local-only pending review delivery rail without executing recovery", async () => {
  const harness = await createPluginHarness();
  const command = findCommand(harness, "inspect-review-delivery");
  assert.equal(command.checkCallback(true), true);
  command.checkCallback(false);
  assert.deepEqual(plain(harness.spawned[0].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:review:status",
    "--",
    "--format",
    "json",
  ]);
  const report = reviewDeliveryReport();
  harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(report)));
  harness.spawned[0].child.emit("close", 1);

  assert.equal(harness.modals.length, 1);
  const modal = harness.modals[0];
  assert.equal(modal.contentEl.classes.has("myblog-review-delivery"), true);
  assert.equal(elementsByTag(modal, "button").length, 0);
  const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
  assert.match(text, /DELIVERY HOLD \/ LOCAL ONLY/u);
  assert.match(text, /ORIGIN\/MAIN · LAST OBSERVED.*\+1.*LOCAL MAIN/su);
  assert.match(text, /PENDING \/ NOT ON TRACKING REF/u);
  assert.match(text, /content\/projects\/myblog\.md/u);
  assert.match(text, /git push origin main/u);
  assert.match(text, /没有 fetch、push 或历史修改/u);
  assert.ok(
    elementsByTag(modal, "code").some(
      (element) => element.text === report.pendingReview.treeOid,
    ),
  );
  assert.equal(harness.spawned.length, 1);
});

test("falls back to local-only text when delivery evidence is inconsistent", () => {
  const harnessPromise = createPluginHarness();
  return harnessPromise.then((harness) => {
    const report = reviewDeliveryReport();
    report.pendingReview.parentOid = "e".repeat(40);
    findCommand(harness, "inspect-review-delivery").checkCallback(false);
    harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(report)));
    harness.spawned[0].child.emit("close", 1);
    assert.equal(harness.spawned.length, 2);
    assert.deepEqual(plain(harness.spawned[1].args), [
      "/d",
      "/s",
      "/c",
      "npm",
      "--silent",
      "run",
      "content:review:status",
    ]);
    harness.spawned[1].child.stdout.emit(
      "data",
      Buffer.from("[review-delivery] 本地 main 有 1 个待同步复核提交。"),
    );
    harness.spawned[1].child.emit("close", 1);
    assert.equal(harness.modals.length, 1);
    assert.match(
      elementsByTag(harness.modals[0], "pre")[0].text,
      /待同步复核提交/u,
    );
  });
});

test("delivers an exact pending review and renders a sealed receipt", async () => {
  const harness = await createPluginHarness();
  const command = findCommand(harness, "deliver-pending-review");
  assert.equal(command.checkCallback(true), true);
  command.checkCallback(false);
  assert.deepEqual(plain(harness.spawned[0].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:review:deliver",
    "--",
    "--format",
    "json",
  ]);
  const receipt = reviewDeliveryReceipt();
  harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(receipt)));
  harness.spawned[0].child.emit("close", 0);
  assert.equal(harness.reconciliations, 1);
  assert.equal(harness.modals.length, 1);
  const modal = harness.modals[0];
  assert.equal(
    modal.contentEl.classes.has("myblog-review-delivery-receipt"),
    true,
  );
  assert.equal(elementsByTag(modal, "button").length, 0);
  const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
  assert.match(text, /DELIVERY RECEIPT \/ SYNCHRONIZED/u);
  assert.match(
    text,
    /VERIFIED LOCAL COMMIT.*SEALED PUSH.*ORIGIN\/MAIN · OBSERVED AFTER PUSH/su,
  );
  assert.match(text, /HEAD STABLE.*INDEX STABLE.*WORKTREE STABLE/su);
  assert.match(text, /content\/projects\/myblog\.md/u);
  assert.ok(text.includes(receipt.transition.command));
  assert.ok(
    elementsByTag(modal, "code").some(
      (element) => element.text === receipt.review.treeOid,
    ),
  );

  const mobile = await createPluginHarness({ desktop: false });
  assert.equal(findCommand(mobile, "deliver-pending-review").checkCallback(true), false);
});

test("does not retry delivery or reconcile when its success receipt is invalid", async () => {
  const harness = await createPluginHarness();
  const receipt = reviewDeliveryReceipt();
  receipt.transition.after.trackingHead = "e".repeat(40);
  findCommand(harness, "deliver-pending-review").checkCallback(false);
  harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(receipt)));
  harness.spawned[0].child.emit("close", 0);
  assert.equal(harness.spawned.length, 1);
  assert.equal(harness.modals.length, 0);
  assert.equal(harness.reconciliations, 0);
  assert.ok(
    harness.notices.some((notice) =>
      /重新同步未能生成可信回执/u.test(notice.message),
    ),
  );
});

test("accepts a valid overdue report even though the CLI exits with code 1", async () => {
  const overdue = maintenanceRecord({ ageDays: 181, status: "overdue" });
  const harness = await createPluginHarness();
  findCommand(harness, "inspect-published-maintenance").checkCallback(false);
  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(maintenanceReport({ records: [overdue] }))),
  );
  harness.spawned[0].child.emit("close", 1);

  assert.equal(harness.modals.length, 1);
  const record = allElements(harness.modals[0].contentEl).find((element) =>
    element.classes.has("myblog-maintenance__record"),
  );
  assert.ok(record);
  assert.equal(record.attributes["data-status"], "overdue");
  assert.equal(harness.spawned.length, 1);
});

test("falls back to the plain-text report for invalid JSON, schema, or paths", async (t) => {
  const invalidCases = [
    ["invalid JSON", "not-json"],
    ["unsupported version", JSON.stringify(maintenanceReport({ version: 2 }))],
    [
      "unsafe path",
      JSON.stringify(
        maintenanceReport({
          records: [
            {
              ...maintenanceRecord(),
              sourcePath: "content/projects/../private.md",
            },
          ],
        }),
      ),
    ],
  ];

  for (const [name, primaryOutput] of invalidCases) {
    await t.test(name, async () => {
      const harness = await createPluginHarness();
      findCommand(harness, "inspect-published-maintenance").checkCallback(false);
      harness.spawned[0].child.stdout.emit("data", Buffer.from(primaryOutput));
      harness.spawned[0].child.emit("close", 0);
      assert.equal(harness.spawned.length, 2);
      assert.deepEqual(plain(harness.spawned[1].args), [
        "/d",
        "/s",
        "/c",
        "npm",
        "--silent",
        "run",
        "content:status",
      ]);
      harness.spawned[1].child.stdout.emit(
        "data",
        Buffer.from("[maintenance] 纯文本复核证据"),
      );
      harness.spawned[1].child.emit("close", 1);
      assert.equal(harness.modals.length, 1);
      assert.match(elementsByTag(harness.modals[0], "pre")[0].text, /纯文本复核证据/u);
    });
  }
});

test("shows an empty structured state without inventing records", async () => {
  const harness = await createPluginHarness();
  findCommand(harness, "inspect-published-maintenance").checkCallback(false);
  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(maintenanceReport({ records: [] }))),
  );
  harness.spawned[0].child.emit("close", 0);

  assert.equal(harness.modals.length, 1);
  assert.equal(elementsByTag(harness.modals[0], "button").length, 0);
  assert.match(
    elementsByTag(harness.modals[0], "p")
      .map((element) => element.text)
      .join(" "),
    /当前没有已发布内容需要纳入复核/u,
  );
});

test("refuses to open a missing Vault file", async () => {
  const harness = await createPluginHarness({ files: [] });
  findCommand(harness, "inspect-published-maintenance").checkCallback(false);
  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(maintenanceReport())),
  );
  harness.spawned[0].child.emit("close", 0);
  const openButton = elementsByTag(harness.modals[0], "button").find(
    (button) => button.text === "打开笔记",
  );
  await openButton.trigger("click");
  assert.equal(harness.openedFiles.length, 0);
  assert.match(harness.notices.at(-1).message, /找不到可打开的 Markdown 笔记/u);
  assert.equal(harness.modals[0].closed, false);
});

test("keeps reports desktop-only and cleans up failures and active children", async () => {
  const mobile = await createPluginHarness({ desktop: false });
  const mobileCommand = findCommand(mobile, "inspect-published-maintenance");
  assert.equal(mobileCommand.checkCallback(true), false);
  assert.equal(mobile.spawned.length, 0);

  const harness = await createPluginHarness();
  const maintenance = findCommand(harness, "inspect-published-maintenance");
  const inbox = findCommand(harness, "inspect-inbox-readiness");
  maintenance.checkCallback(false);
  inbox.checkCallback(false);
  assert.equal(harness.spawned.length, 2);
  assert.equal(harness.plugin.activeRuns.size, 2);

  harness.spawned[0].child.emit("error", new Error("spawn unavailable"));
  assert.equal(harness.plugin.activeRuns.size, 1);
  assert.equal(harness.notices[0].hidden, true);
  assert.match(harness.notices.at(-1).message, /spawn unavailable/su);
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

test("runs the JSON maintenance report without a shell on POSIX desktops", async () => {
  const harness = await createPluginHarness({ platform: "linux" });
  const command = findCommand(harness, "inspect-published-maintenance");
  command.checkCallback(false);
  assert.equal(harness.spawned[0].executable, "npm");
  assert.deepEqual(plain(harness.spawned[0].args), [
    "--silent",
    "run",
    "content:status",
    "--",
    "--format",
    "json",
  ]);
  assert.equal(harness.spawned[0].options.shell, false);
  assert.equal(harness.spawned[0].options.windowsHide, true);
  harness.plugin.onunload();
  assert.equal(harness.spawned.length, 1);
  assert.equal(harness.spawned[0].child.killed, true);
});

test("checks or syncs only the active formal content note", async () => {
  const activeFilePath = "content/projects/myblog.md";
  const harness = await createPluginHarness({ activeFilePath });
  const check = findCommand(harness, "validate-current-published-note");
  const sync = findCommand(harness, "review-current-published-note");
  assert.equal(check.checkCallback(true), true);
  assert.equal(sync.checkCallback(true), true);

  check.checkCallback(false);
  assert.deepEqual(plain(harness.spawned[0].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "run",
    "content:review",
    "--",
    activeFilePath,
    "--check-only",
    "--format",
    "json",
  ]);
  const proof = contentReviewProof({
    deferredPaths: [
      "content/inbox/parallel-draft.md",
      "public/uploads/Pasted image 20260805.png",
    ],
    untrackedPaths: ["public/uploads/Pasted image 20260805.png"],
  });
  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(proof)),
  );
  harness.spawned[0].child.emit("close", 0);
  assert.equal(harness.reconciliations, 0);
  assert.equal(harness.modals.length, 1);
  assert.equal(
    harness.modals[0].contentEl.classes.has("myblog-review-proof"),
    true,
  );
  assert.deepEqual(
    elementsByTag(harness.modals[0], "h2").map((element) => element.text),
    ["正式内容复核证据"],
  );
  assert.match(
    elementsByTag(harness.modals[0], "p")
      .map((element) => element.text)
      .join(" "),
    /尚未暂存、提交或推送/u,
  );
  assert.equal(elementsByTag(harness.modals[0], "button").length, 0);
  assert.ok(
    elementsByTag(harness.modals[0], "code").some(
      (element) => element.text === activeFilePath,
    ),
  );
  assert.match(
    allElements(harness.modals[0].contentEl)
      .map((element) => element.text)
      .join(" "),
    /DEFERRED \/ NOT IN COMMIT.*2 条.*MODIFIED.*UNTRACKED/su,
  );
  assert.match(
    allElements(harness.modals[0].contentEl)
      .map((element) => element.text)
      .join(" "),
    /CANDIDATE \/ GATE-STABLE.*门前与完整质量门后的字节一致/su,
  );
  const fingerprint = elementsByTag(harness.modals[0], "code").find(
    (element) => element.text === "sha256:0123456789ab…89abcdef",
  );
  assert.ok(fingerprint);
  assert.equal(
    fingerprint.attributes.title,
    `sha256:${proof.candidate.digest}`,
  );
  assert.equal(
    fingerprint.attributes["aria-label"],
    `完整内容候选 SHA-256：${proof.candidate.digest}`,
  );
  for (const deferredPath of proof.git.deferredPaths) {
    assert.ok(
      elementsByTag(harness.modals[0], "code").some(
        (element) => element.text === deferredPath,
      ),
    );
  }

  sync.checkCallback(false);
  assert.deepEqual(plain(harness.spawned[1].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "run",
    "content:review",
    "--",
    activeFilePath,
    "--push",
  ]);
  harness.spawned[1].child.emit("close", 0);
  assert.equal(harness.reconciliations, 1);

  const inbox = await createPluginHarness({
    activeFilePath: "content/inbox/draft.md",
  });
  assert.equal(
    findCommand(inbox, "validate-current-published-note").checkCallback(true),
    false,
  );
  assert.equal(
    findCommand(inbox, "review-current-published-note").checkCallback(true),
    false,
  );
  const mobile = await createPluginHarness({ activeFilePath, desktop: false });
  assert.equal(
    findCommand(mobile, "review-current-published-note").checkCallback(true),
    false,
  );
});

test("falls back to plain review evidence for invalid or mismatched proof JSON", async (t) => {
  const activeFilePath = "content/projects/myblog.md";
  const inconsistentUpdate = contentReviewProof();
  inconsistentUpdate.review.updatedAt = "2026-08-04";
  const unsafeDeferred = contentReviewProof({
    deferredPaths: ["scripts/unsafe.mjs"],
  });
  const missingDeferred = contentReviewProof({
    untrackedPaths: ["content/inbox/new-draft.md"],
  });
  const modifiedRootMedia = contentReviewProof({
    deferredPaths: ["public/uploads/tracked.png"],
  });
  const invalidDigest = contentReviewProof({ candidateDigest: "not-a-digest" });
  const unstableCandidate = contentReviewProof({ candidateStable: false });
  const invalidAlgorithm = contentReviewProof({ candidateAlgorithm: "sha512" });
  const cases = [
    ["invalid JSON", "not-json"],
    [
      "mismatched source",
      JSON.stringify(
        contentReviewProof({ sourcePath: "content/projects/other.md" }),
      ),
    ],
    ["unsupported version", JSON.stringify(contentReviewProof({ version: 4 }))],
    ["inconsistent update evidence", JSON.stringify(inconsistentUpdate)],
    ["unsafe deferred path", JSON.stringify(unsafeDeferred)],
    ["untracked path missing from deferred", JSON.stringify(missingDeferred)],
    ["modified root media", JSON.stringify(modifiedRootMedia)],
    ["invalid candidate digest", JSON.stringify(invalidDigest)],
    ["unstable candidate", JSON.stringify(unstableCandidate)],
    ["invalid candidate algorithm", JSON.stringify(invalidAlgorithm)],
  ];

  for (const [name, output] of cases) {
    await t.test(name, async () => {
      const harness = await createPluginHarness({ activeFilePath });
      findCommand(harness, "validate-current-published-note").checkCallback(false);
      harness.spawned[0].child.stdout.emit("data", Buffer.from(output));
      harness.spawned[0].child.emit("close", 0);
      assert.equal(harness.spawned.length, 2);
      assert.deepEqual(plain(harness.spawned[1].args), [
        "/d",
        "/s",
        "/c",
        "npm",
        "run",
        "content:review",
        "--",
        activeFilePath,
        "--check-only",
      ]);
      harness.spawned[1].child.stdout.emit(
        "data",
        Buffer.from("[review] 正式内容复核检查通过；未暂存、未提交、未推送。"),
      );
      harness.spawned[1].child.emit("close", 0);
      assert.equal(harness.modals.length, 1);
      assert.match(
        elementsByTag(harness.modals[0], "pre")[0].text,
        /未暂存、未提交、未推送/u,
      );
    });
  }
});
