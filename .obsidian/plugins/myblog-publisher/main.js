/* eslint-disable @typescript-eslint/no-require-imports */
const {
  FileSystemAdapter,
  getFrontMatterInfo,
  Modal,
  Notice,
  parseYaml,
  Plugin,
  TFile,
} = require("obsidian");
const { spawn } = require("node:child_process");

const MAX_CAPTURED_OUTPUT = 200_000;
const MAINTENANCE_REPORT_VERSION = 1;
const CONTENT_REVIEW_PROOF_VERSION = 3;
const CONTENT_REVIEW_DELIVERY_REPORT_VERSION = 1;
const CONTENT_REVIEW_DELIVERY_RECEIPT_VERSION = 1;
const CONTENT_PUBLISH_DELIVERY_REPORT_VERSION = 1;
const CONTENT_PUBLISH_DELIVERY_RECEIPT_VERSION = 1;
const CONTENT_DELIVERY_TRIAGE_REPORT_VERSION = 1;
const AUTHOR_DOCTOR_REPORT_VERSION = 1;
const INBOX_READINESS_REPORT_VERSION = 2;
const AUTHOR_DOCTOR_NODE_ENGINE = ">=22.13.0";
const AUTHOR_DOCTOR_PLUGIN_VERSION = "1.25.0";
const DRAFT_TITLE_MAX_LENGTH = 120;
const DRAFT_SLUG_MAX_LENGTH = 80;
const DRAFT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DRAFT_INBOX_PATH_PATTERN = /^content\/inbox\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/u;
const DRAFT_DATE_TOKEN = "{{date:YYYY-MM-DD}}";
const DRAFT_CREATION_KINDS = Object.freeze({
  article: Object.freeze({
    label: "技术文章 · ARTICLE",
    requiredLines: Object.freeze(["type: article", "freshness: historical"]),
    templatePath: "templates/obsidian/article.md",
  }),
  til: Object.freeze({
    label: "今日所学 · TIL",
    requiredLines: Object.freeze(["type: til", "freshness: historical"]),
    templatePath: "templates/obsidian/til.md",
  }),
  project: Object.freeze({
    label: "项目记录 · PROJECT",
    requiredLines: Object.freeze(["status: planning", "freshness: current"]),
    templatePath: "templates/obsidian/project.md",
  }),
});
const DRAFT_CONTENT_DIRECTORIES = Object.freeze([
  "content/inbox",
  "content/posts",
  "content/projects",
]);
const AUTHOR_TRANSACTION_PHASE_LABELS = Object.freeze({
  preflight: "前置检查 · PREFLIGHT",
  domain: "发布或复核 · DOMAIN",
  diagnostic: "证据降级 · DIAGNOSTIC",
});
const AUTHOR_TRANSACTION_OUTCOME_LABELS = Object.freeze({
  completed: "已完成 · COMPLETED",
  held: "前置拦截 · HELD",
  "command-failed": "命令未完成 · COMMAND FAILED",
  "start-failed": "命令无法启动 · START FAILED",
  "result-failed": "结果处理失败 · RESULT FAILED",
  unloaded: "插件已卸载 · UNLOADED",
});
const AUTHOR_DOCTOR_REQUIRED_SCRIPTS = [
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
const AUTHOR_DOCTOR_REQUIRED_PATHS = [
  { kind: "directory", path: "content/inbox" },
  { kind: "directory", path: "content/posts" },
  { kind: "directory", path: "content/projects" },
  { kind: "file", path: "docs/STATUS.md" },
  { kind: "directory", path: "templates/obsidian" },
];
const GIT_OBJECT_ID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const CONTENT_REVIEW_DELIVERY_STATUSES = [
  "synchronized",
  "pending-review",
  "local-ahead",
  "behind",
  "diverged",
  "tracking-missing",
];
const CONTENT_PUBLISH_DELIVERY_STATUSES = [
  "synchronized",
  "pending-publication",
  "local-ahead",
  "behind",
  "diverged",
  "tracking-missing",
];
const CONTENT_DELIVERY_TRIAGE_STATUSES = [
  "synchronized",
  "pending-review",
  "pending-publication",
  "local-ahead",
  "behind",
  "diverged",
  "tracking-missing",
];
const MAINTENANCE_STATUSES = [
  "healthy",
  "review-soon",
  "due-soon",
  "overdue",
];
const STATUS_LABELS = {
  healthy: "健康",
  "review-soon": "进入复核窗口",
  "due-soon": "即将到期",
  overdue: "已过期",
};
const STATUS_ORDER = {
  overdue: 0,
  "due-soon": 1,
  "review-soon": 2,
  healthy: 3,
};

function valueError(label, expectation) {
  throw new Error(`${label} ${expectation}`);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    valueError(label, "必须是对象");
  }
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    valueError(label, `字段必须严格为 ${expected.join(", ")}`);
  }
}

function assertInteger(value, label, minimum = Number.NEGATIVE_INFINITY) {
  if (!Number.isInteger(value) || value < minimum) {
    valueError(label, `必须是大于等于 ${minimum} 的整数`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    valueError(label, "必须是无首尾空白的非空字符串");
  }
}

function formatDraftMediaBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function formatDraftMediaInspection(inspection) {
  const frames = inspection.pages > 1 ? ` · ${inspection.pages} FRAMES` : "";
  return `${inspection.format.toUpperCase()} · ${inspection.width}×${inspection.height} PX${frames} · ${formatDraftMediaBytes(inspection.bytes)}`;
}

function formatDraftMediaChange(preparation) {
  if (!preparation.optimized) return "BYTE-STABLE";
  const percentage = Math.abs(
    (preparation.bytesSaved / preparation.source.bytes) * 100,
  ).toFixed(1);
  const direction = preparation.bytesSaved >= 0 ? "SAVED" : "ADDED";
  return `${direction} ${formatDraftMediaBytes(Math.abs(preparation.bytesSaved))} · ${percentage}%`;
}

function mediaFormatForPath(path) {
  const extension = path.toLowerCase().match(/\.([a-z0-9]+)$/u)?.[1];
  return {
    avif: "avif",
    gif: "gif",
    jpeg: "jpeg",
    jpg: "jpeg",
    png: "png",
    webp: "webp",
  }[extension];
}

function countExactLine(source, line) {
  return source.split("\n").filter((candidate) => candidate === line).length;
}

function parseIsoDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    valueError(label, "必须是 YYYY-MM-DD 日期");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    valueError(label, "不是有效日期");
  }
  return date;
}

function addIsoDays(value, days) {
  const date = parseIsoDate(value, "日期");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayDifference(later, earlier) {
  return (later.getTime() - earlier.getTime()) / 86_400_000;
}

function parseInboxReadinessReport(output, expectedSourcePath) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("收件箱发布意图证据不是有效 JSON");
  }
  const label = "收件箱发布意图证据";
  assertPlainObject(report, label);
  assertExactKeys(
    report,
    ["version", "mode", "counts", "entries", "reportDate", "safety"],
    label,
  );
  if (report.version !== INBOX_READINESS_REPORT_VERSION) {
    valueError(`${label} version`, `必须是 ${INBOX_READINESS_REPORT_VERSION}`);
  }
  if (report.mode !== "read-only") valueError(`${label} mode`, "必须是 read-only");
  parseIsoDate(report.reportDate, `${label} reportDate`);

  assertPlainObject(report.safety, `${label} safety`);
  assertExactKeys(
    report.safety,
    ["authorFilesChanged", "commitCreated", "networkChecked", "pushExecuted"],
    `${label} safety`,
  );
  for (const field of Object.keys(report.safety)) {
    if (report.safety[field] !== false) {
      valueError(`${label} safety.${field}`, "必须为 false");
    }
  }

  const states = ["blocked", "scheduled", "ready"];
  const issueCodes = new Set([
    "attachment-invalid",
    "attachment-missing",
    "attachment-shared",
    "attachment-target-exists",
    "attachment-tracked",
    "draft-invalid",
    "draft-symlink",
    "target-exists",
  ]);
  const safeReportSource = /^content\/inbox\/[^/\\\u0000-\u001f\u007f]+\.md$/u;
  const safeRepositoryPath = /^(?:content|public)\/[^\\\u0000-\u001f\u007f]+$/u;
  if (!Array.isArray(report.entries)) valueError(`${label} entries`, "必须是数组");
  const sources = new Set();
  for (const [index, entry] of report.entries.entries()) {
    const entryLabel = `${label} entries[${index}]`;
    assertPlainObject(entry, entryLabel);
    const optionalKeys = ["contentType", "kind", "publishedAt", "slug", "targetPath"].filter((key) =>
      Object.prototype.hasOwnProperty.call(entry, key),
    );
    assertExactKeys(
      entry,
      [
        "attachments",
        "draftState",
        "internalLinkCount",
        "internalLinks",
        "issues",
        "sourcePath",
        "state",
        ...optionalKeys,
      ],
      entryLabel,
    );
    if (typeof entry.sourcePath !== "string" || !safeReportSource.test(entry.sourcePath)) {
      valueError(`${entryLabel}.sourcePath`, "必须是安全的 content/inbox Markdown 路径");
    }
    if (sources.has(entry.sourcePath)) {
      valueError(`${entryLabel}.sourcePath`, "不能重复");
    }
    sources.add(entry.sourcePath);
    if (!states.includes(entry.state)) valueError(`${entryLabel}.state`, "不是受支持的状态");
    if (!["disabled", "draft", "unknown"].includes(entry.draftState)) {
      valueError(`${entryLabel}.draftState`, "不是受支持的草稿状态");
    }
    assertInteger(entry.internalLinkCount, `${entryLabel}.internalLinkCount`, 0);

    const preparedFields = ["contentType", "kind", "publishedAt", "slug", "targetPath"];
    const preparedCount = preparedFields.filter((field) =>
      Object.prototype.hasOwnProperty.call(entry, field),
    ).length;
    if (preparedCount !== 0 && preparedCount !== preparedFields.length) {
      valueError(entryLabel, "正式发布身份字段必须同时存在或同时缺失");
    }
    if (preparedCount === 0 && entry.internalLinkCount !== 0) {
      valueError(`${entryLabel}.internalLinkCount`, "未完成正式解析时必须为 0");
    }
    if (preparedCount === preparedFields.length) {
      if (!new Set(["post", "project"]).has(entry.kind)) {
        valueError(`${entryLabel}.kind`, "必须是 post 或 project");
      }
      if (!new Set(["article", "til", "project"]).has(entry.contentType)) {
        valueError(`${entryLabel}.contentType`, "必须是 article、til 或 project");
      }
      if (
        (entry.kind === "post" && entry.contentType === "project") ||
        (entry.kind === "project" && entry.contentType !== "project")
      ) {
        valueError(`${entryLabel}.contentType`, "必须与 kind 一致");
      }
      if (typeof entry.slug !== "string" || !DRAFT_SLUG_PATTERN.test(entry.slug)) {
        valueError(`${entryLabel}.slug`, "必须是安全的 kebab-case slug");
      }
      const expectedDraftPath = `content/inbox/${entry.slug}.md`;
      if (entry.sourcePath !== expectedDraftPath) {
        valueError(`${entryLabel}.sourcePath`, `必须与 slug 一致：${expectedDraftPath}`);
      }
      const directory = entry.kind === "post" ? "posts" : "projects";
      const expectedTargetPath = `content/${directory}/${entry.slug}.md`;
      if (entry.targetPath !== expectedTargetPath) {
        valueError(`${entryLabel}.targetPath`, `必须是 ${expectedTargetPath}`);
      }
      parseIsoDate(entry.publishedAt, `${entryLabel}.publishedAt`);
    }

    if (!Array.isArray(entry.internalLinks)) {
      valueError(`${entryLabel}.internalLinks`, "必须是数组");
    }
    if (entry.internalLinkCount !== entry.internalLinks.length) {
      valueError(`${entryLabel}.internalLinkCount`, "必须与精确站内链接目标数量一致");
    }
    if (preparedCount === 0 && entry.internalLinks.length !== 0) {
      valueError(`${entryLabel}.internalLinks`, "未完成正式解析时必须为空");
    }
    const exactLinkTargets = new Set();
    const safeInternalTarget = /^\/(posts|projects)\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:#([^\s#\u0000-\u001f\u007f]+))?$/u;
    for (const [linkIndex, link] of entry.internalLinks.entries()) {
      const linkLabel = `${entryLabel}.internalLinks[${linkIndex}]`;
      assertPlainObject(link, linkLabel);
      assertExactKeys(
        link,
        ["kind", "occurrences", "sourceLines", "target"],
        linkLabel,
      );
      if (!new Set(["post", "project", "self"]).has(link.kind)) {
        valueError(`${linkLabel}.kind`, "必须是 post、project 或 self");
      }
      assertInteger(link.occurrences, `${linkLabel}.occurrences`, 1);
      if (!Array.isArray(link.sourceLines) || link.sourceLines.length !== link.occurrences) {
        valueError(`${linkLabel}.sourceLines`, "必须逐次记录每个引用的源码行号");
      }
      let previousLine = 0;
      for (const [lineIndex, line] of link.sourceLines.entries()) {
        assertInteger(line, `${linkLabel}.sourceLines[${lineIndex}]`, 1);
        if (line < previousLine) {
          valueError(`${linkLabel}.sourceLines`, "必须按源码顺序排列");
        }
        previousLine = line;
      }
      if (typeof link.target !== "string") {
        valueError(`${linkLabel}.target`, "必须是安全的站内公开目标");
      }
      const targetMatch = link.target.match(safeInternalTarget);
      if (!targetMatch) {
        valueError(`${linkLabel}.target`, "必须是安全的站内公开目标");
      }
      if (exactLinkTargets.has(link.target)) {
        valueError(`${linkLabel}.target`, "精确目标不能重复");
      }
      exactLinkTargets.add(link.target);
      if (link.kind === "post" && targetMatch[1] !== "posts") {
        valueError(`${linkLabel}.target`, "必须与 post 类型一致");
      }
      if (link.kind === "project" && targetMatch[1] !== "projects") {
        valueError(`${linkLabel}.target`, "必须与 project 类型一致");
      }
      if (link.kind === "self") {
        if (preparedCount !== preparedFields.length || !targetMatch[3]) {
          valueError(`${linkLabel}.target`, "self 必须指向已解析草稿的标题锚点");
        }
        const directory = entry.kind === "post" ? "posts" : "projects";
        const ownTargetPrefix = `/${directory}/${entry.slug}#`;
        if (!link.target.startsWith(ownTargetPrefix)) {
          valueError(`${linkLabel}.target`, `必须指向 ${ownTargetPrefix}`);
        }
      }
    }

    if (!Array.isArray(entry.attachments)) {
      valueError(`${entryLabel}.attachments`, "必须是数组");
    }
    const attachmentSources = new Set();
    const attachmentTargets = new Set();
    const unpreparedAttachmentSources = new Set();
    for (const [attachmentIndex, attachment] of entry.attachments.entries()) {
      const attachmentLabel = `${entryLabel}.attachments[${attachmentIndex}]`;
      assertPlainObject(attachment, attachmentLabel);
      const hasPreparation = Object.prototype.hasOwnProperty.call(attachment, "preparation");
      assertExactKeys(
        attachment,
        ["publicUrl", "sourcePath", "targetPath", ...(hasPreparation ? ["preparation"] : [])],
        attachmentLabel,
      );
      for (const field of ["sourcePath", "targetPath"]) {
        if (
          typeof attachment[field] !== "string" ||
          !/^public\/uploads\/[^\\\u0000-\u001f\u007f]+$/u.test(attachment[field])
        ) {
          valueError(`${attachmentLabel}.${field}`, "必须是安全的 public/uploads 路径");
        }
      }
      if (attachmentSources.has(attachment.sourcePath)) {
        valueError(`${attachmentLabel}.sourcePath`, "不能重复");
      }
      attachmentSources.add(attachment.sourcePath);
      if (attachmentTargets.has(attachment.targetPath)) {
        valueError(`${attachmentLabel}.targetPath`, "不能重复");
      }
      attachmentTargets.add(attachment.targetPath);
      if (attachment.publicUrl !== attachment.targetPath.replace(/^public/u, "")) {
        valueError(`${attachmentLabel}.publicUrl`, "必须与 targetPath 对应");
      }
      if (preparedCount === preparedFields.length) {
        const targetPrefix = `public/uploads/${entry.slug}/`;
        if (!attachment.targetPath.startsWith(targetPrefix)) {
          valueError(`${attachmentLabel}.targetPath`, `必须位于 ${targetPrefix}`);
        }
      }
      if (!hasPreparation) {
        if (entry.state !== "blocked") {
          valueError(`${attachmentLabel}.preparation`, "ready 或 scheduled 附件必须完成媒体派生");
        }
        unpreparedAttachmentSources.add(attachment.sourcePath);
      } else {
        assertPlainObject(attachment.preparation, `${attachmentLabel}.preparation`);
        assertExactKeys(
          attachment.preparation,
          ["bytesSaved", "optimized", "output", "source"],
          `${attachmentLabel}.preparation`,
        );
        if (!Number.isInteger(attachment.preparation.bytesSaved)) {
          valueError(`${attachmentLabel}.preparation.bytesSaved`, "必须是整数");
        }
        if (typeof attachment.preparation.optimized !== "boolean") {
          valueError(`${attachmentLabel}.preparation.optimized`, "必须是 boolean");
        }
        for (const envelope of ["source", "output"]) {
          const inspection = attachment.preparation[envelope];
          const inspectionLabel = `${attachmentLabel}.preparation.${envelope}`;
          assertPlainObject(inspection, inspectionLabel);
          assertExactKeys(
            inspection,
            ["bytes", "format", "height", "pages", "sourcePath", "width"],
            inspectionLabel,
          );
          for (const field of ["bytes", "height", "pages", "width"]) {
            assertInteger(inspection[field], `${inspectionLabel}.${field}`, 1);
          }
          assertNonEmptyString(inspection.format, `${inspectionLabel}.format`);
          if (
            typeof inspection.sourcePath !== "string" ||
            !safeRepositoryPath.test(inspection.sourcePath)
          ) {
            valueError(`${inspectionLabel}.sourcePath`, "必须是安全仓库路径");
          }
          if (mediaFormatForPath(inspection.sourcePath) !== inspection.format) {
            valueError(`${inspectionLabel}.format`, "必须与媒体路径扩展名一致");
          }
        }
        const { output, source } = attachment.preparation;
        if (source.sourcePath !== attachment.sourcePath) {
          valueError(`${attachmentLabel}.preparation.source.sourcePath`, "必须等于附件 sourcePath");
        }
        if (output.sourcePath !== attachment.targetPath) {
          valueError(`${attachmentLabel}.preparation.output.sourcePath`, "必须等于附件 targetPath");
        }
        if (attachment.preparation.bytesSaved !== source.bytes - output.bytes) {
          valueError(`${attachmentLabel}.preparation.bytesSaved`, "必须等于输入字节减输出字节");
        }
        if (!attachment.preparation.optimized) {
          for (const field of ["bytes", "format", "height", "pages", "width"]) {
            if (source[field] !== output[field]) {
              valueError(`${attachmentLabel}.preparation.output.${field}`, "保留原文件时必须与输入一致");
            }
          }
        } else {
          if (
            source.pages !== 1 ||
            !new Set(["jpeg", "png", "webp"]).has(source.format) ||
            output.format !== "webp" ||
            output.pages !== 1
          ) {
            valueError(`${attachmentLabel}.preparation`, "optimized 包络必须是单帧 PNG/JPEG/WebP 到 WebP");
          }
          if (output.width > source.width || output.height > source.height) {
            valueError(`${attachmentLabel}.preparation.output`, "优化产物不得放大输入尺寸");
          }
        }
      }
    }

    if (!Array.isArray(entry.issues)) valueError(`${entryLabel}.issues`, "必须是数组");
    for (const [issueIndex, issue] of entry.issues.entries()) {
      const issueLabel = `${entryLabel}.issues[${issueIndex}]`;
      assertPlainObject(issue, issueLabel);
      const hasPath = Object.prototype.hasOwnProperty.call(issue, "path");
      assertExactKeys(issue, ["code", "message", ...(hasPath ? ["path"] : [])], issueLabel);
      if (!issueCodes.has(issue.code)) valueError(`${issueLabel}.code`, "不是受支持的问题代码");
      assertNonEmptyString(issue.message, `${issueLabel}.message`);
      if (hasPath) {
        assertNonEmptyString(issue.path, `${issueLabel}.path`);
        if (/\\|\u0000|\.\.(?:\/|$)/u.test(issue.path)) {
          valueError(`${issueLabel}.path`, "不是安全仓库路径");
        }
      }
    }
    for (const sourcePath of unpreparedAttachmentSources) {
      const hasMatchingIssue = entry.issues.some((issue) =>
        new Set(["attachment-invalid", "attachment-missing"]).has(issue.code) &&
        issue.path === sourcePath,
      );
      if (!hasMatchingIssue) {
        valueError(`${entryLabel}.attachments`, `未派生附件必须有同源 missing/invalid 问题：${sourcePath}`);
      }
    }
    if (entry.state === "blocked" && entry.issues.length === 0) {
      valueError(`${entryLabel}.issues`, "blocked 草稿必须包含阻塞证据");
    }
    if (entry.state !== "blocked" && entry.issues.length !== 0) {
      valueError(`${entryLabel}.issues`, "非 blocked 草稿不能包含问题");
    }
    if (entry.state !== "blocked" && preparedCount !== preparedFields.length) {
      valueError(entryLabel, "可发布状态必须包含完整正式发布身份");
    }
    if (entry.state === "scheduled" && entry.publishedAt <= report.reportDate) {
      valueError(`${entryLabel}.publishedAt`, "scheduled 草稿必须晚于 reportDate");
    }
    if (entry.state === "ready" && entry.publishedAt > report.reportDate) {
      valueError(`${entryLabel}.publishedAt`, "ready 草稿不能晚于 reportDate");
    }
  }

  assertPlainObject(report.counts, `${label} counts`);
  assertExactKeys(
    report.counts,
    ["attachments", "blocked", "drafts", "issues", "ready", "scheduled"],
    `${label} counts`,
  );
  for (const field of Object.keys(report.counts)) {
    assertInteger(report.counts[field], `${label} counts.${field}`, 0);
  }
  const expectedCounts = {
    attachments: report.entries.reduce((total, entry) => total + entry.attachments.length, 0),
    blocked: report.entries.filter((entry) => entry.state === "blocked").length,
    drafts: report.entries.length,
    issues: report.entries.reduce((total, entry) => total + entry.issues.length, 0),
    ready: report.entries.filter((entry) => entry.state === "ready").length,
    scheduled: report.entries.filter((entry) => entry.state === "scheduled").length,
  };
  for (const [field, value] of Object.entries(expectedCounts)) {
    if (report.counts[field] !== value) {
      valueError(`${label} counts.${field}`, "必须与 entries 一致");
    }
  }
  const matches = report.entries.filter((entry) => entry.sourcePath === expectedSourcePath);
  if (report.entries.length !== 1 || matches.length !== 1) {
    valueError(`${label} entries`, `必须只包含一个活动草稿证据：${expectedSourcePath}`);
  }
  return Object.freeze({ entry: matches[0], reportDate: report.reportDate });
}

function expectedStatus(remainingDays, thresholds) {
  if (remainingDays < 0) return "overdue";
  if (remainingDays <= thresholds.dueSoonDays) return "due-soon";
  if (remainingDays <= thresholds.reviewSoonDays) return "review-soon";
  return "healthy";
}

