import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { inspectContentDraft } from "../lib/content/contract.ts";
import { extractInternalContentReferences } from "../lib/content/markdown.ts";
import { createExternalLinkInventory } from "../lib/content/external-links.ts";
import { parsePostFile } from "../lib/content/contract.ts";
import {
  extractMarkdownReferenceLists,
  getMarkdownReferenceIssue,
  MARKDOWN_REFERENCE_MAX_COUNT,
  MARKDOWN_REFERENCE_MAX_TOTAL_ITEMS,
  rehypeMarkdownReferenceLists,
} from "../lib/markdown-references.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const references = `> [!references] 延伸阅读
> 1. [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — 官方路由处理器说明。
> 2. [MyBlog 项目复盘](/projects/myblog) — 本站实现与演进记录。`;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownReferenceLists)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("renders a portable reference list as a source index", () => {
  const html = render(references);
  assert.match(html, /class="markdown-references"/u);
  assert.match(html, /data-references="curated-index"/u);
  assert.match(html, /data-reference-count="2"/u);
  assert.match(html, /SOURCE INDEX \/ 02 REFERENCES/u);
  assert.match(html, /data-reference-scope="external"/u);
  assert.match(html, /data-reference-scope="local"/u);
  assert.match(html, /nextjs\.org/u);
  assert.match(html, />本站</u);
  assert.match(html, /官方路由处理器说明/u);
  assert.doesNotMatch(html, /\[!references\]|iframe|script|button/iu);
});

test("extracts titles, visible labels, targets, origins, notes, and source lines", () => {
  assert.deepEqual(extractMarkdownReferenceLists(references), [
    {
      items: [
        {
          external: true,
          label: "Next.js Route Handlers",
          line: 2,
          note: "官方路由处理器说明。",
          origin: "nextjs.org",
          target: "https://nextjs.org/docs/app/getting-started/route-handlers",
        },
        {
          external: false,
          label: "MyBlog 项目复盘",
          line: 3,
          note: "本站实现与演进记录。",
          origin: "本站",
          target: "/projects/myblog",
        },
      ],
      line: 1,
      title: "延伸阅读",
    },
  ]);
});

test("rejects malformed, unsafe, duplicate, nested, and over-budget reference lists", () => {
  const invalid = [
    ["> [!references]+ 折叠\n> 1. [一](https://one.example)\n> 2. [二](https://two.example)", /静态|不能折叠/u],
    ["> [!references]\n> 1. [一](https://one.example)\n> 2. [二](https://two.example)", /标题/u],
    ["> [!references] 太短\n> 1. [一](https://one.example)", /2–12/u],
    ["> [!references] 不安全\n> 1. [HTTP](http://one.example)\n> 2. [邮件](mailto:test@example.com)", /HTTPS/u],
    ["> [!references] 相对链接\n> 1. [一](docs/one)\n> 2. [二](../two)", /HTTPS URL|站内绝对路径/u],
    ["> [!references] 圆括号\n> 1. [一](https://one.example/a(b))\n> 2. [二](https://two.example)", /圆括号|可移植 URL/u],
    ["> [!references] 重复\n> 1. [一](https://one.example)\n> 2. [还是一](https://ONE.example)", /重复链接/u],
    ["> [!references] 无链接\n> 1. 普通文本\n> 2. [二](https://two.example)", /链接开头/u],
    ["> [!references] 短注\n> 1. [一](https://one.example) - 错误分隔\n> 2. [二](https://two.example)", /短注/u],
    ["> [!references] 嵌套\n> 1. [一](https://one.example)\n>    1. [子项](https://child.example)\n> 2. [二](https://two.example)", /不能嵌套|单段/u],
  ];
  for (const [source, expected] of invalid) {
    const issue = getMarkdownReferenceIssue(source);
    assert.equal(issue?.kind, "references");
    assert.match(issue?.message ?? "", expected);
  }

  const listOf = (index, count = 2) => [
    `> [!references] 清单 ${index}`,
    ...Array.from(
      { length: count },
      (_, item) => `> ${item + 1}. [资料 ${index}-${item + 1}](https://source-${index}-${item + 1}.example)`,
    ),
  ].join("\n");
  const tooMany = Array.from(
    { length: MARKDOWN_REFERENCE_MAX_COUNT + 1 },
    (_, index) => listOf(index + 1),
  ).join("\n\n");
  assert.match(getMarkdownReferenceIssue(tooMany)?.message ?? "", /最多允许.*参考资料/u);

  const tooManyItems = Array.from(
    { length: 3 },
    (_, index) => listOf(index + 1, Math.floor(MARKDOWN_REFERENCE_MAX_TOTAL_ITEMS / 3) + 1),
  ).join("\n\n");
  assert.match(getMarkdownReferenceIssue(tooManyItems)?.message ?? "", /合计最多/u);
});

