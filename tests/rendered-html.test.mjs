import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(pathname = "/") {
  if (!process.env.TEST_BASE_URL) throw new Error("TEST_BASE_URL is required");
  return fetch(new URL(pathname, process.env.TEST_BASE_URL), {
    redirect: "manual",
    headers: {
      accept: "text/html",
      "x-forwarded-host": "blog.example.test",
      "x-forwarded-proto": "https",
    },
  });
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
    /<link rel="canonical" href="https:\/\/blog\.example\.test(?:\/|\")/i,
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
  const revisionDate = /REV\. 010 · (\d{4}-\d{2}-\d{2})/u.exec(visibleHtml)?.[1];
  const newestTraceDate = /class="trace-date" dateTime="(\d{4}-\d{2}-\d{2})"/u.exec(
    visibleHtml,
  )?.[1];
  assert.ok(revisionDate, "首页应显示带日期的版本标识");
  assert.equal(revisionDate, newestTraceDate, "版本日期应跟随最新公开文章");
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
    ["/knowledge", /知识之间，应该看得见来路/],
    ["/about", /学习不是收藏答案，而是更新判断/],
  ];

  for (const [pathname, expectation] of routeExpectations) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), expectation, pathname);
  }
});

test("server-renders an accessible knowledge map from Markdown relations", async () => {
  const response = await render("/knowledge");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/blog\.example\.test\/knowledge"/,
  );
  assert.match(html, /<title id="knowledge-map-svg-title">公开内容关系图<\/title>/);
  assert.match(html, /id="knowledge-map-svg-description"/);
  assert.equal((html.match(/class="knowledge-node(?:\s| knowledge-node-)/g) ?? []).length, 4);
  assert.equal((html.match(/class="knowledge-edge knowledge-edge-/g) ?? []).length, 4);
  assert.equal((html.match(/class="knowledge-edge-record"/g) ?? []).length, 8);
  assert.match(html, /MyBlog — 把学习记录做成工程资产/);
  assert.match(html, /为什么先写项目章程，再写首页/);
  assert.match(html, /尚未连线，不等于没有价值/);
  assert.doesNotMatch(html, /<canvas\b/i);
});

test("permanently redirects the legacy blog entry to its canonical route in one hop", async () => {
  const response = await render("/blog?from=legacy");
  assert.equal(response.status, 308);
  const location = new URL(
    response.headers.get("location") ?? "",
    process.env.TEST_BASE_URL,
  );
  assert.equal(location.pathname, "/posts");
  assert.equal(location.search, "?from=legacy");

  const destination = await render(location.pathname);
  assert.equal(destination.status, 200);
  assert.match(await destination.text(), /文章与 TIL/u);
});

test("serves the owner publishing studio without exposing OAuth when unconfigured", async () => {
  const studioResponse = await render("/studio");
  assert.equal(studioResponse.status, 200);
  assert.equal(studioResponse.headers.get("cache-control"), "no-store");
  assert.equal(studioResponse.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
  assert.doesNotMatch(studioResponse.headers.get("content-security-policy") ?? "", /unpkg\.com/);
  const studioHtml = await studioResponse.text();
  assert.match(studioHtml, /Publishing studio \/ Git-backed/);
  assert.match(studioHtml, /\/studio\/editor-runtime-3\.14\.1\.js/);

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
  assert.match(
    html,
    /<h2 id="先冻结内容契约">先冻结内容契约<a aria-label="本节永久链接" class="heading-permalink" href="#先冻结内容契约"><span aria-hidden="true">##<\/span><\/a><\/h2>/,
  );
  assert.equal((html.match(/class="heading-permalink"/g) ?? []).length, 5);
  assert.doesNotMatch(html, /<h4[^>]*>[\s\S]*?class="heading-permalink"/u);
  assert.match(html, /class="[^"]*hljs[^"]*"/);
  assert.match(
    html,
    /<figure class="code-block" data-copy-state="idle"><figcaption class="code-block-rail">/,
  );
  assert.match(
    html,
    /<span class="code-block-language">CODE \/ (?:<!-- -->)?TEXT<\/span>/,
  );
  assert.match(
    html,
    /<button(?=[^>]*aria-label="复制 TEXT 代码")(?=[^>]*class="code-copy-button")(?=[^>]*hidden="")[^>]*>COPY<\/button>/,
  );
  assert.match(html, /<pre><code class="hljs language-text">/);
  assert.match(html, /<span aria-live="polite" class="visually-hidden"/);
  assert.equal((html.match(/class="code-block"/g) ?? []).length, 1);
  assert.match(html, /href="\/series\/build-my-blog"/);
  assert.match(html, /href="\/tags\/typescript"/);
  assert.match(html, /Historical snapshot/);
  assert.match(html, /<dt>Reviewed<\/dt>/);
  assert.match(html, /2026-08-05/);
  assert.doesNotMatch(html, /class="content-cover"/);
  assert.match(
    html,
    /<img(?=[^>]*alt="Markdown 文档经过提交分支、自动质量检查后生成公开网页的内容交付链路")(?=[^>]*class="markdown-image markdown-image-local")(?=[^>]*width="1672")(?=[^>]*height="941")(?=[^>]*sizes="\(max-width: 42rem\) calc\(100vw - 2rem\), \(max-width: 55rem\) 90vw, 48rem")(?=[^>]*srcSet=)[^>]*>/,
  );
  assert.doesNotMatch(html, /node="\[object Object\]"/);
  assert.match(html, /<section class="content-relations" aria-labelledby="reference-ledger-title">/);
  assert.equal(
    [
      ...html.matchAll(
        /<section class="content-relation-group" aria-labelledby="(?:outgoing|incoming)-references-title">/g,
      ),
    ].length,
    2,
  );
  assert.match(html, /id="outgoing-references-title">这条记录引用/);
  assert.match(html, /id="incoming-references-title">引用这条记录/);
  assert.match(html, /这条记录引用/);
  assert.match(html, /引用这条记录/);
  assert.match(html, /href="\/projects\/myblog"/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"mainEntityOfPage":"https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog"/);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog"/,
  );
  assert.match(
    html.replaceAll("<!-- -->", ""),
    /<p class="print-source">Source \/ <a href="https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog">https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog<\/a><\/p>/,
  );
  assert.match(
    html,
    /<section(?=[^>]*class="content-share")(?=[^>]*data-share-enhanced="false")(?=[^>]*data-share-state="idle")[^>]*>/u,
  );
  assert.match(
    html,
    /<a(?=[^>]*class="content-share-source")(?=[^>]*href="https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog")[^>]*>/u,
  );
  assert.match(
    html,
    /<div class="content-share-action" hidden=""><button(?=[^>]*class="content-share-button")(?=[^>]*type="button")[^>]*>/u,
  );
  assert.equal((html.match(/data-footnote-ref="true"/g) ?? []).length, 2);
  assert.match(html, /href="#note-fn-%E5%BD%93%E5%89%8D%E6%9E%B6%E6%9E%84"/);
  assert.match(html, /id="note-fnref-%E5%BD%93%E5%89%8D%E6%9E%B6%E6%9E%84-2"/);
  assert.match(
    html,
    /<section data-footnotes="true" class="footnotes"><h2 class="footnote-heading" id="footnote-label">注释与来源<\/h2>/,
  );
  assert.equal((html.match(/data-footnote-backref=""/g) ?? []).length, 2);
  assert.match(html, /aria-label="返回正文中的注释 1（第 2 处）"/);
  assert.match(
    html,
    /href="\/projects\/myblog#vercel-%E9%98%B6%E6%AE%B5%E5%BD%93%E5%89%8D"/,
  );
  assert.doesNotMatch(
    html,
    /id="footnote-label"[^<]*>注释与来源<a[^>]*class="heading-permalink"/,
  );

  const isolatedResponse = await render("/posts/project-charter-before-homepage");
  assert.equal(isolatedResponse.status, 200);
  assert.doesNotMatch(await isolatedResponse.text(), /class="content-relations"/);

  const mixedCodeResponse = await render("/posts/cross-platform-npm-scripts");
  assert.equal(mixedCodeResponse.status, 200);
  const mixedCodeHtml = await mixedCodeResponse.text();
  assert.match(mixedCodeHtml, /<code>cmd\.exe<\/code>/);
  assert.match(
    mixedCodeHtml,
    /<span class="code-block-language">CODE \/ (?:<!-- -->)?JSON<\/span>/,
  );
  assert.equal((mixedCodeHtml.match(/class="code-block"/g) ?? []).length, 1);
});

test("renders project Markdown and returns a real 404 for unknown content", async () => {
  const projectResponse = await render("/projects/myblog");
  assert.equal(projectResponse.status, 200);
  const projectHtml = await projectResponse.text();
  assert.match(projectHtml, /MyBlog/);
  assert.match(projectHtml, /GitHub repository/);
  assert.match(projectHtml, /https:\/\/github\.com\/Zach424\/MyBlog/);
  assert.match(projectHtml, /Current record/);
  assert.match(projectHtml, /https:\/\/blog-iota-five-59\.vercel\.app/);
  assert.match(
    projectHtml.replaceAll("<!-- -->", ""),
    /<p class="print-source">Source \/ <a href="https:\/\/blog\.example\.test\/projects\/myblog">https:\/\/blog\.example\.test\/projects\/myblog<\/a><\/p>/,
  );
  assert.match(
    projectHtml,
    /<a(?=[^>]*class="content-share-source")(?=[^>]*href="https:\/\/blog\.example\.test\/projects\/myblog")[^>]*>/u,
  );
  assert.match(
    projectHtml,
    /<div class="content-share-action" hidden=""><button(?=[^>]*class="content-share-button")(?=[^>]*type="button")[^>]*>/u,
  );
  assert.match(
    projectHtml,
    /<h3 id="vercel-阶段当前">Vercel 阶段（当前）<a aria-label="本节永久链接" class="heading-permalink" href="#vercel-阶段当前"><span aria-hidden="true">###<\/span><\/a><\/h3>/,
  );
  assert.doesNotMatch(
    projectHtml,
    /href="https:\/\/zach424-engineering-notes\.zhiqingchen792\.chatgpt\.site"/,
  );
  assert.match(projectHtml, /<section class="content-relations" aria-labelledby="reference-ledger-title">/);
  assert.match(projectHtml, /这条记录引用/);
  assert.match(projectHtml, /引用这条记录/);
  assert.match(projectHtml, /href="\/posts\/building-a-maintainable-blog"/);
  assert.match(projectHtml, /href="\/posts\/cross-platform-npm-scripts"/);
  assert.match(projectHtml, /"@type":"SoftwareSourceCode"/);
  assert.match(projectHtml, /<figure class="content-cover">/);
  assert.match(projectHtml, /<figcaption class="content-cover-rail">/);
  assert.match(projectHtml, /Project(?:<!-- -->)? \/ Cover/);
  assert.match(
    projectHtml,
    /<img(?=[^>]*alt="文档、提交节点、网页与部署层沿一条工程轨迹连接成可维护博客系统")(?=[^>]*width="1672")(?=[^>]*height="941")(?=[^>]*srcSet=)[^>]*>/,
  );
  assert.match(
    projectHtml,
    /<meta property="og:image" content="https:\/\/blog\.example\.test\/uploads\/myblog\/cover\.webp"/,
  );
  assert.match(
    projectHtml,
    /<meta name="twitter:image" content="https:\/\/blog\.example\.test\/uploads\/myblog\/cover\.webp"/,
  );
  assert.match(
    projectHtml,
    /"image":"https:\/\/blog\.example\.test\/uploads\/myblog\/cover\.webp"/,
  );
  assert.match(projectHtml, /class="katex-mathml"/u);
  assert.match(projectHtml, /<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML"/u);
  assert.match(projectHtml, /<annotation encoding="application\/x-tex">B_\{\\mathrm\{client\}\}/u);
  assert.match(
    projectHtml,
    /<span(?=[^>]*class="katex-html")(?=[^>]*aria-hidden="true")[^>]*>/u,
  );
  assert.match(
    projectHtml,
    /<span(?=[^>]*class="katex-display")(?=[^>]*role="region")(?=[^>]*aria-label="数学公式，可横向滚动")(?=[^>]*tabindex="0")[^>]*>/u,
  );
  assert.doesNotMatch(
    projectHtml,
    /class="code-block"[^]*?B_\{\\mathrm\{client\}\}/u,
  );

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

  const formulaResponse = await render("/search?q=B_i");
  assert.equal(formulaResponse.status, 200);
  const formulaHtml = await formulaResponse.text();
  assert.match(formulaHtml, /value="B_i"/u);
  assert.match(formulaHtml, /MyBlog — 把学习记录做成工程资产/u);
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
  const rssUrls = [...rss.matchAll(/<guid isPermaLink="true">([^<]+)<\/guid>/gu)].map(
    (match) => match[1],
  );
  assert.ok(rssUrls.length >= 4, "RSS 至少应包含初始公开内容");
  assert.equal(new Set(rssUrls).size, rssUrls.length, "RSS 内容 URL 不能重复");

  assert.equal(sitemapResponse.status, 200);
  assert.match(sitemapResponse.headers.get("content-type") ?? "", /^application\/xml/i);
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /https:\/\/blog\.example\.test\/search/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/knowledge/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/tags\/typescript/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/series\/build-my-blog/);
  const sitemapContentUrls = [
    ...sitemap.matchAll(
      /<loc>(https:\/\/blog\.example\.test\/(?:posts|projects)\/[^<]+)<\/loc>/gu,
    ),
  ].map((match) => match[1]);
  assert.deepEqual(
    [...sitemapContentUrls].sort(),
    [...rssUrls].sort(),
    "RSS 与 Sitemap 必须来自同一份公开内容索引",
  );

  assert.equal(robotsResponse.status, 200);
  const robots = await robotsResponse.text();
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/blog\.example\.test\/sitemap\.xml/);
});

test("removes starter artifacts and keeps the Vercel-native design contract explicit", async () => {
  const [page, layout, css, packageJson, nextConfig, contentModule, siteModule, vercelConfig, ogImage, iconImage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/content/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/site.ts", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
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
  assert.match(packageJson, /"sharp": "0\.35\.3"/);
  assert.match(packageJson, /"typecheck": "next typegen && tsc --noEmit"/);
  assert.match(
    nextConfig,
    /validateContentRepository\(process\.cwd\(\), contentBuildDate\)/,
  );
  assert.match(nextConfig, /validateMediaRepository\(process\.cwd\(\)\)/);
  assert.match(nextConfig, /createNextRedirects\(process\.cwd\(\), contentBuildDate\)/);
  assert.match(nextConfig, /async redirects\(\)/);
  assert.match(nextConfig, /CONTENT_BUILD_DATE: contentBuildDate/);
  assert.match(nextConfig, /STUDIO_CONTENT_SECURITY_POLICY/);
  assert.match(contentModule, /readMarkdownDirectory/);
  assert.match(vercelConfig, /"framework": "nextjs"/);
  assert.doesNotMatch(packageJson, /vinext|wrangler|@cloudflare\/vite-plugin/);

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
    assert.rejects(access(new URL("../vite.config.ts", import.meta.url))),
    assert.rejects(access(new URL("../worker/index.ts", import.meta.url))),
    assert.rejects(access(new URL("../.openai/hosting.json", import.meta.url))),
  ]);
});
