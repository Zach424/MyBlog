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
  formatInboxReadinessText,
  inspectInboxReadiness,
} from "../lib/content/inbox-readiness.ts";
import { prepareMediaForPublishing } from "../lib/media-policy.ts";

const reporterPath = fileURLToPath(
  new URL("../scripts/report-inbox-readiness.mjs", import.meta.url),
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function article(slug, publishedAt, body = "正文。") {
  return `---
title: "${slug} 发布测试"
slug: ${slug}
description: "验证 Obsidian 收件箱草稿的发布就绪状态。"
type: article
publishedAt: ${publishedAt}
freshness: historical
reviewedAt: ${publishedAt}
tags: ["Personal Knowledge", "Git"]
draft: true
featured: false
---

## 方法

${body}
`;
}

function project(slug, publishedAt) {
  return `---
title: "${slug} 项目测试"
slug: ${slug}
description: "验证未来项目草稿保持计划发布状态。"
publishedAt: ${publishedAt}
freshness: current
reviewedAt: ${publishedAt}
status: planning
stack: ["TypeScript"]
tags: ["Project Management"]
draft: true
featured: false
---

## 背景与目标

项目正文。
`;
}

function runGit(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "myblog-inbox-readiness-test-"));
  await Promise.all([
    mkdir(join(root, "content", "inbox"), { recursive: true }),
    mkdir(join(root, "content", "posts"), { recursive: true }),
    mkdir(join(root, "content", "projects"), { recursive: true }),
    mkdir(join(root, "public", "uploads"), { recursive: true }),
  ]);
  await writeFile(join(root, "content", "inbox", "README.md"), "说明，不参与报告。\n");
  runGit(root, ["init", "-b", "main"]);
  return root;
}