function parseMaintenanceReport(output) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("维护报告不是有效 JSON");
  }

  assertPlainObject(report, "维护报告");
  assertExactKeys(
    report,
    [
      "version",
      "buildDate",
      "counts",
      "currentCount",
      "excludedCount",
      "historicalCount",
      "maxAgeDays",
      "records",
      "reviewChecklist",
      "thresholds",
    ],
    "维护报告",
  );
  if (report.version !== MAINTENANCE_REPORT_VERSION) {
    valueError(
      "维护报告 version",
      `必须是 ${MAINTENANCE_REPORT_VERSION}`,
    );
  }

  const buildDate = parseIsoDate(report.buildDate, "维护报告 buildDate");
  assertInteger(report.currentCount, "维护报告 currentCount", 0);
  assertInteger(report.excludedCount, "维护报告 excludedCount", 0);
  assertInteger(report.historicalCount, "维护报告 historicalCount", 0);
  assertInteger(report.maxAgeDays, "维护报告 maxAgeDays", 1);

  assertPlainObject(report.thresholds, "维护报告 thresholds");
  assertExactKeys(
    report.thresholds,
    ["dueSoonDays", "reviewSoonDays"],
    "维护报告 thresholds",
  );
  assertInteger(
    report.thresholds.dueSoonDays,
    "维护报告 thresholds.dueSoonDays",
    0,
  );
  assertInteger(
    report.thresholds.reviewSoonDays,
    "维护报告 thresholds.reviewSoonDays",
    0,
  );
  if (
    report.thresholds.dueSoonDays > report.thresholds.reviewSoonDays ||
    report.thresholds.reviewSoonDays > report.maxAgeDays
  ) {
    valueError(
      "维护报告 thresholds",
      "必须满足 dueSoonDays ≤ reviewSoonDays ≤ maxAgeDays",
    );
  }

  assertPlainObject(report.counts, "维护报告 counts");
  assertExactKeys(report.counts, MAINTENANCE_STATUSES, "维护报告 counts");
  for (const status of MAINTENANCE_STATUSES) {
    assertInteger(report.counts[status], `维护报告 counts.${status}`, 0);
  }

  if (!Array.isArray(report.reviewChecklist) || report.reviewChecklist.length === 0) {
    valueError("维护报告 reviewChecklist", "必须是非空数组");
  }
  const checklist = new Set();
  for (const [index, item] of report.reviewChecklist.entries()) {
    assertNonEmptyString(item, `维护报告 reviewChecklist[${index}]`);
    if (checklist.has(item)) {
      valueError("维护报告 reviewChecklist", "不能包含重复项");
    }
    checklist.add(item);
  }

  if (!Array.isArray(report.records)) {
    valueError("维护报告 records", "必须是数组");
  }
  const sources = new Set();
  const countedStatuses = Object.fromEntries(
    MAINTENANCE_STATUSES.map((status) => [status, 0]),
  );
  for (const [index, record] of report.records.entries()) {
    const label = `维护报告 records[${index}]`;
    assertPlainObject(record, label);
    assertExactKeys(
      record,
      [
        "ageDays",
        "kind",
        "remainingDays",
        "reviewedAt",
        "reviewBy",
        "slug",
        "sourcePath",
        "status",
        "title",
        "url",
      ],
      label,
    );
    assertInteger(record.ageDays, `${label}.ageDays`, 0);
    assertInteger(record.remainingDays, `${label}.remainingDays`);
    assertNonEmptyString(record.title, `${label}.title`);
    if (record.kind !== "post" && record.kind !== "project") {
      valueError(`${label}.kind`, "必须是 post 或 project");
    }
    if (
      typeof record.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.slug)
    ) {
      valueError(`${label}.slug`, "必须是稳定的小写 kebab-case slug");
    }
    const directory = record.kind === "post" ? "posts" : "projects";
    const expectedSourcePath = `content/${directory}/${record.slug}.md`;
    if (record.sourcePath !== expectedSourcePath) {
      valueError(`${label}.sourcePath`, `必须是 ${expectedSourcePath}`);
    }
    if (record.url !== `/${directory}/${record.slug}`) {
      valueError(`${label}.url`, "必须与 kind 和 slug 的公开路由一致");
    }
    if (sources.has(record.sourcePath)) {
      valueError(`${label}.sourcePath`, "不能重复");
    }
    sources.add(record.sourcePath);

    const reviewedAt = parseIsoDate(record.reviewedAt, `${label}.reviewedAt`);
    parseIsoDate(record.reviewBy, `${label}.reviewBy`);
    if (dayDifference(buildDate, reviewedAt) !== record.ageDays) {
      valueError(`${label}.ageDays`, "必须等于 buildDate 与 reviewedAt 的日差");
    }
    if (record.reviewBy !== addIsoDays(record.reviewedAt, report.maxAgeDays)) {
      valueError(`${label}.reviewBy`, "必须等于 reviewedAt 加 maxAgeDays");
    }
    if (record.remainingDays !== report.maxAgeDays - record.ageDays) {
      valueError(`${label}.remainingDays`, "必须等于 maxAgeDays 减 ageDays");
    }
    if (!MAINTENANCE_STATUSES.includes(record.status)) {
      valueError(`${label}.status`, "不是受支持的状态");
    }
    if (record.status !== expectedStatus(record.remainingDays, report.thresholds)) {
      valueError(`${label}.status`, "与剩余天数和阈值不一致");
    }
    countedStatuses[record.status] += 1;
  }

  if (report.currentCount !== report.records.length) {
    valueError("维护报告 currentCount", "必须等于 records 数量");
  }
  for (const status of MAINTENANCE_STATUSES) {
    if (report.counts[status] !== countedStatuses[status]) {
      valueError(`维护报告 counts.${status}`, "必须与 records 一致");
    }
  }
  for (let index = 1; index < report.records.length; index += 1) {
    const previous = report.records[index - 1];
    const current = report.records[index];
    const outOfOrder =
      STATUS_ORDER[previous.status] > STATUS_ORDER[current.status] ||
      (STATUS_ORDER[previous.status] === STATUS_ORDER[current.status] &&
        previous.remainingDays > current.remainingDays) ||
      (STATUS_ORDER[previous.status] === STATUS_ORDER[current.status] &&
        previous.remainingDays === current.remainingDays &&
        previous.sourcePath.localeCompare(current.sourcePath, "en") > 0);
    if (outOfOrder) {
      valueError("维护报告 records", "必须按紧急程度、剩余天数和来源路径排序");
    }
  }

  return report;
}

function parseContentReviewProof(output, expectedSourcePath) {
  let proof;
  try {
    proof = JSON.parse(output);
  } catch {
    throw new Error("正式内容复核证据不是有效 JSON");
  }

  assertPlainObject(proof, "正式内容复核证据");
  assertExactKeys(
    proof,
    ["version", "mode", "candidate", "review", "git", "qualityGate"],
    "正式内容复核证据",
  );
  if (proof.version !== CONTENT_REVIEW_PROOF_VERSION) {
    valueError(
      "正式内容复核证据 version",
      `必须是 ${CONTENT_REVIEW_PROOF_VERSION}`,
    );
  }
  if (proof.mode !== "check-only") {
    valueError("正式内容复核证据 mode", "必须是 check-only");
  }

  assertPlainObject(proof.candidate, "正式内容复核证据 candidate");
  assertExactKeys(
    proof.candidate,
    ["algorithm", "digest", "stableAfterQualityGate"],
    "正式内容复核证据 candidate",
  );
  if (proof.candidate.algorithm !== "sha256") {
    valueError("正式内容复核证据 candidate.algorithm", "必须是 sha256");
  }
  if (
    typeof proof.candidate.digest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(proof.candidate.digest)
  ) {
    valueError(
      "正式内容复核证据 candidate.digest",
      "必须是 64 位小写 SHA-256",
    );
  }
  if (proof.candidate.stableAfterQualityGate !== true) {
    valueError(
      "正式内容复核证据 candidate.stableAfterQualityGate",
      "必须证明门前与门后候选一致",
    );
  }

  assertPlainObject(proof.review, "正式内容复核证据 review");
  assertExactKeys(
    proof.review,
    [
      "kind",
      "previousReviewedAt",
      "previousUpdatedAt",
      "reviewedAt",
      "slug",
      "sourcePath",
      "substantiveChanged",
      "title",
      "updatedAt",
    ],
    "正式内容复核证据 review",
  );
  if (proof.review.kind !== "post" && proof.review.kind !== "project") {
    valueError("正式内容复核证据 review.kind", "必须是 post 或 project");
  }
  if (
    typeof proof.review.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(proof.review.slug)
  ) {
    valueError("正式内容复核证据 review.slug", "必须是稳定 kebab-case slug");
  }
  assertNonEmptyString(proof.review.title, "正式内容复核证据 review.title");
  const directory = proof.review.kind === "post" ? "posts" : "projects";
  const derivedSourcePath = `content/${directory}/${proof.review.slug}.md`;
  if (
    proof.review.sourcePath !== derivedSourcePath ||
    proof.review.sourcePath !== expectedSourcePath
  ) {
    valueError(
      "正式内容复核证据 review.sourcePath",
      `必须与活动笔记严格一致：${expectedSourcePath}`,
    );
  }
  parseIsoDate(
    proof.review.previousReviewedAt,
    "正式内容复核证据 review.previousReviewedAt",
  );
  parseIsoDate(
    proof.review.reviewedAt,
    "正式内容复核证据 review.reviewedAt",
  );
  if (proof.review.previousReviewedAt >= proof.review.reviewedAt) {
    valueError(
      "正式内容复核证据 review.reviewedAt",
      "必须晚于 previousReviewedAt",
    );
  }
  for (const field of ["previousUpdatedAt", "updatedAt"]) {
    const value = proof.review[field];
    if (value !== null) {
      parseIsoDate(value, `正式内容复核证据 review.${field}`);
    }
  }
  if (
    proof.review.previousUpdatedAt !== null &&
    proof.review.previousUpdatedAt > proof.review.previousReviewedAt
  ) {
    valueError(
      "正式内容复核证据 review.previousUpdatedAt",
      "不能晚于 previousReviewedAt",
    );
  }
  if (
    proof.review.updatedAt !== null &&
    proof.review.updatedAt > proof.review.reviewedAt
  ) {
    valueError(
      "正式内容复核证据 review.updatedAt",
      "不能晚于 reviewedAt",
    );
  }
  if (typeof proof.review.substantiveChanged !== "boolean") {
    valueError(
      "正式内容复核证据 review.substantiveChanged",
      "必须是 boolean",
    );
  }
  if (
    proof.review.substantiveChanged &&
    proof.review.updatedAt !== proof.review.reviewedAt
  ) {
    valueError(
      "正式内容复核证据 review.updatedAt",
      "事实变化时必须等于 reviewedAt",
    );
  }
  if (
    !proof.review.substantiveChanged &&
    proof.review.updatedAt !== proof.review.previousUpdatedAt
  ) {
    valueError(
      "正式内容复核证据 review.updatedAt",
      "事实未变时必须保持 previousUpdatedAt",
    );
  }

  assertPlainObject(proof.git, "正式内容复核证据 git");
  assertExactKeys(
    proof.git,
    [
      "branch",
      "changedPaths",
      "committablePaths",
      "deferredPaths",
      "stagedPaths",
      "untrackedPaths",
    ],
    "正式内容复核证据 git",
  );
  if (proof.git.branch !== "main") {
    valueError("正式内容复核证据 git.branch", "必须是 main");
  }
  for (const field of [
    "changedPaths",
    "committablePaths",
    "deferredPaths",
    "stagedPaths",
    "untrackedPaths",
  ]) {
    const paths = proof.git[field];
    if (!Array.isArray(paths)) {
      valueError(`正式内容复核证据 git.${field}`, "必须是数组");
    }
    for (const path of paths) {
      if (
        typeof path !== "string" ||
        path.length === 0 ||
        path.trim() !== path ||
        path.startsWith("/") ||
        path.includes("\\") ||
        path.includes("//")
      ) {
        valueError(`正式内容复核证据 git.${field}`, "包含不安全的仓库路径");
      }
    }
    if (new Set(paths).size !== paths.length) {
      valueError(`正式内容复核证据 git.${field}`, "不能包含重复路径");
    }
    const sorted = [...paths].sort((left, right) =>
      left.localeCompare(right, "en"),
    );
    if (paths.some((path, index) => path !== sorted[index])) {
      valueError(`正式内容复核证据 git.${field}`, "必须按路径确定性排序");
    }
  }
  if (
    proof.git.committablePaths.length !== 1 ||
    proof.git.committablePaths[0] !== expectedSourcePath
  ) {
    valueError(
      "正式内容复核证据 git.committablePaths",
      `必须只包含 ${expectedSourcePath}`,
    );
  }
  if (proof.git.stagedPaths.length !== 0) {
    valueError("正式内容复核证据 git.stagedPaths", "必须是空数组");
  }
  if (!proof.git.changedPaths.includes(expectedSourcePath)) {
    valueError(
      "正式内容复核证据 git.changedPaths",
      `必须包含 ${expectedSourcePath}`,
    );
  }
  const modifiedDeferred = proof.git.changedPaths.filter(
    (path) => path !== expectedSourcePath,
  );
  if (
    modifiedDeferred.some(
      (path) => !/^content\/inbox\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(path),
    )
  ) {
    valueError(
      "正式内容复核证据 git.changedPaths",
      "除目标外只能包含稳定 inbox 草稿",
    );
  }
  if (
    proof.git.untrackedPaths.some(
      (path) =>
        !/^content\/inbox\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(path) &&
        !/^public\/uploads\/[^/\u0000-\u001f\u007f]+\.(?:avif|gif|jpe?g|png|webp)$/iu.test(
          path,
        ),
    )
  ) {
    valueError(
      "正式内容复核证据 git.untrackedPaths",
      "只能包含稳定 inbox 草稿或未跟踪的根暂存图片",
    );
  }
  const untrackedSet = new Set(proof.git.untrackedPaths);
  if (modifiedDeferred.some((path) => untrackedSet.has(path))) {
    valueError("正式内容复核证据 git", "changed 与 untracked 路径不能重叠");
  }
  const expectedDeferred = [...modifiedDeferred, ...proof.git.untrackedPaths].sort(
    (left, right) => left.localeCompare(right, "en"),
  );
  if (
    proof.git.deferredPaths.length !== expectedDeferred.length ||
    proof.git.deferredPaths.some(
      (path, index) => path !== expectedDeferred[index],
    )
  ) {
    valueError(
      "正式内容复核证据 git.deferredPaths",
      "必须精确等于已修改 inbox 与安全未跟踪作者工作的并集",
    );
  }

  assertPlainObject(proof.qualityGate, "正式内容复核证据 qualityGate");
  assertExactKeys(
    proof.qualityGate,
    ["command", "status"],
    "正式内容复核证据 qualityGate",
  );
  if (
    proof.qualityGate.command !== "npm run check" ||
    proof.qualityGate.status !== "passed"
  ) {
    valueError(
      "正式内容复核证据 qualityGate",
      "必须证明 npm run check 已通过",
    );
  }

  return proof;
}

function assertGitObjectId(value, label) {
  if (typeof value !== "string" || !GIT_OBJECT_ID_PATTERN.test(value)) {
    valueError(label, "必须是 40 或 64 位小写 Git object id");
  }
}

function parseContentReviewDeliveryReport(output) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("正式复核交付证据不是有效 JSON");
  }
  assertPlainObject(report, "正式复核交付证据");
  assertExactKeys(
    report,
    ["version", "mode", "observation", "relation", "pendingReview", "recovery"],
    "正式复核交付证据",
  );
  if (report.version !== CONTENT_REVIEW_DELIVERY_REPORT_VERSION) {
    valueError(
      "正式复核交付证据 version",
      `必须是 ${CONTENT_REVIEW_DELIVERY_REPORT_VERSION}`,
    );
  }
  if (report.mode !== "read-only") {
    valueError("正式复核交付证据 mode", "必须是 read-only");
  }

  assertPlainObject(report.observation, "正式复核交付证据 observation");
  assertExactKeys(
    report.observation,
    [
      "currentBranch",
      "localHead",
      "localRef",
      "networkChecked",
      "trackingHead",
      "trackingRef",
    ],
    "正式复核交付证据 observation",
  );
  if (report.observation.currentBranch !== null) {
    assertNonEmptyString(
      report.observation.currentBranch,
      "正式复核交付证据 observation.currentBranch",
    );
    if (/[\u0000-\u001f\u007f]/u.test(report.observation.currentBranch)) {
      valueError(
        "正式复核交付证据 observation.currentBranch",
        "不能包含控制字符",
      );
    }
  }
  assertGitObjectId(
    report.observation.localHead,
    "正式复核交付证据 observation.localHead",
  );
  if (report.observation.localRef !== "refs/heads/main") {
    valueError("正式复核交付证据 observation.localRef", "必须是 refs/heads/main");
  }
  if (report.observation.networkChecked !== false) {
    valueError("正式复核交付证据 observation.networkChecked", "必须是 false");
  }
  if (report.observation.trackingHead !== null) {
    assertGitObjectId(
      report.observation.trackingHead,
      "正式复核交付证据 observation.trackingHead",
    );
  }
  if (report.observation.trackingRef !== "refs/remotes/origin/main") {
    valueError(
      "正式复核交付证据 observation.trackingRef",
      "必须是 refs/remotes/origin/main",
    );
  }

  assertPlainObject(report.relation, "正式复核交付证据 relation");
  assertExactKeys(
    report.relation,
    ["ahead", "behind", "status"],
    "正式复核交付证据 relation",
  );
  if (!CONTENT_REVIEW_DELIVERY_STATUSES.includes(report.relation.status)) {
    valueError("正式复核交付证据 relation.status", "不是受支持的状态");
  }
  const trackingMissing = report.observation.trackingHead === null;
  if (trackingMissing) {
    if (
      report.relation.ahead !== null ||
      report.relation.behind !== null ||
      report.relation.status !== "tracking-missing"
    ) {
      valueError(
        "正式复核交付证据 relation",
        "tracking ref 缺失时必须是 tracking-missing 且计数为 null",
      );
    }
  } else {
    assertInteger(report.relation.ahead, "正式复核交付证据 relation.ahead", 0);
    assertInteger(report.relation.behind, "正式复核交付证据 relation.behind", 0);
    const { ahead, behind } = report.relation;
    const expectedStatus = ahead > 0 && behind > 0
      ? "diverged"
      : behind > 0
        ? "behind"
        : ahead > 0
          ? (report.pendingReview === null ? "local-ahead" : "pending-review")
          : "synchronized";
    if (report.relation.status !== expectedStatus) {
      valueError(
        "正式复核交付证据 relation.status",
        "与 ahead/behind/pendingReview 不一致",
      );
    }
    if (
      (ahead === 0 && behind === 0) !==
      (report.observation.localHead === report.observation.trackingHead)
    ) {
      valueError(
        "正式复核交付证据 relation",
        "HEAD 身份与 ahead/behind 不一致",
      );
    }
  }

  if (report.pendingReview !== null) {
    assertPlainObject(report.pendingReview, "正式复核交付证据 pendingReview");
    assertExactKeys(
      report.pendingReview,
      [
        "blobOid",
        "commitOid",
        "parentOid",
        "slug",
        "sourcePath",
        "subject",
        "treeOid",
      ],
      "正式复核交付证据 pendingReview",
    );
    for (const field of ["blobOid", "commitOid", "parentOid", "treeOid"]) {
      assertGitObjectId(
        report.pendingReview[field],
        `正式复核交付证据 pendingReview.${field}`,
      );
    }
    if (
      report.relation.status !== "pending-review" ||
      report.relation.ahead !== 1 ||
      report.relation.behind !== 0 ||
      report.pendingReview.commitOid !== report.observation.localHead ||
      report.pendingReview.parentOid !== report.observation.trackingHead
    ) {
      valueError(
        "正式复核交付证据 pendingReview",
        "必须是直接领先 tracking ref 的唯一 HEAD 提交",
      );
    }
    if (
      typeof report.pendingReview.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(report.pendingReview.slug)
    ) {
      valueError("正式复核交付证据 pendingReview.slug", "必须是稳定 slug");
    }
    const expectedPathPattern = new RegExp(
      `^content/(?:posts|projects)/${report.pendingReview.slug}\\.md$`,
      "u",
    );
    if (!expectedPathPattern.test(report.pendingReview.sourcePath)) {
      valueError(
        "正式复核交付证据 pendingReview.sourcePath",
        "必须是与 slug 对应的正式内容路径",
      );
    }
    if (report.pendingReview.subject !== `content: review ${report.pendingReview.slug}`) {
      valueError(
        "正式复核交付证据 pendingReview.subject",
        "必须是与 slug 对应的正式复核提交",
      );
    }
  } else if (report.relation.status === "pending-review") {
    valueError("正式复核交付证据 pendingReview", "pending-review 状态不能缺失");
  }

  assertPlainObject(report.recovery, "正式复核交付证据 recovery");
  assertExactKeys(
    report.recovery,
    ["action", "autoExecuted", "command"],
    "正式复核交付证据 recovery",
  );
  if (report.recovery.autoExecuted !== false) {
    valueError("正式复核交付证据 recovery.autoExecuted", "必须是 false");
  }
  const expectedRecovery = report.relation.status === "pending-review"
    ? ["push-origin-main", "git push origin main"]
    : report.relation.status === "synchronized"
      ? ["none", null]
      : ["inspect-git-state", null];
  if (
    report.recovery.action !== expectedRecovery[0] ||
    report.recovery.command !== expectedRecovery[1]
  ) {
    valueError("正式复核交付证据 recovery", "与 relation 状态不一致");
  }
  return report;
}

