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
  throwSpawnAt = [],
} = {}) {
  const source = await readFile(pluginUrl, "utf8");
  const commands = [];
  const modals = [];
  const notices = [];
  const openedFiles = [];
  let reconciliations = 0;
  const spawned = [];
  let spawnAttempts = 0;

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
    const attempt = spawnAttempts;
    spawnAttempts += 1;
    if (throwSpawnAt.includes(attempt)) {
      throw new Error("spawn unavailable");
    }
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

function publishDeliveryReport({
  ahead = 1,
  behind = 0,
  pending = true,
  status = "pending-publication",
  version = 1,
} = {}) {
  const trackingHead = "1".repeat(40);
  const localHead = pending ? "2".repeat(40) : trackingHead;
  const targetBlobOid = "4".repeat(40);
  return {
    version,
    mode: "read-only",
    observation: {
      currentBranch: "main",
      localHead,
      localRef: "refs/heads/main",
      networkChecked: false,
      trackingHead,
      trackingRef: "refs/remotes/origin/main",
    },
    relation: { ahead, behind, status },
    pendingPublication: pending
      ? {
          attachmentCount: 1,
          changes: [
            {
              newBlobOid: null,
              oldBlobOid: "5".repeat(40),
              path: "content/inbox/new-delivery.md",
              status: "deleted",
            },
            {
              newBlobOid: targetBlobOid,
              oldBlobOid: null,
              path: "content/posts/new-delivery.md",
              status: "added",
            },
            {
              newBlobOid: "6".repeat(40),
              oldBlobOid: null,
              path: "public/uploads/new-delivery/evidence.webp",
              status: "added",
            },
          ],
          commitOid: localHead,
          inboxSourcePath: "content/inbox/new-delivery.md",
          kind: "post",
          parentOid: trackingHead,
          slug: "new-delivery",
          sourceDeletionTracked: true,
          subject: "content: publish new-delivery",
          targetBlobOid,
          targetPath: "content/posts/new-delivery.md",
          title: "新内容交付证明",
          treeOid: "3".repeat(40),
        }
      : null,
    recovery: pending
      ? {
          action: "push-pending-publication",
          autoExecuted: false,
          command: `git push origin ${localHead}:refs/heads/main`,
        }
      : { action: "none", autoExecuted: false, command: null },
  };
}

function publishDeliveryReceipt() {
  const report = publishDeliveryReport();
  const publication = report.pendingPublication;
  return {
    version: 1,
    mode: "delivered",
    publication,
    transition: {
      before: {
        localHead: publication.commitOid,
        relation: "pending-publication",
        trackingHead: publication.parentOid,
      },
      after: {
        localHead: publication.commitOid,
        relation: "synchronized",
        trackingHead: publication.commitOid,
      },
      command: `git push origin ${publication.commitOid}:refs/heads/main`,
    },
    safety: {
      fetchExecuted: false,
      headStable: true,
      indexStable: true,
      manifestStable: true,
      rebaseExecuted: false,
      resetExecuted: false,
      worktreeStable: true,
    },
  };
}

function deliveryTriageReport({
  currentBranch = "main",
  kind = "publication",
} = {}) {
  const source = kind === "review"
    ? reviewDeliveryReport()
    : publishDeliveryReport();
  const deliverable = currentBranch === "main";
  const review = kind === "review" ? source.pendingReview : null;
  const publication = kind === "publication"
    ? source.pendingPublication
    : null;
  return {
    version: 1,
    mode: "read-only",
    observation: {
      ...source.observation,
      currentBranch,
    },
    relation: {
      ...source.relation,
      status: `pending-${kind}`,
    },
    pending: { kind, publication, review },
    route: {
      autoExecuted: false,
      deliverCommand: deliverable
        ? `npm run content:${kind === "review" ? "review" : "publish"}:deliver -- --format json`
        : null,
      deliverable,
      kind,
      statusCommand: `npm run content:${kind === "review" ? "review" : "publish"}:status`,
    },
  };
}

function authorDoctorReport() {
  const checkDefinitions = [
    ["node-runtime", "runtime", "Node.js runtime", "v24.14.0", ">=22.13.0"],
    ["npm-cli", "runtime", "npm CLI", "11.9.0", "available semantic version"],
    ["git-cli", "runtime", "Git CLI", "git version 2.37.1.windows.1", "available version"],
    ["repository-root", "git", "Repository root", "D:/Study/blog", "current directory equals Git toplevel"],
    ["main-branch", "git", "Current branch", "main", "main"],
    ["delivery-baseline", "git", "Delivery baseline", "origin/main · synchronized", "main -> origin/main synchronized"],
    ["author-identity", "git", "Author identity", "name configured · email configured", "user.name and user.email configured"],
    ["workspace-contract", "workspace", "Workspace contract", "zach424-myblog · node >=22.13.0", "zach424-myblog · node >=22.13.0"],
    ["npm-scripts", "workspace", "Author scripts", "11/11 required scripts", "11 required author scripts"],
    ["workspace-dependencies", "workspace", "Workspace dependencies", "35/35 pinned packages", "all declared packages installed at pinned versions"],
    ["content-layout", "workspace", "Content layout", "5/5 required paths", "5 required authoring paths"],
    ["obsidian-vault", "vault", "Obsidian Vault", ".obsidian present", ".obsidian directory present"],
    ["publisher-plugin", "vault", "MyBlog Publisher", "myblog-publisher@1.18.0 · desktop", "myblog-publisher 1.18.0 desktop plugin"],
  ];
  const scripts = [
    "content:author:doctor",
    "content:delivery:status",
    "content:inbox",
    "content:publish",
    "content:publish:deliver",
    "content:publish:status",
    "content:review",
    "content:review:deliver",
    "content:review:status",
    "content:status",
    "release:check",
  ];
  const paths = [
    ["content/inbox", "directory"],
    ["content/posts", "directory"],
    ["content/projects", "directory"],
    ["docs/STATUS.md", "file"],
    ["templates/obsidian", "directory"],
  ].map(([path, kind]) => ({ kind, path, present: true }));
  return {
    version: 1,
    mode: "read-only",
    status: "ready",
    observation: {
      currentDirectory: "D:/Study/blog",
      gitVersion: "git version 2.37.1.windows.1",
      identity: { emailConfigured: true, nameConfigured: true },
      nodeVersion: "v24.14.0",
      npmVersion: "11.9.0",
      repository: {
        currentBranch: "main",
        localHead: "a".repeat(40),
        relation: "synchronized",
        root: "D:/Study/blog",
        trackingHead: "a".repeat(40),
        upstream: "origin/main",
      },
      vault: {
        obsidianDirectoryPresent: true,
        plugin: {
          id: "myblog-publisher",
          isDesktopOnly: true,
          mainPresent: true,
          stylesPresent: true,
          version: "1.18.0",
        },
      },
      workspace: {
        dependencyExpected: 35,
        dependencyIssues: [],
        dependencyMatching: 35,
        nodeEngine: ">=22.13.0",
        packageName: "zach424-myblog",
        paths,
        scriptNames: scripts,
      },
    },
    summary: { attention: 0, passed: 13, total: 13 },
    checks: checkDefinitions.map(([id, group, label, observed, expected]) => ({
      expected,
      group,
      id,
      label,
      observed,
      resolution: null,
      status: "pass",
    })),
    safety: {
      configurationChanged: false,
      credentialsRead: false,
      filesChanged: false,
      networkChecked: false,
    },
  };
}

function authorDoctorAttentionReport() {
  const report = authorDoctorReport();
  report.status = "needs-attention";
  report.observation.identity.emailConfigured = false;
  report.summary = { attention: 1, passed: 12, total: 13 };
  const identity = report.checks.find((check) => check.id === "author-identity");
  identity.observed = "name configured · email missing";
  identity.resolution = "配置 Git user.name 与 user.email 后重新检查";
  identity.status = "attention";
  return report;
}

const authorDoctorCommandArgs = [
  "/d",
  "/s",
  "/c",
  "npm",
  "--silent",
  "run",
  "content:author:doctor",
  "--",
  "--format",
  "json",
];

function finishReadyAuthorPreflight(harness, index) {
  assert.deepEqual(plain(harness.spawned[index].args), authorDoctorCommandArgs);
  harness.spawned[index].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(authorDoctorReport())),
  );
  harness.spawned[index].child.emit("close", 0);
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
  assert.equal(manifest.version, "1.18.0");
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
  assert.match(styles, /^\.myblog-delivery-triage \{/mu);
  assert.match(styles, /^\.myblog-author-doctor \{/mu);
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

test("renders an exact pending publication as an atomic commit envelope", async () => {
  const [styles, harness] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    createPluginHarness(),
  ]);
  const command = findCommand(harness, "inspect-publish-delivery");
  assert.equal(command.checkCallback(true), true);
  command.checkCallback(false);
  assert.deepEqual(plain(harness.spawned[0].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:publish:status",
    "--",
    "--format",
    "json",
  ]);
  const report = publishDeliveryReport();
  harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(report)));
  harness.spawned[0].child.emit("close", 1);

  assert.equal(harness.modals.length, 1);
  const modal = harness.modals[0];
  assert.equal(modal.contentEl.classes.has("myblog-publish-delivery"), true);
  assert.equal(elementsByTag(modal, "button").length, 0);
  const text = allElements(modal.contentEl)
    .map((element) => element.text)
    .join(" ");
  assert.match(text, /PUBLICATION HOLD \/ ATOMIC BUNDLE/u);
  assert.match(text, /ORIGIN\/MAIN · LAST OBSERVED.*\+1.*LOCAL MAIN/su);
  assert.match(text, /COMMIT ENVELOPE \/ 3 PATHS/u);
  assert.match(text, /NOTE \/ ADDED.*content\/posts\/new-delivery\.md/su);
  assert.match(
    text,
    /MEDIA 01 \/ ADDED.*public\/uploads\/new-delivery\/evidence\.webp/su,
  );
  assert.match(text, /INBOX \/ DELETED.*content\/inbox\/new-delivery\.md/su);
  assert.match(
    text,
    new RegExp(`git push origin ${report.pendingPublication.commitOid}:refs/heads/main`, "u"),
  );
  assert.match(text, /没有 fetch、push 或历史修改/u);
  assert.match(styles, /\.myblog-publish-delivery__manifest/u);
  assert.match(styles, /\.myblog-publish-delivery__manifest-item/u);
  assert.equal(harness.spawned.length, 1);
});

