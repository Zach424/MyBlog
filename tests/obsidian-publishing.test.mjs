import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

function runGit(root, ...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
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
      usages: [
        {
          altSources: ["authored"],
          altTexts: ["evidence"],
          occurrences: 1,
          role: "body",
          sourceLines: [16],
        },
      ],
    },
  ]);
  assert.match(
    result.content,
    /!\[evidence\]\(\/uploads\/obsidian-publishing\/obsidian-evidence\.webp\)/u,
  );
});

test("publishes a filename-owned Obsidian draft without redundant frontmatter slug", () => {
  const filenameOwned = article.replace(/^slug: obsidian-publishing\r?\n/mu, "");
  const result = prepareObsidianNote(
    "content/inbox/obsidian-publishing.md",
    filenameOwned,
  );
  assert.equal(result.slug, "obsidian-publishing");
  assert.equal(result.targetPath, "content/posts/obsidian-publishing.md");
  assert.doesNotMatch(result.content, /^slug\s*:/mu);
  assert.match(result.content, /^draft: false$/mu);
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
      usages: [
        {
          altSources: ["authored"],
          altTexts: ["运行证据"],
          occurrences: 1,
          role: "body",
          sourceLines: [16],
        },
      ],
    },
    {
      sourcePath: "public/uploads/second-image.webp",
      targetPath: "public/uploads/obsidian-publishing/second-image.webp",
      publicUrl: "/uploads/obsidian-publishing/second-image.webp",
      usages: [
        {
          altSources: ["authored"],
          altTexts: [""],
          occurrences: 1,
          role: "body",
          sourceLines: [18],
        },
      ],
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
      usages: [
        {
          altSources: ["authored"],
          altTexts: ["构建结果截图"],
          occurrences: 1,
          role: "cover",
          sourceLines: [12],
        },
      ],
    },
  ]);
});

test("records exact cover and repeated body media usages in one normalization pass", () => {
  const withRepeatedMedia = article
    .replace(
      "featured: false",
      'featured: false\ncover: "/uploads/obsidian-evidence.png"\ncoverAlt: "构建结果截图"',
    )
    .replace(
      "正文图片 ![evidence](/uploads/obsidian-evidence.png)。",
      "正文图片 ![evidence](/uploads/obsidian-evidence.png) 与 ![again](/uploads/obsidian-evidence.png)。\n\n再次 ![[obsidian-evidence.png|运行证据]]。",
    );
  const sourceLines = withRepeatedMedia.split(/\r?\n/u);
  const coverLine = sourceLines.findIndex((line) => line.startsWith("cover:")) + 1;
  const firstBodyLine = sourceLines.findIndex((line) => line.includes("![evidence]")) + 1;
  const secondBodyLine = sourceLines.findIndex((line) => line.includes("![[obsidian-evidence")) + 1;

  const result = prepareObsidianNote(
    "content/inbox/obsidian-publishing.md",
    withRepeatedMedia,
  );

  assert.deepEqual(result.attachments, [
    {
      sourcePath: "public/uploads/obsidian-evidence.png",
      targetPath: "public/uploads/obsidian-publishing/obsidian-evidence.webp",
      publicUrl: "/uploads/obsidian-publishing/obsidian-evidence.webp",
      usages: [
        {
          altSources: ["authored"],
          altTexts: ["构建结果截图"],
          occurrences: 1,
          role: "cover",
          sourceLines: [coverLine],
        },
        {
          altSources: ["authored", "authored", "authored"],
          altTexts: ["evidence", "again", "运行证据"],
          occurrences: 3,
          role: "body",
          sourceLines: [firstBodyLine, firstBodyLine, secondBodyLine],
        },
      ],
    },
  ]);
  assert.equal(
    result.content.match(/\/uploads\/obsidian-publishing\/obsidian-evidence\.webp/gu)?.length,
    4,
  );
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
  assert.deepEqual(
    result.attachments.map((attachment) => attachment.usages[0].altTexts),
    [["架构截图.png"], ["构建结果"]],
  );
  assert.deepEqual(
    result.attachments.map((attachment) => attachment.usages[0].altSources),
    [["filename-fallback"], ["authored"]],
  );
});

