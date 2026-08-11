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
import sharp from "sharp";
import {
  analyzeContentPublishDelivery,
  createContentPublishDeliveryReceipt,
} from "../lib/content/publish-delivery.ts";

const publisherScriptPath = fileURLToPath(
  new URL("../scripts/publish-note.mjs", import.meta.url),
);
const reportScriptPath = fileURLToPath(
  new URL("../scripts/report-content-publish-delivery.mjs", import.meta.url),
);
const deliveryScriptPath = fileURLToPath(
  new URL("../scripts/deliver-content-publish.mjs", import.meta.url),
);

const oid = (value) => value.repeat(40);

function run(cwd, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 5_000_000,
    shell: false,
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

function git(cwd, ...args) {
  return run(cwd, "git", args).stdout.trim();
}

function runPublisher(root, ...args) {
  return run(
    root,
    process.execPath,
    [
      "--experimental-strip-types",
      publisherScriptPath,
      "content/inbox/obsidian-publishing.md",
      ...args,
    ],
    { allowFailure: true },
  );
}

function runReport(root, ...args) {
  return run(
    root,
    process.execPath,
    ["--experimental-strip-types", reportScriptPath, ...args],
    { allowFailure: true },
  );
}

function runDelivery(root, ...args) {
  return run(
    root,
    process.execPath,
    ["--experimental-strip-types", deliveryScriptPath, ...args],
    { allowFailure: true },
  );
}

function parseRecoveryDeliveryOutput(output) {
  const lines = output.trim().split(/\r?\n/u);
  const handoffLine = lines.at(-1);
  assert.match(handoffLine, /^\[post-delivery-handoff\] /u);
  return {
    receipt: JSON.parse(lines.slice(0, -1).join("\n")),
    handoff: JSON.parse(handoffLine.slice("[post-delivery-handoff] ".length)),
  };
}

function publishCommit({ changes, subject = "content: publish publish-proof" } = {}) {
  return {
    changes:
      changes ??
      [
        {
          newBlobOid: null,
          oldBlobOid: oid("d"),
          path: "content/inbox/publish-proof.md",
          status: "deleted",
        },
        {
          newBlobOid: oid("e"),
          oldBlobOid: null,
          path: "content/posts/publish-proof.md",
          status: "added",
        },
        {
          newBlobOid: oid("f"),
          oldBlobOid: null,
          path: "public/uploads/publish-proof/evidence.webp",
          status: "added",
        },
      ],
    commitOid: oid("b"),
    parentOids: [oid("a")],
    publication: {
      kind: "post",
      slug: "publish-proof",
      targetPath: "content/posts/publish-proof.md",
      title: "发布交付证明",
    },
    subject,
    treeOid: oid("c"),
  };
}

function analyze(overrides = {}) {
  return analyzeContentPublishDelivery({
    ahead: 1,
    behind: 0,
    currentBranch: "main",
    localHead: oid("b"),
    pendingCommit: publishCommit(),
    trackingHead: oid("a"),
    ...overrides,
  });
}

test("recognizes only an exact atomic publication bundle", () => {
  const report = analyze();
  assert.equal(report.relation.status, "pending-publication");
  assert.equal(report.pendingPublication.slug, "publish-proof");
  assert.equal(report.pendingPublication.kind, "post");
  assert.equal(
    report.pendingPublication.inboxSourcePath,
    "content/inbox/publish-proof.md",
  );
  assert.equal(report.pendingPublication.sourceDeletionTracked, true);
  assert.equal(report.pendingPublication.attachmentCount, 1);
  assert.equal(report.pendingPublication.targetBlobOid, oid("e"));
  assert.deepEqual(
    report.pendingPublication.changes.map(({ path, status }) => ({ path, status })),
    [
      { path: "content/inbox/publish-proof.md", status: "deleted" },
      { path: "content/posts/publish-proof.md", status: "added" },
      {
        path: "public/uploads/publish-proof/evidence.webp",
        status: "added",
      },
    ],
  );
  assert.deepEqual(report.recovery, {
    action: "push-pending-publication",
    autoExecuted: false,
    command: `git push origin ${oid("b")}:refs/heads/main`,
  });

  const untrackedSource = analyze({
    pendingCommit: publishCommit({
      changes: publishCommit().changes.filter(
        ({ path }) => path !== "content/inbox/publish-proof.md",
      ),
    }),
  });
  assert.equal(untrackedSource.relation.status, "pending-publication");
  assert.equal(untrackedSource.pendingPublication.sourceDeletionTracked, false);

  const videoAttachment = analyze({
    pendingCommit: publishCommit({
      changes: publishCommit().changes.map((change) =>
        change.path.endsWith("evidence.webp")
          ? { ...change, path: "public/uploads/publish-proof/evidence.mp4" }
          : change,
      ),
    }),
  });
  assert.equal(videoAttachment.relation.status, "pending-publication");
  assert.equal(videoAttachment.pendingPublication.attachmentCount, 1);
});

test("keeps ambiguous local commits out of publication recovery", () => {
  const cases = [
    publishCommit({ subject: "feat: publish something" }),
    publishCommit({
      changes: [
        ...publishCommit().changes,
        {
          newBlobOid: oid("9"),
          oldBlobOid: oid("8"),
          path: "scripts/unsafe.mjs",
          status: "modified",
        },
      ],
    }),
    publishCommit({
      changes: publishCommit().changes.map((change) =>
        change.path.includes("evidence.webp")
          ? {
              ...change,
              path: "public/uploads/another-slug/evidence.webp",
            }
          : change,
      ),
    }),
    publishCommit({
      changes: publishCommit().changes.map((change) =>
        change.path === "content/posts/publish-proof.md"
          ? { ...change, oldBlobOid: oid("7"), status: "modified" }
          : change,
      ),
    }),
  ];
  for (const pendingCommit of cases) {
    const report = analyze({ pendingCommit });
    assert.equal(report.relation.status, "local-ahead");
    assert.equal(report.pendingPublication, null);
    assert.equal(report.recovery.action, "inspect-git-state");
  }

  const stacked = analyze({ ahead: 2, pendingCommit: null });
  assert.equal(stacked.relation.status, "local-ahead");
  assert.equal(stacked.pendingPublication, null);
});

test("creates a receipt only for the same sealed publication envelope", () => {
  const before = analyze();
  const after = analyze({
    ahead: 0,
    behind: 0,
    localHead: oid("b"),
    pendingCommit: null,
    trackingHead: oid("b"),
  });
  const receipt = createContentPublishDeliveryReceipt({
    after,
    before,
    indexStable: true,
    manifestStable: true,
    worktreeStable: true,
  });
  assert.deepEqual(receipt, {
    version: 1,
    mode: "delivered",
    publication: before.pendingPublication,
    transition: {
      before: {
        localHead: oid("b"),
        relation: "pending-publication",
        trackingHead: oid("a"),
      },
      after: {
        localHead: oid("b"),
        relation: "synchronized",
        trackingHead: oid("b"),
      },
      command: `git push origin ${oid("b")}:refs/heads/main`,
    },
    safety: {
      fetchExecuted: false,
      headStable: true,
      indexStable: true,
      manifestStable: true,
      rebaseExecuted: false,
      resetExecuted: false,
      worktreeStable: true,
    },
  });

  const invalidCases = [
    { before: analyze({ currentBranch: "feature" }) },
    { before: analyze({ ahead: 2, pendingCommit: null }) },
    { after: analyze() },
    { indexStable: false },
    { manifestStable: false },
    { worktreeStable: false },
  ];
  for (const overrides of invalidCases) {
    assert.throws(() =>
      createContentPublishDeliveryReceipt({
        after,
        before,
        indexStable: true,
        manifestStable: true,
        worktreeStable: true,
        ...overrides,
      }),
    );
  }
});

const article = `---
title: "Obsidian 发布交付测试"
slug: obsidian-publishing
description: "验证新内容提交在 push 失败后仍可被精确识别并阻止重复发布。"
type: article
publishedAt: 2026-07-19
freshness: historical
reviewedAt: 2026-07-19
tags: ["Personal Knowledge", "Git"]
draft: true
featured: false
---

## 方法

正文图片 ![evidence](/uploads/obsidian-evidence.png)。
`;

async function createPublishFixture() {
  const root = await mkdtemp(join(tmpdir(), "myblog-publish-delivery-"));
  const remote = await mkdtemp(join(tmpdir(), "myblog-publish-remote-"));
  await Promise.all([
    mkdir(join(root, "content", "inbox"), { recursive: true }),
    mkdir(join(root, "content", "posts"), { recursive: true }),
    mkdir(join(root, "content", "projects"), { recursive: true }),
    mkdir(join(root, "public", "uploads"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      join(root, "package.json"),
      JSON.stringify({ scripts: { check: "node -e \"process.exit(0)\"" } }),
    ),
    writeFile(
      join(root, "content", "inbox", "obsidian-publishing.md"),
      article,
    ),
    writeFile(
      join(root, "public", "uploads", "obsidian-evidence.png"),
      await sharp({
        create: {
          width: 1200,
          height: 630,
          channels: 3,
          background: "#486f78",
        },
      })
        .png()
        .toBuffer(),
    ),
  ]);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Publish Delivery Test");
  git(root, "config", "user.email", "publish@example.test");
  git(root, "add", "package.json", "content/inbox/obsidian-publishing.md");
  git(root, "commit", "-m", "fixture: tracked draft");
  run(remote, "git", ["init", "--bare"]);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-u", "origin", "main");
  const baseHead = git(root, "rev-parse", "HEAD");
  const hookPath = join(remote, "hooks", "pre-receive");
  await writeFile(
    hookPath,
    "#!/bin/sh\necho 'publish delivery intentionally rejected' >&2\nexit 1\n",
  );
  await chmod(hookPath, 0o755);
  return { baseHead, hookPath, remote, root };
}

test("reports an exact failed publication push and blocks a second publish", async () => {
  const fixture = await createPublishFixture();
  try {
    const publish = runPublisher(fixture.root, "--push");
    assert.equal(publish.status, 1, `${publish.stdout}\n${publish.stderr}`);
    assert.match(
      `${publish.stdout}\n${publish.stderr}`,
      /发布提交已保留在本地.*content:publish:status/su,
    );
    const pendingHead = git(fixture.root, "rev-parse", "HEAD");
    assert.notEqual(pendingHead, fixture.baseHead);
    assert.equal(
      git(fixture.remote, "rev-parse", "refs/heads/main"),
      fixture.baseHead,
    );
    const stateBefore = {
      head: pendingHead,
      index: git(fixture.root, "write-tree"),
      worktree: git(fixture.root, "status", "--porcelain=v2"),
    };

    const status = runReport(fixture.root, "--format", "json");
    assert.equal(status.status, 1, `${status.stdout}\n${status.stderr}`);
    const report = JSON.parse(status.stdout);
    assert.equal(report.relation.status, "pending-publication");
    assert.equal(report.pendingPublication.commitOid, pendingHead);
    assert.equal(report.pendingPublication.parentOid, fixture.baseHead);
    assert.equal(report.pendingPublication.slug, "obsidian-publishing");
    assert.equal(
      report.pendingPublication.targetPath,
      "content/posts/obsidian-publishing.md",
    );
    assert.equal(report.pendingPublication.sourceDeletionTracked, true);
    assert.equal(report.pendingPublication.attachmentCount, 1);
    assert.deepEqual(
      report.pendingPublication.changes.map(({ path, status }) => ({ path, status })),
      [
        {
          path: "content/inbox/obsidian-publishing.md",
          status: "deleted",
        },
        {
          path: "content/posts/obsidian-publishing.md",
          status: "added",
        },
        {
          path: "public/uploads/obsidian-publishing/obsidian-evidence.webp",
          status: "added",
        },
      ],
    );
    assert.equal(
      report.recovery.command,
      `git push origin ${pendingHead}:refs/heads/main`,
    );
    assert.deepEqual(
      {
        head: git(fixture.root, "rev-parse", "HEAD"),
        index: git(fixture.root, "write-tree"),
        worktree: git(fixture.root, "status", "--porcelain=v2"),
      },
      stateBefore,
    );

    const repeated = runPublisher(fixture.root, "--push");
    assert.equal(repeated.status, 1, `${repeated.stdout}\n${repeated.stderr}`);
    assert.match(
      `${repeated.stdout}\n${repeated.stderr}`,
      /已有待同步新内容发布.*content\/posts\/obsidian-publishing\.md.*content:publish:status/su,
    );
    assert.doesNotMatch(`${repeated.stdout}\n${repeated.stderr}`, /找不到草稿/u);

    const rejectedDelivery = runDelivery(fixture.root, "--format", "json");
    assert.equal(
      rejectedDelivery.status,
      1,
      `${rejectedDelivery.stdout}\n${rejectedDelivery.stderr}`,
    );
    assert.match(
      `${rejectedDelivery.stdout}\n${rejectedDelivery.stderr}`,
      /本地发布提交保持不变/u,
    );
    assert.deepEqual(
      {
        head: git(fixture.root, "rev-parse", "HEAD"),
        index: git(fixture.root, "write-tree"),
        remote: git(fixture.remote, "rev-parse", "refs/heads/main"),
        worktree: git(fixture.root, "status", "--porcelain=v2"),
      },
      { ...stateBefore, remote: fixture.baseHead },
    );

    await rm(fixture.hookPath, { force: true });
    const delivered = runDelivery(
      fixture.root,
      "--format",
      "json",
      "--handoff",
    );
    assert.equal(delivered.status, 0, `${delivered.stdout}\n${delivered.stderr}`);
    const { handoff, receipt } = parseRecoveryDeliveryOutput(delivered.stdout);
    assert.equal(receipt.mode, "delivered");
    assert.equal(receipt.publication.commitOid, pendingHead);
    assert.equal(receipt.publication.changes.length, 3);
    assert.equal(
      receipt.transition.command,
      `git push origin ${pendingHead}:refs/heads/main`,
    );
    assert.deepEqual(receipt.safety, {
      fetchExecuted: false,
      headStable: true,
      indexStable: true,
      manifestStable: true,
      rebaseExecuted: false,
      resetExecuted: false,
      worktreeStable: true,
    });
    assert.equal(handoff.version, 1);
    assert.equal(handoff.mode, "post-delivery");
    assert.equal(handoff.delivery, "publication");
    assert.equal(handoff.commitOid, pendingHead);
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
    const synchronized = runReport(fixture.root, "--format", "json");
    assert.equal(
      synchronized.status,
      0,
      `${synchronized.stdout}\n${synchronized.stderr}`,
    );
    assert.equal(
      JSON.parse(synchronized.stdout).relation.status,
      "synchronized",
    );
    assert.equal(
      await readFile(
        join(fixture.root, "content", "posts", "obsidian-publishing.md"),
        "utf8",
      ).then((value) => value.includes("draft: false")),
      true,
    );
  } finally {
    await Promise.all([
      rm(fixture.root, { recursive: true, force: true }),
      rm(fixture.remote, { recursive: true, force: true }),
    ]);
  }
});

test("refuses an unseen non-fast-forward remote without changing the local envelope", async () => {
  const fixture = await createPublishFixture();
  const peerParent = await mkdtemp(join(tmpdir(), "myblog-publish-peer-"));
  const peer = join(peerParent, "peer");
  try {
    const publish = runPublisher(fixture.root, "--push");
    assert.equal(publish.status, 1, `${publish.stdout}\n${publish.stderr}`);
    const pendingHead = git(fixture.root, "rev-parse", "HEAD");
    await rm(fixture.hookPath, { force: true });

    run(peerParent, "git", ["clone", "-b", "main", fixture.remote, peer]);
    git(peer, "config", "user.name", "Remote Peer");
    git(peer, "config", "user.email", "peer@example.test");
    await writeFile(join(peer, "remote-note.txt"), "remote advance\n");
    git(peer, "add", "remote-note.txt");
    git(peer, "commit", "-m", "fixture: unseen remote advance");
    git(peer, "push", "origin", "main");
    const remoteHead = git(fixture.remote, "rev-parse", "refs/heads/main");

    const delivery = runDelivery(fixture.root, "--format", "json");
    assert.equal(delivery.status, 1, `${delivery.stdout}\n${delivery.stderr}`);
    assert.match(`${delivery.stdout}\n${delivery.stderr}`, /本地发布提交保持不变/u);
    assert.equal(git(fixture.root, "rev-parse", "HEAD"), pendingHead);
    assert.equal(git(fixture.remote, "rev-parse", "refs/heads/main"), remoteHead);
    assert.equal(
      git(fixture.root, "rev-parse", "refs/remotes/origin/main"),
      fixture.baseHead,
    );
    assert.equal(
      JSON.parse(runReport(fixture.root, "--format", "json").stdout)
        .relation.status,
      "pending-publication",
    );
  } finally {
    await Promise.all([
      rm(fixture.root, { recursive: true, force: true }),
      rm(fixture.remote, { recursive: true, force: true }),
      rm(peerParent, { recursive: true, force: true }),
    ]);
  }
});