test("falls back to publication delivery text when the bundle is inconsistent", async () => {
  const harness = await createPluginHarness();
  const report = publishDeliveryReport();
  report.pendingPublication.attachmentCount = 2;
  findCommand(harness, "inspect-publish-delivery").checkCallback(false);
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
    "content:publish:status",
  ]);
  harness.spawned[1].child.stdout.emit(
    "data",
    Buffer.from("[publish-delivery] 本地 main 有 1 个待同步发布包。"),
  );
  harness.spawned[1].child.emit("close", 1);
  assert.equal(harness.modals.length, 1);
  assert.match(
    elementsByTag(harness.modals[0], "pre")[0].text,
    /待同步发布包/u,
  );
});

test("routes one exact publication through a read-only delivery switchyard", async () => {
  const [styles, harness] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    createPluginHarness(),
  ]);
  const command = findCommand(harness, "inspect-delivery-triage");
  assert.equal(command.checkCallback(true), true);
  command.checkCallback(false);
  assert.deepEqual(plain(harness.spawned[0].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:delivery:status",
    "--",
    "--format",
    "json",
  ]);
  const report = deliveryTriageReport();
  harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(report)));
  harness.spawned[0].child.emit("close", 1);

  assert.equal(harness.modals.length, 1);
  const modal = harness.modals[0];
  assert.equal(modal.contentEl.classes.has("myblog-delivery-triage"), true);
  assert.equal(elementsByTag(modal, "button").length, 0);
  const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
  assert.match(text, /DELIVERY TRIAGE \/ READ ONLY/u);
  assert.match(text, /DELIVERY SWITCHYARD \/ PUBLICATION ROUTE/u);
  assert.match(text, /OBSERVED LOCAL MAIN/u);
  assert.match(
    text,
    /REVIEW \/ STANDBY.*PUBLICATION \/ MATCHED.*INSPECT \/ STANDBY/su,
  );
  assert.match(text, /content\/posts\/new-delivery\.md/u);
  assert.ok(text.includes(report.route.statusCommand));
  assert.ok(text.includes(report.route.deliverCommand));
  assert.match(text, /只读分诊不会执行 status 或 deliver 命令/u);
  assert.match(styles, /myblog-delivery-triage__switchyard/u);
  assert.match(styles, /myblog-delivery-triage__branch/u);
  assert.equal(harness.spawned.length, 1);

  const mobile = await createPluginHarness({ desktop: false });
  assert.equal(
    findCommand(mobile, "inspect-delivery-triage").checkCallback(true),
    false,
  );
});

