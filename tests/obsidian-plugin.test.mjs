import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { parse as parseYamlSource } from "yaml";

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
const templateUrls = {
  article: new URL("../templates/obsidian/article.md", import.meta.url),
  project: new URL("../templates/obsidian/project.md", import.meta.url),
  til: new URL("../templates/obsidian/til.md", import.meta.url),
};

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
    disabled: false,
    focused: false,
    style: {},
    tag,
    text: options.text ?? "",
    value: options.value ?? "",
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
    focus() {
      this.focused = true;
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
  createFailure,
  deferredVaultReadNumbers = [],
  desktop = true,
  editorLineCount,
  fileContents = {},
  files = ["content/projects/myblog.md"],
  markdownViewAvailable = true,
  openFailure,
  platform = "win32",
  processFailure,
  processMutation,
  processPostcondition = "exact",
  readActiveFilePath,
  readActiveFilePathAt = 1,
  renameFailure,
  renamePostcondition = "exact",
  throwSpawnAt = [],
} = {}) {
  const source = await readFile(pluginUrl, "utf8");
  const commands = [];
  const modals = [];
  const notices = [];
  const openedFiles = [];
  const openedStates = [];
  const cursorPositions = [];
  const scrollRanges = [];
  let editorFocusCount = 0;
  const processAttempts = [];
  const createdFiles = [];
  const renameAttempts = [];
  const templateReads = [];
  const vaultReads = [];
  const deferredVaultReads = new Map();
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

  class TFile {
    constructor(path) {
      this.setPath(path);
    }

    setPath(path) {
      this.path = path;
      this.name = path.split("/").at(-1) ?? path;
      this.extension = this.name.includes(".") ? this.name.split(".").at(-1) : "";
      this.basename = this.extension
        ? this.name.slice(0, -(this.extension.length + 1))
        : this.name;
    }
  }

  class MarkdownView {
    constructor(file, editor) {
      this.editor = editor;
      this.file = file;
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

  const contentMap = new Map(Object.entries(fileContents));
  if (activeFilePath && !contentMap.has(activeFilePath)) {
    contentMap.set(activeFilePath, filenameOwnedDraft());
  }
  let activePath = activeFilePath;
  let activeFileOverride = null;
  let activeView = null;
  const fileMap = new Map(
    [...new Set([
      ...files,
      ...contentMap.keys(),
      ...(activeFilePath ? [activeFilePath] : []),
    ])].map((path) => [
      path,
      new TFile(path),
    ]),
  );
  const adapter = desktop ? new FileSystemAdapter() : {};
  const editor = {
    focus() {
      editorFocusCount += 1;
    },
    lineCount() {
      if (Number.isInteger(editorLineCount)) return editorLineCount;
      const content = activePath ? contentMap.get(activePath) : undefined;
      return typeof content === "string" ? content.split(/\r\n|\r|\n/u).length : 0;
    },
    scrollIntoView(range, center) {
      scrollRanges.push({ center, range });
    },
    setCursor(position) {
      cursorPositions.push(position);
    },
  };
  const leaf = {
    view: null,
    async openFile(file, openState) {
      if (openFailure) throw new Error(openFailure);
      openedFiles.push(file);
      openedStates.push(openState ?? null);
      activePath = file.path;
      activeFileOverride = null;
      activeView = markdownViewAvailable ? new MarkdownView(file, editor) : {};
      this.view = activeView;
    },
  };
  const app = {
    vault: {
      adapter,
      async cachedRead(file) {
        templateReads.push(file.path);
        if (!contentMap.has(file.path)) {
          throw new Error(`Missing fixture content: ${file.path}`);
        }
        return contentMap.get(file.path);
      },
      async read(file) {
        vaultReads.push(file.path);
        if (!contentMap.has(file.path)) {
          throw new Error(`Missing fixture content: ${file.path}`);
        }
        const content = contentMap.get(file.path);
        if (readActiveFilePath && vaultReads.length === readActiveFilePathAt) {
          activePath = readActiveFilePath;
          activeFileOverride = null;
          activeView = null;
        }
        if (deferredVaultReadNumbers.includes(vaultReads.length)) {
          await new Promise((resolve, reject) => {
            deferredVaultReads.set(vaultReads.length, { reject, resolve });
          });
        }
        return content;
      },
      async process(file, callback) {
        if (!contentMap.has(file.path)) {
          throw new Error(`Missing fixture content: ${file.path}`);
        }
        if (typeof processMutation === "string") {
          contentMap.set(file.path, processMutation);
        }
        const current = contentMap.get(file.path);
        processAttempts.push({ file, input: current, path: file.path });
        const next = callback(current);
        if (processFailure) throw new Error(processFailure);
        if (processPostcondition === "exact") contentMap.set(file.path, next);
        return next;
      },
      async create(path, content) {
        if (createFailure) throw new Error(createFailure);
        if (fileMap.has(path)) throw new Error(`File already exists: ${path}`);
        const file = new TFile(path);
        fileMap.set(path, file);
        contentMap.set(path, content);
        createdFiles.push({ content, file, path });
        return file;
      },
      getAbstractFileByPath(path) {
        return fileMap.get(path) ?? null;
      },
    },
    fileManager: {
      async renameFile(file, newPath) {
        const sourcePath = file.path;
        renameAttempts.push({ file, newPath, sourcePath });
        if (renameFailure) throw new Error(renameFailure);
        if (renamePostcondition !== "exact") return;
        if (fileMap.get(sourcePath) !== file) {
          throw new Error(`Source file changed: ${sourcePath}`);
        }
        if (fileMap.has(newPath)) throw new Error(`File already exists: ${newPath}`);
        const content = contentMap.get(sourcePath);
        fileMap.delete(sourcePath);
        contentMap.delete(sourcePath);
        file.setPath(newPath);
        fileMap.set(newPath, file);
        if (content !== undefined) contentMap.set(newPath, content);
        if (activePath === sourcePath) activePath = newPath;
      },
    },
    workspace: {
      getActiveFile: () => activeFileOverride ?? (activePath ? fileMap.get(activePath) : undefined),
      getActiveViewOfType: (ViewType) => activeView instanceof ViewType ? activeView : null,
      getLeaf: () => leaf,
    },
  };
  const context = vm.createContext({
    module: { exports: {} },
    process: { env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" }, platform },
    require(specifier) {
      if (specifier === "obsidian") {
        return {
          FileSystemAdapter,
          getFrontMatterInfo(content) {
            const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(content);
            return match
              ? { exists: true, frontmatter: match[1] }
              : { exists: false, frontmatter: "" };
          },
          MarkdownView,
          Modal,
          Notice,
          parseYaml: parseYamlSource,
          Plugin,
          TFile,
        };
      }
      if (specifier === "node:child_process") return { spawn };
      if (specifier === "node:crypto") return { createHash };
      throw new Error(`Unexpected require: ${specifier}`);
    },
  });
  new vm.Script(source, { filename: pluginUrl.pathname }).runInContext(context);
  const PluginClass = context.module.exports;
  const plugin = new PluginClass(app);
  plugin.onload();

  return {
    commands,
    createdFiles,
    cursorPositions,
    get editorFocusCount() {
      return editorFocusCount;
    },
    getContent(path) {
      return contentMap.get(path);
    },
    getFile(path) {
      return fileMap.get(path) ?? null;
    },
    setActiveFilePath(path) {
      activePath = path;
      activeFileOverride = null;
      activeView = null;
    },
    setContent(path, content) {
      if (!fileMap.has(path)) throw new Error(`Missing fixture file: ${path}`);
      contentMap.set(path, content);
    },
    get reconciliations() {
      return reconciliations;
    },
    modals,
    notices,
    openedFiles,
    openedStates,
    plugin,
    processAttempts,
    renameAttempts,
    rejectVaultRead(readNumber, error = new Error(`Vault read ${readNumber} rejected`)) {
      const continuation = deferredVaultReads.get(readNumber);
      if (!continuation) {
        throw new Error(`Vault read ${readNumber} is not deferred`);
      }
      deferredVaultReads.delete(readNumber);
      continuation.reject(error);
    },
    resolveVaultRead(readNumber) {
      const continuation = deferredVaultReads.get(readNumber);
      if (!continuation) {
        throw new Error(`Vault read ${readNumber} is not deferred`);
      }
      deferredVaultReads.delete(readNumber);
      continuation.resolve();
    },
    replaceFile(path, { keepActiveFile = false } = {}) {
      const current = fileMap.get(path) ?? null;
      const replacement = new TFile(path);
      fileMap.set(path, replacement);
      if (keepActiveFile && activePath === path) activeFileOverride = current;
      return replacement;
    },
    scrollRanges,
    spawned,
    templateReads,
    vaultReads,
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

function inboxReadinessReport({
  entry = {},
  reportDate = "2026-08-06",
  safety = {},
  sourceContent = filenameOwnedDraft(),
  version = 6,
} = {}) {
  const sourcePath = "content/inbox/current-draft.md";
  const resolvedEntry = {
    attachments: [],
    contentType: "article",
    draftState: "draft",
    internalLinkCount: 2,
    internalLinks: [
      {
        kind: "post",
        occurrences: 2,
        sourceLines: [18, 22],
        target: "/posts/building-a-maintainable-blog#method",
      },
      {
        kind: "project",
        occurrences: 1,
        sourceLines: [19],
        target: "/projects/myblog",
      },
    ],
    issues: [],
    kind: "post",
    publishedAt: reportDate,
    slug: "current-draft",
    sourceSha256: sha256(sourceContent),
    sourcePath,
    state: "ready",
    targetPath: "content/posts/current-draft.md",
    ...entry,
  };
  return {
    version,
    mode: "read-only",
    counts: {
      attachments: resolvedEntry.attachments.length,
      blocked: resolvedEntry.state === "blocked" ? 1 : 0,
      drafts: 1,
      issues: resolvedEntry.issues.length,
      ready: resolvedEntry.state === "ready" ? 1 : 0,
      scheduled: resolvedEntry.state === "scheduled" ? 1 : 0,
    },
    entries: [resolvedEntry],
    reportDate,
    safety: {
      authorFilesChanged: false,
      commitCreated: false,
      networkChecked: false,
      pushExecuted: false,
      ...safety,
    },
  };
}

function inboxPreparedAttachment(slug = "current-draft") {
  return {
    publicUrl: `/uploads/${slug}/evidence.webp`,
    sourcePath: "public/uploads/evidence.png",
    targetPath: `public/uploads/${slug}/evidence.webp`,
    usages: [
      {
        altSources: ["authored"],
        altTexts: ["项目发布轨迹总览"],
        occurrences: 1,
        role: "cover",
        sourceLines: [12],
      },
      {
        altSources: ["authored", "authored", "authored"],
        altTexts: ["构建日志截图", "变换前后对照", "运行证据"],
        occurrences: 3,
        role: "body",
        sourceLines: [20, 20, 24],
      },
    ],
    preparation: {
      bytesSaved: 1024,
      optimized: true,
      output: {
        bytes: 2048,
        format: "webp",
        height: 630,
        pages: 1,
        sourcePath: `public/uploads/${slug}/evidence.webp`,
        width: 1200,
      },
      source: {
        bytes: 3072,
        format: "png",
        height: 630,
        pages: 1,
        sourcePath: "public/uploads/evidence.png",
        width: 1200,
      },
    },
  };
}

function inboxPreservedAttachment(slug = "current-draft") {
  return {
    publicUrl: `/uploads/${slug}/animation.gif`,
    sourcePath: "public/uploads/animation.gif",
    targetPath: `public/uploads/${slug}/animation.gif`,
    usages: [
      {
        altSources: ["authored"],
        altTexts: ["动画执行过程"],
        occurrences: 1,
        role: "body",
        sourceLines: [28],
      },
    ],
    preparation: {
      bytesSaved: 0,
      optimized: false,
      output: {
        bytes: 4096,
        format: "gif",
        height: 360,
        pages: 12,
        sourcePath: `public/uploads/${slug}/animation.gif`,
        width: 640,
      },
      source: {
        bytes: 4096,
        format: "gif",
        height: 360,
        pages: 12,
        sourcePath: "public/uploads/animation.gif",
        width: 640,
      },
    },
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
    ["publisher-plugin", "vault", "MyBlog Publisher", "myblog-publisher@1.33.0 · desktop", "myblog-publisher 1.33.0 desktop plugin"],
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
          version: "1.33.0",
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

async function readObsidianTemplates() {
  const entries = await Promise.all(
    Object.entries(templateUrls).map(async ([kind, url]) => [kind, await readFile(url, "utf8")]),
  );
  return Object.fromEntries(
    entries.map(([kind, content]) => [`templates/obsidian/${kind}.md`, content]),
  );
}

function filenameOwnedDraft({
  draft = true,
  slugLine = "",
  title = "可安全改名的草稿",
} = {}) {
  return `---
title: "${title}"
${slugLine}description: "验证 Obsidian 草稿以文件名作为唯一身份。"
type: article
publishedAt: 2026-08-06
updatedAt: 2026-08-06
freshness: historical
reviewedAt: 2026-08-06
tags: ["Personal Knowledge"]
draft: ${draft}
featured: false
---

## 正文

草稿内容保持不变。\n`;
}

function legacyIdentityDraft({
  draft = true,
  lineEnding = "\n",
  slugLine = "slug: original-draft",
} = {}) {
  return [
    "---",
    "# 保留这条 frontmatter 注释",
    'title: "旧草稿身份"',
    slugLine,
    `draft: ${draft}`,
    "featured: false",
    "---",
    "",
    "# 正文",
    "",
    "正文、字段顺序与换行必须保持不变。",
    "",
  ].join(lineEnding);
}

function markdownWithLineCount(lineCount) {
  return Array.from({ length: lineCount }, (_, index) => `line ${index + 1}`).join("\n");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function settleAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("creates and opens one inbox draft from the focused native wizard", async () => {
  const harness = await createPluginHarness({
    fileContents: await readObsidianTemplates(),
    files: [],
  });
  harness.plugin.getDraftCreationToday = () => "2026-08-06";
  const command = findCommand(harness, "create-blog-draft");
  assert.equal(command.checkCallback(true), true);
  assert.equal(command.checkCallback(false), true);
  assert.equal(harness.spawned.length, 0);
  assert.equal(harness.modals.length, 1);

  const modal = harness.modals[0];
  assert.equal(modal.contentEl.classes.has("myblog-draft-create"), true);
  assert.deepEqual(
    elementsByTag(modal, "h2").map((element) => element.text),
    ["新建博客草稿"],
  );
  assert.match(
    elementsByTag(modal, "p").map((element) => element.text).join(" "),
    /只创建一个本地 inbox Markdown.*不会发布、提交或联网/u,
  );

  const [kind] = elementsByTag(modal, "select");
  const [title, slug] = elementsByTag(modal, "input");
  const options = elementsByTag(modal, "option");
  assert.deepEqual(options.map((option) => option.value), ["article", "til", "project"]);
  assert.equal(title.attributes["aria-label"], "标题");
  assert.equal(slug.attributes["aria-label"], "英文 slug");
  assert.equal(title.focused, true);
  kind.value = "article";
  title.value = 'Quoted "Title" \\ path';
  slug.value = "safe-draft";

  const submit = elementsByTag(modal, "button").find(
    (button) => button.text === "创建草稿",
  );
  assert.ok(submit);
  await Promise.all([submit.trigger("click"), submit.trigger("click")]);

  assert.equal(harness.createdFiles.length, 1);
  assert.equal(harness.createdFiles[0].path, "content/inbox/safe-draft.md");
  assert.match(
    harness.createdFiles[0].content,
    /title: "Quoted \\"Title\\" \\\\ path"/u,
  );
  assert.doesNotMatch(harness.createdFiles[0].content, /^slug\s*:/mu);
  assert.equal(
    harness.createdFiles[0].content.match(/2026-08-06/gu)?.length,
    3,
  );
  assert.doesNotMatch(harness.createdFiles[0].content, /\{\{/u);
  assert.deepEqual(harness.templateReads, ["templates/obsidian/article.md"]);
  assert.deepEqual(harness.openedFiles, [harness.createdFiles[0].file]);
  assert.equal(modal.closed, true);
  assert.match(harness.notices.at(-1).message, /草稿已创建并打开/u);
  assert.equal(harness.spawned.length, 0);

  const mobile = await createPluginHarness({ desktop: false });
  assert.equal(findCommand(mobile, "create-blog-draft").checkCallback(true), false);
  assert.equal(mobile.modals.length, 0);
});

test("maps article, TIL, and project to their exact trusted templates", async (t) => {
  const templates = await readObsidianTemplates();
  const cases = [
    ["article", "type: article", "freshness: historical"],
    ["til", "type: til", "freshness: historical"],
    ["project", "status: planning", "freshness: current"],
  ];

  for (const [kind, marker, freshness] of cases) {
    await t.test(kind, async () => {
      const harness = await createPluginHarness({ fileContents: templates, files: [] });
      harness.plugin.getDraftCreationToday = () => "2026-08-06";
      const result = await harness.plugin.createDraftFromTemplate({
        kind,
        slug: `${kind}-draft`,
        title: `${kind} 标题`,
      });
      assert.deepEqual(harness.templateReads, [`templates/obsidian/${kind}.md`]);
      assert.equal(result.path, `content/inbox/${kind}-draft.md`);
      assert.equal(result.opened, true);
      assert.match(harness.createdFiles[0].content, new RegExp(`^${marker}$`, "mu"));
      assert.match(harness.createdFiles[0].content, new RegExp(`^${freshness}$`, "mu"));
      assert.match(harness.createdFiles[0].content, /draft: true/u);
      assert.doesNotMatch(harness.createdFiles[0].content, /^slug\s*:/mu);
    });
  }
});

test("rejects invalid draft input before reading a template", async (t) => {
  const cases = [
    ["unknown kind", { kind: "post", slug: "safe-slug", title: "Title" }, /类型/u],
    ["empty title", { kind: "article", slug: "safe-slug", title: "   " }, /标题/u],
    ["multiline title", { kind: "article", slug: "safe-slug", title: "A\nB" }, /标题/u],
    ["long title", { kind: "article", slug: "safe-slug", title: "a".repeat(121) }, /120/u],
    ["uppercase slug", { kind: "article", slug: "Unsafe", title: "Title" }, /slug/u],
    ["path slug", { kind: "article", slug: "../unsafe", title: "Title" }, /slug/u],
    ["long slug", { kind: "article", slug: "a".repeat(81), title: "Title" }, /80/u],
  ];

  for (const [name, input, expected] of cases) {
    await t.test(name, async () => {
      const harness = await createPluginHarness({ files: [] });
      await assert.rejects(harness.plugin.createDraftFromTemplate(input), expected);
      assert.deepEqual(harness.templateReads, []);
      assert.deepEqual(harness.createdFiles, []);
      assert.deepEqual(harness.openedFiles, []);
    });
  }
});

test("fails closed on template drift and every existing content namespace", async (t) => {
  const templates = await readObsidianTemplates();
  const driftCases = [
    ["missing", {}],
    ["prefilled title", {
      "templates/obsidian/article.md": templates["templates/obsidian/article.md"].replace('title: ""', 'title: "Existing"'),
    }],
    ["unknown token", {
      "templates/obsidian/article.md": `${templates["templates/obsidian/article.md"]}\n{{unknown}}\n`,
    }],
    ["redundant slug", {
      "templates/obsidian/article.md": templates["templates/obsidian/article.md"].replace(
        'title: ""',
        'title: ""\nslug: redundant-identity',
      ),
    }],
    ["wrong kind marker", {
      "templates/obsidian/article.md": templates["templates/obsidian/article.md"].replace("type: article", "type: til"),
    }],
  ];
  for (const [name, fileContents] of driftCases) {
    await t.test(`template ${name}`, async () => {
      const harness = await createPluginHarness({ fileContents, files: [] });
      await assert.rejects(
        harness.plugin.createDraftFromTemplate({ kind: "article", slug: "drift", title: "Drift" }),
        /模板/u,
      );
      assert.deepEqual(harness.createdFiles, []);
      assert.deepEqual(harness.openedFiles, []);
    });
  }

  for (const existingPath of [
    "content/inbox/collision.md",
    "content/posts/collision.md",
    "content/projects/collision.md",
  ]) {
    await t.test(`collision ${existingPath}`, async () => {
      const harness = await createPluginHarness({
        fileContents: templates,
        files: [existingPath],
      });
      await assert.rejects(
        harness.plugin.createDraftFromTemplate({ kind: "til", slug: "collision", title: "Collision" }),
        /已存在/u,
      );
      assert.deepEqual(harness.templateReads, []);
      assert.deepEqual(harness.createdFiles, []);
    });
  }
});

test("keeps atomic create and post-create open failures explicit", async () => {
  const templates = await readObsidianTemplates();
  const raced = await createPluginHarness({
    createFailure: "File already exists after preflight",
    fileContents: templates,
    files: [],
  });
  findCommand(raced, "create-blog-draft").checkCallback(false);
  const racedModal = raced.modals[0];
  const [racedTitle, racedSlug] = elementsByTag(racedModal, "input");
  racedTitle.value = "Raced";
  racedSlug.value = "raced";
  const racedSubmit = elementsByTag(racedModal, "button").find(
    (button) => button.text === "创建草稿",
  );
  await racedSubmit.trigger("click");
  assert.equal(racedModal.closed, false);
  assert.equal(racedSubmit.disabled, false);
  assert.deepEqual(raced.createdFiles, []);
  assert.deepEqual(raced.openedFiles, []);
  const racedError = allElements(racedModal.contentEl).find(
    (element) => element.classes.has("myblog-draft-create__error"),
  );
  assert.equal(racedError.attributes.role, "alert");
  assert.match(racedError.text, /创建失败.*未覆盖任何文件/u);

  const unopened = await createPluginHarness({
    fileContents: templates,
    files: [],
    openFailure: "workspace unavailable",
  });
  findCommand(unopened, "create-blog-draft").checkCallback(false);
  const unopenedModal = unopened.modals[0];
  const [unopenedTitle, unopenedSlug] = elementsByTag(unopenedModal, "input");
  unopenedTitle.value = "Created but unopened";
  unopenedSlug.value = "created-but-unopened";
  const unopenedSubmit = elementsByTag(unopenedModal, "button").find(
    (button) => button.text === "创建草稿",
  );
  await unopenedSubmit.trigger("click");
  assert.equal(unopened.createdFiles.length, 1);
  assert.deepEqual(unopened.openedFiles, []);
  assert.equal(unopenedModal.closed, true);
  assert.match(
    unopened.notices.at(-1).message,
    /草稿已创建.*无法自动打开.*content\/inbox\/created-but-unopened\.md/u,
  );
});

test("renders native evidence for a filename-owned draft without offering cleanup", async () => {
  const sourcePath = "content/inbox/original-draft.md";
  const harness = await createPluginHarness({
    activeFilePath: sourcePath,
    fileContents: { [sourcePath]: filenameOwnedDraft() },
    files: [],
  });
  const command = findCommand(harness, "inspect-current-inbox-draft-identity");
  assert.equal(command.name, "检查当前草稿身份");
  assert.equal(command.checkCallback(true), true);
  assert.equal(command.checkCallback(false), true);
  await settleAsyncWork();

  assert.equal(harness.modals.length, 1);
  const modal = harness.modals[0];
  const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
  assert.equal(modal.contentEl.classes.has("myblog-draft-identity"), true);
  assert.deepEqual(elementsByTag(modal, "h2").map((element) => element.text), [
    "检查当前草稿身份",
  ]);
  assert.match(text, /DRAFT IDENTITY \/ LOCAL EVIDENCE/u);
  assert.match(text, /FILE ⇄ FRONTMATTER/u);
  assert.match(text, /READY \/ FILE OWNED/u);
  assert.match(text, /DRAFT.*TRUE.*INBOX.*OWNED.*POST.*CLEAR.*PROJECT.*CLEAR/su);
  assert.deepEqual(elementsByTag(modal, "button").map((button) => button.text), ["关闭"]);
  assert.deepEqual(harness.processAttempts, []);
  assert.deepEqual(harness.vaultReads, [sourcePath]);
  assert.equal(harness.spawned.length, 0);
});

test("keeps current draft identity evidence latest-wins through async reads and unload", async (t) => {
  const sourcePath = "content/inbox/original-draft.md";
  const content = filenameOwnedDraft();

  await t.test("stale read success cannot open after the latest evidence", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      deferredVaultReadNumbers: [1],
      fileContents: { [sourcePath]: content },
      files: [],
    });
    const command = findCommand(harness, "inspect-current-inbox-draft-identity");
    command.checkCallback(false);
    command.checkCallback(false);
    await settleAsyncWork();

    assert.deepEqual(harness.vaultReads, [sourcePath, sourcePath]);
    assert.equal(harness.modals.length, 1);
    harness.resolveVaultRead(1);
    await settleAsyncWork();

    assert.equal(harness.modals.length, 1);
    assert.equal(harness.notices.length, 0);
  });

  await t.test("stale read failure stays silent after the latest evidence", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      deferredVaultReadNumbers: [1],
      fileContents: { [sourcePath]: content },
      files: [],
    });
    const command = findCommand(harness, "inspect-current-inbox-draft-identity");
    command.checkCallback(false);
    command.checkCallback(false);
    await settleAsyncWork();

    assert.equal(harness.modals.length, 1);
    harness.rejectVaultRead(1, new Error("old read failed"));
    await settleAsyncWork();

    assert.equal(harness.modals.length, 1);
    assert.equal(harness.notices.length, 0);
  });

  await t.test("current read failure keeps the existing author-facing error", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      deferredVaultReadNumbers: [1],
      fileContents: { [sourcePath]: content },
      files: [],
    });
    findCommand(harness, "inspect-current-inbox-draft-identity").checkCallback(false);
    harness.rejectVaultRead(1, new Error("current read failed"));
    await settleAsyncWork();

    assert.equal(harness.modals.length, 0);
    assert.equal(harness.notices.length, 1);
    assert.match(harness.notices[0].message, /草稿身份读取失败.*current read failed/u);
  });

  await t.test("active draft drift during the read does not open stale evidence", async () => {
    const otherPath = "content/inbox/other-draft.md";
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      deferredVaultReadNumbers: [1],
      fileContents: {
        [otherPath]: filenameOwnedDraft({ title: "另一篇草稿" }),
        [sourcePath]: content,
      },
      files: [],
    });
    findCommand(harness, "inspect-current-inbox-draft-identity").checkCallback(false);
    harness.setActiveFilePath(otherPath);
    harness.resolveVaultRead(1);
    await settleAsyncWork();

    assert.equal(harness.modals.length, 0);
    assert.equal(harness.notices.length, 1);
    assert.match(harness.notices[0].message, /当前草稿在检查期间已变化/u);
  });

  await t.test("unload invalidates an in-flight identity read", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      deferredVaultReadNumbers: [1],
      fileContents: { [sourcePath]: content },
      files: [],
    });
    findCommand(harness, "inspect-current-inbox-draft-identity").checkCallback(false);
    harness.plugin.onunload();
    assert.equal(harness.plugin.currentDraftIdentityGeneration, null);
    harness.resolveVaultRead(1);
    await settleAsyncWork();

    assert.equal(harness.modals.length, 0);
    assert.equal(harness.notices.length, 0);
  });
});

