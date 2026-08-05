import assert from "node:assert/strict";
import test from "node:test";
import { createStudioConfig } from "../studio/config.mjs";
import {
  getStudioEntryPreflightStatus,
  requestStudioEntryPreflight,
  serializeStudioEntry,
  studioEntryFieldLabel,
  studioEntrySignature,
  STUDIO_ENTRY_FIELDS,
  STUDIO_ENTRY_PREFLIGHT_DELAY_MS,
  STUDIO_ENTRY_PREFLIGHT_ENDPOINT,
} from "../studio/entry-preflight.mjs";
import { inspectStudioEntryPreflight } from "../lib/studio-entry-preflight.ts";

function entry(data) {
  return {
    getIn(path) {
      return path[0] === "data" ? data[path[1]] : undefined;
    },
  };
}

function validPost(overrides = {}) {
  return {
    body: "## 结论\n\n这是一段经过校验的正文。",
    canonical: "https://example.com/original",
    description: "说明这篇文章会给读者带来什么。",
    draft: false,
    featured: false,
    freshness: "current",
    publishedAt: "2026-08-01",
    reviewedAt: "2026-08-05",
    slug: "author-proof",
    tags: ["TypeScript", "Personal Knowledge"],
    title: "Author Proof 发布清单",
    type: "article",
    ...overrides,
  };
}

function validProject(overrides = {}) {
  return {
    body: "## 目标\n\n记录项目约束与实现证据。",
    description: "说明项目解决的问题以及得到的经验。",
    draft: true,
    featured: false,
    freshness: "historical",
    publishedAt: "2026-08-01",
    repository: "https://github.com/Zach424/MyBlog",
    reviewedAt: "2026-08-01",
    slug: "project-proof",
    stack: ["TypeScript", "Next.js"],
    status: "building",
    tags: ["TypeScript", "Next.js"],
    title: "项目发布清单",
    ...overrides,
  };
}

test("keeps the Studio allowlist aligned with both collection contracts", () => {
  const config = createStudioConfig("https://blog.example.test");
  for (const collection of config.collections) {
    assert.deepEqual(
      [...STUDIO_ENTRY_FIELDS[collection.name]].sort(),
      collection.fields.map((field) => field.name).sort(),
    );
  }
  assert.equal(STUDIO_ENTRY_PREFLIGHT_ENDPOINT, "/studio/entry-preflight");
  assert.equal(STUDIO_ENTRY_PREFLIGHT_DELAY_MS, 320);
});

test("serializes only allowlisted fields and normalizes Decap values", () => {
  const props = {
    entry: entry({
      ...validPost(),
      canonical: "",
      reviewedAt: new Date(2026, 7, 5),
      secretToken: "must-not-leave-the-browser",
      tags: { toJS: () => ["TypeScript", "React"] },
    }),
  };
  const fields = serializeStudioEntry(props, "posts");

  assert.equal(fields.reviewedAt, "2026-08-05");
  assert.deepEqual(fields.tags, ["TypeScript", "React"]);
  assert.equal("canonical" in fields, false);
  assert.equal("secretToken" in fields, false);
  assert.equal(studioEntrySignature(props, "posts"), JSON.stringify(fields));
  assert.equal(studioEntryFieldLabel("series.order"), "专题");
});

test("reuses the production contract for valid posts and projects", () => {
  const post = inspectStudioEntryPreflight("posts", validPost(), new Date("2026-08-05T12:00:00Z"));
  const project = inspectStudioEntryPreflight("projects", validProject(), new Date("2026-08-05T12:00:00Z"));

  assert.equal(post.ok, true);
  assert.equal(post.issueCount, 0);
  assert.deepEqual(post.facts.map((fact) => fact.label), ["PATH", "VISIBILITY", "CONTEXT", "BODY"]);
  assert.equal(post.facts[0].value, "/posts/author-proof");
  assert.match(post.note, /完整构建仍会在保存后验证/u);
  assert.equal(project.ok, true);
  assert.match(project.facts[1].value, /草稿 · 不公开/u);
});

test("returns cross-field, freshness, URL, tag and body issues together", () => {
  const result = inspectStudioEntryPreflight(
    "posts",
    validPost({
      body: "错误公式 $\\frac{1$",
      canonical: "http://example.com",
      draft: true,
      featured: true,
      freshness: "current",
      publishedAt: "2026-08-04",
      reviewedAt: "2025-01-01",
      slug: "Bad Slug",
      tags: ["TypeScript", "Unknown Tag"],
    }),
    new Date("2026-08-05T12:00:00Z"),
  );

  assert.equal(result.ok, false);
  for (const field of ["body", "canonical", "featured", "reviewedAt", "slug", "tags"]) {
    assert.ok(result.issues.some((issue) => issue.field === field), field);
  }
  assert.match(result.note, new RegExp(`发现 ${result.issueCount} 项字段问题`, "u"));
});

test("applies current-content age and future-review boundaries in the author timezone", () => {
  const stale = inspectStudioEntryPreflight(
    "posts",
    validPost({ publishedAt: "2025-01-01", reviewedAt: "2025-01-01" }),
    new Date("2026-08-05T12:00:00Z"),
  );
  const future = inspectStudioEntryPreflight(
    "posts",
    validPost({ reviewedAt: "2026-08-06" }),
    new Date("2026-08-05T12:00:00Z"),
  );

  assert.ok(stale.issues.some((issue) => issue.field === "reviewedAt" && /超过 180 天未复核/u.test(issue.message)));
  assert.ok(future.issues.some((issue) => issue.field === "reviewedAt" && /不能晚于构建日期 2026-08-05/u.test(issue.message)));
});

test("posts the full allowlisted entry to the same-origin endpoint", async () => {
  const calls = [];
  const result = await requestStudioEntryPreflight("posts", validPost(), {
    fetcher: async (url, options) => {
      calls.push({ options, url });
      return {
        json: async () => ({ facts: [], issueCount: 0, issues: [], note: "ok", ok: true }),
        ok: true,
        status: 200,
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].url, STUDIO_ENTRY_PREFLIGHT_ENDPOINT);
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    collection: "posts",
    fields: validPost(),
  });
  assert.equal(getStudioEntryPreflightStatus({ entryStatus: "ready", entryNote: "ok" }).label, "ENTRY CONTRACT / READY");
  assert.equal(getStudioEntryPreflightStatus({ entryStatus: "unavailable" }).label, "ENTRY CONTRACT / PREVIEW UNAVAILABLE");
});