test("renders a local-only author preflight circuit without repairing it", async () => {
  const [styles, harness] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    createPluginHarness(),
  ]);
  const command = findCommand(harness, "inspect-author-environment");
  assert.equal(command.checkCallback(true), true);
  command.checkCallback(false);
  assert.deepEqual(plain(harness.spawned[0].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:author:doctor",
    "--",
    "--format",
    "json",
  ]);
  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(authorDoctorReport())),
  );
  harness.spawned[0].child.emit("close", 0);

  assert.equal(harness.modals.length, 1);
  const modal = harness.modals[0];
  assert.equal(modal.contentEl.classes.has("myblog-author-doctor"), true);
  assert.equal(elementsByTag(modal, "button").length, 0);
  const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
  assert.match(text, /AUTHOR PREFLIGHT \/ LOCAL ONLY/u);
  assert.match(text, /PREFLIGHT CIRCUIT \/ AUTHOR READY/u);
  assert.match(
    text,
    /RUNTIME \/ PASS.*GIT \/ PASS.*WORKSPACE \/ PASS.*VAULT \/ PASS/su,
  );
  assert.match(text, /13 PASS \/ 0 ATTENTION/u);
  assert.match(text, /Node\.js runtime/u);
  assert.match(text, /MyBlog Publisher/u);
  assert.match(text, /不会安装依赖、修改配置、读取凭据或访问网络/u);
  assert.match(styles, /myblog-author-doctor__circuit/u);
  assert.match(styles, /myblog-author-doctor__station/u);
  assert.equal(harness.spawned.length, 1);

  const mobile = await createPluginHarness({ desktop: false });
  assert.equal(
    findCommand(mobile, "inspect-author-environment").checkCallback(true),
    false,
  );
});

test("falls back to pure text when author preflight evidence is inconsistent", async () => {
  const harness = await createPluginHarness();
  const report = authorDoctorReport();
  report.summary.passed = 12;
  findCommand(harness, "inspect-author-environment").checkCallback(false);
  harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(report)));
  harness.spawned[0].child.emit("close", 0);
  assert.equal(harness.spawned.length, 2);
  assert.deepEqual(plain(harness.spawned[1].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:author:doctor",
  ]);
  harness.spawned[1].child.stdout.emit(
    "data",
    Buffer.from("[author-doctor] HOLD · 1 prerequisite needs attention."),
  );
  harness.spawned[1].child.emit("close", 1);
  assert.equal(harness.modals.length, 1);
  assert.match(elementsByTag(harness.modals[0], "pre")[0].text, /HOLD/u);
});

test("gates every new publish and review transaction with one ready author preflight", async () => {
  const cases = [
    {
      commandId: "validate-current-note",
      domainArgs: [
        "run",
        "content:publish",
        "--",
        "content/inbox/new-note.md",
        "--check-only",
      ],
      path: "content/inbox/new-note.md",
    },
    {
      commandId: "publish-current-note",
      domainArgs: [
        "run",
        "content:publish",
        "--",
        "content/inbox/new-note.md",
        "--push",
      ],
      path: "content/inbox/new-note.md",
    },
    {
      commandId: "validate-current-published-note",
      domainArgs: [
        "run",
        "content:review",
        "--",
        "content/projects/myblog.md",
        "--check-only",
        "--format",
        "json",
      ],
      path: "content/projects/myblog.md",
    },
    {
      commandId: "review-current-published-note",
      domainArgs: [
        "run",
        "content:review",
        "--",
        "content/projects/myblog.md",
        "--push",
      ],
      path: "content/projects/myblog.md",
    },
  ];

  for (const { commandId, domainArgs, path } of cases) {
    const harness = await createPluginHarness({ activeFilePath: path });
    findCommand(harness, commandId).checkCallback(false);
    assert.equal(harness.spawned.length, 1, commandId);
    finishReadyAuthorPreflight(harness, 0);
    assert.equal(harness.spawned.length, 2, commandId);
    assert.deepEqual(plain(harness.spawned[1].args), [
      "/d",
      "/s",
      "/c",
      "npm",
      ...domainArgs,
    ]);
    assert.equal(harness.modals.length, 0, commandId);
  }
});

