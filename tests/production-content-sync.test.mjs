import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

import { loadContentRepository } from "../build/validate-content.ts";
import {
  createContentManifestDocument,
} from "../lib/content-manifest.ts";
import { isPublished } from "../lib/content/contract.ts";
import {
  compareProductionContent,
  fetchProductionContentManifest,
  fetchProductionContentManifestConditional,
  formatProductionContentSyncText,
} from "../lib/content/production-sync.ts";

const execFileAsync = promisify(execFile);
const projectRoot = new URL("../", import.meta.url);

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

const project = {
  body: "## Project\n\nLocal project.",
  description: "Local project.",
  draft: false,
  featured: true,
  freshness: "current",
  kind: "project",
  publishedAt: "2026-08-08",
  readingMinutes: 1,
  reviewedAt: "2026-08-10",
  slug: "local-project",
  sourcePath: "content/projects/local-project.md",
  stack: ["TypeScript"],
  status: "maintained",
  tags: ["TypeScript"],
  title: "Local project",
  updatedAt: undefined,
  url: "/projects/local-project",
  wordCount: 3,
};

const missing = {
  ...post,
  publishedAt: "2026-08-07",
  slug: "missing-post",
  sourcePath: "content/posts/missing-post.md",
  title: "Missing post",
  url: "/posts/missing-post",
};

const unexpected = {
  ...post,
  body: "## Production only\n\nUnexpected.",
  publishedAt: "2026-08-06",
  slug: "unexpected-post",
  sourcePath: "content/posts/unexpected-post.md",
  title: "Unexpected post",
  url: "/posts/unexpected-post",
};

function sha256Etag(value) {
  return `"sha256-${createHash("sha256").update(value, "utf8").digest("hex")}"`;
}

