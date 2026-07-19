import assert from "node:assert/strict";
import test from "node:test";
import {
  createRobotsText,
  createRssXml,
  createSitemapXml,
} from "../lib/discovery.ts";
import { resolveSiteUrl } from "../lib/site.ts";

const post = {
  kind: "post",
  type: "article",
  title: "Build & verify <Worker>",
  description: "A deterministic route & feed.",
  publishedAt: "2026-07-18",
  updatedAt: "2026-07-19",
  tags: ["TypeScript"],
  url: "/posts/build-worker",
};

const project = {
  kind: "project",
  title: "MyBlog",
  description: "Project record",
  publishedAt: "2026-07-17",
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

test("creates escaped RSS with stable absolute item URLs", () => {
  const xml = createRssXml(new URL("https://blog.example.test"), [post, project]);

  assert.match(xml, /<title>Build &amp; verify &lt;Worker&gt;<\/title>/);
  assert.match(xml, /<atom:link href="https:\/\/blog\.example\.test\/rss\.xml"/);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/blog\.example\.test\/posts\/build-worker<\/guid>/);
  assert.equal((xml.match(/<item>/g) ?? []).length, 2);
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
  assert.match(sitemap, /https:\/\/blog\.example\.test\/posts\/build-worker/);
  assert.match(sitemap, /<lastmod>2026-07-19<\/lastmod>/);
  assert.match(robots, /Allow: \/$/m);
  assert.match(robots, /Disallow: \/studio$/m);
  assert.match(robots, /Disallow: \/api\/cms\/$/m);
  assert.match(robots, /Sitemap: https:\/\/blog\.example\.test\/sitemap\.xml/);
});
