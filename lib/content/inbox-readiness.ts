import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import {
  type ObsidianContentKind,
  type ObsidianLinkTarget,
  type PreparedAttachment,
  type PreparedInternalLink,
  prepareObsidianNote,
} from "../obsidian-publishing.ts";
import {
  type MediaPreparation,
  formatMediaPreparation,
  prepareMediaForPublishing,
} from "../media-policy.ts";
import { parsePostFile, parseProjectFile } from "./contract.ts";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const INBOX_SOURCE_PREFIX = "content/inbox/";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const INBOX_READINESS_REPORT_VERSION = 6 as const;

export const INBOX_READINESS_STATES = ["blocked", "scheduled", "ready"] as const;
export type InboxReadinessState = (typeof INBOX_READINESS_STATES)[number];

export type InboxReadinessIssueCode =
  | "attachment-invalid"
  | "attachment-alt-empty"
  | "attachment-alt-filename-fallback"
  | "attachment-missing"
  | "attachment-shared"
  | "attachment-target-exists"
  | "attachment-tracked"
  | "draft-invalid"
  | "draft-symlink"
  | "target-exists";

export type InboxReadinessIssue = {
  code: InboxReadinessIssueCode;
  message: string;
  path?: string;
};

export type InboxReadinessAttachment = PreparedAttachment & {
  preparation?: MediaPreparation;
};

export type InboxReadinessEntry = {
  attachments: InboxReadinessAttachment[];
  contentType?: "article" | "project" | "til";
  draftState: "disabled" | "draft" | "unknown";
  internalLinkCount: number;
  internalLinks: PreparedInternalLink[];
  issues: InboxReadinessIssue[];
  kind?: ObsidianContentKind;
  publishedAt?: string;
  slug?: string;
  sourceSha256: string | null;
  sourcePath: string;
  state: InboxReadinessState;
  targetPath?: string;
};

export type InboxReadinessReport = {
  version: typeof INBOX_READINESS_REPORT_VERSION;
  mode: "read-only";
  counts: {
    attachments: number;
    blocked: number;
    drafts: number;
    issues: number;
    ready: number;
    scheduled: number;
  };
  entries: InboxReadinessEntry[];
  reportDate: string;
  safety: {
    authorFilesChanged: false;
    commitCreated: false;
    networkChecked: false;
    pushExecuted: false;
  };
};

export type InboxReadinessOptions = {
  mediaPreparer?: typeof prepareMediaForPublishing;
  sourcePath?: string;
  stagingParent?: string;
};

function isIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function normalizePath(value: string) {
  return value.replaceAll("\\", "/");
}

function normalizeScopedSourcePath(value: string) {
  const normalized = normalizePath(value);
  const fileName = normalized.startsWith(INBOX_SOURCE_PREFIX)
    ? normalized.slice(INBOX_SOURCE_PREFIX.length)
    : "";
  const slug = fileName.endsWith(".md") ? fileName.slice(0, -3) : "";
  if (!fileName || fileName.includes("/") || !SLUG_PATTERN.test(slug)) {
    throw new Error(
      `聚焦来源必须是安全的 content/inbox/<slug>.md 路径，收到：${value}`,
    );
  }
  return normalized;
}

