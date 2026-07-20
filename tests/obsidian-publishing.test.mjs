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

test("prepares an Obsidian article for the existing content contract", () => {
  const result = prepareObsidianNote("content/inbox/obsidian-publishing.md", article);
  assert.equal(result.kind, "post");
  assert.equal(result.targetPath, "content/posts/obsidian-publishing.md");
  assert.match(result.content, /^draft: false$/mu);
  assert.doesNotMatch(result.content, /^draft: true$/mu);
  assert.deepEqual(result.attachments, ["public/uploads/obsidian-evidence.png"]);
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
  assert.match(result.content, /!\[运行证据\]\(\/uploads\/obsidian-evidence\.png\)/u);
  assert.match(result.content, /!\[\]\(\/uploads\/second-image\.webp\)/u);
  assert.deepEqual(result.attachments, [
    "public/uploads/obsidian-evidence.png",
    "public/uploads/second-image.webp",
  ]);
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
    /附件路径不安全/,
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
});
