import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  extractInternalContentReferences,
  extractMarkdownHeadingAnchors,
  extractTableOfContents,
} from "../lib/content/markdown.ts";
import {
  getMarkdownFootnoteBackLabel,
  MARKDOWN_FOOTNOTE_CLOBBER_PREFIX,
  MARKDOWN_FOOTNOTE_LABEL,
} from "../lib/markdown-footnote.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const fixture = `## 结论

当前判断[^当前架构]，再次引用[^当前架构]。

[^当前架构]: 证据见 [项目复盘](/projects/myblog#vercel-阶段当前)，并包含 \`main\`。`;

test("localizes footnote semantics without adding another parser", async () => {
  const [component, pipeline, packageJson] = await Promise.all([
    readFile(new URL("../components/MarkdownContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.equal(MARKDOWN_FOOTNOTE_CLOBBER_PREFIX, "note-");
  assert.equal(MARKDOWN_FOOTNOTE_LABEL, "注释与来源");
  assert.equal(getMarkdownFootnoteBackLabel(0, 1), "返回正文中的注释 1");
  assert.equal(
    getMarkdownFootnoteBackLabel(0, 2),
    "返回正文中的注释 1（第 2 处）",
  );
  assert.doesNotMatch(component, /["']use client["']/u);
  assert.match(component, /remarkPlugins=\{MARKDOWN_REMARK_PLUGINS\}/u);
  assert.match(pipeline, /remarkGfm/u);
  assert.match(pipeline, /footnoteBackLabel: getMarkdownFootnoteBackLabel/u);
  assert.match(component, /remarkRehypeOptions=\{MARKDOWN_REHYPE_OPTIONS\}/u);
  assert.match(component, /<a\s+\{\.\.\.props\}/u);
  assert.match(component, /id === "footnote-label"/u);
  assert.match(packageJson, /"remark-gfm": "4\.0\.1"/u);
  assert.doesNotMatch(packageJson, /remark-footnotes/u);
});

test("keeps footnote syntax out of headings while retaining evidence relations", () => {
  assert.deepEqual(extractMarkdownHeadingAnchors(fixture), [
    { depth: 2, id: "结论", line: 1, text: "结论" },
  ]);
  assert.deepEqual(extractTableOfContents(fixture), [
    { depth: 2, id: "结论", text: "结论" },
  ]);
  assert.deepEqual(extractInternalContentReferences(fixture), [
    {
      bodyLine: 5,
      fragment: "vercel-阶段当前",
      kind: "project",
      slug: "myblog",
      url: "/projects/myblog",
    },
  ]);

  const plainText = markdownToPlainText(fixture);
  assert.equal(
    plainText,
    "结论 当前判断，再次引用。 证据见 项目复盘，并包含 main。",
  );
  assert.doesNotMatch(plainText, /\[\^|当前架构/u);
});

test("defines an evidence-ledger screen and print contract", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /a\[data-footnote-ref\]/u);
  assert.match(styles, /section\[data-footnotes\][\s\S]*?border-top:/u);
  assert.match(styles, /\.footnote-heading::before[\s\S]*?ANNOTATION \/ EVIDENCE/u);
  assert.match(styles, /section\[data-footnotes\] > ol > li:target/u);
  assert.match(styles, /@media print[\s\S]*?a\[data-footnote-backref\][\s\S]*?display:\s*none/u);
  assert.match(styles, /@media print[\s\S]*?section\[data-footnotes\] > ol > li[\s\S]*?break-inside:\s*avoid-page/u);
});