async function pathExists(value: string) {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function contentLinkTargets(projectRoot: string): Promise<ObsidianLinkTarget[]> {
  const targets: ObsidianLinkTarget[] = [];
  for (const [kind, directory] of [
    ["post", "posts"],
    ["project", "projects"],
  ] as const) {
    const entries = await readdir(join(projectRoot, "content", directory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        targets.push({
          body: await readFile(join(projectRoot, "content", directory, entry.name), "utf8"),
          kind,
          slug: entry.name.slice(0, -3),
        });
      }
    }
  }
  return targets.sort((left, right) =>
    `${left.kind}/${left.slug}`.localeCompare(`${right.kind}/${right.slug}`, "en"),
  );
}

function trackedUploadPaths(projectRoot: string) {
  const result = spawnSync("git", ["ls-files", "-z", "--", "public/uploads"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `无法读取 Git 附件清单：${result.stderr.trim() || `退出码 ${result.status}`}`,
    );
  }
  return new Set(
    result.stdout
      .split("\0")
      .filter(Boolean)
      .map(normalizePath),
  );
}

function draftState(raw: string): InboxReadinessEntry["draftState"] {
  const matches = [...raw.matchAll(/^draft:\s*(true|false)\s*$/gmu)];
  if (matches.length !== 1) return "unknown";
  return matches[0][1] === "true" ? "draft" : "disabled";
}

function addIssue(
  entry: InboxReadinessEntry,
  code: InboxReadinessIssueCode,
  message: string,
  path?: string,
) {
  if (entry.issues.some((issue) => issue.code === code && issue.path === path)) return;
  entry.issues.push({ code, message, ...(path ? { path } : {}) });
}

function blockedEntry(sourcePath: string): InboxReadinessEntry {
  const fileName = sourcePath.split("/").at(-1) ?? "";
  const candidateSlug = fileName.endsWith(".md") ? fileName.slice(0, -3) : "";
  return {
    attachments: [],
    draftState: "unknown",
    internalLinkCount: 0,
    internalLinks: [],
    issues: [],
    ...(SLUG_PATTERN.test(candidateSlug) ? { slug: candidateSlug } : {}),
    sourceSha256: null,
    sourcePath,
    state: "blocked",
  };
}

async function inspectDraft(
  projectRoot: string,
  sourcePath: string,
  linkTargets: ObsidianLinkTarget[],
  trackedUploads: ReadonlySet<string>,
  stagingDirectory: string,
  draftIndex: number,
  reportDate: string,
  deriveMedia: boolean,
  mediaPreparer: typeof prepareMediaForPublishing,
) {
  const entry = blockedEntry(sourcePath);
  let raw: string;
  try {
    const sourceBytes = await readFile(resolve(projectRoot, sourcePath));
    entry.sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
    raw = sourceBytes.toString("utf8");
  } catch (error) {
    addIssue(
      entry,
      "draft-invalid",
      `草稿无法读取：${error instanceof Error ? error.message : String(error)}`,
      sourcePath,
    );
    return entry;
  }
  entry.draftState = draftState(raw);

  let prepared;
  try {
    prepared = prepareObsidianNote(sourcePath, raw, undefined, linkTargets);
  } catch (error) {
    addIssue(
      entry,
      "draft-invalid",
      error instanceof Error ? error.message : String(error),
      sourcePath,
    );
    return entry;
  }

  entry.kind = prepared.kind;
  entry.slug = prepared.slug;
  entry.targetPath = prepared.targetPath;
  entry.attachments = prepared.attachments.map((attachment) => ({ ...attachment }));
  entry.internalLinkCount = prepared.internalLinkCount;
  entry.internalLinks = prepared.internalLinks;
  if (prepared.kind === "post") {
    const record = parsePostFile(prepared.targetPath, prepared.content);
    entry.publishedAt = record.publishedAt;
    entry.contentType = record.type;
  } else {
    const record = parseProjectFile(prepared.targetPath, prepared.content);
    entry.publishedAt = record.publishedAt;
    entry.contentType = "project";
  }

  for (const attachment of entry.attachments) {
    const emptyAlternativeTextLocations = attachment.usages.flatMap((usage) =>
      usage.altTexts.flatMap((altText, index) =>
        altText.trim()
          ? []
          : [`${usage.role.toUpperCase()} L${usage.sourceLines[index]}`],
      ),
    );
    if (emptyAlternativeTextLocations.length > 0) {
      addIssue(
        entry,
        "attachment-alt-empty",
        `附件替代文本为空：${emptyAlternativeTextLocations.join("、")}；请描述图片传达的信息`,
        attachment.sourcePath,
      );
    }
    const filenameFallbackLocations = attachment.usages.flatMap((usage) =>
      usage.altSources.flatMap((altSource, index) =>
        altSource === "filename-fallback"
          ? [`${usage.role.toUpperCase()} L${usage.sourceLines[index]}`]
          : [],
      ),
    );
    if (filenameFallbackLocations.length > 0) {
      addIssue(
        entry,
        "attachment-alt-filename-fallback",
        `附件替代文本来自文件名回退：${filenameFallbackLocations.join("、")}；请在 Markdown alt 或 Wiki display 中填写图片描述`,
        attachment.sourcePath,
      );
    }
  }

  if (await pathExists(resolve(projectRoot, prepared.targetPath))) {
    addIssue(
      entry,
      "target-exists",
      `正式内容目标已存在：${prepared.targetPath}`,
      prepared.targetPath,
    );
  }

  for (const [attachmentIndex, attachment] of entry.attachments.entries()) {
    const absoluteSource = resolve(projectRoot, attachment.sourcePath);
    if (!(await pathExists(absoluteSource))) {
      addIssue(
        entry,
        "attachment-missing",
        `正文引用的附件不存在：${attachment.sourcePath}`,
        attachment.sourcePath,
      );
      continue;
    }

    if (
      attachment.sourcePath !== attachment.targetPath &&
      await pathExists(resolve(projectRoot, attachment.targetPath))
    ) {
      addIssue(
        entry,
        "attachment-target-exists",
        `附件目标已存在：${attachment.targetPath}`,
        attachment.targetPath,
      );
    }
    if (
      attachment.sourcePath !== attachment.targetPath &&
      trackedUploads.has(attachment.sourcePath)
    ) {
      addIssue(
        entry,
        "attachment-tracked",
        `附件已被 Git 跟踪，发布器会拒绝移动：${attachment.sourcePath}`,
        attachment.sourcePath,
      );
    }

    if (!deriveMedia) continue;

    const stagedPath = join(
      stagingDirectory,
      String(draftIndex),
      String(attachmentIndex),
      basename(attachment.targetPath),
    );
    await mkdir(join(stagingDirectory, String(draftIndex), String(attachmentIndex)), {
      recursive: true,
    });
    try {
      attachment.preparation = await mediaPreparer(
        absoluteSource,
        stagedPath,
        attachment.sourcePath,
        attachment.targetPath,
      );
    } catch (error) {
      addIssue(
        entry,
        "attachment-invalid",
        error instanceof Error ? error.message : String(error),
        attachment.sourcePath,
      );
    }
  }

  entry.state = entry.issues.length > 0
    ? "blocked"
    : entry.publishedAt > reportDate
      ? "scheduled"
      : "ready";
  return entry;
}

function applySharedAttachmentIssues(entries: InboxReadinessEntry[]) {
  const owners = new Map<string, InboxReadinessEntry[]>();
  for (const entry of entries) {
    for (const attachment of entry.attachments) {
      const current = owners.get(attachment.sourcePath) ?? [];
      current.push(entry);
      owners.set(attachment.sourcePath, current);
    }
  }

  for (const [sourcePath, drafts] of owners) {
    if (drafts.length < 2) continue;
    const draftPaths = drafts.map((entry) => entry.sourcePath).sort((left, right) =>
      left.localeCompare(right, "en"),
    );
    for (const entry of drafts) {
      addIssue(
        entry,
        "attachment-shared",
        `附件被多个草稿共享；发布任一草稿后其他草稿会缺失：${draftPaths.join("、")}`,
        sourcePath,
      );
      entry.state = "blocked";
    }
  }
}

function createReport(entries: InboxReadinessEntry[], reportDate: string) {
  const order = new Map<InboxReadinessState, number>([
    ["blocked", 0],
    ["scheduled", 1],
    ["ready", 2],
  ]);
  const sorted = entries.sort((left, right) =>
    (order.get(left.state) ?? 9) - (order.get(right.state) ?? 9) ||
    left.sourcePath.localeCompare(right.sourcePath, "en"),
  );
  return {
    version: INBOX_READINESS_REPORT_VERSION,
    mode: "read-only",
    counts: {
      attachments: sorted.reduce((total, entry) => total + entry.attachments.length, 0),
      blocked: sorted.filter((entry) => entry.state === "blocked").length,
      drafts: sorted.length,
      issues: sorted.reduce((total, entry) => total + entry.issues.length, 0),
      ready: sorted.filter((entry) => entry.state === "ready").length,
      scheduled: sorted.filter((entry) => entry.state === "scheduled").length,
    },
    entries: sorted,
    reportDate,
    safety: {
      authorFilesChanged: false,
      commitCreated: false,
      networkChecked: false,
      pushExecuted: false,
    },
  } satisfies InboxReadinessReport;
}

export async function inspectInboxReadiness(
  projectRoot: string,
  reportDate: string,
  options: InboxReadinessOptions = {},
): Promise<InboxReadinessReport> {
  if (!isIsoDate(reportDate)) {
    throw new Error(`报告日期必须是有效的 YYYY-MM-DD，收到：${reportDate}`);
  }
  const scopedSourcePath = options.sourcePath === undefined
    ? undefined
    : normalizeScopedSourcePath(options.sourcePath);
  const inboxDirectory = join(projectRoot, "content", "inbox");
  const draftDirents = (await readdir(inboxDirectory, { withFileTypes: true }))
    .filter((entry) => entry.name !== "README.md" && entry.name.endsWith(".md"))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  if (draftDirents.length === 0) {
    if (scopedSourcePath) {
      throw new Error(`目标草稿不存在：${scopedSourcePath}`);
    }
    return createReport([], reportDate);
  }

  const [linkTargets, trackedUploads] = await Promise.all([
    contentLinkTargets(projectRoot),
    Promise.resolve(trackedUploadPaths(projectRoot)),
  ]);
  const stagingParent = options.stagingParent ?? tmpdir();
  await mkdir(stagingParent, { recursive: true });
  const stagingDirectory = await mkdtemp(join(stagingParent, "myblog-inbox-readiness-"));
  try {
    const entries: InboxReadinessEntry[] = [];
    for (const [index, draftDirent] of draftDirents.entries()) {
      const sourcePath = `content/inbox/${draftDirent.name}`;
      if (draftDirent.isSymbolicLink()) {
        const entry = blockedEntry(sourcePath);
        addIssue(
          entry,
          "draft-symlink",
          "收件箱草稿不能是符号链接",
          sourcePath,
        );
        entries.push(entry);
        continue;
      }
      if (!draftDirent.isFile()) continue;
      entries.push(
        await inspectDraft(
          projectRoot,
          sourcePath,
          linkTargets,
          trackedUploads,
          stagingDirectory,
          index,
          reportDate,
          scopedSourcePath === undefined || scopedSourcePath === sourcePath,
          options.mediaPreparer ?? prepareMediaForPublishing,
        ),
      );
    }
    applySharedAttachmentIssues(entries);
    if (scopedSourcePath) {
      const scopedEntries = entries.filter((entry) => entry.sourcePath === scopedSourcePath);
      if (scopedEntries.length !== 1) {
        throw new Error(`目标草稿不存在：${scopedSourcePath}`);
      }
      return createReport(scopedEntries, reportDate);
    }
    return createReport(entries, reportDate);
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true });
  }
}

