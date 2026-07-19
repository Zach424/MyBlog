import { parseDocument } from "yaml";
import { z } from "zod";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
    tags: rawTagsSchema,
    draft: z.boolean(),
    featured: z.boolean().default(false),
    series: seriesSchema.optional(),
    canonical: httpsUrlSchema.optional(),
    cover: z.string().trim().min(1).optional(),
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

    if (value.draft && value.featured) {
      context.addIssue({
        code: "custom",
        path: ["featured"],
        message: "草稿不能设为精选",
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
    status: z.enum(["planning", "building", "maintained", "archived"]),
    stack: z.array(z.string().trim().min(1)).min(1).max(12),
    tags: rawTagsSchema,
    draft: z.boolean(),
    featured: z.boolean().default(false),
    repository: httpsUrlSchema.optional(),
    demo: httpsUrlSchema.nullable().optional(),
    cover: z.string().trim().min(1).optional(),
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

    if (value.draft && value.featured) {
      context.addIssue({
        code: "custom",
        path: ["featured"],
        message: "草稿不能设为精选",
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

export function isPublished(record: ContentRecord, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return !record.draft && record.publishedAt <= today;
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
