import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { inspectContentDraft } from "../lib/content/contract.ts";
import {
  extractMarkdownGlossaries,
  getMarkdownGlossaryIssue,
  MARKDOWN_GLOSSARY_MAX_COUNT,
  MARKDOWN_GLOSSARY_MAX_TOTAL_ITEMS,
  rehypeMarkdownGlossaries,
} from "../lib/markdown-glossary.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const glossary = `> [!glossary] React 核心概念
> - **Server Component**
>
>   只在服务端渲染的 React 组件，不向浏览器发送该组件本身的 JavaScript。
>
>   **别名：** RSC、React Server Component
>
>   **上下文：** 在 Next.js App Router 中默认用于服务端数据读取和组合界面。
> - **水合**
>
>   React 在已有服务端 HTML 上绑定客户端行为的过程。
>
>   **别名：** Hydration`;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownGlossaries)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("renders a portable glossary as a semantic definition ledger", () => {
  const html = render(glossary);

  assert.match(html, /class="markdown-glossary"/u);
  assert.match(html, /data-glossary="definition-ledger"/u);
  assert.match(html, /data-term-count="2"/u);
  assert.match(html, /GLOSSARY \/ 02 TERMS/u);
  assert.match(html, /CONCEPTS · STATIC/u);
  assert.match(html, /<dl class="markdown-glossary-items">/u);
  assert.match(html, /<dt class="markdown-glossary-term">/u);
  assert.match(html, /<dd class="markdown-glossary-meaning">/u);
  assert.match(html, /class="markdown-glossary-alias">RSC/u);
  assert.match(html, /class="markdown-glossary-context-label">CONTEXT/u);
  assert.doesNotMatch(html, /button|input|contenteditable|onclick=/iu);
});

test("extracts terms, definitions, aliases, context, and source lines", () => {
  assert.deepEqual(extractMarkdownGlossaries(glossary), [
    {
      items: [
        {
          aliases: ["RSC", "React Server Component"],
          context: "在 Next.js App Router 中默认用于服务端数据读取和组合界面。",
          definition: "只在服务端渲染的 React 组件，不向浏览器发送该组件本身的 JavaScript。",
          line: 2,
          term: "Server Component",
        },
        {
          aliases: ["Hydration"],
          definition: "React 在已有服务端 HTML 上绑定客户端行为的过程。",
          line: 9,
          term: "水合",
        },
      ],
      line: 1,
      title: "React 核心概念",
    },
  ]);
});

test("rejects folded, untitled, short, ordered, flat, nested, duplicate, media, bad metadata, and over-budget glossaries", () => {
  const validTail = `> - **水合**
>
>   React 绑定客户端行为的过程。`;
  const invalid = [
    [`> [!glossary]+ 折叠\n> - **组件**\n>\n>   可复用界面单元。\n${validTail}`, /静态|不能折叠/u],
    [`> [!glossary]\n> - **组件**\n>\n>   可复用界面单元。\n${validTail}`, /标题/u],
    ["> [!glossary] 太短\n> - **组件**\n>\n>   可复用界面单元。", /2–12/u],
    [`> [!glossary] 有序错误\n> 1. **组件**\n>\n>    可复用界面单元。\n> 2. **水合**\n>\n>    绑定客户端行为。`, /无序列表/u],
    [`> [!glossary] 扁平\n> - **组件** — 可复用界面单元。\n${validTail}`, /两到四段|粗体术语/u],
    [`> [!glossary] 嵌套\n> - **组件**\n>\n>   可复用界面单元。\n>\n>   - 子概念\n${validTail}`, /不能使用.*嵌套列表|两到四段/u],
    [`> [!glossary] 重复\n> - **Server Component**\n>\n>   服务端组件。\n>\n>   **别名：** RSC\n> - **RSC**\n>\n>   常见缩写。`, /术语和别名不能互相重复/u],
    [`> [!glossary] 图片\n> - **组件**\n>\n>   ![图](/uploads/demo/a.png)\n${validTail}`, /图片.*术语表外/u],
    [`> [!glossary] 标签错误\n> - **组件**\n>\n>   可复用界面单元。\n>\n>   **示例：** Button\n${validTail}`, /别名：|上下文：/u],
    [`> [!glossary] 别名过多\n> - **组件**\n>\n>   可复用界面单元。\n>\n>   **别名：** A、B、C、D、E、F\n${validTail}`, /1–5/u],
  ];

  for (const [source, expected] of invalid) {
    const issue = getMarkdownGlossaryIssue(source);
    assert.equal(issue?.kind, "glossary");
    assert.match(issue?.message ?? "", expected);
  }

  const glossaryOf = (index, itemCount = 2) => [
    `> [!glossary] 术语表 ${index}`,
    ...Array.from({ length: itemCount }, (_, item) => [
      `> - **术语 ${index}-${item + 1}**`,
      ">",
      `>   定义 ${index}-${item + 1}。`,
    ].join("\n")),
  ].join("\n");
  const tooMany = Array.from(
    { length: MARKDOWN_GLOSSARY_MAX_COUNT + 1 },
    (_, index) => glossaryOf(index + 1),
  ).join("\n\n");
  assert.match(getMarkdownGlossaryIssue(tooMany)?.message ?? "", /最多允许.*术语定义表/u);

  const tooManyItems = Array.from(
    { length: 3 },
    (_, index) => glossaryOf(index + 1, Math.floor(MARKDOWN_GLOSSARY_MAX_TOTAL_ITEMS / 3) + 1),
  ).join("\n\n");
  assert.match(getMarkdownGlossaryIssue(tooManyItems)?.message ?? "", /合计最多/u);
});

test("keeps glossary meaning searchable without marker or metadata-label noise", () => {
  const plainText = markdownToPlainText(glossary);
  assert.match(
    plainText,
    /React 核心概念 Server Component 只在服务端渲染.*RSC、React Server Component 在 Next\.js App Router.*水合 React 在已有服务端 HTML.*Hydration/u,
  );
  assert.doesNotMatch(plainText, /\[!glossary\]|别名：|上下文：|GLOSSARY|CONTEXT/u);
});

test("makes the same glossary contract authoritative for Studio preflight", () => {
  const fields = {
    body: glossary,
    description: "验证术语定义表进入统一内容契约。",
    draft: true,
    featured: false,
    freshness: "historical",
    publishedAt: "2026-08-12",
    reviewedAt: "2026-08-12",
    slug: "glossary-contract",
    tags: ["Project Management"],
    title: "术语定义契约",
    type: "article",
  };
  assert.equal(inspectContentDraft("post", fields, "2026-08-12").ok, true);
  const invalid = inspectContentDraft(
    "post",
    { ...fields, body: "> [!glossary] 只有一个\n> - **术语**\n>\n>   定义。" },
    "2026-08-12",
  );
  assert.equal(invalid.ok, false);
  assert.match(invalid.issues[0]?.message ?? "", /术语定义表/u);
});

test("wires one glossary contract into reading, Studio, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);

  assert.match(pipeline, /rehypeMarkdownGlossaries/u);
  assert.match(previewRuntime, /glossaryTermCount/u);
  assert.match(previewRuntime, /hasPotentialStudioGlossary/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-glossary\s*\{/u);
    assert.match(styles, /\.markdown-glossary-entry/u);
    assert.match(styles, /\.markdown-glossary-context/u);
  }
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-glossary/u);
  assert.match(
    richStyles,
    /@media \(max-width: 32rem\)[\s\S]*?\.markdown-glossary-entry[\s\S]*?grid-template-columns/u,
  );
});
