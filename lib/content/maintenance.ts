import {
  CURRENT_CONTENT_MAX_AGE_DAYS,
  ContentValidationError,
  type ContentRecord,
  contentReviewAgeDays,
  isPublished,
} from "./contract.ts";

export const CONTENT_REVIEW_SOON_DAYS = 60;
export const CONTENT_REVIEW_DUE_SOON_DAYS = 30;

export const CONTENT_REVIEW_CHECKLIST = [
  "核对正文中的架构、版本、项目状态与操作步骤",
  "打开并验证 repository、demo、canonical 与关键外链",
  "重新执行仍对读者作出承诺的命令或代码示例",
  "事实变化时更新正文和 updatedAt；全部确认后再更新 reviewedAt",
] as const;

export const CONTENT_MAINTENANCE_STATUSES = [
  "healthy",
  "review-soon",
  "due-soon",
  "overdue",
] as const;

export type ContentMaintenanceStatus =
  (typeof CONTENT_MAINTENANCE_STATUSES)[number];

export type ContentMaintenanceEntry = {
  ageDays: number;
  kind: ContentRecord["kind"];
  remainingDays: number;
  reviewedAt: string;
  reviewBy: string;
  slug: string;
  sourcePath: string;
  status: ContentMaintenanceStatus;
  title: string;
  url: ContentRecord["url"];
};

export type ContentMaintenanceReport = {
  buildDate: string;
  counts: Record<ContentMaintenanceStatus, number>;
  currentCount: number;
  excludedCount: number;
  historicalCount: number;
  maxAgeDays: number;
  records: ContentMaintenanceEntry[];
  reviewChecklist: readonly string[];
  thresholds: {
    dueSoonDays: number;
    reviewSoonDays: number;
  };
};

type MaintenanceOptions = {
  dueSoonDays?: number;
  maxAgeDays?: number;
  reviewSoonDays?: number;
};

const STATUS_ORDER: Record<ContentMaintenanceStatus, number> = {
  overdue: 0,
  "due-soon": 1,
  "review-soon": 2,
  healthy: 3,
};

const STATUS_LABELS: Record<ContentMaintenanceStatus, string> = {
  healthy: "健康",
  "review-soon": "进入复核窗口",
  "due-soon": "即将到期",
  overdue: "已过期",
};

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function maintenanceStatus(
  remainingDays: number,
  reviewSoonDays: number,
  dueSoonDays: number,
): ContentMaintenanceStatus {
  if (remainingDays < 0) return "overdue";
  if (remainingDays <= dueSoonDays) return "due-soon";
  if (remainingDays <= reviewSoonDays) return "review-soon";
  return "healthy";
}

export function createContentMaintenanceReport(
  records: ContentRecord[],
  buildDate: string,
  options: MaintenanceOptions = {},
): ContentMaintenanceReport {
  const maxAgeDays = options.maxAgeDays ?? CURRENT_CONTENT_MAX_AGE_DAYS;
  const reviewSoonDays = options.reviewSoonDays ?? CONTENT_REVIEW_SOON_DAYS;
  const dueSoonDays = options.dueSoonDays ?? CONTENT_REVIEW_DUE_SOON_DAYS;
  if (
    dueSoonDays < 0 ||
    reviewSoonDays < dueSoonDays ||
    maxAgeDays < reviewSoonDays
  ) {
    throw new Error(
      "内容维护阈值必须满足 0 ≤ dueSoonDays ≤ reviewSoonDays ≤ maxAgeDays",
    );
  }

  const buildTime = new Date(`${buildDate}T12:00:00Z`);
  const publishedRecords = records.filter((record) => isPublished(record, buildTime));
  const currentRecords = publishedRecords.filter(
    (record) => record.freshness === "current",
  );
  const entries = currentRecords
    .map<ContentMaintenanceEntry>((record) => {
      const ageDays = contentReviewAgeDays(record.reviewedAt, buildDate);
      if (ageDays < 0) {
        throw new ContentValidationError(
          record.sourcePath,
          `reviewedAt 不能晚于报告日期 ${buildDate}`,
        );
      }
      const remainingDays = maxAgeDays - ageDays;
      return {
        ageDays,
        kind: record.kind,
        remainingDays,
        reviewedAt: record.reviewedAt,
        reviewBy: addIsoDays(record.reviewedAt, maxAgeDays),
        slug: record.slug,
        sourcePath: record.sourcePath,
        status: maintenanceStatus(remainingDays, reviewSoonDays, dueSoonDays),
        title: record.title,
        url: record.url,
      };
    })
    .sort(
      (left, right) =>
        STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
        left.remainingDays - right.remainingDays ||
        left.sourcePath.localeCompare(right.sourcePath, "en"),
    );

  const counts = Object.fromEntries(
    CONTENT_MAINTENANCE_STATUSES.map((status) => [
      status,
      entries.filter((entry) => entry.status === status).length,
    ]),
  ) as Record<ContentMaintenanceStatus, number>;

  return {
    buildDate,
    counts,
    currentCount: entries.length,
    excludedCount: records.length - publishedRecords.length,
    historicalCount: publishedRecords.length - currentRecords.length,
    maxAgeDays,
    records: entries,
    reviewChecklist: CONTENT_REVIEW_CHECKLIST,
    thresholds: { dueSoonDays, reviewSoonDays },
  };
}