function parseContentPublishDeliveryReport(output) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("新内容发布交付证据不是有效 JSON");
  }
  const label = "新内容发布交付证据";
  assertPlainObject(report, label);
  assertExactKeys(
    report,
    ["version", "mode", "observation", "relation", "pendingPublication", "recovery"],
    label,
  );
  if (report.version !== CONTENT_PUBLISH_DELIVERY_REPORT_VERSION) {
    valueError(`${label} version`, `必须是 ${CONTENT_PUBLISH_DELIVERY_REPORT_VERSION}`);
  }
  if (report.mode !== "read-only") {
    valueError(`${label} mode`, "必须是 read-only");
  }

  assertPlainObject(report.observation, `${label} observation`);
  assertExactKeys(
    report.observation,
    [
      "currentBranch",
      "localHead",
      "localRef",
      "networkChecked",
      "trackingHead",
      "trackingRef",
    ],
    `${label} observation`,
  );
  if (report.observation.currentBranch !== null) {
    assertNonEmptyString(
      report.observation.currentBranch,
      `${label} observation.currentBranch`,
    );
    if (/[ -]/u.test(report.observation.currentBranch)) {
      valueError(`${label} observation.currentBranch`, "不能包含控制字符");
    }
  }
  assertGitObjectId(report.observation.localHead, `${label} observation.localHead`);
  if (report.observation.localRef !== "refs/heads/main") {
    valueError(`${label} observation.localRef`, "必须是 refs/heads/main");
  }
  if (report.observation.networkChecked !== false) {
    valueError(`${label} observation.networkChecked`, "必须是 false");
  }
  if (report.observation.trackingHead !== null) {
    assertGitObjectId(
      report.observation.trackingHead,
      `${label} observation.trackingHead`,
    );
  }
  if (report.observation.trackingRef !== "refs/remotes/origin/main") {
    valueError(
      `${label} observation.trackingRef`,
      "必须是 refs/remotes/origin/main",
    );
  }

  assertPlainObject(report.relation, `${label} relation`);
  assertExactKeys(report.relation, ["ahead", "behind", "status"], `${label} relation`);
  if (!CONTENT_PUBLISH_DELIVERY_STATUSES.includes(report.relation.status)) {
    valueError(`${label} relation.status`, "不是受支持的状态");
  }
  const trackingMissing = report.observation.trackingHead === null;
  if (trackingMissing) {
    if (
      report.relation.ahead !== null ||
      report.relation.behind !== null ||
      report.relation.status !== "tracking-missing"
    ) {
      valueError(
        `${label} relation`,
        "tracking ref 缺失时必须是 tracking-missing 且计数为 null",
      );
    }
  } else {
    assertInteger(report.relation.ahead, `${label} relation.ahead`, 0);
    assertInteger(report.relation.behind, `${label} relation.behind`, 0);
    const { ahead, behind } = report.relation;
    const expectedStatus = ahead > 0 && behind > 0
      ? "diverged"
      : behind > 0
        ? "behind"
        : ahead > 0
          ? (report.pendingPublication === null ? "local-ahead" : "pending-publication")
          : "synchronized";
    if (report.relation.status !== expectedStatus) {
      valueError(
        `${label} relation.status`,
        "与 ahead/behind/pendingPublication 不一致",
      );
    }
    if (
      (ahead === 0 && behind === 0) !==
      (report.observation.localHead === report.observation.trackingHead)
    ) {
      valueError(`${label} relation`, "HEAD 身份与 ahead/behind 不一致");
    }
  }

  if (report.pendingPublication !== null) {
    const pending = report.pendingPublication;
    const pendingLabel = `${label} pendingPublication`;
    assertPlainObject(pending, pendingLabel);
    assertExactKeys(
      pending,
      [
        "attachmentCount",
        "changes",
        "commitOid",
        "inboxSourcePath",
        "kind",
        "parentOid",
        "slug",
        "sourceDeletionTracked",
        "subject",
        "targetBlobOid",
        "targetPath",
        "title",
        "treeOid",
      ],
      pendingLabel,
    );
    assertInteger(pending.attachmentCount, `${pendingLabel}.attachmentCount`, 0);
    for (const field of ["commitOid", "parentOid", "targetBlobOid", "treeOid"]) {
      assertGitObjectId(pending[field], `${pendingLabel}.${field}`);
    }
    if (
      report.relation.status !== "pending-publication" ||
      report.relation.ahead !== 1 ||
      report.relation.behind !== 0 ||
      pending.commitOid !== report.observation.localHead ||
      pending.parentOid !== report.observation.trackingHead
    ) {
      valueError(pendingLabel, "必须是直接领先 tracking ref 的唯一 HEAD 提交");
    }
    if (
      typeof pending.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(pending.slug)
    ) {
      valueError(`${pendingLabel}.slug`, "必须是稳定 slug");
    }
    if (pending.kind !== "post" && pending.kind !== "project") {
      valueError(`${pendingLabel}.kind`, "必须是 post 或 project");
    }
    assertNonEmptyString(pending.title, `${pendingLabel}.title`);
    if (/[ -]/u.test(pending.title)) {
      valueError(`${pendingLabel}.title`, "不能包含控制字符");
    }
    const expectedTargetPath = `content/${pending.kind === "post" ? "posts" : "projects"}/${pending.slug}.md`;
    const expectedInboxPath = `content/inbox/${pending.slug}.md`;
    if (pending.targetPath !== expectedTargetPath) {
      valueError(`${pendingLabel}.targetPath`, "必须与 kind/slug 严格对应");
    }
    if (pending.inboxSourcePath !== expectedInboxPath) {
      valueError(`${pendingLabel}.inboxSourcePath`, "必须与 slug 严格对应");
    }
    if (pending.subject !== `content: publish ${pending.slug}`) {
      valueError(`${pendingLabel}.subject`, "必须与 slug 严格对应");
    }
    if (typeof pending.sourceDeletionTracked !== "boolean") {
      valueError(`${pendingLabel}.sourceDeletionTracked`, "必须是布尔值");
    }
    if (!Array.isArray(pending.changes) || pending.changes.length === 0) {
      valueError(`${pendingLabel}.changes`, "必须是非空数组");
    }

    const seenPaths = new Set();
    const attachmentPattern = new RegExp(
      `^public/uploads/${pending.slug}/[a-z0-9]+(?:-[a-z0-9]+)*(?:-[a-f0-9]{8})?\\.(?:avif|gif|webp)$`,
      "u",
    );
    for (const [index, change] of pending.changes.entries()) {
      const changeLabel = `${pendingLabel}.changes[${index}]`;
      assertPlainObject(change, changeLabel);
      assertExactKeys(
        change,
        ["newBlobOid", "oldBlobOid", "path", "status"],
        changeLabel,
      );
      assertNonEmptyString(change.path, `${changeLabel}.path`);
      if (
        !/^[a-zA-Z0-9._/-]+$/u.test(change.path) ||
        change.path.startsWith("/") ||
        change.path.includes("//") ||
        change.path.split("/").some((part) => part === "." || part === "..") ||
        seenPaths.has(change.path)
      ) {
        valueError(`${changeLabel}.path`, "必须是唯一安全仓库路径");
      }
      seenPaths.add(change.path);
      if (!['added', 'deleted', 'modified'].includes(change.status)) {
        valueError(`${changeLabel}.status`, "不是受支持的变更状态");
      }
      if (change.oldBlobOid !== null) {
        assertGitObjectId(change.oldBlobOid, `${changeLabel}.oldBlobOid`);
      }
      if (change.newBlobOid !== null) {
        assertGitObjectId(change.newBlobOid, `${changeLabel}.newBlobOid`);
      }
      const shapeValid = change.status === "added"
        ? change.oldBlobOid === null && change.newBlobOid !== null
        : change.status === "deleted"
          ? change.oldBlobOid !== null && change.newBlobOid === null
          : change.oldBlobOid !== null && change.newBlobOid !== null;
      if (!shapeValid) {
        valueError(changeLabel, "blob 身份与变更状态不一致");
      }
    }
    const sortedPaths = pending.changes
      .map((change) => change.path)
      .sort((left, right) => left.localeCompare(right, "en"));
    if (pending.changes.some((change, index) => change.path !== sortedPaths[index])) {
      valueError(`${pendingLabel}.changes`, "必须按路径确定性排序");
    }
    const target = pending.changes.find((change) => change.path === expectedTargetPath);
    const inbox = pending.changes.find((change) => change.path === expectedInboxPath);
    const attachments = pending.changes.filter((change) => attachmentPattern.test(change.path));
    if (
      target?.status !== "added" ||
      target.oldBlobOid !== null ||
      target.newBlobOid !== pending.targetBlobOid
    ) {
      valueError(`${pendingLabel}.changes`, "必须包含与 targetBlobOid 一致的新增正式内容");
    }
    if (
      pending.sourceDeletionTracked !== (inbox !== undefined) ||
      (inbox && inbox.status !== "deleted")
    ) {
      valueError(`${pendingLabel}.changes`, "inbox 删除与 sourceDeletionTracked 不一致");
    }
    if (
      attachments.length !== pending.attachmentCount ||
      attachments.some((change) => change.status !== "added")
    ) {
      valueError(`${pendingLabel}.changes`, "媒体清单与 attachmentCount 不一致");
    }
    const allowedPaths = new Set([
      expectedTargetPath,
      ...(inbox ? [expectedInboxPath] : []),
      ...attachments.map((change) => change.path),
    ]);
    if (
      allowedPaths.size !== pending.changes.length ||
      pending.changes.some((change) => !allowedPaths.has(change.path))
    ) {
      valueError(`${pendingLabel}.changes`, "包含原子发布包之外的路径");
    }
  } else if (report.relation.status === "pending-publication") {
    valueError(`${label} pendingPublication`, "pending-publication 状态不能缺失");
  }

  assertPlainObject(report.recovery, `${label} recovery`);
  assertExactKeys(
    report.recovery,
    ["action", "autoExecuted", "command"],
    `${label} recovery`,
  );
  if (report.recovery.autoExecuted !== false) {
    valueError(`${label} recovery.autoExecuted`, "必须是 false");
  }
  const expectedRecovery = report.relation.status === "pending-publication"
    ? [
        "push-pending-publication",
        `git push origin ${report.pendingPublication.commitOid}:refs/heads/main`,
      ]
    : report.relation.status === "synchronized"
      ? ["none", null]
      : ["inspect-git-state", null];
  if (
    report.recovery.action !== expectedRecovery[0] ||
    report.recovery.command !== expectedRecovery[1]
  ) {
    valueError(`${label} recovery`, "与 relation 状态或精确 commit 身份不一致");
  }
  return report;
}

function parseContentDeliveryTriageReport(output) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("Git 交付分诊证据不是有效 JSON");
  }
  const label = "Git 交付分诊证据";
  assertPlainObject(report, label);
  assertExactKeys(
    report,
    ["version", "mode", "observation", "relation", "pending", "route"],
    label,
  );
  if (report.version !== CONTENT_DELIVERY_TRIAGE_REPORT_VERSION) {
    valueError(
      `${label} version`,
      `必须是 ${CONTENT_DELIVERY_TRIAGE_REPORT_VERSION}`,
    );
  }
  if (report.mode !== "read-only") {
    valueError(`${label} mode`, "必须是 read-only");
  }
  assertPlainObject(report.relation, `${label} relation`);
  assertExactKeys(
    report.relation,
    ["ahead", "behind", "status"],
    `${label} relation`,
  );
  if (!CONTENT_DELIVERY_TRIAGE_STATUSES.includes(report.relation.status)) {
    valueError(`${label} relation.status`, "不是受支持的状态");
  }

  const reviewPending = report.relation.status === "pending-review";
  const publicationPending = report.relation.status === "pending-publication";
  if (reviewPending || publicationPending) {
    assertPlainObject(report.pending, `${label} pending`);
    assertExactKeys(
      report.pending,
      ["kind", "publication", "review"],
      `${label} pending`,
    );
    if (
      reviewPending &&
      (report.pending.kind !== "review" ||
        report.pending.review === null ||
        report.pending.publication !== null)
    ) {
      valueError(`${label} pending`, "必须只包含正式复核身份");
    }
    if (
      publicationPending &&
      (report.pending.kind !== "publication" ||
        report.pending.publication === null ||
        report.pending.review !== null)
    ) {
      valueError(`${label} pending`, "必须只包含新内容发布身份");
    }
  } else if (report.pending !== null) {
    valueError(`${label} pending`, "非精确待交付状态必须是 null");
  }

  const reviewStatus = reviewPending ? "pending-review"
    : publicationPending ? "local-ahead"
      : report.relation.status;
  const publicationStatus = publicationPending ? "pending-publication"
    : reviewPending ? "local-ahead"
      : report.relation.status;
  const review = parseContentReviewDeliveryReport(
    JSON.stringify({
      version: CONTENT_REVIEW_DELIVERY_REPORT_VERSION,
      mode: "read-only",
      observation: report.observation,
      relation: {
        ahead: report.relation.ahead,
        behind: report.relation.behind,
        status: reviewStatus,
      },
      pendingReview: reviewPending ? report.pending.review : null,
      recovery: reviewPending
        ? {
            action: "push-origin-main",
            autoExecuted: false,
            command: "git push origin main",
          }
        : reviewStatus === "synchronized"
          ? { action: "none", autoExecuted: false, command: null }
          : {
              action: "inspect-git-state",
              autoExecuted: false,
              command: null,
            },
    }),
  );
  const publication = parseContentPublishDeliveryReport(
    JSON.stringify({
      version: CONTENT_PUBLISH_DELIVERY_REPORT_VERSION,
      mode: "read-only",
      observation: report.observation,
      relation: {
        ahead: report.relation.ahead,
        behind: report.relation.behind,
        status: publicationStatus,
      },
      pendingPublication: publicationPending
        ? report.pending.publication
        : null,
      recovery: publicationPending
        ? {
            action: "push-pending-publication",
            autoExecuted: false,
            command: `git push origin ${report.pending.publication.commitOid}:refs/heads/main`,
          }
        : publicationStatus === "synchronized"
          ? { action: "none", autoExecuted: false, command: null }
          : {
              action: "inspect-git-state",
              autoExecuted: false,
              command: null,
            },
    }),
  );
  if (
    review.observation.localHead !== publication.observation.localHead ||
    review.observation.trackingHead !== publication.observation.trackingHead
  ) {
    valueError(`${label} observation`, "领域证据必须来自同一 Git 观察");
  }
  if (reviewPending) report.pending.review = review.pendingReview;
  if (publicationPending) {
    report.pending.publication = publication.pendingPublication;
  }

  assertPlainObject(report.route, `${label} route`);
  assertExactKeys(
    report.route,
    [
      "autoExecuted",
      "deliverCommand",
      "deliverable",
      "kind",
      "statusCommand",
    ],
    `${label} route`,
  );
  const expectedKind = reviewPending
    ? "review"
    : publicationPending
      ? "publication"
      : report.relation.status === "synchronized"
        ? "none"
        : "inspect";
  const expectedStatusCommand = reviewPending
    ? "npm run content:review:status"
    : publicationPending
      ? "npm run content:publish:status"
      : null;
  const expectedDeliverable =
    (reviewPending || publicationPending) &&
    report.observation.currentBranch === "main";
  const expectedDeliverCommand = expectedDeliverable
    ? reviewPending
      ? "npm run content:review:deliver -- --format json"
      : "npm run content:publish:deliver -- --format json"
    : null;
  if (
    report.route.autoExecuted !== false ||
    report.route.kind !== expectedKind ||
    report.route.statusCommand !== expectedStatusCommand ||
    report.route.deliverable !== expectedDeliverable ||
    report.route.deliverCommand !== expectedDeliverCommand
  ) {
    valueError(`${label} route`, "与提交身份、分支或关系状态不一致");
  }
  return report;
}

function normalizeAuthorDoctorRoot(value) {
  const normalized = value.replace(/\\/gu, "/").replace(/\/+$/u, "");
  return /^[A-Za-z]:\//u.test(normalized)
    ? normalized.toLocaleLowerCase("en-US")
    : normalized;
}

function authorDoctorVersionAtLeast(value, minimum) {
  const actual = value.match(/^v(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u);
  const expected = minimum.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u);
  if (!actual || !expected) return false;
  for (let index = 1; index <= 3; index += 1) {
    const left = Number(actual[index]);
    const right = Number(expected[index]);
    if (left !== right) return left > right;
  }
  return true;
}

function deriveAuthorDoctorChecks(observation) {
  const requiredScripts = new Set(AUTHOR_DOCTOR_REQUIRED_SCRIPTS);
  const scriptNames = new Set(observation.workspace.scriptNames);
  const scriptsReady =
    scriptNames.size === observation.workspace.scriptNames.length &&
    AUTHOR_DOCTOR_REQUIRED_SCRIPTS.every((name) => scriptNames.has(name));
  const pathsReady = AUTHOR_DOCTOR_REQUIRED_PATHS.every((required, index) => {
    const observed = observation.workspace.paths[index];
    return (
      observed?.kind === required.kind &&
      observed.path === required.path &&
      observed.present === true
    );
  });
  const localHead = observation.repository.localHead;
  const trackingHead = observation.repository.trackingHead;
  const baselineReady =
    observation.repository.upstream === "origin/main" &&
    observation.repository.relation === "synchronized" &&
    localHead !== null &&
    GIT_OBJECT_ID_PATTERN.test(localHead) &&
    trackingHead === localHead;
  const plugin = observation.vault.plugin;
  const pluginReady =
    plugin?.id === "myblog-publisher" &&
    plugin.version === AUTHOR_DOCTOR_PLUGIN_VERSION &&
    plugin.isDesktopOnly === true &&
    plugin.mainPresent === true &&
    plugin.stylesPresent === true;
  const identityObserved = `${observation.identity.nameConfigured ? "name configured" : "name missing"} · ${observation.identity.emailConfigured ? "email configured" : "email missing"}`;
  const definitions = [
    {
      expected: AUTHOR_DOCTOR_NODE_ENGINE,
      group: "runtime",
      id: "node-runtime",
      label: "Node.js runtime",
      observed: observation.nodeVersion,
      pass: authorDoctorVersionAtLeast(observation.nodeVersion, "22.13.0"),
      repair: "安装 Node.js 22.13.0 或更高版本后重启 Obsidian",
    },
    {
      expected: "available semantic version",
      group: "runtime",
      id: "npm-cli",
      label: "npm CLI",
      observed: observation.npmVersion ?? "missing",
      pass:
        observation.npmVersion !== null &&
        /^\d+\.\d+\.\d+(?:[-+].*)?$/u.test(observation.npmVersion),
      repair: "重新安装受支持的 Node.js（应同时提供 npm）",
    },
    {
      expected: "available version",
      group: "runtime",
      id: "git-cli",
      label: "Git CLI",
      observed: observation.gitVersion ?? "missing",
      pass:
        observation.gitVersion !== null &&
        /^git version \d+\.\d+\.\d+(?:[.-][0-9A-Za-z]+)*$/u.test(
          observation.gitVersion,
        ),
      repair: "安装 Git 后重启 Obsidian",
    },
    {
      expected: "current directory equals Git toplevel",
      group: "git",
      id: "repository-root",
      label: "Repository root",
      observed: observation.repository.root ?? "missing",
      pass:
        observation.repository.root !== null &&
        normalizeAuthorDoctorRoot(observation.currentDirectory) ===
          normalizeAuthorDoctorRoot(observation.repository.root),
      repair: "把当前 Vault 设为 MyBlog 仓库根目录",
    },
    {
      expected: "main",
      group: "git",
      id: "main-branch",
      label: "Current branch",
      observed: observation.repository.currentBranch ?? "detached HEAD",
      pass: observation.repository.currentBranch === "main",
      repair: "切换到 main 后重新检查",
    },
    {
      expected: "main -> origin/main synchronized",
      group: "git",
      id: "delivery-baseline",
      label: "Delivery baseline",
      observed: `${observation.repository.upstream ?? "no upstream"} · ${observation.repository.relation ?? "unavailable"}`,
      pass: baselineReady,
      repair: "运行 npm run content:delivery:status 检查本地交付状态",
    },
    {
      expected: "user.name and user.email configured",
      group: "git",
      id: "author-identity",
      label: "Author identity",
      observed: identityObserved,
      pass:
        observation.identity.nameConfigured &&
        observation.identity.emailConfigured,
      repair: "配置 Git user.name 与 user.email 后重新检查",
    },
    {
      expected: `zach424-myblog · node ${AUTHOR_DOCTOR_NODE_ENGINE}`,
      group: "workspace",
      id: "workspace-contract",
      label: "Workspace contract",
      observed: `${observation.workspace.packageName ?? "missing"} · node ${observation.workspace.nodeEngine ?? "missing"}`,
      pass:
        observation.workspace.packageName === "zach424-myblog" &&
        observation.workspace.nodeEngine === AUTHOR_DOCTOR_NODE_ENGINE,
      repair: "恢复仓库根 package.json 的项目名称与 Node engines 契约",
    },
    {
      expected: `${AUTHOR_DOCTOR_REQUIRED_SCRIPTS.length} required author scripts`,
      group: "workspace",
      id: "npm-scripts",
      label: "Author scripts",
      observed: `${observation.workspace.scriptNames.filter((name) => requiredScripts.has(name)).length}/${AUTHOR_DOCTOR_REQUIRED_SCRIPTS.length} required scripts`,
      pass: scriptsReady,
      repair: "恢复 package.json 中缺失的作者脚本",
    },
    {
      expected: "all declared packages installed at pinned versions",
      group: "workspace",
      id: "workspace-dependencies",
      label: "Workspace dependencies",
      observed:
        observation.workspace.dependencyIssues.length === 0
          ? `${observation.workspace.dependencyMatching}/${observation.workspace.dependencyExpected} pinned packages`
          : observation.workspace.dependencyIssues.join(" · "),
      pass:
        observation.workspace.dependencyMatching ===
          observation.workspace.dependencyExpected &&
        observation.workspace.dependencyIssues.length === 0,
      repair: "在仓库根运行 npm ci",
    },
    {
      expected: `${AUTHOR_DOCTOR_REQUIRED_PATHS.length} required authoring paths`,
      group: "workspace",
      id: "content-layout",
      label: "Content layout",
      observed: `${observation.workspace.paths.filter((path) => path.present).length}/${AUTHOR_DOCTOR_REQUIRED_PATHS.length} required paths`,
      pass: pathsReady,
      repair: "恢复缺失的内容目录、模板或 docs/STATUS.md",
    },
    {
      expected: ".obsidian directory present",
      group: "vault",
      id: "obsidian-vault",
      label: "Obsidian Vault",
      observed: observation.vault.obsidianDirectoryPresent
        ? ".obsidian present"
        : ".obsidian missing",
      pass: observation.vault.obsidianDirectoryPresent,
      repair: "把仓库根作为 Obsidian Vault 打开",
    },
    {
      expected: `myblog-publisher ${AUTHOR_DOCTOR_PLUGIN_VERSION} desktop plugin`,
      group: "vault",
      id: "publisher-plugin",
      label: "MyBlog Publisher",
      observed: plugin
        ? `${plugin.id}@${plugin.version} · ${plugin.isDesktopOnly ? "desktop" : "not desktop"}`
        : "missing",
      pass: pluginReady,
      repair: `重新安装或启用 MyBlog Publisher ${AUTHOR_DOCTOR_PLUGIN_VERSION}`,
    },
  ];
  return definitions.map(({ pass, repair, ...evidence }) => ({
    ...evidence,
    resolution: pass ? null : repair,
    status: pass ? "pass" : "attention",
  }));
}