test("renders one current draft author-intent summary with accessible ALT and LINK navigation", async () => {
  const sourcePath = "content/inbox/current-draft.md";
  const [styles, harness] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    createPluginHarness({ activeFilePath: sourcePath, files: [] }),
  ]);
  const command = findCommand(harness, "inspect-current-draft-intent");
  assert.equal(command.name, "查看当前草稿发布意图");
  assert.equal(command.checkCallback(true), true);
  assert.equal(command.checkCallback(false), true);
  assert.deepEqual(plain(harness.spawned[0].args), [
    "/d",
    "/s",
    "/c",
    "npm",
    "--silent",
    "run",
    "content:inbox",
    "--",
    "--format",
    "json",
    "--source",
    sourcePath,
  ]);
  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(inboxReadinessReport({
      entry: {
        attachments: [inboxPreparedAttachment(), inboxPreservedAttachment()],
      },
    }))),
  );
  harness.spawned[0].child.emit("close", 0);
  await settleAsyncWork();

  assert.equal(harness.modals.length, 1);
  const modal = harness.modals[0];
  const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
  assert.equal(modal.contentEl.classes.has("myblog-draft-intent"), true);
  assert.deepEqual(elementsByTag(modal, "h2").map((element) => element.text), [
    "当前草稿发布意图",
  ]);
  assert.match(text, /AUTHOR INTENT \/ LOCAL EVIDENCE/u);
  assert.match(text, /DRAFT → PUBLIC/u);
  assert.match(text, /READY \/ PUBLIC ON PASS/u);
  assert.match(text, /current-draft\.md.*content\/posts\/current-draft\.md/su);
  assert.match(
    text,
    /TYPE.*ARTICLE.*DATE.*2026-08-06.*NOW.*MEDIA.*2.*LINKS.*2.*SOURCE.*SHA-256 · [a-f0-9]{12}/su,
  );
  assert.match(text, /MEDIA TRACE.*2 ATTACHMENTS/su);
  assert.match(
    text,
    /OPTIMIZED.*SAVED 1\.00 KiB.*33\.3%.*COVER.*L12.*ALT · L12 · AUTHORED.*项目发布轨迹总览.*BODY.*L20, L20, L24.*×3.*ALT · L20 · AUTHORED.*构建日志截图.*ALT · L20 · AUTHORED.*变换前后对照.*ALT · L24 · AUTHORED.*运行证据.*public\/uploads\/evidence\.png.*public\/uploads\/current-draft\/evidence\.webp.*\/uploads\/current-draft\/evidence\.webp.*PNG.*1200×630 PX.*3\.00 KiB.*WEBP.*1200×630 PX.*2\.00 KiB/su,
  );
  assert.match(
    text,
    /PRESERVED.*BYTE-STABLE.*BODY.*L28.*ALT · L28 · AUTHORED.*动画执行过程.*public\/uploads\/animation\.gif.*\/uploads\/current-draft\/animation\.gif.*GIF.*640×360 PX.*12 FRAMES.*4\.00 KiB/su,
  );
  assert.match(text, /LINK TRACE.*2 VERIFIED/su);
  assert.match(
    text,
    /POST.*\/posts\/building-a-maintainable-blog#method.*REF · L18.*REF · L22.*×2/su,
  );
  assert.match(text, /PROJECT.*\/projects\/myblog.*REF · L19/su);
  assert.match(text, /不会修改、发布、提交、推送或联网/u);
  const jumpButtons = elementsByTag(modal, "button").filter((button) =>
    button.classes.has("myblog-draft-intent__media-jump"),
  );
  assert.deepEqual(jumpButtons.map((button) => button.text), [
    "ALT · L12 · AUTHORED",
    "ALT · L20 · AUTHORED",
    "ALT · L20 · AUTHORED",
    "ALT · L24 · AUTHORED",
    "ALT · L28 · AUTHORED",
  ]);
  assert.ok(jumpButtons.every((button) => button.attributes.type === "button"));
  assert.match(
    jumpButtons[3].attributes["aria-label"],
    /定位到当前草稿第 24 行的替代文本.*AUTHORED/u,
  );
  const linkJumpButtons = elementsByTag(modal, "button").filter((button) =>
    button.classes.has("myblog-draft-intent__link-jump"),
  );
  assert.deepEqual(linkJumpButtons.map((button) => button.text), [
    "REF · L18",
    "REF · L22",
    "REF · L19",
  ]);
  assert.ok(linkJumpButtons.every((button) => button.attributes.type === "button"));
  assert.match(
    linkJumpButtons[1].attributes["aria-label"],
    /定位到当前草稿第 22 行的 POST 引用.*building-a-maintainable-blog#method/u,
  );
  assert.equal(elementsByTag(modal, "button").at(-1).text, "关闭");
  assert.match(styles, /^\.myblog-draft-intent \{/mu);
  assert.match(styles, /myblog-draft-intent__signature/u);
  assert.match(styles, /myblog-draft-intent__media/u);
  assert.match(styles, /myblog-draft-intent__media-usage/u);
  assert.match(styles, /myblog-draft-intent__media-alt--blocked/u);
  assert.match(styles, /myblog-draft-intent__media-jump/u);
  assert.match(styles, /myblog-draft-intent__media-jump:focus-visible/u);
  assert.match(styles, /myblog-draft-intent__links/u);
  assert.match(styles, /myblog-draft-intent__link-jump/u);
  assert.match(styles, /myblog-draft-intent__link-jump:focus-visible/u);
  assert.deepEqual(harness.processAttempts, []);
  assert.deepEqual(harness.vaultReads, [sourcePath]);
  assert.equal(harness.reconciliations, 0);
  assert.equal(harness.spawned.length, 1);
});

