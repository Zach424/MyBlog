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
import {
  createContentReviewProof,
  inspectContentReview,
} from "../lib/content/review-note.ts";
import { classifyContentReviewWorktree } from "../lib/content/review-worktree.ts";

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

function runReviewer(root, ...args) {
  return run(
    root,
    process.execPath,
    ["--experimental-strip-types", reviewerScriptPath, sourcePath, ...args],
    { allowFailure: true },
  );
}

async function createReviewFixture(
  checkExitCode = 0,
  qualityOutputBytes = 0,
  qualityMutation = "",
) {
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

  await Promise.all([
    mkdir(join(root, "content", "inbox"), { recursive: true }),
    mkdir(join(root, "content", "posts"), { recursive: true }),
    mkdir(join(root, "public", "uploads"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      join(root, "package.json"),
      JSON.stringify({ scripts: { check: "node quality.cjs" } }),
    ),
    writeFile(
      join(root, "quality.cjs"),
      `process.stdout.write("q".repeat(${qualityOutputBytes}));\n${qualityMutation}\nprocess.exit(${checkExitCode});\n`,
    ),
    writeFile(join(root, "content", "inbox", "parallel-draft.md"), "# Draft\n"),
    writeFile(join(root, ...sourcePath.split("/")), baseContent),
    writeFile(join(root, "public", "uploads", "tracked.png"), "tracked base\n"),
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
      previousUpdatedAt: previousDate,
      reviewedAt: reviewDate,
      slug: "reviewed-note",
      sourcePath,
      substantiveChanged: false,
      title: "Review workflow",
      updatedAt: previousDate,
    },
  );
});

test("classifies only isolated author drafts as deferred review work", () => {
  assert.deepEqual(
    classifyContentReviewWorktree({
      changedPaths: [sourcePath, "content/inbox/parallel-draft.md"],
      sourcePath,
      stagedPaths: [],
      untrackedPaths: [
        "public/uploads/Pasted image 20260805.png",
        "content/inbox/new-draft.md",
      ],
    }),
    {
      blockingPaths: [],
      changedPaths: ["content/inbox/parallel-draft.md", sourcePath],
      committablePaths: [sourcePath],
      deferredPaths: [
        "content/inbox/new-draft.md",
        "content/inbox/parallel-draft.md",
        "public/uploads/Pasted image 20260805.png",
      ],
      stagedPaths: [],
      targetChanged: true,
      untrackedPaths: [
        "content/inbox/new-draft.md",
        "public/uploads/Pasted image 20260805.png",
      ],
    },
  );

  const blocked = classifyContentReviewWorktree({
    changedPaths: [
      sourcePath,
      "content/projects/other.md",
      "public/uploads/tracked.png",
    ],
    sourcePath,
    stagedPaths: ["content/inbox/staged-draft.md"],
    untrackedPaths: [
      "content/inbox/Bad Draft.md",
      "public/uploads/reviewed-note/nested.png",
      "scripts/unknown.mjs",
    ],
  });
  assert.deepEqual(blocked.committablePaths, []);
  assert.deepEqual(blocked.deferredPaths, []);
  assert.deepEqual(blocked.blockingPaths, [
    "content/inbox/Bad Draft.md",
    "content/projects/other.md",
    "public/uploads/reviewed-note/nested.png",
    "public/uploads/tracked.png",
    "scripts/unknown.mjs",
  ]);
  assert.deepEqual(
    classifyContentReviewWorktree({
      changedPaths: [sourcePath],
      sourcePath,
      stagedPaths: [],
      untrackedPaths: ["public/uploads/control\nname.png"],
    }).blockingPaths,
    ["public/uploads/control\nname.png"],
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
  const fixture = await createReviewFixture(0, 250_000);
  try {
    const result = runReviewer(
      fixture.root,
      "--check-only",
      "--format",
      "json",
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const proof = JSON.parse(result.stdout);
    assert.deepEqual(proof, {
      version: 2,
      mode: "check-only",
      review: {
        kind: "post",
        previousReviewedAt: fixture.previousDate,
        previousUpdatedAt: fixture.previousDate,
        reviewedAt: fixture.reviewDate,
        slug: "reviewed-note",
        sourcePath,
        substantiveChanged: false,
        title: "Review workflow",
        updatedAt: fixture.previousDate,
      },
      git: {
        branch: "main",
        changedPaths: [sourcePath],
        committablePaths: [sourcePath],
        deferredPaths: [],
        stagedPaths: [],
        untrackedPaths: [],
      },
      qualityGate: {
        command: "npm run check",
        status: "passed",
      },
    });
    assert.deepEqual(
      createContentReviewProof(proof.review, {
        blockingPaths: [],
        ...proof.git,
        targetChanged: true,
      }),
      proof,
    );
    assert.doesNotMatch(result.stdout, /> .* check/u);
    assert.ok(result.stdout.length < 5_000, "quality output leaked into JSON stdout");
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
    assert.match(`${result.stdout}\n${result.stderr}`, /阻断路径.*unrelated\.txt/su);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), fixture.baseHead);
    assert.equal(git(fixture.root, "diff", "--cached", "--name-only"), "");
  } finally {
    await removeFixture(fixture);
  }
});