test("reports ready and scheduled drafts with real media derivation", async () => {
  const root = await createFixture();
  try {
    const readyDraft = article(
      "ready-note",
      "2026-08-05",
      "证据 ![[evidence.png|示例图]]；[[#方法|回看方法]]。",
    );
    const internalLinkLine = readyDraft
      .split(/\r?\n/u)
      .findIndex((line) => line.includes("[[#方法|回看方法]]")) + 1;
    const imageLine = readyDraft
      .split(/\r?\n/u)
      .findIndex((line) => line.includes("![[evidence.png|示例图]]")) + 1;
    const image = await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 3,
        background: "#486f78",
      },
    }).png({ compressionLevel: 0 }).toBuffer();
    await Promise.all([
      writeFile(
        join(root, "content", "inbox", "ready-note.md"),
        readyDraft,
      ),
      writeFile(
        join(root, "content", "inbox", "scheduled-project.md"),
        project("scheduled-project", "2026-08-10"),
      ),
      writeFile(join(root, "public", "uploads", "evidence.png"), image),
    ]);

    const sourceBefore = await readFile(join(root, "public", "uploads", "evidence.png"));
    const stagingParent = join(root, "readiness-staging");
    const report = await inspectInboxReadiness(root, "2026-08-05", { stagingParent });
    const byPath = Object.fromEntries(report.entries.map((entry) => [entry.sourcePath, entry]));

    assert.equal(report.version, 7);
    assert.equal(report.mode, "read-only");
    assert.deepEqual(report.safety, {
      authorFilesChanged: false,
      commitCreated: false,
      networkChecked: false,
      pushExecuted: false,
    });
    assert.deepEqual(report.counts, {
      attachments: 1,
      blocked: 0,
      drafts: 2,
      issues: 0,
      ready: 1,
      scheduled: 1,
    });
    assert.equal(byPath["content/inbox/ready-note.md"].state, "ready");
    assert.equal(
      byPath["content/inbox/ready-note.md"].sourceSha256,
      sha256(Buffer.from(readyDraft)),
    );
    assert.equal(byPath["content/inbox/ready-note.md"].kind, "post");
    assert.equal(byPath["content/inbox/ready-note.md"].contentType, "article");
    assert.equal(byPath["content/inbox/ready-note.md"].draftState, "draft");
    assert.equal(byPath["content/inbox/ready-note.md"].internalLinkCount, 1);
    assert.deepEqual(byPath["content/inbox/ready-note.md"].internalLinks, [
      {
        kind: "self",
        occurrences: 1,
        sourceLines: [internalLinkLine],
        target: "/posts/ready-note#方法",
      },
    ]);
    const attachment = byPath["content/inbox/ready-note.md"].attachments[0];
    assert.equal(attachment.sourcePath, "public/uploads/evidence.png");
    assert.equal(attachment.targetPath, "public/uploads/ready-note/evidence.webp");
    assert.equal(attachment.publicUrl, "/uploads/ready-note/evidence.webp");
    assert.deepEqual(attachment.usages, [
      {
        altSources: ["authored"],
        altTexts: ["示例图"],
        occurrences: 1,
        role: "body",
        sourceLines: [imageLine],
      },
    ]);
    assert.equal(attachment.preparation.optimized, true);
    assert.deepEqual(
      {
        format: attachment.preparation.source.format,
        height: attachment.preparation.source.height,
        pages: attachment.preparation.source.pages,
        sourcePath: attachment.preparation.source.sourcePath,
        width: attachment.preparation.source.width,
      },
      {
        format: "png",
        height: 630,
        pages: 1,
        sourcePath: attachment.sourcePath,
        width: 1200,
      },
    );
    assert.deepEqual(
      {
        format: attachment.preparation.output.format,
        height: attachment.preparation.output.height,
        pages: attachment.preparation.output.pages,
        sourcePath: attachment.preparation.output.sourcePath,
        width: attachment.preparation.output.width,
      },
      {
        format: "webp",
        height: 630,
        pages: 1,
        sourcePath: attachment.targetPath,
        width: 1200,
      },
    );
    assert.equal(
      attachment.preparation.bytesSaved,
      attachment.preparation.source.bytes - attachment.preparation.output.bytes,
    );
    assert.equal(byPath["content/inbox/scheduled-project.md"].state, "scheduled");
    assert.equal(
      byPath["content/inbox/scheduled-project.md"].sourceSha256,
      sha256(Buffer.from(project("scheduled-project", "2026-08-10"))),
    );
    assert.equal(byPath["content/inbox/scheduled-project.md"].kind, "project");
    assert.equal(byPath["content/inbox/scheduled-project.md"].contentType, "project");
    assert.equal(byPath["content/inbox/scheduled-project.md"].internalLinkCount, 0);
    assert.deepEqual(byPath["content/inbox/scheduled-project.md"].internalLinks, []);
    assert.deepEqual(
      await readFile(join(root, "public", "uploads", "evidence.png")),
      sourceBefore,
    );
    await assert.rejects(access(join(root, "public", "uploads", "ready-note")));
    assert.deepEqual(await readdir(stagingParent), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("blocks empty body alternative text while preserving exact source evidence", async () => {
  const root = await createFixture();
  try {
    const draft = article(
      "empty-alt",
      "2026-08-05",
      "证据 ![](/uploads/evidence.png)。",
    );
    const imageLine = draft
      .split(/\r?\n/u)
      .findIndex((line) => line.includes("![](/uploads/evidence.png)")) + 1;
    const image = await sharp({
      create: {
        width: 640,
        height: 360,
        channels: 3,
        background: "#486f78",
      },
    }).png().toBuffer();
    await Promise.all([
      writeFile(join(root, "content", "inbox", "empty-alt.md"), draft),
      writeFile(join(root, "public", "uploads", "evidence.png"), image),
    ]);

    const report = await inspectInboxReadiness(root, "2026-08-05");
    const entry = report.entries[0];
    assert.equal(report.version, 7);
    assert.equal(entry.sourceSha256, sha256(Buffer.from(draft)));
    assert.equal(entry.state, "blocked");
    assert.deepEqual(entry.attachments[0].usages, [
      {
        altSources: ["authored"],
        altTexts: [""],
        occurrences: 1,
        role: "body",
        sourceLines: [imageLine],
      },
    ]);
    assert.ok(entry.attachments[0].preparation);
    assert.deepEqual(entry.issues, [
      {
        code: "attachment-alt-empty",
        message: `附件替代文本为空：BODY L${imageLine}；请描述图片传达的信息`,
        path: "public/uploads/evidence.png",
      },
    ]);
    const output = formatInboxReadinessText(report);
    assert.match(output, new RegExp(`附件替代文本 \\[body\\] L${imageLine} · AUTHORED · EMPTY · WILL FAIL`, "u"));
    assert.match(output, /\[attachment-alt-empty\]/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("blocks filename fallback alternative text while preserving the final text", async () => {
  const root = await createFixture();
  try {
    const draft = article(
      "fallback-alt",
      "2026-08-05",
      "证据 ![[evidence.png|640x360]]。",
    );
    const imageLine = draft
      .split(/\r?\n/u)
      .findIndex((line) => line.includes("![[evidence.png|640x360]]")) + 1;
    const image = await sharp({
      create: {
        width: 640,
        height: 360,
        channels: 3,
        background: "#486f78",
      },
    }).png().toBuffer();
    await Promise.all([
      writeFile(join(root, "content", "inbox", "fallback-alt.md"), draft),
      writeFile(join(root, "public", "uploads", "evidence.png"), image),
    ]);

    const report = await inspectInboxReadiness(root, "2026-08-05");
    const entry = report.entries[0];
    assert.equal(report.version, 7);
    assert.equal(entry.sourceSha256, sha256(Buffer.from(draft)));
    assert.equal(entry.state, "blocked");
    assert.deepEqual(entry.attachments[0].usages, [
      {
        altSources: ["filename-fallback"],
        altTexts: ["evidence.png"],
        occurrences: 1,
        role: "body",
        sourceLines: [imageLine],
      },
    ]);
    assert.ok(entry.attachments[0].preparation);
    assert.deepEqual(entry.issues, [
      {
        code: "attachment-alt-filename-fallback",
        message: `附件替代文本来自文件名回退：BODY L${imageLine}；请在 Markdown alt 或 Wiki display 中填写图片描述`,
        path: "public/uploads/evidence.png",
      },
    ]);
    const output = formatInboxReadinessText(report);
    assert.match(
      output,
      new RegExp(`附件替代文本 \\[body\\] L${imageLine} · FILENAME FALLBACK · "evidence\\.png" · WILL FAIL`, "u"),
    );
    assert.match(output, /\[attachment-alt-filename-fallback\]/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("isolates invalid drafts and reports target, media, and shared-source blockers", async () => {
  const root = await createFixture();
  try {
    const image = await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: "#b9431f",
      },
    }).png().toBuffer();
    await Promise.all([
      writeFile(
        join(root, "content", "inbox", "first-note.md"),
        article("first-note", "2026-08-05", "共享 ![[shared.png]]。"),
      ),
      writeFile(
        join(root, "content", "inbox", "second-note.md"),
        article("second-note", "2026-08-05", "共享 ![[shared.png]]。"),
      ),
      writeFile(
        join(root, "content", "inbox", "missing-note.md"),
        article("missing-note", "2026-08-05", "缺失 ![[missing.png]]。"),
      ),
      writeFile(join(root, "content", "inbox", "Bad Name.md"), "---\ndraft: true\n---\n"),
      writeFile(
        join(root, "content", "posts", "first-note.md"),
        article("first-note", "2026-08-01").replace("draft: true", "draft: false"),
      ),
      writeFile(join(root, "public", "uploads", "shared.png"), image),
    ]);
    runGit(root, ["add", "public/uploads/shared.png"]);

    const report = await inspectInboxReadiness(root, "2026-08-05");
    const byPath = Object.fromEntries(report.entries.map((entry) => [entry.sourcePath, entry]));

    assert.equal(report.counts.blocked, 4);
    assert.equal(
      byPath["content/inbox/Bad Name.md"].sourceSha256,
      sha256(Buffer.from("---\ndraft: true\n---\n")),
    );
    assert.match(
      byPath["content/inbox/Bad Name.md"].issues[0].message,
      /小写 ASCII/u,
    );
    assert.ok(
      byPath["content/inbox/first-note.md"].issues.some(
        (issue) => issue.code === "target-exists",
      ),
    );
    for (const draftPath of [
      "content/inbox/first-note.md",
      "content/inbox/second-note.md",
    ]) {
      assert.ok(
        byPath[draftPath].issues.some((issue) => issue.code === "attachment-shared"),
      );
      assert.ok(
        byPath[draftPath].issues.some((issue) => issue.code === "attachment-tracked"),
      );
    }
    assert.ok(
      byPath["content/inbox/missing-note.md"].issues.some(
        (issue) => issue.code === "attachment-missing",
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scopes evidence to one source while deriving only its media and preserving global blockers", async () => {
  const root = await createFixture();
  try {
    const image = await sharp({
      create: {
        width: 640,
        height: 360,
        channels: 3,
        background: "#285f66",
      },
    }).png().toBuffer();
    await Promise.all([
      writeFile(
        join(root, "content", "inbox", "current-note.md"),
        article(
          "current-note",
          "2026-08-05",
          "共享 ![[shared.png|共享证据]]；当前 ![[current-only.png|当前证据]]。",
        ),
      ),
      writeFile(
        join(root, "content", "inbox", "peer-note.md"),
        article(
          "peer-note",
          "2026-08-05",
          "共享 ![[shared.png|共享证据]]；无关 ![[peer-only.png|同伴证据]]。",
        ),
      ),
      writeFile(join(root, "content", "inbox", "Bad Name.md"), "---\ndraft: true\n---\n"),
      writeFile(
        join(root, "content", "posts", "current-note.md"),
        article("current-note", "2026-08-01").replace("draft: true", "draft: false"),
      ),
      writeFile(join(root, "public", "uploads", "shared.png"), image),
      writeFile(join(root, "public", "uploads", "current-only.png"), image),
      writeFile(join(root, "public", "uploads", "peer-only.png"), image),
    ]);

    const scopedDerivations = [];
    const scoped = await inspectInboxReadiness(root, "2026-08-05", {
      mediaPreparer: async (...args) => {
        scopedDerivations.push(args[2]);
        return prepareMediaForPublishing(...args);
      },
      sourcePath: "content/inbox/current-note.md",
      stagingParent: join(root, "scoped-staging"),
    });
    const complete = await inspectInboxReadiness(root, "2026-08-05", {
      stagingParent: join(root, "complete-staging"),
    });
    const completeCurrent = complete.entries.find(
      (entry) => entry.sourcePath === "content/inbox/current-note.md",
    );

    assert.equal(scoped.entries.length, 1);
    assert.deepEqual(scoped.entries[0], completeCurrent);
    assert.match(scoped.entries[0].sourceSha256, /^[a-f0-9]{64}$/u);
    assert.deepEqual(scopedDerivations.sort(), [
      "public/uploads/current-only.png",
      "public/uploads/shared.png",
    ]);
    assert.deepEqual(scoped.counts, {
      attachments: 2,
      blocked: 1,
      drafts: 1,
      issues: 2,
      ready: 0,
      scheduled: 0,
    });
    assert.ok(
      scoped.entries[0].issues.some((issue) => issue.code === "attachment-shared"),
    );
    assert.ok(
      scoped.entries[0].issues.some((issue) => issue.code === "target-exists"),
    );
    assert.ok(
      scoped.entries[0].attachments.every((attachment) => attachment.preparation),
    );
    assert.ok(
      complete.entries.some((entry) => entry.sourcePath === "content/inbox/Bad Name.md"),
    );
    await assert.rejects(
      inspectInboxReadiness(root, "2026-08-05", {
        sourcePath: "content/inbox/missing-note.md",
      }),
      /目标草稿不存在/u,
    );
    await assert.rejects(
      inspectInboxReadiness(root, "2026-08-05", {
        sourcePath: "content/inbox/../current-note.md",
      }),
      /安全的 content\/inbox/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("formats an actionable text report without treating blocked findings as a scan failure", async () => {
  const root = await createFixture();
  try {
    await writeFile(
      join(root, "content", "inbox", "blocked-note.md"),
      article("blocked-note", "2026-08-05", "缺失 ![[missing.png]]。"),
    );
    const report = await inspectInboxReadiness(root, "2026-08-05");
    const output = formatInboxReadinessText(report);
    assert.match(output, /草稿 1 · ready 0 · scheduled 0 · blocked 1/u);
    assert.match(output, /BLOCKED.*blocked-note\.md/u);
    assert.match(output, /SOURCE SHA-256 [a-f0-9]{12}/u);
    assert.match(output, /附件来源 \[body\] L16/u);
    assert.match(output, /\[attachment-missing\]/u);
    assert.match(output, /不会移动、改写、提交或推送/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runs the real JSON CLI and leaves the repository byte-for-byte untouched", async () => {
  const root = await createFixture();
  try {
    const draftPath = join(root, "content", "inbox", "cli-note.md");
    const draft = article("cli-note", "2026-08-05");
    await writeFile(draftPath, draft);
    const before = await readFile(draftPath);
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        reporterPath,
        "--date",
        "2026-08-05",
        "--format",
        "json",
        "--source",
        "content/inbox/cli-note.md",
      ],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.version, 7);
    assert.equal(report.mode, "read-only");
    assert.equal(report.counts.ready, 1);
    assert.equal(report.counts.drafts, 1);
    assert.equal(report.entries[0].sourcePath, "content/inbox/cli-note.md");
    assert.equal(report.entries[0].sourceSha256, sha256(before));
    assert.deepEqual(await readFile(draftPath), before);
    assert.deepEqual(await readdir(join(root, "content", "posts")), []);
    assert.deepEqual(await readdir(join(root, "public", "uploads")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports an empty inbox and rejects invalid report dates", async () => {
  const root = await createFixture();
  try {
    const report = await inspectInboxReadiness(root, "2026-08-05");
    assert.equal(report.counts.drafts, 0);
    assert.match(formatInboxReadinessText(report), /没有可检查/u);
    await assert.rejects(inspectInboxReadiness(root, "2026-02-30"), /有效的 YYYY-MM-DD/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