test("navigates one ALT evidence to its exact current draft line without writing", async () => {
  const sourcePath = "content/inbox/current-draft.md";
  const source = markdownWithLineCount(32);
  const harness = await createPluginHarness({
    activeFilePath: sourcePath,
    fileContents: { [sourcePath]: source },
    files: [],
  });
  findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(inboxReadinessReport({
      entry: { attachments: [inboxPreparedAttachment()] },
      sourceContent: source,
    }))),
  );
  harness.spawned[0].child.emit("close", 0);
  await settleAsyncWork();

  const modal = harness.modals[0];
  const jump = elementsByTag(modal, "button").find(
    (button) => button.text === "ALT · L24 · AUTHORED",
  );
  assert.ok(jump);
  await Promise.all([jump.trigger("click"), jump.trigger("click")]);

  assert.deepEqual(harness.openedFiles.map((file) => file.path), [sourcePath]);
  assert.deepEqual(plain(harness.openedStates), [{ active: true }]);
  assert.deepEqual(plain(harness.cursorPositions), [{ line: 23, ch: 0 }]);
  assert.deepEqual(plain(harness.scrollRanges), [{
    center: true,
    range: {
      from: { line: 23, ch: 0 },
      to: { line: 23, ch: 0 },
    },
  }]);
  assert.equal(harness.editorFocusCount, 1);
  assert.equal(modal.closed, true);
  assert.deepEqual(harness.vaultReads, [sourcePath, sourcePath]);
  assert.equal(harness.getContent(sourcePath), source);
  assert.deepEqual(harness.processAttempts, []);
  assert.equal(harness.spawned.length, 1);
  assert.match(harness.notices.at(-1).message, /已定位到当前草稿 L24/u);
});

