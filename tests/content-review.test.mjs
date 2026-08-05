import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
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
  fingerprintContentReviewCandidate,
  inspectContentReview,
} from "../lib/content/review-note.ts";
import {
  analyzeContentReviewDelivery,
  createContentReviewDeliveryReceipt,
} from "../lib/content/review-delivery.ts";
import { classifyContentReviewWorktree } from "../lib/content/review-worktree.ts";

const reviewerScriptPath = fileURLToPath(
  new URL("../scripts/review-note.mjs", import.meta.url),
);
const deliveryScriptPath = fileURLToPath(
  new URL("../scripts/report-content-review-delivery.mjs", import.meta.url),
);
const deliverScriptPath = fileURLToPath(
  new URL("../scripts/deliver-content-review.mjs", import.meta.url),
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

function runDeliveryReport(root, ...args) {
  return run(
    root,
    process.execPath,
    ["--experimental-strip-types", deliveryScriptPath, ...args],
    { allowFailure: true },
  );
}

function runReviewDelivery(root, ...args) {
  return run(
    root,
    process.execPath,
    ["--experimental-strip-types", deliverScriptPath, ...args],
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

test("fingerprints the exact review candidate bytes with SHA-256", () => {
  assert.equal(
    fingerprintContentReviewCandidate(Buffer.from("abc", "utf8")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.notEqual(
    fingerprintContentReviewCandidate(Buffer.from("abc\n", "utf8")),
    fingerprintContentReviewCandidate(Buffer.from("abc", "utf8")),
  );
});

test("derives synchronized and exact pending-review delivery states", () => {
  const trackingHead = "a".repeat(40);
  const localHead = "b".repeat(40);
  const synchronized = analyzeContentReviewDelivery({
    ahead: 0,
    behind: 0,
    currentBranch: "main",
    localHead: trackingHead,
    pendingCommit: null,
    trackingHead,
  });
  assert.equal(synchronized.relation.status, "synchronized");
  assert.equal(synchronized.pendingReview, null);
  assert.deepEqual(synchronized.recovery, {
    action: "none",
    autoExecuted: false,
    command: null,
  });

  const pending = analyzeContentReviewDelivery({
    ahead: 1,
    behind: 0,
    currentBranch: "main",
    localHead,
    pendingCommit: {
      blobOid: "d".repeat(40),
      commitOid: localHead,
      parentOids: [trackingHead],
      paths: [sourcePath],
      subject: "content: review reviewed-note",
      treeOid: "c".repeat(40),
    },
    trackingHead,
  });
  assert.equal(pending.relation.status, "pending-review");
  assert.deepEqual(pending.pendingReview, {
    blobOid: "d".repeat(40),
    commitOid: localHead,
    parentOid: trackingHead,
    slug: "reviewed-note",
    sourcePath,
    subject: "content: review reviewed-note",
    treeOid: "c".repeat(40),
  });
  assert.deepEqual(pending.recovery, {
    action: "push-origin-main",
    autoExecuted: false,
    command: "git push origin main",
  });
  assert.equal(pending.observation.networkChecked, false);
});

test("keeps ambiguous local history out of pending-review recovery", () => {
  const trackingHead = "a".repeat(40);
  const localHead = "b".repeat(40);
  const invalidCommit = {
    blobOid: "d".repeat(40),
    commitOid: localHead,
    parentOids: [trackingHead],
    paths: ["scripts/not-review.mjs"],
    subject: "content: review reviewed-note",
    treeOid: "c".repeat(40),
  };
  const ahead = analyzeContentReviewDelivery({
    ahead: 1,
    behind: 0,
    currentBranch: "main",
    localHead,
    pendingCommit: invalidCommit,
    trackingHead,
  });
  assert.equal(ahead.relation.status, "local-ahead");
  assert.equal(ahead.pendingReview, null);
  assert.equal(ahead.recovery.action, "inspect-git-state");

  const diverged = analyzeContentReviewDelivery({
    ahead: 2,
    behind: 1,
    currentBranch: "work",
    localHead,
    pendingCommit: null,
    trackingHead,
  });
  assert.equal(diverged.relation.status, "diverged");
  assert.equal(diverged.observation.currentBranch, "work");

  const missing = analyzeContentReviewDelivery({
    ahead: null,
    behind: null,
    currentBranch: null,
    localHead,
    pendingCommit: null,
    trackingHead: null,
  });
  assert.equal(missing.relation.status, "tracking-missing");
  assert.equal(missing.observation.trackingHead, null);
});

test("creates a delivery receipt only for a stable exact transition", () => {
  const trackingHead = "a".repeat(40);
  const commitOid = "b".repeat(40);
  const pending = analyzeContentReviewDelivery({
    ahead: 1,
    behind: 0,
    currentBranch: "main",
    localHead: commitOid,
    pendingCommit: {
      blobOid: "d".repeat(40),
      commitOid,
      parentOids: [trackingHead],
      paths: [sourcePath],
      subject: "content: review reviewed-note",
      treeOid: "c".repeat(40),
    },
    trackingHead,
  });
  const synchronized = analyzeContentReviewDelivery({
    ahead: 0,
    behind: 0,
    currentBranch: "main",
    localHead: commitOid,
    pendingCommit: null,
    trackingHead: commitOid,
  });
  const receipt = createContentReviewDeliveryReceipt({
    after: synchronized,
    before: pending,
    indexStable: true,
    worktreeStable: true,
  });
  assert.equal(receipt.version, 1);
  assert.equal(receipt.mode, "delivered");
  assert.equal(receipt.review.commitOid, commitOid);
  assert.equal(
    receipt.transition.command,
    `git push origin ${commitOid}:refs/heads/main`,
  );
  assert.deepEqual(receipt.transition.before, {
    localHead: commitOid,
    relation: "pending-review",
    trackingHead,
  });
  assert.deepEqual(receipt.transition.after, {
    localHead: commitOid,
    relation: "synchronized",
    trackingHead: commitOid,
  });
  assert.deepEqual(receipt.safety, {
    fetchExecuted: false,
    headStable: true,
    indexStable: true,
    rebaseExecuted: false,
    resetExecuted: false,
    worktreeStable: true,
  });

  const wrongAfter = structuredClone(synchronized);
  wrongAfter.observation.localHead = "e".repeat(40);
  wrongAfter.observation.trackingHead = "e".repeat(40);
  assert.throws(
    () => createContentReviewDeliveryReceipt({
      after: wrongAfter,
      before: pending,
      indexStable: true,
      worktreeStable: true,
    }),
    /交付后的 main 必须仍是已验证复核提交/u,
  );
  assert.throws(
    () => createContentReviewDeliveryReceipt({
      after: synchronized,
      before: pending,
      indexStable: false,
      worktreeStable: true,
    }),
    /index.*保持不变/u,
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
    const candidateDigest = fingerprintContentReviewCandidate(
      Buffer.from(fixture.reviewedContent, "utf8"),
    );
    assert.deepEqual(proof, {
      version: 3,
      mode: "check-only",
      candidate: {
        algorithm: "sha256",
        digest: candidateDigest,
        stableAfterQualityGate: true,
      },
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
      createContentReviewProof(
        proof.review,
        {
          blockingPaths: [],
          ...proof.git,
          targetChanged: true,
        },
        candidateDigest,
      ),
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

test("rejects a target edited during the quality gate", async () => {
  const fixture = await createReviewFixture(
    0,
    0,
    'require("node:fs").appendFileSync("content/posts/reviewed-note.md", "\\nlate target edit\\n");',
  );
  try {
    const result = runReviewer(fixture.root, "--push");
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /全量检查失败/u);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /正式内容在质量门期间发生变化.*候选指纹不再匹配/su,
    );
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), fixture.baseHead);
    assert.equal(git(fixture.root, "diff", "--cached", "--name-only"), "");
    assert.equal(git(fixture.remote, "rev-parse", "refs/heads/main"), fixture.baseHead);
  } finally {
    await removeFixture(fixture);
  }
});

test("rejects a HEAD changed during the quality gate", async () => {
  const fixture = await createReviewFixture(
    0,
    0,
    'require("node:child_process").execFileSync("git", ["commit", "--allow-empty", "-m", "late head"]);',
  );
  try {
    const result = runReviewer(fixture.root, "--push");
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /全量检查失败/u);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /质量门期间 HEAD 已变化/u,
    );
    assert.notEqual(git(fixture.root, "rev-parse", "HEAD"), fixture.baseHead);
    assert.equal(git(fixture.root, "diff", "--cached", "--name-only"), "");
    assert.equal(git(fixture.remote, "rev-parse", "refs/heads/main"), fixture.baseHead);
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
    assert.match(result.stdout, /候选指纹：sha256:[a-f0-9]{12}…[a-f0-9]{8} · 门前\/门后一致/u);
    const committedContent = run(
      fixture.root,
      "git",
      ["show", `HEAD:${sourcePath}`],
    ).stdout;
    assert.equal(committedContent, fixture.reviewedContent);
    assert.equal(
      fingerprintContentReviewCandidate(Buffer.from(committedContent, "utf8")),
      fingerprintContentReviewCandidate(Buffer.from(fixture.reviewedContent, "utf8")),
    );
    assert.equal(
      await readFile(join(fixture.root, ...sourcePath.split("/")), "utf8"),
      fixture.reviewedContent,
    );
  } finally {
    await removeFixture(fixture);
  }
});

test("binds the candidate through Git clean filters before comparing blobs", async () => {
  const fixture = await createReviewFixture();
  try {
    git(fixture.root, "config", "core.autocrlf", "true");
    const crlfCandidate = fixture.reviewedContent.replaceAll("\n", "\r\n");
    await writeFile(
      join(fixture.root, ...sourcePath.split("/")),
      crlfCandidate,
    );

    const result = runReviewer(fixture.root, "--push");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(
      run(fixture.root, "git", ["show", `HEAD:${sourcePath}`]).stdout,
      fixture.reviewedContent,
    );
    assert.equal(
      await readFile(join(fixture.root, ...sourcePath.split("/")), "utf8"),
      crlfCandidate,
    );
    assert.equal(
      git(fixture.remote, "rev-parse", "refs/heads/main"),
      git(fixture.root, "rev-parse", "HEAD"),
    );
  } finally {
    await removeFixture(fixture);
  }
});

test("rolls back a commit tree that no longer matches the checked candidate", async () => {
  const fixture = await createReviewFixture();
  try {
    const hookPath = join(fixture.root, ".git", "hooks", "post-commit");
    await writeFile(
      hookPath,
      `#!/bin/sh
marker=".git/myblog-post-commit-once"
if test -f "$marker"; then
  exit 0
fi
: > "$marker"
printf '\\npost-commit drift\\n' >> "${sourcePath}"
git add -- "${sourcePath}"
git commit --amend --no-edit --no-verify >/dev/null 2>&1
`,
    );
    await chmod(hookPath, 0o755);

    const result = runReviewer(fixture.root, "--push");
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /未通过候选指纹验证；已撤回本地提交并保留工作区/u,
    );
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /复核提交内容与通过质量门的候选指纹不一致/u,
    );
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), fixture.baseHead);
    assert.equal(git(fixture.root, "diff", "--cached", "--name-only"), "");
    assert.equal(git(fixture.remote, "rev-parse", "refs/heads/main"), fixture.baseHead);
    assert.match(
      await readFile(join(fixture.root, ...sourcePath.split("/")), "utf8"),
      /post-commit drift/u,
    );
  } finally {
    await removeFixture(fixture);
  }
});

