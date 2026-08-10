import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { parse as parseYaml } from "yaml";
import {
  assertDiscoveryBudgetCoverage,
  assertDiscoveryBudgets,
  formatDiscoveryBudgetReport,
  measureDiscoveryBudget,
} from "../scripts/discovery-budget.mjs";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(pathname = "/", options = {}) {
  if (!process.env.TEST_BASE_URL) throw new Error("TEST_BASE_URL is required");
  return fetch(new URL(pathname, process.env.TEST_BASE_URL), {
    redirect: "manual",
    headers: {
      accept: options.accept ?? "text/html",
      "x-forwarded-host": "blog.example.test",
      "x-forwarded-proto": "https",
      ...options.headers,
    },
  });
}

function visibleDocument(html) {
  const documentEnd = html.indexOf("</html>");
  return documentEnd >= 0 ? html.slice(0, documentEnd + 7) : html;
}

function structuredDataByType(html, type) {
  return [
    ...visibleDocument(html).matchAll(
      /<script(?=[^>]*\btype="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/giu,
    ),
  ]
    .map((match) => JSON.parse(match[1]))
    .filter((document) => document["@type"] === type);
}

function expectedBreadcrumbList(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.href, "https://blog.example.test").href,
    })),
  };
}

function expectedWebsiteIdentity(origin) {
  const siteRoot = new URL("/", origin).href;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteRoot}#website`,
    name: "Zach424 / Engineering Notes",
    url: siteRoot,
    description:
      "记录学习路径、技术取舍和项目复盘，把写过的代码变成可复用的判断。",
    inLanguage: "zh-CN",
  };
}

test("server-renders the engineering log homepage", async () => {
  const [response, sitemapResponse] = await Promise.all([
    render(),
    render("/sitemap.xml", { accept: "application/xml" }),
  ]);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(sitemapResponse.status, 200);

  const html = await response.text();
  const sitemap = await sitemapResponse.text();
  const visibleHtml = html.replaceAll("<!-- -->", "");
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
    (match) => match[1],
  );
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
  assert.match(
    html,
    /<link(?=[^>]*rel="alternate")(?=[^>]*type="application\/feed\+json")(?=[^>]*href="https:\/\/blog\.example\.test\/feed\.json")[^>]*>/i,
  );
  assert.match(
    html,
    /<link(?=[^>]*rel="alternate")(?=[^>]*type="application\/json")(?=[^>]*href="https:\/\/blog\.example\.test\/content\.json")[^>]*>/i,
  );
  assert.match(
    html,
    /<link(?=[^>]*rel="search")(?=[^>]*type="application\/opensearchdescription\+xml")(?=[^>]*href="https:\/\/blog\.example\.test\/opensearch\.xml")[^>]*>/i,
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
  assert.match(
    visibleHtml,
    new RegExp(`Guest · ${sitemapUrls.length} public URLs · Sitemap synced`, "u"),
  );
  assert.match(visibleHtml, /持续维护 · TypeScript · React · \+3/);
  assert.match(visibleHtml, /ARTICLE · 2026-07-18 · Next\.js · \+3/);
  assert.match(visibleHtml, /持续维护项目 \/ 最新文章 \/ 2026-08-06/);
  assert.doesNotMatch(visibleHtml, /持续内容发布与维护|权限变更也要做未登录验收/u);
  assert.match(visibleHtml, /<section[^>]*data-home-activity="latest-three"[^>]*>/u);
  assert.equal(
    (visibleHtml.match(/data-home-activity-event="true"/gu) ?? []).length,
    3,
  );
  assert.equal(
    (visibleHtml.match(/data-activity-mode="updated"/gu) ?? []).length,
    3,
  );
  assert.match(
    visibleHtml,
    /2026-08-06[\s\S]*?MyBlog — 把学习记录做成工程资产[\s\S]*?2026-08-05[\s\S]*?从零搭建可维护的个人技术博客[\s\S]*?2026-08-04[\s\S]*?为什么先写项目章程，再写首页/u,
  );
  assert.match(visibleHtml, /href="\/activity"[^>]*>完整活动账本/u);
  assert.doesNotMatch(visibleHtml, /data-activity-mode="reviewed"/u);
  const latestDate = /LATEST · (\d{4}-\d{2}-\d{2})/u.exec(visibleHtml)?.[1];
  const sitemapHomeDate = new RegExp(
    `<loc>https://blog\\.example\\.test/<\\/loc>\\s*<lastmod>(\\d{4}-\\d{2}-\\d{2})<\\/lastmod>`,
    "u",
  ).exec(sitemap)?.[1];
  assert.ok(sitemapUrls.length >= 26, "Sitemap 应保留完整公开路由集合");
  assert.ok(latestDate, "首页应显示最新公开内容日期");
  assert.equal(latestDate, sitemapHomeDate, "首页日期应与 Sitemap 首页事实一致");
  assert.doesNotMatch(visibleHtml, /REV\.\s*\d+/u);
  assert.match(visibleHtml, /Design Systems · 3/);
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /Starter Project|react-loading-skeleton|Your site is taking shape/);
});

