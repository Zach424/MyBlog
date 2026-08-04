import { spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { listMediaRepositoryFiles } from "../../build/validate-media.ts";
import { resolveContentBuildDate } from "../../build/content-build-date.ts";
import { inspectObsidianAttachmentPaths } from "../obsidian-publishing.ts";

export const STAGING_MEDIA_STALE_DAYS = 30;

export const STAGING_MEDIA_STATUSES = [
  "shared",
  "unreferenced",
  "referenced",
] as const;

export type StagingMediaStatus = (typeof STAGING_MEDIA_STATUSES)[number];
export type StagingMediaGitState =
  | "clean"
  | "modified"
  | "staged"
  | "staged-and-modified"
  | "untracked";
export type StagingMediaAgeSource = "filesystem" | "git";

export type StagingMediaEvidence = {
  ageDays: number;
  ageSource: StagingMediaAgeSource;
  gitState: StagingMediaGitState;
  lastChangedAt: string;
  lastGitChangedAt?: string;
};

export type StagingMediaFileInput = {
  bytes: number;
  evidence: StagingMediaEvidence;
  path: string;
};

export type StagingMediaReferenceInput = {
  draftPath: string;
  mediaPath: string;
};

export type StagingMediaEntry = StagingMediaFileInput & {
  draftSources: string[];
  recommendation: string;
  stale: boolean;
  status: StagingMediaStatus;
};

export type StagingMediaDraftIssue = {
  draftPath: string;
  message: string;
};

export type StagingMediaMissingReference = {
  draftSources: string[];
  path: string;
};

export type StagingMediaReport = {
  counts: {
    attention: number;
    files: number;
    invalidDrafts: number;
    missing: number;
    referenced: number;
    shared: number;
    stale: number;
    unreferenced: number;
  };
  draftIssues: StagingMediaDraftIssue[];
  entries: StagingMediaEntry[];
  missingReferences: StagingMediaMissingReference[];
  reportDate: string;
  staleAfterDays: number;
  totalBytes: number;
};

type StagingMediaReportOptions = {
  draftIssues?: StagingMediaDraftIssue[];
  staleAfterDays?: number;
};

const STATUS_ORDER: Record<StagingMediaStatus, number> = {
  shared: 0,
  unreferenced: 1,
  referenced: 2,
};

const STATUS_LABELS: Record<StagingMediaStatus, string> = {
  referenced: "草稿引用",
  shared: "多草稿共享",
  unreferenced: "未引用",
};

function ageDays(fromDate: string, reportDate: string) {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const report = Date.parse(`${reportDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(report)) {
    throw new Error(`暂存媒体报告日期无效：${fromDate} / ${reportDate}`);
  }
  return Math.max(0, Math.floor((report - from) / 86_400_000));
}

function recommendation(
  status: StagingMediaStatus,
  draftSources: string[],
  stale: boolean,
  age: number,
) {
  if (status === "shared") {
    return "被多个 inbox 草稿引用；发布前复制为各自独立文件，避免附件所有权冲突。";
  }
  if (status === "unreferenced") {
    return "没有 inbox 草稿引用；确认不再需要后手动删除，报告不会自动清理。";
  }
  if (stale) {
    return `仍被草稿引用但已 ${age} 天未变化；确认该草稿是否仍在推进。`;
  }
  return `由 ${draftSources[0]} 使用；无需清理。`;
}

export function createStagingMediaReport(
  files: StagingMediaFileInput[],
  references: StagingMediaReferenceInput[],
  reportDate: string,
  options: StagingMediaReportOptions = {},
): StagingMediaReport {
  const staleAfterDays = options.staleAfterDays ?? STAGING_MEDIA_STALE_DAYS;
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1) {
    throw new Error("暂存媒体陈旧阈值必须是大于 0 的整数天数");
  }

  const filePaths = new Set(files.map((file) => file.path));
  if (filePaths.size !== files.length) {
    throw new Error("暂存媒体库存包含重复路径");
  }

  const draftsByMedia = new Map<string, Set<string>>();
  for (const reference of references) {
    const drafts = draftsByMedia.get(reference.mediaPath) ?? new Set<string>();
    drafts.add(reference.draftPath);
    draftsByMedia.set(reference.mediaPath, drafts);
  }

  const entries = files
    .map<StagingMediaEntry>((file) => {
      const draftSources = [...(draftsByMedia.get(file.path) ?? [])].sort((left, right) =>
        left.localeCompare(right, "en"),
      );
      const status: StagingMediaStatus = draftSources.length > 1
        ? "shared"
        : draftSources.length === 1
          ? "referenced"
          : "unreferenced";
      const stale = file.evidence.ageDays >= staleAfterDays;
      return {
        ...file,
        draftSources,
        recommendation: recommendation(
          status,
          draftSources,
          stale,
          file.evidence.ageDays,
        ),
        stale,
        status,
      };
    })
    .sort(
      (left, right) =>
        STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
        Number(right.stale) - Number(left.stale) ||
        right.evidence.ageDays - left.evidence.ageDays ||
        left.path.localeCompare(right.path, "en"),
    );

  const missingReferences = [...draftsByMedia.entries()]
    .filter(([mediaPath]) => !filePaths.has(mediaPath))
    .map<StagingMediaMissingReference>(([mediaPath, draftSources]) => ({
      draftSources: [...draftSources].sort((left, right) => left.localeCompare(right, "en")),
      path: mediaPath,
    }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  const draftIssues = [...(options.draftIssues ?? [])].sort((left, right) =>
    left.draftPath.localeCompare(right.draftPath, "en"),
  );
  const invalidDrafts = new Set(draftIssues.map((issue) => issue.draftPath)).size;
  const counts = {
    attention: entries.filter(
      (entry) => entry.status !== "referenced" || entry.stale,
    ).length + missingReferences.length + invalidDrafts,
    files: entries.length,
    invalidDrafts,
    missing: missingReferences.length,
    referenced: entries.filter((entry) => entry.status === "referenced").length,
    shared: entries.filter((entry) => entry.status === "shared").length,
    stale: entries.filter((entry) => entry.stale).length,
    unreferenced: entries.filter((entry) => entry.status === "unreferenced").length,
  };

  return {
    counts,
    draftIssues,
    entries,
    missingReferences,
    reportDate,
    staleAfterDays,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
  };
}

function runGit(projectRoot: string, args: string[], allowFailure = false) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} 失败：${result.stderr.trim()}`);
  }
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
  };
}

