import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { validateMediaRepository } from "../build/validate-media.ts";
import { validateContentMediaReferences } from "../build/validate-media-references.ts";
import {
  extractMarkdownImageReferences,
  resolveContentMediaPath,
} from "../lib/content/media-references.ts";

const mediaFixture = sharp({
  create: {
    width: 32,
    height: 18,
    channels: 3,
    background: "#486f78",
  },
}).webp().toBuffer();

function postSource(
  slug,
  body,
  cover,
  { draft = false, publishedAt = "2026-08-04" } = {},
) {
  return `---
title: "${slug}"
description: "验证正式内容与本地媒体之间的引用和所有权关系。"
type: article
publishedAt: ${publishedAt}
freshness: historical
reviewedAt: ${publishedAt}
tags: ["Tooling"]
draft: ${draft}
featured: false
${cover ? `cover: "${cover}"\n` : ""}---

${body}`;
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "myblog-media-references-"));
  await Promise.all([
    mkdir(join(root, "content", "inbox"), { recursive: true }),
    mkdir(join(root, "content", "posts"), { recursive: true }),
    mkdir(join(root, "content", "projects"), { recursive: true }),
    mkdir(join(root, "public", "uploads"), { recursive: true }),
  ]);
  return root;
}

async function writePost(root, slug, body, cover, options) {
  await writeFile(
    join(root, "content", "posts", `${slug}.md`),
    postSource(slug, body, cover, options),
  );
}

async function writeMedia(root, mediaPath) {
  const absolutePath = join(root, ...mediaPath.split("/"));
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, await mediaFixture);
}

test("extracts inline and reference-style Markdown images but ignores code examples", () => {
  const references = extractMarkdownImageReferences(`
![inline](/uploads/media-owner/inline.webp)

![reference][evidence]

[evidence]: /uploads/media-owner/reference.avif

\`![inline-code](/uploads/media-owner/ignored.png)\`

\`\`\`md
![fenced](/uploads/media-owner/ignored.gif)
\`\`\`

![external](https://images.example.test/evidence.webp)
`);

  assert.deepEqual(
    references.map((reference) => reference.url),
    [
      "/uploads/media-owner/inline.webp",
      "/uploads/media-owner/reference.avif",
      "https://images.example.test/evidence.webp",
    ],
  );
});

test("accepts exact formal references and leaves root staging media unowned", async () => {
  const root = await createFixture();
  try {
    await writePost(
      root,
      "media-owner",
      "![正文](/uploads/media-owner/evidence.webp)\n\n![共享暂存](/uploads/shared.webp)",
      "/uploads/media-owner/cover.webp",
    );
    await writePost(
      root,
      "future-draft",
      "![计划图](/uploads/future-draft/plan.webp)",
      undefined,
      { draft: true, publishedAt: "2027-01-01" },
    );
    await writeFile(
      join(root, "content", "inbox", "working-draft.md"),
      "![尚未归档](/uploads/inbox-only.webp)\n\n![不检查](relative.png)",
    );
    await Promise.all([
      writeMedia(root, "public/uploads/media-owner/evidence.webp"),
      writeMedia(root, "public/uploads/media-owner/cover.webp"),
      writeMedia(root, "public/uploads/future-draft/plan.webp"),
      writeMedia(root, "public/uploads/shared.webp"),
      writeMedia(root, "public/uploads/inbox-only.webp"),
    ]);

    const [references, media] = await Promise.all([
      validateContentMediaReferences(root),
      validateMediaRepository(root),
    ]);
    assert.deepEqual(references, {
      archivedImages: 3,
      referencedImages: 4,
      references: 4,
      stagingImages: 2,
    });
    assert.equal(media.images, 5);
    assert.ok(media.totalBytes > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects missing, case-mismatched, and cross-owner archived media", async () => {
  const root = await createFixture();
  try {
    await writePost(
      root,
      "media-owner",
      "![缺失](/uploads/media-owner/evidence.webp)",
    );
    await assert.rejects(
      validateContentMediaReferences(root),
      /本地图片不存在或大小写不一致.*evidence\.webp/u,
    );

    await writeMedia(root, "public/uploads/media-owner/Evidence.webp");
    await assert.rejects(
      validateContentMediaReferences(root),
      /本地图片不存在或大小写不一致.*evidence\.webp/u,
    );

    await writePost(
      root,
      "media-owner",
      "![越权](/uploads/another-owner/Evidence.webp)",
    );
    await writeMedia(root, "public/uploads/another-owner/Evidence.webp");
    await assert.rejects(
      validateContentMediaReferences(root),
      /归档目录 another-owner 与内容 slug media-owner 不一致/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects orphaned archived media even when it only appears in code", async () => {
  const root = await createFixture();
  try {
    await writePost(
      root,
      "media-owner",
      "```md\n![示例](/uploads/media-owner/orphan.webp)\n```",
    );
    await writeMedia(root, "public/uploads/media-owner/orphan.webp");
    await assert.rejects(
      validateContentMediaReferences(root),
      /已归档附件未被同 slug 的正式文章或项目引用/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("normalizes only safe upload URLs and permits valid HTTPS images", () => {
  const sourcePath = "content/posts/media-owner.md";
  assert.equal(
    resolveContentMediaPath("/uploads/media-owner/evidence.webp", sourcePath),
    "public/uploads/media-owner/evidence.webp",
  );
  assert.equal(
    resolveContentMediaPath("https://images.example.test/evidence.webp", sourcePath),
    undefined,
  );

  for (const reference of [
    "http://images.example.test/evidence.webp",
    "images/evidence.webp",
    "/uploads/media-owner/../evidence.webp",
    "/uploads/media-owner/evidence.webp?raw=1",
    "/uploads/media-owner/evidence.webp#detail",
    "/uploads/media-owner%2Fevidence.webp",
    "/uploads/media-owner/notes.txt",
  ]) {
    assert.throws(
      () => resolveContentMediaPath(reference, sourcePath),
      /本地图片/u,
      reference,
    );
  }
});