test("leaves attachment examples inside fenced code untouched", () => {
  const withCodeExamples = article.replace(
    "正文图片 ![evidence](/uploads/obsidian-evidence.png)",
    `\`\`\`md
![[example-only.png|示例]]
![example](/uploads/example-only.png)
\`\`\`

行内示例 \`![[inline-only.png|示例]]\`，真实图片 ![[real-image.png|真实图片]]`,
  );
  const result = prepareObsidianNote(
    "content/inbox/obsidian-publishing.md",
    withCodeExamples,
  );

  assert.match(result.content, /!\[\[example-only\.png\|示例\]\]/u);
  assert.match(result.content, /!\[example\]\(\/uploads\/example-only\.png\)/u);
  assert.match(result.content, /!\[\[inline-only\.png\|示例\]\]/u);
  assert.match(
    result.content,
    /!\[真实图片\]\(\/uploads\/obsidian-publishing\/real-image\.webp\)/u,
  );
  assert.deepEqual(result.attachments.map((attachment) => attachment.sourcePath), [
    "public/uploads/real-image.png",
  ]);
  const realImageLine = withCodeExamples
    .split(/\r?\n/u)
    .findIndex((line) => line.includes("真实图片 ![[real-image.png")) + 1;
  assert.deepEqual(result.attachments[0].usages, [
    {
      altSources: ["authored"],
      altTexts: ["真实图片"],
      occurrences: 1,
      role: "body",
      sourceLines: [realImageLine],
    },
  ]);
});