test("navigates one LINK occurrence to its exact current draft line without writing", async () => {
  const sourcePath = "content/inbox/current-draft.md";
  const source = markdownWithLineCount(32);
  const harness = await createPluginHarness({
    activeFilePath: sourcePath,
    fileContents: { [sourcePath]: source },
    files: [],
  });
  findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(inboxReadinessReport({ sourceContent: source }))),
  );
  harness.spawned[0].child.emit("close", 0);
  await settleAsyncWork();

  const modal = harness.modals[0];
  const jump = elementsByTag(modal, "button").find(
    (button) => button.text === "REF · L22",
  );
  assert.ok(jump);
  await Promise.all([jump.trigger("click"), jump.trigger("click")]);

  assert.deepEqual(harness.openedFiles.map((file) => file.path), [sourcePath]);
  assert.deepEqual(plain(harness.openedStates), [{ active: true }]);
  assert.deepEqual(plain(harness.cursorPositions), [{ line: 21, ch: 0 }]);
  assert.deepEqual(plain(harness.scrollRanges), [{
    center: true,
    range: {
      from: { line: 21, ch: 0 },
      to: { line: 21, ch: 0 },
    },
  }]);
  assert.equal(harness.editorFocusCount, 1);
  assert.equal(modal.closed, true);
  assert.deepEqual(harness.vaultReads, [sourcePath, sourcePath]);
  assert.equal(harness.getContent(sourcePath), source);
  assert.deepEqual(harness.processAttempts, []);
  assert.equal(harness.spawned.length, 1);
  assert.match(harness.notices.at(-1).message, /已定位到当前草稿 L22 · LINK/u);
});

test("fails closed when a LINK occurrence is outside the current source", async () => {
  const sourcePath = "content/inbox/current-draft.md";
  const source = markdownWithLineCount(10);
  const harness = await createPluginHarness({
    activeFilePath: sourcePath,
    fileContents: { [sourcePath]: source },
    files: [],
  });
  findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
  harness.spawned[0].child.stdout.emit(
    "data",
    Buffer.from(JSON.stringify(inboxReadinessReport({ sourceContent: source }))),
  );
  harness.spawned[0].child.emit("close", 0);
  await settleAsyncWork();

  const modal = harness.modals[0];
  const jump = elementsByTag(modal, "button").find(
    (button) => button.text === "REF · L22",
  );
  assert.ok(jump);
  await jump.trigger("click");

  assert.deepEqual(harness.vaultReads, [sourcePath, sourcePath]);
  assert.deepEqual(harness.openedFiles, []);
  assert.deepEqual(harness.cursorPositions, []);
  assert.equal(modal.closed, false);
  assert.equal(harness.getContent(sourcePath), source);
  assert.match(harness.notices.at(-1).message, /LINK 证据 L22.*当前文件只有 10 行/u);
});

