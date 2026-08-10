import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createContentManifest,
  createContentManifestResponse,
} from "../lib/content-manifest.ts";
import { createPublicMarkdown } from "../lib/public-markdown.ts";

const post = {
  body: "## Source export\n\n[Project](/projects/myblog).",
  canonical: "https://origin.example/portable-source",
  description: "A portable public Markdown record.",
  draft: false,
  featured: true,
  freshness: "current",
  kind: "post",
  publishedAt: "2026-08-09",
  reviewedAt: "2026-08-10",
  slug: "portable-source",
  sourcePath: "content/posts/portable-source.md",
  tags: ["TypeScript", "Obsidian"],
  title: "Portable source",
  type: "article",
  updatedAt: "2026-08-10",
  url: "/posts/portable-source",
};

const project = {
  body: "## Project source\n\nSee [the article](/posts/portable-source).",
  description: "A public project source.",
  draft: false,
  featured: true,
  freshness: "historical",
  kind: "project",
  publishedAt: "2026-08-01",
  reviewedAt: "2026-08-09",
  slug: "source-project",
  sourcePath: "content/projects/source-project.md",
  stack: ["TypeScript", "Next.js"],
  status: "maintained",
  tags: ["TypeScript"],
  title: "Source project",
  url: "/projects/source-project",
};

function sha256Etag(body) {
  return `"sha256-${createHash("sha256").update(body, "utf8").digest("hex")}"`;
}

test("creates a deterministic public content manifest from an exact allowlist", () => {
  const siteUrl = new URL("https://blog.example.test");
  const records = [project, post];
  const source = createContentManifest(siteUrl, records);
  const manifest = JSON.parse(source);

  assert.equal(source.endsWith("\n"), true);
  assert.deepEqual(Object.keys(manifest), [
    "version",
    "home_url",
    "manifest_url",
    "language",
    "items",
  ]);
  assert.equal(manifest.version, 1);
  assert.equal(manifest.home_url, "https://blog.example.test/");
  assert.equal(manifest.manifest_url, "https://blog.example.test/content.json");
  assert.equal(manifest.language, "zh-CN");
  assert.deepEqual(records, [project, post], "清单生成不能改变调用方顺序");
  assert.deepEqual(
    manifest.items.map((item) => item.id),
    [
      "https://blog.example.test/posts/portable-source",
      "https://blog.example.test/projects/source-project",
    ],
  );

  const [postItem, projectItem] = manifest.items;
  assert.deepEqual(Object.keys(postItem), [
    "id",
    "kind",
    "type",
    "title",
    "html_url",
    "markdown_url",
    "markdown_etag",
    "published_at",
    "updated_at",
    "reviewed_at",
    "tags",
  ]);
  assert.equal(postItem.kind, "post");
  assert.equal(postItem.type, "article");
  assert.equal(postItem.id, postItem.html_url);
  assert.equal(
    postItem.markdown_url,
    "https://blog.example.test/posts/portable-source/source.md",
  );
  assert.equal(
    postItem.markdown_etag,
    sha256Etag(createPublicMarkdown(siteUrl, post)),
  );
  assert.equal(postItem.published_at, "2026-08-09");
  assert.equal(postItem.updated_at, "2026-08-10");
  assert.equal(postItem.reviewed_at, "2026-08-10");
  assert.deepEqual(postItem.tags, ["TypeScript", "Obsidian"]);

  assert.deepEqual(Object.keys(projectItem), [
    "id",
    "kind",
    "type",
    "title",
    "html_url",
    "markdown_url",
    "markdown_etag",
    "published_at",
    "reviewed_at",
    "tags",
  ]);
  assert.equal(projectItem.kind, "project");
  assert.equal(projectItem.type, "project");
  assert.equal("updated_at" in projectItem, false);
  for (const privateField of [
    "body",
    "canonical",
    "description",
    "draft",
    "featured",
    "slug",
    "sourcePath",
  ]) {
    assert.equal(privateField in postItem, false, privateField);
    assert.equal(privateField in projectItem, false, privateField);
  }
});