function gitState(projectRoot: string, sourcePath: string): StagingMediaGitState {
  const tracked = runGit(
    projectRoot,
    ["ls-files", "--error-unmatch", "--", sourcePath],
    true,
  ).ok;
  if (!tracked) return "untracked";

  const porcelain = runGit(projectRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    sourcePath,
  ]).stdout;
  if (!porcelain) return "clean";
  const indexChanged = porcelain[0] !== " ";
  const worktreeChanged = porcelain[1] !== " ";
  if (indexChanged && worktreeChanged) return "staged-and-modified";
  if (indexChanged) return "staged";
  return "modified";
}

async function fileEvidence(
  projectRoot: string,
  sourcePath: string,
  reportDate: string,
): Promise<StagingMediaEvidence> {
  const state = gitState(projectRoot, sourcePath);
  const lastGitChangedAt = runGit(projectRoot, [
    "log",
    "-1",
    "--format=%cs",
    "--",
    sourcePath,
  ]).stdout || undefined;
  const fileStats = await stat(path.join(projectRoot, ...sourcePath.split("/")));
  const filesystemDate = resolveContentBuildDate(fileStats.mtime);
  const ageSource: StagingMediaAgeSource = state === "clean" && lastGitChangedAt
    ? "git"
    : "filesystem";
  const lastChangedAt = ageSource === "git"
    ? (lastGitChangedAt ?? filesystemDate)
    : filesystemDate;
  return {
    ageDays: ageDays(lastChangedAt, reportDate),
    ageSource,
    gitState: state,
    lastChangedAt,
    ...(lastGitChangedAt ? { lastGitChangedAt } : {}),
  };
}