test("fails closed when an ALT source navigation target drifts", async (t) => {
  const sourcePath = "content/inbox/current-draft.md";
  const openIntent = async (options = {}) => {
    const source = options.fileContents?.[sourcePath] ?? markdownWithLineCount(32);
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      fileContents: { [sourcePath]: source },
      files: [],
      ...options,
    });
    findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
    harness.spawned[0].child.stdout.emit(
      "data",
      Buffer.from(JSON.stringify(inboxReadinessReport({
        entry: { attachments: [inboxPreparedAttachment()] },
        sourceContent: source,
      }))),
    );
    harness.spawned[0].child.emit("close", 0);
    await settleAsyncWork();
    const modal = harness.modals[0];
    const jump = elementsByTag(modal, "button").find(
      (button) => button.text === "ALT · L24 · AUTHORED",
    );
    assert.ok(jump);
    return { harness, jump, modal };
  };

  await t.test("active draft path changed", async () => {
    const { harness, jump, modal } = await openIntent({
      files: ["content/inbox/other-draft.md"],
    });
    harness.setActiveFilePath("content/inbox/other-draft.md");
    await jump.trigger("click");
    assert.deepEqual(harness.vaultReads, [sourcePath]);
    assert.deepEqual(harness.openedFiles, []);
    assert.equal(modal.closed, false);
    assert.match(harness.notices.at(-1).message, /活动草稿已变化.*未定位/u);
  });

  await t.test("frozen Vault file was replaced", async () => {
    const { harness, jump, modal } = await openIntent();
    harness.replaceFile(sourcePath, { keepActiveFile: true });
    await jump.trigger("click");
    assert.deepEqual(harness.vaultReads, [sourcePath]);
    assert.deepEqual(harness.openedFiles, []);
    assert.equal(modal.closed, false);
    assert.match(harness.notices.at(-1).message, /草稿来源文件已变化.*未定位/u);
  });

  await t.test("active draft changed during line validation", async () => {
    const { harness, jump, modal } = await openIntent({
      files: ["content/inbox/other-draft.md"],
      readActiveFilePath: "content/inbox/other-draft.md",
      readActiveFilePathAt: 2,
    });
    await jump.trigger("click");
    assert.deepEqual(harness.vaultReads, [sourcePath, sourcePath]);
    assert.deepEqual(harness.openedFiles, []);
    assert.equal(modal.closed, false);
    assert.match(harness.notices.at(-1).message, /行号检查期间发生变化.*未定位/u);
  });

  await t.test("evidence line is outside current source", async () => {
    const { harness, jump, modal } = await openIntent({
      fileContents: { [sourcePath]: markdownWithLineCount(10) },
    });
    await jump.trigger("click");
    assert.deepEqual(harness.vaultReads, [sourcePath, sourcePath]);
    assert.deepEqual(harness.openedFiles, []);
    assert.equal(modal.closed, false);
    assert.match(harness.notices.at(-1).message, /L24.*当前文件只有 10 行/u);
  });

  await t.test("editor line count changed after open", async () => {
    const { harness, jump, modal } = await openIntent({ editorLineCount: 10 });
    await jump.trigger("click");
    assert.deepEqual(harness.openedFiles.map((file) => file.path), [sourcePath]);
    assert.deepEqual(harness.cursorPositions, []);
    assert.equal(harness.editorFocusCount, 0);
    assert.equal(modal.closed, false);
    assert.match(harness.notices.at(-1).message, /编辑器中的草稿行数已变化.*未定位/u);
  });

  await t.test("Markdown editor is unavailable", async () => {
    const { harness, jump, modal } = await openIntent({ markdownViewAvailable: false });
    await jump.trigger("click");
    assert.deepEqual(harness.openedFiles.map((file) => file.path), [sourcePath]);
    assert.deepEqual(harness.cursorPositions, []);
    assert.equal(modal.closed, false);
    assert.match(harness.notices.at(-1).message, /Markdown 编辑器不可用.*未定位/u);
  });

  await t.test("workspace refuses to open the source", async () => {
    const { harness, jump, modal } = await openIntent({ openFailure: "workspace unavailable" });
    await jump.trigger("click");
    assert.deepEqual(harness.openedFiles, []);
    assert.deepEqual(harness.cursorPositions, []);
    assert.equal(modal.closed, false);
    assert.match(harness.notices.at(-1).message, /草稿打开失败.*workspace unavailable/u);
  });
});

test("binds the summary and every source jump to the same exact draft bytes", async (t) => {
  const sourcePath = "content/inbox/current-draft.md";
  const source = markdownWithLineCount(32);

  await t.test("source changed before summary opens", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      fileContents: { [sourcePath]: `${source}\nchanged after report` },
      files: [],
    });
    findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
    harness.spawned[0].child.stdout.emit(
      "data",
      Buffer.from(JSON.stringify(inboxReadinessReport({ sourceContent: source }))),
    );
    harness.spawned[0].child.emit("close", 0);
    await settleAsyncWork();

    assert.equal(harness.modals.length, 0);
    assert.deepEqual(harness.vaultReads, [sourcePath]);
    assert.deepEqual(harness.openedFiles, []);
    assert.match(harness.notices.at(-1).message, /SHA-256.*内容已变化.*重新运行/u);
  });

  await t.test("same TFile changed after summary opens", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      fileContents: { [sourcePath]: source },
      files: [],
    });
    findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
    harness.spawned[0].child.stdout.emit(
      "data",
      Buffer.from(JSON.stringify(inboxReadinessReport({ sourceContent: source }))),
    );
    harness.spawned[0].child.emit("close", 0);
    await settleAsyncWork();

    const modal = harness.modals[0];
    harness.setContent(sourcePath, source.replace("line 22", "changed"));
    const jump = elementsByTag(modal, "button").find(
      (button) => button.text === "REF · L22",
    );
    await jump.trigger("click");

    assert.deepEqual(harness.vaultReads, [sourcePath, sourcePath]);
    assert.deepEqual(harness.openedFiles, []);
    assert.equal(modal.closed, false);
    assert.match(harness.notices.at(-1).message, /LINK.*SHA-256.*证据已过期.*重新运行/u);
  });
});

test("keeps current-draft intent evidence latest-wins through async verification and unload", async (t) => {
  const sourcePath = "content/inbox/current-draft.md";
  const source = filenameOwnedDraft();
  const report = JSON.stringify(inboxReadinessReport({ sourceContent: source }));
  const successNotice = /SHA-256 绑定的本地只读证据生成/u;

  await t.test("stale successful command result is silent", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      fileContents: { [sourcePath]: source },
      files: [],
    });
    const command = findCommand(harness, "inspect-current-draft-intent");
    command.checkCallback(false);
    command.checkCallback(false);

    harness.spawned[0].child.stdout.emit("data", Buffer.from("not-json"));
    harness.spawned[0].child.emit("close", 0);
    assert.equal(harness.modals.length, 0);
    assert.deepEqual(harness.vaultReads, []);
    assert.equal(
      harness.notices.some((notice) => /作者意图摘要证据不可用/u.test(notice.message)),
      false,
    );

    harness.spawned[1].child.stdout.emit("data", Buffer.from(report));
    harness.spawned[1].child.emit("close", 0);
    await settleAsyncWork();
    assert.equal(harness.modals.length, 1);
    assert.deepEqual(harness.vaultReads, [sourcePath]);
    assert.equal(
      harness.notices.filter((notice) => successNotice.test(notice.message)).length,
      1,
    );
  });

  await t.test("stale command failure is silent", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      fileContents: { [sourcePath]: source },
      files: [],
    });
    const command = findCommand(harness, "inspect-current-draft-intent");
    command.checkCallback(false);
    command.checkCallback(false);
    harness.spawned[0].child.stderr.emit("data", Buffer.from("old command failed"));
    harness.spawned[0].child.emit("close", 1);

    assert.equal(
      harness.notices.some((notice) => /当前草稿作者意图检查未完成/u.test(notice.message)),
      false,
    );
    assert.equal(harness.modals.length, 0);
    assert.deepEqual(harness.vaultReads, []);

    harness.spawned[1].child.stdout.emit("data", Buffer.from(report));
    harness.spawned[1].child.emit("close", 0);
    await settleAsyncWork();
    assert.equal(harness.modals.length, 1);
  });

  await t.test("stale command error is silent", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      fileContents: { [sourcePath]: source },
      files: [],
    });
    const command = findCommand(harness, "inspect-current-draft-intent");
    command.checkCallback(false);
    command.checkCallback(false);
    harness.spawned[0].child.emit("error", new Error("old process error"));

    assert.equal(
      harness.notices.some((notice) => /当前草稿作者意图检查无法启动/u.test(notice.message)),
      false,
    );
    assert.equal(harness.plugin.activeRuns.size, 1);

    harness.spawned[1].child.stdout.emit("data", Buffer.from(report));
    harness.spawned[1].child.emit("close", 0);
    await settleAsyncWork();
    assert.equal(harness.modals.length, 1);
  });

  await t.test("stale digest read cannot open after the latest result", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      deferredVaultReadNumbers: [1],
      fileContents: { [sourcePath]: source },
      files: [],
    });
    const command = findCommand(harness, "inspect-current-draft-intent");
    command.checkCallback(false);
    harness.spawned[0].child.stdout.emit("data", Buffer.from(report));
    harness.spawned[0].child.emit("close", 0);
    assert.deepEqual(harness.vaultReads, [sourcePath]);

    command.checkCallback(false);
    harness.spawned[1].child.stdout.emit("data", Buffer.from(report));
    harness.spawned[1].child.emit("close", 0);
    await settleAsyncWork();
    assert.equal(harness.modals.length, 1);
    assert.deepEqual(harness.vaultReads, [sourcePath, sourcePath]);

    harness.resolveVaultRead(1);
    await settleAsyncWork();
    assert.equal(harness.modals.length, 1);
    assert.equal(
      harness.notices.filter((notice) => successNotice.test(notice.message)).length,
      1,
    );
    assert.equal(harness.spawned.length, 2);
  });

  await t.test("unload invalidates an in-flight digest read", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      deferredVaultReadNumbers: [1],
      fileContents: { [sourcePath]: source },
      files: [],
    });
    findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
    harness.spawned[0].child.stdout.emit("data", Buffer.from(report));
    harness.spawned[0].child.emit("close", 0);
    assert.deepEqual(harness.vaultReads, [sourcePath]);

    harness.plugin.onunload();
    assert.equal(harness.plugin.currentDraftIntentGeneration, null);
    harness.resolveVaultRead(1);
    await settleAsyncWork();

    assert.equal(harness.modals.length, 0);
    assert.equal(
      harness.notices.filter((notice) => successNotice.test(notice.message)).length,
      0,
    );
    assert.equal(harness.spawned.length, 1);
  });
});

