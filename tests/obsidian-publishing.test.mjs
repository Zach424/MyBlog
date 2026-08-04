import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  gitPathsForPublishedNote,
  prepareObsidianNote,
} from "../lib/obsidian-publishing.ts";

const article = `---
title: "Obsidian 发布测试"
slug: obsidian-publishing
description: "验证本地草稿如何进入与网页后台相同的内容管线。"
type: article
publishedAt: 2026-07-19
tags: ["Personal Knowledge", "Git"]
draft: true
featured: false
---

## 方法

正文图片 ![evidence](/uploads/obsidian-evidence.png)。`;

const project = `---
title: "Obsidian Project"
slug: obsidian-project
description: "验证项目草稿的发布路径。"
publishedAt: 2026-07-19
status: planning
stack: ["TypeScript"]
tags: ["Project Management"]
draft: true
featured: false
---

## 背景与目标

项目正文。`;

const linkTargets = [
  { kind: "post", slug: "building-a-maintainable-blog" },
  { kind: "project", slug: "myblog" },
];

test("prepares an Obsidian article for the existing content contract", () => {
  const result = prepareObsidianNote("content/inbox/obsidian-publishing.md", article);
  assert.equal(result.kind, "post");
  assert.equal(result.targetPath, "content/posts/obsidian-publishing.md");
  assert.match(result.content, /^draft: false$/mu);
  assert.doesNotMatch(result.content, /^draft: true$/mu);
  assert.deepEqual(result.attachments, [
    {
      sourcePath: "public/uploads/obsidian-evidence.png",
      targetPath: "public/uploads/obsidian-publishing/obsidian-evidence.png",
      publicUrl: "/uploads/obsidian-publishing/obsidian-evidence.png",
    },
  ]);
  assert.match(
    result.content,
    /!\[evidence\]\(\/uploads\/obsidian-publishing\/obsidian-evidence\.png\)/u,
  );
});

test("infers and validates project drafts", () => {
  const result = prepareObsidianNote("content/inbox/obsidian-project.md", project);
  assert.equal(result.kind, "project");
  assert.equal(result.targetPath, "content/projects/obsidian-project.md");
});

test("normalizes Obsidian attachment links into public blog URLs", () => {
  const withObsidianLinks = article
    .replace(
      "![evidence](/uploads/obsidian-evidence.png)",
      "![[obsidian-evidence.png|运行证据]]\n\n![](../../public/uploads/second-image.webp)",
    );
  const result = prepareObsidianNote(
    "content/inbox/obsidian-publishing.md",
    withObsidianLinks,
  );
  assert.match(
    result.content,
    /!\[运行证据\]\(\/uploads\/obsidian-publishing\/obsidian-evidence\.png\)/u,
  );
  assert.match(result.content, /!\[\]\(\/uploads\/obsidian-publishing\/second-image\.webp\)/u);
  assert.deepEqual(result.attachments, [
    {
      sourcePath: "public/uploads/obsidian-evidence.png",
      targetPath: "public/uploads/obsidian-publishing/obsidian-evidence.png",
      publicUrl: "/uploads/obsidian-publishing/obsidian-evidence.png",
    },
    {
      sourcePath: "public/uploads/second-image.webp",
      targetPath: "public/uploads/obsidian-publishing/second-image.webp",
      publicUrl: "/uploads/obsidian-publishing/second-image.webp",
    },
  ]);
});

test("scopes and stabilizes Obsidian pasted-image filenames", () => {
  const withPastedImages = article.replace(
    "![evidence](/uploads/obsidian-evidence.png)",
    "![[Pasted image 20260804 120000.PNG|构建结果]]\n\n![[架构截图.png|960]]",
  );
  const result = prepareObsidianNote(
    "content/inbox/obsidian-publishing.md",
    withPastedImages,
  );

  assert.match(
    result.content,
    /!\[构建结果\]\(\/uploads\/obsidian-publishing\/pasted-image-20260804-120000-[a-f0-9]{8}\.png\)/u,
  );
  assert.match(
    result.content,
    /!\[架构截图\.png\]\(\/uploads\/obsidian-publishing\/asset-[a-f0-9]{8}\.png\)/u,
  );
  assert.deepEqual(
    result.attachments.map((attachment) => attachment.sourcePath),
    ["public/uploads/架构截图.png", "public/uploads/Pasted image 20260804 120000.PNG"],
  );
});

test("leaves attachment examples inside fenced code untouched", () => {
  const withCodeExamples = article.replace(
    "正文图片 ![evidence](/uploads/obsidian-evidence.png)",
    `\`\`\`md
![[example-only.png|示例]]
![example](/uploads/example-only.png)
\`\`\`

![[real-image.png|真实图片]]`,
  );
  const result = prepareObsidianNote(
    "content/inbox/obsidian-publishing.md",
    withCodeExamples,
  );

  assert.match(result.content, /!\[\[example-only\.png\|示例\]\]/u);
  assert.match(result.content, /!\[example\]\(\/uploads\/example-only\.png\)/u);
  assert.match(
    result.content,
    /!\[真实图片\]\(\/uploads\/obsidian-publishing\/real-image\.png\)/u,
  );
  assert.deepEqual(result.attachments.map((attachment) => attachment.sourcePath), [
    "public/uploads/real-image.png",
  ]);
});