test("holds every new publish and review transaction on author attention", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /\.myblog-author-doctor__interlock/u);
  const cases = [
    ["validate-current-note", "content/inbox/new-note.md", "检查当前草稿"],
    ["publish-current-note", "content/inbox/new-note.md", "发布当前草稿并同步 GitHub"],
    [
      "validate-current-published-note",
      "content/projects/myblog.md",
      "检查当前正式内容复核",
    ],
    [
      "review-current-published-note",
      "content/projects/myblog.md",
      "提交并同步当前正式内容复核",
    ],
  ];

  for (const [commandId, path, operation] of cases) {
    const harness = await createPluginHarness({ activeFilePath: path });
    findCommand(harness, commandId).checkCallback(false);
    assert.deepEqual(plain(harness.spawned[0].args), authorDoctorCommandArgs);
    harness.spawned[0].child.stdout.emit(
      "data",
      Buffer.from(JSON.stringify(authorDoctorAttentionReport())),
    );
    harness.spawned[0].child.emit("close", 1);

    assert.equal(harness.spawned.length, 1, commandId);
    assert.equal(harness.modals.length, 1, commandId);
    const modal = harness.modals[0];
    const text = allElements(modal.contentEl)
      .map((element) => element.text)
      .join(" ");
    assert.equal(modal.contentEl.classes.has("myblog-author-doctor"), true);
    assert.equal(elementsByTag(modal, "button").length, 0);
    assert.match(text, /TRANSACTION INTERLOCK \/ HELD/u);
    assert.ok(text.includes(operation));
    assert.ok(text.includes(path));
    assert.match(text, /AUTHOR HOLD/u);
  }
});

test("fails closed to author text evidence when an interlock report is untrusted", async () => {
  const harness = await createPluginHarness({
    activeFilePath: "content/inbox/new-note.md",
  });
  findCommand(harness, "publish-current-note").checkCallback(false);
  harness.spawned[0].child.stdout.emit("data", Buffer.from("not-json"));
  harness.spawned[0].child.emit("close", 0);

  assert.equal(harness.spawned.length, 2);
  assert.deepEqual(plain(harness.spawned[1].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:author:doctor",
  ]);
  harness.spawned[1].child.stdout.emit(
    "data",
    Buffer.from("[author-doctor] HOLD · evidence unavailable."),
  );
  harness.spawned[1].child.emit("close", 1);
  assert.equal(harness.spawned.length, 2);
  assert.equal(harness.modals.length, 1);
  assert.match(
    allElements(harness.modals[0].contentEl)
      .map((element) => element.text)
      .join(" "),
    /发布当前草稿并同步 GitHub.*未启动/su,
  );
});

test("does not start an author transaction when its preflight command fails", async () => {
  const harness = await createPluginHarness({
    activeFilePath: "content/inbox/new-note.md",
  });
  findCommand(harness, "validate-current-note").checkCallback(false);
  harness.spawned[0].child.stderr.emit(
    "data",
    Buffer.from("[author-doctor] unable to inspect local runtime"),
  );
  harness.spawned[0].child.emit("close", 2);

  assert.equal(harness.spawned.length, 1);
  assert.equal(harness.modals.length, 0);
  assert.match(
    harness.notices.at(-1).message,
    /检查当前草稿的本机前置检查未完成；原操作未启动.*unable to inspect/su,
  );
});

test("reports idle and active author transaction snapshots without spawning", async () => {
  const sourcePath = "content/inbox/new-note.md";
  const harness = await createPluginHarness({ activeFilePath: sourcePath });
  const inspect = findCommand(harness, "inspect-author-transaction");

  assert.equal(inspect.checkCallback(true), true);
  assert.equal(inspect.checkCallback(false), true);
  assert.equal(harness.spawned.length, 0);
  assert.equal(harness.plugin.lastAuthorTransactionReceipt, null);
  assert.match(
    harness.notices.at(-1).message,
    /AUTHOR TRANSACTION \/ IDLE.*当前没有运行中的作者事务/su,
  );

  const startedAt = Date.parse("2026-08-06T00:00:00.000Z");
  let now = startedAt;
  harness.plugin.getAuthorTransactionNow = () => now;
  findCommand(harness, "validate-current-note").checkCallback(false);

  const lease = harness.plugin.authorTransactionLease;
  assert.equal(lease.startedAt, startedAt);
  assert.equal(lease.phase, "preflight");
  assert.equal(lease.phaseEnteredAt, startedAt);
  assert.equal(lease.lastOutputAt, null);
  const initialSnapshot = harness.plugin.getAuthorTransactionSnapshot();
  assert.equal(Object.isFrozen(initialSnapshot), true);
  assert.deepEqual(plain(initialSnapshot), {
    elapsedMs: 0,
    label: "检查当前草稿",
    lastOutputAt: null,
    phase: "preflight",
    phaseElapsedMs: 0,
    phaseEnteredAt: startedAt,
    silentMs: 0,
    sourcePath,
    startedAt,
  });
  assert.equal(
    harness.plugin.formatAuthorTransactionElapsed(3_661_000),
    "1 小时 01 分 01 秒",
  );

  now = startedAt - 1_000;
  assert.deepEqual(
    plain(harness.plugin.getAuthorTransactionSnapshot()),
    { ...plain(initialSnapshot) },
  );

  now = startedAt + 65_000;
  assert.equal(inspect.checkCallback(false), true);
  assert.equal(harness.spawned.length, 1);
  assert.match(
    harness.notices.at(-1).message,
    /AUTHOR TRANSACTION \/ ACTIVE.*操作：检查当前草稿.*来源：content\/inbox\/new-note\.md.*阶段：前置检查 · PREFLIGHT.*阶段进入：2026-08-06T00:00:00\.000Z · 已 1 分 05 秒.*最近输出：本阶段尚无输出 · 静默 1 分 05 秒.*开始：2026-08-06T00:00:00\.000Z · 总计 1 分 05 秒.*只读快照/su,
  );
  assert.doesNotMatch(
    harness.notices.at(-1).message,
    /(?:healthy|stuck|卡住|故障|超时)/iu,
  );

  const mobile = await createPluginHarness({ desktop: false });
  assert.equal(
    findCommand(mobile, "inspect-author-transaction").checkCallback(true),
    false,
  );
});

