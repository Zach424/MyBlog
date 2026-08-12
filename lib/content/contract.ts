import { parseDocument } from "yaml";
import { z } from "zod";
import { getMarkdownAudioIssue } from "../markdown-audio.ts";
import { getMarkdownFaqIssue } from "../markdown-faq.ts";
import { getMarkdownFileTreeIssue } from "../markdown-filetree.ts";
import { getMarkdownDecisionIssue } from "../markdown-decision.ts";
import { getMarkdownTimelineIssue } from "../markdown-timeline.ts";
import { getMarkdownGlossaryIssue } from "../markdown-glossary.ts";
import { getMarkdownReferenceIssue } from "../markdown-references.ts";
import { getMarkdownStepsIssue } from "../markdown-steps.ts";
import { getMarkdownMathIssue } from "../markdown-math.ts";
import { getMarkdownDiagramIssue } from "../markdown-diagram.ts";
import { getMarkdownGalleryIssue } from "../markdown-gallery.ts";
import { getMarkdownTableIssue } from "../markdown-table.ts";
import { getMarkdownTaskListIssue } from "../markdown-task-list.ts";
import { getMarkdownVideoIssue } from "../markdown-video.ts";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const CONTENT_FRESHNESS_VALUES = ["current", "historical"] as const;
export type ContentFreshness = (typeof CONTENT_FRESHNESS_VALUES)[number];
export const CURRENT_CONTENT_MAX_AGE_DAYS = 180;

export const TAG_REGISTRY = [
  { name: "Next.js", slug: "nextjs", aliases: ["next.js", "nextjs"] },
  { name: "TypeScript", slug: "typescript", aliases: ["typescript", "ts"] },
  { name: "Cloudflare", slug: "cloudflare", aliases: ["cloudflare"] },
  { name: "Vercel", slug: "vercel", aliases: ["vercel"] },
  { name: "Design Systems", slug: "design-systems", aliases: ["design systems"] },
  { name: "Node.js", slug: "nodejs", aliases: ["node.js", "nodejs"] },
  { name: "Windows", slug: "windows", aliases: ["windows"] },
  { name: "Tooling", slug: "tooling", aliases: ["tooling"] },
  {
    name: "Project Management",
    slug: "project-management",
    aliases: ["project management"],
  },
  { name: "Git", slug: "git", aliases: ["git"] },
  { name: "React", slug: "react", aliases: ["react"] },
  {
    name: "Personal Knowledge",
    slug: "personal-knowledge",
    aliases: ["personal knowledge"],
  },
] as const;

const tagAliasMap = new Map(
  TAG_REGISTRY.flatMap((tag) =>
    tag.aliases.map((alias) => [alias.toLocaleLowerCase("en-US"), tag] as const),
  ),
);

const isoDateSchema = z.preprocess(
  (value) =>
    value instanceof Date && !Number.isNaN(value.valueOf())
      ? value.toISOString().slice(0, 10)
      : value,
  z.string().regex(ISO_DATE_PATTERN, "必须是 YYYY-MM-DD 格式的日期"),
);

const httpsUrlSchema = z
  .string()
  .url("必须是完整 URL")
  .refine((value) => new URL(value).protocol === "https:", "必须使用 HTTPS");