function manifestResponse(manifest, headers = {}) {
  return new Response(`${JSON.stringify(manifest)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      etag: 'W/"sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      "last-modified": "Mon, 10 Aug 2026 00:00:00 GMT",
      ...headers,
    },
  });
}

async function snapshotFiles(directory) {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    result[entry.name] = await readFile(new URL(entry.name, directory));
  }
  return result;
}

test("classifies deployed, pending, missing, and unexpected production content", () => {
  const origin = new URL("https://blog.example.test/");
  const localRecords = [project, missing, post];
  const production = createContentManifestDocument(origin, [project, post, unexpected]);
  production.items.find((item) => item.id.endsWith("/local-project")).markdown_etag =
    '"sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"';

  const report = compareProductionContent({
    checkedAt: "2026-08-10T12:34:56.000Z",
    localBuildDate: "2026-08-10",
    localRecords,
    origin,
    production,
    productionEtag:
      'W/"sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
    productionLastModified: "Mon, 10 Aug 2026 00:00:00 GMT",
  });

  assert.equal(report.version, 1);
  assert.equal(report.mode, "read-only");
  assert.equal(report.status, "attention");
  assert.deepEqual(report.counts, {
    deployed: 1,
    pending: 1,
    missing: 1,
    unexpected: 1,
  });
  assert.deepEqual(
    report.records.map(({ state, sourcePath }) => [state, sourcePath]),
    [
      ["deployed", "content/posts/local-post.md"],
      ["pending", "content/projects/local-project.md"],
      ["missing", "content/posts/missing-post.md"],
      ["unexpected", null],
    ],
  );
  assert.deepEqual(report.records[0].differences, []);
  assert.deepEqual(report.records[1].differences, ["markdown-etag"]);
  assert.deepEqual(report.records[2].differences, ["missing-production"]);
  assert.deepEqual(report.records[3].differences, ["unexpected-production"]);
  assert.deepEqual(report.safety, {
    networkChecked: true,
    authorFilesChanged: false,
    commitCreated: false,
    pushExecuted: false,
  });
  assert.match(formatProductionContentSyncText(report), /1 已上线 · 1 待部署 · 1 生产缺失 · 1 生产多出/u);
});

test("accepts only a bounded, same-origin content manifest protocol", async (t) => {
  const origin = new URL("https://blog.example.test/");
  const valid = createContentManifestDocument(origin, [post]);

  const success = await fetchProductionContentManifest(origin, {
    fetchImpl: async () => manifestResponse(valid),
    timeoutMs: 100,
  });
  assert.equal(success.manifest.items.length, 1);
  assert.match(success.etag, /^W\/"sha256-/u);

  const cases = [
    [
      "redirect",
      async () => new Response(null, { status: 302, headers: { location: "https://other.test/content.json" } }),
      /必须返回 HTTP 200/u,
    ],
    [
      "content type",
      async () => manifestResponse(valid, { "content-type": "text/html" }),
      /Content-Type 必须是 application\/json/u,
    ],
    [
      "oversized",
      async () => manifestResponse(valid, { "content-length": "2000000" }),
      /超过 1048576 字节/u,
    ],
    [
      "malformed JSON",
      async () => new Response("{", {
        headers: {
          "content-type": "application/json",
          etag: '"sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
          "last-modified": "Mon, 10 Aug 2026 00:00:00 GMT",
        },
      }),
      /不是有效 JSON/u,
    ],
    [
      "unknown field",
      async () => manifestResponse({ ...valid, private: true }),
      /字段必须严格为/u,
    ],
    [
      "wrong origin",
      async () => manifestResponse({ ...valid, home_url: "https://other.test/" }),
      /home_url 必须是/u,
    ],
  ];

  for (const [name, fetchImpl, pattern] of cases) {
    await t.test(name, async () => {
      await assert.rejects(
        fetchProductionContentManifest(origin, { fetchImpl, timeoutMs: 100 }),
        pattern,
      );
    });
  }
});

test("times out without converting an unavailable deployment into content drift", async () => {
  const origin = new URL("https://blog.example.test/");
  await assert.rejects(
    fetchProductionContentManifest(origin, {
      fetchImpl: (_url, init) => new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
      timeoutMs: 5,
    }),
    /请求在 5ms 后超时/u,
  );
});

test("uses a matching If-None-Match validator and accepts only a strict 304", async (t) => {
  const origin = new URL("https://blog.example.test/");
  const validator =
    'W/"sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"';
  const result = await fetchProductionContentManifestConditional(origin, {
    fetchImpl: async (url, init) => {
      assert.equal(url.href, "https://blog.example.test/content.json");
      assert.equal(init.headers["if-none-match"], validator);
      return new Response(null, {
        status: 304,
        headers: {
          etag: '"sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
          "last-modified": "Mon, 10 Aug 2026 00:00:00 GMT",
        },
      });
    },
    ifNoneMatch: validator,
    timeoutMs: 100,
  });
  assert.deepEqual(result, {
    status: "not-modified",
    etag: '"sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
    lastModified: "Mon, 10 Aug 2026 00:00:00 GMT",
    manifest: null,
  });

  for (const [name, response, pattern] of [
    [
      "missing validator",
      new Response(null, {
        status: 304,
        headers: { "last-modified": "Mon, 10 Aug 2026 00:00:00 GMT" },
      }),
      /304 响应缺少受支持的 SHA-256 ETag/u,
    ],
    [
      "mismatched validator",
      new Response(null, {
        status: 304,
        headers: {
          etag: '"sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"',
          "last-modified": "Mon, 10 Aug 2026 00:00:00 GMT",
        },
      }),
      /304 响应 ETag 与条件请求不一致/u,
    ],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(
        fetchProductionContentManifestConditional(origin, {
          fetchImpl: async () => response,
          ifNoneMatch: validator,
          timeoutMs: 100,
        }),
        pattern,
      );
    });
  }
});

test("cancels a chunked production body as soon as the byte ceiling is crossed", async () => {
  const origin = new URL("https://blog.example.test/");
  let pulls = 0;
  let cancelled = false;
  const body = new ReadableStream(
    {
      cancel() {
        cancelled = true;
      },
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(600_000));
        if (pulls === 3) controller.close();
      },
    },
    { highWaterMark: 0 },
  );

  await assert.rejects(
    fetchProductionContentManifest(origin, {
      fetchImpl: async () => new Response(body, {
        headers: {
          "content-type": "application/json",
          etag: '"sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
          "last-modified": "Mon, 10 Aug 2026 00:00:00 GMT",
        },
      }),
      timeoutMs: 100,
    }),
    /超过 1048576 字节/u,
  );
  assert.equal(cancelled, true);
  assert.equal(pulls, 2);
});

test("the CLI checks a real HTTP manifest while leaving author files byte-stable", async (t) => {
  const rootPath = projectRoot.pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1));
  const buildDate = "2026-08-10";
  const buildTime = new Date(`${buildDate}T12:00:00Z`);
  const { posts, projects } = await loadContentRepository(rootPath);
  const records = [...posts, ...projects].filter((record) => isPublished(record, buildTime));
  const before = {
    posts: await snapshotFiles(new URL("../content/posts/", import.meta.url)),
    projects: await snapshotFiles(new URL("../content/projects/", import.meta.url)),
  };

  let origin;
  const server = createServer((request, response) => {
    assert.equal(request.url, "/content.json");
    assert.equal(request.headers.accept, "application/json");
    const body = `${JSON.stringify(createContentManifestDocument(origin, records), null, 2)}\n`;
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      etag: sha256Etag(body),
      "last-modified": "Mon, 10 Aug 2026 00:00:00 GMT",
    });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  origin = new URL(`http://127.0.0.1:${address.port}/`);

  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/report-production-content-sync.mjs",
      "--date",
      buildDate,
      "--format",
      "json",
      "--origin",
      origin.href,
      "--timeout-ms",
      "2000",
    ],
    { cwd: rootPath, timeout: 10_000, windowsHide: true },
  );
  assert.equal(stderr, "");
  const report = JSON.parse(stdout);
  assert.equal(report.status, "synchronized");
  assert.equal(report.counts.deployed, records.length);
  assert.deepEqual(
    {
      posts: await snapshotFiles(new URL("../content/posts/", import.meta.url)),
      projects: await snapshotFiles(new URL("../content/projects/", import.meta.url)),
    },
    before,
  );
  assert.deepEqual(report.safety, {
    networkChecked: true,
    authorFilesChanged: false,
    commitCreated: false,
    pushExecuted: false,
  });
});
