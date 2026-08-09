import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";
import test from "node:test";

import { loadContentRepository } from "../build/validate-content.ts";
import { createContentManifestDocument } from "../lib/content-manifest.ts";
import { isPublished } from "../lib/content/contract.ts";
import {
  createProductionContentConvergenceTarget,
  formatProductionContentConvergenceText,
  ProductionContentConvergenceCancelledError,
  waitForProductionContentConvergence,
} from "../lib/content/production-convergence.ts";

const execFileAsync = promisify(execFile);
const projectRoot = new URL("../", import.meta.url);
const origin = new URL("https://blog.example.test/");
const sourceSha256 = createHash("sha256").update("stable source").digest("hex");
const manifestEtagA =
  'W/"sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"';
const manifestEtagB =
  'W/"sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"';
const lastModified = "Mon, 10 Aug 2026 00:00:00 GMT";

const post = {
  body: "## Local source\n\nStable content.",
  canonical: undefined,
  description: "Local post.",
  draft: false,
  featured: false,
  freshness: "current",
  kind: "post",
  publishedAt: "2026-08-09",
  readingMinutes: 1,
  reviewedAt: "2026-08-10",
  slug: "local-post",
  sourcePath: "content/posts/local-post.md",
  tags: ["TypeScript"],
  title: "Local post",
  type: "article",
  updatedAt: "2026-08-10",
  url: "/posts/local-post",
  wordCount: 4,
};

const unexpected = {
  ...post,
  body: "## Production only\n\nUnexpected.",
  publishedAt: "2026-08-08",
  slug: "production-only",
  sourcePath: "content/posts/production-only.md",
  title: "Production only",
  url: "/posts/production-only",
};

function modified(records, etag = manifestEtagA) {
  return {
    status: "modified",
    etag,
    lastModified,
    manifest: createContentManifestDocument(origin, records),
  };
}

function target() {
  return createProductionContentConvergenceTarget({
    localRecords: [post],
    origin,
    sourcePath: post.sourcePath,
    sourceSha256,
  });
}

function clockHarness() {
  let value = Date.parse("2026-08-10T12:00:00.000Z");
  return {
    now: () => value,
    sleep: async (milliseconds) => {
      value += milliseconds;
    },
  };
}

async function snapshotFiles(directory) {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    result[entry.name] = await readFile(new URL(entry.name, directory));
  }
  return result;
}

test("waits only for the frozen source and reuses a strict conditional snapshot", async () => {
  const clock = clockHarness();
  const requestedValidators = [];
  const progress = [];
  const responses = [
    modified([]),
    {
      status: "not-modified",
      etag: manifestEtagA,
      lastModified,
      manifest: null,
    },
    modified([post], manifestEtagB),
  ];

  const report = await waitForProductionContentConvergence({
    fetchManifest: async (_origin, options) => {
      requestedValidators.push(options.ifNoneMatch);
      return responses.shift();
    },
    intervalMs: 100,
    localBuildDate: "2026-08-10",
    localRecords: [post],
    now: clock.now,
    onProgress: (observation) => progress.push(observation),
    origin,
    readSourceSha256: async () => sourceSha256,
    requestTimeoutMs: 50,
    sleep: clock.sleep,
    target: target(),
    timeoutMs: 1_000,
  });

  assert.deepEqual(requestedValidators, [undefined, manifestEtagA, manifestEtagA]);
  assert.equal(report.version, 1);
  assert.equal(report.mode, "read-only");
  assert.equal(report.status, "deployed");
  assert.equal(report.attemptCount, 3);
  assert.deepEqual(
    report.observations.map(({ response, state }) => [response, state]),
    [
      ["modified", "missing"],
      ["not-modified", "missing"],
      ["modified", "deployed"],
    ],
  );
  assert.deepEqual(progress, report.observations);
  assert.equal(report.target.sourcePath, post.sourcePath);
  assert.equal(report.target.sourceSha256, sourceSha256);
  assert.equal(report.target.localEtag, report.observations.at(-1).productionEtag);
  assert.deepEqual(report.safety, {
    networkChecked: true,
    sourceFrozen: true,
    authorFilesChanged: false,
    commitCreated: false,
    pushExecuted: false,
  });
  assert.match(formatProductionContentConvergenceText(report), /DEPLOYED.*3 次尝试/su);
});