const coverSchema = z
  .string()
  .trim()
  .regex(/^\/uploads\//, "必须使用 /uploads/... 仓库内图片路径");

const coverAltSchema = z
  .string()
  .trim()
  .min(1, "封面替代文本不能为空")
  .max(200, "封面替代文本过长");

const rawTagsSchema = z
  .array(z.string().trim().min(1, "标签不能为空"))
  .min(1, "至少需要 1 个标签")
  .max(5, "最多只能设置 5 个标签")
  .refine(
    (tags) => new Set(tags.map((tag) => tag.toLocaleLowerCase("en-US"))).size === tags.length,
    "标签不能重复",
  );

const seriesSchema = z
  .object({
    slug: z.string().regex(SLUG_PATTERN, "专题 slug 只能包含小写字母、数字和连字符"),
    title: z.string().trim().min(1, "专题标题不能为空"),
    order: z.number().int().positive("专题顺序必须从 1 开始"),
  })
  .strict();

const postFrontmatterSchema = z
  .object({
    title: z.string().trim().min(1, "标题不能为空").max(120, "标题过长"),
    slug: z.string().regex(SLUG_PATTERN, "slug 只能包含小写字母、数字和连字符").optional(),
    description: z.string().trim().min(1, "摘要不能为空").max(320, "摘要过长"),
    type: z.enum(["article", "til"]),
    publishedAt: isoDateSchema,
    updatedAt: isoDateSchema.optional(),
    freshness: z.enum(CONTENT_FRESHNESS_VALUES),
    reviewedAt: isoDateSchema,
    tags: rawTagsSchema,
    draft: z.boolean(),
    featured: z.boolean().default(false),
    series: seriesSchema.optional(),
    canonical: httpsUrlSchema.optional(),
    cover: coverSchema.optional(),
    coverAlt: coverAltSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.updatedAt && value.updatedAt < value.publishedAt) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "不能早于 publishedAt",
      });
    }

    if (value.reviewedAt < (value.updatedAt ?? value.publishedAt)) {
      context.addIssue({
        code: "custom",
        path: ["reviewedAt"],
        message: value.updatedAt ? "不能早于 updatedAt" : "不能早于 publishedAt",
      });
    }

    if (value.draft && value.featured) {
      context.addIssue({
        code: "custom",
        path: ["featured"],
        message: "草稿不能设为精选",
      });
    }

    if (value.cover && !value.coverAlt) {
      context.addIssue({
        code: "custom",
        path: ["coverAlt"],
        message: "设置 cover 时必须填写封面替代文本",
      });
    }

    if (!value.cover && value.coverAlt) {
      context.addIssue({
        code: "custom",
        path: ["coverAlt"],
        message: "未设置 cover 时不能单独填写封面替代文本",
      });
    }
  });

const projectFrontmatterSchema = z
  .object({
    title: z.string().trim().min(1, "标题不能为空").max(120, "标题过长"),
    slug: z.string().regex(SLUG_PATTERN, "slug 只能包含小写字母、数字和连字符").optional(),
    description: z.string().trim().min(1, "摘要不能为空").max(320, "摘要过长"),
    publishedAt: isoDateSchema,
    updatedAt: isoDateSchema.optional(),
    freshness: z.enum(CONTENT_FRESHNESS_VALUES),
    reviewedAt: isoDateSchema,
    status: z.enum(["planning", "building", "maintained", "archived"]),
    stack: z.array(z.string().trim().min(1)).min(1).max(12),
    tags: rawTagsSchema,
    draft: z.boolean(),
    featured: z.boolean().default(false),
    repository: httpsUrlSchema.optional(),
    demo: httpsUrlSchema.nullable().optional(),
    cover: coverSchema.optional(),
    coverAlt: coverAltSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.updatedAt && value.updatedAt < value.publishedAt) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "不能早于 publishedAt",
      });
    }

    if (value.reviewedAt < (value.updatedAt ?? value.publishedAt)) {
      context.addIssue({
        code: "custom",
        path: ["reviewedAt"],
        message: value.updatedAt ? "不能早于 updatedAt" : "不能早于 publishedAt",
      });
    }

    if (value.draft && value.featured) {
      context.addIssue({
        code: "custom",
        path: ["featured"],
        message: "草稿不能设为精选",
      });
    }

    if (value.cover && !value.coverAlt) {
      context.addIssue({
        code: "custom",
        path: ["coverAlt"],
        message: "设置 cover 时必须填写封面替代文本",
      });
    }

    if (!value.cover && value.coverAlt) {
      context.addIssue({
        code: "custom",
        path: ["coverAlt"],
        message: "未设置 cover 时不能单独填写封面替代文本",
      });
    }
  });

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;
export type ProjectFrontmatter = z.infer<typeof projectFrontmatterSchema>;

export interface ContentStats {
  readingMinutes: number;
  wordCount: number;
}