test("shows scheduled and blocked date semantics without adding publication actions", async (t) => {
  const sourcePath = "content/inbox/current-draft.md";
  const missingAttachment = inboxPreparedAttachment();
  delete missingAttachment.preparation;
  const cases = [
    [
      "scheduled",
      inboxReadinessReport({
        entry: {
          contentType: "project",
          kind: "project",
          publishedAt: "2026-08-10",
          state: "scheduled",
          targetPath: "content/projects/current-draft.md",
        },
      }),
      /SCHEDULED \/ FUTURE DATE.*PROJECT.*2026-08-10.*SCHEDULED/su,
    ],
    [
      "blocked",
      inboxReadinessReport({
        entry: {
          issues: [
            {
              code: "attachment-missing",
              message: "正文引用的附件不存在：public/uploads/missing.png",
              path: "public/uploads/missing.png",
            },
          ],
          state: "blocked",
        },
      }),
      /HOLD \/ 1 BLOCKER.*阻塞证据.*attachment-missing.*missing\.png/su,
    ],
    [
      "blocked media without a derived envelope",
      inboxReadinessReport({
        entry: {
          attachments: [missingAttachment],
          issues: [
            {
              code: "attachment-missing",
              message: "正文引用的附件不存在：public/uploads/evidence.png",
              path: "public/uploads/evidence.png",
            },
          ],
          state: "blocked",
        },
      }),
      /HOLD \/ 1 BLOCKER.*MEDIA TRACE.*1 ATTACHMENT.*UNPROVEN.*MEDIA ENVELOPE UNAVAILABLE.*public\/uploads\/evidence\.png.*public\/uploads\/current-draft\/evidence\.webp.*\/uploads\/current-draft\/evidence\.webp/su,
    ],
    [
      "blocked empty alternative text remains visible",
      (() => {
        const attachment = inboxPreparedAttachment();
        attachment.usages[1].altTexts[1] = "";
        return inboxReadinessReport({
          entry: {
            attachments: [attachment],
            issues: [
              {
                code: "attachment-alt-empty",
                message: "附件替代文本为空：BODY L20；请描述图片传达的信息",
                path: "public/uploads/evidence.png",
              },
            ],
            state: "blocked",
          },
        });
      })(),
      /HOLD \/ 1 BLOCKER.*BODY.*ALT · L20 · AUTHORED.*构建日志截图.*ALT · L20 · AUTHORED.*EMPTY · WILL FAIL.*attachment-alt-empty/su,
    ],
    [
      "blocked filename fallback remains visible",
      (() => {
        const attachment = inboxPreparedAttachment();
        attachment.usages[1].altSources[1] = "filename-fallback";
        attachment.usages[1].altTexts[1] = "evidence.png";
        return inboxReadinessReport({
          entry: {
            attachments: [attachment],
            issues: [
              {
                code: "attachment-alt-filename-fallback",
                message: "附件替代文本来自文件名回退：BODY L20；请填写图片描述",
                path: "public/uploads/evidence.png",
              },
            ],
            state: "blocked",
          },
        });
      })(),
      /HOLD \/ 1 BLOCKER.*BODY.*ALT · L20 · AUTHORED.*构建日志截图.*ALT · L20 · FILENAME FALLBACK.*evidence\.png · WILL FAIL.*attachment-alt-filename-fallback/su,
    ],
  ];

  for (const [name, report, expectation] of cases) {
    await t.test(name, async () => {
      const harness = await createPluginHarness({ activeFilePath: sourcePath, files: [] });
      findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
      harness.spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify(report)));
      harness.spawned[0].child.emit("close", 0);
      await settleAsyncWork();
      const modal = harness.modals[0];
      const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
      assert.match(text, expectation);
      const buttons = elementsByTag(modal, "button");
      assert.equal(buttons.at(-1).text, "关闭");
      const nonCloseButtons = buttons.filter((button) => button.text !== "关闭");
      assert.ok(nonCloseButtons.every((button) =>
        button.classes.has("myblog-draft-intent__media-jump") ||
        button.classes.has("myblog-draft-intent__link-jump")));
      assert.ok(nonCloseButtons.every((button) =>
        !/发布|修复|检查/u.test(button.text)));
      assert.equal(harness.spawned.length, 1);
    });
  }
});

test("fails closed when current-draft intent evidence is untrusted or the active file drifts", async (t) => {
  const sourcePath = "content/inbox/current-draft.md";
  const changedMediaReport = (mutate, entry = {}) => {
    const attachment = inboxPreparedAttachment();
    mutate(attachment);
    return JSON.stringify(inboxReadinessReport({
      entry: { attachments: [attachment], ...entry },
    }));
  };
  const multiEntryReport = inboxReadinessReport();
  multiEntryReport.entries.push({
    ...multiEntryReport.entries[0],
    slug: "other-draft",
    sourcePath: "content/inbox/other-draft.md",
    targetPath: "content/posts/other-draft.md",
  });
  multiEntryReport.counts.drafts = 2;
  multiEntryReport.counts.ready = 2;
  const invalidCases = [
    ["invalid JSON", "not-json"],
    ["unsupported version", JSON.stringify(inboxReadinessReport({ version: 5 }))],
    [
      "missing source digest",
      JSON.stringify((() => {
        const report = inboxReadinessReport();
        delete report.entries[0].sourceSha256;
        return report;
      })()),
    ],
    [
      "malformed source digest",
      JSON.stringify(inboxReadinessReport({ entry: { sourceSha256: "ABC123" } })),
    ],
    [
      "unavailable source digest",
      JSON.stringify(inboxReadinessReport({ entry: { sourceSha256: null } })),
    ],
    [
      "unsafe safety claim",
      JSON.stringify(inboxReadinessReport({ safety: { networkChecked: true } })),
    ],
    ["unscoped multi-entry report", JSON.stringify(multiEntryReport)],
    [
      "mismatched source",
      JSON.stringify(inboxReadinessReport({
        entry: {
          slug: "other-draft",
          sourcePath: "content/inbox/other-draft.md",
          targetPath: "content/posts/other-draft.md",
        },
      })),
    ],
    [
      "inconsistent counts",
      JSON.stringify({
        ...inboxReadinessReport(),
        counts: { ...inboxReadinessReport().counts, ready: 0 },
      }),
    ],
    [
      "link count does not match evidence",
      JSON.stringify(inboxReadinessReport({ entry: { internalLinkCount: 1 } })),
    ],
    [
      "duplicate exact link target",
      JSON.stringify(inboxReadinessReport({
        entry: {
          internalLinks: [
            {
              kind: "post",
              occurrences: 1,
              sourceLines: [18],
              target: "/posts/duplicate",
            },
            {
              kind: "post",
              occurrences: 1,
              sourceLines: [22],
              target: "/posts/duplicate",
            },
          ],
        },
      })),
    ],
    [
      "link occurrence and source lines drift",
      JSON.stringify(inboxReadinessReport({
        entry: {
          internalLinkCount: 1,
          internalLinks: [{
            kind: "post",
            occurrences: 2,
            sourceLines: [18],
            target: "/posts/building-a-maintainable-blog",
          }],
        },
      })),
    ],
    [
      "link kind and target route disagree",
      JSON.stringify(inboxReadinessReport({
        entry: {
          internalLinkCount: 1,
          internalLinks: [{
            kind: "project",
            occurrences: 1,
            sourceLines: [18],
            target: "/posts/building-a-maintainable-blog",
          }],
        },
      })),
    ],
    [
      "self link points at another page",
      JSON.stringify(inboxReadinessReport({
        entry: {
          internalLinkCount: 1,
          internalLinks: [{
            kind: "self",
            occurrences: 1,
            sourceLines: [18],
            target: "/posts/another-draft#method",
          }],
        },
      })),
    ],
    [
      "media usages are missing",
      changedMediaReport((attachment) => {
        delete attachment.usages;
      }),
    ],
    [
      "media usage role repeats",
      changedMediaReport((attachment) => {
        attachment.usages.push({ ...attachment.usages[1] });
      }),
    ],
    [
      "media alternative texts are missing",
      changedMediaReport((attachment) => {
        delete attachment.usages[1].altTexts;
      }),
    ],
    [
      "media alternative text sources are missing",
      changedMediaReport((attachment) => {
        delete attachment.usages[1].altSources;
      }),
    ],
    [
      "media alternative text source occurrence drifts",
      changedMediaReport((attachment) => {
        attachment.usages[1].altSources.pop();
      }),
    ],
    [
      "media alternative text source is unknown",
      changedMediaReport((attachment) => {
        attachment.usages[1].altSources[0] = "generated";
      }),
    ],
    [
      "cover alternative text source is fallback",
      changedMediaReport((attachment) => {
        attachment.usages[0].altSources[0] = "filename-fallback";
      }),
    ],
    [
      "media alternative text occurrence drifts",
      changedMediaReport((attachment) => {
        attachment.usages[1].altTexts.pop();
      }),
    ],
    [
      "media alternative text is not a string",
      changedMediaReport((attachment) => {
        attachment.usages[1].altTexts[0] = 42;
      }),
    ],
    [
      "empty alternative text has no matching blocker",
      changedMediaReport((attachment) => {
        attachment.usages[1].altTexts[0] = " ";
      }),
    ],
    [
      "alternative text blocker has no empty occurrence",
      changedMediaReport(
        () => {},
        {
          issues: [
            {
              code: "attachment-alt-empty",
              message: "附件替代文本为空",
              path: "public/uploads/evidence.png",
            },
          ],
          state: "blocked",
        },
      ),
    ],
    [
      "filename fallback has no matching blocker",
      changedMediaReport((attachment) => {
        attachment.usages[1].altSources[0] = "filename-fallback";
      }),
    ],
    [
      "filename fallback blocker has no fallback occurrence",
      changedMediaReport(
        () => {},
        {
          issues: [
            {
              code: "attachment-alt-filename-fallback",
              message: "附件替代文本来自文件名回退",
              path: "public/uploads/evidence.png",
            },
          ],
          state: "blocked",
        },
      ),
    ],
    [
      "cover usage repeats",
      changedMediaReport((attachment) => {
        attachment.usages[0].occurrences = 2;
        attachment.usages[0].sourceLines = [12, 13];
      }),
    ],
    [
      "media usage occurrence lines drift",
      changedMediaReport((attachment) => {
        attachment.usages[1].occurrences = 4;
      }),
    ],
    [
      "media usage lines descend",
      changedMediaReport((attachment) => {
        attachment.usages[1].sourceLines = [20, 24, 20];
      }),
    ],
    [
      "media usage order drifts",
      changedMediaReport((attachment) => {
        attachment.usages.reverse();
      }),
    ],
    [
      "ready media has no preparation envelope",
      changedMediaReport((attachment) => delete attachment.preparation),
    ],
    [
      "unprepared blocked media has no matching issue",
      changedMediaReport(
        (attachment) => delete attachment.preparation,
        { state: "blocked" },
      ),
    ],
    [
      "media source inspection path drifts",
      changedMediaReport((attachment) => {
        attachment.preparation.source.sourcePath = "public/uploads/other.png";
      }),
    ],
    [
      "media output inspection path drifts",
      changedMediaReport((attachment) => {
        attachment.preparation.output.sourcePath =
          "public/uploads/current-draft/other.webp";
      }),
    ],
    [
      "media byte delta drifts",
      changedMediaReport((attachment) => {
        attachment.preparation.bytesSaved = 1023;
      }),
    ],
    [
      "preserved media changes bytes",
      (() => {
        const attachment = inboxPreservedAttachment();
        attachment.preparation.output.bytes = 4095;
        return JSON.stringify(inboxReadinessReport({
          entry: { attachments: [attachment] },
        }));
      })(),
    ],
    [
      "optimized media has an incompatible frame envelope",
      changedMediaReport((attachment) => {
        attachment.preparation.output.pages = 2;
      }),
    ],
    [
      "optimized media enlarges its source",
      changedMediaReport((attachment) => {
        attachment.preparation.output.width = 1201;
      }),
    ],
    [
      "two media entries share one target",
      (() => {
        const first = inboxPreparedAttachment();
        const second = inboxPreservedAttachment();
        second.targetPath = first.targetPath;
        second.publicUrl = first.publicUrl;
        second.preparation.output.sourcePath = first.targetPath;
        return JSON.stringify(inboxReadinessReport({
          entry: { attachments: [first, second] },
        }));
      })(),
    ],
  ];
  for (const [name, output] of invalidCases) {
    await t.test(name, async () => {
      const harness = await createPluginHarness({ activeFilePath: sourcePath, files: [] });
      findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
      harness.spawned[0].child.stdout.emit("data", Buffer.from(output));
      harness.spawned[0].child.emit("close", 0);
      assert.equal(harness.modals.length, 0);
      assert.equal(harness.spawned.length, 1);
      assert.match(harness.notices.at(-1).message, /作者意图摘要证据不可用/u);
    });
  }

  await t.test("active file drift", async () => {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      files: ["content/inbox/other-draft.md"],
    });
    findCommand(harness, "inspect-current-draft-intent").checkCallback(false);
    harness.setActiveFilePath("content/inbox/other-draft.md");
    harness.spawned[0].child.stdout.emit(
      "data",
      Buffer.from(JSON.stringify(inboxReadinessReport())),
    );
    harness.spawned[0].child.emit("close", 0);
    assert.equal(harness.modals.length, 0);
    assert.equal(harness.spawned.length, 1);
    assert.match(harness.notices.at(-1).message, /活动草稿已变化/u);
  });
});

