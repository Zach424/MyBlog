import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadValidatedRedirects } from "../build/validate-redirects.ts";
import {
  parseRedirectRegistry,
  toNextRedirects,
  validateRedirectRegistry,
} from "../lib/redirects.ts";

const context = {
  canonicalRoutes: new Set(["/", "/posts", "/posts/current", "/projects/myblog"]),
  currentRoutes: new Set([
    "/",
    "/posts",
    "/posts/current",
    "/projects/myblog",
    "/og.png",
  ]),
  reportDate: "2026-08-05",
};

function registry(redirects) {
  return { redirects, version: 1 };
}

function rule(source, destination = "/posts", overrides = {}) {
  return {
    addedAt: "2026-08-05",
    destination,
    reason: "迁移旧路径并保留外部链接价值",
    source,
    ...overrides,
  };
}

test("loads the repository registry and converts it to permanent Next redirects", async () => {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const rules = await loadValidatedRedirects(projectRoot, "2026-08-05");
  assert.deepEqual(rules, [
    {
      addedAt: "2026-08-05",
      destination: "/posts",
      reason: "将旧式通用博客入口统一到文章集合页",
      source: "/blog",
    },
  ]);
  assert.deepEqual(toNextRedirects(rules), [
    { destination: "/posts", permanent: true, source: "/blog" },
  ]);
});

test("accepts several direct legacy sources for one canonical target and sorts them", () => {
  const rules = validateRedirectRegistry(
    registry([rule("/old-b"), rule("/old-a")]),
    context,
  );
  assert.deepEqual(rules.map((entry) => entry.source), ["/old-a", "/old-b"]);
});

test("rejects non-literal, encoded, uppercase, and trailing-slash paths", () => {
  for (const source of [
    "posts/old",
    "/posts/Old",
    "/posts/old/",
    "/posts/:slug",
    "/posts/old?from=legacy",
    "/posts/old#history",
    "/posts/%6fold",
    "/posts/../old",
  ]) {
    assert.throws(
      () => validateRedirectRegistry(registry([rule(source)]), context),
      /source 必须是精确的小写 ASCII 站内路径|不能包含/u,
      source,
    );
  }
});

test("rejects duplicate sources, self redirects, and future provenance", () => {
  assert.throws(
    () => validateRedirectRegistry(registry([rule("/old"), rule("/old")]), context),
    /source 重复/u,
  );
  assert.throws(
    () => validateRedirectRegistry(registry([rule("/old", "/old")]), context),
    /不能重定向到自身/u,
  );
  assert.throws(
    () => validateRedirectRegistry(
      registry([rule("/old", "/posts", { addedAt: "2026-08-06" })]),
      context,
    ),
    /不能晚于构建日期/u,
  );
});

test("rejects current routes, public files, and protected namespaces as sources", () => {
  for (const source of [
    "/posts/current",
    "/og.png",
    "/api/legacy",
    "/studio/legacy",
    "/uploads/legacy.png",
    "/_next/legacy.js",
  ]) {
    assert.throws(
      () => validateRedirectRegistry(registry([rule(source)]), context),
      /覆盖当前有效路由|保留命名空间/u,
      source,
    );
  }
});

test("rejects destinations that are absent, draft, future, operational, or static", () => {
  for (const destination of [
    "/posts/missing",
    "/posts/draft",
    "/studio",
    "/rss.xml",
    "/og.png",
  ]) {
    assert.throws(
      () => validateRedirectRegistry(registry([rule("/old", destination)]), context),
      /destination 不是当前公开 HTML 路由/u,
      destination,
    );
  }
});

test("rejects redirect chains and cycles before target lookup", () => {
  assert.throws(
    () => validateRedirectRegistry(
      registry([rule("/old-a", "/old-b"), rule("/old-b", "/posts")]),
      context,
    ),
    /只允许单跳永久重定向/u,
  );
  assert.throws(
    () => validateRedirectRegistry(
      registry([rule("/old-a", "/old-b"), rule("/old-b", "/old-a")]),
      context,
    ),
    /形成循环/u,
  );
});

test("rejects malformed YAML, unknown fields, duplicate keys, and weak reasons", async () => {
  for (const raw of [
    "version: 1\nredirects: [",
    "version: 1\nredirects:\n  - source: /old\n    source: /other\n    destination: /posts\n    addedAt: 2026-08-05\n    reason: 足够长度的迁移原因",
    "version: 1\nredirects:\n  - source: /old\n    destination: /posts\n    addedAt: 2026-08-05\n    reason: 太短\n    extra: false",
  ]) {
    assert.throws(() => parseRedirectRegistry("content/redirects.yml", raw));
  }

  const source = await readFile(
    new URL("../content/redirects.yml", import.meta.url),
    "utf8",
  );
  assert.equal(parseRedirectRegistry("content/redirects.yml", source).version, 1);
});