function parseAuthorDoctorReport(output, expectedRoot) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("作者环境自检证据不是有效 JSON");
  }
  const label = "作者环境自检证据";
  assertPlainObject(report, label);
  assertExactKeys(
    report,
    ["version", "mode", "status", "observation", "summary", "checks", "safety"],
    label,
  );
  if (report.version !== AUTHOR_DOCTOR_REPORT_VERSION) {
    valueError(`${label} version`, `必须是 ${AUTHOR_DOCTOR_REPORT_VERSION}`);
  }
  if (report.mode !== "read-only") valueError(`${label} mode`, "必须是 read-only");
  if (!new Set(["ready", "needs-attention"]).has(report.status)) {
    valueError(`${label} status`, "不是受支持的状态");
  }

  const observation = report.observation;
  assertPlainObject(observation, `${label} observation`);
  assertExactKeys(
    observation,
    ["currentDirectory", "gitVersion", "identity", "nodeVersion", "npmVersion", "repository", "vault", "workspace"],
    `${label} observation`,
  );
  for (const field of ["currentDirectory", "nodeVersion"]) {
    assertNonEmptyString(observation[field], `${label} observation.${field}`);
  }
  for (const field of ["gitVersion", "npmVersion"]) {
    if (observation[field] !== null) {
      assertNonEmptyString(observation[field], `${label} observation.${field}`);
    }
  }
  if (/[ -]/u.test(observation.currentDirectory)) {
    valueError(`${label} observation.currentDirectory`, "不能包含控制字符");
  }
  if (
    expectedRoot &&
    normalizeAuthorDoctorRoot(observation.currentDirectory) !==
      normalizeAuthorDoctorRoot(expectedRoot)
  ) {
    valueError(`${label} observation.currentDirectory`, "必须是当前 Vault 根目录");
  }

  assertPlainObject(observation.identity, `${label} observation.identity`);
  assertExactKeys(
    observation.identity,
    ["emailConfigured", "nameConfigured"],
    `${label} observation.identity`,
  );
  for (const value of Object.values(observation.identity)) {
    if (typeof value !== "boolean") {
      valueError(`${label} observation.identity`, "字段必须是布尔值");
    }
  }

  assertPlainObject(observation.repository, `${label} observation.repository`);
  assertExactKeys(
    observation.repository,
    ["currentBranch", "localHead", "relation", "root", "trackingHead", "upstream"],
    `${label} observation.repository`,
  );
  for (const field of ["currentBranch", "root", "upstream"]) {
    if (observation.repository[field] !== null) {
      assertNonEmptyString(
        observation.repository[field],
        `${label} observation.repository.${field}`,
      );
    }
  }
  for (const field of ["localHead", "trackingHead"]) {
    if (observation.repository[field] !== null) {
      assertGitObjectId(
        observation.repository[field],
        `${label} observation.repository.${field}`,
      );
    }
  }
  if (
    observation.repository.relation !== null &&
    !new Set(["synchronized", "local-ahead", "behind", "diverged", "tracking-missing"]).has(
      observation.repository.relation,
    )
  ) {
    valueError(`${label} observation.repository.relation`, "不是受支持的关系");
  }

  const workspace = observation.workspace;
  assertPlainObject(workspace, `${label} observation.workspace`);
  assertExactKeys(
    workspace,
    ["dependencyExpected", "dependencyIssues", "dependencyMatching", "nodeEngine", "packageName", "paths", "scriptNames"],
    `${label} observation.workspace`,
  );
  for (const field of ["dependencyExpected", "dependencyMatching"]) {
    assertInteger(workspace[field], `${label} observation.workspace.${field}`, 0);
  }
  if (workspace.dependencyMatching > workspace.dependencyExpected) {
    valueError(`${label} observation.workspace`, "依赖匹配数不能超过声明数");
  }
  for (const field of ["nodeEngine", "packageName"]) {
    if (workspace[field] !== null) {
      assertNonEmptyString(workspace[field], `${label} observation.workspace.${field}`);
    }
  }
  for (const field of ["dependencyIssues", "scriptNames"]) {
    if (!Array.isArray(workspace[field])) {
      valueError(`${label} observation.workspace.${field}`, "必须是数组");
    }
    for (const value of workspace[field]) {
      assertNonEmptyString(value, `${label} observation.workspace.${field}`);
    }
    if (new Set(workspace[field]).size !== workspace[field].length) {
      valueError(`${label} observation.workspace.${field}`, "不能重复");
    }
  }
  if (!Array.isArray(workspace.paths)) {
    valueError(`${label} observation.workspace.paths`, "必须是数组");
  }
  if (workspace.paths.length !== AUTHOR_DOCTOR_REQUIRED_PATHS.length) {
    valueError(`${label} observation.workspace.paths`, "必须包含固定作者路径");
  }
  workspace.paths.forEach((path, index) => {
    assertPlainObject(path, `${label} observation.workspace.paths[${index}]`);
    assertExactKeys(
      path,
      ["kind", "path", "present"],
      `${label} observation.workspace.paths[${index}]`,
    );
    const expected = AUTHOR_DOCTOR_REQUIRED_PATHS[index];
    if (
      path.kind !== expected.kind ||
      path.path !== expected.path ||
      typeof path.present !== "boolean"
    ) {
      valueError(`${label} observation.workspace.paths[${index}]`, "与固定路径契约不一致");
    }
  });

  assertPlainObject(observation.vault, `${label} observation.vault`);
  assertExactKeys(
    observation.vault,
    ["obsidianDirectoryPresent", "plugin"],
    `${label} observation.vault`,
  );
  if (typeof observation.vault.obsidianDirectoryPresent !== "boolean") {
    valueError(`${label} observation.vault.obsidianDirectoryPresent`, "必须是布尔值");
  }
  if (observation.vault.plugin !== null) {
    assertPlainObject(observation.vault.plugin, `${label} observation.vault.plugin`);
    assertExactKeys(
      observation.vault.plugin,
      ["id", "isDesktopOnly", "mainPresent", "stylesPresent", "version"],
      `${label} observation.vault.plugin`,
    );
    for (const field of ["id", "version"]) {
      assertNonEmptyString(
        observation.vault.plugin[field],
        `${label} observation.vault.plugin.${field}`,
      );
    }
    for (const field of ["isDesktopOnly", "mainPresent", "stylesPresent"]) {
      if (typeof observation.vault.plugin[field] !== "boolean") {
        valueError(`${label} observation.vault.plugin.${field}`, "必须是布尔值");
      }
    }
  }

  const expectedChecks = deriveAuthorDoctorChecks(observation);
  if (!Array.isArray(report.checks) || report.checks.length !== expectedChecks.length) {
    valueError(`${label} checks`, "必须包含固定的 13 项检查");
  }
  expectedChecks.forEach((expected, index) => {
    const actual = report.checks[index];
    assertPlainObject(actual, `${label} checks[${index}]`);
    assertExactKeys(
      actual,
      ["expected", "group", "id", "label", "observed", "resolution", "status"],
      `${label} checks[${index}]`,
    );
    for (const field of ["expected", "group", "id", "label", "observed", "resolution", "status"]) {
      if (actual[field] !== expected[field]) {
        valueError(`${label} checks[${index}].${field}`, "与原始观测派生结果不一致");
      }
    }
  });

  const passed = expectedChecks.filter((item) => item.status === "pass").length;
  const attention = expectedChecks.length - passed;
  assertPlainObject(report.summary, `${label} summary`);
  assertExactKeys(
    report.summary,
    ["attention", "passed", "total"],
    `${label} summary`,
  );
  if (
    report.summary.attention !== attention ||
    report.summary.passed !== passed ||
    report.summary.total !== expectedChecks.length ||
    report.status !== (attention === 0 ? "ready" : "needs-attention")
  ) {
    valueError(`${label} summary`, "与固定检查结果不一致");
  }

  assertPlainObject(report.safety, `${label} safety`);
  assertExactKeys(
    report.safety,
    ["configurationChanged", "credentialsRead", "filesChanged", "networkChecked"],
    `${label} safety`,
  );
  for (const field of Object.keys(report.safety)) {
    if (report.safety[field] !== false) {
      valueError(`${label} safety.${field}`, "必须是 false");
    }
  }
  return report;
}

function parseContentPublishDeliveryReceipt(output) {
  let receipt;
  try {
    receipt = JSON.parse(output);
  } catch {
    throw new Error("新内容发布交付回执不是有效 JSON");
  }
  const label = "新内容发布交付回执";
  assertPlainObject(receipt, label);
  assertExactKeys(
    receipt,
    ["version", "mode", "publication", "transition", "safety"],
    label,
  );
  if (receipt.version !== CONTENT_PUBLISH_DELIVERY_RECEIPT_VERSION) {
    valueError(
      `${label} version`,
      `必须是 ${CONTENT_PUBLISH_DELIVERY_RECEIPT_VERSION}`,
    );
  }
  if (receipt.mode !== "delivered") {
    valueError(`${label} mode`, "必须是 delivered");
  }

  assertPlainObject(receipt.publication, `${label} publication`);
  const publication = receipt.publication;
  const validated = parseContentPublishDeliveryReport(
    JSON.stringify({
      version: CONTENT_PUBLISH_DELIVERY_REPORT_VERSION,
      mode: "read-only",
      observation: {
        currentBranch: "main",
        localHead: publication.commitOid,
        localRef: "refs/heads/main",
        networkChecked: false,
        trackingHead: publication.parentOid,
        trackingRef: "refs/remotes/origin/main",
      },
      relation: { ahead: 1, behind: 0, status: "pending-publication" },
      pendingPublication: publication,
      recovery: {
        action: "push-pending-publication",
        autoExecuted: false,
        command: `git push origin ${publication.commitOid}:refs/heads/main`,
      },
    }),
  );
  receipt.publication = validated.pendingPublication;

  assertPlainObject(receipt.transition, `${label} transition`);
  assertExactKeys(
    receipt.transition,
    ["before", "after", "command"],
    `${label} transition`,
  );
  for (const phase of ["before", "after"]) {
    assertPlainObject(receipt.transition[phase], `${label} transition.${phase}`);
    assertExactKeys(
      receipt.transition[phase],
      ["localHead", "relation", "trackingHead"],
      `${label} transition.${phase}`,
    );
    assertGitObjectId(
      receipt.transition[phase].localHead,
      `${label} transition.${phase}.localHead`,
    );
    assertGitObjectId(
      receipt.transition[phase].trackingHead,
      `${label} transition.${phase}.trackingHead`,
    );
  }
  if (
    receipt.transition.before.relation !== "pending-publication" ||
    receipt.transition.before.localHead !== publication.commitOid ||
    receipt.transition.before.trackingHead !== publication.parentOid
  ) {
    valueError(
      `${label} transition.before`,
      "必须绑定待交付发布 commit 与父 tracking head",
    );
  }
  if (
    receipt.transition.after.relation !== "synchronized" ||
    receipt.transition.after.localHead !== publication.commitOid ||
    receipt.transition.after.trackingHead !== publication.commitOid
  ) {
    valueError(
      `${label} transition.after`,
      "必须证明 local/tracking 都是已交付发布 commit",
    );
  }
  const expectedCommand = `git push origin ${publication.commitOid}:refs/heads/main`;
  if (receipt.transition.command !== expectedCommand) {
    valueError(
      `${label} transition.command`,
      "必须是绑定已验证发布 commit 的精确非强制 push",
    );
  }

  assertPlainObject(receipt.safety, `${label} safety`);
  assertExactKeys(
    receipt.safety,
    [
      "fetchExecuted",
      "headStable",
      "indexStable",
      "manifestStable",
      "rebaseExecuted",
      "resetExecuted",
      "worktreeStable",
    ],
    `${label} safety`,
  );
  const expectedSafety = {
    fetchExecuted: false,
    headStable: true,
    indexStable: true,
    manifestStable: true,
    rebaseExecuted: false,
    resetExecuted: false,
    worktreeStable: true,
  };
  for (const [field, expected] of Object.entries(expectedSafety)) {
    if (receipt.safety[field] !== expected) {
      valueError(`${label} safety.${field}`, `必须是 ${expected}`);
    }
  }
  return receipt;
}

function parseContentReviewDeliveryReceipt(output) {
  let receipt;
  try {
    receipt = JSON.parse(output);
  } catch {
    throw new Error("正式复核交付回执不是有效 JSON");
  }
  assertPlainObject(receipt, "正式复核交付回执");
  assertExactKeys(
    receipt,
    ["version", "mode", "review", "transition", "safety"],
    "正式复核交付回执",
  );
  if (receipt.version !== CONTENT_REVIEW_DELIVERY_RECEIPT_VERSION) {
    valueError(
      "正式复核交付回执 version",
      `必须是 ${CONTENT_REVIEW_DELIVERY_RECEIPT_VERSION}`,
    );
  }
  if (receipt.mode !== "delivered") {
    valueError("正式复核交付回执 mode", "必须是 delivered");
  }

  assertPlainObject(receipt.review, "正式复核交付回执 review");
  assertExactKeys(
    receipt.review,
    [
      "blobOid",
      "commitOid",
      "parentOid",
      "slug",
      "sourcePath",
      "subject",
      "treeOid",
    ],
    "正式复核交付回执 review",
  );
  for (const field of ["blobOid", "commitOid", "parentOid", "treeOid"]) {
    assertGitObjectId(
      receipt.review[field],
      `正式复核交付回执 review.${field}`,
    );
  }
  if (
    typeof receipt.review.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(receipt.review.slug)
  ) {
    valueError("正式复核交付回执 review.slug", "必须是稳定 slug");
  }
  const expectedSource = new RegExp(
    `^content/(?:posts|projects)/${receipt.review.slug}\\.md$`,
    "u",
  );
  if (!expectedSource.test(receipt.review.sourcePath)) {
    valueError("正式复核交付回执 review.sourcePath", "必须与 slug 严格对应");
  }
  if (receipt.review.subject !== `content: review ${receipt.review.slug}`) {
    valueError("正式复核交付回执 review.subject", "必须与 slug 严格对应");
  }

  assertPlainObject(receipt.transition, "正式复核交付回执 transition");
  assertExactKeys(
    receipt.transition,
    ["before", "after", "command"],
    "正式复核交付回执 transition",
  );
  for (const phase of ["before", "after"]) {
    assertPlainObject(
      receipt.transition[phase],
      `正式复核交付回执 transition.${phase}`,
    );
    assertExactKeys(
      receipt.transition[phase],
      ["localHead", "relation", "trackingHead"],
      `正式复核交付回执 transition.${phase}`,
    );
    assertGitObjectId(
      receipt.transition[phase].localHead,
      `正式复核交付回执 transition.${phase}.localHead`,
    );
    assertGitObjectId(
      receipt.transition[phase].trackingHead,
      `正式复核交付回执 transition.${phase}.trackingHead`,
    );
  }
  if (
    receipt.transition.before.relation !== "pending-review" ||
    receipt.transition.before.localHead !== receipt.review.commitOid ||
    receipt.transition.before.trackingHead !== receipt.review.parentOid
  ) {
    valueError(
      "正式复核交付回执 transition.before",
      "必须绑定待交付 commit 与父 tracking head",
    );
  }
  if (
    receipt.transition.after.relation !== "synchronized" ||
    receipt.transition.after.localHead !== receipt.review.commitOid ||
    receipt.transition.after.trackingHead !== receipt.review.commitOid
  ) {
    valueError(
      "正式复核交付回执 transition.after",
      "必须证明 local/tracking 都是已交付 commit",
    );
  }
  const expectedCommand = `git push origin ${receipt.review.commitOid}:refs/heads/main`;
  if (receipt.transition.command !== expectedCommand) {
    valueError(
      "正式复核交付回执 transition.command",
      "必须是绑定已验证 commit 的精确非强制 push",
    );
  }

  assertPlainObject(receipt.safety, "正式复核交付回执 safety");
  assertExactKeys(
    receipt.safety,
    [
      "fetchExecuted",
      "headStable",
      "indexStable",
      "rebaseExecuted",
      "resetExecuted",
      "worktreeStable",
    ],
    "正式复核交付回执 safety",
  );
  const expectedSafety = {
    fetchExecuted: false,
    headStable: true,
    indexStable: true,
    rebaseExecuted: false,
    resetExecuted: false,
    worktreeStable: true,
  };
  for (const [field, expected] of Object.entries(expectedSafety)) {
    if (receipt.safety[field] !== expected) {
      valueError(
        `正式复核交付回执 safety.${field}`,
        `必须是 ${expected}`,
      );
    }
  }
  return receipt;
}

function remainingLabel(remainingDays) {
  return remainingDays >= 0
    ? `剩余 ${remainingDays} 天`
    : `逾期 ${Math.abs(remainingDays)} 天`;
}

function createMetric(container, label, value, className) {
  const metric = container.createEl("div", {
    cls: `myblog-maintenance__metric ${className ?? ""}`.trim(),
  });
  metric.createEl("dt", { text: label });
  metric.createEl("dd", { text: String(value) });
  return metric;
}

function createProofRow(container, label, value, options = {}) {
  const row = container.createEl("div", {
    cls: "myblog-review-proof__row",
  });
  if (options.state) row.setAttr("data-state", options.state);
  row.createEl("dt", { text: label });
  const detail = row.createEl("dd");
  if (options.code) detail.createEl("code", { text: String(value) });
  else detail.setText(String(value));
  return row;
}

function createDeferredProofRow(container, git) {
  const row = container.createEl("div", {
    cls: "myblog-review-proof__row myblog-review-proof__deferred",
  });
  row.setAttr("data-state", "deferred");
  row.createEl("dt", { text: "隔离作者工作" });
  const detail = row.createEl("dd");
  detail.createEl("p", {
    cls: "myblog-review-proof__deferred-label",
    text: "DEFERRED / NOT IN COMMIT",
  });
  detail.createEl("p", {
    cls: "myblog-review-proof__deferred-summary",
    text: git.deferredPaths.length
      ? `${git.deferredPaths.length} 条 · 保留在本地，不进入本次提交`
      : "0 条 · 没有并行作者工作",
  });
  if (git.deferredPaths.length === 0) return row;

  const untracked = new Set(git.untrackedPaths);
  const list = detail.createEl("ul", {
    cls: "myblog-review-proof__path-list",
  });
  for (const path of git.deferredPaths) {
    const item = list.createEl("li");
    item.createEl("span", {
      cls: "myblog-review-proof__path-state",
      text: untracked.has(path) ? "UNTRACKED" : "MODIFIED",
    });
    item.createEl("code", { text: path });
  }
  return row;
}

function createCandidateProofRow(container, candidate) {
  const row = container.createEl("div", {
    cls: "myblog-review-proof__row myblog-review-proof__candidate",
  });
  row.setAttr("data-state", "candidate");
  row.createEl("dt", { text: "内容候选" });
  const detail = row.createEl("dd");
  detail.createEl("p", {
    cls: "myblog-review-proof__candidate-label",
    text: "CANDIDATE / GATE-STABLE",
  });
  const digest = detail.createEl("code", {
    cls: "myblog-review-proof__candidate-digest",
    text: `sha256:${candidate.digest.slice(0, 12)}…${candidate.digest.slice(-8)}`,
  });
  digest.setAttr("title", `sha256:${candidate.digest}`);
  digest.setAttr(
    "aria-label",
    `完整内容候选 SHA-256：${candidate.digest}`,
  );
  detail.createEl("p", {
    cls: "myblog-review-proof__candidate-note",
    text: "门前与完整质量门后的字节一致。",
  });
  return row;
}

class DraftCreationModal extends Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("myblog-draft-create");
    contentEl.createEl("p", {
      cls: "myblog-draft-create__eyebrow",
      text: "DRAFT ORIGIN / LOCAL ONLY",
    });
    contentEl.createEl("h2", {
      cls: "myblog-draft-create__title",
      text: "新建博客草稿",
    });
    contentEl.createEl("p", {
      cls: "myblog-draft-create__boundary",
      text: "只创建一个本地 inbox Markdown 并尝试打开；不会发布、提交或联网。",
    });

    const form = contentEl.createEl("div", {
      cls: "myblog-draft-create__form",
    });
    const kindField = form.createEl("label", {
      cls: "myblog-draft-create__field",
    });
    kindField.createEl("span", {
      cls: "myblog-draft-create__label",
      text: "内容类型",
    });
    const kind = kindField.createEl("select");
    kind.setAttr("aria-label", "内容类型");
    for (const [value, config] of Object.entries(DRAFT_CREATION_KINDS)) {
      const option = kind.createEl("option", { text: config.label });
      option.value = value;
    }
    kind.value = "article";
    kindField.createEl("span", {
      cls: "myblog-draft-create__hint",
      text: "选择后只读取对应的受信模板。",
    });

    const titleField = form.createEl("label", {
      cls: "myblog-draft-create__field",
    });
    titleField.createEl("span", {
      cls: "myblog-draft-create__label",
      text: "标题",
    });
    const title = titleField.createEl("input");
    title.setAttr("aria-label", "标题");
    title.setAttr("maxlength", String(DRAFT_TITLE_MAX_LENGTH));
    title.setAttr("placeholder", "例如：用 TypeScript 构建内容管线");
    title.setAttr("type", "text");
    titleField.createEl("span", {
      cls: "myblog-draft-create__hint",
      text: "写入 frontmatter；引号与反斜杠会安全转义。",
    });

    const slugField = form.createEl("label", {
      cls: "myblog-draft-create__field",
    });
    slugField.createEl("span", {
      cls: "myblog-draft-create__label",
      text: "英文 slug",
    });
    const slug = slugField.createEl("input");
    slug.setAttr("aria-label", "英文 slug");
    slug.setAttr("autocapitalize", "none");
    slug.setAttr("autocomplete", "off");
    slug.setAttr("maxlength", String(DRAFT_SLUG_MAX_LENGTH));
    slug.setAttr("placeholder", "typescript-content-pipeline");
    slug.setAttr("spellcheck", "false");
    slug.setAttr("type", "text");
    slugField.createEl("span", {
      cls: "myblog-draft-create__hint",
      text: "仅限小写英文、数字和单个连字符；文件名是草稿的唯一 slug 身份。",
    });

    const error = form.createEl("p", {
      cls: "myblog-draft-create__error",
    });
    error.setAttr("aria-live", "polite");
    error.setAttr("role", "alert");

    const actions = form.createEl("div", {
      cls: "modal-button-container myblog-draft-create__actions",
    });
    const cancel = actions.createEl("button", { text: "取消" });
    cancel.setAttr("type", "button");
    const submit = actions.createEl("button", {
      cls: "mod-cta",
      text: "创建草稿",
    });
    submit.setAttr("type", "button");

    cancel.addEventListener("click", () => this.close());
    submit.addEventListener("click", async () => {
      if (this.submitting) return;
      this.submitting = true;
      error.setText("");
      for (const control of [kind, title, slug, cancel, submit]) {
        control.disabled = true;
      }
      let completed = false;
      try {
        const result = await this.plugin.createDraftFromTemplate({
          kind: kind.value,
          slug: slug.value,
          title: title.value,
        });
        completed = true;
        this.close();
        if (result.opened) {
          new Notice(`草稿已创建并打开：${result.path}`, 5000);
        } else {
          new Notice(
            `草稿已创建，但无法自动打开：${result.path}。请从文件列表手动打开。`,
            10000,
          );
        }
      } catch (creationError) {
        const message = creationError instanceof Error
          ? creationError.message
          : "草稿创建失败；未覆盖任何文件。";
        error.setText(message);
      } finally {
        if (!completed) {
          this.submitting = false;
          for (const control of [kind, title, slug, cancel, submit]) {
            control.disabled = false;
          }
        }
      }
    });

    title.focus();
  }
}

class DraftRenameModal extends Modal {
  constructor(plugin, identity) {
    super(plugin.app);
    this.identity = identity;
    this.plugin = plugin;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl, identity } = this;
    contentEl.empty();
    contentEl.addClass("myblog-draft-rename");
    contentEl.createEl("p", {
      cls: "myblog-draft-rename__eyebrow",
      text: "DRAFT IDENTITY / FILE OWNED",
    });
    contentEl.createEl("h2", {
      cls: "myblog-draft-rename__title",
      text: "重命名当前草稿",
    });
    contentEl.createEl("p", {
      cls: "myblog-draft-rename__boundary",
      text: "只改变 inbox 文件名；会按 Obsidian 设置更新内部链接；不会发布、提交或联网。",
    });

    const source = contentEl.createEl("p", {
      cls: "myblog-draft-rename__source",
    });
    source.createEl("span", { text: "当前文件" });
    source.createEl("code", { text: identity.sourcePath });

    const transition = contentEl.createEl("div", {
      cls: "myblog-draft-rename__transition",
    });
    const current = transition.createEl("div", {
      cls: "myblog-draft-rename__node",
    });
    current.createEl("span", { text: "CURRENT" });
    current.createEl("code", { text: identity.sourceSlug });
    transition.createEl("span", {
      cls: "myblog-draft-rename__arrow",
      text: "→",
    });
    const target = transition.createEl("div", {
      cls: "myblog-draft-rename__node myblog-draft-rename__node--target",
    });
    target.createEl("span", { text: "TARGET" });
    const targetCode = target.createEl("code", { text: identity.sourceSlug });

    const form = contentEl.createEl("div", {
      cls: "myblog-draft-rename__form",
    });
    const field = form.createEl("label", {
      cls: "myblog-draft-rename__field",
    });
    field.createEl("span", {
      cls: "myblog-draft-rename__label",
      text: "新的英文 slug",
    });
    const slug = field.createEl("input");
    slug.setAttr("aria-label", "新的英文 slug");
    slug.setAttr("autocapitalize", "none");
    slug.setAttr("autocomplete", "off");
    slug.setAttr("maxlength", String(DRAFT_SLUG_MAX_LENGTH));
    slug.setAttr("spellcheck", "false");
    slug.setAttr("type", "text");
    slug.value = identity.sourceSlug;
    field.createEl("span", {
      cls: "myblog-draft-rename__hint",
      text: "只接受小写英文、数字和单个连字符；正式内容中的同名身份也会阻断。",
    });
    slug.addEventListener("input", () => {
      targetCode.setText(slug.value.trim() || "new-slug");
    });

    const error = form.createEl("p", {
      cls: "myblog-draft-rename__error",
    });
    error.setAttr("aria-live", "polite");
    error.setAttr("role", "alert");

    const actions = form.createEl("div", {
      cls: "modal-button-container myblog-draft-rename__actions",
    });
    const cancel = actions.createEl("button", { text: "取消" });
    cancel.setAttr("type", "button");
    const submit = actions.createEl("button", {
      cls: "mod-cta",
      text: "重命名草稿",
    });
    submit.setAttr("type", "button");