test("normalizes Obsidian note and heading links into stable blog URLs", () => {
  const withContentLinks = article.replace(
    "正文图片 ![evidence](/uploads/obsidian-evidence.png)。",
    `参见 [[building-a-maintainable-blog#设计也要表达真实结构|设计文章]]、[项目](../projects/myblog.md) 与 [[#方法|本文方法]]。
再次核对 [[building-a-maintainable-blog#设计也要表达真实结构|同一设计目标]]。`,
  );
  const sourceLines = withContentLinks
    .split(/\r?\n/u)
    .map((line, index) => ({ index: index + 1, line }))
    .filter(({ line }) => line.includes("building-a-maintainable-blog#设计也要表达真实结构"))
    .map(({ index }) => index);
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
  assert.equal(result.internalLinkCount, 3);
  assert.deepEqual(result.internalLinks, [
    {
      kind: "post",
      occurrences: 2,
      sourceLines,
      target: "/posts/building-a-maintainable-blog#设计也要表达真实结构",
    },
    {
      kind: "project",
      occurrences: 1,
      sourceLines: [sourceLines[0]],
      target: "/projects/myblog",
    },
    {
      kind: "self",
      occurrences: 1,
      sourceLines: [sourceLines[0]],
      target: "/posts/obsidian-publishing#方法",
    },
  ]);
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
  assert.equal(result.internalLinkCount, 0);
  assert.deepEqual(result.internalLinks, []);
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

test("pushes one exact publication and emits its final frozen handoff", async () => {
  const [{ root }, remote] = await Promise.all([
    createPublisherFixture(0),
    mkdtemp(join(tmpdir(), "myblog-publisher-remote-")),
  ]);
  try {
    runGit(root, "init", "-b", "main");
    runGit(root, "config", "user.name", "Publisher Test");
    runGit(root, "config", "user.email", "publisher@example.test");
    runGit(
      root,
      "add",
      "package.json",
      "content/inbox/obsidian-publishing.md",
    );
    runGit(root, "commit", "-m", "fixture");
    runGit(remote, "init", "--bare");
    runGit(root, "remote", "add", "origin", remote);
    runGit(root, "push", "-u", "origin", "main");

    const publish = runPublisher(root, "--push", "--handoff");
    assert.equal(publish.status, 0, `${publish.stdout}\n${publish.stderr}`);
    const lines = publish.stdout.trim().split(/\r?\n/u);
    const evidence = lines.filter((line) =>
      line.startsWith("[post-delivery-handoff] "),
    );
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0], lines.at(-1));
    const handoff = JSON.parse(
      evidence[0].slice("[post-delivery-handoff] ".length),
    );
    assert.equal(handoff.version, 1);
    assert.equal(handoff.mode, "post-delivery");
    assert.equal(handoff.delivery, "publication");
    assert.equal(handoff.commitOid, runGit(root, "rev-parse", "HEAD"));
    assert.equal(
      runGit(remote, "rev-parse", "refs/heads/main"),
      handoff.commitOid,
    );
    assert.equal(
      handoff.target.sourcePath,
      "content/posts/obsidian-publishing.md",
    );
    assert.match(handoff.target.sourceSha256, /^[a-f0-9]{64}$/u);
    assert.match(handoff.target.localEtag, /^"sha256-[a-f0-9]{64}"$/u);
    assert.deepEqual(handoff.safety, {
      gitDelivered: true,
      productionChecked: false,
      waitStarted: false,
    });
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(remote, { recursive: true, force: true }),
    ]);
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

test("ships one digest-bound desktop Obsidian plugin bundle without hidden shell interpolation", async () => {
  const [bundleSource, manifest, packageSource, plugin, styles] = await Promise.all([
    readFile(new URL("../.obsidian/plugins/myblog-publisher/bundle.json", import.meta.url), "utf8"),
    readFile(new URL("../.obsidian/plugins/myblog-publisher/manifest.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.obsidian/plugins/myblog-publisher/main.js", import.meta.url), "utf8"),
    readFile(new URL("../.obsidian/plugins/myblog-publisher/styles.css", import.meta.url), "utf8"),
  ]);
  const bundle = JSON.parse(bundleSource);
  assert.equal(JSON.parse(manifest).isDesktopOnly, true);
  assert.equal(JSON.parse(manifest).version, "1.40.0");
  assert.equal(JSON.parse(manifest).minAppVersion, "1.5.7");
  assert.deepEqual(Object.keys(bundle), ["version", "algorithm", "plugin", "files"]);
  assert.equal(bundle.version, 1);
  assert.equal(bundle.algorithm, "sha256");
  assert.deepEqual(bundle.plugin, {
    id: "myblog-publisher",
    version: "1.40.0",
  });
  assert.deepEqual(
    bundle.files,
    [
      ["main.js", plugin],
      ["manifest.json", manifest],
      ["styles.css", styles],
    ].map(([path, content]) => ({
      path,
      sha256: createHash("sha256").update(content).digest("hex"),
    })),
  );
  assert.match(plugin, /FileSystemAdapter/);
  assert.match(plugin, /create-blog-draft/);
  assert.match(plugin, /DraftCreationModal/);
  assert.match(plugin, /createDraftFromTemplate/);
  assert.match(plugin, /rename-current-inbox-draft/);
  assert.match(plugin, /DraftRenameModal/);
  assert.match(plugin, /fileManager\.renameFile/);
  assert.match(plugin, /getFrontMatterInfo/);
  assert.match(plugin, /vault\.cachedRead/);
  assert.match(plugin, /vault\.create/);
  assert.match(plugin, /InboxReadinessModal/);
  assert.match(plugin, /inspect-inbox-readiness/);
  assert.match(plugin, /content:inbox/);
  assert.match(plugin, /inspect-published-maintenance/);
  assert.match(plugin, /content:status/);
  assert.match(plugin, /ContentMaintenanceModal/);
  assert.match(plugin, /inspect-production-content-sync/);
  assert.match(plugin, /content:production/);
  assert.match(plugin, /ProductionContentSyncModal/);
  assert.match(plugin, /wait-current-production-content/);
  assert.match(plugin, /content:production:wait/);
  assert.match(plugin, /ProductionContentConvergenceModal/);
  assert.match(plugin, /activeRuns/);
  assert.match(plugin, /inspect-author-transaction/);
  assert.match(plugin, /getAuthorTransactionSnapshot/);
  assert.match(plugin, /recordAuthorTransactionOutput/);
  assert.match(plugin, /lastAuthorTransactionReceipt/);
  assert.match(plugin, /recordAuthorTransactionReceipt/);
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