test("keeps reference titles, labels, and notes searchable without marker or URL noise", () => {
  const plain = markdownToPlainText(references);
  assert.match(plain, /延伸阅读 Next\.js Route Handlers 官方路由处理器说明/u);
  assert.match(plain, /MyBlog 项目复盘 本站实现与演进记录/u);
  assert.doesNotMatch(plain, /\[!references\]|https:\/\/|\/projects\/myblog|SOURCE INDEX/u);
});

test("feeds local references to the knowledge graph and HTTPS references to the external inventory", () => {
  assert.deepEqual(extractInternalContentReferences(references), [
    {
      bodyLine: 3,
      kind: "project",
      slug: "myblog",
      url: "/projects/myblog",
    },
  ]);
  const record = parsePostFile(
    "content/posts/reference-integration.md",
    `---
title: "参考资料集成"
description: "验证参考资料复用站内关系和外部链接库存。"
type: article
publishedAt: 2026-08-12
freshness: historical
reviewedAt: 2026-08-12
tags: ["Personal Knowledge"]
draft: false
featured: false
---

${references}`,
  );
  const inventory = createExternalLinkInventory([record]);
  assert.deepEqual(inventory.links.map(({ url }) => url), [
    "https://nextjs.org/docs/app/getting-started/route-handlers",
  ]);
  assert.equal(inventory.links[0].occurrences[0].label, "Next.js Route Handlers");
  assert.equal(inventory.links[0].occurrences[0].bodyLine, 2);
});

test("makes the same reference contract authoritative for Studio preflight", () => {
  const fields = {
    body: references,
    description: "验证参考资料清单进入统一内容契约。",
    draft: true,
    featured: false,
    freshness: "historical",
    publishedAt: "2026-08-12",
    reviewedAt: "2026-08-12",
    slug: "reference-list-contract",
    tags: ["Personal Knowledge"],
    title: "参考资料清单契约",
    type: "article",
  };
  assert.equal(inspectContentDraft("post", fields, "2026-08-12").ok, true);
  const invalid = inspectContentDraft(
    "post",
    { ...fields, body: references.replace("https://nextjs.org", "http://nextjs.org") },
    "2026-08-12",
  );
  assert.equal(invalid.ok, false);
  assert.match(invalid.issues[0]?.message ?? "", /参考资料.*HTTPS/u);
});

test("wires one reference contract into reading, Studio, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);
  assert.match(pipeline, /rehypeMarkdownReferenceLists/u);
  assert.match(previewRuntime, /referenceItemCount/u);
  assert.match(previewRuntime, /hasPotentialStudioReferences/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-references\s*\{/u);
    assert.match(styles, /\.markdown-reference-item/u);
    assert.match(styles, /\.markdown-reference-origin/u);
  }
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-reference-print-target/u);
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-reference-link\[href\^="http"\]::after[\s\S]*?content:\s*none/u);
  assert.match(richStyles, /@media \(max-width: 32rem\)[\s\S]*?\.markdown-reference-item/u);
});