test("reports and blocks a verified review commit whose push is still pending", async () => {
  const fixture = await createReviewFixture();
  try {
    const hookPath = join(fixture.remote, "hooks", "pre-receive");
    await writeFile(
      hookPath,
      "#!/bin/sh\necho 'delivery intentionally rejected' >&2\nexit 1\n",
    );
    await chmod(hookPath, 0o755);

    const push = runReviewer(fixture.root, "--push");
    assert.equal(push.status, 1, `${push.stdout}\n${push.stderr}`);
    assert.match(
      `${push.stdout}\n${push.stderr}`,
      /复核提交已保留在本地.*GitHub 同步失败/su,
    );
    const pendingHead = git(fixture.root, "rev-parse", "HEAD");
    assert.notEqual(pendingHead, fixture.baseHead);
    assert.equal(
      git(fixture.remote, "rev-parse", "refs/heads/main"),
      fixture.baseHead,
    );

    const stateBeforeReport = {
      head: git(fixture.root, "rev-parse", "HEAD"),
      index: git(fixture.root, "write-tree"),
      worktree: git(fixture.root, "status", "--porcelain=v1"),
    };
    const status = runDeliveryReport(fixture.root, "--format", "json");
    assert.equal(status.status, 1, `${status.stdout}\n${status.stderr}`);
    const report = JSON.parse(status.stdout);
    assert.equal(report.relation.status, "pending-review");
    assert.equal(report.relation.ahead, 1);
    assert.equal(report.relation.behind, 0);
    assert.equal(report.pendingReview.commitOid, pendingHead);
    assert.equal(report.pendingReview.parentOid, fixture.baseHead);
    assert.equal(report.pendingReview.sourcePath, sourcePath);
    assert.equal(report.pendingReview.subject, "content: review reviewed-note");
    assert.equal(report.recovery.command, "git push origin main");
    assert.equal(report.observation.networkChecked, false);
    assert.deepEqual(
      {
        head: git(fixture.root, "rev-parse", "HEAD"),
        index: git(fixture.root, "write-tree"),
        worktree: git(fixture.root, "status", "--porcelain=v1"),
      },
      stateBeforeReport,
    );

    const repeated = runReviewer(fixture.root, "--check-only");
    assert.equal(repeated.status, 1, `${repeated.stdout}\n${repeated.stderr}`);
    assert.match(
      `${repeated.stdout}\n${repeated.stderr}`,
      /已有待同步正式内容复核.*content\/posts\/reviewed-note\.md.*content:review:status/su,
    );

    const rejectedDelivery = runReviewDelivery(fixture.root, "--format", "json");
    assert.equal(
      rejectedDelivery.status,
      1,
      `${rejectedDelivery.stdout}\n${rejectedDelivery.stderr}`,
    );
    assert.match(
      `${rejectedDelivery.stdout}\n${rejectedDelivery.stderr}`,
      /精确复核提交同步失败.*本地提交保持不变/su,
    );
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), pendingHead);
    assert.equal(
      git(fixture.remote, "rev-parse", "refs/heads/main"),
      fixture.baseHead,
    );

    await rm(hookPath, { force: true });
    git(fixture.root, "switch", "-c", "delivery-work");
    const wrongBranch = runReviewDelivery(fixture.root, "--format", "json");
    assert.equal(wrongBranch.status, 1);
    assert.match(
      `${wrongBranch.stdout}\n${wrongBranch.stderr}`,
      /只能在 main 分支重新同步/u,
    );
    git(fixture.root, "switch", "main");

    const deliveredAction = runReviewDelivery(fixture.root, "--format", "json");
    assert.equal(
      deliveredAction.status,
      0,
      `${deliveredAction.stdout}\n${deliveredAction.stderr}`,
    );
    const receipt = JSON.parse(deliveredAction.stdout);
    assert.equal(receipt.mode, "delivered");
    assert.equal(receipt.review.commitOid, pendingHead);
    assert.equal(receipt.review.sourcePath, sourcePath);
    assert.equal(
      receipt.transition.command,
      `git push origin ${pendingHead}:refs/heads/main`,
    );
    assert.equal(receipt.transition.after.relation, "synchronized");
    assert.equal(receipt.safety.headStable, true);
    assert.equal(receipt.safety.indexStable, true);
    assert.equal(receipt.safety.worktreeStable, true);
    assert.equal(receipt.safety.fetchExecuted, false);
    assert.equal(receipt.safety.rebaseExecuted, false);
    assert.equal(receipt.safety.resetExecuted, false);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), pendingHead);
    assert.equal(
      git(fixture.remote, "rev-parse", "refs/heads/main"),
      pendingHead,
    );
    const delivered = runDeliveryReport(fixture.root, "--format", "json");
    assert.equal(delivered.status, 0, `${delivered.stdout}\n${delivered.stderr}`);
    assert.equal(JSON.parse(delivered.stdout).relation.status, "synchronized");
  } finally {
    await removeFixture(fixture);
  }
});