export interface PostRecord extends PostFrontmatter, ContentStats {
  kind: "post";
  slug: string;
  url: `/posts/${string}`;
  sourcePath: string;
  body: string;
}

export interface ProjectRecord extends ProjectFrontmatter, ContentStats {
  kind: "project";
  slug: string;
  url: `/projects/${string}`;
  sourcePath: string;
  body: string;
}

export type ContentRecord = PostRecord | ProjectRecord;

export type ContentDraftKind = "post" | "project";

export interface ContentDraftIssue {
  field: string;
  message: string;
}

export type ContentDraftInspection =
  | { issues: []; ok: true; record: ContentRecord }
  | { issues: ContentDraftIssue[]; ok: false };

export interface TagIndexEntry {
  name: string;
  slug: string;
  count: number;
  items: ContentRecord[];
}

export interface SeriesIndexEntry {
  slug: string;
  title: string;
  posts: PostRecord[];
}

export class ContentValidationError extends Error {
  readonly sourcePath: string;

  constructor(sourcePath: string, message: string) {
    super(`[content] ${sourcePath}: ${message}`);
    this.name = "ContentValidationError";
    this.sourcePath = sourcePath;
  }
}

function sourceSlug(sourcePath: string) {
  const fileName = sourcePath.replaceAll("\\", "/").split("/").at(-1);
  const slug = fileName?.endsWith(".md") ? fileName.slice(0, -3) : "";

  if (!SLUG_PATTERN.test(slug)) {
    throw new ContentValidationError(
      sourcePath,
      "文件名 slug 只能包含小写 ASCII 字母、数字和连字符",
    );
  }

  return slug;
}

function normalizeTags(tags: string[], sourcePath: string) {
  const normalized = tags.map((tag) => {
    const registryEntry = tagAliasMap.get(tag.toLocaleLowerCase("en-US"));

    if (!registryEntry) {
      throw new ContentValidationError(
        sourcePath,
        `未知标签“${tag}”，请先在 TAG_REGISTRY 中登记`,
      );
    }

    return registryEntry.name;
  });

  if (new Set(normalized).size !== normalized.length) {
    throw new ContentValidationError(sourcePath, "标签规范化后出现重复项");
  }

  return normalized;
}