test("server-renders a semantic 404 recovery junction without soft redirecting", async () => {
  const response = await render("/definitely-missing-recovery-junction");
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i);

  const html = visibleDocument(await response.text()).replaceAll("<!-- -->", "");
  assert.equal((html.match(/<h1\b/giu) ?? []).length, 1);
  assert.match(html, /<meta name="robots" content="noindex"/i);
  assert.match(html, /<main class="not-found page-shell [^"]+" id="main-content">/i);
  assert.match(html, /<h1[^>]*>这条轨迹在这里中断。<\/h1>/u);
  assert.match(html, /服务器没有找到这个地址/u);
  assert.match(html, /<nav class="not-found-routes [^"]+" aria-label="404 恢复路径">/u);
  assert.equal((html.match(/class="not-found-route [^"]+"/gu) ?? []).length, 4);

  for (const [href, label] of [
    ["/search", "搜索知识库"],
    ["/archive", "按时间回溯"],
    ["/posts", "浏览文章"],
    ["/projects", "浏览项目"],
  ]) {
    assert.match(
      html,
      new RegExp(`<a class="not-found-route [^"]+" href="${href}">[\\s\\S]*?${label}[\\s\\S]*?<\\/a>`, "u"),
      href,
    );
  }

  assert.match(html, /href="\/">返回首页<\/a>/u);
  assert.doesNotMatch(html, /http-equiv="refresh"/i);
  assert.equal(structuredDataByType(html, "BreadcrumbList").length, 0);

  const source = await readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /["']use client["']/);
});

test("publishes one authoritative WebSite identity on the homepage only", async () => {
  const homeResponse = await render();
  assert.equal(homeResponse.status, 200);
  const websiteDocuments = structuredDataByType(
    await homeResponse.text(),
    "WebSite",
  );
  assert.equal(websiteDocuments.length, 1);
  assert.deepEqual(
    websiteDocuments[0],
    expectedWebsiteIdentity("https://blog.example.test"),
  );
  assert.doesNotMatch(JSON.stringify(websiteDocuments[0]), /SearchAction/u);

  const internalPaths = [
    "/posts",
    "/posts/building-a-maintainable-blog",
    "/projects/myblog",
    "/archive",
    "/activity",
    "/subscribe",
    "/series/build-my-blog",
    "/tags/typescript",
    "/search",
    "/knowledge",
    "/about",
  ];
  const internalResponses = await Promise.all(internalPaths.map(render));
  for (const [index, response] of internalResponses.entries()) {
    assert.equal(response.status, 200, internalPaths[index]);
    assert.equal(
      structuredDataByType(await response.text(), "WebSite").length,
      0,
      internalPaths[index],
    );
  }
});

test("connects article and project identities to the canonical WebSite node", async () => {
  const [homeResponse, postResponse, projectResponse] = await Promise.all([
    render(),
    render("/posts/building-a-maintainable-blog"),
    render("/projects/myblog"),
  ]);
  assert.equal(homeResponse.status, 200);
  assert.equal(postResponse.status, 200);
  assert.equal(projectResponse.status, 200);

  const websiteDocuments = structuredDataByType(
    await homeResponse.text(),
    "WebSite",
  );
  assert.equal(websiteDocuments.length, 1);
  const websiteReference = { "@id": websiteDocuments[0]["@id"] };
  const expectations = [
    {
      response: postResponse,
      type: "BlogPosting",
      canonical:
        "https://blog.example.test/posts/building-a-maintainable-blog",
      pageProperty: "mainEntityOfPage",
      readingStats: { timeRequired: "PT4M", wordCount: 899 },
    },
    {
      response: projectResponse,
      type: "SoftwareSourceCode",
      canonical: "https://blog.example.test/projects/myblog",
      pageProperty: "url",
    },
  ];

  for (const expectation of expectations) {
    const documents = structuredDataByType(
      await expectation.response.text(),
      expectation.type,
    );
    assert.equal(documents.length, 1, expectation.type);
    assert.equal(
      documents[0]["@id"],
      `${expectation.canonical}#content`,
      expectation.type,
    );
    assert.deepEqual(
      documents[0].isPartOf,
      websiteReference,
      expectation.type,
    );
    assert.equal(documents[0].url, expectation.canonical, expectation.type);
    assert.equal(
      documents[0][expectation.pageProperty],
      expectation.canonical,
      expectation.type,
    );
    assert.equal(documents[0].inLanguage, "zh-CN", expectation.type);
    assert.deepEqual(
      documents[0].author,
      {
        "@type": "Person",
        name: "Zach424",
        url: "https://github.com/Zach424",
      },
      expectation.type,
    );
    if (expectation.readingStats) {
      assert.equal(
        documents[0].wordCount,
        expectation.readingStats.wordCount,
        expectation.type,
      );
      assert.equal(
        documents[0].timeRequired,
        expectation.readingStats.timeRequired,
        expectation.type,
      );
    } else {
      assert.equal(Object.hasOwn(documents[0], "wordCount"), false);
      assert.equal(Object.hasOwn(documents[0], "timeRequired"), false);
    }
  }

  for (const pathname of [
    "/posts/structured-data-missing",
    "/projects/structured-data-missing",
  ]) {
    const response = await render(pathname);
    assert.equal(response.status, 404, pathname);
    const html = await response.text();
    assert.equal(structuredDataByType(html, "BlogPosting").length, 0, pathname);
    assert.equal(
      structuredDataByType(html, "SoftwareSourceCode").length,
      0,
      pathname,
    );
  }
});

test("server-renders every public content collection and detail route", async () => {
  const routeExpectations = [
    ["/posts", /文章与 TIL/],
    ["/projects", /项目复盘/],
    ["/archive", /时间档案/],
    ["/activity", /内容活动/],
    ["/subscribe", /订阅与开放接口/],
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

test("server-renders the about system profile from public content facts", async () => {
  const response = await render("/about");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /4 RECORDS \/ 27 ROUTES \/ UPDATED 2026-08-06/u);
  assert.match(html, /公开系统档案/u);
  assert.match(html, /文章与 TIL/u);
  assert.match(html, /MyBlog — 把学习记录做成工程资产/u);
  assert.match(html, /持续维护/u);
  for (const stackItem of ["TypeScript", "React", "Next.js", "Vercel", "GitHub"]) {
    assert.match(html, new RegExp(stackItem.replace(".", "\\."), "u"));
  }
  assert.doesNotMatch(html, /TypeScript、React、Next\.js 与 Vercel/u);
});

test("server-renders one bilingual project status across public project surfaces", async () => {
  const [homeResponse, projectsResponse, projectResponse] = await Promise.all([
    render(),
    render("/projects"),
    render("/projects/myblog"),
  ]);
  const responses = [homeResponse, projectsResponse, projectResponse];
  const htmlDocuments = await Promise.all(responses.map((response) => response.text()));

  for (const [index, response] of responses.entries()) {
    assert.equal(response.status, 200);
    assert.match(htmlDocuments[index], /持续维护 · MAINTAINED/u);
  }

  assert.doesNotMatch(htmlDocuments[0], />Maintained</u);
  assert.doesNotMatch(htmlDocuments[1], />MAINTAINED\s*<span/u);
  assert.doesNotMatch(htmlDocuments[2], />Project \/ maintained</u);
});

test("server-renders updated dates in shared content lists without changing the archive", async () => {
  const routeDates = [
    ["/posts", "2026-08-05"],
    ["/projects", "2026-08-06"],
    ["/series/build-my-blog", "2026-08-05"],
    ["/tags/typescript", "2026-08-06"],
    ["/projects/myblog", "2026-08-05"],
  ];

  for (const [pathname, date] of routeDates) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = visibleDocument(await response.text()).replaceAll("<!-- -->", "");
    assert.match(
      html,
      new RegExp(
        `<time class="content-index-date" dateTime="${date}"><span class="content-index-date-label">UPDATED</span>${date}</time>`,
        "u",
      ),
      pathname,
    );
  }

  const searchResponse = await render("/search");
  assert.equal(searchResponse.status, 200);
  const searchHtml = visibleDocument(await searchResponse.text());
  assert.match(searchHtml, /按首发时间显示全部 4 条公开记录/u);
  assert.equal((searchHtml.match(/首发顺序/gu) ?? []).length, 4);

  const archiveResponse = await render("/archive");
  assert.equal(archiveResponse.status, 200);
  const archiveHtml = visibleDocument(await archiveResponse.text());
  assert.doesNotMatch(archiveHtml, /content-index-date/u);
  assert.match(archiveHtml, /aria-label="发布日期 2026-07-18"/u);
});

test("server-renders one read-only subscription switchboard with real endpoints", async () => {
  const response = await render("/subscribe");
  assert.equal(response.status, 200);

  const html = visibleDocument(await response.text()).replaceAll("<!-- -->", "");
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/blog\.example\.test\/subscribe"/u,
  );
  assert.match(
    html,
    /<ol class="subscription-routes" aria-label="公开订阅与读取通道">/u,
  );
  assert.equal((html.match(/class="subscription-route"/gu) ?? []).length, 5);
  for (const href of [
    "/rss.xml",
    "/feed.json",
    "/opensearch.xml",
    "/content.json",
    "/content.schema.json",
    "/posts/building-a-maintainable-blog/source.md",
  ]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  assert.match(html, /这些接口只负责读取/u);
  assert.match(html, /公开、只读、不要求账号/u);
  assert.match(html, /<a href="\/subscribe">订阅<\/a>/u);
});

test("server-renders one mixed chronological archive with real dates and types", async () => {
  const response = await render("/archive");
  assert.equal(response.status, 200);

  const html = visibleDocument(await response.text()).replaceAll("<!-- -->", "");
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/blog\.example\.test\/archive"/u,
  );
  assert.match(html, /<ol class="archive-ledger" aria-label="公开内容时间档案">/u);
  assert.equal((html.match(/class="archive-entry"/gu) ?? []).length, 4);
  assert.match(html, /<h2>2026<\/h2>/u);
  assert.match(html, /<span class="visually-hidden">2026 年<\/span>07 月/u);
  assert.match(html, /dateTime="2026-07-18"/u);
  assert.match(html, />Article<\/span>/u);
  assert.match(html, />TIL<\/span>/u);
  assert.match(html, />Project<\/span>/u);
  assert.match(html, /href="\/activity"/u);

  const titles = [
    "从零搭建可维护的个人技术博客",
    "MyBlog — 把学习记录做成工程资产",
    "Windows 下的跨平台 npm scripts",
    "为什么先写项目章程，再写首页",
  ];
  const positions = titles.map((title) => html.indexOf(title));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
});

test("server-renders a content activity ledger from publish and update events", async () => {
  const response = await render("/activity");
  assert.equal(response.status, 200);

  const html = visibleDocument(await response.text()).replaceAll("<!-- -->", "");
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/blog\.example\.test\/activity"/u,
  );
  assert.match(html, /8 EVENTS \/ 4 PUBLISHED \/ 4 UPDATED/u);
  assert.equal((html.match(/data-activity-day="true"/gu) ?? []).length, 5);
  assert.equal((html.match(/data-activity-mode="published"/gu) ?? []).length, 4);
  assert.equal((html.match(/data-activity-mode="updated"/gu) ?? []).length, 4);
  assert.equal((html.match(/data-activity-event="true"/gu) ?? []).length, 8);
  assert.match(html, /<time dateTime="2026-08-06">/u);
  assert.match(html, /UPDATED[\s\S]*?内容更新 · Project[\s\S]*?MyBlog — 把学习记录做成工程资产/u);
  assert.match(html, /PUBLISHED[\s\S]*?首次发布 · Article/u);
  assert.match(html, /REVIEWED[\s\S]*?不等同于内容发生变化/u);
  assert.doesNotMatch(html, /data-activity-mode="reviewed"/u);
  assert.ok(html.indexOf("2026-08-06") < html.indexOf("2026-07-18"));
  assert.match(html, /href="\/archive"/u);
});

test("keeps visible and machine breadcrumbs identical on every detail route", async () => {
  const routeExpectations = [
    [
      "/posts/building-a-maintainable-blog",
      [
        { href: "/", name: "首页" },
        { href: "/posts", name: "文章" },
        {
          href: "/posts/building-a-maintainable-blog",
          name: "从零搭建可维护的个人技术博客",
        },
      ],
    ],
    [
      "/projects/myblog",
      [
        { href: "/", name: "首页" },
        { href: "/projects", name: "项目" },
        { href: "/projects/myblog", name: "MyBlog — 把学习记录做成工程资产" },
      ],
    ],
    [
      "/series/build-my-blog",
      [
        { href: "/", name: "首页" },
        { href: "/series", name: "专题" },
        { href: "/series/build-my-blog", name: "从零构建个人博客" },
      ],
    ],
    [
      "/tags/typescript",
      [
        { href: "/", name: "首页" },
        { href: "/tags", name: "标签" },
        { href: "/tags/typescript", name: "TypeScript" },
      ],
    ],
  ];

  for (const [pathname, items] of routeExpectations) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = visibleDocument(await response.text()).replaceAll("<!-- -->", "");
    const documents = structuredDataByType(html, "BreadcrumbList");
    assert.equal(documents.length, 1, `${pathname} BreadcrumbList count`);
    assert.deepEqual(documents[0], expectedBreadcrumbList(items), pathname);

    const nav = html.match(
      /<nav class="breadcrumbs" aria-label="面包屑">([\s\S]*?)<\/nav>/u,
    )?.[1];
    assert.ok(nav, `${pathname} visible breadcrumbs`);
    for (const item of items.slice(0, -1)) {
      assert.ok(
        nav.includes(`<a href="${item.href}">${item.name}</a>`),
        `${pathname} visible link ${item.name}`,
      );
    }
    const current = items.at(-1);
    assert.ok(
      nav.includes(`<span aria-current="page">${current.name}</span>`),
      `${pathname} visible current item`,
    );
  }

  for (const pathname of [
    "/posts/structured-data-missing",
    "/projects/structured-data-missing",
    "/series/structured-data-missing",
    "/tags/structured-data-missing",
  ]) {
    const response = await render(pathname);
    assert.equal(response.status, 404, pathname);
    assert.equal(
      structuredDataByType(await response.text(), "BreadcrumbList").length,
      0,
      pathname,
    );
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
  assert.match(html, /PROJECT \/ UPDATED \/ 2026-08-06/u);
  assert.match(html, /POST \/ UPDATED \/ 2026-08-05/u);
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
  const visibleHtml = visibleDocument(html);
  assert.match(
    visibleHtml,
    /<section class="content-recommendations" aria-labelledby="related-content-title">/,
  );
  assert.match(visibleHtml, /id="related-content-title">继续阅读<\/h2>/);
  assert.equal(
    (visibleHtml.match(/class="content-recommendation"/g) ?? []).length,
    2,
  );
  assert.match(visibleHtml, /双向引用/);
  assert.match(visibleHtml, /同专题 · 从零构建个人博客/);
  assert.match(visibleHtml, /共同标签 · Next\.js \/ TypeScript \/ Design Systems/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"mainEntityOfPage":"https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog"/);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog"/,
  );
  assert.match(
    html,
    /<link(?=[^>]*rel="alternate")(?=[^>]*type="text\/markdown")(?=[^>]*href="https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog\/source\.md")[^>]*>/u,
  );
  assert.match(
    html,
    /<a(?=[^>]*class="markdown-source-url")(?=[^>]*href="https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog\/source\.md")[^>]*>/u,
  );
  assert.match(
    html.replaceAll("<!-- -->", ""),
    /<p class="print-source">Source \/ <a href="https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog">https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog<\/a><\/p>/,
  );
  assert.match(
    html,
    /<section(?=[^>]*class="content-share")(?=[^>]*data-action="none")(?=[^>]*data-share-enhanced="false")(?=[^>]*data-state="idle")[^>]*>/u,
  );
  assert.match(
    html,
    /<a(?=[^>]*class="share-url")(?=[^>]*href="https:\/\/blog\.example\.test\/posts\/building-a-maintainable-blog")[^>]*>/u,
  );
  assert.match(
    html,
    /<div class="share-ops" hidden="">[\s\S]*?<button(?=[^>]*class="share-button share-button-main")(?=[^>]*type="button")[^>]*>/u,
  );
  assert.equal(
    (html.match(/<button(?=[^>]*class="share-button [^"]+")[^>]*>/gu) ?? [])
      .length,
    2,
  );
  assert.match(
    html,
    /<button(?=[^>]*class="share-button share-button-md")(?=[^>]*type="button")[^>]*>/u,
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
  const isolatedHtml = visibleDocument(await isolatedResponse.text());
  assert.doesNotMatch(isolatedHtml, /class="content-relations"/);
  assert.match(isolatedHtml, /class="content-recommendations"/);
  assert.equal(
    (isolatedHtml.match(/class="content-recommendation"/g) ?? []).length,
    2,
  );

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
    /<a(?=[^>]*class="share-url")(?=[^>]*href="https:\/\/blog\.example\.test\/projects\/myblog")[^>]*>/u,
  );
  assert.match(
    projectHtml,
    /<div class="share-ops" hidden="">[\s\S]*?<button(?=[^>]*class="share-button share-button-main")(?=[^>]*type="button")[^>]*>/u,
  );
  assert.match(
    projectHtml,
    /<button(?=[^>]*class="share-button share-button-md")(?=[^>]*type="button")[^>]*>/u,
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
  const visibleProjectHtml = visibleDocument(projectHtml);
  assert.match(visibleProjectHtml, /class="content-recommendations"/);
  assert.equal(
    (visibleProjectHtml.match(/class="content-recommendation"/g) ?? []).length,
    3,
  );
  assert.equal(
    (visibleProjectHtml.match(/class="content-recommendation-trace"/g) ?? []).length,
    3,
  );
  assert.match(visibleProjectHtml, /共同标签 · Design Systems/);
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
  assert.match(await missingResponse.text(), /这条轨迹在这里中断。/);
});

test("server-renders a shareable search query against posts and projects", async () => {
  const searchExperienceSource = await readFile(
    new URL("../components/SearchExperience.tsx", import.meta.url),
    "utf8",
  );
  assert.match(searchExperienceSource, /<mark className="search-hit"/u);
  assert.doesNotMatch(searchExperienceSource, /dangerouslySetInnerHTML/u);

  const response = await render("/search?q=cloudflare");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /name="q"/);
  assert.match(html, /value="cloudflare"/);
  assert.match(html, /Cloudflare/);
  assert.match(html, /MyBlog — 把学习记录做成工程资产/);
  assert.match(html, /NO TRACKING/);
  assert.match(
    html,
    /<span class="search-result-date"><span>UPDATED<\/span><time dateTime="2026-08-06">2026-08-06<\/time><\/span>/u,
  );
  assert.match(html, /<mark class="search-hit">Cloudflare<\/mark>/u);
  assert.match(
    html,
    /<span class="search-evidence-source">(?:摘要|正文)<\/span>/u,
  );
  assert.match(html, /匹配(?:标题|标签|摘要|正文)/u);
  assert.match(
    html,
    /<link(?=[^>]*rel="search")(?=[^>]*type="application\/opensearchdescription\+xml")(?=[^>]*href="https:\/\/blog\.example\.test\/opensearch\.xml")[^>]*>/i,
  );

  const bodyMatchResponse = await render("/search?q=Wrangler");
  assert.equal(bodyMatchResponse.status, 200);
  const bodyMatchHtml = await bodyMatchResponse.text();
  assert.match(bodyMatchHtml, /value="Wrangler"/u);
  assert.match(bodyMatchHtml, /<mark class="search-hit">Wrangler<\/mark>/u);
  assert.match(
    bodyMatchHtml,
    /<span class="search-evidence-source">正文<\/span>/u,
  );

  const emptyResponse = await render("/search?q=B_i");
  assert.equal(emptyResponse.status, 200);
  const emptyHtml = await emptyResponse.text();
  assert.match(emptyHtml, /“B_i” 找到 0 条记录/u);
  assert.doesNotMatch(emptyHtml, /<mark class="search-hit">/u);
});

test("publishes the structured discovery suite from one public origin", async (context) => {
  const [manifestResponse, schemaResponse, jsonFeedResponse, rssResponse, sitemapResponse, robotsResponse, openSearchResponse] = await Promise.all([
    render("/content.json", { accept: "application/json" }),
    render("/content.schema.json", { accept: "application/schema+json" }),
    render("/feed.json"),
    render("/rss.xml"),
    render("/sitemap.xml"),
    render("/robots.txt"),
    render("/opensearch.xml"),
  ]);

  assert.equal(manifestResponse.status, 200);
  assert.match(
    manifestResponse.headers.get("content-type") ?? "",
    /^application\/json;\s*charset=utf-8$/i,
  );
  assert.equal(
    manifestResponse.headers.get("cache-control"),
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );
  assert.equal(
    manifestResponse.headers.get("content-disposition"),
    'inline; filename="content.json"',
  );
  assert.equal(manifestResponse.headers.get("x-robots-tag"), "noindex");
  assert.equal(
    manifestResponse.headers.get("link"),
    '<https://blog.example.test/content.json>; rel="self"; type="application/json", <https://blog.example.test/content.schema.json>; rel="describedby"; type="application/schema+json", <https://blog.example.test/>; rel="up"; type="text/html"',
  );
  const manifestEtag = manifestResponse.headers.get("etag");
  const manifestSource = await manifestResponse.text();
  assert.equal(
    manifestEtag,
    `"sha256-${createHash("sha256").update(manifestSource, "utf8").digest("hex")}"`,
  );
  assert.ok(Number.isFinite(Date.parse(manifestResponse.headers.get("last-modified") ?? "")));
  const manifest = JSON.parse(manifestSource);
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
  assert.ok(manifest.items.length >= 4);
  assert.ok(
    manifest.items.every(
      (item) =>
        item.id === item.html_url &&
        item.markdown_url === `${item.html_url}/source.md` &&
        /^(?:post|project)$/u.test(item.kind) &&
        /^(?:article|til|project)$/u.test(item.type) &&
        /^"sha256-[0-9a-f]{64}"$/u.test(item.markdown_etag) &&
        /^\d{4}-\d{2}-\d{2}$/u.test(item.published_at) &&
        /^\d{4}-\d{2}-\d{2}$/u.test(item.reviewed_at) &&
        Array.isArray(item.tags) &&
        !Reflect.has(item, "body") &&
        !Reflect.has(item, "draft") &&
        !Reflect.has(item, "sourcePath"),
    ),
  );
  const manifestSourceResponses = await Promise.all(
    manifest.items.map((item) =>
      render(new URL(item.markdown_url).pathname, { accept: "text/markdown" }),
    ),
  );
  for (const [index, response] of manifestSourceResponses.entries()) {
    assert.equal(response.status, 200, manifest.items[index].markdown_url);
    assert.equal(response.headers.get("etag"), manifest.items[index].markdown_etag);
    await response.body?.cancel();
  }
  const conditionalManifest = await render("/content.json", {
    accept: "application/json",
    headers: { "if-none-match": manifestEtag },
  });
  assert.equal(conditionalManifest.status, 304);
  assert.equal(await conditionalManifest.text(), "");
  assert.equal(conditionalManifest.headers.get("etag"), manifestEtag);

  assert.equal(schemaResponse.status, 200);
  assert.match(
    schemaResponse.headers.get("content-type") ?? "",
    /^application\/schema\+json;\s*charset=utf-8$/i,
  );
  assert.equal(
    schemaResponse.headers.get("cache-control"),
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );
  assert.equal(
    schemaResponse.headers.get("content-disposition"),
    'inline; filename="content.schema.json"',
  );
  assert.equal(schemaResponse.headers.get("x-robots-tag"), "noindex");
  assert.equal(
    schemaResponse.headers.get("link"),
    '<https://blog.example.test/content.schema.json>; rel="self"; type="application/schema+json", <https://blog.example.test/content.json>; rel="describes"; type="application/json", <https://blog.example.test/>; rel="up"; type="text/html"',
  );
  const schemaEtag = schemaResponse.headers.get("etag");
  const schemaSource = await schemaResponse.text();
  assert.equal(
    schemaEtag,
    `"sha256-${createHash("sha256").update(schemaSource, "utf8").digest("hex")}"`,
  );
  const schema = JSON.parse(schemaSource);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "https://blog.example.test/content.schema.json");
  assert.deepEqual(schema.properties.version, { const: 1 });
  assert.deepEqual(schema.properties.manifest_url, {
    const: "https://blog.example.test/content.json",
  });
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.item.additionalProperties, false);
  const conditionalSchema = await render("/content.schema.json", {
    accept: "application/schema+json",
    headers: { "if-none-match": schemaEtag },
  });
  assert.equal(conditionalSchema.status, 304);
  assert.equal(await conditionalSchema.text(), "");
  assert.equal(conditionalSchema.headers.get("etag"), schemaEtag);

  assert.equal(jsonFeedResponse.status, 200);
  assert.match(
    jsonFeedResponse.headers.get("content-type") ?? "",
    /^application\/feed\+json;\s*charset=utf-8$/i,
  );
  assert.equal(
    jsonFeedResponse.headers.get("cache-control"),
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  const jsonFeedSource = await jsonFeedResponse.text();
  const jsonFeedEtag = jsonFeedResponse.headers.get("etag");
  const jsonFeedLastModified = jsonFeedResponse.headers.get("last-modified");
  assert.equal(jsonFeedLastModified, "Thu, 06 Aug 2026 10:09:53 GMT");
  assert.equal(
    jsonFeedEtag,
    `"sha256-${createHash("sha256").update(jsonFeedSource, "utf8").digest("hex")}"`,
  );
  const jsonFeed = JSON.parse(jsonFeedSource);
  assert.equal(jsonFeed.version, "https://jsonfeed.org/version/1.1");
  assert.equal(jsonFeed.home_page_url, "https://blog.example.test/");
  assert.equal(jsonFeed.feed_url, "https://blog.example.test/feed.json");
  assert.equal(jsonFeed.language, "zh-CN");
  assert.deepEqual(jsonFeed.authors, [
    { name: "Zach424", url: "https://github.com/Zach424" },
  ]);
  assert.ok(jsonFeed.items.every((item) => typeof item.content_text === "string" && item.content_text.length > 0));
  assert.ok(jsonFeed.items.every((item) => item.id === item.url));
  assert.ok(jsonFeed.items.every((item) => !Reflect.has(item, "body") && !Reflect.has(item, "draft")));
  const projectFeedItem = jsonFeed.items.find(
    (item) => item.id === "https://blog.example.test/projects/myblog",
  );
  assert.ok(projectFeedItem);
  assert.equal(
    projectFeedItem.banner_image,
    "https://blog.example.test/uploads/myblog/cover.webp",
  );
  assert.match(projectFeedItem.content_text, /证据/u);
  assert.match(projectFeedItem.date_modified, /^\d{4}-\d{2}-\d{2}T00:00:00Z$/u);
  const jsonFeedUrls = jsonFeed.items.map((item) => item.id);
  assert.deepEqual(
    manifest.items.map((item) => item.id),
    jsonFeedUrls,
    "公开内容清单与 JSON Feed 必须保持同一公开顺序",
  );
  assert.equal(new Set(jsonFeedUrls).size, jsonFeedUrls.length, "JSON Feed 内容 URL 不能重复");

  assert.equal(rssResponse.status, 200);
  assert.match(rssResponse.headers.get("content-type") ?? "", /^application\/rss\+xml/i);
  assert.equal(
    rssResponse.headers.get("cache-control"),
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  const rss = await rssResponse.text();
  const rssEtag = rssResponse.headers.get("etag");
  const rssLastModified = rssResponse.headers.get("last-modified");
  assert.equal(rssLastModified, "Mon, 10 Aug 2026 21:26:25 GMT");
  assert.equal(
    rssEtag,
    `"sha256-${createHash("sha256").update(rss, "utf8").digest("hex")}"`,
  );
  assert.match(rss, /https:\/\/blog\.example\.test\/rss\.xml/);
  assert.match(
    rss,
    /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom" xmlns:dcterms="http:\/\/purl\.org\/dc\/terms\/">/u,
  );
  assert.doesNotMatch(rss, /<atom:updated>/u);
  assert.match(rss, /从零搭建可维护的个人技术博客/);
  assert.match(rss, /MyBlog — 把学习记录做成工程资产/);
  const rssItems = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map(
    (match) => match[1],
  );
  const rssUrls = rssItems.map(
    (item) =>
      item.match(/<guid isPermaLink="true">([^<]+)<\/guid>/u)?.[1] ?? "",
  );
  assert.ok(rssUrls.length >= 4, "RSS 至少应包含初始公开内容");
  assert.equal(new Set(rssUrls).size, rssUrls.length, "RSS 内容 URL 不能重复");
  assert.deepEqual(jsonFeedUrls, rssUrls, "JSON Feed 与 RSS 必须保持同一公开顺序");
  for (const [index, item] of rssItems.entries()) {
    const feedItem = jsonFeed.items[index];
    const modifiedDates = [
      ...item.matchAll(/<dcterms:modified>([^<]+)<\/dcterms:modified>/gu),
    ].map((match) => match[1]);
    const expectedModified =
      feedItem.date_modified && feedItem.date_modified > feedItem.date_published
        ? feedItem.date_modified
        : undefined;

    assert.match(
      item,
      new RegExp(`<pubDate>${new Date(feedItem.date_published).toUTCString()}</pubDate>`, "u"),
      "RSS pubDate 必须继续表达 JSON Feed 的首发时间",
    );
    assert.deepEqual(
      modifiedDates,
      expectedModified ? [expectedModified] : [],
      "RSS dcterms:modified 必须与严格更晚的 JSON Feed 修改时间一致",
    );
  }

  assert.equal(sitemapResponse.status, 200);
  assert.match(sitemapResponse.headers.get("content-type") ?? "", /^application\/xml/i);
  assert.equal(
    sitemapResponse.headers.get("cache-control"),
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  const sitemap = await sitemapResponse.text();
  const sitemapEtag = sitemapResponse.headers.get("etag");
  assert.equal(
    sitemapEtag,
    `"sha256-${createHash("sha256").update(sitemap, "utf8").digest("hex")}"`,
  );
  assert.match(sitemap, /https:\/\/blog\.example\.test\/search/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/knowledge/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/archive/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/activity/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/subscribe/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/tags\/typescript/);
  assert.match(sitemap, /https:\/\/blog\.example\.test\/series\/build-my-blog/);
  assert.doesNotMatch(sitemap, /opensearch\.xml/u);
  const sitemapContentUrls = [
    ...sitemap.matchAll(
      /<loc>(https:\/\/blog\.example\.test\/(?:posts|projects)\/[^<]+)<\/loc>/gu,
    ),
  ].map((match) => match[1]);
  assert.deepEqual(
    [...sitemapContentUrls].sort(),
    [...rssUrls].sort(),
    "JSON Feed、RSS 与 Sitemap 必须来自同一份公开内容索引",
  );

  assert.equal(robotsResponse.status, 200);
  assert.match(robotsResponse.headers.get("content-type") ?? "", /^text\/plain/i);
  assert.equal(
    robotsResponse.headers.get("cache-control"),
    "public, max-age=86400",
  );
  const robots = await robotsResponse.text();
  const robotsEtag = robotsResponse.headers.get("etag");
  assert.equal(
    robotsEtag,
    `"sha256-${createHash("sha256").update(robots, "utf8").digest("hex")}"`,
  );
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/blog\.example\.test\/sitemap\.xml/);

  assert.equal(openSearchResponse.status, 200);
  assert.equal(
    openSearchResponse.headers.get("content-type"),
    "application/opensearchdescription+xml; charset=utf-8",
  );
  assert.equal(
    openSearchResponse.headers.get("cache-control"),
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  assert.equal(
    openSearchResponse.headers.get("content-disposition"),
    'inline; filename="opensearch.xml"',
  );
  assert.equal(openSearchResponse.headers.get("x-robots-tag"), "noindex");
  const openSearch = await openSearchResponse.text();
  const openSearchEtag = openSearchResponse.headers.get("etag");
  assert.equal(
    openSearchEtag,
    `"sha256-${createHash("sha256").update(openSearch, "utf8").digest("hex")}"`,
  );
  assert.match(
    openSearch,
    /<OpenSearchDescription xmlns="http:\/\/a9\.com\/-\/spec\/opensearch\/1\.1\/">/u,
  );
  assert.match(openSearch, /<ShortName>Zach424 Notes<\/ShortName>/u);
  assert.match(
    openSearch,
    /<Url type="text\/html" rel="results" template="https:\/\/blog\.example\.test\/search\?q=\{searchTerms\}" \/>/u,
  );
  assert.match(
    openSearch,
    /<Url type="application\/opensearchdescription\+xml" rel="self" template="https:\/\/blog\.example\.test\/opensearch\.xml" \/>/u,
  );
  assert.match(openSearch, /<Query role="example" searchTerms="typescript" \/>/u);
  assert.match(openSearch, /<Language>zh-CN<\/Language>/u);

  const discoveryBudgetReports = [
    measureDiscoveryBudget({ pathname: "/content.json", body: manifestSource }),
    measureDiscoveryBudget({
      pathname: "/content.schema.json",
      body: schemaSource,
    }),
    measureDiscoveryBudget({ pathname: "/feed.json", body: jsonFeedSource }),
    measureDiscoveryBudget({ pathname: "/rss.xml", body: rss }),
    measureDiscoveryBudget({ pathname: "/sitemap.xml", body: sitemap }),
    measureDiscoveryBudget({ pathname: "/robots.txt", body: robots }),
    measureDiscoveryBudget({ pathname: "/opensearch.xml", body: openSearch }),
  ];
  context.diagnostic(formatDiscoveryBudgetReport(discoveryBudgetReports));
  assertDiscoveryBudgetCoverage(discoveryBudgetReports);
  assertDiscoveryBudgets(discoveryBudgetReports);

  const conditionalOpenSearch = await render("/opensearch.xml", {
    headers: { "if-none-match": `W/${openSearchEtag}` },
  });
  assert.equal(conditionalOpenSearch.status, 304);
  assert.equal(await conditionalOpenSearch.text(), "");
  assert.equal(conditionalOpenSearch.headers.get("etag"), openSearchEtag);
  assert.equal(
    conditionalOpenSearch.headers.get("cache-control"),
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  assert.equal(
    conditionalOpenSearch.headers.get("content-type"),
    "application/opensearchdescription+xml; charset=utf-8",
  );
  assert.equal(
    conditionalOpenSearch.headers.get("content-disposition"),
    'inline; filename="opensearch.xml"',
  );
  assert.equal(conditionalOpenSearch.headers.get("x-robots-tag"), "noindex");

  const conditionalDiscoveryResponses = await Promise.all([
    render("/feed.json", {
      headers: { "if-none-match": `W/${jsonFeedEtag}` },
    }),
    render("/rss.xml", {
      headers: { "if-none-match": `W/${rssEtag}` },
    }),
    render("/sitemap.xml", {
      headers: { "if-none-match": `W/${sitemapEtag}` },
    }),
    render("/robots.txt", {
      headers: { "if-none-match": `W/${robotsEtag}` },
    }),
  ]);
  for (const [index, response] of conditionalDiscoveryResponses.entries()) {
    const [pathname, etag, cacheControl, contentType, lastModified] = [
      [
        "/feed.json",
        jsonFeedEtag,
        "public, max-age=3600, stale-while-revalidate=86400",
        "application/feed+json; charset=utf-8",
        jsonFeedLastModified,
      ],
      [
        "/rss.xml",
        rssEtag,
        "public, max-age=3600, stale-while-revalidate=86400",
        "application/rss+xml; charset=utf-8",
        rssLastModified,
      ],
      [
        "/sitemap.xml",
        sitemapEtag,
        "public, max-age=3600, stale-while-revalidate=86400",
        "application/xml; charset=utf-8",
        null,
      ],
      [
        "/robots.txt",
        robotsEtag,
        "public, max-age=86400",
        "text/plain; charset=utf-8",
        null,
      ],
    ][index];
    assert.equal(response.status, 304, pathname);
    assert.equal(await response.text(), "", pathname);
    assert.equal(response.headers.get("etag"), etag, pathname);
    assert.equal(response.headers.get("cache-control"), cacheControl, pathname);
    assert.equal(response.headers.get("content-type"), contentType, pathname);
    assert.equal(response.headers.get("last-modified"), lastModified, pathname);
  }

  const [jsonDateMatch, rssDateMatch, staleTagWins, malformedDate] =
    await Promise.all([
      render("/feed.json", {
        headers: { "if-modified-since": jsonFeedLastModified },
      }),
      render("/rss.xml", {
        headers: { "if-modified-since": rssLastModified },
      }),
      render("/feed.json", {
        headers: {
          "if-none-match": '"sha256-stale"',
          "if-modified-since": jsonFeedLastModified,
        },
      }),
      render("/rss.xml", {
        headers: { "if-modified-since": "2026-08-10T21:26:25Z" },
      }),
    ]);

  for (const [pathname, response, etag, lastModified] of [
    ["/feed.json", jsonDateMatch, jsonFeedEtag, jsonFeedLastModified],
    ["/rss.xml", rssDateMatch, rssEtag, rssLastModified],
  ]) {
    assert.equal(response.status, 304, pathname);
    assert.equal(await response.text(), "", pathname);
    assert.equal(response.headers.get("etag"), etag, pathname);
    assert.equal(response.headers.get("last-modified"), lastModified, pathname);
  }
  assert.equal(staleTagWins.status, 200);
  assert.equal(await staleTagWins.text(), jsonFeedSource);
  assert.equal(malformedDate.status, 200);
  assert.equal(await malformedDate.text(), rss);
});

test("publishes portable Markdown sources without author-only fields", async () => {
  const [postResponse, projectResponse, missingResponse] = await Promise.all([
    render("/posts/building-a-maintainable-blog/source.md"),
    render("/projects/myblog/source.md"),
    render("/posts/not-a-public-record/source.md"),
  ]);

  for (const [response, slug, canonical, lastModified] of [
    [
      postResponse,
      "building-a-maintainable-blog",
      "https://blog.example.test/posts/building-a-maintainable-blog",
      "Wed, 05 Aug 2026 00:00:00 GMT",
    ],
    [
      projectResponse,
      "myblog",
      "https://blog.example.test/projects/myblog",
      "Thu, 06 Aug 2026 00:00:00 GMT",
    ],
  ]) {
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/markdown;\s*charset=utf-8$/iu);
    assert.equal(
      response.headers.get("content-disposition"),
      `inline; filename="${slug}.md"`,
    );
    assert.equal(
      response.headers.get("cache-control"),
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
    assert.equal(
      response.headers.get("link"),
      `<${canonical}>; rel="canonical"; type="text/html"`,
    );
    assert.match(
      response.headers.get("etag") ?? "",
      /^"sha256-[0-9a-f]{64}"$/u,
    );
    assert.equal(response.headers.get("last-modified"), lastModified);
  }

  const postSource = await postResponse.text();
  const postEtag = postResponse.headers.get("etag");
  assert.equal(
    postEtag,
    `"sha256-${createHash("sha256").update(postSource, "utf8").digest("hex")}"`,
  );
  const postMatch = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/u.exec(postSource);
  assert.ok(postMatch);
  const postFrontmatter = parseYaml(postMatch[1]);
  assert.equal(
    postFrontmatter.canonical,
    "https://blog.example.test/posts/building-a-maintainable-blog",
  );
  assert.equal(postFrontmatter.draft, undefined);
  assert.equal(postFrontmatter.featured, undefined);
  assert.equal(postFrontmatter.sourcePath, undefined);
  assert.match(
    postMatch[2],
    /https:\/\/blog\.example\.test\/projects\/myblog#vercel-/u,
  );
  assert.match(
    postMatch[2],
    /https:\/\/blog\.example\.test\/uploads\/building-a-maintainable-blog\/content-delivery-pipeline\.webp/u,
  );

  const projectSource = await projectResponse.text();
  const projectMatch = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/u.exec(projectSource);
  assert.ok(projectMatch);
  const projectFrontmatter = parseYaml(projectMatch[1]);
  assert.equal(projectFrontmatter.type, "project");
  assert.equal(projectFrontmatter.canonical, "https://blog.example.test/projects/myblog");
  assert.equal(
    projectFrontmatter.cover,
    "https://blog.example.test/uploads/myblog/cover.webp",
  );
  assert.equal(projectFrontmatter.draft, undefined);
  assert.equal(missingResponse.status, 404);
  assert.equal(missingResponse.headers.get("cache-control"), "no-store");

  const conditionalResponse = await render(
    "/posts/building-a-maintainable-blog/source.md",
    {
      accept: "text/markdown",
      headers: { "if-none-match": postEtag },
    },
  );
  assert.equal(conditionalResponse.status, 304);
  assert.equal(await conditionalResponse.text(), "");
  assert.equal(conditionalResponse.headers.get("etag"), postEtag);
  assert.equal(
    conditionalResponse.headers.get("last-modified"),
    "Wed, 05 Aug 2026 00:00:00 GMT",
  );
  assert.equal(
    conditionalResponse.headers.get("cache-control"),
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );
  assert.equal(
    conditionalResponse.headers.get("link"),
    '<https://blog.example.test/posts/building-a-maintainable-blog>; rel="canonical"; type="text/html"',
  );
  assert.equal(conditionalResponse.headers.get("x-robots-tag"), "noindex");
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
  assert.match(layout, /SITE_LANGUAGE/u);
  assert.match(layout, /<html lang=\{SITE_LANGUAGE\}>/u);
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
