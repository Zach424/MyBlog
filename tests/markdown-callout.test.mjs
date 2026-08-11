import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import {
  parseMarkdownCalloutMarker,
  rehypeMarkdownCallouts,
} from "../lib/markdown-callout.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownCallouts)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("parses Obsidian callout types, aliases, folding and bounded custom identifiers", () => {
  assert.deepEqual(parseMarkdownCalloutMarker("[!WARNING]+ 发布前检查\n正文"), {
    bodyStart: "正文",
    canonicalType: "warning",
    fold: "open",
    identifier: "warning",
    kind: "WARNING",
    title: "发布前检查",
  });
  assert.deepEqual(parseMarkdownCalloutMarker("[!faq]- 是否可以折叠？\n可以。"), {
    bodyStart: "可以。",
    canonicalType: "question",
    fold: "closed",
    identifier: "faq",
    kind: "FAQ",
    title: "是否可以折叠？",
  });
  assert.deepEqual(parseMarkdownCalloutMarker("[!summary]"), {
    bodyStart: "",
    canonicalType: "abstract",
    fold: "static",
    identifier: "summary",
    kind: "SUMMARY",
    title: "摘要",
  });
  assert.deepEqual(parseMarkdownCalloutMarker("[!custom-signal]"), {
    bodyStart: "",
    canonicalType: "note",
    fold: "static",
    identifier: "custom-signal",
    kind: "CUSTOM SIGNAL",
    title: "Custom Signal",
  });
  for (const invalid of [
    "[!bad_type]",
    "[!note]Title",
    "prefix [!note]",
    `[!${"a".repeat(33)}]`,
  ]) {
    assert.equal(parseMarkdownCalloutMarker(invalid), undefined, invalid);
  }
});

test("renders static, foldable, nested and title-only callouts without changing ordinary quotes", () => {
  const html = render(`> [!note] 发布证据
> 正文支持 **Markdown**。
>
> > [!faq]- 是否折叠？
> > 使用原生 details。

> [!TIP]+ 默认展开
> - 第一项
> - 第二项

> [!custom-signal] 自定义类型

> 普通引用保持原样。`);

  assert.equal((html.match(/class="markdown-callout"/gu) ?? []).length, 4);
  assert.match(html, /<aside[^>]*data-callout="note"[^>]*role="note"/u);
  assert.match(
    html,
    /<span aria-hidden="true" class="markdown-callout-kind">NOTE \/<\/span>/u,
  );
  assert.match(html, /<span class="markdown-callout-title-text">发布证据<\/span>/u);
  assert.match(html, /<strong>Markdown<\/strong>/u);
  assert.match(html, /<details[^>]*data-callout="question"[^>]*>/u);
  assert.doesNotMatch(html, /<details[^>]*data-callout="question"[^>]*open/u);
  assert.match(html, /<details[^>]*data-callout="tip"[^>]*open/u);
  assert.match(html, /<aside[^>]*data-callout="note"[^>]*data-callout-source="custom-signal"/u);
  assert.match(html, /CUSTOM SIGNAL \/<\/span>/u);
  assert.match(html, /<blockquote>\n<p>普通引用保持原样。<\/p>\n<\/blockquote>/u);
  assert.doesNotMatch(html, /\[!(?:note|faq|tip|custom-signal)\]/iu);
});

test("keeps visible callout titles searchable while leaving fenced examples literal", () => {
  const plainText = markdownToPlainText(`> [!warning] 发布前检查
> 先运行完整质量门。

\`\`\`markdown
> [!danger] 这是代码示例
\`\`\``);

  assert.match(plainText, /发布前检查 先运行完整质量门/u);
  assert.doesNotMatch(plainText, /\[!warning\]/iu);
  assert.match(plainText, /> \[!danger\] 这是代码示例/u);
});

test("pins one server-rendered, Studio-shared, responsive and printable callout contract", async () => {
  const [component, pipeline, studioRuntime, globalStyles, previewStyles] =
    await Promise.all([
      readFile(new URL("../components/MarkdownContent.tsx", import.meta.url), "utf8"),
      readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
      readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
    ]);

  assert.doesNotMatch(component, /["']use client["']/u);
  assert.match(component, /MARKDOWN_REHYPE_PLUGINS/u);
  assert.match(pipeline, /rehypeMarkdownCallouts/u);
  assert.match(studioRuntime, /hasPotentialStudioRichMarkdown/u);
  assert.match(studioRuntime, /calloutCount/u);
  for (const styles of [globalStyles, previewStyles]) {
    assert.match(styles, /\.markdown-callout\s*\{/u);
    assert.match(styles, /data-callout="warning"/u);
    assert.match(styles, /\.markdown-callout-title/u);
    assert.match(styles, /\.markdown-callout-body/u);
    assert.match(styles, /summary:focus-visible/u);
  }
  assert.match(
    globalStyles,
    /@media print[\s\S]*?details\.markdown-callout:not\(\[open\]\)[\s\S]*?display:\s*block\s*!important/u,
  );
});
