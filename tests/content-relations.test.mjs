import assert from "node:assert/strict";
import test from "node:test";

import { parsePostFile, parseProjectFile } from "../lib/content/contract.ts";
import {
  extractInternalContentReferenceEvidence,
  extractInternalContentReferences,
  extractMarkdownHeadingAnchors,
  extractTableOfContents,
} from "../lib/content/markdown.ts";
import { deriveContentRelations } from "../lib/content/relations.ts";

function post(slug, body) {
  return parsePostFile(
    `content/posts/${slug}.md`,
    `---
title: "Post ${slug}"
description: "用于验证公开内容引用与反向链接索引。"
type: article
publishedAt: 2026-08-04
freshness: historical
reviewedAt: 2026-08-04
tags: ["Personal Knowledge"]
draft: false
featured: false
---

${body}`,
  );
}

function project(slug, body) {
  return parseProjectFile(
    `content/projects/${slug}.md`,
    `---
title: "Project ${slug}"
description: "用于验证文章与项目之间的双向知识关系。"
publishedAt: 2026-08-03
freshness: current
reviewedAt: 2026-08-04
status: maintained
stack: ["TypeScript"]
tags: ["Personal Knowledge"]
draft: false
featured: false
---

${body}`,
  );
}

test("extracts inline, reference-style, and self content links outside code examples", () => {
  const markdown = `
[文章](/posts/linked-post#方法)
[相同目标](/posts/linked-post#方法)
[重复引用](/posts/linked-post)
[项目][project-reference]
[本文章节](#当前章节)
![图片](/posts/not-content.png)
[外链](https://example.com/posts/external)

[project-reference]: /projects/linked-project#%E7%BB%93%E6%9E%9C

\`[行内示例](/posts/inline-example)\`

\`\`\`md
[围栏示例](/projects/fenced-example)
\`\`\`
`;
  const references = extractInternalContentReferences(markdown);

  assert.deepEqual(references, [
    {
      bodyLine: 2,
      kind: "post",
      slug: "linked-post",
      url: "/posts/linked-post",
      fragment: "方法",
    },
    {
      bodyLine: 4,
      kind: "post",
      slug: "linked-post",
      url: "/posts/linked-post",
    },
    {
      bodyLine: 5,
      kind: "project",
      slug: "linked-project",
      url: "/projects/linked-project",
      fragment: "%E7%BB%93%E6%9E%9C",
    },
    {
      bodyLine: 6,
      kind: "self",
      fragment: "当前章节",
    },
  ]);
  assert.deepEqual(extractInternalContentReferenceEvidence(markdown), [
    {
      bodyLine: 2,
      kind: "post",
      slug: "linked-post",
      url: "/posts/linked-post",
      fragment: "方法",
      occurrences: 2,
      sourceLines: [2, 3],
    },
    {
      bodyLine: 4,
      kind: "post",
      slug: "linked-post",
      url: "/posts/linked-post",
      occurrences: 1,
      sourceLines: [4],
    },
    {
      bodyLine: 5,
      kind: "project",
      slug: "linked-project",
      url: "/projects/linked-project",
      fragment: "%E7%BB%93%E6%9E%9C",
      occurrences: 1,
      sourceLines: [5],
    },
    {
      bodyLine: 6,
      kind: "self",
      fragment: "当前章节",
      occurrences: 1,
      sourceLines: [6],
    },
  ]);
});

test("derives renderer-equivalent heading ids across all depths and duplicate headings", () => {
  const markdown = `# Duplicate
## Duplicate
#### Duplicate
### Duplicate
##### **API** \`Guide\`
###### API Guide
# Alpha ![ignored](/image.png) Omega

Setext heading
===

\`\`\`md
## Duplicate
\`\`\``;

  assert.deepEqual(extractMarkdownHeadingAnchors(markdown), [
    { depth: 1, id: "duplicate", line: 1, text: "Duplicate" },
    { depth: 2, id: "duplicate-1", line: 2, text: "Duplicate" },
    { depth: 4, id: "duplicate-2", line: 3, text: "Duplicate" },
    { depth: 3, id: "duplicate-3", line: 4, text: "Duplicate" },
    { depth: 5, id: "api-guide", line: 5, text: "API Guide" },
    { depth: 6, id: "api-guide-1", line: 6, text: "API Guide" },
    { depth: 1, id: "alpha--omega", line: 7, text: "Alpha  Omega" },
    { depth: 1, id: "setext-heading", line: 9, text: "Setext heading" },
  ]);
  assert.deepEqual(extractTableOfContents(markdown), [
    { depth: 2, id: "duplicate-1", text: "Duplicate" },
    { depth: 3, id: "duplicate-3", text: "Duplicate" },
  ]);
});

test("derives cross-kind outgoing links and backlinks without duplicates", () => {
  const source = post(
    "source",
    "[项目](/projects/target) 与 [同一项目](/projects/target#结果)",
  );
  const secondSource = post("second-source", "[项目](/projects/target)");
  const target = project("target", "## 结果\n\n[来源文章](/posts/source)");
  const relations = deriveContentRelations([source, secondSource, target]);

  assert.deepEqual(relations.outgoingByUrl.get(source.url), [target]);
  assert.deepEqual(relations.backlinksByUrl.get(target.url), [secondSource, source]);
  assert.deepEqual(relations.backlinksByUrl.get(source.url), [target]);
});

test("rejects broken public targets and ignores self references", () => {
  const self = post("self", "## 方法\n\n[本文章节](#方法)");
  const selfRelations = deriveContentRelations([self]);
  assert.equal(selfRelations.backlinksByUrl.has(self.url), false);

  const broken = post("broken", "[不存在](/posts/missing)");
  assert.throws(
    () => deriveContentRelations([broken]),
    /站内链接目标不存在或尚未公开：\/posts\/missing/,
  );
});

test("accepts encoded anchors and rejects missing, duplicate, malformed, and self anchors", () => {
  const target = project(
    "target",
    "## 中文方法\n\n#### API Guide\n\n## 重复\n\n## 重复",
  );
  const valid = post(
    "valid",
    `## 当前章节

[编码标题](/projects/target#%E4%B8%AD%E6%96%87%E6%96%B9%E6%B3%95)
[深层标题](/projects/target#api-guide)
[重复标题](/projects/target#重复-1)
[自引用](#当前章节)`,
  );
  assert.deepEqual(deriveContentRelations([valid, target]).outgoingByUrl.get(valid.url), [target]);

  for (const [body, expectation] of [
    ["[缺失](/projects/target#不存在)", /标题锚点不存在：\/projects\/target#不存在/u],
    ["[重复序号错误](/projects/target#重复-2)", /标题锚点不存在：\/projects\/target#重复-2/u],
    ["[无效编码](/projects/target#%E0%A4%A)", /标题锚点包含无效 URL 编码/u],
    ["## 存在\n\n[自引用缺失](#不存在)", /标题锚点不存在：\/posts\/invalid#不存在/u],
  ]) {
    const invalid = post("invalid", body);
    assert.throws(() => deriveContentRelations([invalid, target]), expectation);
  }
});