test("offers current draft intent only for an exact desktop inbox Markdown path", async () => {
  const cases = [
    {},
    { activeFilePath: "content/posts/published.md" },
    { activeFilePath: "content/inbox/Unsafe Draft.md" },
    { activeFilePath: "content/inbox/draft.txt" },
    { activeFilePath: "content/inbox/draft.md", desktop: false },
  ];
  for (const options of cases) {
    const harness = await createPluginHarness(options);
    assert.equal(
      findCommand(harness, "inspect-current-draft-intent").checkCallback(true),
      false,
    );
    assert.equal(harness.spawned.length, 0);
    assert.equal(harness.modals.length, 0);
  }
});

test("removes one exact legacy slug atomically while preserving every other byte", async () => {
  const sourcePath = "content/inbox/original-draft.md";
  const content = legacyIdentityDraft({ lineEnding: "\r\n" });
  const expected = content.replace("slug: original-draft\r\n", "");
  const harness = await createPluginHarness({
    activeFilePath: sourcePath,
    fileContents: { [sourcePath]: content },
    files: [],
  });
  findCommand(harness, "inspect-current-inbox-draft-identity").checkCallback(false);
  await settleAsyncWork();

  const modal = harness.modals[0];
  const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
  assert.match(text, /LEGACY \/ MATCHED/u);
  assert.match(text, /original-draft.*original-draft/su);
  const cleanup = elementsByTag(modal, "button").find(
    (button) => button.text === "移除冗余 slug",
  );
  assert.ok(cleanup);
  await Promise.all([cleanup.trigger("click"), cleanup.trigger("click")]);

  assert.equal(harness.processAttempts.length, 1);
  assert.equal(harness.processAttempts[0].path, sourcePath);
  assert.equal(harness.processAttempts[0].input, content);
  assert.equal(harness.getContent(sourcePath), expected);
  assert.match(harness.getContent(sourcePath), /# 保留这条 frontmatter 注释\r\n/u);
  assert.match(harness.getContent(sourcePath), /# 正文\r\n/u);
  assert.doesNotMatch(harness.getContent(sourcePath), /^slug[ \t]*:/mu);
  assert.equal(modal.closed, true);
  assert.match(harness.notices.at(-1).message, /冗余 slug 已移除.*original-draft\.md/u);
});

test("holds ambiguous or conflicting draft identities without a cleanup action", async (t) => {
  const sourcePath = "content/inbox/original-draft.md";
  const cases = [
    ["mismatched slug", legacyIdentityDraft({ slugLine: "slug: another-draft" }), [], /不等于文件名/u],
    ["non-string slug", legacyIdentityDraft({ slugLine: "slug: 42" }), [], /文本/u],
    ["not a draft", legacyIdentityDraft({ draft: false }), [], /draft: true/u],
    ["invalid YAML", "---\ntitle: [\nslug: original-draft\ndraft: true\n---\n", [], /YAML/u],
    ["quoted slug key", legacyIdentityDraft({ slugLine: '"slug": original-draft' }), [], /格式/u],
    ["anchored slug", legacyIdentityDraft({ slugLine: "slug: &identity original-draft" }), [], /格式/u],
    ["indented slug", "---\nmeta:\n  slug: original-draft\ndraft: true\n---\n", [], /缩进/u],
    ["post collision", legacyIdentityDraft(), ["content/posts/original-draft.md"], /正式文章/u],
    ["project collision", legacyIdentityDraft(), ["content/projects/original-draft.md"], /项目/u],
  ];

  for (const [name, content, files, reason] of cases) {
    await t.test(name, async () => {
      const harness = await createPluginHarness({
        activeFilePath: sourcePath,
        fileContents: { [sourcePath]: content },
        files,
      });
      findCommand(harness, "inspect-current-inbox-draft-identity").checkCallback(false);
      await settleAsyncWork();
      const modal = harness.modals[0];
      const text = allElements(modal.contentEl).map((element) => element.text).join(" ");
      assert.match(text, /HOLD \/ CONFLICT/u);
      assert.match(text, reason);
      assert.equal(
        elementsByTag(modal, "button").some((button) => button.text === "移除冗余 slug"),
        false,
      );
      assert.deepEqual(harness.processAttempts, []);
    });
  }
});

test("offers draft identity inspection only for an exact desktop inbox Markdown path", async () => {
  const cases = [
    ["no active file", {}],
    ["formal content", { activeFilePath: "content/posts/published.md" }],
    ["unsafe source slug", { activeFilePath: "content/inbox/Unsafe Draft.md" }],
    ["non-Markdown", { activeFilePath: "content/inbox/draft.txt" }],
    ["mobile", { activeFilePath: "content/inbox/draft.md", desktop: false }],
  ];
  for (const [, options] of cases) {
    const harness = await createPluginHarness(options);
    const command = findCommand(harness, "inspect-current-inbox-draft-identity");
    assert.equal(command.checkCallback(true), false);
    assert.equal(harness.modals.length, 0);
    assert.equal(harness.processAttempts.length, 0);
  }
});

test("stops on cleanup drift and never retries an uncertain Vault process result", async () => {
  const sourcePath = "content/inbox/original-draft.md";
  const content = legacyIdentityDraft();
  const changed = content.replace('title: "旧草稿身份"', 'title: "检查后已变化"');
  const drifted = await createPluginHarness({
    activeFilePath: sourcePath,
    fileContents: { [sourcePath]: content },
    files: [],
    processMutation: changed,
  });
  findCommand(drifted, "inspect-current-inbox-draft-identity").checkCallback(false);
  await settleAsyncWork();
  const driftModal = drifted.modals[0];
  const driftCleanup = elementsByTag(driftModal, "button").find(
    (button) => button.text === "移除冗余 slug",
  );
  await driftCleanup.trigger("click");
  assert.equal(drifted.processAttempts.length, 1);
  assert.equal(drifted.getContent(sourcePath), changed);
  assert.equal(driftModal.closed, false);
  assert.match(
    allElements(driftModal.contentEl).find(
      (element) => element.classes.has("myblog-draft-identity__error"),
    ).text,
    /检查后已变化.*重新检查/u,
  );

  for (const options of [
    { processFailure: "host process rejected" },
    { processPostcondition: "unproven" },
  ]) {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      fileContents: { [sourcePath]: content },
      files: [],
      ...options,
    });
    findCommand(harness, "inspect-current-inbox-draft-identity").checkCallback(false);
    await settleAsyncWork();
    const modal = harness.modals[0];
    const cleanup = elementsByTag(modal, "button").find(
      (button) => button.text === "移除冗余 slug",
    );
    await cleanup.trigger("click");
    assert.equal(harness.processAttempts.length, 1);
    assert.equal(modal.closed, true);
    assert.match(
      harness.notices.at(-1).message,
      /清理结果不确定.*original-draft\.md.*不会自动重试/u,
    );
  }
});