test("tracks one owner-checked activity pulse across every author phase", async () => {
  const sourcePath = "content/projects/myblog.md";
  const harness = await createPluginHarness({ activeFilePath: sourcePath });
  const transaction = findCommand(harness, "validate-current-published-note");
  const inspect = findCommand(harness, "inspect-author-transaction");
  const startedAt = Date.parse("2026-08-06T01:02:03.000Z");
  let now = startedAt;
  harness.plugin.getAuthorTransactionNow = () => now;

  transaction.checkCallback(false);
  const lease = harness.plugin.authorTransactionLease;
  now += 2_000;
  harness.spawned[0].child.stdout.emit("data", Buffer.from(" \n"));
  assert.equal(lease.lastOutputAt, now);
  now = startedAt + 5_000;
  transaction.checkCallback(false);
  assert.equal(harness.spawned.length, 1);
  assert.match(
    harness.notices.at(-1).message,
    /AUTHOR TRANSACTION \/ BUSY.*检查当前正式内容复核.*阶段：前置检查 · PREFLIGHT.*阶段进入：2026-08-06T01:02:03\.000Z · 已 5 秒.*最近输出：2026-08-06T01:02:05\.000Z · 静默 3 秒.*开始：2026-08-06T01:02:03\.000Z · 总计 5 秒.*当前操作完成后再试/su,
  );

  now = startedAt + 10_000;
  finishReadyAuthorPreflight(harness, 0);
  assert.equal(lease.phase, "domain");
  assert.equal(lease.phaseEnteredAt, now);
  assert.equal(lease.lastOutputAt, null);
  const preflightChild = harness.spawned[0].child;
  now = startedAt + 11_000;
  preflightChild.stderr.emit("data", Buffer.from("late preflight output"));
  assert.equal(lease.lastOutputAt, null);

  now = startedAt + 12_000;
  harness.spawned[1].child.stdout.emit(
    "data",
    Buffer.alloc(200_001, "x"),
  );
  now = startedAt + 13_000;
  harness.spawned[1].child.stderr.emit("data", Buffer.from("after truncation"));
  assert.equal(lease.lastOutputAt, now);
  now = startedAt + 15_000;
  transaction.checkCallback(false);
  assert.equal(harness.spawned.length, 2);
  assert.match(
    harness.notices.at(-1).message,
    /AUTHOR TRANSACTION \/ BUSY.*阶段：发布或复核 · DOMAIN.*阶段进入：2026-08-06T01:02:13\.000Z · 已 5 秒.*最近输出：2026-08-06T01:02:16\.000Z · 静默 2 秒.*开始：2026-08-06T01:02:03\.000Z · 总计 15 秒/su,
  );
  inspect.checkCallback(false);
  assert.match(
    harness.notices.at(-1).message,
    /AUTHOR TRANSACTION \/ ACTIVE.*阶段：发布或复核 · DOMAIN.*阶段进入：2026-08-06T01:02:13\.000Z · 已 5 秒.*最近输出：2026-08-06T01:02:16\.000Z · 静默 2 秒.*开始：2026-08-06T01:02:03\.000Z · 总计 15 秒/su,
  );

  const domainChild = harness.spawned[1].child;
  now = startedAt + 20_000;
  harness.spawned[1].child.emit("close", 0);
  assert.equal(harness.spawned.length, 3);
  assert.equal(lease.phase, "diagnostic");
  assert.equal(lease.phaseEnteredAt, now);
  assert.equal(lease.lastOutputAt, null);
  now = startedAt + 21_000;
  domainChild.stdout.emit("data", Buffer.from("late domain output"));
  assert.equal(lease.lastOutputAt, null);
  now = startedAt + 22_000;
  harness.spawned[2].child.stderr.emit("data", Buffer.from("diagnostic pulse"));
  assert.equal(lease.lastOutputAt, now);
  now = startedAt + 25_000;
  transaction.checkCallback(false);
  assert.equal(harness.spawned.length, 3);
  assert.match(
    harness.notices.at(-1).message,
    /AUTHOR TRANSACTION \/ BUSY.*阶段：证据降级 · DIAGNOSTIC.*阶段进入：2026-08-06T01:02:23\.000Z · 已 5 秒.*最近输出：2026-08-06T01:02:25\.000Z · 静默 3 秒.*开始：2026-08-06T01:02:03\.000Z · 总计 25 秒/su,
  );
  inspect.checkCallback(false);
  assert.match(
    harness.notices.at(-1).message,
    /AUTHOR TRANSACTION \/ ACTIVE.*阶段：证据降级 · DIAGNOSTIC.*阶段进入：2026-08-06T01:02:23\.000Z · 已 5 秒.*最近输出：2026-08-06T01:02:25\.000Z · 静默 3 秒.*开始：2026-08-06T01:02:03\.000Z · 总计 25 秒/su,
  );

  harness.spawned[2].child.emit("close", 0);
  assert.equal(harness.plugin.authorTransactionLease, null);
  assert.equal(Object.isFrozen(harness.plugin.lastAuthorTransactionReceipt), true);
  assert.deepEqual(plain(harness.plugin.lastAuthorTransactionReceipt), {
    elapsedMs: 25_000,
    endedAt: startedAt + 25_000,
    label: "检查当前正式内容复核",
    outcome: "completed",
    phase: "diagnostic",
    sourcePath,
    startedAt,
  });
  const spawnCount = harness.spawned.length;
  inspect.checkCallback(false);
  assert.equal(harness.spawned.length, spawnCount);
  assert.match(
    harness.notices.at(-1).message,
    /AUTHOR TRANSACTION \/ IDLE · LAST RECEIPT.*结果：已完成 · COMPLETED.*操作：检查当前正式内容复核.*来源：content\/projects\/myblog\.md.*最终阶段：证据降级 · DIAGNOSTIC.*开始：2026-08-06T01:02:03\.000Z.*结束：2026-08-06T01:02:28\.000Z.*总计：25 秒.*重新加载插件后清除.*不会重试、恢复或推送/su,
  );
});

