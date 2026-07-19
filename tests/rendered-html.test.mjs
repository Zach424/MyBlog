import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: {
        accept: "text/html",
        "x-forwarded-host": "blog.example.test",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const assetPath = new URL(request.url).pathname.replace(/^\//u, "");
          try {
            const body = await readFile(new URL(`../dist/client/${assetPath}`, import.meta.url));
            const contentType = assetPath.endsWith(".html")
              ? "text/html; charset=utf-8"
              : "application/octet-stream";
            return new Response(body, { headers: { "content-type": contentType } });
          } catch {
            return new Response("Not found", { status: 404 });
          }
        },
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the engineering log homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  const visibleHtml = html.replaceAll("<!-- -->", "");
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>Zach424 \/ Engineering Notes<\/title>/i);
  assert.match(
    html,
    /<meta name="description" content="记录学习路径、技术取舍和项目复盘，把写过的代码变成可复用的判断。"/i,
  );
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/blog\.example\.test\/"/i,
  );
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/blog\.example\.test\/og\.png"/i,
  );
  assert.match(
    html,
    /<link(?=[^>]*rel="alternate")(?=[^>]*type="application\/rss\+xml")(?=[^>]*href="https:\/\/blog\.example\.test\/rss\.xml")[^>]*>/i,
  );
  assert.match(html, /<link(?=[^>]*rel="icon")(?=[^>]*href="[^"]*icon\.png[^"]*")[^>]*>/i);
  assert.match(html, /<a class="skip-link" href="#main-content">/i);
  assert.match(html, /<nav class="site-nav" aria-label="主导航">/i);
  assert.match(html, /把写过的代码/);
  assert.match(html, /变成可复用的/);
  assert.match(html, /Evidence rail/);
  assert.match(html, />Verified</);
  assert.match(html, />Building</);
  assert.match(html, />Learned</);
  assert.match(html, /从零搭建可维护的个人技术博客/);
  assert.match(html, /MyBlog — 把学习记录做成工程资产/);
  assert.match(html, /公开生产上线/);
  assert.match(html, /Guest · 23 routes · Browser QA/);
  assert.match(html, /持续内容发布与维护/);
  assert.match(html, /权限变更也要做未登录验收/);
  assert.match(visibleHtml, /REV\. 010 · 2026-07-18/);
  assert.match(visibleHtml, /Design Systems · 3/);
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /Starter Project|react-loading-skeleton|Your site is taking shape/);
});

test("server-renders every public content collection and detail route", async () => {
  const routeExpectations = [
    ["/posts", /文章与 TIL/],
    ["/projects", /项目复盘/],
    ["/series", /连续专题/],
    ["/series/build-my-blog", /从零搭建可维护的个人技术博客/],
    ["/tags", /技术标签/],
    ["/tags/typescript", /TypeScript/],
    ["/search", /检索工程轨迹/],
    ["/about", /学习不是收藏答案，而是更新判断/],
  ];

  for (const [pathname, expectation] of routeExpectations) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), expectation, pathname);
  }
});

test("serves the owner publishing studio without exposing OAuth when unconfigured", async () => {
  const studioResponse = await render("/studio");
  assert.equal(studioResponse.status, 200);
  assert.equal(studioResponse.headers.get("cache-control"), "no-store");
  assert.equal(studioResponse.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
  assert.match(studioResponse.headers.get("content-security-policy") ?? "", /https:\/\/unpkg\.com/);
  const studioHtml = await studioResponse.text();
  assert.match(studioHtml, /Publishing studio \/ Git-backed/);
  assert.match(studioHtml, /decap-cms-app@3\.14\.1/);

  const oauthResponse = await render("/api/cms/auth?provider=github");
  assert.equal(oauthResponse.status, 503);
  assert.equal(oauthResponse.headers.get("cache-control"), "no-store");
});

test("renders Markdown articles with metadata, anchors, code and navigation", async () => {
  const response = await render("/posts/building-a-maintainable-blog");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /从零搭建可维护的个人技术博客/);
  assert.match(html, /<nav aria-label="本文目录">/);
  assert.match(html, /id="先冻结内容契约"/);
  assert.match(html, /class="[^"]*hljs[^"]*"/);
  assert.match(html, /href="\/series\/build-my-blog"/);
  assert.match(html, /href="\/tags\/typescript"/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"mainEntityOfPage":"https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog"/);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog"/,
  );
});

test("renders project Markdown and returns a real 404 for unknown content", async () => {
  const projectResponse = await render("/projects/myblog");
  assert.equal(projectResponse.status, 200);
  const projectHtml = await projectResponse.text();
  assert.match(projectHtml, /MyBlog/);
  assert.match(projectHtml, /GitHub repository/);
  assert.match(projectHtml, /https:\/\/github\.com\/Zach424\/MyBlog/);
  assert.match(projectHtml, /"@type":"SoftwareSourceCode"/);

  const missingResponse = await render("/posts/does-not-exist");
  assert.equal(missingResponse.status, 404);
  assert.match(await missingResponse.text(), /这条工程轨迹不存在/);
});

