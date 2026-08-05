import { resolveContentBuildDate } from "../build/content-build-date.ts";
import {
  inspectContentDraft,
  measureContent,
  type ContentDraftIssue,
} from "./content/contract.ts";

export const STUDIO_ENTRY_PREFLIGHT_MAX_BYTES = 128 * 1024;

export type StudioCollection = "posts" | "projects";

export interface StudioEntryPreflightFact {
  label: string;
  value: string;
}

export interface StudioEntryPreflightResult {
  facts: StudioEntryPreflightFact[];
  issueCount: number;
  issues: ContentDraftIssue[];
  note: string;
  ok: boolean;
}

function recordValue(fields: Record<string, unknown>, name: string) {
  return fields[name];
}

function pathFact(collection: StudioCollection, fields: Record<string, unknown>) {
  const slug = recordValue(fields, "slug");
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    return "等待稳定 slug";
  }
  return `/${collection}/${slug}`;
}

function visibilityFact(fields: Record<string, unknown>, buildDate: string) {
  if (recordValue(fields, "draft") === true) return "草稿 · 不公开";
  const publishedAt = recordValue(fields, "publishedAt");
  if (typeof publishedAt === "string" && publishedAt > buildDate) {
    return `定时 · ${publishedAt}`;
  }
  if (recordValue(fields, "draft") === false) return "公开候选";
  return "等待草稿状态";
}

function freshnessFact(fields: Record<string, unknown>) {
  if (recordValue(fields, "freshness") === "current") return "持续维护";
  if (recordValue(fields, "freshness") === "historical") return "历史快照";
  return "等待内容语境";
}

function bodyFact(fields: Record<string, unknown>) {
  const body = recordValue(fields, "body");
  if (typeof body !== "string" || !body.trim()) return "等待正文";
  const stats = measureContent(body);
  return `${stats.wordCount} 字词 · 约 ${stats.readingMinutes} 分钟`;
}

export function inspectStudioEntryPreflight(
  collection: StudioCollection,
  fields: Record<string, unknown>,
  now = new Date(),
): StudioEntryPreflightResult {
  const buildDate = resolveContentBuildDate(now);
  const inspection = inspectContentDraft(
    collection === "posts" ? "post" : "project",
    fields,
    buildDate,
  );
  const issueCount = inspection.issues.length;

  return {
    facts: [
      { label: "PATH", value: pathFact(collection, fields) },
      { label: "VISIBILITY", value: visibilityFact(fields, buildDate) },
      { label: "CONTEXT", value: freshnessFact(fields) },
      { label: "BODY", value: bodyFact(fields) },
    ],
    issueCount,
    issues: inspection.issues,
    note: inspection.ok
      ? "当前条目字段已通过；仓库关系、媒体引用和完整构建仍会在保存后验证。"
      : `发现 ${issueCount} 项字段问题；修改后会自动复检，不会阻止继续编辑。`,
    ok: inspection.ok,
  };
}
