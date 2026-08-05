import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { analyzeContentDeliveryTriage } from "../lib/content/delivery-triage.ts";
import { analyzeContentPublishDelivery } from "../lib/content/publish-delivery.ts";
import { analyzeContentReviewDelivery } from "../lib/content/review-delivery.ts";

const reportScriptPath = fileURLToPath(
  new URL("../scripts/report-content-delivery-triage.mjs", import.meta.url),
);
const oid = (value) => value.repeat(40);

function run(cwd, command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 5_000_000,
    shell: false,
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

function git(cwd, ...args) {
  return run(cwd, "git", args).stdout.trim();
}

function runReport(root, ...args) {
  return run(
    root,
    process.execPath,
    ["--experimental-strip-types", reportScriptPath, ...args],
    { allowFailure: true },
  );
}

function synchronizedPair(currentBranch = "main") {
  const input = {
    ahead: 0,
    behind: 0,
    currentBranch,
    localHead: oid("a"),
    pendingCommit: null,
    trackingHead: oid("a"),
  };
  return {
    publication: analyzeContentPublishDelivery(input),
    review: analyzeContentReviewDelivery(input),
  };
}

function reviewPair(currentBranch = "main") {
  const shared = {
    ahead: 1,
    behind: 0,
    currentBranch,
    localHead: oid("b"),
    trackingHead: oid("a"),
  };
  return {
    publication: analyzeContentPublishDelivery({
      ...shared,
      pendingCommit: {
        changes: [
          {
            newBlobOid: oid("d"),
            oldBlobOid: oid("e"),
            path: "content/projects/delivery-proof.md",
            status: "modified",
          },
        ],
        commitOid: oid("b"),
        parentOids: [oid("a")],
        publication: null,
        subject: "content: review delivery-proof",
        treeOid: oid("c"),
      },
    }),
    review: analyzeContentReviewDelivery({
      ...shared,
      pendingCommit: {
        blobOid: oid("d"),
        commitOid: oid("b"),
        parentOids: [oid("a")],
        paths: ["content/projects/delivery-proof.md"],
        subject: "content: review delivery-proof",
        treeOid: oid("c"),
      },
    }),
  };
}

function publicationPair(currentBranch = "main") {
  const shared = {
    ahead: 1,
    behind: 0,
    currentBranch,
    localHead: oid("b"),
    trackingHead: oid("a"),
  };
  return {
    publication: analyzeContentPublishDelivery({
      ...shared,
      pendingCommit: {
        changes: [
          {
            newBlobOid: oid("d"),
            oldBlobOid: null,
            path: "content/posts/delivery-proof.md",
            status: "added",
          },
        ],
        commitOid: oid("b"),
        parentOids: [oid("a")],
        publication: {
          kind: "post",
          slug: "delivery-proof",
          targetPath: "content/posts/delivery-proof.md",
          title: "统一交付分诊",
        },
        subject: "content: publish delivery-proof",
        treeOid: oid("c"),
      },
    }),
    review: analyzeContentReviewDelivery({
      ...shared,
      pendingCommit: {
        blobOid: oid("d"),
        commitOid: oid("b"),
        parentOids: [oid("a")],
        paths: ["content/posts/delivery-proof.md"],
        subject: "content: publish delivery-proof",
        treeOid: oid("c"),
      },
    }),
  };
}

function ambiguousPair() {
  const shared = {
    ahead: 1,
    behind: 0,
    currentBranch: "main",
    localHead: oid("b"),
    trackingHead: oid("a"),
  };
  return {
    publication: analyzeContentPublishDelivery({
      ...shared,
      pendingCommit: {
        changes: [
          {
            newBlobOid: oid("d"),
            oldBlobOid: null,
            path: "notes.txt",
            status: "added",
          },
        ],
        commitOid: oid("b"),
        parentOids: [oid("a")],
        publication: null,
        subject: "feat: unrelated local commit",
        treeOid: oid("c"),
      },
    }),
    review: analyzeContentReviewDelivery({
      ...shared,
      pendingCommit: {
        blobOid: oid("d"),
        commitOid: oid("b"),
        parentOids: [oid("a")],
        paths: ["notes.txt"],
        subject: "feat: unrelated local commit",
        treeOid: oid("c"),
      },
    }),
  };
}

test("routes one shared Git observation to exactly one delivery workflow", () => {
  const synchronized = analyzeContentDeliveryTriage(synchronizedPair());
  assert.equal(synchronized.relation.status, "synchronized");
  assert.equal(synchronized.pending, null);
  assert.deepEqual(synchronized.route, {
    autoExecuted: false,
    deliverCommand: null,
    deliverable: false,
    kind: "none",
    statusCommand: null,
  });

  const review = analyzeContentDeliveryTriage(reviewPair());
  assert.equal(review.relation.status, "pending-review");
  assert.equal(review.pending.kind, "review");
  assert.equal(review.pending.review.sourcePath, "content/projects/delivery-proof.md");
  assert.equal(review.pending.publication, null);
  assert.deepEqual(review.route, {
    autoExecuted: false,
    deliverCommand: "npm run content:review:deliver -- --format json",
    deliverable: true,
    kind: "review",
    statusCommand: "npm run content:review:status",
  });

  const publication = analyzeContentDeliveryTriage(publicationPair());
  assert.equal(publication.relation.status, "pending-publication");
  assert.equal(publication.pending.kind, "publication");
  assert.equal(publication.pending.review, null);
  assert.equal(publication.pending.publication.title, "统一交付分诊");
  assert.deepEqual(publication.route, {
    autoExecuted: false,
    deliverCommand: "npm run content:publish:deliver -- --format json",
    deliverable: true,
    kind: "publication",
    statusCommand: "npm run content:publish:status",
  });

  const wrongBranch = analyzeContentDeliveryTriage(publicationPair("work"));
  assert.equal(wrongBranch.route.kind, "publication");
  assert.equal(wrongBranch.route.deliverable, false);
  assert.equal(wrongBranch.route.deliverCommand, null);

  const ambiguous = analyzeContentDeliveryTriage(ambiguousPair());
  assert.equal(ambiguous.relation.status, "local-ahead");
  assert.equal(ambiguous.pending, null);
  assert.deepEqual(ambiguous.route, {
    autoExecuted: false,
    deliverCommand: null,
    deliverable: false,
    kind: "inspect",
    statusCommand: null,
  });
});

test("rejects mismatched or mutually impossible source reports", () => {
  const mismatch = reviewPair();
  mismatch.publication.observation.localHead = oid("f");
  assert.throws(() => analyzeContentDeliveryTriage(mismatch), /同一 Git 观察/u);

  const impossible = reviewPair();
  impossible.publication = publicationPair().publication;
  assert.throws(() => analyzeContentDeliveryTriage(impossible), /不能同时/u);
});

const publishedPost = `---
title: "统一交付分诊"
slug: delivery-proof
description: "验证统一分诊从同一个本地 Git 快照识别新内容发布提交。"
type: article
publishedAt: 2026-08-05
freshness: historical
reviewedAt: 2026-08-05
tags: ["Git", "Personal Knowledge"]
draft: false
featured: false
---

## 证据

这是一份只用于真实 Git 分诊测试的公开文章。
`;

async function createGitFixture(kind) {
  const root = await mkdtemp(join(tmpdir(), `myblog-triage-${kind}-`));
  const remote = await mkdtemp(join(tmpdir(), `myblog-triage-remote-${kind}-`));
  await Promise.all([
    mkdir(join(root, "content", "posts"), { recursive: true }),
    mkdir(join(root, "content", "projects"), { recursive: true }),
  ]);
  await writeFile(join(root, "package.json"), "{\"private\":true}\n");
  if (kind === "review") {
    await writeFile(
      join(root, "content", "projects", "delivery-proof.md"),
      "base\n",
    );
  }
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Delivery Triage Test");
  git(root, "config", "user.email", "triage@example.test");
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture: base");
  run(remote, "git", ["init", "--bare"]);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-u", "origin", "main");

  if (kind === "review") {
    await writeFile(
      join(root, "content", "projects", "delivery-proof.md"),
      "reviewed\n",
    );
    git(root, "add", "content/projects/delivery-proof.md");
    git(root, "commit", "-m", "content: review delivery-proof");
  } else {
    await writeFile(
      join(root, "content", "posts", "delivery-proof.md"),
      publishedPost,
    );
    git(root, "add", "content/posts/delivery-proof.md");
    git(root, "commit", "-m", "content: publish delivery-proof");
  }
  return { remote, root };
}

test("classifies real review and publication commits without contacting origin", async () => {
  for (const kind of ["review", "publication"]) {
    const fixture = await createGitFixture(kind);
    try {
      const before = {
        head: git(fixture.root, "rev-parse", "HEAD"),
        index: git(fixture.root, "write-tree"),
        worktree: git(fixture.root, "status", "--porcelain=v2"),
      };
      await rm(fixture.remote, { recursive: true, force: true });
      const result = runReport(fixture.root, "--format", "json");
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      const report = JSON.parse(result.stdout);
      assert.equal(report.relation.status, `pending-${kind}`);
      assert.equal(report.route.kind, kind);
      assert.equal(report.route.deliverable, true);
      assert.equal(report.pending.kind, kind);
      assert.deepEqual(
        {
          head: git(fixture.root, "rev-parse", "HEAD"),
          index: git(fixture.root, "write-tree"),
          worktree: git(fixture.root, "status", "--porcelain=v2"),
        },
        before,
      );
      assert.equal(
        await readFile(join(fixture.root, "package.json"), "utf8"),
        "{\"private\":true}\n",
      );
    } finally {
      await Promise.all([
        rm(fixture.root, { recursive: true, force: true }),
        rm(fixture.remote, { recursive: true, force: true }),
      ]);
    }
  }
});
