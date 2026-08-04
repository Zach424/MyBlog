import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createStagingMediaReport,
  formatStagingMediaAnnotations,
  formatStagingMediaMarkdown,
  formatStagingMediaText,
  inspectStagingMediaRepository,
} from "../lib/content/staging-media.ts";

const reporterPath = fileURLToPath(
  new URL("../scripts/report-staging-media.mjs", import.meta.url),
);

function evidence({
  ageDays = 1,
  ageSource = "git",
  gitState = "clean",
  lastChangedAt = "2026-07-31",
  lastGitChangedAt = "2026-07-31",
} = {}) {
  return {
    ageDays,
    ageSource,
    gitState,
    lastChangedAt,
    ...(lastGitChangedAt ? { lastGitChangedAt } : {}),
  };
}

function runGit(root, args, env = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
    shell: false,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result;
}

async function createRepositoryFixture() {
  const root = await mkdtemp(join(tmpdir(), "myblog-staging-media-"));
  await Promise.all([
    mkdir(join(root, "content", "inbox"), { recursive: true }),
    mkdir(join(root, "public", "uploads"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(root, "public", "uploads", "active.png"), "active"),
    writeFile(join(root, "public", "uploads", "orphan.png"), "orphan"),
    writeFile(
      join(root, "content", "inbox", "draft-one.md"),
      `![[active.png|有效引用]]

![缺失](/uploads/missing.png)

![非法但不应丢失其他引用](/private/unsafe.png)

\`\`\`md
![[ignored.png]]
\`\`\``,
    ),
  ]);
  runGit(root, ["init", "-b", "main"]);
  runGit(root, ["config", "user.name", "Staging Test"]);
  runGit(root, ["config", "user.email", "staging@example.test"]);
  runGit(root, ["add", "."]);
  runGit(root, ["commit", "-m", "fixture"], {
    GIT_AUTHOR_DATE: "2026-01-01T12:00:00Z",
    GIT_COMMITTER_DATE: "2026-01-01T12:00:00Z",
  });

  await Promise.all([
    writeFile(join(root, "public", "uploads", "local.jpg"), "local"),
    writeFile(
      join(root, "content", "inbox", "draft-two.md"),
      "![本地观察](/uploads/local.jpg)",
    ),
    writeFile(join(root, "content", "inbox", "Bad Draft.md"), "未进入可发布命名。"),
  ]);
  const observedAt = new Date("2026-02-10T12:00:00Z");
  await utimes(join(root, "public", "uploads", "local.jpg"), observedAt, observedAt);
  return root;
}

test("classifies referenced, shared, unreferenced, stale, and missing staging media", () => {
  const report = createStagingMediaReport(
    [
      {
        bytes: 100,
        evidence: evidence({ ageDays: 10 }),
        path: "public/uploads/active.png",
      },
      {
        bytes: 200,
        evidence: evidence({
          ageDays: 40,
          ageSource: "filesystem",
          gitState: "untracked",
          lastChangedAt: "2026-06-22",
          lastGitChangedAt: undefined,
        }),
        path: "public/uploads/orphan.png",
      },
      {
        bytes: 300,
        evidence: evidence(),
        path: "public/uploads/shared.png",
      },
    ],
    [
      { draftPath: "content/inbox/a.md", mediaPath: "public/uploads/active.png" },
      { draftPath: "content/inbox/a.md", mediaPath: "public/uploads/shared.png" },
      { draftPath: "content/inbox/b.md", mediaPath: "public/uploads/shared.png" },
      { draftPath: "content/inbox/a.md", mediaPath: "public/uploads/missing.png" },
    ],
    "2026-08-01",
    {
      draftIssues: [{
        draftPath: "content/inbox/Bad Draft.md",
        message: "草稿文件名无效",
      }],
      staleAfterDays: 30,
    },
  );

  assert.deepEqual(report.entries.map((entry) => entry.status), [
    "shared",
    "unreferenced",
    "referenced",
  ]);
  assert.deepEqual(report.counts, {
    attention: 4,
    files: 3,
    invalidDrafts: 1,
    missing: 1,
    referenced: 1,
    shared: 1,
    stale: 1,
    unreferenced: 1,
  });
  assert.equal(report.totalBytes, 600);
  assert.deepEqual(report.missingReferences, [{
    draftSources: ["content/inbox/a.md"],
    path: "public/uploads/missing.png",
  }]);
  assert.match(report.entries[0].recommendation, /各自独立文件/u);
  assert.match(report.entries[1].recommendation, /不会自动清理/u);
});

test("inspects Git dates for clean files and filesystem dates for local files", async () => {
  const root = await createRepositoryFixture();
  try {
    const report = await inspectStagingMediaRepository(root, "2026-02-15", {
      staleAfterDays: 30,
    });
    const byPath = Object.fromEntries(report.entries.map((entry) => [entry.path, entry]));

    assert.equal(byPath["public/uploads/active.png"].status, "referenced");
    assert.equal(byPath["public/uploads/active.png"].evidence.ageSource, "git");
    assert.equal(byPath["public/uploads/active.png"].evidence.lastChangedAt, "2026-01-01");
    assert.equal(byPath["public/uploads/active.png"].evidence.ageDays, 45);
    assert.equal(byPath["public/uploads/orphan.png"].status, "unreferenced");
    assert.equal(byPath["public/uploads/local.jpg"].status, "referenced");
    assert.equal(byPath["public/uploads/local.jpg"].evidence.ageSource, "filesystem");
    assert.equal(byPath["public/uploads/local.jpg"].evidence.gitState, "untracked");
    assert.equal(byPath["public/uploads/local.jpg"].evidence.lastChangedAt, "2026-02-10");
    assert.deepEqual(report.missingReferences, [{
      draftSources: ["content/inbox/draft-one.md"],
      path: "public/uploads/missing.png",
    }]);
    assert.equal(report.draftIssues.length, 2);
    assert.deepEqual(report.draftIssues.map((issue) => issue.draftPath), [
      "content/inbox/Bad Draft.md",
      "content/inbox/draft-one.md",
    ]);
    assert.match(report.draftIssues[1].message, /必须位于 public\/uploads/u);
    assert.equal(report.entries.some((entry) => entry.path.endsWith("ignored.png")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("formats local, JSON-source, Actions summary, and warning evidence without deletion", () => {
  const report = createStagingMediaReport(
    [{
      bytes: 2048,
      evidence: evidence({ ageDays: 45 }),
      path: "public/uploads/orphan.png",
    }],
    [],
    "2026-08-01",
  );
  const text = formatStagingMediaText(report);
  const markdown = formatStagingMediaMarkdown(report);
  const annotations = formatStagingMediaAnnotations(report);

  assert.match(text, /未引用 \/ 陈旧.*orphan\.png.*2\.0 KiB/u);
  assert.match(text, /不会自动删除文件/u);
  assert.match(markdown, /## Staging media inventory/u);
  assert.match(markdown, /只提供证据与建议，不会自动删除/u);
  assert.equal(annotations.length, 1);
  assert.match(annotations[0], /^::warning file=public\/uploads\/orphan\.png/u);
});

test("runs the real CLI with fixed JSON output and leaves every file untouched", async () => {
  const root = await createRepositoryFixture();
  try {
    const before = await readFile(join(root, "public", "uploads", "orphan.png"));
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        reporterPath,
        "--date",
        "2026-02-15",
        "--format",
        "json",
      ],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.counts.files, 3);
    assert.equal(report.counts.missing, 1);
    assert.equal(report.counts.invalidDrafts, 2);
    assert.deepEqual(
      await readFile(join(root, "public", "uploads", "orphan.png")),
      before,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writes a GitHub summary while keeping attention findings non-blocking", async () => {
  const root = await createRepositoryFixture();
  const summaryPath = join(root, "summary.md");
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        reporterPath,
        "--date",
        "2026-02-15",
        "--github-summary",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath },
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /::warning file=/u);
    assert.match(await readFile(summaryPath, "utf8"), /Staging media inventory/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