async function inspectInboxReferences(projectRoot: string) {
  const inboxDirectory = path.join(projectRoot, "content", "inbox");
  let entries;
  try {
    entries = await readdir(inboxDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { draftIssues: [], references: [] };
    }
    throw error;
  }

  const references: StagingMediaReferenceInput[] = [];
  const draftIssues: StagingMediaDraftIssue[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "README.md") continue;
    const draftPath = `content/inbox/${entry.name}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(entry.name)) {
      draftIssues.push({
        draftPath,
        message: "草稿文件名不是可发布的小写 ASCII slug",
      });
      continue;
    }
    try {
      const markdown = await readFile(path.join(inboxDirectory, entry.name), "utf8");
      const inspection = inspectObsidianAttachmentPaths(markdown);
      for (const mediaPath of inspection.paths) {
        const relative = mediaPath.slice("public/uploads/".length);
        if (!relative.includes("/")) references.push({ draftPath, mediaPath });
      }
      for (const message of inspection.issues) {
        draftIssues.push({ draftPath, message });
      }
    } catch (error) {
      draftIssues.push({
        draftPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { draftIssues, references };
}

export async function inspectStagingMediaRepository(
  projectRoot: string,
  reportDate: string,
  options: Pick<StagingMediaReportOptions, "staleAfterDays"> = {},
) {
  const mediaPaths = (await listMediaRepositoryFiles(projectRoot)).filter((sourcePath) =>
    !sourcePath.slice("public/uploads/".length).includes("/"),
  );
  const [files, inbox] = await Promise.all([
    Promise.all(
      mediaPaths.map(async (sourcePath) => {
        const absolutePath = path.join(projectRoot, ...sourcePath.split("/"));
        const [fileStats, evidence] = await Promise.all([
          stat(absolutePath),
          fileEvidence(projectRoot, sourcePath, reportDate),
        ]);
        return { bytes: fileStats.size, evidence, path: sourcePath };
      }),
    ),
    inspectInboxReferences(projectRoot),
  ]);
  return createStagingMediaReport(files, inbox.references, reportDate, {
    ...options,
    draftIssues: inbox.draftIssues,
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function ageLabel(entry: StagingMediaEntry) {
  const source = entry.evidence.ageSource === "git" ? "Git" : "filesystem";
  return `${entry.evidence.lastChangedAt} · ${entry.evidence.ageDays} 天 · ${source}`;
}

export function formatStagingMediaText(report: StagingMediaReport) {
  const lines = [
    `[staging] 报告日期：${report.reportDate} · 陈旧阈值：${report.staleAfterDays} 天`,
    `[staging] 根暂存 ${report.counts.files} 个 / ${formatBytes(report.totalBytes)} · 草稿引用 ${report.counts.referenced} · 共享 ${report.counts.shared} · 未引用 ${report.counts.unreferenced} · 陈旧 ${report.counts.stale} · 缺失 ${report.counts.missing}`,
  ];
  if (report.entries.length === 0) lines.push("[staging] 根 public/uploads 暂存区为空。");
  for (const entry of report.entries) {
    const drafts = entry.draftSources.length ? entry.draftSources.join(", ") : "无";
    lines.push(
      `[staging] ${STATUS_LABELS[entry.status]}${entry.stale ? " / 陈旧" : ""} · ${entry.path} · ${formatBytes(entry.bytes)} · ${ageLabel(entry)} · Git ${entry.evidence.gitState} · drafts ${drafts}`,
    );
    lines.push(`[staging] 建议：${entry.recommendation}`);
  }
  for (const missing of report.missingReferences) {
    lines.push(
      `[staging] 缺失引用 · ${missing.path} · drafts ${missing.draftSources.join(", ")} · 请恢复文件或移除草稿引用。`,
    );
  }
  for (const issue of report.draftIssues) {
    lines.push(`[staging] 草稿无法审计 · ${issue.draftPath} · ${issue.message}`);
  }
  lines.push("[staging] 报告只提供证据与建议，不会自动删除文件。");
  return lines.join("\n");
}

function escapeTableCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function formatStagingMediaMarkdown(report: StagingMediaReport) {
  const lines = [
    "## Staging media inventory",
    "",
    `报告日期：\`${report.reportDate}\` · 陈旧阈值：${report.staleAfterDays} 天 · 文件：${report.counts.files} · 体积：${formatBytes(report.totalBytes)} · 需关注：${report.counts.attention}`,
    "",
    "| 状态 | 文件 | 体积 | 引用草稿 | 变更证据 | 建议 |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  if (report.entries.length === 0) {
    lines.push("| 健康 | 根 `public/uploads` 暂存区为空 | 0 B | — | — | 无需清理 |");
  }
  for (const entry of report.entries) {
    const drafts = entry.draftSources.length
      ? entry.draftSources.map((source) => `\`${source}\``).join("<br>")
      : "—";
    lines.push(
      `| ${STATUS_LABELS[entry.status]}${entry.stale ? " / 陈旧" : ""} | \`${entry.path}\` | ${formatBytes(entry.bytes)} | ${drafts} | ${ageLabel(entry)} · Git ${entry.evidence.gitState} | ${escapeTableCell(entry.recommendation)} |`,
    );
  }
  for (const missing of report.missingReferences) {
    lines.push(
      `| 缺失引用 | \`${missing.path}\` | — | ${missing.draftSources.map((source) => `\`${source}\``).join("<br>")} | — | 恢复文件或移除草稿引用 |`,
    );
  }
  for (const issue of report.draftIssues) {
    lines.push(
      `| 草稿无法审计 | \`${issue.draftPath}\` | — | — | — | ${escapeTableCell(issue.message)} |`,
    );
  }
  lines.push("", "> 此报告只提供证据与建议，不会自动删除作者文件。");
  return lines.join("\n");
}

function escapeWorkflowProperty(value: string) {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
    .replaceAll(":", "%3A")
    .replaceAll(",", "%2C");
}

function escapeWorkflowMessage(value: string) {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

export function formatStagingMediaAnnotations(report: StagingMediaReport) {
  const annotations = report.entries.flatMap((entry) => {
    if (entry.status === "referenced" && !entry.stale) return [];
    const message = `${STATUS_LABELS[entry.status]}${entry.stale ? `，已 ${entry.evidence.ageDays} 天未变化` : ""}；${entry.recommendation}`;
    return [
      `::warning file=${escapeWorkflowProperty(entry.path)},title=暂存媒体需复核::${escapeWorkflowMessage(message)}`,
    ];
  });
  for (const missing of report.missingReferences) {
    annotations.push(
      `::warning file=${escapeWorkflowProperty(missing.draftSources[0])},title=暂存附件缺失::${escapeWorkflowMessage(`${missing.path} 不存在；请恢复文件或移除草稿引用。`)}`,
    );
  }
  for (const issue of report.draftIssues) {
    annotations.push(
      `::warning file=${escapeWorkflowProperty(issue.draftPath)},title=草稿附件无法审计::${escapeWorkflowMessage(issue.message)}`,
    );
  }
  return annotations;
}