test("server-renders a shareable search query against posts and projects", async () => {
  const response = await render("/search?q=cloudflare");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /name="q"/);
  assert.match(html, /value="cloudflare"/);
  assert.match(html, /Cloudflare/);
  assert.match(html, /MyBlog — 把学习记录做成工程资产/);
  assert.match(html, /NO TRACKING/);
});

test("publishes RSS, Sitemap and robots from the same public content index", async () => {
  const [rssResponse, sitemapResponse, robotsResponse] = await Promise.all([
    render("/rss.xml"),
    render("/sitemap.xml"),
    render("/robots.txt"),
  ]);

  assert.equal(rssResponse.status, 200);
  assert.match(rssResponse.headers.get("content-type") ?? "", /^application\/rss\+xml/i);
  const rss = await rssResponse.text();
  assert.match(rss, /https:\/\/blog\.example\.test\/rss\.xml/);
  assert.match(rss, /从零搭建可维护的个人技术博客/);
  assert.match(rss, /MyBlog — 把学习记录做成工程资产/);
  assert.equal((rss.match(/<item>/g) ?? []).length, 4);

  assert.equal(sitemapResponse.status, 200);
  assert.match(sitemapResponse.headers.get("content-type") ?? "", /^application\/xml/i);
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /https:\/\/blog\.example\.test\/search/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/tags\/typescript/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/series\/build-my-blog/);

  assert.equal(robotsResponse.status, 200);
  const robots = await robotsResponse.text();
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/blog\.example\.test\/sitemap\.xml/);
});

test("removes starter artifacts and keeps the design contract explicit", async () => {
  const [page, layout, css, packageJson, worker, viteConfig, markdownPlugin, siteModule, ogImage, iconImage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../build/markdown-source-plugin.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/site.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/og.png", import.meta.url)),
    readFile(new URL("../app/icon.png", import.meta.url)),
  ]);

  assert.match(page, /className="trace"/);
  assert.match(page, /className="evidence-rail"/);
  assert.match(page, /getAllPosts\(\)/);
  assert.match(page, /getFeaturedProject\(\)/);
  assert.match(page, /getTagIndex\(\)/);
  assert.match(page, /href="https:\/\/github\.com\/Zach424\/MyBlog"/);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview|codex-preview/);

  assert.match(layout, /export async function generateMetadata/);
  assert.match(layout, /resolveSiteUrl/);
  assert.match(siteModule, /x-forwarded-host/);
  assert.match(layout, /<html lang="zh-CN">/);
  assert.doesNotMatch(layout, /next\/font|Starter Project|favicon\.svg/);

  assert.match(css, /--signal:\s*#b9431f/i);
  assert.match(css, /@media \(prefers-color-scheme:\s*dark\)/i);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /a:focus-visible/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(packageJson, /drizzle/);
  assert.match(packageJson, /"yaml": "2\.9\.0"/);
  assert.match(packageJson, /"zod": "4\.4\.3"/);
  assert.match(packageJson, /"react-markdown": "10\.1\.0"/);
  assert.match(packageJson, /"rehype-highlight": "7\.0\.2"/);
  assert.match(packageJson, /"remark-gfm": "4\.0\.1"/);
  assert.match(packageJson, /"typecheck": "tsc --noEmit"/);
  assert.doesNotMatch(worker, /\bDB:\s*D1Database/);
  assert.match(viteConfig, /validateContentRepository\(process\.cwd\(\)\)/);
  assert.match(viteConfig, /markdownSourcePlugin\(\)/);
  assert.match(markdownPlugin, /export default/);

  assert.equal(ogImage.readUInt32BE(16), 1200);
  assert.equal(ogImage.readUInt32BE(20), 630);
  assert.equal(iconImage.readUInt32BE(16), 256);
  assert.equal(iconImage.readUInt32BE(20), 256);
  assert.ok(iconImage.byteLength < 100_000);

  await Promise.all([
    assert.rejects(
      access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
    ),
    assert.rejects(access(new URL("../public/favicon.svg", import.meta.url))),
    assert.rejects(access(new URL("../public/file.svg", import.meta.url))),
    assert.rejects(access(new URL("../public/globe.svg", import.meta.url))),
    assert.rejects(access(new URL("../public/window.svg", import.meta.url))),
    assert.rejects(access(new URL("../db/index.ts", import.meta.url))),
    assert.rejects(access(new URL("../drizzle.config.ts", import.meta.url))),
    assert.rejects(access(new URL("../app/chatgpt-auth.ts", import.meta.url))),
  ]);
});