const STATE_LABELS: Record<InboxReadinessState, string> = {
  blocked: "BLOCKED",
  ready: "READY",
  scheduled: "SCHEDULED",
};

export function formatInboxReadinessText(report: InboxReadinessReport) {
  const lines = [
    `[inbox] 报告日期：${report.reportDate}`,
    `[inbox] 草稿 ${report.counts.drafts} · ready ${report.counts.ready} · scheduled ${report.counts.scheduled} · blocked ${report.counts.blocked} · 附件 ${report.counts.attachments} · 问题 ${report.counts.issues}`,
  ];
  if (report.entries.length === 0) {
    lines.push("[inbox] 收件箱没有可检查的 Markdown 草稿。");
  }
  for (const entry of report.entries) {
    const identity = [
      entry.contentType === "article"
        ? "技术文章"
        : entry.contentType === "til"
          ? "今日所学"
          : entry.contentType === "project"
            ? "项目"
            : "类型未知",
      entry.draftState === "draft"
        ? "draft=true"
        : entry.draftState === "disabled"
          ? "draft=false"
          : "draft 未知",
      entry.publishedAt ? `公开日 ${entry.publishedAt}` : "公开日未知",
      `站内链接 ${entry.internalLinkCount}`,
    ].join(" · ");
    lines.push(
      `[inbox] ${STATE_LABELS[entry.state]} · ${entry.sourcePath}${entry.targetPath ? ` -> ${entry.targetPath}` : ""} · ${identity} · SOURCE SHA-256 ${entry.sourceSha256?.slice(0, 12) ?? "UNAVAILABLE"}`,
    );
    for (const attachment of entry.attachments) {
      lines.push(
        `[inbox]   附件 ${attachment.sourcePath} -> ${attachment.targetPath}${attachment.preparation ? ` · ${formatMediaPreparation(attachment.preparation)}` : " · 未完成媒体派生"}`,
      );
      for (const usage of attachment.usages) {
        lines.push(
          `[inbox]   附件来源 [${usage.role}] ${usage.sourceLines.map((line) => `L${line}`).join(", ")}${usage.occurrences > 1 ? ` · ×${usage.occurrences}` : ""}`,
        );
        for (const [index, altText] of usage.altTexts.entries()) {
          const altSource = usage.altSources[index];
          const sourceLabel = altSource === "authored" ? "AUTHORED" : "FILENAME FALLBACK";
          const value = altText.trim()
            ? `${JSON.stringify(altText)}${altSource === "filename-fallback" ? " · WILL FAIL" : ""}`
            : "EMPTY · WILL FAIL";
          lines.push(
            `[inbox]   附件替代文本 [${usage.role}] L${usage.sourceLines[index]} · ${sourceLabel} · ${value}`,
          );
        }
      }
    }
    for (const link of entry.internalLinks) {
      lines.push(
        `[inbox]   站内链接 [${link.kind}] ${link.sourceLines.map((line) => `L${line}`).join(", ")} -> ${link.target}${link.occurrences > 1 ? ` · ×${link.occurrences}` : ""}`,
      );
    }
    for (const issue of entry.issues) {
      lines.push(`[inbox]   阻塞 [${issue.code}] ${issue.message}`);
    }
  }
  lines.push("[inbox] 报告只读取草稿与附件；不会移动、改写、提交或推送任何作者文件。");
  return lines.join("\n");
}
