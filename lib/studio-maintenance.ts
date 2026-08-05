import type { ContentRecord } from "./content/contract.ts";
import {
  createContentMaintenanceReport,
  type ContentMaintenanceStatus,
} from "./content/maintenance.ts";

export type StudioMaintenanceRecord = {
  editUrl: string;
  kind: ContentRecord["kind"];
  publicUrl: ContentRecord["url"];
  remainingDays: number;
  reviewedAt: string;
  reviewBy: string;
  slug: string;
  status: ContentMaintenanceStatus;
  title: string;
};

export type StudioMaintenanceSnapshot = {
  counts: Record<ContentMaintenanceStatus, number>;
  currentCount: number;
  historicalCount: number;
  maxAgeDays: number;
  records: StudioMaintenanceRecord[];
  reportDate: string;
  reviewChecklist: readonly string[];
  thresholds: {
    dueSoonDays: number;
    reviewSoonDays: number;
  };
  version: 1;
};

function studioEditUrl(record: Pick<ContentRecord, "kind" | "slug">) {
  const collection = record.kind === "post" ? "posts" : "projects";
  return `/studio/#/collections/${collection}/entries/${encodeURIComponent(record.slug)}`;
}

export function createStudioMaintenanceSnapshot(
  records: ContentRecord[],
  reportDate: string,
): StudioMaintenanceSnapshot {
  const report = createContentMaintenanceReport(records, reportDate);

  return {
    counts: report.counts,
    currentCount: report.currentCount,
    historicalCount: report.historicalCount,
    maxAgeDays: report.maxAgeDays,
    records: report.records.map((record) => ({
      editUrl: studioEditUrl(record),
      kind: record.kind,
      publicUrl: record.url,
      remainingDays: record.remainingDays,
      reviewedAt: record.reviewedAt,
      reviewBy: record.reviewBy,
      slug: record.slug,
      status: record.status,
      title: record.title,
    })),
    reportDate: report.buildDate,
    reviewChecklist: [...report.reviewChecklist],
    thresholds: report.thresholds,
    version: 1,
  };
}
