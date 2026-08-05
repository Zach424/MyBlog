import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
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
freshness: historical
reviewedAt: 2026-07-19
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
freshness: current
reviewedAt: 2026-07-19
status: planning
stack: ["TypeScript"]
tags: ["Project Management"]
draft: true
featured: false
---

## 背景与目标

项目正文。`;

const linkTargets = [
  {
    body: "## 设计也要表达真实结构",
    kind: "post",
    slug: "building-a-maintainable-blog",
  },
  { body: "# MyBlog", kind: "project", slug: "myblog" },
];

const publisherScriptPath = fileURLToPath(
  new URL("../scripts/publish-note.mjs", import.meta.url),
);

async function createPublisherFixture(checkExitCode, includeSecondAttachment = false) {
  const root = await mkdtemp(join(tmpdir(), "myblog-publisher-"));
  await Promise.all([
    mkdir(join(root, "content", "inbox"), { recursive: true }),
    mkdir(join(root, "content", "posts"), { recursive: true }),
    mkdir(join(root, "content", "projects"), { recursive: true }),
    mkdir(join(root, "public", "uploads"), { recursive: true }),
  ]);
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ scripts: { check: `node -e "process.exit(${checkExitCode})"` } }),
  );
  const draftContent = includeSecondAttachment
    ? article.replace(
        "正文图片 ![evidence](/uploads/obsidian-evidence.png)。",
        "正文图片 ![evidence](/uploads/obsidian-evidence.png)。\n\n第二张 ![detail](/uploads/detail.jpg)。",
      )
    : article;
  await writeFile(
    join(root, "content", "inbox", "obsidian-publishing.md"),
    draftContent,
  );
  const sourceImage = await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: "#486f78",
    },
  }).png({ compressionLevel: 0 }).toBuffer();
  await writeFile(
    join(root, "public", "uploads", "obsidian-evidence.png"),
    sourceImage,
  );
  const secondImage = includeSecondAttachment
    ? await sharp({
        create: {
          width: 800,
          height: 450,
          channels: 3,
          background: "#b9431f",
        },
      }).jpeg({ quality: 90 }).toBuffer()
    : undefined;
  if (secondImage) {
    await writeFile(join(root, "public", "uploads", "detail.jpg"), secondImage);
  }
  return { draftContent, root, secondImage, sourceImage };
}

function runPublisher(root, ...args) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      publisherScriptPath,
      "content/inbox/obsidian-publishing.md",
      ...args,
    ],
    { cwd: root, encoding: "utf8" },
  );
}

test("prepares an Obsidian article for the existing content contract", () => {
  const result = prepareObsidianNote("content/inbox/obsidian-publishing.md", article);
  assert.equal(result.kind, "post");
  assert.equal(result.targetPath, "content/posts/obsidian-publishing.md");
  assert.match(result.content, /^draft: false$/mu);
  assert.doesNotMatch(result.content, /^draft: true$/mu);
  assert.deepEqual(result.attachments, [
    {
      sourcePath: "public/uploads/obsidian-evidence.png",
      targetPath: "public/uploads/obsidian-publishing/obsidian-evidence.webp",
      publicUrl: "/uploads/obsidian-publishing/obsidian-evidence.webp",
    },
  ]);
  assert.match(
    result.content,
    /!\[evidence\]\(\/uploads\/obsidian-publishing\/obsidian-evidence\.webp\)/u,
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
    /!\[运行证据\]\(\/uploads\/obsidian-publishing\/obsidian-evidence\.webp\)/u,
  );
  assert.match(result.content, /!\[\]\(\/uploads\/obsidian-publishing\/second-image\.webp\)/u);
  assert.deepEqual(result.attachments, [
    {
      sourcePath: "public/uploads/obsidian-evidence.png",
      targetPath: "public/uploads/obsidian-publishing/obsidian-evidence.webp",
      publicUrl: "/uploads/obsidian-publishing/obsidian-evidence.webp",
    },
    {
      sourcePath: "public/uploads/second-image.webp",
      targetPath: "public/uploads/obsidian-publishing/second-image.webp",
      publicUrl: "/uploads/obsidian-publishing/second-image.webp",
    },
  ]);
});

test("archives and rewrites an Obsidian cover with the same media transaction", () => {
  const withCover = article.replace(
    "featured: false",
    'featured: false\ncover: "/uploads/obsidian-evidence.png"\ncoverAlt: "构建结果截图"',
  ).replace("正文图片 ![evidence](/uploads/obsidian-evidence.png)。", "正文不重复引用封面。");

  const result = prepareObsidianNote(
    "content/inbox/obsidian-publishing.md",
    withCover,
  );

  assert.match(
    result.content,
    /cover: "\/uploads\/obsidian-publishing\/obsidian-evidence\.webp"/u,
  );
  assert.match(result.content, /coverAlt: "构建结果截图"/u);
  assert.deepEqual(result.attachments, [
    {
      sourcePath: "public/uploads/obsidian-evidence.png",
      targetPath: "public/uploads/obsidian-publishing/obsidian-evidence.webp",
      publicUrl: "/uploads/obsidian-publishing/obsidian-evidence.webp",
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
    /!\[构建结果\]\(\/uploads\/obsidian-publishing\/pasted-image-20260804-120000-[a-f0-9]{8}\.webp\)/u,
  );
  assert.match(
    result.content,
    /!\[架构截图\.png\]\(\/uploads\/obsidian-publishing\/asset-[a-f0-9]{8}\.webp\)/u,
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
    /!\[真实图片\]\(\/uploads\/obsidian-publishing\/real-image\.webp\)/u,
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
  assert.throws(
    () => prepareObsidianNote(
      "content/inbox/obsidian-publishing.md",
      withLink("[[building-a-maintainable-blog#不存在的标题]]"),
      undefined,
      linkTargets,
    ),
    /站内链接标题锚点不存在/,
  );
  assert.throws(
    () => prepareObsidianNote(
      "content/inbox/obsidian-publishing.md",
      withLink("[[#不存在的标题]]"),
      undefined,
      linkTargets,
    ),
    /站内链接标题锚点不存在/,
  );
});

test("stages an inbox deletion only when the source was already tracked", () => {
  const untrackedPaths = gitPathsForPublishedNote(
    "content/inbox/obsidian-publishing.md",
    "content/posts/obsidian-publishing.md",
    ["public/uploads/obsidian-evidence.webp"],
    false,
  );
  assert.deepEqual(untrackedPaths, [
    "content/posts/obsidian-publishing.md",
    "public/uploads/obsidian-evidence.webp",
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

test("rejects attachments whose source formats collapse to the same WebP target", () => {
  const withCollision = article.replace(
    "正文图片 ![evidence](/uploads/obsidian-evidence.png)。",
    "![[diagram.png|PNG]]\n\n![[diagram.jpg|JPEG]]",
  );
  assert.throws(
    () => prepareObsidianNote(
      "content/inbox/obsidian-publishing.md",
      withCollision,
    ),
    /多个附件会生成同一目标文件/u,
  );
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

test("previews and publishes an optimized attachment through the real CLI transaction", async () => {
  const { root } = await createPublisherFixture(0);
  try {
    const preview = runPublisher(root, "--check-only");
    assert.equal(preview.status, 0, `${preview.stdout}\n${preview.stderr}`);
    assert.match(preview.stdout, /附件归档：.*\.png -> .*\.webp/u);
    assert.match(preview.stdout, /媒体处理：PNG .* → WEBP .* · 减少/u);
    await access(join(root, "content", "inbox", "obsidian-publishing.md"));
    await access(join(root, "public", "uploads", "obsidian-evidence.png"));
    await assert.rejects(
      access(join(root, "content", "posts", "obsidian-publishing.md")),
    );

    const publish = runPublisher(root);
    assert.equal(publish.status, 0, `${publish.stdout}\n${publish.stderr}`);
    assert.match(publish.stdout, /检查通过/u);
    const published = await readFile(
      join(root, "content", "posts", "obsidian-publishing.md"),
      "utf8",
    );
    assert.match(
      published,
      /\/uploads\/obsidian-publishing\/obsidian-evidence\.webp/u,
    );
    const outputPath = join(
      root,
      "public",
      "uploads",
      "obsidian-publishing",
      "obsidian-evidence.webp",
    );
    const output = await readFile(outputPath);
    assert.equal(output.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(output.subarray(8, 12).toString("ascii"), "WEBP");
    await assert.rejects(
      access(join(root, "content", "inbox", "obsidian-publishing.md")),
    );
    await assert.rejects(
      access(join(root, "public", "uploads", "obsidian-evidence.png")),
    );
    assert.deepEqual(
      await readdir(join(root, "node_modules", ".cache")),
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restores the draft and every original attachment when the real quality gate fails", async () => {
  const { draftContent, root, secondImage, sourceImage } = await createPublisherFixture(7, true);
  try {
    const publish = runPublisher(root);
    assert.equal(publish.status, 1, `${publish.stdout}\n${publish.stderr}`);
    assert.match(
      `${publish.stdout}\n${publish.stderr}`,
      /草稿与附件已恢复到原位置/u,
    );
    assert.equal(
      await readFile(
        join(root, "content", "inbox", "obsidian-publishing.md"),
        "utf8",
      ),
      draftContent,
    );
    assert.deepEqual(
      await readFile(join(root, "public", "uploads", "obsidian-evidence.png")),
      sourceImage,
    );
    assert.deepEqual(
      await readFile(join(root, "public", "uploads", "detail.jpg")),
      secondImage,
    );
    await assert.rejects(
      access(join(root, "content", "posts", "obsidian-publishing.md")),
    );
    await assert.rejects(
      access(
        join(
          root,
          "public",
          "uploads",
          "obsidian-publishing",
          "obsidian-evidence.webp",
        ),
      ),
    );
    await assert.rejects(
      access(
        join(
          root,
          "public",
          "uploads",
          "obsidian-publishing",
          "detail.webp",
        ),
      ),
    );
    assert.deepEqual(
      await readdir(join(root, "node_modules", ".cache")),
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ships a desktop Obsidian command without hidden shell interpolation", async () => {
  const [manifest, packageSource, plugin] = await Promise.all([
    readFile(new URL("../.obsidian/plugins/myblog-publisher/manifest.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.obsidian/plugins/myblog-publisher/main.js", import.meta.url), "utf8"),
  ]);
  assert.equal(JSON.parse(manifest).isDesktopOnly, true);
  assert.equal(JSON.parse(manifest).version, "1.14.0");
  assert.match(plugin, /FileSystemAdapter/);
  assert.match(plugin, /InboxReadinessModal/);
  assert.match(plugin, /inspect-inbox-readiness/);
  assert.match(plugin, /content:inbox/);
  assert.match(plugin, /inspect-published-maintenance/);
  assert.match(plugin, /content:status/);
  assert.match(plugin, /ContentMaintenanceModal/);
  assert.match(plugin, /activeRuns/);
  assert.match(plugin, /onunload/);
  assert.match(plugin, /setText\(this\.report/u);
  assert.match(plugin, /content:publish/);
  assert.match(plugin, /content:review/);
  assert.match(plugin, /validate-current-published-note/);
  assert.match(plugin, /review-current-published-note/);
  assert.match(plugin, /inspect-review-delivery/);
  assert.match(plugin, /content:review:status/);
  assert.match(plugin, /deliver-pending-review/);
  assert.match(plugin, /content:review:deliver/);
  assert.match(plugin, /inspect-publish-delivery/);
  assert.match(plugin, /content:publish:status/);
  assert.match(plugin, /deliver-pending-publication/);
  assert.match(plugin, /content:publish:deliver/);
  assert.match(plugin, /inspect-delivery-triage/);
  assert.match(plugin, /content:delivery:status/);
  assert.match(plugin, /inspect-author-environment/);
  assert.match(plugin, /content:author:doctor/);
  assert.equal(
    JSON.parse(packageSource).scripts["content:review:status"],
    "node --experimental-strip-types scripts/report-content-review-delivery.mjs",
  );
  assert.equal(
    JSON.parse(packageSource).scripts["content:review:deliver"],
    "node --experimental-strip-types scripts/deliver-content-review.mjs",
  );
  assert.equal(
    JSON.parse(packageSource).scripts["content:publish:status"],
    "node --experimental-strip-types scripts/report-content-publish-delivery.mjs",
  );
  assert.equal(
    JSON.parse(packageSource).scripts["content:publish:deliver"],
    "node --experimental-strip-types scripts/deliver-content-publish.mjs",
  );
  assert.equal(
    JSON.parse(packageSource).scripts["content:delivery:status"],
    "node --experimental-strip-types scripts/report-content-delivery-triage.mjs",
  );
  assert.equal(
    JSON.parse(packageSource).scripts["content:author:doctor"],
    "node --experimental-strip-types scripts/report-author-doctor.mjs",
  );
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
  assert.match(script, /prepareMediaForPublishing/);
  assert.match(script, /formatMediaPreparation/);
  assert.match(script, /node_modules", "\.cache/);
  assert.match(script, /草稿与附件已恢复到原位置/);
});