function parseFrontmatter<T>(
  sourcePath: string,
  raw: string,
  schema: z.ZodType<T>,
) {
  const normalizedSource = raw.replace(/^\uFEFF/, "");
  const frontmatterMatch =
    /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(normalizedSource);

  if (!frontmatterMatch) {
    throw new ContentValidationError(
      sourcePath,
      "必须以成对的 --- frontmatter 边界开始",
    );
  }

  let frontmatter: unknown;

  try {
    const document = parseDocument(frontmatterMatch[1], {
      prettyErrors: false,
      schema: "core",
      uniqueKeys: true,
    });

    if (document.errors.length > 0) {
      throw document.errors[0];
    }

    frontmatter = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ContentValidationError(sourcePath, `frontmatter 无法解析：${message}`);
  }

  const result = schema.safeParse(frontmatter);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`)
      .join("；");
    throw new ContentValidationError(sourcePath, issues);
  }

  const body = normalizedSource.slice(frontmatterMatch[0].length).trim();
  if (!body) {
    throw new ContentValidationError(sourcePath, "正文不能为空");
  }

  const mathIssue = getMarkdownMathIssue(body);
  if (mathIssue) {
    const location = mathIssue.line ? `正文第 ${mathIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}数学公式无法解析：${mathIssue.message}`,
    );
  }

  const diagramIssue = getMarkdownDiagramIssue(body);
  if (diagramIssue) {
    const location = diagramIssue.line ? `正文第 ${diagramIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location} Mermaid 图表无法解析：${diagramIssue.message}`,
    );
  }

  const galleryIssue = getMarkdownGalleryIssue(body);
  if (galleryIssue) {
    const location = galleryIssue.line ? `正文第 ${galleryIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}画廊声明无法解析：${galleryIssue.message}`,
    );
  }

  const tableIssue = getMarkdownTableIssue(body);
  if (tableIssue) {
    const location = tableIssue.line ? `正文第 ${tableIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}技术表格声明无法解析：${tableIssue.message}`,
    );
  }

  const taskListIssue = getMarkdownTaskListIssue(body);
  if (taskListIssue) {
    const location = taskListIssue.line ? `正文第 ${taskListIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}任务清单声明无法解析：${taskListIssue.message}`,
    );
  }

  const videoIssue = getMarkdownVideoIssue(body);
  if (videoIssue) {
    const location = videoIssue.line ? `正文第 ${videoIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}视频声明无法解析：${videoIssue.message}`,
    );
  }

  const audioIssue = getMarkdownAudioIssue(body);
  if (audioIssue) {
    const location = audioIssue.line ? `正文第 ${audioIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}音频声明无法解析：${audioIssue.message}`,
    );
  }

  const faqIssue = getMarkdownFaqIssue(body);
  if (faqIssue) {
    const location = faqIssue.line ? `正文第 ${faqIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}FAQ 无法解析：${faqIssue.message}`,
    );
  }

  const fileTreeIssue = getMarkdownFileTreeIssue(body);
  if (fileTreeIssue) {
    const location = fileTreeIssue.line ? `正文第 ${fileTreeIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}项目文件树无法解析：${fileTreeIssue.message}`,
    );
  }

  const timelineIssue = getMarkdownTimelineIssue(body);
  if (timelineIssue) {
    const location = timelineIssue.line ? `正文第 ${timelineIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}项目时间线无法解析：${timelineIssue.message}`,
    );
  }

  const decisionIssue = getMarkdownDecisionIssue(body);
  if (decisionIssue) {
    const location = decisionIssue.line ? `正文第 ${decisionIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}技术决策记录无法解析：${decisionIssue.message}`,
    );
  }

  const referenceIssue = getMarkdownReferenceIssue(body);
  if (referenceIssue) {
    const location = referenceIssue.line ? `正文第 ${referenceIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}参考资料清单无法解析：${referenceIssue.message}`,
    );
  }

  const stepsIssue = getMarkdownStepsIssue(body);
  if (stepsIssue) {
    const location = stepsIssue.line ? `正文第 ${stepsIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}步骤流程无法解析：${stepsIssue.message}`,
    );
  }

  const glossaryIssue = getMarkdownGlossaryIssue(body);
  if (glossaryIssue) {
    const location = glossaryIssue.line ? `正文第 ${glossaryIssue.line} 行` : "正文";
    throw new ContentValidationError(
      sourcePath,
      `${location}术语定义表无法解析：${glossaryIssue.message}`,
    );
  }

  return { data: result.data, body };
}

export function measureContent(markdown: string): ContentStats {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ");
  const cjkCount = prose.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWordCount = prose.match(/[A-Za-z0-9]+(?:[.'-][A-Za-z0-9]+)*/g)?.length ?? 0;
  const wordCount = cjkCount + latinWordCount;
  const readingMinutes = Math.max(1, Math.ceil(cjkCount / 300 + latinWordCount / 200));

  return { readingMinutes, wordCount };
}

export function parsePostFile(sourcePath: string, raw: string): PostRecord {
  const slug = sourceSlug(sourcePath);
  const { data, body } = parseFrontmatter(sourcePath, raw, postFrontmatterSchema);

  if (data.slug && data.slug !== slug) {
    throw new ContentValidationError(sourcePath, "frontmatter slug 必须与文件名一致");
  }

  return {
    ...data,
    tags: normalizeTags(data.tags, sourcePath),
    ...measureContent(body),
    kind: "post",
    slug,
    url: `/posts/${slug}`,
    sourcePath,
    body,
  };
}

export function parseProjectFile(sourcePath: string, raw: string): ProjectRecord {
  const slug = sourceSlug(sourcePath);
  const { data, body } = parseFrontmatter(sourcePath, raw, projectFrontmatterSchema);

  if (data.slug && data.slug !== slug) {
    throw new ContentValidationError(sourcePath, "frontmatter slug 必须与文件名一致");
  }

  return {
    ...data,
    tags: normalizeTags(data.tags, sourcePath),
    ...measureContent(body),
    kind: "project",
    slug,
    url: `/projects/${slug}`,
    sourcePath,
    body,
  };
}

function uniqueDraftIssues(issues: ContentDraftIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.field}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Validates one structured author draft with the same schemas used by Markdown
 * files. Repository-wide relations, media references and series continuity are
 * intentionally left to the full build, which remains the publishing authority.
 */
export function inspectContentDraft(
  kind: ContentDraftKind,
  input: unknown,
  buildDate: string,
): ContentDraftInspection {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      issues: [{ field: "frontmatter", message: "条目字段必须是对象" }],
      ok: false,
    };
  }

  const { body: rawBody, ...frontmatter } = input as Record<string, unknown>;
  const schema = kind === "post" ? postFrontmatterSchema : projectFrontmatterSchema;
  const parsed = schema.safeParse(frontmatter);
  const issues: ContentDraftIssue[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "frontmatter",
        message: issue.message,
      }));

  const rawSlug = frontmatter.slug;
  if (rawSlug === undefined || rawSlug === null || rawSlug === "") {
    issues.push({ field: "slug", message: "Studio 条目必须填写稳定 slug" });
  }

  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (!body) {
    issues.push({ field: "body", message: "正文不能为空" });
  } else {
    const mathIssue = getMarkdownMathIssue(body);
    if (mathIssue) {
      const location = mathIssue.line ? `第 ${mathIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}数学公式无法解析：${mathIssue.message}`,
      });
    }
    const diagramIssue = getMarkdownDiagramIssue(body);
    if (diagramIssue) {
      const location = diagramIssue.line ? `第 ${diagramIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location} Mermaid 图表无法解析：${diagramIssue.message}`,
      });
    }
    const galleryIssue = getMarkdownGalleryIssue(body);
    if (galleryIssue) {
      const location = galleryIssue.line ? `第 ${galleryIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}画廊声明无法解析：${galleryIssue.message}`,
      });
    }
    const tableIssue = getMarkdownTableIssue(body);
    if (tableIssue) {
      const location = tableIssue.line ? `第 ${tableIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}技术表格声明无法解析：${tableIssue.message}`,
      });
    }
    const taskListIssue = getMarkdownTaskListIssue(body);
    if (taskListIssue) {
      const location = taskListIssue.line ? `第 ${taskListIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}任务清单声明无法解析：${taskListIssue.message}`,
      });
    }
    const videoIssue = getMarkdownVideoIssue(body);
    if (videoIssue) {
      const location = videoIssue.line ? `第 ${videoIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}视频声明无法解析：${videoIssue.message}`,
      });
    }
    const audioIssue = getMarkdownAudioIssue(body);
    if (audioIssue) {
      const location = audioIssue.line ? `第 ${audioIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}音频声明无法解析：${audioIssue.message}`,
      });
    }
    const faqIssue = getMarkdownFaqIssue(body);
    if (faqIssue) {
      const location = faqIssue.line ? `第 ${faqIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}FAQ 无法解析：${faqIssue.message}`,
      });
    }
    const fileTreeIssue = getMarkdownFileTreeIssue(body);
    if (fileTreeIssue) {
      const location = fileTreeIssue.line ? `第 ${fileTreeIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}项目文件树无法解析：${fileTreeIssue.message}`,
      });
    }
    const timelineIssue = getMarkdownTimelineIssue(body, {
      maximumDate: buildDate,
    });
    if (timelineIssue) {
      const location = timelineIssue.line ? `第 ${timelineIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}项目时间线无法解析：${timelineIssue.message}`,
      });
    }
    const decisionIssue = getMarkdownDecisionIssue(body, {
      maximumDate: buildDate,
    });
    if (decisionIssue) {
      const location = decisionIssue.line ? `第 ${decisionIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}技术决策记录无法解析：${decisionIssue.message}`,
      });
    }
    const referenceIssue = getMarkdownReferenceIssue(body);
    if (referenceIssue) {
      const location = referenceIssue.line ? `第 ${referenceIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}参考资料清单无法解析：${referenceIssue.message}`,
      });
    }
    const stepsIssue = getMarkdownStepsIssue(body);
    if (stepsIssue) {
      const location = stepsIssue.line ? `第 ${stepsIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}步骤流程无法解析：${stepsIssue.message}`,
      });
    }
    const glossaryIssue = getMarkdownGlossaryIssue(body);
    if (glossaryIssue) {
      const location = glossaryIssue.line ? `第 ${glossaryIssue.line} 行` : "正文";
      issues.push({
        field: "body",
        message: `${location}术语定义表无法解析：${glossaryIssue.message}`,
      });
    }
  }

  if (Array.isArray(frontmatter.tags)) {
    const normalizedTags: string[] = [];
    for (const tag of frontmatter.tags) {
      if (typeof tag !== "string") continue;
      const registryEntry = tagAliasMap.get(tag.toLocaleLowerCase("en-US"));
      if (!registryEntry) {
        issues.push({
          field: "tags",
          message: `未知标签“${tag}”，请先在 TAG_REGISTRY 中登记`,
        });
      } else {
        normalizedTags.push(registryEntry.name);
      }
    }
    if (new Set(normalizedTags).size !== normalizedTags.length) {
      issues.push({ field: "tags", message: "标签规范化后出现重复项" });
    }
  }

  if (parsed.success && typeof rawSlug === "string" && SLUG_PATTERN.test(rawSlug)) {
    const sourcePath = `content/${kind === "post" ? "posts" : "projects"}/${rawSlug}.md`;
    const stats = measureContent(body);
    const tags = parsed.data.tags
      .map((tag) => tagAliasMap.get(tag.toLocaleLowerCase("en-US"))?.name)
      .filter((tag): tag is (typeof TAG_REGISTRY)[number]["name"] => Boolean(tag));
    const record = {
      ...parsed.data,
      ...stats,
      body,
      kind,
      slug: rawSlug,
      sourcePath,
      tags,
      url: `/${kind === "post" ? "posts" : "projects"}/${rawSlug}`,
    } as ContentRecord;

    try {
      validateContentFreshness([record], buildDate);
    } catch (error) {
      issues.push({
        field: "reviewedAt",
        message:
          error instanceof ContentValidationError
            ? error.message.replace(/^\[content\] [^:]+:\s*/u, "")
            : String(error),
      });
    }

    const deduplicatedIssues = uniqueDraftIssues(issues);
    if (deduplicatedIssues.length === 0) {
      return { issues: [], ok: true, record };
    }
    return { issues: deduplicatedIssues, ok: false };
  }

  return { issues: uniqueDraftIssues(issues), ok: false };
}

export function isPublished(record: ContentRecord, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return !record.draft && record.publishedAt <= today;
}

export function contentReviewAgeDays(reviewedAt: string, buildDate: string) {
  const buildTime = Date.parse(`${buildDate}T00:00:00Z`);
  const reviewedTime = Date.parse(`${reviewedAt}T00:00:00Z`);
  return Math.floor((buildTime - reviewedTime) / 86_400_000);
}

export function validateContentFreshness(
  records: ContentRecord[],
  buildDate: string,
  maxAgeDays = CURRENT_CONTENT_MAX_AGE_DAYS,
) {
  for (const record of records) {
    const ageDays = contentReviewAgeDays(record.reviewedAt, buildDate);

    if (ageDays < 0) {
      throw new ContentValidationError(
        record.sourcePath,
        `reviewedAt 不能晚于构建日期 ${buildDate}`,
      );
    }

    if (record.freshness === "current" && ageDays > maxAgeDays) {
      throw new ContentValidationError(
        record.sourcePath,
        `当前维护内容已超过 ${maxAgeDays} 天未复核（reviewedAt: ${record.reviewedAt}）`,
      );
    }
  }
}

export function validateContentTimelines(
  records: ContentRecord[],
  buildDate: string,
) {
  for (const record of records) {
    const issue = getMarkdownTimelineIssue(record.body, {
      maximumDate: buildDate,
    });
    if (!issue) continue;
    const location = issue.line ? `正文第 ${issue.line} 行` : "正文";
    throw new ContentValidationError(
      record.sourcePath,
      `${location}项目时间线无法解析：${issue.message}`,
    );
  }
}

export function validateContentDecisions(
  records: ContentRecord[],
  buildDate: string,
) {
  for (const record of records) {
    const issue = getMarkdownDecisionIssue(record.body, {
      maximumDate: buildDate,
    });
    if (!issue) continue;
    const location = issue.line ? `正文第 ${issue.line} 行` : "正文";
    throw new ContentValidationError(
      record.sourcePath,
      `${location}技术决策记录无法解析：${issue.message}`,
    );
  }
}

export function sortPosts(posts: PostRecord[]) {
  return [...posts].sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      Number(right.featured) - Number(left.featured) ||
      left.slug.localeCompare(right.slug, "en"),
  );
}

export function sortProjects(projects: ProjectRecord[]) {
  return [...projects].sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      Number(right.featured) - Number(left.featured) ||
      left.slug.localeCompare(right.slug, "en"),
  );
}

export function deriveContentIndexes(
  posts: PostRecord[],
  projects: ProjectRecord[],
) {
  const duplicatePostSlug = posts.find(
    (post, index) => posts.findIndex((candidate) => candidate.slug === post.slug) !== index,
  );
  if (duplicatePostSlug) {
    throw new ContentValidationError(duplicatePostSlug.sourcePath, "文章 slug 重复");
  }

  const duplicateProjectSlug = projects.find(
    (project, index) =>
      projects.findIndex((candidate) => candidate.slug === project.slug) !== index,
  );
  if (duplicateProjectSlug) {
    throw new ContentValidationError(duplicateProjectSlug.sourcePath, "项目 slug 重复");
  }

  const seriesMap = new Map<string, SeriesIndexEntry>();
  for (const post of posts) {
    if (!post.series) continue;

    const existing = seriesMap.get(post.series.slug);
    if (existing && existing.title !== post.series.title) {
      throw new ContentValidationError(post.sourcePath, "同一专题 slug 的标题必须一致");
    }

    if (existing) {
      existing.posts.push(post);
    } else {
      seriesMap.set(post.series.slug, {
        slug: post.series.slug,
        title: post.series.title,
        posts: [post],
      });
    }
  }

  const series = [...seriesMap.values()]
    .map((entry) => {
      const orderedPosts = [...entry.posts].sort(
        (left, right) => (left.series?.order ?? 0) - (right.series?.order ?? 0),
      );
      const orders = orderedPosts.map((post) => post.series?.order ?? 0);
      const expected = orders.map((_, index) => index + 1);

      if (
        new Set(orders).size !== orders.length ||
        orders.some((order, index) => order !== expected[index])
      ) {
        throw new ContentValidationError(
          orderedPosts[0].sourcePath,
          `专题 ${entry.slug} 的 order 必须唯一并从 1 连续递增`,
        );
      }

      return { ...entry, posts: orderedPosts };
    })
    .sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));

  const tagMap = new Map<string, TagIndexEntry>();
  for (const item of [...posts, ...projects]) {
    for (const tagName of item.tags) {
      const registryEntry = TAG_REGISTRY.find((tag) => tag.name === tagName);
      if (!registryEntry) continue;

      const existing = tagMap.get(registryEntry.slug);
      if (existing) {
        existing.items.push(item);
        existing.count += 1;
      } else {
        tagMap.set(registryEntry.slug, {
          name: registryEntry.name,
          slug: registryEntry.slug,
          count: 1,
          items: [item],
        });
      }
    }
  }

  const tags = [...tagMap.values()].sort(
    (left, right) => right.count - left.count || left.name.localeCompare(right.name, "en"),
  );

  return { series, tags };
}