test("normalizes Obsidian note and heading links into stable blog URLs", () => {
  const withContentLinks = article.replace(
    "正文图片 ![evidence](/uploads/obsidian-evidence.png)。",
    "参见 [[building-a-maintainable-blog#设计也要表达真实结构|设计文章]]、[项目](../projects/myblog.md) 与 [[#方法|本文方法]]。",
  );
  const result = prepareObsidianNote(
    "content/inbox/obsidian-publishing.md",
    withContentLinks,
    undefined,
    linkTargets,
  );

  assert.match(
    result.content,
    /\[设计文章\]\(\/posts\/building-a-maintainable-blog#设计也要表达真实结构\)/u,
  );
  assert.match(result.content, /\[项目\]\(\/projects\/myblog\)/u);
  assert.match(result.content, /\[本文方法\]\(#方法\)/u);
  assert.deepEqual(result.attachments, []);
});

test("keeps external and code-example links out of Obsidian link conversion", () => {
  const withExamples = article.replace(
    "正文图片 ![evidence](/uploads/obsidian-evidence.png)。",
    `外部 [Obsidian](https://obsidian.md/help/links)。

\`[[building-a-maintainable-blog]]\`

\`\`\`md
[[myblog|项目]]
\`\`\``,
  );
  const result = prepareObsidianNote(
    "content/inbox/obsidian-publishing.md",
    withExamples,
    undefined,
    linkTargets,
  );

  assert.match(result.content, /\[Obsidian\]\(https:\/\/obsidian\.md\/help\/links\)/u);
  assert.match(result.content, /`\[\[building-a-maintainable-blog\]\]`/u);
  assert.match(result.content, /\[\[myblog\|项目\]\]/u);
});

test("rejects missing, ambiguous, and block-level Obsidian links", () => {
  const withLink = (link) =>
    article.replace("正文图片 ![evidence](/uploads/obsidian-evidence.png)。", link);

  assert.throws(
    () => prepareObsidianNote(
      "content/inbox/obsidian-publishing.md",
      withLink("[[missing-note]]"),
      undefined,
      linkTargets,
    ),
    /找不到站内内容链接目标/,
  );
  assert.throws(
    () => prepareObsidianNote(
      "content/inbox/obsidian-publishing.md",
      withLink("[[shared-slug]]"),
      undefined,
      [
        ...linkTargets,
        { kind: "post", slug: "shared-slug" },
        { kind: "project", slug: "shared-slug" },
      ],
    ),
    /站内链接目标不明确/,
  );
  assert.throws(
    () => prepareObsidianNote(
      "content/inbox/obsidian-publishing.md",
      withLink("[[building-a-maintainable-blog#^block-id]]"),
      undefined,
      linkTargets,
    ),
    /暂不支持 Obsidian 块引用/,
  );
});

test("stages an inbox deletion only when the source was already tracked", () => {
  const untrackedPaths = gitPathsForPublishedNote(
    "content/inbox/obsidian-publishing.md",
    "content/posts/obsidian-publishing.md",
    ["public/uploads/obsidian-evidence.png"],
    false,
  );
  assert.deepEqual(untrackedPaths, [
    "content/posts/obsidian-publishing.md",
    "public/uploads/obsidian-evidence.png",
  ]);

  const trackedPaths = gitPathsForPublishedNote(
    "content\\inbox\\obsidian-publishing.md",
    "content/posts/obsidian-publishing.md",
    [],
    true,
  );
  assert.deepEqual(trackedPaths, [
    "content/inbox/obsidian-publishing.md",
    "content/posts/obsidian-publishing.md",
  ]);
});

test("rejects unsafe locations, unstable slugs, and mismatched metadata", () => {
  assert.throws(() => prepareObsidianNote("notes/obsidian-publishing.md", article), /content\/inbox/);
  assert.throws(() => prepareObsidianNote("content/inbox/Obsidian Post.md", article), /小写 ASCII/);
  assert.throws(
    () => prepareObsidianNote("content/inbox/different.md", article),
    /frontmatter slug 必须与文件名一致/,
  );
  assert.throws(
    () => prepareObsidianNote("content/inbox/obsidian-publishing.md", article.replace("obsidian-evidence.png", "../secret.png")),
    /附件路径不安全|仅支持常见图片附件/,
  );
  assert.throws(
    () => prepareObsidianNote(
      "content/inbox/obsidian-publishing.md",
      article.replace("/uploads/obsidian-evidence.png", "/private/evidence.png"),
    ),
    /必须位于 public\/uploads/,
  );
  assert.throws(
    () => prepareObsidianNote(
      "content/inbox/obsidian-publishing.md",
      article.replace("obsidian-evidence.png", "diagram.svg"),
    ),
    /仅支持常见图片附件/,
  );
});

test("ships a desktop Obsidian command without hidden shell interpolation", async () => {
  const [manifest, plugin] = await Promise.all([
    readFile(new URL("../.obsidian/plugins/myblog-publisher/manifest.json", import.meta.url), "utf8"),
    readFile(new URL("../.obsidian/plugins/myblog-publisher/main.js", import.meta.url), "utf8"),
  ]);
  assert.equal(JSON.parse(manifest).isDesktopOnly, true);
  assert.match(plugin, /FileSystemAdapter/);
  assert.match(plugin, /content:publish/);
  assert.match(plugin, /shell:\s*false/);
  assert.match(plugin, /--push/);
  assert.match(plugin, /\^content\\\/inbox/);
  assert.doesNotMatch(plugin, /exec\s*\(/u);

  const script = await readFile(
    new URL("../scripts/publish-note.mjs", import.meta.url),
    "utf8",
  );
  assert.match(script, /function contentLinkTargets/);
  assert.match(script, /content\/posts/);
  assert.match(script, /content\/projects/);
});