function remainingLabel(remainingDays: number) {
  return remainingDays >= 0
    ? `剩余 ${remainingDays} 天`
    : `逾期 ${Math.abs(remainingDays)} 天`;
}

export function formatContentMaintenanceText(report: ContentMaintenanceReport) {
  const lines = [
    `[maintenance] 报告日期：${report.buildDate}`,
    `[maintenance] Current ${report.currentCount} · Historical ${report.historicalCount} · 未公开 ${report.excludedCount}`,
  ];

  if (report.records.length === 0) {
    lines.push("[maintenance] 当前没有需要持续复核的公开内容。");
  }
  for (const record of report.records) {
    lines.push(
      `[maintenance] ${STATUS_LABELS[record.status]} · ${record.sourcePath} · reviewed ${record.reviewedAt} · review by ${record.reviewBy} · ${remainingLabel(record.remainingDays)}`,
    );
  }

  lines.push("[maintenance] 复核清单：");
  report.reviewChecklist.forEach((item, index) => {
    lines.push(`[maintenance] ${index + 1}. ${item}`);
  });
  return lines.join("\n");
}

function escapeTableCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function formatContentMaintenanceMarkdown(
  report: ContentMaintenanceReport,
) {
  const lines = [
    "## Content maintenance",
    "",
    `报告日期：\`${report.buildDate}\` · Current：${report.currentCount} · Historical：${report.historicalCount} · 未公开：${report.excludedCount}`,
    "",
    "| 状态 | 内容 | 最近复核 | 最后有效日 | 剩余时间 |",
    "| --- | --- | --- | --- | --- |",
  ];

  if (report.records.length === 0) {
    lines.push("| 无 | 当前没有需要持续复核的公开内容 | — | — | — |");
  }
  for (const record of report.records) {
    lines.push(
      `| ${STATUS_LABELS[record.status]} | ${escapeTableCell(record.title)} (\`${record.sourcePath}\`) | ${record.reviewedAt} | ${record.reviewBy} | ${remainingLabel(record.remainingDays)} |`,
    );
  }

  lines.push("", "### 复核清单", "");
  report.reviewChecklist.forEach((item) => lines.push(`- [ ] ${item}`));
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

export function formatContentMaintenanceAnnotations(
  report: ContentMaintenanceReport,
) {
  return report.records.flatMap((record) => {
    if (record.status === "healthy") return [];
    const command = record.status === "overdue" ? "error" : "warning";
    const title = `内容${STATUS_LABELS[record.status]}`;
    const message = `${record.title}：reviewedAt ${record.reviewedAt}，${remainingLabel(record.remainingDays)}；请按维护报告复核。`;
    return [
      `::${command} file=${escapeWorkflowProperty(record.sourcePath)},title=${escapeWorkflowProperty(title)}::${escapeWorkflowMessage(message)}`,
    ];
  });
}