test("holds one author transaction lease through preflight and domain settlement", async () => {
  const sourcePath = "content/inbox/new-note.md";
  const harness = await createPluginHarness({ activeFilePath: sourcePath });
  const command = findCommand(harness, "validate-current-note");

  command.checkCallback(false);
  const lease = harness.plugin.authorTransactionLease;
  assert.ok(lease);
  assert.equal(lease.transaction.label, "检查当前草稿");
  assert.equal(lease.transaction.sourcePath, sourcePath);
  assert.equal(lease.child, harness.spawned[0].child);

  command.checkCallback(false);
  assert.equal(harness.spawned.length, 1);
  assert.match(
    harness.notices.at(-1).message,
    /AUTHOR TRANSACTION \/ BUSY.*检查当前草稿.*content\/inbox\/new-note\.md.*完成后再试/su,
  );

  finishReadyAuthorPreflight(harness, 0);
  assert.equal(harness.spawned.length, 2);
  assert.equal(harness.plugin.authorTransactionLease, lease);
  assert.equal(lease.phase, "domain");
  assert.equal(lease.child, harness.spawned[1].child);

  command.checkCallback(false);
  assert.equal(harness.spawned.length, 2);
  harness.spawned[1].child.emit("close", 0);
  assert.equal(harness.plugin.authorTransactionLease, null);
  assert.equal(harness.plugin.lastAuthorTransactionReceipt.outcome, "completed");
  assert.equal(harness.plugin.lastAuthorTransactionReceipt.phase, "domain");
  const firstReceipt = harness.plugin.lastAuthorTransactionReceipt;

  command.checkCallback(false);
  assert.equal(harness.spawned.length, 3);
  assert.notEqual(harness.plugin.authorTransactionLease, lease);
  assert.equal(harness.plugin.lastAuthorTransactionReceipt, firstReceipt);
  findCommand(harness, "inspect-author-transaction").checkCallback(false);
  assert.match(harness.notices.at(-1).message, /AUTHOR TRANSACTION \/ ACTIVE/su);
  assert.doesNotMatch(harness.notices.at(-1).message, /LAST RECEIPT/su);

  finishReadyAuthorPreflight(harness, 2);
  harness.spawned[3].child.emit("close", 0);
  assert.notEqual(harness.plugin.lastAuthorTransactionReceipt, firstReceipt);
  assert.equal(harness.plugin.lastAuthorTransactionReceipt.outcome, "completed");
});

test("keeps the author lease across diagnostic fallback and releases every terminal preflight", async (t) => {
  await t.test("attention", async () => {
    const harness = await createPluginHarness({
      activeFilePath: "content/inbox/new-note.md",
    });
    const command = findCommand(harness, "validate-current-note");
    command.checkCallback(false);
    harness.spawned[0].child.stdout.emit(
      "data",
      Buffer.from(JSON.stringify(authorDoctorAttentionReport())),
    );
    harness.spawned[0].child.emit("close", 1);
    assert.equal(harness.plugin.authorTransactionLease, null);
    assert.equal(harness.plugin.lastAuthorTransactionReceipt.outcome, "held");
    assert.equal(harness.plugin.lastAuthorTransactionReceipt.phase, "preflight");
    command.checkCallback(false);
    assert.equal(harness.spawned.length, 2);
  });

  await t.test("untrusted structured evidence", async () => {
    const harness = await createPluginHarness({
      activeFilePath: "content/inbox/new-note.md",
    });
    const command = findCommand(harness, "validate-current-note");
    command.checkCallback(false);
    const lease = harness.plugin.authorTransactionLease;
    harness.spawned[0].child.stdout.emit("data", Buffer.from("not-json"));
    harness.spawned[0].child.emit("close", 0);
    assert.equal(harness.spawned.length, 2);
    assert.equal(harness.plugin.authorTransactionLease, lease);
    assert.equal(lease.phase, "diagnostic");
    assert.equal(lease.child, harness.spawned[1].child);
    command.checkCallback(false);
    assert.equal(harness.spawned.length, 2);
    harness.spawned[1].child.stdout.emit(
      "data",
      Buffer.from("[author-doctor] HOLD · evidence unavailable."),
    );
    harness.spawned[1].child.emit("close", 1);
    assert.equal(harness.plugin.authorTransactionLease, null);
    assert.equal(harness.plugin.lastAuthorTransactionReceipt.outcome, "held");
    assert.equal(harness.plugin.lastAuthorTransactionReceipt.phase, "diagnostic");
  });

  await t.test("fatal exit", async () => {
    const harness = await createPluginHarness({
      activeFilePath: "content/inbox/new-note.md",
    });
    const command = findCommand(harness, "validate-current-note");
    command.checkCallback(false);
    harness.spawned[0].child.emit("close", 2);
    assert.equal(harness.plugin.authorTransactionLease, null);
    assert.equal(
      harness.plugin.lastAuthorTransactionReceipt.outcome,
      "command-failed",
    );
    command.checkCallback(false);
    assert.equal(harness.spawned.length, 2);
  });

  await t.test("synchronous spawn failure", async () => {
    const harness = await createPluginHarness({
      activeFilePath: "content/inbox/new-note.md",
      throwSpawnAt: [0],
    });
    const command = findCommand(harness, "validate-current-note");
    command.checkCallback(false);
    assert.equal(harness.spawned.length, 0);
    assert.equal(harness.plugin.authorTransactionLease, null);
    assert.equal(
      harness.plugin.lastAuthorTransactionReceipt.outcome,
      "start-failed",
    );
    command.checkCallback(false);
    assert.equal(harness.spawned.length, 1);
  });

  await t.test("result handler failure", async () => {
    const harness = await createPluginHarness({
      activeFilePath: "content/inbox/new-note.md",
    });
    harness.plugin.continueAuthorTransaction = () => {
      throw new Error("result unavailable");
    };
    const command = findCommand(harness, "validate-current-note");
    command.checkCallback(false);
    harness.spawned[0].child.emit("close", 0);
    assert.equal(harness.plugin.authorTransactionLease, null);
    assert.equal(
      harness.plugin.lastAuthorTransactionReceipt.outcome,
      "result-failed",
    );
    assert.equal(harness.plugin.lastAuthorTransactionReceipt.phase, "preflight");
  });
});