    cancel.addEventListener("click", () => this.close());
    submit.addEventListener("click", async () => {
      if (this.submitting) return;
      this.submitting = true;
      error.setText("");
      for (const control of [slug, cancel, submit]) control.disabled = true;
      let completed = false;
      try {
        const result = await this.plugin.renameInboxDraft({
          sourcePath: identity.sourcePath,
          targetSlug: slug.value,
        });
        completed = true;
        this.close();
        if (result.status === "renamed") {
          new Notice(`草稿已重命名：${result.targetPath}`, 5000);
        } else {
          new Notice(
            `改名结果不确定：请检查 ${result.sourcePath} 与 ${result.targetPath}；不会自动重试。`,
            15000,
          );
        }
      } catch (renameError) {
        const message = renameError instanceof Error
          ? renameError.message
          : "草稿改名前置检查失败。";
        error.setText(message);
      } finally {
        if (!completed) {
          this.submitting = false;
          for (const control of [slug, cancel, submit]) control.disabled = false;
        }
      }
    });

    slug.focus();
  }
}

class DraftIdentityModal extends Modal {
  constructor(plugin, report) {
    super(plugin.app);
    this.plugin = plugin;
    this.report = report;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl, report } = this;
    contentEl.empty();
    contentEl.addClass("myblog-draft-identity");
    contentEl.createEl("p", {
      cls: "myblog-draft-identity__eyebrow",
      text: "DRAFT IDENTITY / LOCAL EVIDENCE",
    });
    contentEl.createEl("h2", {
      cls: "myblog-draft-identity__title",
      text: "检查当前草稿身份",
    });
    contentEl.createEl("p", {
      cls: "myblog-draft-identity__boundary",
      text: "只读检查文件名、frontmatter 与内容命名空间；只有完全匹配的旧式 slug 可以被移除。不会发布、提交或联网。",
    });

    const status = contentEl.createEl("p", {
      cls: "myblog-draft-identity__status",
      text: report.statusToken,
    });
    status.setAttr("data-state", report.state);

    const source = contentEl.createEl("p", {
      cls: "myblog-draft-identity__source",
    });
    source.createEl("span", { text: "当前文件" });
    source.createEl("code", { text: report.sourcePath });

    const signature = contentEl.createEl("div", {
      cls: "myblog-draft-identity__signature",
    });
    const fileNode = signature.createEl("div", {
      cls: "myblog-draft-identity__node",
    });
    fileNode.createEl("span", { text: "FILE" });
    fileNode.createEl("code", { text: report.sourceSlug });
    signature.createEl("span", {
      cls: "myblog-draft-identity__link",
      text: "FILE ⇄ FRONTMATTER",
    });
    const frontmatterNode = signature.createEl("div", {
      cls: "myblog-draft-identity__node myblog-draft-identity__node--frontmatter",
    });
    frontmatterNode.createEl("span", { text: "FRONTMATTER" });
    frontmatterNode.createEl("code", { text: report.frontmatterSlugLabel });

    contentEl.createEl("p", {
      cls: "myblog-draft-identity__reason",
      text: report.reason,
    });

    const evidence = contentEl.createEl("dl", {
      cls: "myblog-draft-identity__evidence",
    });
    for (const item of report.evidence) {
      const row = evidence.createEl("div", {
        cls: "myblog-draft-identity__evidence-row",
      });
      row.setAttr("data-state", item.state);
      row.createEl("dt", { text: item.label });
      row.createEl("dd", { text: item.value });
    }

    const error = contentEl.createEl("p", {
      cls: "myblog-draft-identity__error",
    });
    error.setAttr("aria-live", "polite");
    error.setAttr("role", "alert");

    const actions = contentEl.createEl("div", {
      cls: "modal-button-container myblog-draft-identity__actions",
    });
    const close = actions.createEl("button", { text: "关闭" });
    close.setAttr("type", "button");
    close.addEventListener("click", () => this.close());

    if (!report.cleanupAllowed) return;
    const cleanup = actions.createEl("button", {
      cls: "mod-cta",
      text: "移除冗余 slug",
    });
    cleanup.setAttr("type", "button");
    cleanup.addEventListener("click", async () => {
      if (this.submitting) return;
      this.submitting = true;
      error.setText("");
      close.disabled = true;
      cleanup.disabled = true;
      let completed = false;
      try {
        const result = await this.plugin.cleanupLegacyDraftIdentity({
          observedContent: report.observedContent,
          sourcePath: report.sourcePath,
        });
        completed = true;
        this.close();
        if (result.status === "cleaned") {
          new Notice(`冗余 slug 已移除：${result.sourcePath}`, 5000);
        } else {
          new Notice(
            `清理结果不确定：请重新检查 ${result.sourcePath}；不会自动重试。`,
            15000,
          );
        }
      } catch (cleanupError) {
        error.setText(
          cleanupError instanceof Error
            ? cleanupError.message
            : "草稿身份清理前置检查失败。",
        );
      } finally {
        if (!completed) {
          this.submitting = false;
          close.disabled = false;
          cleanup.disabled = false;
        }
      }
    });
  }
}

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

class DraftIntentModal extends Modal {
  constructor(app, evidence) {
    super(app);
    this.evidence = evidence;
  }

  onOpen() {
    const { contentEl } = this;
    const { entry, reportDate } = this.evidence;
    contentEl.empty();
    contentEl.addClass("myblog-draft-intent");
    contentEl.createEl("p", {
      cls: "myblog-draft-intent__eyebrow",
      text: "AUTHOR INTENT / LOCAL EVIDENCE",
    });
    contentEl.createEl("h2", { text: "当前草稿发布意图" });
    contentEl.createEl("p", {
      cls: "myblog-draft-intent__boundary",
      text: "只读复用正式发布解析与收件箱就绪证据；不会修改、发布、提交、推送或联网。",
    });

    const signature = contentEl.createDiv({ cls: "myblog-draft-intent__signature" });
    const source = signature.createDiv({ cls: "myblog-draft-intent__endpoint" });
    source.createEl("span", { text: "DRAFT" });
    source.createEl("code", { text: entry.sourcePath });
    signature.createEl("strong", {
      cls: "myblog-draft-intent__arrow",
      text: "DRAFT → PUBLIC",
    });
    const target = signature.createDiv({ cls: "myblog-draft-intent__endpoint" });
    target.createEl("span", { text: "PUBLIC" });
    target.createEl("code", { text: entry.targetPath ?? "UNPROVEN" });

    const statusToken = entry.state === "ready"
      ? "READY / PUBLIC ON PASS"
      : entry.state === "scheduled"
        ? "SCHEDULED / FUTURE DATE"
        : `HOLD / ${entry.issues.length} BLOCKER${entry.issues.length === 1 ? "" : "S"}`;
    const status = contentEl.createEl("p", {
      cls: "myblog-draft-intent__status",
      text: statusToken,
    });
    status.setAttr("data-state", entry.state);

    const dateSemantics = !entry.publishedAt
      ? "UNPROVEN"
      : entry.publishedAt > reportDate
        ? `${entry.publishedAt} · SCHEDULED`
        : `${entry.publishedAt} · NOW`;
    const evidence = contentEl.createEl("dl", {
      cls: "myblog-draft-intent__evidence",
    });
    for (const [term, value] of [
      ["TYPE", entry.contentType?.toUpperCase() ?? "UNPROVEN"],
      ["DATE", dateSemantics],
      [
        "MEDIA",
        `${entry.attachments.length} ATTACHMENT${entry.attachments.length === 1 ? "" : "S"}`,
      ],
      ["LINKS", `${entry.internalLinkCount} REFERENCES`],
    ]) {
      const row = evidence.createDiv({ cls: "myblog-draft-intent__evidence-row" });
      row.createEl("dt", { text: term });
      row.createEl("dd", { text: value });
    }

    if (entry.attachments.length > 0) {
      const media = contentEl.createEl("section", {
        cls: "myblog-draft-intent__media",
      });
      const mediaHeader = media.createDiv({ cls: "myblog-draft-intent__media-header" });
      mediaHeader.createEl("h3", { text: "MEDIA TRACE" });
      mediaHeader.createEl("span", {
        text: `${entry.attachments.length} ATTACHMENT${entry.attachments.length === 1 ? "" : "S"}`,
      });
      const list = media.createEl("ol");
      for (const attachment of entry.attachments) {
        const item = list.createEl("li");
        const summary = item.createDiv({ cls: "myblog-draft-intent__media-summary" });
        summary.createEl("span", {
          text: !attachment.preparation
            ? "UNPROVEN"
            : attachment.preparation.optimized
              ? "OPTIMIZED"
              : "PRESERVED",
        });
        summary.createEl("span", {
          text: attachment.preparation
            ? formatDraftMediaChange(attachment.preparation)
            : "MEDIA ENVELOPE UNAVAILABLE",
        });
        const mapping = item.createDiv({ cls: "myblog-draft-intent__media-mapping" });
        mapping.createEl("code", { text: attachment.sourcePath });
        mapping.createEl("strong", { text: "→ REPOSITORY" });
        mapping.createEl("code", { text: attachment.targetPath });
        const publicTarget = item.createDiv({ cls: "myblog-draft-intent__media-public" });
        publicTarget.createEl("span", { text: "PUBLIC" });
        publicTarget.createEl("code", { text: attachment.publicUrl });
        if (attachment.preparation) {
          const specification = item.createDiv({
            cls: "myblog-draft-intent__media-specification",
          });
          specification.createEl("span", {
            text: formatDraftMediaInspection(attachment.preparation.source),
          });
          specification.createEl("strong", { text: "→" });
          specification.createEl("span", {
            text: formatDraftMediaInspection(attachment.preparation.output),
          });
        }
      }
    }

    if (entry.internalLinks.length > 0) {
      const links = contentEl.createEl("section", {
        cls: "myblog-draft-intent__links",
      });
      const linksHeader = links.createDiv({ cls: "myblog-draft-intent__links-header" });
      linksHeader.createEl("h3", { text: "LINK TRACE" });
      linksHeader.createEl("span", { text: `${entry.internalLinks.length} VERIFIED` });
      const list = links.createEl("ol");
      for (const link of entry.internalLinks) {
        const item = list.createEl("li");
        const trace = item.createDiv({ cls: "myblog-draft-intent__link-trace" });
        trace.createEl("span", { text: link.kind.toUpperCase() });
        trace.createEl("code", { text: link.target });
        trace.createEl("span", {
          text: `${link.sourceLines.map((line) => `L${line}`).join(", ")}${link.occurrences > 1 ? ` · ×${link.occurrences}` : ""}`,
        });
      }
    }

    if (entry.issues.length > 0) {
      const blockers = contentEl.createEl("section", {
        cls: "myblog-draft-intent__blockers",
      });
      blockers.createEl("h3", { text: "阻塞证据" });
      const list = blockers.createEl("ol");
      for (const issue of entry.issues) {
        list.createEl("li", {
          text: `[${issue.code}] ${issue.message}${issue.path ? ` · ${issue.path}` : ""}`,
        });
      }
    }

    const actions = contentEl.createDiv({ cls: "myblog-draft-intent__actions" });
    const close = actions.createEl("button", { text: "关闭" });
    close.setAttr("type", "button");
    close.addEventListener("click", () => this.close());
  }
}

class ContentMaintenanceTextModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description:
        "结构化视图不可用，以下为只读纯文本证据；不会修改 reviewedAt、内容、提交或推送文件。",
      report,
      title: "已发布内容复核台账 · 纯文本",
    });
  }
}

class ContentReviewProofTextModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description:
        "结构化 Author Proof 不可用，以下为重新执行后的只读文本证据；同步仍需单独运行。",
      report,
      title: "正式内容复核证据 · 纯文本",
    });
  }
}

class ContentReviewDeliveryTextModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description:
        "结构化交付证据不可用，以下为重新执行后的本地只读文本；没有 fetch、push 或历史修改。",
      report,
      title: "正式内容复核交付状态 · 纯文本",
    });
  }
}

class ContentPublishDeliveryTextModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description:
        "结构化发布交付证据不可用，以下为重新执行后的本地只读文本；没有 fetch、push 或历史修改。",
      report,
      title: "新内容发布交付状态 · 纯文本",
    });
  }
}

class ContentDeliveryTriageTextModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description:
        "结构化分诊证据不可用，以下为重新执行后的本地只读文本；没有 fetch、push 或路由命令执行。",
      report,
      title: "Git 交付恢复分诊 · 纯文本",
    });
  }
}

class AuthorDoctorTextModal extends ReadOnlyReportModal {
  constructor(app, report, transaction = null) {
    super(app, {
      description: transaction
        ? `结构化作者环境证据不可用；${transaction.label}（${transaction.sourcePath}）未启动。以下为重新执行后的本地只读文本，不会安装依赖、修改配置、读取凭据或访问网络。`
        : "结构化作者环境证据不可用，以下为重新执行后的本地只读文本；不会安装依赖、修改配置、读取凭据或访问网络。",
      report,
      title: transaction
        ? "发布前置联锁 · 纯文本"
        : "本机发布环境自检 · 纯文本",
    });
  }
}

function createAuthorDoctorCheck(container, check) {
  const row = container.createEl("div", {
    cls: "myblog-author-doctor__check",
  });
  row.setAttr("data-state", check.status);
  const term = row.createEl("dt");
  term.createEl("span", {
    cls: "myblog-author-doctor__check-state",
    text: check.status === "pass" ? "PASS" : "ATTENTION",
  });
  term.createEl("span", { text: check.label });
  const detail = row.createEl("dd");
  detail.createEl("code", { text: check.observed });
  detail.createEl("p", {
    cls: "myblog-author-doctor__expected",
    text: `Expected · ${check.expected}`,
  });
  if (check.resolution) {
    detail.createEl("p", {
      cls: "myblog-author-doctor__resolution",
      text: `修复 · ${check.resolution}`,
    });
  }
  return row;
}

class AuthorDoctorModal extends Modal {
  constructor(app, report, transaction = null) {
    super(app);
    this.report = report;
    this.transaction = transaction;
  }

  onOpen() {
    const { contentEl, report, transaction } = this;
    const ready = report.status === "ready";
    const groups = [
      ["runtime", "RUNTIME"],
      ["git", "GIT"],
      ["workspace", "WORKSPACE"],
      ["vault", "VAULT"],
    ];
    contentEl.empty();
    contentEl.addClass("myblog-author-doctor");
    contentEl.setAttr("data-status", report.status);
    contentEl.setAttr("data-interlock", transaction ? "held" : "inspection");
    contentEl.createEl("p", {
      cls: "myblog-author-doctor__eyebrow",
      text: "AUTHOR PREFLIGHT / LOCAL ONLY",
    });
    contentEl.createEl("h2", {
      cls: "myblog-author-doctor__title",
      text: "本机发布环境自检",
    });
    contentEl.createEl("p", {
      cls: "myblog-author-doctor__boundary",
      text: "只读取本机运行时、Git、工作区与 Vault 的发布前置条件；不会安装依赖、修改配置、读取凭据或访问网络。",
    });

    if (transaction) {
      const interlock = contentEl.createEl("section", {
        cls: "myblog-author-doctor__interlock",
      });
      interlock.setAttr(
        "aria-label",
        `${transaction.label}已由作者环境联锁停止`,
      );
      interlock.createEl("p", {
        cls: "myblog-author-doctor__interlock-label",
        text: "TRANSACTION INTERLOCK / HELD",
      });
      const detail = interlock.createEl("p", {
        cls: "myblog-author-doctor__interlock-detail",
      });
      detail.createEl("span", { text: `${transaction.label} · 未启动` });
      detail.createEl("code", { text: transaction.sourcePath });
    }

    const circuit = contentEl.createEl("section", {
      cls: "myblog-author-doctor__circuit",
    });
    circuit.setAttr(
      "aria-label",
      `作者发布前电路：${ready ? "AUTHOR READY" : "HOLD"}`,
    );
    circuit.createEl("p", {
      cls: "myblog-author-doctor__circuit-label",
      text: `PREFLIGHT CIRCUIT / ${ready ? "AUTHOR READY" : "HOLD"}`,
    });
    const stations = circuit.createEl("div", {
      cls: "myblog-author-doctor__stations",
    });
    for (const [group, label] of groups) {
      const checks = report.checks.filter((item) => item.group === group);
      const passed = checks.filter((item) => item.status === "pass").length;
      const stationReady = passed === checks.length;
      const station = stations.createEl("div", {
        cls: "myblog-author-doctor__station",
      });
      station.setAttr("data-state", stationReady ? "pass" : "attention");
      station.createEl("p", {
        cls: "myblog-author-doctor__station-label",
        text: `${label} / ${stationReady ? "PASS" : "HOLD"}`,
      });
      station.createEl("p", {
        cls: "myblog-author-doctor__station-count",
        text: `${passed}/${checks.length}`,
      });
    }
    circuit.createEl("p", {
      cls: "myblog-author-doctor__endpoint",
      text: ready ? "AUTHOR READY" : "AUTHOR HOLD",
    });
    circuit.createEl("p", {
      cls: "myblog-author-doctor__summary",
      text: `${report.summary.passed} PASS / ${report.summary.attention} ATTENTION`,
    });

    const ledger = contentEl.createEl("section", {
      cls: "myblog-author-doctor__ledger",
    });
    ledger.setAttr("aria-label", "作者发布环境检查证据");
    for (const [group, label] of groups) {
      const section = ledger.createEl("section", {
        cls: "myblog-author-doctor__group",
      });
      section.createEl("h3", { text: label });
      const list = section.createEl("dl");
      for (const item of report.checks.filter((check) => check.group === group)) {
        createAuthorDoctorCheck(list, item);
      }
    }

    contentEl.createEl("p", {
      cls: "myblog-author-doctor__note",
      text: "该自检只证明本机前置条件；不会安装依赖、修改配置、读取凭据或访问网络，也不替代 content status、delivery status 或 release:check。",
    });
  }
}

function createDeliveryRow(container, label, value, options = {}) {
  const row = container.createEl("div", {
    cls: "myblog-review-delivery__row",
  });
  if (options.state) row.setAttr("data-state", options.state);
  row.createEl("dt", { text: label });
  const detail = row.createEl("dd");
  if (options.code) detail.createEl("code", { text: String(value) });
  else detail.setText(String(value));
  return row;
}

function shortGitObjectId(oid) {
  return oid ? `${oid.slice(0, 12)}…${oid.slice(-8)}` : "MISSING";
}

function createTriageRow(container, label, value, options = {}) {
  const row = container.createEl("div", {
    cls: "myblog-delivery-triage__row",
  });
  if (options.state) row.setAttr("data-state", options.state);
  row.createEl("dt", { text: label });
  const detail = row.createEl("dd");
  if (options.code) detail.createEl("code", { text: String(value) });
  else detail.setText(String(value));
  return row;
}

class ContentDeliveryTriageModal extends Modal {
  constructor(app, report) {
    super(app);
    this.report = report;
  }

  onOpen() {
    const { contentEl, report } = this;
    const activeRoute = report.route.kind;
    const routeLabel = activeRoute === "review"
      ? "REVIEW ROUTE"
      : activeRoute === "publication"
        ? "PUBLICATION ROUTE"
        : activeRoute === "inspect"
          ? "INSPECT ROUTE"
          : "CLEAR";
    contentEl.empty();
    contentEl.addClass("myblog-delivery-triage");
    contentEl.setAttr("data-status", report.relation.status);
    contentEl.setAttr("data-route", activeRoute);
    contentEl.createEl("p", {
      cls: "myblog-delivery-triage__eyebrow",
      text: "DELIVERY TRIAGE / READ ONLY",
    });
    contentEl.createEl("h2", {
      cls: "myblog-delivery-triage__title",
      text: "Git 交付恢复分诊",
    });
    contentEl.createEl("p", {
      cls: "myblog-delivery-triage__boundary",
      text: "只读取同一个本地 main、tracking ref 与 HEAD commit 快照；没有 fetch、push、历史修改，也不会运行分诊结果中的命令。",
    });

    const switchyard = contentEl.createEl("section", {
      cls: "myblog-delivery-triage__switchyard",
    });
    switchyard.setAttr("aria-label", `Git 交付分诊结果：${routeLabel}`);
    switchyard.createEl("p", {
      cls: "myblog-delivery-triage__switchyard-label",
      text: `DELIVERY SWITCHYARD / ${routeLabel}`,
    });
    const head = switchyard.createEl("div", {
      cls: "myblog-delivery-triage__head",
    });
    head.createEl("span", { text: "OBSERVED LOCAL MAIN" });
    head.createEl("code", {
      text: shortGitObjectId(report.observation.localHead),
    });
    const branches = switchyard.createEl("div", {
      cls: "myblog-delivery-triage__branches",
    });
    for (const branch of ["review", "publication", "inspect"]) {
      const matched = activeRoute === branch;
      const node = branches.createEl("div", {
        cls: "myblog-delivery-triage__branch",
      });
      node.setAttr("data-active", matched ? "true" : "false");
      node.createEl("span", {
        text: `${branch.toUpperCase()} / ${matched ? "MATCHED" : "STANDBY"}`,
      });
    }

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-delivery-triage__ledger",
    });
    const statusLabel = activeRoute === "review"
      ? "PENDING REVIEW / EXACT COMMIT"
      : activeRoute === "publication"
        ? "PENDING PUBLICATION / EXACT COMMIT"
        : activeRoute === "none"
          ? "SYNCHRONIZED / NO PENDING DELIVERY"
          : `INSPECT / ${report.relation.status.toUpperCase()}`;
    createTriageRow(ledger, "分诊结果", statusLabel, {
      state: activeRoute === "inspect" ? "inspect" : activeRoute,
    });
    createTriageRow(
      ledger,
      "提交关系",
      `behind ${report.relation.behind ?? "unknown"} · ahead ${report.relation.ahead ?? "unknown"}`,
      { code: true },
    );
    createTriageRow(
      ledger,
      "当前分支",
      report.observation.currentBranch ?? "detached HEAD",
      { code: true },
    );
    if (report.pending?.kind === "review") {
      const review = report.pending.review;
      createTriageRow(ledger, "正式内容", review.sourcePath, { code: true });
      createTriageRow(ledger, "提交声明", review.subject, { code: true });
      createTriageRow(ledger, "commit", review.commitOid, { code: true });
      createTriageRow(ledger, "tree", review.treeOid, { code: true });
      createTriageRow(ledger, "content blob", review.blobOid, { code: true });
    } else if (report.pending?.kind === "publication") {
      const publication = report.pending.publication;
      createTriageRow(ledger, "内容标题", publication.title);
      createTriageRow(ledger, "正式内容", publication.targetPath, {
        code: true,
      });
      createTriageRow(
        ledger,
        "发布包",
        `${publication.changes.length} paths · ${publication.attachmentCount} media`,
        { code: true },
      );
      createTriageRow(ledger, "提交声明", publication.subject, { code: true });
      createTriageRow(ledger, "commit", publication.commitOid, { code: true });
      createTriageRow(ledger, "tree", publication.treeOid, { code: true });
      createTriageRow(ledger, "target blob", publication.targetBlobOid, {
        code: true,
      });
    }
    if (report.route.statusCommand) {
      createTriageRow(ledger, "先读状态", report.route.statusCommand, {
        code: true,
        state: "status",
      });
    }
    if (report.route.deliverCommand) {
      createTriageRow(ledger, "确认后执行", report.route.deliverCommand, {
        code: true,
        state: "deliver",
      });
    } else if (report.pending && !report.route.deliverable) {
      createTriageRow(
        ledger,
        "写入锁",
        "BRANCH HOLD / SWITCH TO MAIN BEFORE DELIVERY",
        { state: "inspect" },
      );
    } else if (activeRoute === "inspect") {
      createTriageRow(
        ledger,
        "下一步",
        "当前提交不属于受支持的单一交付包；先人工检查 Git 状态。",
        { state: "inspect" },
      );
    }
    contentEl.createEl("p", {
      cls: "myblog-delivery-triage__note",
      text: "只读分诊不会执行 status 或 deliver 命令；先查看对应领域证据，再单独运行写命令。origin/main 仍只是最后一次本地观察。",
    });
  }
}