test("binds manifest URLs and Markdown validators to the requested origin", () => {
  const first = JSON.parse(
    createContentManifest(new URL("https://blog.example.test"), [post, project]),
  );
  const second = JSON.parse(
    createContentManifest(new URL("https://mirror.example"), [post, project]),
  );

  assert.deepEqual(
    first.items.map((item) => item.kind),
    second.items.map((item) => item.kind),
  );
  for (const [index, item] of first.items.entries()) {
    assert.notEqual(item.html_url, second.items[index].html_url);
    assert.notEqual(item.markdown_url, second.items[index].markdown_url);
    assert.notEqual(item.markdown_etag, second.items[index].markdown_etag);
  }
});

test("returns a cache-safe conditional manifest response", async () => {
  const url = "https://blog.example.test/content.json";
  const baseline = createContentManifestResponse(new Request(url), [project, post]);
  const body = await baseline.text();
  const etag = baseline.headers.get("etag");

  assert.equal(baseline.status, 200);
  assert.equal(etag, sha256Etag(body));
  assert.equal(
    baseline.headers.get("cache-control"),
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );
  assert.equal(
    baseline.headers.get("content-disposition"),
    'inline; filename="content.json"',
  );
  assert.equal(
    baseline.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assert.equal(
    baseline.headers.get("last-modified"),
    "Mon, 10 Aug 2026 00:00:00 GMT",
  );
  assert.equal(
    baseline.headers.get("link"),
    '<https://blog.example.test/content.json>; rel="self"; type="application/json", <https://blog.example.test/content.schema.json>; rel="describedby"; type="application/schema+json", <https://blog.example.test/>; rel="up"; type="text/html"',
  );
  assert.equal(baseline.headers.get("x-robots-tag"), "noindex");

  for (const ifNoneMatch of [etag, `W/${etag}`, `"another", W/${etag}`, "*"]) {
    const response = createContentManifestResponse(
      new Request(url, { headers: { "if-none-match": ifNoneMatch } }),
      [project, post],
    );
    assert.equal(response.status, 304, ifNoneMatch);
    assert.equal(await response.text(), "", ifNoneMatch);
    assert.equal(response.headers.get("etag"), etag, ifNoneMatch);
    assert.equal(
      response.headers.get("last-modified"),
      "Mon, 10 Aug 2026 00:00:00 GMT",
      ifNoneMatch,
    );
  }

  for (const ifNoneMatch of ['"another"', 'W/"another"', '*, "another"']) {
    const response = createContentManifestResponse(
      new Request(url, { headers: { "if-none-match": ifNoneMatch } }),
      [project, post],
    );
    assert.equal(response.status, 200, ifNoneMatch);
    assert.equal(JSON.parse(await response.text()).version, 1, ifNoneMatch);
  }

  const dateMatch = createContentManifestResponse(
    new Request(url, {
      headers: { "if-modified-since": "Mon, 10 Aug 2026 00:00:00 GMT" },
    }),
    [project, post],
  );
  assert.equal(dateMatch.status, 304);
  assert.equal(await dateMatch.text(), "");
  assert.equal(dateMatch.headers.get("etag"), etag);
  assert.equal(
    dateMatch.headers.get("last-modified"),
    "Mon, 10 Aug 2026 00:00:00 GMT",
  );

  for (const [label, headers] of [
    ["stale date", { "if-modified-since": "Sun, 09 Aug 2026 23:59:59 GMT" }],
    ["malformed date", { "if-modified-since": "2026-08-10T00:00:00Z" }],
    [
      "stale ETag wins",
      {
        "if-none-match": '"sha256-stale"',
        "if-modified-since": "Mon, 10 Aug 2026 00:00:00 GMT",
      },
    ],
  ]) {
    const response = createContentManifestResponse(
      new Request(url, { headers }),
      [project, post],
    );
    assert.equal(response.status, 200, label);
    assert.equal(JSON.parse(await response.text()).version, 1, label);
  }
});
