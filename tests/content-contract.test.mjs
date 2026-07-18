import assert from "node:assert/strict";
import test from "node:test";
import {
  ContentValidationError,
  deriveContentIndexes,
  isPublished,
  parsePostFile,
  parseProjectFile,
} from "../lib/content/contract.ts";
import { extractTableOfContents } from "../lib/content/markdown.ts";
import { resolveContentBuildDate } from "../build/content-build-date.ts";

function postSource({
  publishedAt = "2026-07-18",
  updatedAt,
  tags = '["TypeScript", "Cloudflare"]',
  draft = false,
  featured = false,
  series,
  canonical,
} = {}) {
  return `---
title: "内容契约测试"
description: "用于验证 Markdown frontmatter 解析、规范化与跨内容约束。"
type: article
publishedAt: ${publishedAt}
${updatedAt ? `updatedAt: ${updatedAt}\n` : ""}tags: ${tags}
draft: ${draft}
featured: ${featured}
${series ? `series:\n  slug: ${series.slug}\n  title: ${series.title}\n  order: ${series.order}\n` : ""}${canonical ? `canonical: "${canonical}"\n` : ""}---

## 正文

这是一段真实可计算的中文正文，也包含 TypeScript words。`;
}

function projectSource({
  tags = '["TypeScript", "React"]',
  repository = "https://github.com/Zach424/MyBlog",
  demo = "null",
} = {}) {
  return `---
title: "MyBlog"
description: "用于验证项目内容契约。"
publishedAt: 2026-07-18
status: building
stack: ["TypeScript", "React"]
tags: ${tags}
draft: false
featured: true
repository: "${repository}"
demo: ${demo}
---

## 背景与目标

项目正文。`;
}

test("parses and normalizes a valid post", () => {
  const post = parsePostFile(
    "content/posts/content-contract.md",
    postSource({ tags: '["ts", "cloudflare"]' }),
  );

  assert.equal(post.slug, "content-contract");
  assert.equal(post.url, "/posts/content-contract");
  assert.equal(post.publishedAt, "2026-07-18");
  assert.deepEqual(post.tags, ["TypeScript", "Cloudflare"]);
  assert.ok(post.wordCount > 0);
  assert.equal(post.readingMinutes, 1);
});

test("reports the source path and invalid field", () => {
  assert.throws(
    () =>
      parsePostFile(
        "content/posts/Bad-Slug.md",
        postSource(),
      ),
    (error) =>
      error instanceof ContentValidationError &&
      /Bad-Slug\.md/.test(error.message) &&
      /文件名 slug/.test(error.message),
  );

  assert.throws(
    () =>
      parsePostFile(
        "content/posts/invalid-date.md",
        postSource({ publishedAt: "18-07-2026" }),
      ),
    /publishedAt.*YYYY-MM-DD/,
  );

  assert.throws(
    () =>
      parsePostFile(
        "content/posts/featured-draft.md",
        postSource({ draft: true, featured: true }),
      ),
    /草稿不能设为精选/,
  );

  assert.throws(
    () =>
      parsePostFile(
        "content/posts/unknown-tag.md",
        postSource({ tags: '["Unknown Tool"]' }),
      ),
    /未知标签/,
  );
});

test("enforces date and HTTPS URL invariants", () => {
  assert.throws(
    () =>
      parsePostFile(
        "content/posts/date-order.md",
        postSource({ publishedAt: "2026-07-18", updatedAt: "2026-07-17" }),
      ),
    /updatedAt.*不能早于/,
  );

  assert.throws(
    () =>
      parsePostFile(
        "content/posts/canonical.md",
        postSource({ canonical: "http://example.com/post" }),
      ),
    /canonical.*HTTPS/,
  );

  assert.throws(
    () =>
      parseProjectFile(
        "content/projects/insecure.md",
        projectSource({ repository: "http://github.com/example/repo" }),
      ),
    /repository.*HTTPS/,
  );
});

test("derives continuous series and normalized tag indexes", () => {
  const first = parsePostFile(
    "content/posts/first.md",
    postSource({
      series: { slug: "build-blog", title: "构建博客", order: 1 },
    }),
  );
  const second = parsePostFile(
    "content/posts/second.md",
    postSource({
      series: { slug: "build-blog", title: "构建博客", order: 2 },
    }),
  );
  const project = parseProjectFile(
    "content/projects/myblog.md",
    projectSource(),
  );
  const indexes = deriveContentIndexes([second, first], [project]);

  assert.equal(indexes.series.length, 1);
  assert.deepEqual(
    indexes.series[0].posts.map((post) => post.slug),
    ["first", "second"],
  );
  assert.equal(indexes.tags.find((tag) => tag.slug === "typescript")?.count, 3);

  const gap = parsePostFile(
    "content/posts/gap.md",
    postSource({
      series: { slug: "build-blog", title: "构建博客", order: 4 },
    }),
  );
  assert.throws(
    () => deriveContentIndexes([first, gap], []),
    /order 必须唯一并从 1 连续递增/,
  );
});

test("filters drafts and future content deterministically", () => {
  const current = parsePostFile(
    "content/posts/current.md",
    postSource({ publishedAt: "2026-07-18" }),
  );
  const future = parsePostFile(
    "content/posts/future.md",
    postSource({ publishedAt: "2026-07-19" }),
  );
  const draft = parsePostFile(
    "content/posts/draft.md",
    postSource({ draft: true }),
  );
  const now = new Date("2026-07-18T12:00:00Z");

  assert.equal(isPublished(current, now), true);
  assert.equal(isPublished(future, now), false);
  assert.equal(isPublished(draft, now), false);
});

test("freezes publication visibility to the author timezone at build time", () => {
  assert.equal(
    resolveContentBuildDate(new Date("2026-07-18T15:59:59Z")),
    "2026-07-18",
  );
  assert.equal(
    resolveContentBuildDate(new Date("2026-07-18T16:00:00Z")),
    "2026-07-19",
  );
});

test("extracts stable H2 and H3 table-of-contents anchors", () => {
  const items = extractTableOfContents(`
## Why **content contracts** matter

### Parse, then validate

## Why content contracts matter

\`\`\`md
## This heading is code
\`\`\`

#### H4 is intentionally omitted
`);

  assert.deepEqual(items, [
    {
      depth: 2,
      id: "why-content-contracts-matter",
      text: "Why content contracts matter",
    },
    {
      depth: 3,
      id: "parse-then-validate",
      text: "Parse, then validate",
    },
    {
      depth: 2,
      id: "why-content-contracts-matter-1",
      text: "Why content contracts matter",
    },
  ]);
});
