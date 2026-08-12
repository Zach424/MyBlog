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
  resolveContentAudioPath,
  resolveContentMediaPath,
  resolveContentVideoPath,
} from "../lib/content/media-references.ts";
import { getMarkdownContentImages } from "../lib/content/media.ts";

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
${cover ? `cover: "${cover}"\ncoverAlt: "${slug} 封面"\n` : ""}---

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
    references.map(({ alt, url }) => ({ alt, url })),
    [
      { alt: "inline", url: "/uploads/media-owner/inline.webp" },
      { alt: "reference", url: "/uploads/media-owner/reference.avif" },
      { alt: "external", url: "https://images.example.test/evidence.webp" },
    ],
  );
});

test("accepts exact formal references and leaves root staging media unowned", async () => {
  const root = await createFixture();
  try {
    await writePost(
      root,
      "media-owner",
      "![正文](/uploads/media-owner/evidence.webp)",
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
      archivedAudios: 0,
      archivedImages: 3,
      archivedVideos: 0,
      audioReferences: 0,
      imageReferences: 3,
      referencedImages: 3,
      referencedAudios: 0,
      referencedVideos: 0,
      references: 3,
      stagingImages: 2,
      stagingAudios: 0,
      stagingVideos: 0,
      videoReferences: 0,
    });
    assert.equal(media.images, 5);
    assert.equal(media.audios, 0);
    assert.equal(media.videos, 0);
    assert.ok(media.totalBytes > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects root staging media from formal body and cover references", async () => {
  const root = await createFixture();
  try {
    await Promise.all([
      writeMedia(root, "public/uploads/body-staging.webp"),
      writeMedia(root, "public/uploads/cover-staging.webp"),
    ]);
    await writePost(
      root,
      "media-owner",
      "![仍在暂存区](/uploads/body-staging.webp)",
    );
    await assert.rejects(
      validateContentMediaReferences(root),
      /正文第 1 行.*根暂存区.*\/uploads\/media-owner\//u,
    );

    await writePost(
      root,
      "media-owner",
      "没有本地正文图片。",
      "/uploads/cover-staging.webp",
    );
    await assert.rejects(
      validateContentMediaReferences(root),
      /cover.*根暂存区.*\/uploads\/media-owner\//u,
    );
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

test("rejects empty alt text for local and external body images", async () => {
  const root = await createFixture();
  try {
    await writePost(
      root,
      "media-owner",
      "![](/uploads/media-owner/evidence.webp)",
    );
    await assert.rejects(
      validateContentMediaReferences(root),
      /正文第 1 行图片替代文本不能为空/u,
    );

    await writePost(
      root,
      "media-owner",
      "![](https://images.example.test/evidence.webp)",
    );
    await assert.rejects(
      validateContentMediaReferences(root),
      /正文第 1 行图片替代文本不能为空/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reads intrinsic dimensions once per unique local body image", async () => {
  const sourcePath = "content/posts/building-a-maintainable-blog.md";
  const localUrl =
    "/uploads/building-a-maintainable-blog/content-delivery-pipeline.webp";
  const images = await getMarkdownContentImages(
    `![主图](${localUrl})\n\n![重复引用](${localUrl})\n\n![外图](https://images.example.test/evidence.webp)`,
    sourcePath,
  );

  assert.deepEqual(images, {
    [localUrl]: {
      height: 941,
      src: localUrl,
      width: 1672,
    },
  });
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

test("keeps MP4 declarations out of image loading and resolves only local video paths", async () => {
  const sourcePath = "content/posts/media-owner.md";
  const markdown =
    '![完整画面说明](/uploads/media-owner/demo.mp4 "操作演示")\n\n![图片](/uploads/building-a-maintainable-blog/content-delivery-pipeline.webp)';
  assert.deepEqual(
    extractMarkdownImageReferences(markdown).map(({ url }) => url),
    ["/uploads/building-a-maintainable-blog/content-delivery-pipeline.webp"],
  );
  assert.equal(
    resolveContentVideoPath("/uploads/media-owner/demo.mp4", sourcePath),
    "public/uploads/media-owner/demo.mp4",
  );
  assert.throws(
    () => resolveContentVideoPath("/uploads/media-owner/demo.webm", sourcePath),
    /本地视频.*\.mp4/u,
  );
  const images = await getMarkdownContentImages(markdown, sourcePath);
  assert.deepEqual(Object.keys(images), [
    "/uploads/building-a-maintainable-blog/content-delivery-pipeline.webp",
  ]);
});

test("keeps MP3 declarations out of image loading and resolves safe local audio paths", async () => {
  const sourcePath = "content/posts/media-owner.md";
  const markdown = [
    "> [!audio] 发布复盘口述",
    '> [下载 MP3](/uploads/media-owner/release-retro.mp3 "发布复盘口述")',
    "> 总结发布检查、上线确认与复盘结论。",
    ">",
    "> **文字稿**",
    "> 先运行完整检查，再确认生产冒烟通过。",
  ].join("\n");

  assert.deepEqual(extractMarkdownImageReferences(markdown), []);
  assert.equal(
    resolveContentAudioPath("/uploads/media-owner/release-retro.mp3", sourcePath),
    "public/uploads/media-owner/release-retro.mp3",
  );
  assert.equal(
    resolveContentAudioPath("/uploads/another-owner/release-retro.mp3", sourcePath),
    "public/uploads/another-owner/release-retro.mp3",
  );
  assert.equal(
    resolveContentAudioPath("https://audio.example/release-retro.mp3", sourcePath),
    undefined,
  );
  assert.deepEqual(await getMarkdownContentImages(markdown, sourcePath), {});
});
