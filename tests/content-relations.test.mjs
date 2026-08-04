import assert from "node:assert/strict";
import test from "node:test";

import { parsePostFile, parseProjectFile } from "../lib/content/contract.ts";
import { extractInternalContentReferences } from "../lib/content/markdown.ts";
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

test("extracts unique internal content references outside code examples", () => {
  const references = extractInternalContentReferences(`
[文章](/posts/linked-post#方法)
[重复引用](/posts/linked-post)
[项目](/projects/linked-project)
![图片](/posts/not-content.png)
[外链](https://example.com/posts/external)

\`[行内示例](/posts/inline-example)\`

\`\`\`md
[围栏示例](/projects/fenced-example)
\`\`\`
`);

  assert.deepEqual(references, [
    {
      kind: "post",
      slug: "linked-post",
      url: "/posts/linked-post",
      fragment: "方法",
    },
    {
      kind: "project",
      slug: "linked-project",
      url: "/projects/linked-project",
    },
  ]);
});

test("derives cross-kind outgoing links and backlinks without duplicates", () => {
  const source = post(
    "source",
    "[项目](/projects/target) 与 [同一项目](/projects/target#结果)",
  );
  const secondSource = post("second-source", "[项目](/projects/target)");
  const target = project("target", "[来源文章](/posts/source)");
  const relations = deriveContentRelations([source, secondSource, target]);

  assert.deepEqual(relations.outgoingByUrl.get(source.url), [target]);
  assert.deepEqual(relations.backlinksByUrl.get(target.url), [secondSource, source]);
  assert.deepEqual(relations.backlinksByUrl.get(source.url), [target]);
});

test("rejects broken public targets and ignores self references", () => {
  const self = post("self", "[本文章节](/posts/self#方法)");
  const selfRelations = deriveContentRelations([self]);
  assert.equal(selfRelations.backlinksByUrl.has(self.url), false);

  const broken = post("broken", "[不存在](/posts/missing)");
  assert.throws(
    () => deriveContentRelations([broken]),
    /站内链接目标不存在或尚未公开：\/posts\/missing/,
  );
});