test("releases the author lease on domain failure, process error, and plugin unload", async (t) => {
  for (const event of ["close", "error"]) {
    await t.test(`domain ${event}`, async () => {
      const harness = await createPluginHarness({
        activeFilePath: "content/inbox/new-note.md",
      });
      const command = findCommand(harness, "validate-current-note");
      command.checkCallback(false);
      finishReadyAuthorPreflight(harness, 0);
      const firstLease = harness.plugin.authorTransactionLease;
      if (event === "close") {
        harness.spawned[1].child.emit("close", 1);
      } else {
        harness.spawned[1].child.emit("error", new Error("domain unavailable"));
      }
      assert.equal(harness.plugin.authorTransactionLease, null);
      assert.equal(
        harness.plugin.lastAuthorTransactionReceipt.outcome,
        event === "close" ? "command-failed" : "start-failed",
      );
      const terminalReceipt = harness.plugin.lastAuthorTransactionReceipt;
      command.checkCallback(false);
      assert.equal(harness.spawned.length, 3);
      const nextLease = harness.plugin.authorTransactionLease;
      assert.equal(
        harness.plugin.setAuthorTransactionPhase(firstLease, "diagnostic"),
        false,
      );
      assert.equal(
        harness.plugin.recordAuthorTransactionReceipt(firstLease, "completed"),
        null,
      );
      assert.equal(nextLease.phase, "preflight");
      harness.spawned[1].child.emit("close", 0);
      assert.equal(harness.plugin.authorTransactionLease, nextLease);
      assert.equal(harness.plugin.lastAuthorTransactionReceipt, terminalReceipt);
    });
  }

  await t.test("plugin unload", async () => {
    const harness = await createPluginHarness({
      activeFilePath: "content/inbox/new-note.md",
    });
    findCommand(harness, "validate-current-note").checkCallback(false);
    assert.ok(harness.plugin.authorTransactionLease);
    harness.plugin.onunload();
    assert.equal(harness.plugin.authorTransactionLease, null);
    assert.equal(harness.plugin.activeRuns.size, 0);
    assert.equal(harness.plugin.lastAuthorTransactionReceipt.outcome, "unloaded");
    const unloadReceipt = harness.plugin.lastAuthorTransactionReceipt;
    const spawnCount = harness.spawned.length;
    harness.spawned[0].child.stdout.emit(
      "data",
      Buffer.from(JSON.stringify(authorDoctorReport())),
    );
    harness.spawned[0].child.emit("close", 0);
    assert.equal(harness.spawned.length, spawnCount);
    assert.equal(harness.plugin.lastAuthorTransactionReceipt, unloadReceipt);
  });
});

test("keeps the author lease through a review proof text fallback", async () => {
  const sourcePath = "content/projects/myblog.md";
  const harness = await createPluginHarness({ activeFilePath: sourcePath });
  const command = findCommand(harness, "validate-current-published-note");
  command.checkCallback(false);
  const lease = harness.plugin.authorTransactionLease;
  finishReadyAuthorPreflight(harness, 0);

  harness.spawned[1].child.stdout.emit("data", Buffer.from("not-json"));
  harness.spawned[1].child.emit("close", 0);
  assert.equal(harness.spawned.length, 3);
  assert.equal(harness.plugin.authorTransactionLease, lease);
  assert.equal(lease.child, harness.spawned[2].child);

  command.checkCallback(false);
  assert.equal(harness.spawned.length, 3);
  harness.spawned[2].child.stdout.emit(
    "data",
    Buffer.from("[review] 正式内容复核检查通过；未暂存、未提交、未推送。"),
  );
  harness.spawned[2].child.emit("close", 0);
  assert.equal(harness.plugin.authorTransactionLease, null);
  assert.equal(harness.plugin.lastAuthorTransactionReceipt.outcome, "completed");
  assert.equal(harness.plugin.lastAuthorTransactionReceipt.phase, "diagnostic");

  command.checkCallback(false);
  assert.equal(harness.spawned.length, 4);
});