test("fails immediately when the exact source bytes drift during the wait", async () => {
  const clock = clockHarness();
  let reads = 0;
  let fetches = 0;

  await assert.rejects(
    waitForProductionContentConvergence({
      fetchManifest: async () => {
        fetches += 1;
        return modified([]);
      },
      intervalMs: 100,
      localBuildDate: "2026-08-10",
      localRecords: [post],
      now: clock.now,
      origin,
      readSourceSha256: async () => {
        reads += 1;
        return reads < 3 ? sourceSha256 : "f".repeat(64);
      },
      requestTimeoutMs: 50,
      sleep: clock.sleep,
      target: target(),
      timeoutMs: 1_000,
    }),
    /来源字节在等待期间发生变化/u,
  );
  assert.equal(fetches, 1);
});

test("fails closed on production-only records instead of waiting through drift", async () => {
  const clock = clockHarness();
  await assert.rejects(
    waitForProductionContentConvergence({
      fetchManifest: async () => modified([post, unexpected]),
      intervalMs: 100,
      localBuildDate: "2026-08-10",
      localRecords: [post],
      now: clock.now,
      origin,
      readSourceSha256: async () => sourceSha256,
      requestTimeoutMs: 50,
      sleep: clock.sleep,
      target: target(),
      timeoutMs: 1_000,
    }),
    /生产清单包含 1 条生产多出记录/u,
  );
});

test("returns a bounded timeout receipt without writing, committing, or pushing", async () => {
  const clock = clockHarness();
  const report = await waitForProductionContentConvergence({
    fetchManifest: async () => modified([]),
    intervalMs: 100,
    localBuildDate: "2026-08-10",
    localRecords: [post],
    now: clock.now,
    origin,
    readSourceSha256: async () => sourceSha256,
    requestTimeoutMs: 50,
    sleep: clock.sleep,
    target: target(),
    timeoutMs: 250,
  });

  assert.equal(report.status, "timeout");
  assert.equal(report.elapsedMs, 250);
  assert.equal(report.attemptCount, 3);
  assert.equal(report.observations.at(-1).remainingMs, 50);
  assert.match(formatProductionContentConvergenceText(report), /TIMEOUT.*生产缺失/su);
});

test("honors caller cancellation before another production request", async () => {
  const clock = clockHarness();
  const controller = new AbortController();
  let fetches = 0;

  await assert.rejects(
    waitForProductionContentConvergence({
      fetchManifest: async () => {
        fetches += 1;
        return modified([]);
      },
      intervalMs: 100,
      localBuildDate: "2026-08-10",
      localRecords: [post],
      now: clock.now,
      origin,
      readSourceSha256: async () => sourceSha256,
      requestTimeoutMs: 50,
      signal: controller.signal,
      sleep: async (milliseconds) => {
        await clock.sleep(milliseconds);
        controller.abort();
      },
      target: target(),
      timeoutMs: 1_000,
    }),
    (error) => error instanceof ProductionContentConvergenceCancelledError,
  );
  assert.equal(fetches, 1);
});

test("rejects unsafe or unpublished source targeting before network access", async () => {
  assert.throws(
    () => createProductionContentConvergenceTarget({
      localRecords: [post],
      origin,
      sourcePath: "../content/posts/local-post.md",
      sourceSha256,
    }),
    /来源必须是安全的 content\/posts 或 content\/projects/u,
  );
  assert.throws(
    () => createProductionContentConvergenceTarget({
      localRecords: [],
      origin,
      sourcePath: post.sourcePath,
      sourceSha256,
    }),
    /不在本地公开范围/u,
  );
});

