import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { resolveContentBuildDate } from "../build/content-build-date.ts";
import { inspectContentReview } from "../lib/content/review-note.ts";

const reviewerScriptPath = fileURLToPath(
  new URL("../scripts/review-note.mjs", import.meta.url),
);
const sourcePath = "content/posts/reviewed-note.md";

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function postContent({
  body = "## 结论\n\n复核前的正文。",
  freshness = "current",
  publishedAt,
  reviewedAt,
  updatedAt,
} = {}) {
  return `---
title: "Review workflow"
description: "验证已发布内容如何由作者安全完成复核。"
type: article
publishedAt: ${publishedAt}
updatedAt: ${updatedAt}
freshness: ${freshness}
reviewedAt: ${reviewedAt}
tags: ["Git", "Personal Knowledge"]
draft: false
featured: false
---

${body}
`;
}

function run(root, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 2_000_000,
    ...options,
  });
  if (options.allowFailure !== true) {
    assert.equal(
      result.status,
      0,
      `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

function git(root, ...args) {
  return run(root, "git", args).stdout.trim();
}

function runReviewer(root, mode) {
  return run(
    root,
    process.execPath,
    ["--experimental-strip-types", reviewerScriptPath, sourcePath, mode],
    { allowFailure: true },
  );
}

async function createReviewFixture(checkExitCode = 0) {
  const root = await mkdtemp(join(tmpdir(), "myblog-review-"));
  const remote = await mkdtemp(join(tmpdir(), "myblog-review-remote-"));
  const reviewDate = resolveContentBuildDate();
  const previousDate = shiftDate(reviewDate, -1);
  const publishedAt = shiftDate(reviewDate, -30);
  const baseContent = postContent({
    publishedAt,
    reviewedAt: previousDate,
    updatedAt: previousDate,
  });
  const reviewedContent = postContent({
    publishedAt,
    reviewedAt: reviewDate,
    updatedAt: previousDate,
  });

  await mkdir(join(root, "content", "posts"), { recursive: true });
  await Promise.all([
    writeFile(
      join(root, "package.json"),
      JSON.stringify({ scripts: { check: "node quality.cjs" } }),
    ),
    writeFile(
      join(root, "quality.cjs"),
      `process.exit(${checkExitCode});\n`,
    ),
    writeFile(join(root, ...sourcePath.split("/")), baseContent),
  ]);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Review Test");
  git(root, "config", "user.email", "review@example.test");
  git(root, "add", "--all");
  git(root, "commit", "-m", "fixture: base content");
  run(remote, "git", ["init", "--bare"]);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-u", "origin", "main");
  const baseHead = git(root, "rev-parse", "HEAD");
  await writeFile(join(root, ...sourcePath.split("/")), reviewedContent);

  return {
    baseContent,
    baseHead,
    previousDate,
    publishedAt,
    remote,
    reviewDate,
    reviewedContent,
    root,
  };
}

async function removeFixture(fixture) {
  await Promise.all([
    rm(fixture.root, { force: true, recursive: true }),
    rm(fixture.remote, { force: true, recursive: true }),
  ]);
}

test("accepts an explicit review-only date advance", () => {
  const reviewDate = "2026-08-06";
  const previousDate = "2026-08-05";
  const publishedAt = "2026-07-01";
  const previous = postContent({
    publishedAt,
    reviewedAt: previousDate,
    updatedAt: previousDate,
  });
  const current = postContent({
    publishedAt,
    reviewedAt: reviewDate,
    updatedAt: previousDate,
  });

  assert.deepEqual(
    inspectContentReview({
      currentContent: current,
      previousContent: previous,
      reviewDate,
      sourcePath,
    }),
    {
      kind: "post",
      previousReviewedAt: previousDate,
      reviewedAt: reviewDate,
      slug: "reviewed-note",
      sourcePath,
      substantiveChanged: false,
      updatedAt: previousDate,
    },
  );
});

test("requires updatedAt today when facts change", () => {
  const reviewDate = "2026-08-06";
  const previousDate = "2026-08-05";
  const publishedAt = "2026-07-01";
  const previous = postContent({
    publishedAt,
    reviewedAt: previousDate,
    updatedAt: previousDate,
  });
  const changedBody = "## 结论\n\n复核后修正了事实。";
  assert.throws(
    () =>
      inspectContentReview({
        currentContent: postContent({
          body: changedBody,
          publishedAt,
          reviewedAt: reviewDate,
          updatedAt: previousDate,
        }),
        previousContent: previous,
        reviewDate,
        sourcePath,
      }),
    /正文或元数据发生变化时，updatedAt 必须更新为 2026-08-06/u,
  );

  const inspection = inspectContentReview({
    currentContent: postContent({
      body: changedBody,
      publishedAt,
      reviewedAt: reviewDate,
      updatedAt: reviewDate,
    }),
    previousContent: previous,
    reviewDate,
    sourcePath,
  });
  assert.equal(inspection.substantiveChanged, true);
  assert.equal(inspection.updatedAt, reviewDate);
});

test("rejects stale evidence, identity drift, and non-current records", () => {
  const reviewDate = "2026-08-06";
  const previousDate = "2026-08-05";
  const publishedAt = "2026-07-01";
  const previous = postContent({
    publishedAt,
    reviewedAt: previousDate,
    updatedAt: previousDate,
  });
  const inspect = (currentContent, candidatePath = sourcePath) =>
    inspectContentReview({
      currentContent,
      previousContent: previous,
      reviewDate,
      sourcePath: candidatePath,
    });

  assert.throws(
    () => inspect(previous),
    /reviewedAt 必须更新为本次复核日 2026-08-06/u,
  );
  assert.throws(
    () =>
      inspect(
        postContent({
          publishedAt: "2026-07-02",
          reviewedAt: reviewDate,
          updatedAt: reviewDate,
        }),
      ),
    /publishedAt 不能在复核流程中改变/u,
  );
  assert.throws(
    () =>
      inspect(
        postContent({
          freshness: "historical",
          publishedAt,
          reviewedAt: reviewDate,
          updatedAt: previousDate,
        }),
      ),
    /只接受 freshness: current/u,
  );
  assert.throws(
    () => inspect(previous, "content/inbox/reviewed-note.md"),
    /正式文章或项目/u,
  );
});

test("checks one reviewed note without changing Git state", async () => {
  const fixture = await createReviewFixture();
  try {
    const result = runReviewer(fixture.root, "--check-only");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /正式内容复核检查通过/u);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), fixture.baseHead);
    assert.equal(git(fixture.root, "diff", "--cached", "--name-only"), "");
    assert.equal(git(fixture.root, "diff", "--name-only"), sourcePath);
  } finally {
    await removeFixture(fixture);
  }
});

test("blocks unrelated worktree files before the quality gate", async () => {
  const fixture = await createReviewFixture();
  try {
    await writeFile(join(fixture.root, "unrelated.txt"), "unrelated\n");
    const result = runReviewer(fixture.root, "--check-only");
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /存在未跟踪文件.*unrelated\.txt/su);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), fixture.baseHead);
    assert.equal(git(fixture.root, "diff", "--cached", "--name-only"), "");
  } finally {
    await removeFixture(fixture);
  }
});

test("rejects pre-staged content and non-main branches", async () => {
  const fixture = await createReviewFixture();
  try {
    git(fixture.root, "add", "--", sourcePath);
    const staged = runReviewer(fixture.root, "--check-only");
    assert.equal(staged.status, 1, `${staged.stdout}\n${staged.stderr}`);
    assert.match(`${staged.stdout}\n${staged.stderr}`, /暂存区必须为空/u);
    git(fixture.root, "restore", "--staged", "--", sourcePath);

    git(fixture.root, "switch", "-c", "review-work");
    const branch = runReviewer(fixture.root, "--check-only");
    assert.equal(branch.status, 1, `${branch.stdout}\n${branch.stderr}`);
    assert.match(`${branch.stdout}\n${branch.stderr}`, /只能在 main 分支执行/u);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), fixture.baseHead);
  } finally {
    await removeFixture(fixture);
  }
});

test("leaves a failed review unstaged and uncommitted", async () => {
  const fixture = await createReviewFixture(7);
  try {
    const result = runReviewer(fixture.root, "--push");
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /全量检查失败/u);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), fixture.baseHead);
    assert.equal(git(fixture.root, "diff", "--cached", "--name-only"), "");
    assert.equal(git(fixture.remote, "rev-parse", "refs/heads/main"), fixture.baseHead);
  } finally {
    await removeFixture(fixture);
  }
});

test("commits and pushes exactly the reviewed note", async () => {
  const fixture = await createReviewFixture();
  try {
    const result = runReviewer(fixture.root, "--push");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /已提交并同步正式内容复核/u);
    const head = git(fixture.root, "rev-parse", "HEAD");
    assert.notEqual(head, fixture.baseHead);
    assert.equal(git(fixture.root, "log", "-1", "--pretty=%s"), "content: review reviewed-note");
    assert.equal(
      git(fixture.root, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"),
      sourcePath,
    );
    assert.equal(git(fixture.remote, "rev-parse", "refs/heads/main"), head);
    assert.equal(git(fixture.root, "status", "--porcelain"), "");
    assert.equal(
      await readFile(join(fixture.root, ...sourcePath.split("/")), "utf8"),
      fixture.reviewedContent,
    );
  } finally {
    await removeFixture(fixture);
  }
});