test("keeps diagnosis and delivery recovery outside the author transaction lease", async () => {
  const harness = await createPluginHarness({
    activeFilePath: "content/inbox/new-note.md",
  });
  findCommand(harness, "validate-current-note").checkCallback(false);
  const lease = harness.plugin.authorTransactionLease;
  const bypassCommands = [
    "inspect-inbox-readiness",
    "inspect-published-maintenance",
    "inspect-author-environment",
    "inspect-delivery-triage",
    "inspect-review-delivery",
    "inspect-publish-delivery",
    "deliver-pending-review",
    "deliver-pending-publication",
  ];

  for (const commandId of bypassCommands) {
    assert.equal(findCommand(harness, commandId).checkCallback(false), true);
  }
  assert.equal(harness.spawned.length, 1 + bypassCommands.length);
  assert.equal(harness.plugin.authorTransactionLease, lease);
  assert.equal(lease.child, harness.spawned[0].child);
});

test("falls back without executing a route when triage evidence is inconsistent", async () => {
  const harness = await createPluginHarness();
  const report = deliveryTriageReport();
  report.route.deliverCommand =
    "npm run content:review:deliver -- --format json";
  findCommand(harness, "inspect-delivery-triage").checkCallback(false);
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
    "content:delivery:status",
  ]);
  harness.spawned[1].child.stdout.emit(
    "data",
    Buffer.from("[delivery-triage] 当前提交需要人工检查 Git 状态。"),
  );
  harness.spawned[1].child.emit("close", 1);
  assert.equal(harness.modals.length, 1);
  assert.match(
    elementsByTag(harness.modals[0], "pre")[0].text,
    /人工检查 Git 状态/u,
  );
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

test("delivers an exact pending publication and renders a sealed envelope receipt", async () => {
  const harness = await createPluginHarness();
  const command = findCommand(harness, "deliver-pending-publication");
  assert.equal(command.checkCallback(true), true);
  command.checkCallback(false);
  assert.deepEqual(plain(harness.spawned[0].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:publish:deliver",
    "--",
    "--format",
    "json",
  ]);
  const receipt = publishDeliveryReceipt();
  harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(receipt)));
  harness.spawned[0].child.emit("close", 0);

  assert.equal(harness.reconciliations, 1);
  assert.equal(harness.modals.length, 1);
  const modal = harness.modals[0];
  assert.equal(
    modal.contentEl.classes.has("myblog-publish-delivery-receipt"),
    true,
  );
  assert.equal(elementsByTag(modal, "button").length, 0);
  const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
  assert.match(text, /PUBLICATION RECEIPT \/ SEALED ENVELOPE/u);
  assert.match(
    text,
    /VERIFIED COMMIT ENVELOPE.*SEALED PUSH.*ORIGIN\/MAIN/su,
  );
  assert.match(text, /DELIVERED ENVELOPE \/ 3 PATHS/u);
  assert.match(text, /NOTE \/ ADDED.*content\/posts\/new-delivery\.md/su);
  assert.match(
    text,
    /MEDIA 01 \/ ADDED.*public\/uploads\/new-delivery\/evidence\.webp/su,
  );
  assert.match(text, /INBOX \/ DELETED.*content\/inbox\/new-delivery\.md/su);
  assert.match(
    text,
    /HEAD STABLE.*INDEX STABLE.*WORKTREE STABLE.*MANIFEST STABLE/su,
  );
  assert.ok(text.includes(receipt.transition.command));

  const mobile = await createPluginHarness({ desktop: false });
  assert.equal(
    findCommand(mobile, "deliver-pending-publication").checkCallback(true),
    false,
  );
});

test("does not retry or reconcile an untrusted publication receipt", async () => {
  const harness = await createPluginHarness();
  const receipt = publishDeliveryReceipt();
  receipt.safety.manifestStable = false;
  findCommand(harness, "deliver-pending-publication").checkCallback(false);
  harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(receipt)));
  harness.spawned[0].child.emit("close", 0);
  assert.equal(harness.spawned.length, 1);
  assert.equal(harness.modals.length, 0);
  assert.equal(harness.reconciliations, 0);
  assert.ok(
    harness.notices.some((notice) =>
      /重新同步未能生成可信发布回执.*查看待同步新内容发布/u.test(notice.message),
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
  assert.equal(harness.spawned.length, 1);
  finishReadyAuthorPreflight(harness, 0);
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
  harness.spawned[1].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(proof)),
  );
  harness.spawned[1].child.emit("close", 0);
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
  assert.equal(harness.spawned.length, 3);
  finishReadyAuthorPreflight(harness, 2);
  assert.deepEqual(plain(harness.spawned[3].args), [
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
  harness.spawned[3].child.emit("close", 0);
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
      finishReadyAuthorPreflight(harness, 0);
      harness.spawned[1].child.stdout.emit("data", Buffer.from(output));
      harness.spawned[1].child.emit("close", 0);
      assert.equal(harness.spawned.length, 3);
      assert.deepEqual(plain(harness.spawned[2].args), [
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
      harness.spawned[2].child.stdout.emit(
        "data",
        Buffer.from("[review] 正式内容复核检查通过；未暂存、未提交、未推送。"),
      );
      harness.spawned[2].child.emit("close", 0);
      assert.equal(harness.modals.length, 1);
      assert.match(
        elementsByTag(harness.modals[0], "pre")[0].text,
        /未暂存、未提交、未推送/u,
      );
    });
  }
});