class ContentReviewDeliveryModal extends Modal {
  constructor(app, report) {
    super(app);
    this.report = report;
  }

  onOpen() {
    const { contentEl, report } = this;
    const pending = report.pendingReview;
    const synchronized = report.relation.status === "synchronized";
    contentEl.empty();
    contentEl.addClass("myblog-review-delivery");
    contentEl.setAttr("data-status", report.relation.status);
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__eyebrow",
      text: pending
        ? "DELIVERY HOLD / LOCAL ONLY"
        : synchronized
          ? "DELIVERY EVIDENCE / ALIGNED"
          : "DELIVERY EVIDENCE / INSPECT",
    });
    contentEl.createEl("h2", {
      cls: "myblog-review-delivery__title",
      text: "正式内容复核交付状态",
    });
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__boundary",
      text: "只读取本地 Git 引用；没有 fetch、push 或历史修改。origin/main 仅代表最后一次本地观察，不是实时远端声明。",
    });

    const transition = contentEl.createEl("section", {
      cls: "myblog-review-delivery__transition",
    });
    transition.setAttr("aria-label", "origin/main 最后本地观察与 local main 的提交关系");
    const tracking = transition.createEl("div", {
      cls: "myblog-review-delivery__node",
    });
    tracking.createEl("span", { text: "ORIGIN/MAIN · LAST OBSERVED" });
    tracking.createEl("code", {
      text: shortGitObjectId(report.observation.trackingHead),
    });
    const track = transition.createEl("div", {
      cls: "myblog-review-delivery__track",
    });
    track.createEl("span", {
      text: report.relation.ahead === null ? "+?" : `+${report.relation.ahead}`,
    });
    const local = transition.createEl("div", {
      cls: "myblog-review-delivery__node myblog-review-delivery__node--local",
    });
    local.createEl("span", { text: "LOCAL MAIN" });
    local.createEl("code", {
      text: shortGitObjectId(report.observation.localHead),
    });

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-review-delivery__ledger",
    });
    const statusLabel = pending
      ? "PENDING / NOT ON TRACKING REF"
      : synchronized
        ? "SYNCHRONIZED / NO PENDING REVIEW"
        : `INSPECT / ${report.relation.status.toUpperCase()}`;
    createDeliveryRow(ledger, "交付状态", statusLabel, {
      state: pending ? "pending" : synchronized ? "synchronized" : "inspect",
    });
    createDeliveryRow(
      ledger,
      "提交关系",
      `behind ${report.relation.behind ?? "unknown"} · ahead ${report.relation.ahead ?? "unknown"}`,
      { code: true },
    );
    createDeliveryRow(
      ledger,
      "当前分支",
      report.observation.currentBranch ?? "detached HEAD",
      { code: true },
    );
    if (pending) {
      createDeliveryRow(ledger, "正式内容", pending.sourcePath, { code: true });
      createDeliveryRow(ledger, "提交声明", pending.subject, { code: true });
      createDeliveryRow(ledger, "commit", pending.commitOid, { code: true });
      createDeliveryRow(ledger, "tree", pending.treeOid, { code: true });
      createDeliveryRow(ledger, "content blob", pending.blobOid, { code: true });
      createDeliveryRow(ledger, "恢复命令", report.recovery.command, {
        code: true,
        state: "recovery",
      });
    } else if (!synchronized) {
      createDeliveryRow(
        ledger,
        "下一步",
        "先在仓库中检查 Git 状态；当前证据不足以自动建议 push。",
        { state: "inspect" },
      );
    }
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__note",
      text: pending
        ? "该提交已通过本地候选、父级、唯一路径与 tree/blob 验证；联网恢复后执行显示的命令，不要重新创建复核提交。"
        : synchronized
          ? "本地 main 与最后观察到的 origin/main 一致；没有待同步正式内容复核。"
          : "本地引用关系需要人工检查；本视图不会自动同步或改写历史。",
    });
  }
}

function createPublishManifestItem(container, label, change) {
  const item = container.createEl("div", {
    cls: "myblog-publish-delivery__manifest-item",
  });
  item.createEl("span", {
    cls: "myblog-publish-delivery__manifest-state",
    text: label,
  });
  item.createEl("code", { text: change.path });
  item.createEl("span", {
    cls: "myblog-publish-delivery__manifest-blob",
    text: shortGitObjectId(change.newBlobOid ?? change.oldBlobOid),
  });
}

function createPublishDeliveryRow(container, label, value, options = {}) {
  const row = container.createEl("div", {
    cls: "myblog-publish-delivery__row",
  });
  if (options.state) row.setAttr("data-state", options.state);
  row.createEl("dt", { text: label });
  const detail = row.createEl("dd");
  if (options.code) detail.createEl("code", { text: String(value) });
  else detail.setText(String(value));
  return row;
}

class ContentPublishDeliveryModal extends Modal {
  constructor(app, report) {
    super(app);
    this.report = report;
  }

  onOpen() {
    const { contentEl, report } = this;
    const pending = report.pendingPublication;
    const synchronized = report.relation.status === "synchronized";
    contentEl.empty();
    contentEl.addClass("myblog-publish-delivery");
    contentEl.setAttr("data-status", report.relation.status);
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__eyebrow",
      text: pending
        ? "PUBLICATION HOLD / ATOMIC BUNDLE"
        : synchronized
          ? "PUBLICATION EVIDENCE / ALIGNED"
          : "PUBLICATION EVIDENCE / INSPECT",
    });
    contentEl.createEl("h2", {
      cls: "myblog-publish-delivery__title",
      text: "新内容发布交付状态",
    });
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__boundary",
      text: "只读取本地 Git 引用与提交对象；没有 fetch、push 或历史修改。origin/main 仅代表最后一次本地观察，不是实时远端声明。",
    });

    const transition = contentEl.createEl("section", {
      cls: "myblog-publish-delivery__transition",
    });
    transition.setAttr("aria-label", "origin/main 最后本地观察与 local main 的发布提交关系");
    const tracking = transition.createEl("div", {
      cls: "myblog-publish-delivery__node",
    });
    tracking.createEl("span", { text: "ORIGIN/MAIN · LAST OBSERVED" });
    tracking.createEl("code", {
      text: shortGitObjectId(report.observation.trackingHead),
    });
    const track = transition.createEl("div", {
      cls: "myblog-publish-delivery__track",
    });
    track.createEl("span", {
      text: report.relation.ahead === null ? "+?" : `+${report.relation.ahead}`,
    });
    const local = transition.createEl("div", {
      cls: "myblog-publish-delivery__node myblog-publish-delivery__node--local",
    });
    local.createEl("span", { text: "LOCAL MAIN" });
    local.createEl("code", {
      text: shortGitObjectId(report.observation.localHead),
    });

    if (pending) {
      const manifest = contentEl.createEl("section", {
        cls: "myblog-publish-delivery__manifest",
      });
      manifest.setAttr("aria-label", "发布提交原子路径清单");
      manifest.createEl("p", {
        cls: "myblog-publish-delivery__manifest-label",
        text: `COMMIT ENVELOPE / ${pending.changes.length} PATHS`,
      });
      const target = pending.changes.find(
        (change) => change.path === pending.targetPath,
      );
      const attachments = pending.changes.filter((change) =>
        change.path.startsWith(`public/uploads/${pending.slug}/`),
      );
      const inbox = pending.changes.find(
        (change) => change.path === pending.inboxSourcePath,
      );
      createPublishManifestItem(manifest, "NOTE / ADDED", target);
      attachments.forEach((change, index) => {
        createPublishManifestItem(
          manifest,
          `MEDIA ${String(index + 1).padStart(2, "0")} / ADDED`,
          change,
        );
      });
      if (inbox) createPublishManifestItem(manifest, "INBOX / DELETED", inbox);
    }

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-publish-delivery__ledger",
    });
    const statusLabel = pending
      ? "PENDING / NOT ON TRACKING REF"
      : synchronized
        ? "SYNCHRONIZED / NO PENDING PUBLICATION"
        : `INSPECT / ${report.relation.status.toUpperCase()}`;
    createPublishDeliveryRow(ledger, "交付状态", statusLabel, {
      state: pending ? "pending" : synchronized ? "synchronized" : "inspect",
    });
    createPublishDeliveryRow(
      ledger,
      "提交关系",
      `behind ${report.relation.behind ?? "unknown"} · ahead ${report.relation.ahead ?? "unknown"}`,
      { code: true },
    );
    createPublishDeliveryRow(
      ledger,
      "当前分支",
      report.observation.currentBranch ?? "detached HEAD",
      { code: true },
    );
    if (pending) {
      createPublishDeliveryRow(ledger, "内容标题", pending.title);
      createPublishDeliveryRow(ledger, "提交声明", pending.subject, { code: true });
      createPublishDeliveryRow(ledger, "commit", pending.commitOid, { code: true });
      createPublishDeliveryRow(ledger, "tree", pending.treeOid, { code: true });
      createPublishDeliveryRow(ledger, "target blob", pending.targetBlobOid, {
        code: true,
      });
      createPublishDeliveryRow(ledger, "恢复命令", report.recovery.command, {
        code: true,
        state: "recovery",
      });
    } else if (!synchronized) {
      createPublishDeliveryRow(
        ledger,
        "下一步",
        "先在仓库中检查 Git 状态；当前证据不足以建议 push。",
        { state: "inspect" },
      );
    }
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__note",
      text: pending
        ? "该 commit 已通过父级、主题、正式笔记、可选 inbox 删除与全部归档媒体身份验证；不要再次发布同一草稿。联网恢复后只执行显示的精确 OID 命令。"
        : synchronized
          ? "本地 main 与最后观察到的 origin/main 一致；没有待同步的新内容发布包。"
          : "本地引用关系需要人工检查；本视图不会自动同步、重建发布提交或改写历史。",
    });
  }
}

class ContentPublishDeliveryReceiptModal extends Modal {
  constructor(app, receipt) {
    super(app);
    this.receipt = receipt;
  }

  onOpen() {
    const { contentEl, receipt } = this;
    const publication = receipt.publication;
    contentEl.empty();
    contentEl.addClass("myblog-publish-delivery");
    contentEl.addClass("myblog-publish-delivery-receipt");
    contentEl.setAttr("data-status", "synchronized");
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__eyebrow",
      text: "PUBLICATION RECEIPT / SEALED ENVELOPE",
    });
    contentEl.createEl("h2", {
      cls: "myblog-publish-delivery__title",
      text: "新内容发布包已重新同步",
    });
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__boundary",
      text: "已把验证过的精确 Commit Envelope 推送到 origin/main；未执行 fetch、rebase、reset，也未修改 index 或工作区。",
    });

    const transition = contentEl.createEl("section", {
      cls: "myblog-publish-delivery__transition",
    });
    transition.setAttr("aria-label", "已验证发布提交精确送达到 origin/main");
    const local = transition.createEl("div", {
      cls: "myblog-publish-delivery__node",
    });
    local.createEl("span", { text: "VERIFIED COMMIT ENVELOPE" });
    local.createEl("code", {
      text: shortGitObjectId(receipt.transition.before.localHead),
    });
    const track = transition.createEl("div", {
      cls: "myblog-publish-delivery__track myblog-publish-delivery__track--sealed",
    });
    track.createEl("span", { text: "SEALED PUSH" });
    const tracking = transition.createEl("div", {
      cls: "myblog-publish-delivery__node myblog-publish-delivery__node--local",
    });
    tracking.createEl("span", { text: "ORIGIN/MAIN · OBSERVED AFTER PUSH" });
    tracking.createEl("code", {
      text: shortGitObjectId(receipt.transition.after.trackingHead),
    });

    const manifest = contentEl.createEl("section", {
      cls: "myblog-publish-delivery__manifest myblog-publish-delivery__manifest--sealed",
    });
    manifest.setAttr("aria-label", "已交付发布提交原子路径清单");
    manifest.createEl("p", {
      cls: "myblog-publish-delivery__manifest-label",
      text: `DELIVERED ENVELOPE / ${publication.changes.length} PATHS`,
    });
    const target = publication.changes.find(
      (change) => change.path === publication.targetPath,
    );
    const attachments = publication.changes.filter((change) =>
      change.path.startsWith(`public/uploads/${publication.slug}/`),
    );
    const inbox = publication.changes.find(
      (change) => change.path === publication.inboxSourcePath,
    );
    createPublishManifestItem(manifest, "NOTE / ADDED", target);
    attachments.forEach((change, index) => {
      createPublishManifestItem(
        manifest,
        `MEDIA ${String(index + 1).padStart(2, "0")} / ADDED`,
        change,
      );
    });
    if (inbox) createPublishManifestItem(manifest, "INBOX / DELETED", inbox);

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-publish-delivery__ledger",
    });
    createPublishDeliveryRow(ledger, "交付状态", "DELIVERED / SYNCHRONIZED", {
      state: "synchronized",
    });
    createPublishDeliveryRow(ledger, "内容标题", publication.title);
    createPublishDeliveryRow(ledger, "commit", publication.commitOid, {
      code: true,
    });
    createPublishDeliveryRow(ledger, "tree", publication.treeOid, {
      code: true,
    });
    createPublishDeliveryRow(ledger, "target blob", publication.targetBlobOid, {
      code: true,
    });
    createPublishDeliveryRow(ledger, "精确 refspec", receipt.transition.command, {
      code: true,
    });

    const stability = contentEl.createEl("p", {
      cls: "myblog-publish-delivery-receipt__stability",
    });
    stability.createEl("span", { text: "HEAD STABLE" });
    stability.createEl("span", { text: "INDEX STABLE" });
    stability.createEl("span", { text: "WORKTREE STABLE" });
    stability.createEl("span", { text: "MANIFEST STABLE" });
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__note",
      text: "local main 与最后观察到的 origin/main 已对齐到同一发布提交；线上部署仍由 GitHub 与 Vercel 的独立检查确认。",
    });
  }
}

class ContentReviewDeliveryReceiptModal extends Modal {
  constructor(app, receipt) {
    super(app);
    this.receipt = receipt;
  }

  onOpen() {
    const { contentEl, receipt } = this;
    contentEl.empty();
    contentEl.addClass("myblog-review-delivery-receipt");
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__eyebrow",
      text: "DELIVERY RECEIPT / SYNCHRONIZED",
    });
    contentEl.createEl("h2", {
      cls: "myblog-review-delivery__title",
      text: "正式内容复核已重新同步",
    });
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__boundary",
      text: "已把验证过的精确 commit 推送到 origin/main；未执行 fetch、rebase、reset，也未修改 index 或工作区。",
    });

    const transition = contentEl.createEl("section", {
      cls: "myblog-review-delivery__transition",
    });
    transition.setAttr("aria-label", "已验证本地提交精确送达到 origin/main");
    const local = transition.createEl("div", {
      cls: "myblog-review-delivery__node",
    });
    local.createEl("span", { text: "VERIFIED LOCAL COMMIT" });
    local.createEl("code", {
      text: shortGitObjectId(receipt.transition.before.localHead),
    });
    const track = transition.createEl("div", {
      cls: "myblog-review-delivery__track myblog-review-delivery__track--sealed",
    });
    track.createEl("span", { text: "SEALED PUSH" });
    const tracking = transition.createEl("div", {
      cls: "myblog-review-delivery__node myblog-review-delivery__node--local",
    });
    tracking.createEl("span", { text: "ORIGIN/MAIN · OBSERVED AFTER PUSH" });
    tracking.createEl("code", {
      text: shortGitObjectId(receipt.transition.after.trackingHead),
    });

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-review-delivery__ledger",
    });
    createDeliveryRow(ledger, "交付状态", "DELIVERED / SYNCHRONIZED", {
      state: "synchronized",
    });
    createDeliveryRow(ledger, "正式内容", receipt.review.sourcePath, {
      code: true,
    });
    createDeliveryRow(ledger, "commit", receipt.review.commitOid, { code: true });
    createDeliveryRow(ledger, "tree", receipt.review.treeOid, { code: true });
    createDeliveryRow(ledger, "content blob", receipt.review.blobOid, {
      code: true,
    });
    createDeliveryRow(ledger, "精确 refspec", receipt.transition.command, {
      code: true,
    });

    const stability = contentEl.createEl("p", {
      cls: "myblog-review-delivery-receipt__stability",
    });
    stability.createEl("span", { text: "HEAD STABLE" });
    stability.createEl("span", { text: "INDEX STABLE" });
    stability.createEl("span", { text: "WORKTREE STABLE" });
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__note",
      text: "local main 与最后观察到的 origin/main 已对齐到同一复核提交；线上部署仍由 GitHub 与 Vercel 的独立检查确认。",
    });
  }
}

class ContentReviewProofModal extends Modal {
  constructor(app, proof) {
    super(app);
    this.proof = proof;
  }

  onOpen() {
    const { contentEl, proof } = this;
    const { review } = proof;
    contentEl.empty();
    contentEl.addClass("myblog-review-proof");
    contentEl.createEl("p", {
      cls: "myblog-review-proof__eyebrow",
      text: "AUTHOR PROOF / CHECKED",
    });
    contentEl.createEl("h2", {
      cls: "myblog-review-proof__title",
      text: "正式内容复核证据",
    });
    contentEl.createEl("p", {
      cls: "myblog-review-proof__boundary",
      text: "只读检查已通过；尚未暂存、提交或推送。",
    });
    contentEl.createEl("h3", {
      cls: "myblog-review-proof__content-title",
      text: review.title,
    });
    const source = contentEl.createEl("p", {
      cls: "myblog-review-proof__source",
    });
    source.createEl("code", { text: review.sourcePath });

    const transition = contentEl.createEl("section", {
      cls: "myblog-review-proof__transition",
    });
    transition.setAttr("aria-label", "复核日期从 HEAD 推进到当前笔记");
    const previous = transition.createEl("div", {
      cls: "myblog-review-proof__date-node",
    });
    previous.createEl("span", { text: "HEAD 复核日" });
    previous.createEl("time", { text: review.previousReviewedAt });
    const track = transition.createEl("div", {
      cls: "myblog-review-proof__track",
    });
    track.setAttr("aria-hidden", "true");
    track.createEl("span", { text: "→" });
    const current = transition.createEl("div", {
      cls: "myblog-review-proof__date-node myblog-review-proof__date-node--current",
    });
    current.createEl("span", { text: "当前复核日" });
    current.createEl("time", { text: review.reviewedAt });

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-review-proof__ledger",
    });
    createProofRow(
      ledger,
      "事实变化",
      review.substantiveChanged
        ? "有 · updatedAt 已同步"
        : "无 · 仅推进 reviewedAt",
      { state: review.substantiveChanged ? "changed" : "review-only" },
    );
    createProofRow(
      ledger,
      "updatedAt",
      review.updatedAt ?? "未设置",
      { code: true },
    );
    createProofRow(ledger, "质量门", "npm run check · passed", {
      state: "passed",
    });
    createCandidateProofRow(ledger, proof.candidate);
    createProofRow(
      ledger,
      "分支与工作区",
      `main · index 0 · deferred ${proof.git.deferredPaths.length}`,
    );
    createDeferredProofRow(ledger, proof.git);
    createProofRow(
      ledger,
      "唯一可提交路径",
      proof.git.committablePaths[0],
      { code: true },
    );
    contentEl.createEl("p", {
      cls: "myblog-review-proof__next",
      text: "确认以上证据后，仍需单独运行“提交并同步当前正式内容复核”。",
    });
  }
}

class ContentMaintenanceModal extends Modal {
  constructor(app, report, openSource) {
    super(app);
    this.report = report;
    this.openSource = openSource;
  }

  onOpen() {
    const { contentEl, report } = this;
    contentEl.empty();
    contentEl.addClass("myblog-maintenance");
    contentEl.createEl("h2", {
      cls: "myblog-maintenance__title",
      text: "已发布内容复核台账",
    });
    contentEl.createEl("p", {
      cls: "myblog-maintenance__boundary",
      text: "只读证据视图；Git 内容文件仍是唯一事实源。打开笔记不会修改 reviewedAt，也不会提交或推送。",
    });
    contentEl.createEl("p", {
      cls: "myblog-maintenance__stamp",
      text: `结构版本 v${report.version} · 报告日期 ${report.buildDate} · 最长复核周期 ${report.maxAgeDays} 天`,
    });

    const scope = contentEl.createEl("dl", {
      cls: "myblog-maintenance__scope",
    });
    createMetric(scope, "持续复核", report.currentCount);
    createMetric(scope, "历史快照", report.historicalCount);
    createMetric(scope, "未公开", report.excludedCount);

    const horizon = contentEl.createEl("section", {
      cls: "myblog-maintenance__horizon",
    });
    horizon.createEl("p", {
      cls: "myblog-maintenance__section-label",
      text: `期限分布 · ${report.thresholds.reviewSoonDays} 天进入复核窗口 · ${report.thresholds.dueSoonDays} 天进入到期提醒`,
    });
    const trace = horizon.createEl("ol", {
      cls: "myblog-maintenance__trace",
    });
    for (const status of MAINTENANCE_STATUSES) {
      const item = trace.createEl("li", {
        cls: "myblog-maintenance__trace-item",
      });
      item.setAttr("data-status", status);
      item.createEl("span", { text: STATUS_LABELS[status] });
      item.createEl("strong", { text: String(report.counts[status]) });
    }

    const records = contentEl.createEl("section", {
      cls: "myblog-maintenance__records-section",
    });
    records.createEl("p", {
      cls: "myblog-maintenance__section-label",
      text: `复核期限台账 · ${report.records.length} 项`,
    });
    if (report.records.length === 0) {
      records.createEl("p", {
        cls: "myblog-maintenance__empty",
        text: "当前没有已发布内容需要纳入复核。",
      });
    } else {
      const list = records.createEl("ol", {
        cls: "myblog-maintenance__records",
      });
      for (const record of report.records) {
        const item = list.createEl("li", {
          cls: "myblog-maintenance__record",
        });
        item.setAttr("data-status", record.status);
        const statusLine = item.createEl("div", {
          cls: "myblog-maintenance__record-status",
        });
        statusLine.createEl("span", { text: STATUS_LABELS[record.status] });
        statusLine.createEl("strong", {
          text: remainingLabel(record.remainingDays),
        });
        item.createEl("h3", {
          cls: "myblog-maintenance__record-title",
          text: record.title,
        });
        item.createEl("p", {
          cls: "myblog-maintenance__route",
          text: `${record.kind === "post" ? "文章" : "项目"} · ${record.url}`,
        });
        const dates = item.createEl("dl", {
          cls: "myblog-maintenance__dates",
        });
        createMetric(dates, "最近复核", record.reviewedAt);
        createMetric(dates, "最后有效日", record.reviewBy);
        createMetric(dates, "已运行", `${record.ageDays} 天`);
        const source = item.createEl("p", {
          cls: "myblog-maintenance__source",
        });
        source.createEl("span", { text: "来源 " });
        source.createEl("code", { text: record.sourcePath });
        const button = item.createEl("button", {
          cls: "mod-cta myblog-maintenance__open",
          text: "打开笔记",
        });
        button.setAttr("type", "button");
        button.setAttr("aria-label", `打开 ${record.sourcePath}`);
        button.addEventListener("click", () =>
          this.openSource(record.sourcePath, this),
        );
      }
    }

    const checklist = contentEl.createEl("details", {
      cls: "myblog-maintenance__checklist",
    });
    checklist.createEl("summary", {
      text: `复核清单（${report.reviewChecklist.length}）`,
    });
    const checklistItems = checklist.createEl("ol");
    for (const item of report.reviewChecklist) {
      checklistItems.createEl("li", { text: item });
    }
  }
}