test("keeps a pending review when the unseen remote rejects a non-fast-forward", async () => {
  const fixture = await createReviewFixture();
  try {
    const hookPath = join(fixture.remote, "hooks", "pre-receive");
    await writeFile(hookPath, "#!/bin/sh\nexit 1\n");
    await chmod(hookPath, 0o755);
    const initial = runReviewer(fixture.root, "--push");
    assert.equal(initial.status, 1, `${initial.stdout}\n${initial.stderr}`);
    const pendingHead = git(fixture.root, "rev-parse", "HEAD");
    await rm(hookPath, { force: true });

    git(fixture.remote, "config", "user.name", "Remote Advance");
    git(fixture.remote, "config", "user.email", "remote@example.test");
    const remoteTree = git(fixture.remote, "rev-parse", `${fixture.baseHead}^{tree}`);
    const remoteCommit = run(
      fixture.remote,
      "git",
      ["commit-tree", remoteTree, "-p", fixture.baseHead],
      { input: "remote advanced independently\n" },
    ).stdout.trim();
    git(fixture.remote, "update-ref", "refs/heads/main", remoteCommit, fixture.baseHead);

    const delivery = runReviewDelivery(fixture.root, "--format", "json");
    assert.equal(delivery.status, 1, `${delivery.stdout}\n${delivery.stderr}`);
    assert.match(
      `${delivery.stdout}\n${delivery.stderr}`,
      /精确复核提交同步失败.*本地提交保持不变/su,
    );
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), pendingHead);
    assert.equal(git(fixture.remote, "rev-parse", "refs/heads/main"), remoteCommit);
  } finally {
    await removeFixture(fixture);
  }
});