test("serializes cleanup modals through one plugin-level lease", async () => {
  const sourcePath = "content/inbox/original-draft.md";
  const harness = await createPluginHarness({
    activeFilePath: sourcePath,
    fileContents: { [sourcePath]: legacyIdentityDraft() },
    files: [],
  });
  const command = findCommand(harness, "inspect-current-inbox-draft-identity");
  command.checkCallback(false);
  await settleAsyncWork();
  command.checkCallback(false);
  await settleAsyncWork();
  const [first, second] = harness.modals;
  const firstCleanup = elementsByTag(first, "button").find(
    (button) => button.text === "移除冗余 slug",
  );
  const secondCleanup = elementsByTag(second, "button").find(
    (button) => button.text === "移除冗余 slug",
  );
  await Promise.all([firstCleanup.trigger("click"), secondCleanup.trigger("click")]);
  assert.equal(harness.processAttempts.length, 1);
  assert.equal([first.closed, second.closed].filter(Boolean).length, 1);
  const waiting = first.closed ? second : first;
  assert.match(
    allElements(waiting.contentEl).find(
      (element) => element.classes.has("myblog-draft-identity__error"),
    ).text,
    /另一个草稿身份清理正在进行/u,
  );
});

test("renames one filename-owned inbox draft through FileManager", async () => {
  const sourcePath = "content/inbox/original-draft.md";
  const content = filenameOwnedDraft();
  const harness = await createPluginHarness({
    activeFilePath: sourcePath,
    fileContents: { [sourcePath]: content },
    files: [],
  });
  const command = findCommand(harness, "rename-current-inbox-draft");
  assert.equal(command.checkCallback(true), true);
  assert.equal(command.checkCallback(false), true);
  assert.equal(harness.modals.length, 1);
  assert.equal(harness.spawned.length, 0);

  const modal = harness.modals[0];
  assert.equal(modal.contentEl.classes.has("myblog-draft-rename"), true);
  assert.deepEqual(elementsByTag(modal, "h2").map((element) => element.text), [
    "重命名当前草稿",
  ]);
  assert.match(
    elementsByTag(modal, "p").map((element) => element.text).join(" "),
    /只改变 inbox 文件名.*按 Obsidian 设置更新内部链接.*不会发布、提交或联网/u,
  );
  assert.ok(
    elementsByTag(modal, "code").some((element) => element.text === sourcePath),
  );

  const [slug] = elementsByTag(modal, "input");
  assert.equal(slug.value, "original-draft");
  assert.equal(slug.focused, true);
  slug.value = "renamed-draft";
  await slug.trigger("input");
  assert.ok(
    elementsByTag(modal, "code").some((element) => element.text === "renamed-draft"),
  );
  const submit = elementsByTag(modal, "button").find(
    (button) => button.text === "重命名草稿",
  );
  await Promise.all([submit.trigger("click"), submit.trigger("click")]);

  assert.deepEqual(
    harness.renameAttempts.map(({ newPath, sourcePath: source }) => ({ newPath, source })),
    [{ newPath: "content/inbox/renamed-draft.md", source: sourcePath }],
  );
  assert.equal(harness.getFile(sourcePath), null);
  assert.equal(harness.getFile("content/inbox/renamed-draft.md")?.path, "content/inbox/renamed-draft.md");
  assert.equal(harness.getContent("content/inbox/renamed-draft.md"), content);
  assert.deepEqual(harness.vaultReads, [sourcePath]);
  assert.equal(modal.closed, true);
  assert.match(harness.notices.at(-1).message, /草稿已重命名.*renamed-draft\.md/u);
  assert.equal(harness.spawned.length, 0);
});

test("offers draft rename only for an exact desktop inbox Markdown path", async () => {
  const cases = [
    ["no active file", {}],
    ["formal content", { activeFilePath: "content/posts/published.md" }],
    ["unsafe source slug", { activeFilePath: "content/inbox/Unsafe Draft.md" }],
    ["non-Markdown", { activeFilePath: "content/inbox/draft.txt" }],
    ["mobile", { activeFilePath: "content/inbox/draft.md", desktop: false }],
  ];
  for (const [, options] of cases) {
    const harness = await createPluginHarness(options);
    const command = findCommand(harness, "rename-current-inbox-draft");
    assert.equal(command.checkCallback(true), false);
    assert.equal(harness.modals.length, 0);
    assert.equal(harness.renameAttempts.length, 0);
  }
});

test("rejects rename input and namespace collisions before reading the draft", async (t) => {
  const sourcePath = "content/inbox/original-draft.md";
  const cases = [
    ["unchanged", "original-draft", [], /不同/u],
    ["uppercase", "Unsafe", [], /slug/u],
    ["path", "../unsafe", [], /slug/u],
    ["too long", "a".repeat(81), [], /80/u],
    ["inbox collision", "target", ["content/inbox/target.md"], /已存在/u],
    ["post collision", "target", ["content/posts/target.md"], /已存在/u],
    ["project collision", "target", ["content/projects/target.md"], /已存在/u],
  ];
  for (const [name, targetSlug, extraFiles, expected] of cases) {
    await t.test(name, async () => {
      const harness = await createPluginHarness({
        activeFilePath: sourcePath,
        fileContents: { [sourcePath]: filenameOwnedDraft() },
        files: extraFiles,
      });
      await assert.rejects(
        harness.plugin.renameInboxDraft({ sourcePath, targetSlug }),
        expected,
      );
      assert.deepEqual(harness.vaultReads, []);
      assert.deepEqual(harness.renameAttempts, []);
      assert.ok(harness.getFile(sourcePath));
    });
  }
});

test("fails closed for a non-draft, invalid frontmatter, or legacy dual slug", async (t) => {
  const sourcePath = "content/inbox/original-draft.md";
  const cases = [
    ["missing frontmatter", "# Draft\n", /frontmatter/u],
    ["invalid YAML", "---\ntitle: [\ndraft: true\n---\n", /YAML/u],
    ["published", filenameOwnedDraft({ draft: false }), /draft: true/u],
    ["legacy slug", filenameOwnedDraft({ slugLine: "slug: original-draft\n" }), /旧式.*slug/u],
  ];
  for (const [name, content, expected] of cases) {
    await t.test(name, async () => {
      const harness = await createPluginHarness({
        activeFilePath: sourcePath,
        fileContents: { [sourcePath]: content },
        files: [],
      });
      await assert.rejects(
        harness.plugin.renameInboxDraft({ sourcePath, targetSlug: "renamed-draft" }),
        expected,
      );
      assert.deepEqual(harness.vaultReads, [sourcePath]);
      assert.deepEqual(harness.renameAttempts, []);
      assert.ok(harness.getFile(sourcePath));
    });
  }
});

test("serializes rename modals and never retries an uncertain FileManager result", async () => {
  const sourcePath = "content/inbox/original-draft.md";
  const shared = await createPluginHarness({
    activeFilePath: sourcePath,
    fileContents: { [sourcePath]: filenameOwnedDraft() },
    files: [],
  });
  const command = findCommand(shared, "rename-current-inbox-draft");
  command.checkCallback(false);
  command.checkCallback(false);
  const [first, second] = shared.modals;
  elementsByTag(first, "input")[0].value = "first-target";
  elementsByTag(second, "input")[0].value = "second-target";
  const firstSubmit = elementsByTag(first, "button").find(
    (button) => button.text === "重命名草稿",
  );
  const secondSubmit = elementsByTag(second, "button").find(
    (button) => button.text === "重命名草稿",
  );
  await Promise.all([firstSubmit.trigger("click"), secondSubmit.trigger("click")]);
  assert.equal(shared.renameAttempts.length, 1);
  assert.equal([first.closed, second.closed].filter(Boolean).length, 1);
  const waitingModal = first.closed ? second : first;
  const waitingError = allElements(waitingModal.contentEl).find(
    (element) => element.classes.has("myblog-draft-rename__error"),
  );
  assert.match(waitingError.text, /另一个草稿改名正在进行/u);

  for (const options of [
    { renameFailure: "host rename rejected" },
    { renamePostcondition: "unproven" },
  ]) {
    const harness = await createPluginHarness({
      activeFilePath: sourcePath,
      fileContents: { [sourcePath]: filenameOwnedDraft() },
      files: [],
      ...options,
    });
    findCommand(harness, "rename-current-inbox-draft").checkCallback(false);
    const modal = harness.modals[0];
    elementsByTag(modal, "input")[0].value = "uncertain-target";
    const submit = elementsByTag(modal, "button").find(
      (button) => button.text === "重命名草稿",
    );
    await submit.trigger("click");
    assert.equal(harness.renameAttempts.length, 1);
    assert.equal(modal.closed, true);
    assert.match(
      harness.notices.at(-1).message,
      /改名结果不确定.*original-draft\.md.*uncertain-target\.md.*不会自动重试/su,
    );
  }
});

test("renders a versioned maintenance ledger and opens an exact Vault note", async () => {
  const [manifestSource, styles, harness] = await Promise.all([
    readFile(manifestUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
    createPluginHarness(),
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.version, "1.33.0");
  assert.equal(manifest.minAppVersion, "1.5.7");
  assert.equal(manifest.isDesktopOnly, true);
  assert.match(styles, /^\.myblog-draft-create \{/mu);
  assert.match(styles, /myblog-draft-create__error:empty/u);
  assert.match(styles, /^\.myblog-draft-rename \{/mu);
  assert.match(styles, /myblog-draft-rename__transition/u);
  assert.match(styles, /myblog-draft-rename__error:empty/u);
  assert.match(styles, /^\.myblog-draft-identity \{/mu);
  assert.match(styles, /myblog-draft-identity__signature/u);
  assert.match(styles, /myblog-draft-identity__evidence/u);
  assert.match(styles, /myblog-draft-identity__error:empty/u);
  assert.match(styles, /^\.myblog-draft-intent \{/mu);
  assert.match(styles, /myblog-draft-intent__signature/u);
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