module.exports = class MyBlogPublisher extends Plugin {
  onload() {
    this.activeRuns = new Map();
    this.authorTransactionLease = null;
    this.draftRenameLease = null;
    this.draftIdentityCleanupLease = null;
    this.lastAuthorTransactionReceipt = null;

    this.addCommand({
      id: "create-blog-draft",
      name: "新建博客草稿",
      checkCallback: (checking) => this.openDraftCreationWizard(checking),
    });

    this.addCommand({
      id: "rename-current-inbox-draft",
      name: "重命名当前草稿",
      checkCallback: (checking) => this.renameCurrentInboxDraft(checking),
    });

    this.addCommand({
      id: "inspect-current-inbox-draft-identity",
      name: "检查当前草稿身份",
      checkCallback: (checking) =>
        this.inspectCurrentInboxDraftIdentity(checking),
    });

    this.addCommand({
      id: "inspect-current-draft-intent",
      name: "查看当前草稿发布意图",
      checkCallback: (checking) => this.inspectCurrentDraftIntent(checking),
    });

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
      id: "validate-current-published-note",
      name: "检查当前正式内容复核",
      checkCallback: (checking) =>
        this.reviewCurrentPublishedNote(checking, false),
    });

    this.addCommand({
      id: "review-current-published-note",
      name: "提交并同步当前正式内容复核",
      checkCallback: (checking) =>
        this.reviewCurrentPublishedNote(checking, true),
    });

    this.addCommand({
      id: "inspect-inbox-readiness",
      name: "查看全部草稿发布就绪状态",
      checkCallback: (checking) => this.inspectInboxReadiness(checking),
    });

    this.addCommand({
      id: "inspect-published-maintenance",
      name: "查看已发布内容复核台账",
      checkCallback: (checking) => this.inspectPublishedMaintenance(checking),
    });

    this.addCommand({
      id: "inspect-author-environment",
      name: "检查本机发布环境",
      checkCallback: (checking) => this.inspectAuthorEnvironment(checking),
    });

    this.addCommand({
      id: "inspect-author-transaction",
      name: "查看当前作者事务",
      checkCallback: (checking) => this.inspectAuthorTransaction(checking),
    });

    this.addCommand({
      id: "inspect-delivery-triage",
      name: "查看 Git 交付恢复",
      checkCallback: (checking) => this.inspectDeliveryTriage(checking),
    });

    this.addCommand({
      id: "inspect-review-delivery",
      name: "查看待同步正式内容复核",
      checkCallback: (checking) => this.inspectReviewDelivery(checking),
    });

    this.addCommand({
      id: "inspect-publish-delivery",
      name: "查看待同步新内容发布",
      checkCallback: (checking) => this.inspectPublishDelivery(checking),
    });

    this.addCommand({
      id: "deliver-pending-review",
      name: "重新同步待交付正式内容复核",
      checkCallback: (checking) => this.deliverPendingReview(checking),
    });

    this.addCommand({
      id: "deliver-pending-publication",
      name: "重新同步待交付新内容发布",
      checkCallback: (checking) => this.deliverPendingPublication(checking),
    });
  }

  onunload() {
    this.draftRenameLease = null;
    this.draftIdentityCleanupLease = null;
    const authorLease = this.authorTransactionLease;
    if (authorLease) {
      this.releaseAuthorTransactionLease(authorLease, null, "unloaded");
    }
    this.authorTransactionLease = null;
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

  openDraftCreationWizard(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    new DraftCreationModal(this).open();
    return true;
  }

  getActiveInboxDraftIdentity() {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== "md") return null;
    const match = file.path.match(DRAFT_INBOX_PATH_PATTERN);
    if (!match) return null;
    return Object.freeze({
      file,
      sourcePath: file.path,
      sourceSlug: match[1],
    });
  }

  renameCurrentInboxDraft(checking) {
    if (!this.isDesktopVault()) return false;
    const identity = this.getActiveInboxDraftIdentity();
    if (!identity) return false;
    if (checking) return true;
    new DraftRenameModal(this, identity).open();
    return true;
  }

  inspectCurrentInboxDraftIdentity(checking) {
    if (!this.isDesktopVault()) return false;
    const identity = this.getActiveInboxDraftIdentity();
    if (!identity) return false;
    if (checking) return true;
    void this.openDraftIdentityEvidence(identity).catch((error) => {
      const message = error instanceof Error
        ? error.message
        : "草稿身份检查失败。";
      new Notice(message, 10000);
    });
    return true;
  }

  inspectCurrentDraftIntent(checking) {
    if (!this.isDesktopVault()) return false;
    const identity = this.getActiveInboxDraftIdentity();
    if (!identity) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:inbox",
        "--",
        "--format",
        "json",
        "--source",
        identity.sourcePath,
      ],
      {
        failure: "当前草稿作者意图检查未完成",
        progress: `正在读取 ${identity.sourcePath} 的本地发布意图…`,
        startFailure: "当前草稿作者意图检查无法启动",
      },
      (output) => this.openCurrentDraftIntent(output, identity),
    );
  }

  openCurrentDraftIntent(output, identity) {
    const current = this.getActiveInboxDraftIdentity();
    const frozenFile = this.app.vault.getAbstractFileByPath(identity.sourcePath);
    if (
      !current ||
      current.file !== identity.file ||
      current.sourcePath !== identity.sourcePath ||
      frozenFile !== identity.file
    ) {
      new Notice("活动草稿已变化；当前作者意图摘要未打开，请重新运行命令。", 10000);
      return;
    }
    try {
      const evidence = parseInboxReadinessReport(output, identity.sourcePath);
      new DraftIntentModal(this.app, evidence).open();
      new Notice("当前草稿发布意图已从本地只读证据生成。", 5000);
    } catch (error) {
      new Notice(
        `作者意图摘要证据不可用：${error.message}。未回退、未重试，也未执行发布。`,
        12000,
      );
    }
  }

  async openDraftIdentityEvidence(identity) {
    const file = this.app.vault.getAbstractFileByPath(identity.sourcePath);
    if (
      !(file instanceof TFile) ||
      file !== identity.file ||
      file.path !== identity.sourcePath ||
      file.extension !== "md"
    ) {
      throw new Error("当前草稿在检查开始前已变化；请重新运行命令。");
    }
    let content;
    try {
      content = await this.app.vault.read(file);
    } catch (error) {
      throw new Error(`草稿身份读取失败：${identity.sourcePath} · ${error.message}`);
    }
    if (this.app.vault.getAbstractFileByPath(identity.sourcePath) !== file) {
      throw new Error("当前草稿在检查期间已变化；请重新运行命令。");
    }
    const report = this.analyzeDraftIdentity(identity, content);
    new DraftIdentityModal(this, report).open();
    return report;
  }

  analyzeDraftIdentity(identity, content) {
    const postPath = `content/posts/${identity.sourceSlug}.md`;
    const projectPath = `content/projects/${identity.sourceSlug}.md`;
    const postCollision = Boolean(this.app.vault.getAbstractFileByPath(postPath));
    const projectCollision = Boolean(
      this.app.vault.getAbstractFileByPath(projectPath),
    );
    const evidence = (draftValue) => Object.freeze([
      Object.freeze({
        label: "DRAFT",
        state: draftValue === "TRUE" ? "clear" : "hold",
        value: draftValue,
      }),
      Object.freeze({ label: "INBOX", state: "clear", value: "OWNED" }),
      Object.freeze({
        label: "POST",
        state: postCollision ? "hold" : "clear",
        value: postCollision ? "COLLISION" : "CLEAR",
      }),
      Object.freeze({
        label: "PROJECT",
        state: projectCollision ? "hold" : "clear",
        value: projectCollision ? "COLLISION" : "CLEAR",
      }),
    ]);
    const held = (reason, frontmatterSlugLabel = "UNPROVEN", draftValue = "UNPROVEN") =>
      Object.freeze({
        cleanupAllowed: false,
        evidence: evidence(draftValue),
        frontmatterSlugLabel,
        observedContent: content,
        reason,
        sourcePath: identity.sourcePath,
        sourceSlug: identity.sourceSlug,
        state: "held",
        statusToken: "HOLD / CONFLICT",
      });

    let info;
    try {
      info = getFrontMatterInfo(content);
    } catch {
      return held("frontmatter 无法识别；保持只读。", "INVALID");
    }
    const boundary = content.match(
      /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u,
    );
    if (!info?.exists || !boundary) {
      return held("缺少可证明的 frontmatter 边界；保持只读。", "MISSING");
    }
    const rawFrontmatter = boundary[2];
    if (/^[ \t]+slug[ \t]*:/mu.test(rawFrontmatter)) {
      return held("检测到缩进的 slug 表示；身份含义不明确，保持只读。", "AMBIGUOUS");
    }

    let frontmatter;
    try {
      frontmatter = parseYaml(info.frontmatter);
    } catch {
      return held("frontmatter YAML 无法解析；保持只读。", "INVALID");
    }
    if (
      !frontmatter ||
      typeof frontmatter !== "object" ||
      Array.isArray(frontmatter)
    ) {
      return held("frontmatter 必须是 YAML 映射；保持只读。", "INVALID");
    }
    const draftValue = frontmatter.draft === true ? "TRUE" : "NOT TRUE";
    const hasSlug = Object.prototype.hasOwnProperty.call(frontmatter, "slug");
    const slugLines = rawFrontmatter.match(
      /^slug[ \t]*:[^\r\n]*(?:\r?\n|$)/gmu,
    ) ?? [];

    if (frontmatter.draft !== true) {
      return held("只检查和清理 draft: true 的未发布草稿。", hasSlug ? String(frontmatter.slug) : "ABSENT", draftValue);
    }
    if (hasSlug && typeof frontmatter.slug !== "string") {
      return held("旧式 frontmatter slug 必须是文本；保持只读。", String(frontmatter.slug), draftValue);
    }
    if (hasSlug && slugLines.length !== 1) {
      return held("旧式 slug 的原始行格式不唯一或不安全；保持只读。", frontmatter.slug, draftValue);
    }
    if (!hasSlug && slugLines.length > 0) {
      return held("slug 的原始行与 YAML 语义不一致；保持只读。", "AMBIGUOUS", draftValue);
    }
    if (hasSlug && frontmatter.slug !== identity.sourceSlug) {
      return held("frontmatter slug 不等于文件名；保持只读。", frontmatter.slug, draftValue);
    }
    if (
      hasSlug &&
      slugLines[0].replace(/\r?\n$/u, "") !== `slug: ${identity.sourceSlug}`
    ) {
      return held("旧式 slug 的原始行格式不安全；保持只读。", frontmatter.slug, draftValue);
    }
    if (postCollision) {
      return held(`正式文章命名空间已存在：${postPath}。`, hasSlug ? frontmatter.slug : "ABSENT", draftValue);
    }
    if (projectCollision) {
      return held(`项目命名空间已存在：${projectPath}。`, hasSlug ? frontmatter.slug : "ABSENT", draftValue);
    }

    if (!hasSlug) {
      return Object.freeze({
        cleanupAllowed: false,
        evidence: evidence(draftValue),
        frontmatterSlugLabel: "ABSENT",
        observedContent: content,
        reason: "文件名已经是唯一身份；无需清理。",
        sourcePath: identity.sourcePath,
        sourceSlug: identity.sourceSlug,
        state: "filename-owned",
        statusToken: "READY / FILE OWNED",
      });
    }

    const cleanedFrontmatter = rawFrontmatter.replace(slugLines[0], "");
    const cleanedContent = [
      boundary[1],
      cleanedFrontmatter,
      boundary[3],
      content.slice(boundary[0].length),
    ].join("");
    return Object.freeze({
      cleanedContent,
      cleanupAllowed: true,
      evidence: evidence(draftValue),
      frontmatterSlugLabel: frontmatter.slug,
      observedContent: content,
      reason: "旧式 slug 与文件名完全匹配；可移除这一条冗余身份字段。",
      sourcePath: identity.sourcePath,
      sourceSlug: identity.sourceSlug,
      state: "legacy-cleanable",
      statusToken: "LEGACY / MATCHED",
    });
  }

  async cleanupLegacyDraftIdentity({ observedContent, sourcePath } = {}) {
    if (!this.isDesktopVault()) {
      throw new Error("草稿身份清理只支持桌面 Vault。");
    }
    const match = typeof sourcePath === "string"
      ? sourcePath.match(DRAFT_INBOX_PATH_PATTERN)
      : null;
    if (!match || typeof observedContent !== "string") {
      throw new Error("草稿身份清理输入无效；请重新检查。");
    }
    if (this.draftIdentityCleanupLease) {
      throw new Error("另一个草稿身份清理正在进行；完成后重新检查。");
    }
    const lease = Object.freeze({ sourcePath });
    this.draftIdentityCleanupLease = lease;
    try {
      const activeIdentity = this.getActiveInboxDraftIdentity();
      const file = this.app.vault.getAbstractFileByPath(sourcePath);
      if (
        !activeIdentity ||
        !(file instanceof TFile) ||
        activeIdentity.file !== file ||
        activeIdentity.sourcePath !== sourcePath ||
        file.path !== sourcePath ||
        file.extension !== "md"
      ) {
        throw new Error("当前草稿对象已变化；重新检查后再清理。");
      }
      const identity = Object.freeze({
        file,
        sourcePath,
        sourceSlug: match[1],
      });
      const observedReport = this.analyzeDraftIdentity(identity, observedContent);
      if (!observedReport.cleanupAllowed) {
        throw new Error("已检查的草稿不再满足精确旧身份清理条件。");
      }

      const current = await this.app.vault.read(file);
      if (current !== observedContent) {
        throw new Error("草稿在检查后已变化；重新检查后再清理。");
      }
      if (
        this.app.vault.getAbstractFileByPath(sourcePath) !== file ||
        this.getActiveInboxDraftIdentity()?.file !== file
      ) {
        throw new Error("当前草稿对象已变化；重新检查后再清理。");
      }
      const beforeProcess = this.analyzeDraftIdentity(identity, current);
      if (!beforeProcess.cleanupAllowed) {
        throw new Error("草稿身份或内容命名空间已变化；重新检查后再清理。");
      }

      let callbackError = null;
      let expectedContent = null;
      let processedContent;
      try {
        processedContent = await this.app.vault.process(file, (data) => {
          try {
            if (data !== observedContent) {
              throw new Error("草稿在检查后已变化；重新检查后再清理。");
            }
            const callbackReport = this.analyzeDraftIdentity(identity, data);
            if (!callbackReport.cleanupAllowed) {
              throw new Error("草稿身份或内容命名空间已变化；重新检查后再清理。");
            }
            expectedContent = callbackReport.cleanedContent;
            return expectedContent;
          } catch (error) {
            callbackError = error instanceof Error
              ? error
              : new Error("草稿身份清理回调失败。");
            throw callbackError;
          }
        });
      } catch {
        if (callbackError) throw callbackError;
        return Object.freeze({ sourcePath, status: "uncertain" });
      }

      let contentAfter;
      try {
        contentAfter = await this.app.vault.read(file);
      } catch {
        return Object.freeze({ sourcePath, status: "uncertain" });
      }
      const afterReport = this.analyzeDraftIdentity(identity, contentAfter);
      if (
        typeof expectedContent === "string" &&
        processedContent === expectedContent &&
        contentAfter === expectedContent &&
        afterReport.state === "filename-owned" &&
        this.app.vault.getAbstractFileByPath(sourcePath) === file
      ) {
        return Object.freeze({ sourcePath, status: "cleaned" });
      }
      return Object.freeze({ sourcePath, status: "uncertain" });
    } finally {
      if (this.draftIdentityCleanupLease === lease) {
        this.draftIdentityCleanupLease = null;
      }
    }
  }

  getDraftCreationToday() {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Shanghai",
      year: "numeric",
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts
        .filter((part) => ["year", "month", "day"].includes(part.type))
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  }

  validateDraftCreationInput({ kind, slug, title } = {}) {
    const config = DRAFT_CREATION_KINDS[kind];
    if (!config) {
      throw new Error("内容类型无效；请选择 article、til 或 project。");
    }
    if (typeof title !== "string") {
      throw new Error("标题必须是文本。");
    }
    const normalizedTitle = title.trim();
    if (normalizedTitle.length === 0) {
      throw new Error("标题不能为空。");
    }
    if (/\0|\r|\n/u.test(normalizedTitle)) {
      throw new Error("标题不能包含换行或空字符。");
    }
    if (normalizedTitle.length > DRAFT_TITLE_MAX_LENGTH) {
      throw new Error(`标题不能超过 ${DRAFT_TITLE_MAX_LENGTH} 个字符。`);
    }
    if (typeof slug !== "string" || slug.length === 0) {
      throw new Error("英文 slug 不能为空。");
    }
    if (slug.length > DRAFT_SLUG_MAX_LENGTH) {
      throw new Error(`英文 slug 不能超过 ${DRAFT_SLUG_MAX_LENGTH} 个字符。`);
    }
    if (!DRAFT_SLUG_PATTERN.test(slug)) {
      throw new Error("英文 slug 仅允许小写英文、数字和单个连字符。");
    }
    return Object.freeze({ config, kind, slug, title: normalizedTitle });
  }

  getDraftCollisionPaths(slug) {
    return DRAFT_CONTENT_DIRECTORIES.map((directory) => `${directory}/${slug}.md`);
  }

  assertDraftPathsAvailable(slug) {
    for (const path of this.getDraftCollisionPaths(slug)) {
      if (this.app.vault.getAbstractFileByPath(path)) {
        throw new Error(`内容路径已存在：${path}。未覆盖任何文件。`);
      }
    }
  }

  validateDraftRenameInput({ sourcePath, targetSlug } = {}) {
    const sourceMatch = typeof sourcePath === "string"
      ? sourcePath.match(DRAFT_INBOX_PATH_PATTERN)
      : null;
    if (!sourceMatch) {
      throw new Error("来源草稿必须是 content/inbox 下以安全 slug 命名的 Markdown 文件。");
    }
    if (typeof targetSlug !== "string" || targetSlug.length === 0) {
      throw new Error("新的英文 slug 不能为空。");
    }
    if (targetSlug.length > DRAFT_SLUG_MAX_LENGTH) {
      throw new Error(`新的英文 slug 不能超过 ${DRAFT_SLUG_MAX_LENGTH} 个字符。`);
    }
    if (!DRAFT_SLUG_PATTERN.test(targetSlug)) {
      throw new Error("新的英文 slug 仅支持小写英文、数字和单个连字符。");
    }
    if (targetSlug === sourceMatch[1]) {
      throw new Error("新的 slug 必须与当前 slug 不同。");
    }
    return Object.freeze({
      sourcePath,
      sourceSlug: sourceMatch[1],
      targetPath: `content/inbox/${targetSlug}.md`,
      targetSlug,
    });
  }

  assertFilenameOwnedDraft(content) {
    let info;
    try {
      info = getFrontMatterInfo(content);
    } catch {
      throw new Error("草稿 frontmatter 无法识别；未执行改名。");
    }
    if (!info?.exists) {
      throw new Error("草稿缺少 frontmatter；未执行改名。");
    }

    let frontmatter;
    try {
      frontmatter = parseYaml(info.frontmatter);
    } catch {
      throw new Error("草稿 frontmatter YAML 无法解析；未执行改名。");
    }
    if (
      !frontmatter ||
      typeof frontmatter !== "object" ||
      Array.isArray(frontmatter)
    ) {
      throw new Error("草稿 frontmatter 必须是 YAML 映射；未执行改名。");
    }
    if (Object.prototype.hasOwnProperty.call(frontmatter, "slug")) {
      throw new Error("该草稿仍包含旧式 frontmatter slug；为避免双字段迁移，未执行改名。");
    }
    if (frontmatter.draft !== true) {
      throw new Error("只允许重命名 draft: true 的未发布草稿。");
    }
  }

  async renameInboxDraft(input) {
    if (!this.isDesktopVault()) {
      throw new Error("重命名草稿只支持桌面 Vault。");
    }
    const draft = this.validateDraftRenameInput(input);
    this.assertDraftPathsAvailable(draft.targetSlug);
    if (this.draftRenameLease) {
      throw new Error("另一个草稿改名正在进行；完成后重新打开命令。");
    }

    const lease = Object.freeze({
      sourcePath: draft.sourcePath,
      targetPath: draft.targetPath,
    });
    this.draftRenameLease = lease;
    try {
      const file = this.app.vault.getAbstractFileByPath(draft.sourcePath);
      if (
        !(file instanceof TFile) ||
        file.path !== draft.sourcePath ||
        file.extension !== "md"
      ) {
        throw new Error(`找不到来源草稿：${draft.sourcePath}。`);
      }

      let content;
      try {
        content = await this.app.vault.read(file);
      } catch (error) {
        throw new Error(`草稿读取失败：${draft.sourcePath} · ${error.message}`);
      }
      this.assertFilenameOwnedDraft(content);
      this.assertDraftPathsAvailable(draft.targetSlug);
      if (this.app.vault.getAbstractFileByPath(draft.sourcePath) !== file) {
        throw new Error("来源草稿在检查期间已变化；未执行改名。");
      }

      try {
        await this.app.fileManager.renameFile(file, draft.targetPath);
      } catch {
        return Object.freeze({
          sourcePath: draft.sourcePath,
          status: "uncertain",
          targetPath: draft.targetPath,
        });
      }

      const sourceAfter = this.app.vault.getAbstractFileByPath(draft.sourcePath);
      const targetAfter = this.app.vault.getAbstractFileByPath(draft.targetPath);
      if (
        sourceAfter === null &&
        targetAfter instanceof TFile &&
        targetAfter.path === draft.targetPath
      ) {
        return Object.freeze({
          sourcePath: draft.sourcePath,
          status: "renamed",
          targetPath: draft.targetPath,
        });
      }
      return Object.freeze({
        sourcePath: draft.sourcePath,
        status: "uncertain",
        targetPath: draft.targetPath,
      });
    } finally {
      if (this.draftRenameLease === lease) this.draftRenameLease = null;
    }
  }

  renderDraftTemplate(template, draft, today) {
    if (typeof template !== "string") {
      throw new Error("受信模板内容无效。");
    }
    const source = template.replace(/\r\n?/gu, "\n");
    if (!source.startsWith("---\n") || source.indexOf("\n---\n", 4) === -1) {
      throw new Error("受信模板 frontmatter 边界已漂移。");
    }
    const exactLines = [
      ['title: ""', 1],
      ["draft: true", 1],
      ["featured: false", 1],
      ...draft.config.requiredLines.map((line) => [line, 1]),
    ];
    for (const [line, expected] of exactLines) {
      if (countExactLine(source, line) !== expected) {
        throw new Error(`受信模板字段已漂移：${line}`);
      }
    }
    if (/^slug\s*:/mu.test(source)) {
      throw new Error("受信模板不能包含重复的 frontmatter slug；文件名是唯一身份。");
    }
    const tokens = source.match(/\{\{[^{}\n]+\}\}/gu) ?? [];
    const expectedTokens = [DRAFT_DATE_TOKEN, DRAFT_DATE_TOKEN, DRAFT_DATE_TOKEN];
    if (
      tokens.length !== expectedTokens.length ||
      tokens.some((token, index) => token !== expectedTokens[index])
    ) {
      throw new Error("受信模板占位符已漂移。");
    }
    parseIsoDate(today, "草稿创建日期");
    const rendered = source
      .replace('title: ""', `title: ${JSON.stringify(draft.title)}`)
      .replaceAll(DRAFT_DATE_TOKEN, today);
    if (/\{\{[^{}\n]+\}\}/u.test(rendered)) {
      throw new Error("受信模板仍有未解析占位符。");
    }
    return rendered.endsWith("\n") ? rendered : `${rendered}\n`;
  }

  async createDraftFromTemplate(input) {
    if (!this.isDesktopVault()) {
      throw new Error("新建草稿只支持桌面 Vault。");
    }
    const draft = this.validateDraftCreationInput(input);
    const path = `content/inbox/${draft.slug}.md`;
    this.assertDraftPathsAvailable(draft.slug);

    const templateFile = this.app.vault.getAbstractFileByPath(
      draft.config.templatePath,
    );
    if (
      !templateFile ||
      templateFile.path !== draft.config.templatePath ||
      templateFile.extension !== "md"
    ) {
      throw new Error(`找不到受信模板：${draft.config.templatePath}`);
    }

    let template;
    try {
      template = await this.app.vault.cachedRead(templateFile);
    } catch (error) {
      throw new Error(`受信模板读取失败：${draft.config.templatePath} · ${error.message}`);
    }
    const content = this.renderDraftTemplate(
      template,
      draft,
      this.getDraftCreationToday(),
    );
    this.assertDraftPathsAvailable(draft.slug);

    let file;
    try {
      file = await this.app.vault.create(path, content);
    } catch (error) {
      throw new Error(`草稿创建失败：${error.message}。未覆盖任何文件。`);
    }

    let opened = true;
    try {
      await this.app.workspace.getLeaf(false).openFile(file);
    } catch {
      opened = false;
    }
    return Object.freeze({ file, opened, path });
  }

  getAuthorTransactionNow() {
    return Date.now();
  }

  setAuthorTransactionPhase(lease, phase) {
    if (!lease || this.authorTransactionLease !== lease) return false;
    if (!Object.prototype.hasOwnProperty.call(AUTHOR_TRANSACTION_PHASE_LABELS, phase)) {
      return false;
    }
    const observedAt = this.getAuthorTransactionNow();
    const phaseEnteredAt = Number.isFinite(observedAt)
      ? Math.max(lease.phaseEnteredAt, Math.floor(observedAt))
      : lease.phaseEnteredAt;
    lease.phase = phase;
    lease.phaseEnteredAt = phaseEnteredAt;
    lease.lastOutputAt = null;
    return true;
  }

  recordAuthorTransactionOutput(lease, child) {
    if (
      !lease ||
      this.authorTransactionLease !== lease ||
      lease.child !== child
    ) return false;
    const observedAt = this.getAuthorTransactionNow();
    if (!Number.isFinite(observedAt)) return false;
    const outputAt = Math.max(lease.phaseEnteredAt, Math.floor(observedAt));
    lease.lastOutputAt = lease.lastOutputAt === null
      ? outputAt
      : Math.max(lease.lastOutputAt, outputAt);
    return true;
  }

  getAuthorTransactionSnapshot(lease = this.authorTransactionLease) {
    if (!lease || this.authorTransactionLease !== lease) return null;
    const observedAt = this.getAuthorTransactionNow();
    const snapshotAt = Number.isFinite(observedAt)
      ? Math.floor(observedAt)
      : lease.startedAt;
    const elapsedMs = Math.max(0, snapshotAt - lease.startedAt);
    const phaseElapsedMs = Math.max(0, snapshotAt - lease.phaseEnteredAt);
    const silentSince = lease.lastOutputAt ?? lease.phaseEnteredAt;
    const silentMs = Math.max(0, snapshotAt - silentSince);
    return Object.freeze({
      elapsedMs,
      label: lease.transaction.label,
      lastOutputAt: lease.lastOutputAt,
      phase: lease.phase,
      phaseElapsedMs,
      phaseEnteredAt: lease.phaseEnteredAt,
      silentMs,
      sourcePath: lease.transaction.sourcePath,
      startedAt: lease.startedAt,
    });
  }

  recordAuthorTransactionReceipt(lease, outcome) {
    if (!lease || this.authorTransactionLease !== lease) return null;
    if (!Object.prototype.hasOwnProperty.call(AUTHOR_TRANSACTION_OUTCOME_LABELS, outcome)) {
      return null;
    }
    const evidenceAt = Math.max(
      lease.startedAt,
      lease.phaseEnteredAt,
      lease.lastOutputAt ?? lease.startedAt,
    );
    const observedAt = this.getAuthorTransactionNow();
    const endedAt = Number.isFinite(observedAt)
      ? Math.max(evidenceAt, Math.floor(observedAt))
      : evidenceAt;
    const receipt = Object.freeze({
      elapsedMs: Math.max(0, endedAt - lease.startedAt),
      endedAt,
      label: lease.transaction.label,
      outcome,
      phase: lease.phase,
      sourcePath: lease.transaction.sourcePath,
      startedAt: lease.startedAt,
    });
    this.lastAuthorTransactionReceipt = receipt;
    return receipt;
  }

  formatAuthorTransactionElapsed(elapsedMs) {
    const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours} 小时 ${String(minutes).padStart(2, "0")} 分 ${String(seconds).padStart(2, "0")} 秒`;
    }
    if (minutes > 0) {
      return `${minutes} 分 ${String(seconds).padStart(2, "0")} 秒`;
    }
    return `${seconds} 秒`;
  }

  formatAuthorTransactionNotice(state, snapshot) {
    return [
      `AUTHOR TRANSACTION / ${state}`,
      `操作：${snapshot.label}`,
      `来源：${snapshot.sourcePath}`,
      `阶段：${AUTHOR_TRANSACTION_PHASE_LABELS[snapshot.phase]}`,
      `阶段进入：${new Date(snapshot.phaseEnteredAt).toISOString()} · 已 ${this.formatAuthorTransactionElapsed(snapshot.phaseElapsedMs)}`,
      `最近输出：${snapshot.lastOutputAt === null ? "本阶段尚无输出" : new Date(snapshot.lastOutputAt).toISOString()} · 静默 ${this.formatAuthorTransactionElapsed(snapshot.silentMs)}`,
      `开始：${new Date(snapshot.startedAt).toISOString()} · 总计 ${this.formatAuthorTransactionElapsed(snapshot.elapsedMs)}`,
      state === "BUSY"
        ? "当前操作完成后再试。"
        : "只读快照；不会取消、重试或排队。",
    ].join("\n");
  }

  formatAuthorTransactionReceipt(receipt) {
    return [
      "AUTHOR TRANSACTION / IDLE · LAST RECEIPT",
      `结果：${AUTHOR_TRANSACTION_OUTCOME_LABELS[receipt.outcome]}`,
      `操作：${receipt.label}`,
      `来源：${receipt.sourcePath}`,
      `最终阶段：${AUTHOR_TRANSACTION_PHASE_LABELS[receipt.phase]}`,
      `开始：${new Date(receipt.startedAt).toISOString()}`,
      `结束：${new Date(receipt.endedAt).toISOString()}`,
      `总计：${this.formatAuthorTransactionElapsed(receipt.elapsedMs)}`,
      "会话内回执；重新加载插件后清除。不会重试、恢复或推送。",
    ].join("\n");
  }

  inspectAuthorTransaction(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    const snapshot = this.getAuthorTransactionSnapshot();
    if (!snapshot) {
      if (this.lastAuthorTransactionReceipt) {
        new Notice(
          this.formatAuthorTransactionReceipt(this.lastAuthorTransactionReceipt),
          10000,
        );
        return true;
      }
      new Notice(
        "AUTHOR TRANSACTION / IDLE\n当前没有运行中的作者事务。",
        5000,
      );
      return true;
    }
    new Notice(this.formatAuthorTransactionNotice("ACTIVE", snapshot), 10000);
    return true;
  }

  releaseAuthorTransactionLease(lease, child, outcome) {
    if (!lease || this.authorTransactionLease !== lease) return false;
    if (child && lease.child !== child) return false;
    if (!this.recordAuthorTransactionReceipt(lease, outcome)) return false;
    this.authorTransactionLease = null;
    return true;
  }

  runRepositoryCommand(npmArgs, messages, onSuccess, authorLease = null) {
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
      this.releaseAuthorTransactionLease(authorLease, null, "start-failed");
      new Notice(`${messages.startFailure}: ${error.message}`, 10000);
      return true;
    }

    if (authorLease && this.authorTransactionLease === authorLease) {
      authorLease.child = child;
      authorLease.lastOutputAt = null;
    }

    let output = "";
    let outputTruncated = false;
    let settled = false;
    const appendOutput = (chunk) => {
      this.recordAuthorTransactionOutput(authorLease, child);
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
      this.releaseAuthorTransactionLease(authorLease, child, "start-failed");
      new Notice(`${messages.startFailure}: ${error.message}`, 10000);
    });
    child.on("close", (code) => {
      if (!cancel()) return;
      const allowedExitCodes = messages.allowedExitCodes ?? [0];
      if (allowedExitCodes.includes(code)) {
        let terminalOutcome = "completed";
        try {
          if (onSuccess(report(), code) === "held") {
            terminalOutcome = "held";
          }
          if (messages.success) {
            new Notice(messages.success, messages.successDuration ?? 5000);
          }
        } catch (error) {
          terminalOutcome = "result-failed";
          new Notice(`${messages.failure}: ${error.message}`, 15000);
        } finally {
          this.releaseAuthorTransactionLease(authorLease, child, terminalOutcome);
        }
        return;
      }
      const summary = report().split(/\r?\n/u).slice(-4).join("\n");
      this.releaseAuthorTransactionLease(authorLease, child, "command-failed");
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
      [
        "--silent",
        "run",
        "content:status",
        "--",
        "--format",
        "json",
      ],
      {
        allowedExitCodes: [0, 1],
        failure: "内容复核检查未完成",
        progress: "正在读取结构化复核台账…",
        startFailure: "内容复核检查无法启动",
      },
      (output) => this.openStructuredMaintenance(output),
    );
  }

  inspectReviewDelivery(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:review:status",
        "--",
        "--format",
        "json",
      ],
      {
        allowedExitCodes: [0, 1],
        failure: "正式复核交付状态检查未完成",
        progress: "正在读取本地正式复核交付证据…",
        startFailure: "正式复核交付状态命令无法启动",
      },
      (output) => this.openStructuredReviewDelivery(output),
    );
  }

  openStructuredReviewDelivery(output) {
    try {
      const report = parseContentReviewDeliveryReport(output);
      new ContentReviewDeliveryModal(this.app, report).open();
      new Notice("正式内容复核交付状态已更新。", 5000);
    } catch (error) {
      new Notice(
        `结构化交付证据不可用：${error.message}。正在重新读取本地纯文本证据…`,
        10000,
      );
      this.inspectReviewDeliveryText();
    }
  }

  inspectReviewDeliveryText() {
    return this.runRepositoryCommand(
      ["--silent", "run", "content:review:status"],
      {
        allowedExitCodes: [0, 1],
        failure: "纯文本正式复核交付证据未完成",
        progress: "正在读取本地纯文本交付证据…",
        startFailure: "纯文本正式复核交付状态命令无法启动",
        success: "已打开纯文本正式复核交付证据。",
      },
      (report) => new ContentReviewDeliveryTextModal(this.app, report).open(),
    );
  }

  inspectPublishDelivery(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:publish:status",
        "--",
        "--format",
        "json",
      ],
      {
        allowedExitCodes: [0, 1],
        failure: "新内容发布交付状态检查未完成",
        progress: "正在读取本地新内容发布交付证据…",
        startFailure: "新内容发布交付状态命令无法启动",
      },
      (output) => this.openStructuredPublishDelivery(output),
    );
  }

  inspectDeliveryTriage(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:delivery:status",
        "--",
        "--format",
        "json",
      ],
      {
        allowedExitCodes: [0, 1],
        failure: "Git 交付恢复分诊未完成",
        progress: "正在读取同一个本地 Git 交付快照…",
        startFailure: "Git 交付恢复分诊命令无法启动",
      },
      (output) => this.openStructuredDeliveryTriage(output),
    );
  }

  inspectAuthorEnvironment(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:author:doctor",
        "--",
        "--format",
        "json",
      ],
      {
        allowedExitCodes: [0, 1],
        failure: "本机发布环境自检未完成",
        progress: "正在读取本机作者发布前置条件…",
        startFailure: "本机发布环境自检命令无法启动",
      },
      (output) => this.openStructuredAuthorEnvironment(output),
    );
  }

  preflightAuthorTransaction(transaction, onReady) {
    const activeLease = this.authorTransactionLease;
    if (activeLease) {
      const snapshot = this.getAuthorTransactionSnapshot(activeLease);
      if (snapshot) {
        new Notice(this.formatAuthorTransactionNotice("BUSY", snapshot), 10000);
      }
      return true;
    }

    const startedAt = this.getAuthorTransactionNow();
    const lease = {
      child: null,
      lastOutputAt: null,
      phase: "preflight",
      phaseEnteredAt: startedAt,
      startedAt,
      transaction: Object.freeze({ ...transaction }),
    };
    this.authorTransactionLease = lease;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:author:doctor",
        "--",
        "--format",
        "json",
      ],
      {
        allowedExitCodes: [0, 1],
        failure: `${transaction.label}的本机前置检查未完成；原操作未启动`,
        progress: `正在确认“${transaction.label}”的本机发布前置条件…`,
        startFailure: `${transaction.label}的本机前置检查无法启动；原操作未启动`,
      },
      (output) => this.continueAuthorTransaction(
        output,
        lease.transaction,
        onReady,
        lease,
      ),
      lease,
    );
  }

  continueAuthorTransaction(output, transaction, onReady, lease) {
    let report;
    try {
      const root = this.app.vault.adapter.getBasePath();
      report = parseAuthorDoctorReport(output, root);
    } catch (error) {
      if (!this.setAuthorTransactionPhase(lease, "diagnostic")) return;
      new Notice(
        `结构化作者环境证据不可用：${error.message}。${transaction.label}未启动，正在重新读取本地纯文本证据…`,
        10000,
      );
      this.inspectAuthorEnvironmentText(transaction, lease);
      return;
    }

    if (report.status !== "ready") {
      new AuthorDoctorModal(this.app, report, transaction).open();
      new Notice(
        `本机发布环境有 ${report.summary.attention} 项需要处理；${transaction.label}未启动。`,
        8000,
      );
      return "held";
    }

    if (!this.setAuthorTransactionPhase(lease, "domain")) return;
    onReady(lease);
  }

  openStructuredAuthorEnvironment(output) {
    try {
      const root = this.app.vault.adapter.getBasePath();
      const report = parseAuthorDoctorReport(output, root);
      new AuthorDoctorModal(this.app, report).open();
      new Notice(
        report.status === "ready"
          ? "本机发布环境已就绪。"
          : `本机发布环境有 ${report.summary.attention} 项需要处理。`,
        6000,
      );
    } catch (error) {
      new Notice(
        `结构化作者环境证据不可用：${error.message}。正在重新读取本地纯文本证据…`,
        10000,
      );
      this.inspectAuthorEnvironmentText();
    }
  }

  inspectAuthorEnvironmentText(transaction = null, authorLease = null) {
    return this.runRepositoryCommand(
      ["--silent", "run", "content:author:doctor"],
      {
        allowedExitCodes: [0, 1],
        failure: "纯文本本机发布环境自检未完成",
        progress: "正在读取本机纯文本作者环境证据…",
        startFailure: "纯文本本机发布环境自检命令无法启动",
        success: "已打开纯文本本机发布环境自检。",
      },
      (report) => {
        new AuthorDoctorTextModal(this.app, report, transaction).open();
        return transaction && authorLease ? "held" : undefined;
      },
      authorLease,
    );
  }

  openStructuredDeliveryTriage(output) {
    try {
      const report = parseContentDeliveryTriageReport(output);
      new ContentDeliveryTriageModal(this.app, report).open();
      new Notice("Git 交付恢复分诊已更新。", 5000);
    } catch (error) {
      new Notice(
        `结构化分诊证据不可用：${error.message}。正在重新读取本地纯文本证据…`,
        10000,
      );
      this.inspectDeliveryTriageText();
    }
  }

  inspectDeliveryTriageText() {
    return this.runRepositoryCommand(
      ["--silent", "run", "content:delivery:status"],
      {
        allowedExitCodes: [0, 1],
        failure: "纯文本 Git 交付恢复分诊未完成",
        progress: "正在读取本地纯文本交付分诊证据…",
        startFailure: "纯文本 Git 交付恢复分诊命令无法启动",
        success: "已打开纯文本 Git 交付恢复分诊。",
      },
      (report) => new ContentDeliveryTriageTextModal(this.app, report).open(),
    );
  }

  openStructuredPublishDelivery(output) {
    try {
      const report = parseContentPublishDeliveryReport(output);
      new ContentPublishDeliveryModal(this.app, report).open();
      new Notice("新内容发布交付状态已更新。", 5000);
    } catch (error) {
      new Notice(
        `结构化发布交付证据不可用：${error.message}。正在重新读取本地纯文本证据…`,
        10000,
      );
      this.inspectPublishDeliveryText();
    }
  }

  inspectPublishDeliveryText() {
    return this.runRepositoryCommand(
      ["--silent", "run", "content:publish:status"],
      {
        allowedExitCodes: [0, 1],
        failure: "纯文本新内容发布交付证据未完成",
        progress: "正在读取本地纯文本发布交付证据…",
        startFailure: "纯文本新内容发布交付状态命令无法启动",
        success: "已打开纯文本新内容发布交付证据。",
      },
      (report) => new ContentPublishDeliveryTextModal(this.app, report).open(),
    );
  }

  deliverPendingReview(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:review:deliver",
        "--",
        "--format",
        "json",
      ],
      {
        failure: "待交付正式内容重新同步未完成",
        progress: "正在重新验证并同步精确复核提交…",
        startFailure: "待交付正式内容重新同步命令无法启动",
      },
      (output) => {
        let receipt;
        try {
          receipt = parseContentReviewDeliveryReceipt(output);
        } catch (error) {
          throw new Error(
            `重新同步未能生成可信回执：${error.message}；请运行“查看待同步正式内容复核”重新取证`,
          );
        }
        new ContentReviewDeliveryReceiptModal(this.app, receipt).open();
        this.app.vault.adapter.reconcile?.();
        new Notice("待交付正式内容复核已重新同步。", 8000);
      },
    );
  }

  deliverPendingPublication(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:publish:deliver",
        "--",
        "--format",
        "json",
      ],
      {
        failure: "待交付新内容发布重新同步未完成",
        progress: "正在重新验证并同步精确发布包…",
        startFailure: "待交付新内容发布重新同步命令无法启动",
      },
      (output) => {
        let receipt;
        try {
          receipt = parseContentPublishDeliveryReceipt(output);
        } catch (error) {
          throw new Error(
            `重新同步未能生成可信发布回执：${error.message}；请运行“查看待同步新内容发布”重新取证`,
          );
        }
        new ContentPublishDeliveryReceiptModal(this.app, receipt).open();
        this.app.vault.adapter.reconcile?.();
        new Notice("待交付新内容发布已重新同步。", 8000);
      },
    );
  }

  openStructuredMaintenance(output) {
    try {
      const report = parseMaintenanceReport(output);
      new ContentMaintenanceModal(
        this.app,
        report,
        (sourcePath, modal) => this.openMaintenanceSource(sourcePath, modal),
      ).open();
      new Notice("已发布内容复核台账已更新。", 5000);
    } catch (error) {
      new Notice(
        `结构化复核台账不可用：${error.message}。正在读取纯文本证据…`,
        10000,
      );
      this.inspectPublishedMaintenanceText();
    }
  }

  inspectPublishedMaintenanceText() {
    return this.runRepositoryCommand(
      ["--silent", "run", "content:status"],
      {
        allowedExitCodes: [0, 1],
        failure: "纯文本内容复核证据未完成",
        progress: "正在读取纯文本复核证据…",
        startFailure: "纯文本内容复核检查无法启动",
        success: "已打开纯文本复核证据。",
      },
      (report) => new ContentMaintenanceTextModal(this.app, report).open(),
    );
  }

  async openMaintenanceSource(sourcePath, modal) {
    if (!/^content\/(?:posts|projects)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(sourcePath)) {
      new Notice("维护记录的来源路径不安全，已拒绝打开。", 10000);
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!file || file.path !== sourcePath || file.extension !== "md") {
      new Notice(`找不到可打开的 Markdown 笔记：${sourcePath}`, 10000);
      return;
    }
    try {
      await this.app.workspace.getLeaf(false).openFile(file);
      modal.close();
    } catch (error) {
      new Notice(`笔记打开失败：${error.message}`, 10000);
    }
  }

  reviewCurrentPublishedNote(checking, push) {
    const file = this.app.workspace.getActiveFile();
    const isPublishedNote =
      file?.extension === "md" &&
      /^content\/(?:posts|projects)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(
        file.path,
      );
    if (!isPublishedNote || !this.isDesktopVault()) return false;
    if (checking) return true;

    const transaction = {
      label: push
        ? "提交并同步当前正式内容复核"
        : "检查当前正式内容复核",
      sourcePath: file.path,
    };
    return this.preflightAuthorTransaction(
      transaction,
      (lease) => this.runContentReview(transaction.sourcePath, push, lease),
    );
  }

  runContentReview(sourcePath, push, authorLease = null) {
    if (!push) {
      return this.runRepositoryCommand(
        [
          "run",
          "content:review",
          "--",
          sourcePath,
          "--check-only",
          "--format",
          "json",
        ],
        {
          failure: "正式内容复核未完成",
          progress: "正在执行正式内容完整复核检查…",
          startFailure: "正式内容复核命令无法启动",
        },
        (output) => this.openStructuredContentReview(
          output,
          sourcePath,
          authorLease,
        ),
        authorLease,
      );
    }

    return this.runRepositoryCommand(
      ["run", "content:review", "--", sourcePath, "--push"],
      {
        failure: "正式内容复核未完成",
        progress: "正在执行完整检查、提交并同步复核…",
        startFailure: "正式内容复核命令无法启动",
        success: "正式内容复核已提交并同步，等待线上部署完成。",
        successDuration: 8000,
      },
      () => this.app.vault.adapter.reconcile?.(),
      authorLease,
    );
  }

  openStructuredContentReview(output, sourcePath, authorLease = null) {
    try {
      const proof = parseContentReviewProof(output, sourcePath);
      new ContentReviewProofModal(this.app, proof).open();
      new Notice("正式内容 Author Proof 已生成；尚未提交或推送。", 8000);
    } catch (error) {
      if (
        authorLease &&
        !this.setAuthorTransactionPhase(authorLease, "diagnostic")
      ) return;
      new Notice(
        `结构化 Author Proof 不可用：${error.message}。正在重新读取纯文本证据…`,
        10000,
      );
      this.inspectContentReviewText(sourcePath, authorLease);
    }
  }

  inspectContentReviewText(sourcePath, authorLease = null) {
    return this.runRepositoryCommand(
      ["run", "content:review", "--", sourcePath, "--check-only"],
      {
        failure: "纯文本正式内容复核未完成",
        progress: "正在重新执行纯文本正式内容复核…",
        startFailure: "纯文本正式内容复核命令无法启动",
        success: "已打开纯文本正式内容复核证据。",
        successDuration: 8000,
      },
      (report) => new ContentReviewProofTextModal(this.app, report).open(),
      authorLease,
    );
  }

  publishCurrentNote(checking, push) {
    const file = this.app.workspace.getActiveFile();
    const isInboxNote =
      file?.extension === "md" &&
      /^content\/inbox\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(file.path);
    if (!isInboxNote || !this.isDesktopVault()) return false;
    if (checking) return true;

    const transaction = {
      label: push ? "发布当前草稿并同步 GitHub" : "检查当前草稿",
      sourcePath: file.path,
    };
    return this.preflightAuthorTransaction(
      transaction,
      (lease) => this.runContentPublish(transaction.sourcePath, push, lease),
    );
  }

  runContentPublish(sourcePath, push, authorLease = null) {
    return this.runRepositoryCommand(
      [
        "run",
        "content:publish",
        "--",
        sourcePath,
        push ? "--push" : "--check-only",
      ],
      {
        failure: "发布未完成",
        progress: push ? "正在检查、提交并发布…" : "正在检查当前草稿…",
        startFailure: "发布命令无法启动",
        success: push ? "已提交并同步，等待线上部署完成。" : "草稿通过发布前检查。",
        successDuration: 8000,
      },
      () => this.app.vault.adapter.reconcile?.(),
      authorLease,
    );
  }
};