test("blocks modified root media and nested archive paths", async () => {
  const fixture = await createReviewFixture();
  try {
    await writeFile(
      join(fixture.root, "public", "uploads", "tracked.png"),
      "tracked worktree change\n",
    );
    let result = runReviewer(fixture.root, "--check-only");
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /阻断路径.*public\/uploads\/tracked\.png/su,
    );

    git(fixture.root, "restore", "--", "public/uploads/tracked.png");
    await mkdir(join(fixture.root, "public", "uploads", "reviewed-note"));
    await writeFile(
      join(fixture.root, "public", "uploads", "reviewed-note", "nested.png"),
      "nested\n",
    );
    result = runReviewer(fixture.root, "--check-only");
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /阻断路径.*public\/uploads\/reviewed-note\/nested\.png/su,
    );
  } finally {
    await removeFixture(fixture);
  }
});

test("reclassifies worktree impact after the quality gate", async () => {
  const fixture = await createReviewFixture(
    0,
    0,
    'require("node:fs").writeFileSync("late-unsafe.txt", "late\\n");',
  );
  try {
    const result = runReviewer(fixture.root, "--check-only");
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /全量检查失败/u);
    assert.match(`${result.stdout}\n${result.stderr}`, /阻断路径.*late-unsafe\.txt/su);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), fixture.baseHead);
    assert.equal(git(fixture.root, "diff", "--cached", "--name-only"), "");
  } finally {
    await removeFixture(fixture);
  }
});

test("rejects pre-staged content and non-main branches", async () => {
  const fixture = await createReviewFixture();
  try {
    const mutatingJson = runReviewer(
      fixture.root,
      "--push",
      "--format",
      "json",
    );
    assert.equal(mutatingJson.status, 1, `${mutatingJson.stdout}\n${mutatingJson.stderr}`);
    assert.match(`${mutatingJson.stdout}\n${mutatingJson.stderr}`, /只用于 --check-only/u);

    git(fixture.root, "add", "--", sourcePath);
    const staged = runReviewer(fixture.root, "--check-only");
    assert.equal(staged.status, 1, `${staged.stdout}\n${staged.stderr}`);
    assert.match(`${staged.stdout}\n${staged.stderr}`, /暂存区必须为空/u);
    git(fixture.root, "restore", "--staged", "--", sourcePath);

    const intentPath = "content/inbox/intent-draft.md";
    await writeFile(join(fixture.root, ...intentPath.split("/")), "# Intent\n");
    git(fixture.root, "add", "-N", "--", intentPath);
    const intentToAdd = runReviewer(fixture.root, "--check-only");
    assert.equal(
      intentToAdd.status,
      1,
      `${intentToAdd.stdout}\n${intentToAdd.stderr}`,
    );
    assert.match(
      `${intentToAdd.stdout}\n${intentToAdd.stderr}`,
      /暂存区必须为空.*content\/inbox\/intent-draft\.md/su,
    );
    git(fixture.root, "reset", "--", intentPath);
    await rm(join(fixture.root, ...intentPath.split("/")));

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
    await Promise.all([
      writeFile(
        join(fixture.root, "content", "inbox", "parallel-draft.md"),
        "# Draft changed\n",
      ),
      writeFile(
        join(fixture.root, "content", "inbox", "new-draft.md"),
        "# New draft\n",
      ),
      writeFile(
        join(fixture.root, "public", "uploads", "Pasted image 20260805.png"),
        "new image\n",
      ),
    ]);
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
    assert.equal(
      git(fixture.root, "diff", "--name-only"),
      "content/inbox/parallel-draft.md",
    );
    assert.deepEqual(
      git(
        fixture.root,
        "ls-files",
        "--others",
        "--exclude-standard",
      ).split("\n"),
      [
        "content/inbox/new-draft.md",
        "public/uploads/Pasted image 20260805.png",
      ],
    );
    assert.match(result.stdout, /隔离作者工作（不进入本次提交）：3/u);
    assert.equal(
      await readFile(join(fixture.root, ...sourcePath.split("/")), "utf8"),
      fixture.reviewedContent,
    );
  } finally {
    await removeFixture(fixture);
  }
});