test("the CLI waits through missing and 304 snapshots while author files stay byte-stable", async (t) => {
  const rootPath = projectRoot.pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1));
  const buildDate = "2026-08-10";
  const buildTime = new Date(`${buildDate}T12:00:00.000Z`);
  const { posts, projects } = await loadContentRepository(rootPath);
  const records = [...posts, ...projects].filter((record) => isPublished(record, buildTime));
  const targetRecord = records.find(
    (record) => record.sourcePath === "content/posts/building-a-maintainable-blog.md",
  );
  assert.ok(targetRecord);
  const before = {
    posts: await snapshotFiles(new URL("../content/posts/", import.meta.url)),
    projects: await snapshotFiles(new URL("../content/projects/", import.meta.url)),
  };
  const requestValidators = [];
  let requestCount = 0;
  let serverOrigin;
  const server = createServer((request, response) => {
    requestCount += 1;
    assert.equal(request.url, "/content.json");
    assert.equal(request.headers.accept, "application/json");
    requestValidators.push(request.headers["if-none-match"]);
    if (requestCount === 2) {
      response.writeHead(304, {
        etag: manifestEtagA,
        "last-modified": lastModified,
      });
      response.end();
      return;
    }
    const snapshotRecords = requestCount === 1
      ? records.filter((record) => record.sourcePath !== targetRecord.sourcePath)
      : records;
    const body = `${JSON.stringify(
      createContentManifestDocument(serverOrigin, snapshotRecords),
      null,
      2,
    )}\n`;
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      etag: requestCount === 1 ? manifestEtagA : manifestEtagB,
      "last-modified": lastModified,
    });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  serverOrigin = new URL(`http://127.0.0.1:${address.port}/`);
  const targetSourceBytes = await readFile(
    new URL(`../${targetRecord.sourcePath}`, import.meta.url),
  );
  const frozenTarget = createProductionContentConvergenceTarget({
    localRecords: records,
    origin: serverOrigin,
    sourcePath: targetRecord.sourcePath,
    sourceSha256: createHash("sha256").update(targetSourceBytes).digest("hex"),
  });

  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/wait-production-content-convergence.mjs",
      "--source",
      targetRecord.sourcePath,
      "--date",
      buildDate,
      "--format",
      "json",
      "--origin",
      serverOrigin.href,
      "--timeout-ms",
      "5000",
      "--interval-ms",
      "250",
      "--request-timeout-ms",
      "2000",
      "--expected-source-sha256",
      frozenTarget.sourceSha256,
      "--expected-local-etag-sha256",
      frozenTarget.localEtag.slice(8, -1),
    ],
    { cwd: rootPath, timeout: 15_000, windowsHide: true },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.status, "deployed");
  assert.equal(report.attemptCount, 3);
  assert.equal(report.target.sourcePath, targetRecord.sourcePath);
  assert.deepEqual(requestValidators, [undefined, manifestEtagA, manifestEtagA]);
  assert.equal(
    stderr.trim().split(/\r?\n/u).every((line) =>
      line.startsWith("[production-convergence-progress] "),
    ),
    true,
  );
  assert.deepEqual(
    {
      posts: await snapshotFiles(new URL("../content/posts/", import.meta.url)),
      projects: await snapshotFiles(new URL("../content/projects/", import.meta.url)),
    },
    before,
  );

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        "scripts/wait-production-content-convergence.mjs",
        "--source",
        targetRecord.sourcePath,
        "--date",
        buildDate,
        "--origin",
        serverOrigin.href,
        "--timeout-ms",
        "5000",
        "--interval-ms",
        "250",
        "--request-timeout-ms",
        "2000",
        "--expected-source-sha256",
        "f".repeat(64),
        "--expected-local-etag-sha256",
        frozenTarget.localEtag.slice(8, -1),
      ],
      { cwd: rootPath, timeout: 15_000, windowsHide: true },
    ),
    (error) =>
      error.code === 1 &&
      /post-delivery handoff 冻结目标不一致/u.test(error.stderr),
  );
  assert.equal(requestCount, 3);
});
