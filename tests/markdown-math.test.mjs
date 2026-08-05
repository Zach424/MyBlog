import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parsePostFile } from "../lib/content/contract.ts";
import {
  extractInternalContentReferences,
  extractMarkdownHeadingAnchors,
  extractMarkdownMathExpressions,
} from "../lib/content/markdown.ts";
import { extractMarkdownImageReferences } from "../lib/content/media-references.ts";
import { getMarkdownMathIssue } from "../lib/markdown-math.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const source = `## Budget $B_{\\mathrm{client}}$

行内 $E = mc^2$，金额 \\$5，代码 \`$not_math$\`。

$$
B_{\\mathrm{client}} = \\sum_i B_i < 3\\,\\mathrm{MiB}
$$

$[not a link](/posts/hidden)$ 与 $![not an image](/uploads/hidden.webp)$`;

function post(body) {
  return `---
title: "Math contract"
description: "验证数学公式在写作、构建与阅读端之间保持一致。"
type: article
publishedAt: 2026-08-05
freshness: historical
reviewedAt: 2026-08-05
tags: ["Personal Knowledge"]
draft: false
featured: false
---

${body}`;
}

test("parses Obsidian math without treating formula source as content relations", () => {
  assert.deepEqual(extractMarkdownMathExpressions(source), [
    { display: false, line: 1, value: "B_{\\mathrm{client}}" },
    { display: false, line: 3, value: "E = mc^2" },
    {
      display: true,
      line: 5,
      value: "B_{\\mathrm{client}} = \\sum_i B_i < 3\\,\\mathrm{MiB}",
    },
    { display: false, line: 9, value: "[not a link](/posts/hidden)" },
    {
      display: false,
      line: 9,
      value: "![not an image](/uploads/hidden.webp)",
    },
  ]);
  assert.deepEqual(extractInternalContentReferences(source), []);
  assert.deepEqual(extractMarkdownImageReferences(source), []);
  assert.deepEqual(extractMarkdownHeadingAnchors(source)[0], {
    depth: 2,
    id: "budget-b_mathrmclient",
    line: 1,
    text: "Budget B_{\\mathrm{client}}",
  });
});

test("keeps formula source searchable while respecting code and currency boundaries", () => {
  const plainText = markdownToPlainText(source);
  assert.match(plainText, /B_\{\\mathrm\{client\}\}/u);
  assert.match(plainText, /E = mc\^2/u);
  assert.match(plainText, /\$not_math\$/u);
  assert.match(plainText, /\$5/u);
  assert.doesNotMatch(plainText, /\$E = mc\^2\$/u);
});

test("fails the content contract on invalid KaTeX with a body line", () => {
  assert.equal(getMarkdownMathIssue("$E = mc^2$"), undefined);
  const issue = getMarkdownMathIssue("before\n\n$\\frac{1}{$");
  assert.equal(issue?.line, 3);
  assert.match(issue?.message ?? "", /Expected|end of input/u);
  assert.throws(
    () => parsePostFile("content/posts/math-contract.md", post("$\\frac{1}{$")),
    /正文第 1 行数学公式无法解析/u,
  );
});

test("pins a server-rendered, accessible and bounded KaTeX integration", async () => {
  const [component, mathModule, packageJson, styles] = await Promise.all([
    readFile(new URL("../components/MarkdownContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/markdown-math.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(component, /["']use client["']/u);
  assert.match(component, /rehypeKatex/u);
  assert.match(component, /remarkMath/u);
  assert.match(component, /katex\/dist\/katex\.min\.css/u);
  assert.match(component, /aria-label="数学公式，可横向滚动"/u);
  assert.match(mathModule, /output: "htmlAndMathml"/u);
  assert.match(mathModule, /strict: "error"/u);
  assert.match(mathModule, /trust: false/u);
  assert.match(mathModule, /maxSize: 20/u);
  assert.match(mathModule, /maxExpand: 1_000/u);
  for (const dependency of [
    /"katex": "0\.16\.47"/u,
    /"mdast-util-math": "3\.0\.0"/u,
    /"micromark-extension-math": "3\.1\.0"/u,
    /"rehype-katex": "7\.0\.1"/u,
    /"remark-math": "6\.0\.0"/u,
  ]) {
    assert.match(packageJson, dependency);
  }
  assert.match(styles, /\.markdown-content \.katex-display[\s\S]*?overflow-x: auto/u);
  assert.match(styles, /CALCULATION \/ MODEL/u);
  assert.match(styles, /\.katex-display:focus-visible/u);
  assert.match(styles, /@media print[\s\S]*?\.markdown-content \.katex-display[\s\S]*?break-inside: avoid-page/u);
});
