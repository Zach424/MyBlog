import assert from "node:assert/strict";
import test from "node:test";
import {
  createJsonFeed,
  createOpenSearchDescription,
  createRobotsText,
  createRssXml,
  createSitemapXml,
} from "../lib/discovery.ts";
import { resolveSiteUrl } from "../lib/site.ts";

const post = {
  body: "# Build\n\nUse **evidence** & [source](https://example.com) `code`.",
  kind: "post",
  type: "article",
  title: "Build & verify <Worker>",
  description: "A deterministic route & feed.",
  publishedAt: "2026-07-18",
  updatedAt: "2026-07-19",
  freshness: "historical",
  reviewedAt: "2026-08-04",
  tags: ["TypeScript"],
  url: "/posts/build-worker",
};

const project = {
  body: "<span>Visible project evidence</span>",
  cover: "/uploads/myblog/cover.webp",
  coverAlt: "MyBlog evidence rail",
  kind: "project",
  title: "MyBlog",
  description: "Project record",
  publishedAt: "2026-07-17",
  freshness: "current",
  reviewedAt: "2026-08-04",
  tags: ["Cloudflare"],
  url: "/projects/myblog",
};

test("resolves the public origin from trusted proxy headers", () => {
  const requestHeaders = new Headers({
    "x-forwarded-host": "blog.example.test, internal.example.test",
    "x-forwarded-proto": "https",
  });

  assert.equal(resolveSiteUrl(requestHeaders).href, "https://blog.example.test/");
});

test("creates one bounded same-origin OpenSearch 1.1 description", () => {
  const xml = createOpenSearchDescription(
    new URL("https://blog.example.test"),
  );

  assert.match(
    xml,
    /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<OpenSearchDescription xmlns="http:\/\/a9\.com\/-\/spec\/opensearch\/1\.1\/">/u,
  );
  assert.match(xml, /<ShortName>Zach424 Notes<\/ShortName>/u);
  assert.match(
    xml,
    /<Description>记录学习路径、技术取舍和项目复盘，把写过的代码变成可复用的判断。<\/Description>/u,
  );
  assert.match(
    xml,
    /<Url type="text\/html" rel="results" template="https:\/\/blog\.example\.test\/search\?q=\{searchTerms\}" \/>/u,
  );
  assert.match(
    xml,
    /<Url type="application\/opensearchdescription\+xml" rel="self" template="https:\/\/blog\.example\.test\/opensearch\.xml" \/>/u,
  );
  assert.match(xml, /<Query role="example" searchTerms="typescript" \/>/u);
  assert.match(xml, /<Language>zh-CN<\/Language>/u);
  assert.match(xml, /<InputEncoding>UTF-8<\/InputEncoding>/u);
  assert.match(xml, /<OutputEncoding>UTF-8<\/OutputEncoding>/u);
  assert.equal((xml.match(/<ShortName>/gu) ?? []).length, 1);
  assert.equal((xml.match(/<Description>/gu) ?? []).length, 1);
  assert.equal(xml.endsWith("\n"), true);
});

test("creates escaped RSS with stable absolute item URLs", () => {
  const xml = createRssXml(new URL("https://blog.example.test"), [post, project]);

  assert.match(xml, /<title>Build &amp; verify &lt;Worker&gt;<\/title>/);
  assert.match(xml, /<atom:link href="https:\/\/blog\.example\.test\/rss\.xml"/);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/blog\.example\.test\/posts\/build-worker<\/guid>/);
  assert.equal((xml.match(/<item>/g) ?? []).length, 2);
});

test("creates a JSON Feed 1.1 document with stable plain-text items", () => {
  const source = createJsonFeed(new URL("https://blog.example.test"), [project, post]);
  const feed = JSON.parse(source);

  assert.equal(source.endsWith("\n"), true);
  assert.deepEqual(Object.keys(feed), [
    "version",
    "title",
    "home_page_url",
    "feed_url",
    "description",
    "language",
    "authors",
    "icon",
    "items",
  ]);
  assert.equal(feed.version, "https://jsonfeed.org/version/1.1");
  assert.equal(feed.title, "Zach424 / Engineering Notes");
  assert.equal(feed.home_page_url, "https://blog.example.test/");
  assert.equal(feed.feed_url, "https://blog.example.test/feed.json");
  assert.equal(feed.language, "zh-CN");
  assert.deepEqual(feed.authors, [
    { name: "Zach424", url: "https://github.com/Zach424" },
  ]);
  assert.equal(feed.icon, "https://blog.example.test/icon.png");
  assert.deepEqual(feed.items.map((item) => item.id), [
    "https://blog.example.test/posts/build-worker",
    "https://blog.example.test/projects/myblog",
  ]);

  const [postItem, projectItem] = feed.items;
  assert.equal(postItem.url, postItem.id);
  assert.equal(postItem.title, "Build & verify <Worker>");
  assert.equal(postItem.summary, "A deterministic route & feed.");
  assert.equal(postItem.content_text, "Build Use evidence & source code.");
  assert.equal(postItem.date_published, "2026-07-18T00:00:00Z");
  assert.equal(postItem.date_modified, "2026-07-19T00:00:00Z");
  assert.deepEqual(postItem.tags, ["TypeScript"]);

  assert.equal(projectItem.content_text, "Visible project evidence");
  assert.doesNotMatch(projectItem.content_text, /<span>/u);
  assert.equal("date_modified" in projectItem, false);
  assert.equal(
    projectItem.banner_image,
    "https://blog.example.test/uploads/myblog/cover.webp",
  );
  assert.equal("body" in projectItem, false);
  assert.equal("sourcePath" in projectItem, false);
  assert.equal("draft" in projectItem, false);
});

test("sorts JSON Feed items without mutating the caller's public records", () => {
  const records = [
    { ...post, title: "Zulu", url: "/posts/zulu" },
    { ...post, title: "Alpha", url: "/posts/alpha" },
  ];
  const originalOrder = records.map((record) => record.url);
  const feed = JSON.parse(createJsonFeed(new URL("https://blog.example.test"), records));

  assert.deepEqual(records.map((record) => record.url), originalOrder);
  assert.deepEqual(feed.items.map((item) => item.title), ["Alpha", "Zulu"]);
});

test("creates a complete sitemap and a linked robots policy", () => {
  const siteUrl = new URL("https://blog.example.test");
  const sitemap = createSitemapXml(siteUrl, {
    posts: [post],
    projects: [project],
    series: [{ slug: "build-blog", title: "Build Blog", posts: [post] }],
    tags: [{ name: "TypeScript", slug: "typescript", count: 1, items: [post] }],
  });
  const robots = createRobotsText(siteUrl);

  assert.match(sitemap, /https:\/\/blog\.example\.test\/search/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/knowledge/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/posts\/build-worker/);
  assert.match(sitemap, /<lastmod>2026-07-19<\/lastmod>/);
  assert.match(robots, /Allow: \/$/m);
  assert.match(robots, /Disallow: \/studio$/m);
  assert.match(robots, /Disallow: \/api\/cms\/$/m);
  assert.match(robots, /Sitemap: https:\/\/blog\.example\.test\/sitemap\.xml/);
});
