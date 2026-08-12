import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  assertHtmlBudgetCoverage,
  assertHtmlBudgets,
  formatHtmlBudgetReport,
  HTML_ROUTE_BASELINES,
  measureHtmlBudget,
} from "./html-budget.mjs";
import {
  assertDiscoveryBudgetCoverage,
  assertDiscoveryBudgets,
  formatDiscoveryBudgetReport,
  measureDiscoveryBudget,
} from "./discovery-budget.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function visibleDocument(html) {
  const documentEnd = html.indexOf("</html>");
  return documentEnd >= 0 ? html.slice(0, documentEnd + 7) : html;
}

function extractContentIndexPaths(html) {
  const list = visibleDocument(html).match(
    /<div class="content-index-list">([\s\S]*?)<\/div>/u,
  )?.[1];
  if (!list) return [];
  return [
    ...list.matchAll(/<a class="content-index-row" href="([^"]+)"/gu),
  ].map((match) => match[1]);
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

function assertBreadcrumbList(origin, pathname, html, items) {
  const documents = structuredDataByType(html, "BreadcrumbList");
  invariant(documents.length === 1, `${pathname} BreadcrumbList 数量异常`);
  const expected = items.map((entry, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: entry.name,
    item: new URL(entry.href, origin).href,
  }));
  invariant(
    documents[0]["@context"] === "https://schema.org" &&
      JSON.stringify(documents[0].itemListElement) === JSON.stringify(expected),
    `${pathname} BreadcrumbList 路径异常`,
  );

  const nav = visibleDocument(html)
    .replaceAll("<!-- -->", "")
    .match(/<nav class="breadcrumbs" aria-label="面包屑">([\s\S]*?)<\/nav>/u)?.[1];
  invariant(Boolean(nav), `${pathname} 缺少可见面包屑`);
  for (const entry of items.slice(0, -1)) {
    invariant(
      nav.includes(`<a href="${entry.href}">${entry.name}</a>`),
      `${pathname} 可见面包屑链接异常`,
    );
  }
  invariant(
    nav.includes(`<span aria-current="page">${items.at(-1).name}</span>`),
    `${pathname} 可见当前面包屑异常`,
  );
}

function assertWebsiteIdentity(origin, html) {
  const documents = structuredDataByType(html, "WebSite");
  invariant(documents.length === 1, "首页 WebSite 数量异常");
  const siteRoot = new URL("/", origin).href;
  const expected = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteRoot}#website`,
    name: "Zach424 / Engineering Notes",
    url: siteRoot,
    description:
      "记录学习路径、技术取舍和项目复盘，把写过的代码变成可复用的判断。",
    inLanguage: "zh-CN",
  };
  invariant(
    JSON.stringify(documents[0]) === JSON.stringify(expected) &&
      !JSON.stringify(documents[0]).includes("SearchAction"),
    "首页 WebSite 站点身份异常",
  );
}

function assertContentIdentity(origin, htmlPages) {
  const siteId = `${new URL("/", origin).href}#website`;
  const expectations = [
    {
      pathname: "/posts/building-a-maintainable-blog",
      type: "BlogPosting",
      pageProperty: "mainEntityOfPage",
      identityError: "文章结构化身份异常",
      websiteError: "文章 WebSite 引用异常",
      readingStats: { timeRequired: "PT4M", wordCount: 899 },
    },
    {
      pathname: "/projects/myblog",
      type: "SoftwareSourceCode",
      pageProperty: "url",
      identityError: "项目结构化身份异常",
      websiteError: "项目 WebSite 引用异常",
    },
  ];

  for (const expectation of expectations) {
    const canonical = new URL(expectation.pathname, origin).href;
    const documents = structuredDataByType(
      htmlPages.get(expectation.pathname)?.body ?? "",
      expectation.type,
    );
    const document = documents[0];
    invariant(
      documents.length === 1 &&
        document?.["@context"] === "https://schema.org" &&
        document?.["@id"] === `${canonical}#content` &&
        document?.url === canonical &&
        document?.[expectation.pageProperty] === canonical &&
        document?.inLanguage === "zh-CN" &&
        (expectation.readingStats
          ? document?.wordCount === expectation.readingStats.wordCount &&
            document?.timeRequired === expectation.readingStats.timeRequired
          : !Object.hasOwn(document ?? {}, "wordCount") &&
            !Object.hasOwn(document ?? {}, "timeRequired")),
      expectation.identityError,
    );
    invariant(
      JSON.stringify(document.isPartOf) ===
        JSON.stringify({ "@id": siteId }),
      expectation.websiteError,
    );
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function fetchWithRetry(url, init = {}, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(30_000),
      });
      if (!RETRYABLE_STATUS.has(response.status) || attempt === attempts) return response;
      await response.body?.cancel();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
  }

  throw new Error(
    `${new URL(url).pathname} 请求失败：${lastError instanceof Error ? lastError.message : String(lastError)}`,
    { cause: lastError },
  );
}

export function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
}

function decodeXmlText(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function extractOpmlSubscriptions(xml) {
  return [...xml.matchAll(/<outline (?=[^>]*\btype="rss")([^>]*)\/>/gu)].map(
    (match) =>
      Object.fromEntries(
        [...match[1].matchAll(/([A-Za-z]+)="([^"]*)"/gu)].map(
          (attribute) => [attribute[1], decodeXmlText(attribute[2])],
        ),
      ),
  );
}

function extractOpmlGroupSubscriptions(xml, label) {
  const group = xml.match(
    new RegExp(`<outline text="${label}">([\\s\\S]*?)<\\/outline>`, "u"),
  )?.[1];
  return group ? extractOpmlSubscriptions(group) : [];
}

function extractRssItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map((match) => {
    const item = match[1];
    return {
      guid:
        item.match(/<guid isPermaLink="true">([^<]+)<\/guid>/u)?.[1] ?? "",
      modifiedDates: [
        ...item.matchAll(
          /<dcterms:modified>([^<]+)<\/dcterms:modified>/gu,
        ),
      ].map((modifiedMatch) => modifiedMatch[1]),
      categories: [...item.matchAll(/<category>([^<]+)<\/category>/gu)].map(
        (categoryMatch) => decodeXmlText(categoryMatch[1]),
      ),
      pubDate: item.match(/<pubDate>([^<]+)<\/pubDate>/u)?.[1] ?? "",
    };
  });
}

function extractAtomEntries(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gu)].map((match) => {
    const entry = match[1];
    return {
      categories: [...entry.matchAll(/<category term="([^"]+)" \/>/gu)].map(
        (categoryMatch) => decodeXmlText(categoryMatch[1]),
      ),
      content: decodeXmlText(
        entry.match(/<content type="text">([\s\S]*?)<\/content>/u)?.[1] ?? "",
      ),
      id: entry.match(/<id>([^<]+)<\/id>/u)?.[1] ?? "",
      published: entry.match(/<published>([^<]+)<\/published>/u)?.[1] ?? "",
      summary: decodeXmlText(
        entry.match(/<summary type="text">([\s\S]*?)<\/summary>/u)?.[1] ?? "",
      ),
      title: decodeXmlText(entry.match(/<title>([^<]+)<\/title>/u)?.[1] ?? ""),
      updated: entry.match(/<updated>([^<]+)<\/updated>/u)?.[1] ?? "",
    };
  });
}

function rssItemsMatchJsonFeed(rssItems, feedItems) {
  return (
    rssItems.length === feedItems.length &&
    rssItems.every((item, index) => {
      const feedItem = feedItems[index];
      const expectedModified =
        typeof feedItem?.date_modified === "string" &&
        feedItem.date_modified > feedItem.date_published
          ? [feedItem.date_modified]
          : [];

      return (
        item.guid === feedItem?.id &&
        item.pubDate === new Date(feedItem.date_published).toUTCString() &&
        JSON.stringify(item.modifiedDates) === JSON.stringify(expectedModified) &&
        JSON.stringify(item.categories) === JSON.stringify(feedItem.tags)
      );
    })
  );
}

function cacheDirectives(value) {
  if (typeof value !== "string") return false;

  const directives = new Map();
  for (const source of value.toLowerCase().split(",")) {
    const [name, directiveValue] = source.trim().split("=", 2);
    if (!name || directives.has(name)) return false;
    directives.set(name, directiveValue);
  }

  return directives;
}

export function hasJsonFeedCachePolicy(value) {
  const directives = cacheDirectives(value);
  if (!directives) return false;

  const staleWhileRevalidate = directives.get("stale-while-revalidate");
  return (
    directives.has("public") &&
    directives.get("max-age") === "3600" &&
    !directives.has("private") &&
    !directives.has("no-store") &&
    (staleWhileRevalidate === undefined || staleWhileRevalidate === "86400")
  );
}

export function hasMarkdownSourceCachePolicy(value) {
  const directives = cacheDirectives(value);
  if (!directives) return false;

  const hasCdnDirectives =
    directives.has("s-maxage") || directives.has("stale-while-revalidate");
  return (
    directives.has("public") &&
    directives.get("max-age") === "0" &&
    !directives.has("private") &&
    !directives.has("no-store") &&
    (!hasCdnDirectives ||
      (directives.get("s-maxage") === "3600" &&
        directives.get("stale-while-revalidate") === "86400"))
  );
}

export function hasMarkdownSourceEtag(value) {
  return /^(?:W\/)?"sha256-[0-9a-f]{64}"$/u.test(value ?? "");
}

export function sameMarkdownSourceEtag(left, right) {
  return (
    hasMarkdownSourceEtag(left) &&
    hasMarkdownSourceEtag(right) &&
    left.replace(/^W\//u, "") === right.replace(/^W\//u, "")
  );
}

function sha256Etag(body) {
  return `"sha256-${createHash("sha256").update(body, "utf8").digest("hex")}"`;
}

const HEAD_REPRESENTATION_HEADERS = [
  "content-disposition",
  "content-type",
  "last-modified",
  "link",
  "x-robots-tag",
];

function hasEquivalentHeadHeaders(source, candidate, optional = false) {
  return HEAD_REPRESENTATION_HEADERS.every((name) => {
    const expected = source.headers.get(name);
    const actual = candidate.headers.get(name);
    return optional ? actual === null || actual === expected : actual === expected;
  });
}

export function hasRobotsCachePolicy(value) {
  const directives = cacheDirectives(value);
  if (!directives) return false;

  return (
    directives.has("public") &&
    directives.get("max-age") === "86400" &&
    !directives.has("private") &&
    !directives.has("no-store")
  );
}

async function request(origin, pathname, options = {}) {
  const response = await fetchWithRetry(new URL(pathname, origin), {
    body: options.body,
    method: options.method,
    redirect: options.redirect ?? "follow",
    headers: {
      accept: options.accept ?? "text/html",
      ...options.headers,
    },
  });
  const body = await response.text();
  return { response, body };
}

export async function runProductionSmoke(originInput, { expectOAuth = false } = {}) {
  const origin = new URL(originInput);
  const isLoopback = origin.hostname === "localhost" || origin.hostname === "127.0.0.1";
  invariant(origin.protocol === "https:" || isLoopback, "生产地址必须使用 HTTPS");

  const home = await request(origin, "/");
  invariant(home.response.status === 200, `首页状态 ${home.response.status}`);
  invariant(home.body.includes("Zach424"), "首页缺少站点标识");
  invariant(home.body.includes(`${origin.origin}/og.png`), "首页 Open Graph 主机不正确");
  for (const header of ["content-security-policy", "x-content-type-options", "referrer-policy"]) {
    invariant(home.response.headers.has(header), `首页缺少 ${header}`);
  }
  invariant(
    home.body.includes('type="application/feed+json"') &&
      home.body.includes(`${origin.origin}/feed.json`),
    "首页缺少 JSON Feed 发现链接",
  );
  invariant(
    home.body.includes('type="application/json"') &&
      home.body.includes(`${origin.origin}/content.json`),
    "首页缺少公开内容清单发现链接",
  );
  invariant(
    home.body.includes('rel="search"') &&
      home.body.includes('type="application/opensearchdescription+xml"') &&
      home.body.includes(`${origin.origin}/opensearch.xml`),
    "首页缺少 OpenSearch 发现链接",
  );
  assertWebsiteIdentity(origin, home.body);
  const homeActivityStart = home.body.indexOf('data-home-activity="latest-three"');
  const homeActivityEnd = home.body.indexOf("</section>", homeActivityStart);
  const homeActivity = home.body.slice(homeActivityStart, homeActivityEnd);
  const homeActivityTitles = [
    "MyBlog — 把学习记录做成工程资产",
    "从零搭建可维护的个人技术博客",
    "为什么先写项目章程，再写首页",
  ];
  const homeActivityPositions = homeActivityTitles.map((title) => homeActivity.indexOf(title));
  invariant(
    homeActivityStart >= 0 &&
      homeActivityEnd > homeActivityStart &&
      (homeActivity.match(/data-home-activity-event="true"/gu) ?? []).length === 3 &&
      (homeActivity.match(/data-activity-mode="updated"/gu) ?? []).length === 3 &&
      homeActivityPositions.every((position) => position >= 0) &&
      homeActivityPositions.every(
        (position, index) => index === 0 || homeActivityPositions[index - 1] < position,
      ) &&
      homeActivity.includes('href="/activity"'),
    "首页最近活动摘要异常",
  );

  const htmlBudgetReports = [
    measureHtmlBudget({ pathname: "/", html: home.body }),
  ];
  const htmlPages = new Map([["/", home]]);

  for (const [pathname, marker] of [
    ["/posts", "文章与 TIL"],
    ["/projects", "项目复盘"],
    ["/archive", "时间档案"],
    ["/activity", "内容活动"],
    ["/subscribe", "订阅与开放接口"],
    ["/knowledge", "知识之间，应该看得见来路"],
    ["/posts/building-a-maintainable-blog", "从零搭建可维护的个人技术博客"],
    ["/projects/myblog", "MyBlog"],
    ["/series/build-my-blog", "从零搭建可维护的个人技术博客"],
    ["/tags/typescript", "TypeScript"],
    ["/search?q=cloudflare", "Cloudflare"],
    ["/about", "学习不是收藏答案，而是更新判断"],
  ]) {
    const page = await request(origin, pathname);
    invariant(page.response.status === 200, `${pathname} 状态 ${page.response.status}`);
    invariant(page.body.includes(marker), `${pathname} 缺少预期内容`);
    invariant(
      structuredDataByType(page.body, "WebSite").length === 0,
      `${pathname} 非首页不得输出 WebSite`,
    );
    if (pathname.startsWith("/search")) {
      invariant(
        page.body.includes('rel="search"') &&
          page.body.includes(`${origin.origin}/opensearch.xml`),
        "搜索结果页缺少 OpenSearch 发现链接",
      );
      invariant(
        page.body.includes('<mark class="search-hit">Cloudflare</mark>') &&
          page.body.includes('class="search-evidence-source"') &&
          page.body.includes("匹配标签、正文"),
        "搜索命中证据异常",
      );
    }
    htmlPages.set(pathname, page);
    if (HTML_ROUTE_BASELINES[pathname]) {
      htmlBudgetReports.push(measureHtmlBudget({ pathname, html: page.body }));
    }
  }
  const tagPage = htmlPages.get("/tags/typescript")?.body ?? "";
  invariant(
    tagPage.includes(`${origin.origin}/tags/typescript/rss.xml`) &&
      visibleDocument(tagPage).includes(
        '<a href="/tags/typescript/rss.xml" type="application/rss+xml">订阅此标签 RSS',
      ),
    "标签 RSS 发现入口异常",
  );
  const seriesPage = htmlPages.get("/series/build-my-blog")?.body ?? "";
  const seriesChapterPaths = extractContentIndexPaths(seriesPage);
  invariant(
    seriesPage.includes(`${origin.origin}/series/build-my-blog/rss.xml`) &&
      visibleDocument(seriesPage).includes(
        '<a href="/series/build-my-blog/rss.xml" type="application/rss+xml">订阅此专题 RSS',
      ) &&
      JSON.stringify(seriesChapterPaths) ===
        JSON.stringify([
          "/posts/project-charter-before-homepage",
          "/posts/building-a-maintainable-blog",
        ]),
    "专题 RSS 发现入口或章节顺序异常",
  );
  const subscribe = htmlPages.get("/subscribe")?.body ?? "";
  invariant(
    (subscribe.match(/class="subscription-route"/gu) ?? []).length === 7 &&
      subscribe.includes('href="/rss.xml"') &&
      subscribe.includes('href="/updates.atom"') &&
      subscribe.includes('href="/feeds.opml"') &&
      subscribe.includes('href="/feed.json"') &&
      subscribe.includes('href="/opensearch.xml"') &&
      subscribe.includes('href="/content.json"') &&
      subscribe.includes('href="/content.schema.json"') &&
      subscribe.includes("/source.md") &&
      subscribe.includes("这些接口只负责读取"),
    "订阅与开放接口目录异常",
  );
  const activity = htmlPages.get("/activity")?.body ?? "";
  invariant(
    activity.includes("8 EVENTS / 4 PUBLISHED / 4 UPDATED") &&
      (activity.match(/data-activity-mode="published"/gu) ?? []).length === 4 &&
      (activity.match(/data-activity-mode="updated"/gu) ?? []).length === 4 &&
      !activity.includes('data-activity-mode="reviewed"'),
    "内容活动事件账本异常",
  );
  assertContentIdentity(origin, htmlPages);
  const relatedPost = htmlPages.get("/posts/building-a-maintainable-blog")?.body ?? "";
  invariant(
    (relatedPost.match(/class="content-recommendation"/gu) ?? []).length === 2 &&
      relatedPost.includes("双向引用") &&
      relatedPost.includes("同专题 · 从零构建个人博客") &&
      relatedPost.includes("共同标签 · Next.js / TypeScript / Design Systems"),
    "文章相关内容推荐异常",
  );
  const relatedProject = htmlPages.get("/projects/myblog")?.body ?? "";
  invariant(
    (relatedProject.match(/class="content-recommendation"/gu) ?? []).length === 3 &&
      relatedProject.includes("共同标签 · Design Systems"),
    "项目相关内容推荐异常",
  );
  for (const [pathname, items] of [
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
  ]) {
    assertBreadcrumbList(
      origin,
      pathname,
      htmlPages.get(pathname)?.body ?? "",
      items,
    );
  }
  const missingBreadcrumbPages = await Promise.all(
    ["posts", "projects", "series", "tags"].map((kind) =>
      request(origin, `/${kind}/structured-data-missing`),
    ),
  );
  invariant(
    missingBreadcrumbPages.every(
      ({ response, body }) =>
        response.status === 404 &&
        structuredDataByType(body, "BreadcrumbList").length === 0,
    ),
    "未知详情页不得输出 BreadcrumbList",
  );
  invariant(
    missingBreadcrumbPages.every(
      ({ body }) =>
        structuredDataByType(body, "BlogPosting").length === 0 &&
        structuredDataByType(body, "SoftwareSourceCode").length === 0,
    ),
    "未知详情页不得输出内容结构化身份",
  );
  const missing = await request(origin, "/definitely-missing");
  invariant(missing.response.status === 404, `未知路由状态 ${missing.response.status}`);
  invariant(
    (missing.response.headers.get("cache-control") ?? "").includes("no-store"),
    "404 必须 no-store",
  );
  invariant(
    missing.body.includes('<meta name="robots" content="noindex"') &&
      missing.body.includes("这条轨迹在这里中断。") &&
      (missing.body.match(/class="not-found-route [^"]+"/gu) ?? []).length === 4 &&
      missing.body.includes('href="/search"') &&
      missing.body.includes('href="/archive"') &&
      missing.body.includes('href="/posts"') &&
      missing.body.includes('href="/projects"') &&
      !missing.body.includes('http-equiv="refresh"'),
    "404 恢复路径或 noindex 契约异常",
  );
  htmlBudgetReports.push(
    measureHtmlBudget({ pathname: "/definitely-missing", html: missing.body }),
  );
  assertHtmlBudgetCoverage(htmlBudgetReports);
  assertHtmlBudgets(htmlBudgetReports);

  const [bodySearch, emptySearch] = await Promise.all([
    request(origin, "/search?q=Wrangler"),
    request(origin, "/search?q=B_i"),
  ]);
  invariant(
    bodySearch.response.status === 200 &&
      bodySearch.body.includes('<mark class="search-hit">Wrangler</mark>') &&
      bodySearch.body.includes(
        '<span class="search-evidence-source">正文</span>',
      ) &&
      bodySearch.body.includes("“Wrangler” 找到 1 条记录"),
    "搜索正文证据异常",
  );
  invariant(
    emptySearch.response.status === 200 &&
      emptySearch.body.includes("“B_i” 找到 0 条记录") &&
      !emptySearch.body.includes('<mark class="search-hit">'),
    "搜索空结果证据异常",
  );

  const markdownSources = [
    {
      canonical: `${origin.origin}/posts/building-a-maintainable-blog`,
      pathname: "/posts/building-a-maintainable-blog/source.md",
      slug: "building-a-maintainable-blog",
    },
    {
      canonical: `${origin.origin}/projects/myblog`,
      pathname: "/projects/myblog/source.md",
      slug: "myblog",
    },
  ];
  const sourceResponses = await Promise.all(
    markdownSources.map(({ pathname }) =>
      request(origin, pathname, { accept: "text/markdown" }),
    ),
  );
  for (const [index, source] of sourceResponses.entries()) {
    const expectation = markdownSources[index];
    const detail = htmlPages.get(expectation.canonical.slice(origin.origin.length));
    invariant(
      detail?.body.includes('type="text/markdown"') &&
        detail.body.includes(`${origin.origin}${expectation.pathname}`),
      `${expectation.slug} 详情页缺少 Markdown 发现与入口`,
    );
    invariant(
      source.response.status === 200 &&
        source.response.headers.get("content-type")?.startsWith("text/markdown") &&
        source.response.headers.get("content-disposition") ===
          `inline; filename="${expectation.slug}.md"` &&
        source.response.headers.get("link") ===
          `<${expectation.canonical}>; rel="canonical"; type="text/html"` &&
        source.response.headers.get("x-robots-tag") === "noindex" &&
        hasMarkdownSourceEtag(source.response.headers.get("etag")) &&
        Number.isFinite(Date.parse(source.response.headers.get("last-modified") ?? "")) &&
        hasMarkdownSourceCachePolicy(source.response.headers.get("cache-control")) &&
        source.body.startsWith("---\n") &&
        source.body.includes(`canonical: ${expectation.canonical}`) &&
        !/^\s*(?:draft|featured|sourcePath|body):/mu.test(source.body),
      `${expectation.slug} Markdown 公开源文契约异常`,
    );
    const etag = source.response.headers.get("etag");
    const conditional = await request(origin, expectation.pathname, {
      accept: "text/markdown",
      headers: { "if-none-match": etag },
    });
    const conditionalLastModified = conditional.response.headers.get("last-modified");
    const conditionalLink = conditional.response.headers.get("link");
    const conditionalRobots = conditional.response.headers.get("x-robots-tag");
    invariant(
      conditional.response.status === 304 &&
        conditional.body === "" &&
        sameMarkdownSourceEtag(conditional.response.headers.get("etag"), etag) &&
        (conditionalLastModified === null ||
          conditionalLastModified === source.response.headers.get("last-modified")) &&
        (conditionalLink === null ||
          conditionalLink ===
            `<${expectation.canonical}>; rel="canonical"; type="text/html"`) &&
        (conditionalRobots === null || conditionalRobots === "noindex") &&
        hasMarkdownSourceCachePolicy(
          conditional.response.headers.get("cache-control"),
        ),
      `${expectation.slug} Markdown 条件请求契约异常`,
    );
    const sourceLastModified = source.response.headers.get("last-modified");
    const staleSourceDate = new Date(
      Date.parse(sourceLastModified) - 1_000,
    ).toUTCString();
    const malformedSourceDate = new Date(
      Date.parse(sourceLastModified),
    ).toISOString();
    const [dateMatch, staleDate, malformedDate, staleTagWins] = await Promise.all([
      request(origin, expectation.pathname, {
        accept: "text/markdown",
        headers: { "if-modified-since": sourceLastModified },
      }),
      request(origin, expectation.pathname, {
        accept: "text/markdown",
        headers: { "if-modified-since": staleSourceDate },
      }),
      request(origin, expectation.pathname, {
        accept: "text/markdown",
        headers: { "if-modified-since": malformedSourceDate },
      }),
      request(origin, expectation.pathname, {
        accept: "text/markdown",
        headers: {
          "if-none-match": '"sha256-stale"',
          "if-modified-since": sourceLastModified,
        },
      }),
    ]);
    const dateMatchLastModified =
      dateMatch.response.headers.get("last-modified");
    invariant(
      dateMatch.response.status === 304 &&
        dateMatch.body === "" &&
        sameMarkdownSourceEtag(dateMatch.response.headers.get("etag"), etag) &&
        hasMarkdownSourceCachePolicy(
          dateMatch.response.headers.get("cache-control"),
        ) &&
        (dateMatchLastModified === null ||
          dateMatchLastModified === sourceLastModified),
      `${expectation.slug} Markdown If-Modified-Since 契约异常`,
    );
    invariant(
      staleDate.response.status === 200 && staleDate.body === source.body,
      `${expectation.slug} Markdown 旧 If-Modified-Since 不应命中`,
    );
    invariant(
      malformedDate.response.status === 200 && malformedDate.body === source.body,
      `${expectation.slug} Markdown 非 HTTP-date 条件不应命中`,
    );
    invariant(
      staleTagWins.response.status === 200 &&
        staleTagWins.body === source.body &&
        staleTagWins.response.headers.get("last-modified") ===
          sourceLastModified,
      `${expectation.slug} Markdown 未保持 If-None-Match 优先级`,
    );
  }
  invariant(
    sourceResponses[0].body.includes(`${origin.origin}/projects/myblog`) &&
      sourceResponses[0].body.includes(
        `${origin.origin}/uploads/building-a-maintainable-blog/content-delivery-pipeline.webp`,
      ) &&
      sourceResponses[1].body.includes(`${origin.origin}/uploads/myblog/cover.webp`),
    "Markdown 源文没有绝对化站内链接与本地媒体",
  );
  const missingMarkdownSource = await request(
    origin,
    "/posts/not-a-public-record/source.md",
    { accept: "text/markdown", redirect: "manual" },
  );
  invariant(
    missingMarkdownSource.response.status === 404 &&
      missingMarkdownSource.response.headers.get("cache-control") === "no-store",
    "未知 Markdown 源文没有返回 no-store 404",
  );

  const legacyBlog = await request(origin, "/blog", { redirect: "manual" });
  invariant(legacyBlog.response.status === 308, `/blog 永久重定向状态 ${legacyBlog.response.status}`);
  const legacyLocation = new URL(
    legacyBlog.response.headers.get("location") ?? "",
    origin,
  );
  invariant(
    legacyLocation.origin === origin.origin && legacyLocation.pathname === "/posts",
    `/blog 永久重定向目标不正确：${legacyLocation.href}`,
  );
  const legacyDestination = await request(origin, legacyLocation.pathname, {
    redirect: "manual",
  });
  invariant(
    legacyDestination.response.status === 200 && legacyDestination.body.includes("文章与 TIL"),
    "/blog 永久重定向没有单跳到有效页面",
  );

  const studio = await request(origin, "/studio");
  invariant(studio.response.status === 200, `Studio 状态 ${studio.response.status}`);
  invariant(
    studio.body.includes("/studio/editor-runtime-3.14.1.js"),
    "Studio CMS 版本不正确",
  );
  invariant(studio.response.headers.get("cache-control") === "no-store", "Studio 必须 no-store");
  invariant(
    studio.response.headers.get("cross-origin-opener-policy") === "same-origin-allow-popups",
    "Studio OAuth popup 策略不正确",
  );
  const studioPolicy = studio.response.headers.get("content-security-policy") ?? "";
  invariant(!studioPolicy.includes("unpkg.com"), "Studio 不应依赖第三方 CMS CDN");
  invariant(studioPolicy.includes("https://api.github.com"), "Studio CSP 缺少 GitHub API");
  invariant(studioPolicy.includes("frame-ancestors 'none'"), "Studio CSP 未禁止嵌入");

  const [studioMaintenancePage, studioMaintenanceModule, studioMaintenanceStyles, studioMaintenanceResponse, studioConfig, studioManifest, studioPreflight, stableSlugWidget, entryPreflightModule, mathPreviewModule, galleryEditorModule, glossaryEditorModule, faqEditorModule, fileTreeEditorModule, timelineEditorModule, tableEditorModule, taskListEditorModule, referencesEditorModule, stepsEditorModule, audioEditorModule, videoEditorModule, studioPreview, katexStyles, studioRuntime, unknownStudioAsset] = await Promise.all([
    request(origin, "/studio/maintenance"),
    request(origin, "/studio/maintenance.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/maintenance.css", { accept: "text/css" }),
    request(origin, "/studio/maintenance.json", { accept: "application/json" }),
    request(origin, "/studio/config.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/media-manifest.json", { accept: "application/json" }),
    request(origin, "/studio/media-preflight.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/stable-slug-widget.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/entry-preflight.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/math-preview.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/gallery-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/glossary-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/faq-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/filetree-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/timeline-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/table-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/task-list-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/references-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/steps-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/audio-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/video-editor.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/preview.css", { accept: "text/css" }),
    request(origin, "/studio/katex-0.16.47.css", { accept: "text/css" }),
    request(origin, "/studio/editor-runtime-3.14.1.js", { accept: "text/javascript" }),
    request(origin, "/studio/definitely-missing", { redirect: "manual" }),
  ]);
  invariant(
    audioEditorModule.response.status === 200 &&
      audioEditorModule.body.includes("registerStudioAudioEditor") &&
      audioEditorModule.body.includes("myblog-audio"),
    "Studio 音频编辑组件不可用",
  );
  invariant(
    referencesEditorModule.response.status === 200 &&
      referencesEditorModule.body.includes("registerStudioReferencesEditor") &&
      referencesEditorModule.body.includes("myblog-references"),
    "Studio 参考资料编辑组件不可用",
  );
  invariant(
    referencesEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 参考资料编辑组件类型不正确",
  );
  invariant(
    stepsEditorModule.response.status === 200 &&
      stepsEditorModule.body.includes("registerStudioStepsEditor") &&
      stepsEditorModule.body.includes("myblog-steps"),
    "Studio 步骤流程编辑组件不可用",
  );
  invariant(
    stepsEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 步骤流程编辑组件类型不正确",
  );
  invariant(
    audioEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 音频编辑组件类型不正确",
  );
  invariant(
    studioMaintenancePage.response.status === 200 &&
      studioMaintenancePage.body.includes("REVIEW HORIZON") &&
      studioMaintenancePage.body.includes("/studio/maintenance.mjs"),
    "Studio 内容维护页不可用",
  );
  invariant(
    studioMaintenanceModule.response.status === 200 &&
      studioMaintenanceModule.body.includes("requestStudioMaintenance") &&
      studioMaintenanceModule.body.includes("/studio/maintenance.json"),
    "Studio 内容维护模块不可用",
  );
  invariant(
    studioMaintenanceStyles.response.status === 200 &&
      studioMaintenanceStyles.body.includes("grid-template-columns: minmax(0, 14rem)") &&
      studioMaintenanceStyles.body.includes("prefers-color-scheme: dark"),
    "Studio 内容维护样式不可用",
  );
  let maintenanceSnapshot;
  try {
    maintenanceSnapshot = JSON.parse(studioMaintenanceResponse.body);
  } catch {
    throw new Error("Studio 内容维护队列不是有效 JSON");
  }
  invariant(
    studioMaintenanceResponse.response.status === 200 &&
      studioMaintenanceResponse.response.headers.get("cache-control") === "no-store" &&
      studioMaintenanceResponse.response.headers.get("x-robots-tag") === "noindex, nofollow" &&
      maintenanceSnapshot.version === 1 &&
      /^\d{4}-\d{2}-\d{2}$/u.test(maintenanceSnapshot.reportDate) &&
      maintenanceSnapshot.currentCount === maintenanceSnapshot.records.length &&
      maintenanceSnapshot.records.every((record) =>
        ["healthy", "review-soon", "due-soon", "overdue"].includes(record.status) &&
        record.editUrl.startsWith("/studio/#/collections/") &&
        record.publicUrl.startsWith("/") &&
        !("body" in record) &&
        !("sourcePath" in record)
      ),
    "Studio 内容维护数据不可用",
  );
  invariant(
    studioConfig.response.status === 200 && studioConfig.body.includes('repo: "Zach424/MyBlog"'),
    "Studio 配置模块不可用",
  );
  invariant(
    studioConfig.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 配置模块类型不正确",
  );
  let mediaInventory;
  try {
    mediaInventory = JSON.parse(studioManifest.body);
  } catch {
    throw new Error("Studio 媒体清单不是有效 JSON");
  }
  invariant(
    studioManifest.response.status === 200 &&
      studioManifest.response.headers.get("content-type")?.startsWith("application/json") &&
      studioManifest.response.headers.get("cache-control") === "no-store" &&
      mediaInventory.version === 1 &&
      mediaInventory.root === "public/uploads" &&
      Array.isArray(mediaInventory.entries) &&
      mediaInventory.entries.length >= 2 &&
      mediaInventory.entries.every((entry) =>
        typeof entry.path === "string" &&
        Number.isSafeInteger(entry.bytes) &&
        /^[a-f0-9]{64}$/u.test(entry.sha256)
      ),
    "Studio 媒体清单不可用",
  );
  invariant(
    studioPreflight.response.status === 200 &&
      studioPreflight.body.includes("inspectStudioMediaFile") &&
      studioPreflight.body.includes("createImageBitmap") &&
      studioPreflight.body.includes("media-manifest.json"),
    "Studio 媒体预检模块不可用",
  );
  invariant(
    studioPreflight.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 媒体预检模块类型不正确",
  );
  invariant(
    stableSlugWidget.response.status === 200 &&
      stableSlugWidget.body.includes("registerStableSlugWidget") &&
      stableSlugWidget.body.includes("data-stable-slug-state"),
    "Studio 稳定 slug 控件不可用",
  );
  invariant(
    stableSlugWidget.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 稳定 slug 控件类型不正确",
  );
  invariant(
    entryPreflightModule.response.status === 200 &&
      entryPreflightModule.body.includes("serializeStudioEntry") &&
      entryPreflightModule.body.includes("/studio/entry-preflight"),
    "Studio 条目预检模块不可用",
  );
  invariant(
    entryPreflightModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 条目预检模块类型不正确",
  );
  invariant(
    mathPreviewModule.response.status === 200 &&
      mathPreviewModule.body.includes("registerStudioMathPreview") &&
      mathPreviewModule.body.includes("/studio/math-preview"),
    "Studio 公式预览模块不可用",
  );
  invariant(
    mathPreviewModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 公式预览模块类型不正确",
  );
  invariant(
    galleryEditorModule.response.status === 200 &&
      galleryEditorModule.body.includes("registerStudioGalleryEditor") &&
      galleryEditorModule.body.includes("myblog-gallery"),
    "Studio 画廊编辑组件不可用",
  );
  invariant(
    galleryEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 画廊编辑组件类型不正确",
  );
  invariant(
    glossaryEditorModule.response.status === 200 &&
      glossaryEditorModule.body.includes("registerStudioGlossaryEditor") &&
      glossaryEditorModule.body.includes("myblog-glossary"),
    "Studio 术语表编辑组件不可用",
  );
  invariant(
    glossaryEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 术语表编辑组件类型不正确",
  );
  invariant(
    faqEditorModule.response.status === 200 &&
      faqEditorModule.body.includes("registerStudioFaqEditor") &&
      faqEditorModule.body.includes("myblog-faq"),
    "Studio FAQ 编辑组件不可用",
  );
  invariant(
    faqEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio FAQ 编辑组件类型不正确",
  );
  invariant(
    fileTreeEditorModule.response.status === 200 &&
      fileTreeEditorModule.body.includes("registerStudioFileTreeEditor") &&
      fileTreeEditorModule.body.includes("myblog-filetree"),
    "Studio 项目文件树编辑组件不可用",
  );
  invariant(
    timelineEditorModule.response.status === 200 &&
      timelineEditorModule.body.includes("registerStudioTimelineEditor") &&
      timelineEditorModule.body.includes("myblog-timeline"),
    "Studio 项目时间线编辑组件不可用",
  );
  invariant(
    timelineEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 项目时间线编辑组件类型不正确",
  );
  invariant(
    fileTreeEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 项目文件树编辑组件类型不正确",
  );
  invariant(
    tableEditorModule.response.status === 200 &&
      tableEditorModule.body.includes("registerStudioTableEditor") &&
      tableEditorModule.body.includes("myblog-table"),
    "Studio 技术表格编辑组件不可用",
  );
  invariant(
    tableEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 技术表格编辑组件类型不正确",
  );
  invariant(
    taskListEditorModule.response.status === 200 &&
      taskListEditorModule.body.includes("registerStudioTaskListEditor") &&
      taskListEditorModule.body.includes("myblog-task-list"),
    "Studio 任务清单编辑组件不可用",
  );
  invariant(
    taskListEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 任务清单编辑组件类型不正确",
  );
  invariant(
    videoEditorModule.response.status === 200 &&
      videoEditorModule.body.includes("registerStudioVideoEditor") &&
      videoEditorModule.body.includes("myblog-video"),
    "Studio 视频编辑组件不可用",
  );
  invariant(
    videoEditorModule.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 视频编辑组件类型不正确",
  );
  invariant(
    studioPreview.response.status === 200 && studioPreview.body.includes("--canvas:"),
    "Studio 预览样式不可用",
  );
  invariant(
    studioPreview.response.headers.get("content-type")?.startsWith("text/css"),
    "Studio 预览样式类型不正确",
  );
  invariant(
    katexStyles.response.status === 200 &&
      katexStyles.body.includes("data:font/woff2;base64,") &&
      katexStyles.body.includes('content:"0.16.47"') &&
      !katexStyles.body.includes("url(fonts/"),
    "Studio KaTeX 样式不可用",
  );
  invariant(
    katexStyles.response.headers.get("cache-control") ===
      "public, max-age=31536000, immutable",
    "固定版本 Studio KaTeX 样式缓存不正确",
  );
  for (const asset of [studioMaintenancePage, studioMaintenanceModule, studioMaintenanceStyles, studioMaintenanceResponse, studioConfig, studioManifest, studioPreflight, stableSlugWidget, entryPreflightModule, mathPreviewModule, galleryEditorModule, glossaryEditorModule, faqEditorModule, fileTreeEditorModule, tableEditorModule, taskListEditorModule, referencesEditorModule, stepsEditorModule, audioEditorModule, videoEditorModule, studioPreview]) {
    invariant(asset.response.headers.get("cache-control") === "no-store", "Studio 子资源必须 no-store");
  }
  invariant(
    studioRuntime.response.status === 200 &&
      studioRuntime.body.length > 4_000_000 &&
      studioRuntime.body.includes("decap-cms 3.14.1"),
    "Studio CMS 运行时不可用",
  );
  invariant(
    studioRuntime.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio CMS 运行时类型不正确",
  );
  invariant(
    studioRuntime.response.headers.get("cache-control") ===
      "public, max-age=31536000, immutable",
    "固定版本 Studio CMS 运行时缓存不正确",
  );
  invariant(
    unknownStudioAsset.response.status === 404 &&
      (unknownStudioAsset.response.headers.get("cache-control") ?? "").includes("no-store"),
    "未知 Studio 子资源必须返回 404/no-store",
  );

  const mathPreview = await request(origin, "/studio/math-preview", {
    accept: "application/json",
    body: JSON.stringify({
      markdown:
        "> [!warning] 发布前检查\n> 行内 $E = mc^2$。\n\n$$\nB = \\sum_i B_i\n$$\n\n```mermaid\nflowchart LR\n  Draft --> Review\n  Review --> Publish\n```\n\n> [!gallery] 发布流程证据\n> - ![编辑器中的画廊表单](/uploads/author-proof/gallery-one.webp \"编辑\")\n> - ![发布后的双栏画廊](/uploads/author-proof/gallery-two.webp \"上线\")\n\n> [!table] 发布延迟\n> | 环境 | P95 |\n> | --- | ---: |\n> | 本地 | 44 ms |\n> | 生产 | 118 ms |\n\n> [!tasks] 发布准备\n> - [x] 冻结内容契约\n> - [ ] 完成真实主题验收\n> - [x] 发布 `main`\n\n> [!references] 延伸阅读\n> 1. [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — 官方路由处理器说明。\n> 2. [MyBlog 项目复盘](/projects/myblog) — 本站实现与演进记录。\n\n> [!steps] 发布流程\n> 1. **运行完整检查**\n>\n>    执行 `npm run release:check`。\n>\n>    **验证：** 命令以退出码 0 完成。\n> 2. **推送主分支**\n>\n>    推送已审阅提交。\n\n> [!audio] 发布复盘口述\n> [下载 MP3](/uploads/author-proof/release-retro.mp3 \"发布复盘口述\")\n> 总结发布检查、上线确认与复盘结论。\n>\n> **文字稿**\n> 先运行完整检查，再确认生产冒烟通过。\n\n![发布流程演示](/uploads/author-proof/demo.mp4 \"本地静音视频\")",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  let mathPreviewPayload;
  try {
    mathPreviewPayload = JSON.parse(mathPreview.body);
  } catch {
    throw new Error("Studio 公式预览响应不是有效 JSON");
  }
  invariant(
    mathPreview.response.status === 200 &&
      mathPreview.response.headers.get("cache-control") === "no-store" &&
      mathPreviewPayload.ok === true &&
      mathPreviewPayload.formulaCount === 2 &&
      mathPreviewPayload.calloutCount === 1 &&
      mathPreviewPayload.diagramCount === 1 &&
      mathPreviewPayload.galleryCount === 1 &&
      mathPreviewPayload.galleryImageCount === 2 &&
      mathPreviewPayload.tableCount === 1 &&
      mathPreviewPayload.tableDataCellCount === 4 &&
      mathPreviewPayload.taskListCount === 1 &&
      mathPreviewPayload.taskItemCount === 3 &&
      mathPreviewPayload.taskCompleteCount === 2 &&
      mathPreviewPayload.referenceListCount === 1 &&
      mathPreviewPayload.referenceItemCount === 2 &&
      mathPreviewPayload.procedureCount === 1 &&
      mathPreviewPayload.procedureStepCount === 2 &&
      mathPreviewPayload.audioCount === 1 &&
      mathPreviewPayload.videoCount === 1 &&
      mathPreviewPayload.html.includes('data-callout="warning"') &&
      mathPreviewPayload.html.includes('data-diagram="flowchart"') &&
      mathPreviewPayload.html.includes('data-gallery="ordered-images"') &&
      mathPreviewPayload.html.includes('class="markdown-gallery-grid"') &&
      mathPreviewPayload.html.includes('data-table="bounded-ledger"') &&
      mathPreviewPayload.html.includes('class="markdown-data-table-grid"') &&
      mathPreviewPayload.html.includes('data-task-list="readonly-ledger"') &&
      mathPreviewPayload.html.includes('<progress') &&
      mathPreviewPayload.html.includes('data-references="curated-index"') &&
      mathPreviewPayload.html.includes('SOURCE INDEX / 02 REFERENCES') &&
      mathPreviewPayload.html.includes('data-procedure="runbook-path"') &&
      mathPreviewPayload.html.includes('PROCEDURE / 02 STEPS') &&
      (mathPreviewPayload.html.match(/type="checkbox"/gu) ?? []).length === 3 &&
      !/<button|contenteditable|onclick=/iu.test(mathPreviewPayload.html) &&
      mathPreviewPayload.html.includes('data-audio="local-mp3"') &&
      /<audio\b[^>]*\scontrols(?:\s|>)/u.test(mathPreviewPayload.html) &&
      mathPreviewPayload.html.includes('preload="metadata"') &&
      mathPreviewPayload.html.includes("先运行完整检查") &&
      mathPreviewPayload.html.includes('data-video="silent-mp4"') &&
      /<video\b[^>]*\scontrols(?:\s|>)/u.test(mathPreviewPayload.html) &&
      mathPreviewPayload.html.includes('preload="none"') &&
      !mathPreviewPayload.html.includes("autoplay") &&
      !mathPreviewPayload.html.includes("<iframe") &&
      mathPreviewPayload.html.includes('data-renderer="server-svg"') &&
      !mathPreviewPayload.html.includes("@import") &&
      !mathPreviewPayload.html.includes("<foreignObject") &&
      !mathPreviewPayload.html.includes("[!warning]") &&
      mathPreviewPayload.html.includes('class="katex"') &&
      mathPreviewPayload.html.includes("<math"),
    "Studio 增强 Markdown 生产管线预览不可用",
  );

  const glossaryPreview = await request(origin, "/studio/math-preview", {
    accept: "application/json",
    body: JSON.stringify({
      markdown:
        "> [!glossary] React 核心概念\n> - **Server Component**\n>\n>   只在服务端渲染的 React 组件。\n>\n>   **别名：** RSC、React Server Component\n>\n>   **上下文：** 在 Next.js App Router 中用于服务端数据读取。\n> - **水合**\n>\n>   React 在已有服务端 HTML 上绑定客户端行为的过程。\n>\n>   **别名：** Hydration",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const glossaryPreviewPayload = JSON.parse(glossaryPreview.body);
  invariant(
    glossaryPreview.response.status === 200 &&
      glossaryPreviewPayload.ok === true &&
      glossaryPreviewPayload.glossaryCount === 1 &&
      glossaryPreviewPayload.glossaryTermCount === 2 &&
      glossaryPreviewPayload.html.includes('data-glossary="definition-ledger"') &&
      glossaryPreviewPayload.html.includes('GLOSSARY / 02 TERMS') &&
      glossaryPreviewPayload.html.includes('<dl class="markdown-glossary-items"') &&
      !/<button|contenteditable|onclick=/iu.test(glossaryPreviewPayload.html),
    "Studio 术语表生产管线预览不可用",
  );

  const faqPreview = await request(origin, "/studio/math-preview", {
    accept: "application/json",
    body: JSON.stringify({
      markdown:
        "> [!faq] 发布常见问题\n> - **应该使用 Studio 还是 Obsidian？**\n>\n>   两者都可以，最终发布同一份 Markdown。\n> - **FAQ 会保存展开状态吗？**\n>\n>   不会；展开只属于当前页面。",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const faqPreviewPayload = JSON.parse(faqPreview.body);
  invariant(
    faqPreview.response.status === 200 &&
      faqPreviewPayload.ok === true &&
      faqPreviewPayload.faqCount === 1 &&
      faqPreviewPayload.faqQuestionCount === 2 &&
      faqPreviewPayload.html.includes('data-faq="answer-cabinet"') &&
      faqPreviewPayload.html.includes("FAQ / 02 QUESTIONS") &&
      /<details[^>]*open/u.test(faqPreviewPayload.html) &&
      faqPreviewPayload.html.includes('<summary class="markdown-faq-question"') &&
      !/<button|contenteditable|onclick=/iu.test(faqPreviewPayload.html),
    "Studio FAQ 生产管线预览不可用",
  );

  const fileTreePreview = await request(origin, "/studio/math-preview", {
    accept: "application/json",
    body: JSON.stringify({
      markdown:
        "> [!filetree] MyBlog 核心结构\n> - `app/` — 页面与同源路由。\n>   - `studio/` — Git-backed 发布后台。\n>     - `page.tsx` — 后台静态入口。\n> - `lib/` — 内容解析与渲染。\n> - `package.json` — 脚本与质量门。",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const fileTreePreviewPayload = JSON.parse(fileTreePreview.body);
  invariant(
    fileTreePreview.response.status === 200 &&
      fileTreePreviewPayload.ok === true &&
      fileTreePreviewPayload.fileTreeCount === 1 &&
      fileTreePreviewPayload.fileTreeNodeCount === 5 &&
      fileTreePreviewPayload.fileTreeMaxDepth === 3 &&
      fileTreePreviewPayload.html.includes('data-filetree="repository-slice"') &&
      fileTreePreviewPayload.html.includes("FILE MAP / 05 NODES") &&
      !/<button|contenteditable|onclick=/iu.test(fileTreePreviewPayload.html),
    "Studio 项目文件树生产管线预览不可用",
  );

  const timelinePreview = await request(origin, "/studio/math-preview", {
    accept: "application/json",
    body: JSON.stringify({
      markdown:
        "> [!timeline] MyBlog 交付里程碑\n> - `2026-07-19` `START` **建立内容契约**\n>\n>   用 Markdown 与 Zod 冻结内容边界。\n> - `2026-08-02` `DECISION` **统一作者入口**\n>\n>   选择 Studio 与 Obsidian 共享发布契约。\n> - `2026-08-12` `VERIFY` **完成生产验证**\n>\n>   完成自动化、移动端与打印验证。",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const timelinePreviewPayload = JSON.parse(timelinePreview.body);
  invariant(
    timelinePreview.response.status === 200 &&
      timelinePreviewPayload.ok === true &&
      timelinePreviewPayload.timelineCount === 1 &&
      timelinePreviewPayload.timelineEventCount === 3 &&
      timelinePreviewPayload.html.includes('data-timeline="release-tape"') &&
      timelinePreviewPayload.html.includes("HISTORY / 03 EVENTS") &&
      timelinePreviewPayload.html.includes('datetime="2026-08-12"') &&
      !/<button|contenteditable|onclick=/iu.test(timelinePreviewPayload.html),
    "Studio 项目时间线生产管线预览不可用",
  );

  const entryPreflight = await request(origin, "/studio/entry-preflight", {
    accept: "application/json",
    body: JSON.stringify({
      collection: "posts",
      fields: {
        body: "## 结论\n\n这是一段经过校验的正文。",
        description: "说明这篇文章会给读者带来什么。",
        draft: false,
        featured: false,
        freshness: "historical",
        publishedAt: "2026-08-01",
        reviewedAt: "2026-08-01",
        slug: "author-proof",
        tags: ["TypeScript", "Personal Knowledge"],
        title: "Author Proof 发布清单",
        type: "article",
      },
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  let entryPreflightPayload;
  try {
    entryPreflightPayload = JSON.parse(entryPreflight.body);
  } catch {
    throw new Error("Studio 条目预检响应不是有效 JSON");
  }
  invariant(
    entryPreflight.response.status === 200 &&
      entryPreflight.response.headers.get("cache-control") === "no-store" &&
      entryPreflightPayload.ok === true &&
      entryPreflightPayload.issueCount === 0 &&
      entryPreflightPayload.facts.some((fact) => fact.value === "/posts/author-proof"),
    "Studio 条目生产契约预检不可用",
  );

  const oauth = await request(
    origin,
    `/api/cms/auth?provider=github&site_id=${encodeURIComponent(origin.hostname)}`,
    { redirect: "manual" },
  );
  if (expectOAuth) {
    invariant(oauth.response.status === 302, `OAuth 状态 ${oauth.response.status}`);
    const location = new URL(oauth.response.headers.get("location"));
    invariant(location.origin === "https://github.com", "OAuth 没有跳转 GitHub");
    invariant(Boolean(location.searchParams.get("state")), "OAuth 缺少签名 state");
  } else {
    invariant([302, 503].includes(oauth.response.status), `OAuth 状态 ${oauth.response.status}`);
  }

  const [contentManifest, contentSchema, jsonFeed, rss, tagRss, seriesRss, atom, opml, robots, sitemap, openSearch] = await Promise.all([
    request(origin, "/content.json", { accept: "application/json" }),
    request(origin, "/content.schema.json", { accept: "application/schema+json" }),
    request(origin, "/feed.json", { accept: "application/feed+json" }),
    request(origin, "/rss.xml", { accept: "application/rss+xml" }),
    request(origin, "/tags/typescript/rss.xml", {
      accept: "application/rss+xml",
    }),
    request(origin, "/series/build-my-blog/rss.xml", {
      accept: "application/rss+xml",
    }),
    request(origin, "/updates.atom", { accept: "application/atom+xml" }),
    request(origin, "/feeds.opml", { accept: "text/x-opml" }),
    request(origin, "/robots.txt", { accept: "text/plain" }),
    request(origin, "/sitemap.xml", { accept: "application/xml" }),
    request(origin, "/opensearch.xml", {
      accept: "application/opensearchdescription+xml",
    }),
  ]);
  let contentManifestPayload;
  try {
    contentManifestPayload = JSON.parse(contentManifest.body);
  } catch {
    throw new Error("公开内容清单响应不是有效 JSON");
  }
  let contentSchemaPayload;
  try {
    contentSchemaPayload = JSON.parse(contentSchema.body);
  } catch {
    throw new Error("公开内容清单 Schema 响应不是有效 JSON");
  }
  let jsonFeedPayload;
  try {
    jsonFeedPayload = JSON.parse(jsonFeed.body);
  } catch {
    throw new Error("JSON Feed 响应不是有效 JSON");
  }
  const discoveryBudgetReports = [
    measureDiscoveryBudget({
      pathname: "/content.json",
      body: contentManifest.body,
    }),
    measureDiscoveryBudget({
      pathname: "/content.schema.json",
      body: contentSchema.body,
    }),
    measureDiscoveryBudget({ pathname: "/feed.json", body: jsonFeed.body }),
    measureDiscoveryBudget({ pathname: "/rss.xml", body: rss.body }),
    measureDiscoveryBudget({
      pathname: "/tags/typescript/rss.xml",
      body: tagRss.body,
    }),
    measureDiscoveryBudget({
      pathname: "/series/build-my-blog/rss.xml",
      body: seriesRss.body,
    }),
    measureDiscoveryBudget({ pathname: "/updates.atom", body: atom.body }),
    measureDiscoveryBudget({ pathname: "/feeds.opml", body: opml.body }),
    measureDiscoveryBudget({ pathname: "/sitemap.xml", body: sitemap.body }),
    measureDiscoveryBudget({ pathname: "/robots.txt", body: robots.body }),
    measureDiscoveryBudget({
      pathname: "/opensearch.xml",
      body: openSearch.body,
    }),
  ];
  assertDiscoveryBudgetCoverage(discoveryBudgetReports);
  assertDiscoveryBudgets(discoveryBudgetReports);
  const jsonFeedItems = Array.isArray(jsonFeedPayload.items)
    ? jsonFeedPayload.items
    : [];
  const jsonFeedIds = jsonFeedItems.map((item) => item.id);
  const manifestItems = Array.isArray(contentManifestPayload.items)
    ? contentManifestPayload.items
    : [];
  const manifestIds = manifestItems.map((item) => item.id);
  const rssItems = extractRssItems(rss.body);
  const rssIds = rssItems.map((item) => item.guid);
  const atomEntries = extractAtomEntries(atom.body);
  const atomIds = atomEntries.map((entry) => entry.id);
  const expectedAtomItems = jsonFeedItems.slice().sort(
    (left, right) =>
      (right.date_modified ?? right.date_published).localeCompare(
        left.date_modified ?? left.date_published,
      ) ||
      right.date_published.localeCompare(left.date_published) ||
      left.title.localeCompare(right.title, "zh-CN") ||
      left.id.localeCompare(right.id, "en"),
  );
  const jsonFeedById = new Map(jsonFeedItems.map((item) => [item.id, item]));
  const tagRssItems = extractRssItems(tagRss.body);
  const tagRssIds = tagRssItems.map((item) => item.guid);
  const expectedTagItems = jsonFeedItems.filter(
    (item) => Array.isArray(item.tags) && item.tags.includes("TypeScript"),
  );
  const expectedTagIds = expectedTagItems.map((item) => item.id);
  const seriesRssItems = extractRssItems(seriesRss.body);
  const seriesRssIds = seriesRssItems.map((item) => item.guid);
  const expectedSeriesItems = seriesChapterPaths
    .map((pathname) =>
      jsonFeedItems.find((item) => item.id === `${origin.origin}${pathname}`),
    )
    .filter(Boolean)
    .sort(
      (left, right) =>
        right.date_published.localeCompare(left.date_published) ||
        left.title.localeCompare(right.title, "zh-CN"),
    );
  const expectedSeriesIds = expectedSeriesItems.map((item) => item.id);
  const jsonFeedLastModified =
    jsonFeed.response.headers.get("last-modified");
  const rssLastModified = rss.response.headers.get("last-modified");
  const tagRssLastModified = tagRss.response.headers.get("last-modified");
  const seriesRssLastModified =
    seriesRss.response.headers.get("last-modified");
  const atomLastModified = atom.response.headers.get("last-modified");
  const rssUpdateContractValid = rssItemsMatchJsonFeed(
    rssItems,
    jsonFeedItems,
  );
  const manifestEtag = contentManifest.response.headers.get("etag");
  invariant(
    contentManifest.response.status === 200 &&
      contentManifest.response.headers.get("content-type")?.startsWith("application/json") &&
      contentManifest.response.headers.get("content-disposition") ===
        'inline; filename="content.json"' &&
      contentManifest.response.headers.get("x-robots-tag") === "noindex" &&
      contentManifest.response.headers.get("link") ===
        `<${origin.origin}/content.json>; rel="self"; type="application/json", <${origin.origin}/content.schema.json>; rel="describedby"; type="application/schema+json", <${origin.origin}/>; rel="up"; type="text/html"` &&
      hasMarkdownSourceCachePolicy(
        contentManifest.response.headers.get("cache-control"),
      ) &&
      hasMarkdownSourceEtag(manifestEtag) &&
      Number.isFinite(
        Date.parse(contentManifest.response.headers.get("last-modified") ?? ""),
      ) &&
      contentManifestPayload.version === 1 &&
      contentManifestPayload.home_url === `${origin.origin}/` &&
      contentManifestPayload.manifest_url === `${origin.origin}/content.json` &&
      contentManifestPayload.language === "zh-CN" &&
      manifestIds.length >= 4 &&
      new Set(manifestIds).size === manifestIds.length &&
      manifestItems.every(
        (item) =>
          item.id === item.html_url &&
          item.id.startsWith(`${origin.origin}/`) &&
          item.markdown_url === `${item.html_url}/source.md` &&
          /^(?:post|project)$/u.test(item.kind) &&
          /^(?:article|til|project)$/u.test(item.type) &&
          /^"sha256-[0-9a-f]{64}"$/u.test(item.markdown_etag) &&
          typeof item.title === "string" &&
          /^\d{4}-\d{2}-\d{2}$/u.test(item.published_at) &&
          /^\d{4}-\d{2}-\d{2}$/u.test(item.reviewed_at) &&
          Array.isArray(item.tags) &&
          !Object.hasOwn(item, "body") &&
          !Object.hasOwn(item, "draft") &&
          !Object.hasOwn(item, "sourcePath"),
      ),
    "公开内容清单契约异常",
  );
  const conditionalManifest = await request(origin, "/content.json", {
    accept: "application/json",
    headers: { "if-none-match": manifestEtag },
  });
  const conditionalManifestLastModified =
    conditionalManifest.response.headers.get("last-modified");
  const conditionalManifestLink = conditionalManifest.response.headers.get("link");
  const conditionalManifestRobots =
    conditionalManifest.response.headers.get("x-robots-tag");
  invariant(
    conditionalManifest.response.status === 304 &&
      conditionalManifest.body === "" &&
      sameMarkdownSourceEtag(
        conditionalManifest.response.headers.get("etag"),
        manifestEtag,
      ) &&
      hasMarkdownSourceCachePolicy(
        conditionalManifest.response.headers.get("cache-control"),
      ) &&
      (conditionalManifestLastModified === null ||
        conditionalManifestLastModified ===
          contentManifest.response.headers.get("last-modified")) &&
      (conditionalManifestLink === null ||
        conditionalManifestLink === contentManifest.response.headers.get("link")) &&
      (conditionalManifestRobots === null || conditionalManifestRobots === "noindex"),
    "公开内容清单条件请求契约异常",
  );
  const manifestLastModified =
    contentManifest.response.headers.get("last-modified");
  const staleManifestDate = new Date(
    Date.parse(manifestLastModified) - 1_000,
  ).toUTCString();
  const malformedManifestDate = new Date(
    Date.parse(manifestLastModified),
  ).toISOString();
  const [
    manifestDateMatch,
    manifestStaleDate,
    manifestMalformedDate,
    manifestStaleTagWins,
  ] = await Promise.all([
    request(origin, "/content.json", {
      accept: "application/json",
      headers: { "if-modified-since": manifestLastModified },
    }),
    request(origin, "/content.json", {
      accept: "application/json",
      headers: { "if-modified-since": staleManifestDate },
    }),
    request(origin, "/content.json", {
      accept: "application/json",
      headers: { "if-modified-since": malformedManifestDate },
    }),
    request(origin, "/content.json", {
      accept: "application/json",
      headers: {
        "if-none-match": '"sha256-stale"',
        "if-modified-since": manifestLastModified,
      },
    }),
  ]);
  const manifestDateMatchLastModified =
    manifestDateMatch.response.headers.get("last-modified");
  invariant(
    manifestDateMatch.response.status === 304 &&
      manifestDateMatch.body === "" &&
      sameMarkdownSourceEtag(
        manifestDateMatch.response.headers.get("etag"),
        manifestEtag,
      ) &&
      hasMarkdownSourceCachePolicy(
        manifestDateMatch.response.headers.get("cache-control"),
      ) &&
      (manifestDateMatchLastModified === null ||
        manifestDateMatchLastModified === manifestLastModified),
    "公开内容清单 If-Modified-Since 契约异常",
  );
  invariant(
    manifestStaleDate.response.status === 200 &&
      manifestStaleDate.body === contentManifest.body,
    "公开内容清单旧 If-Modified-Since 不应命中",
  );
  invariant(
    manifestMalformedDate.response.status === 200 &&
      manifestMalformedDate.body === contentManifest.body,
    "公开内容清单非 HTTP-date 条件不应命中",
  );
  invariant(
    manifestStaleTagWins.response.status === 200 &&
      manifestStaleTagWins.body === contentManifest.body &&
      manifestStaleTagWins.response.headers.get("last-modified") ===
        manifestLastModified,
    "公开内容清单未保持 If-None-Match 优先级",
  );
  const schemaEtag = contentSchema.response.headers.get("etag");
  invariant(
    contentSchema.response.status === 200 &&
      contentSchema.response.headers.get("content-type")?.startsWith("application/schema+json") &&
      contentSchema.response.headers.get("content-disposition") ===
        'inline; filename="content.schema.json"' &&
      contentSchema.response.headers.get("x-robots-tag") === "noindex" &&
      contentSchema.response.headers.get("link") ===
        `<${origin.origin}/content.schema.json>; rel="self"; type="application/schema+json", <${origin.origin}/content.json>; rel="describes"; type="application/json", <${origin.origin}/>; rel="up"; type="text/html"` &&
      hasMarkdownSourceCachePolicy(
        contentSchema.response.headers.get("cache-control"),
      ) &&
      hasMarkdownSourceEtag(schemaEtag) &&
      contentSchemaPayload.$schema ===
        "https://json-schema.org/draft/2020-12/schema" &&
      contentSchemaPayload.$id === `${origin.origin}/content.schema.json` &&
      contentSchemaPayload.type === "object" &&
      contentSchemaPayload.additionalProperties === false &&
      contentSchemaPayload.properties?.version?.const === 1 &&
      contentSchemaPayload.properties?.home_url?.const === `${origin.origin}/` &&
      contentSchemaPayload.properties?.manifest_url?.const ===
        `${origin.origin}/content.json` &&
      contentSchemaPayload.properties?.language?.const === "zh-CN" &&
      contentSchemaPayload.$defs?.item?.additionalProperties === false &&
      Array.isArray(contentSchemaPayload.$defs?.item?.oneOf) &&
      contentSchemaPayload.$defs.item.oneOf.length === 2,
    "公开内容清单 Schema 契约异常",
  );
  const conditionalSchema = await request(origin, "/content.schema.json", {
    accept: "application/schema+json",
    headers: { "if-none-match": schemaEtag },
  });
  const conditionalSchemaLink = conditionalSchema.response.headers.get("link");
  const conditionalSchemaRobots =
    conditionalSchema.response.headers.get("x-robots-tag");
  invariant(
    conditionalSchema.response.status === 304 &&
      conditionalSchema.body === "" &&
      sameMarkdownSourceEtag(
        conditionalSchema.response.headers.get("etag"),
        schemaEtag,
      ) &&
      hasMarkdownSourceCachePolicy(
        conditionalSchema.response.headers.get("cache-control"),
      ) &&
      (conditionalSchemaLink === null ||
        conditionalSchemaLink === contentSchema.response.headers.get("link")) &&
      (conditionalSchemaRobots === null || conditionalSchemaRobots === "noindex"),
    "公开内容清单 Schema 条件请求契约异常",
  );
  const manifestSourceResponses = await Promise.all(
    manifestItems.map((item) => {
      const sourceUrl = new URL(item.markdown_url);
      invariant(sourceUrl.origin === origin.origin, "公开内容清单源文 URL 跨越站点 origin");
      return request(origin, sourceUrl.pathname, { accept: "text/markdown" });
    }),
  );
  invariant(
    manifestSourceResponses.every(
      (source, index) =>
        source.response.status === 200 &&
        sameMarkdownSourceEtag(
          source.response.headers.get("etag"),
          manifestItems[index].markdown_etag,
        ),
    ),
    "公开内容清单的 Markdown 验证器与真实源文不一致",
  );
  invariant(
    openSearch.response.status === 200 &&
      openSearch.response.headers
        .get("content-type")
        ?.startsWith("application/opensearchdescription+xml") &&
      openSearch.response.headers.get("content-disposition") ===
        'inline; filename="opensearch.xml"' &&
      openSearch.response.headers.get("x-robots-tag") === "noindex" &&
      hasJsonFeedCachePolicy(
        openSearch.response.headers.get("cache-control"),
      ) &&
      sameMarkdownSourceEtag(
        openSearch.response.headers.get("etag"),
        sha256Etag(openSearch.body),
      ) &&
      openSearch.body.includes(
        '<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">',
      ) &&
      (openSearch.body.match(/<ShortName>/gu) ?? []).length === 1 &&
      (openSearch.body.match(/<Description>/gu) ?? []).length === 1 &&
      openSearch.body.includes("<ShortName>Zach424 Notes</ShortName>") &&
      openSearch.body.includes(
        `type="text/html" rel="results" template="${origin.origin}/search?q={searchTerms}"`,
      ) &&
      openSearch.body.includes(
        `type="application/opensearchdescription+xml" rel="self" template="${origin.origin}/opensearch.xml"`,
      ) &&
      openSearch.body.includes(
        '<Query role="example" searchTerms="typescript" />',
      ) &&
      openSearch.body.includes("<Language>zh-CN</Language>") &&
      openSearch.body.includes("<InputEncoding>UTF-8</InputEncoding>") &&
      openSearch.body.includes("<OutputEncoding>UTF-8</OutputEncoding>"),
    "OpenSearch 描述或条件验证器异常",
  );
  invariant(
      jsonFeed.response.status === 200 &&
      jsonFeed.response.headers.get("content-type")?.startsWith("application/feed+json") &&
      hasJsonFeedCachePolicy(jsonFeed.response.headers.get("cache-control")) &&
      sameMarkdownSourceEtag(
        jsonFeed.response.headers.get("etag"),
        sha256Etag(jsonFeed.body),
      ) &&
      jsonFeedLastModified === "Thu, 06 Aug 2026 10:09:53 GMT" &&
      jsonFeedPayload.version === "https://jsonfeed.org/version/1.1" &&
      jsonFeedPayload.home_page_url === `${origin.origin}/` &&
      jsonFeedPayload.feed_url === `${origin.origin}/feed.json` &&
      jsonFeedPayload.language === "zh-CN" &&
      jsonFeedPayload.icon === `${origin.origin}/icon.png` &&
      jsonFeedIds.length >= 4 &&
      new Set(jsonFeedIds).size === jsonFeedIds.length &&
      jsonFeedItems.every(
        (item) =>
          item.id === item.url &&
          item.id.startsWith(`${origin.origin}/`) &&
          typeof item.title === "string" &&
          typeof item.summary === "string" &&
          typeof item.content_text === "string" &&
          item.content_text.length > 0 &&
          /^\d{4}-\d{2}-\d{2}T00:00:00Z$/u.test(item.date_published) &&
          (!Object.hasOwn(item, "date_modified") ||
            /^\d{4}-\d{2}-\d{2}T00:00:00Z$/u.test(item.date_modified)) &&
          !Object.hasOwn(item, "body") &&
          !Object.hasOwn(item, "draft") &&
          !Object.hasOwn(item, "sourcePath"),
      ) &&
      JSON.stringify(jsonFeedIds) === JSON.stringify(rssIds) &&
      JSON.stringify(manifestIds) === JSON.stringify(jsonFeedIds),
    "JSON Feed 1.1 公开内容契约异常",
  );
  invariant(
    rss.response.status === 200 &&
      rss.response.headers.get("content-type")?.startsWith("application/rss+xml") &&
      hasJsonFeedCachePolicy(rss.response.headers.get("cache-control")) &&
      sameMarkdownSourceEtag(
        rss.response.headers.get("etag"),
        sha256Etag(rss.body),
      ) &&
      rssLastModified === "Mon, 10 Aug 2026 22:25:11 GMT" &&
      rss.body.includes(
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dcterms="http://purl.org/dc/terms/">',
      ) &&
      !rss.body.includes("<atom:updated>") &&
      rssItems.length >= 4 &&
      rssUpdateContractValid,
    "RSS 条目、标签或条件验证器异常",
  );
  const tagRssUpdateContractValid = rssItemsMatchJsonFeed(
    tagRssItems,
    expectedTagItems,
  );
  invariant(
    tagRss.response.status === 200 &&
      tagRss.response.headers
        .get("content-type")
        ?.startsWith("application/rss+xml") &&
      hasJsonFeedCachePolicy(tagRss.response.headers.get("cache-control")) &&
      sameMarkdownSourceEtag(
        tagRss.response.headers.get("etag"),
        sha256Etag(tagRss.body),
      ) &&
      tagRssLastModified === "Mon, 10 Aug 2026 22:25:11 GMT" &&
      tagRss.response.headers.get("content-disposition") ===
        'inline; filename="typescript.rss.xml"' &&
      tagRss.response.headers.get("x-robots-tag") === "noindex" &&
      tagRss.response.headers.get("link") ===
        `<${origin.origin}/tags/typescript/rss.xml>; rel="self"; type="application/rss+xml", <${origin.origin}/tags/typescript>; rel="up"; type="text/html"` &&
      tagRss.body.includes(
        "<title>TypeScript — Zach424 / Engineering Notes</title>",
      ) &&
      tagRss.body.includes(`<link>${origin.origin}/tags/typescript</link>`) &&
      tagRss.body.includes(
        `<atom:link href="${origin.origin}/tags/typescript/rss.xml" rel="self" type="application/rss+xml" />`,
      ) &&
      expectedTagIds.length >= 1 &&
      JSON.stringify(tagRssIds) === JSON.stringify(expectedTagIds) &&
      !tagRssIds.includes(`${origin.origin}/posts/cross-platform-npm-scripts`) &&
      !tagRssIds.includes(`${origin.origin}/posts/project-charter-before-homepage`) &&
      tagRssUpdateContractValid,
    "标签 RSS 条目、发现或条件响应异常",
  );
  const seriesRssUpdateContractValid = rssItemsMatchJsonFeed(
    seriesRssItems,
    expectedSeriesItems,
  );
  invariant(
    seriesRss.response.status === 200 &&
      seriesRss.response.headers
        .get("content-type")
        ?.startsWith("application/rss+xml") &&
      hasJsonFeedCachePolicy(seriesRss.response.headers.get("cache-control")) &&
      sameMarkdownSourceEtag(
        seriesRss.response.headers.get("etag"),
        sha256Etag(seriesRss.body),
      ) &&
      seriesRssLastModified === "Mon, 10 Aug 2026 22:25:11 GMT" &&
      seriesRss.response.headers.get("content-disposition") ===
        'inline; filename="build-my-blog.rss.xml"' &&
      seriesRss.response.headers.get("x-robots-tag") === "noindex" &&
      seriesRss.response.headers.get("link") ===
        `<${origin.origin}/series/build-my-blog/rss.xml>; rel="self"; type="application/rss+xml", <${origin.origin}/series/build-my-blog>; rel="up"; type="text/html"` &&
      seriesRss.body.includes(
        "<title>从零构建个人博客 — Zach424 / Engineering Notes</title>",
      ) &&
      seriesRss.body.includes(
        "<description>专题“从零构建个人博客”，按最新发布顺序订阅，共 2 篇文章。</description>",
      ) &&
      seriesRss.body.includes(
        `<link>${origin.origin}/series/build-my-blog</link>`,
      ) &&
      seriesRss.body.includes(
        `<atom:link href="${origin.origin}/series/build-my-blog/rss.xml" rel="self" type="application/rss+xml" />`,
      ) &&
      expectedSeriesIds.length === seriesChapterPaths.length &&
      JSON.stringify(seriesRssIds) === JSON.stringify(expectedSeriesIds) &&
      JSON.stringify(seriesRssIds) ===
        JSON.stringify(
          [...seriesChapterPaths]
            .reverse()
            .map((pathname) => `${origin.origin}${pathname}`),
        ) &&
      !seriesRssIds.includes(`${origin.origin}/projects/myblog`) &&
      !seriesRssIds.includes(`${origin.origin}/posts/cross-platform-npm-scripts`) &&
      seriesRssUpdateContractValid,
    "专题 RSS 条目、发现或条件响应异常",
  );
  const homeHtml = htmlPages.get("/")?.body ?? "";
  const atomEntriesMatchJsonFeed =
    atomEntries.length === jsonFeedItems.length &&
    atomEntries.every((entry) => {
      const feedItem = jsonFeedById.get(entry.id);
      return (
        feedItem &&
        entry.title === feedItem.title &&
        entry.summary === feedItem.summary &&
        entry.content === feedItem.content_text &&
        entry.published.slice(0, 10) === feedItem.date_published.slice(0, 10) &&
        entry.updated.slice(0, 10) ===
          (feedItem.date_modified ?? feedItem.date_published).slice(0, 10) &&
        JSON.stringify(entry.categories) === JSON.stringify(feedItem.tags)
      );
    });
  invariant(
    atom.response.status === 200 &&
      atom.response.headers.get("content-type") ===
        "application/atom+xml; charset=utf-8" &&
      atom.response.headers.get("content-disposition") ===
        'inline; filename="updates.atom"' &&
      hasJsonFeedCachePolicy(atom.response.headers.get("cache-control")) &&
      sameMarkdownSourceEtag(atom.response.headers.get("etag"), sha256Etag(atom.body)) &&
      atomLastModified === "Tue, 11 Aug 2026 00:13:39 GMT" &&
      atom.response.headers.get("x-robots-tag") === "noindex" &&
      atom.response.headers.get("link") ===
        `<${origin.origin}/updates.atom>; rel="self"; type="application/atom+xml", <${origin.origin}/>; rel="alternate"; type="text/html"` &&
      atom.body.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">',
      ) &&
      atom.body.includes(
        "<title>Zach424 / Engineering Notes — 更新订阅</title>",
      ) &&
      atom.body.includes(`<id>${origin.origin}/updates.atom</id>`) &&
      atom.body.includes("<updated>2026-08-11T00:13:39Z</updated>") &&
      (atom.body.match(/<author>/gu) ?? []).length === 1 &&
      (atom.body.match(/<entry>/gu) ?? []).length === jsonFeedItems.length &&
      JSON.stringify(atomIds) ===
        JSON.stringify(expectedAtomItems.map((item) => item.id)) &&
      atomEntriesMatchJsonFeed &&
      homeHtml.includes(
        `<link rel="alternate" type="application/atom+xml" href="${origin.origin}/updates.atom"`,
      ) &&
      !opml.body.includes("/updates.atom"),
    "Atom 1.0 更新订阅异常",
  );
  invariant(
    robots.response.status === 200 &&
      robots.response.headers.get("content-type")?.startsWith("text/plain") &&
      hasRobotsCachePolicy(robots.response.headers.get("cache-control")) &&
      sameMarkdownSourceEtag(
        robots.response.headers.get("etag"),
        sha256Etag(robots.body),
      ) &&
      robots.body.includes("Disallow: /studio") &&
      robots.body.includes(`${origin.origin}/sitemap.xml`),
    "robots 正文或条件验证器异常",
  );

  const sitemapUrls = extractSitemapUrls(sitemap.body);
  invariant(
    sitemap.response.status === 200 &&
      sitemap.response.headers.get("content-type")?.startsWith("application/xml") &&
      hasJsonFeedCachePolicy(sitemap.response.headers.get("cache-control")) &&
      sameMarkdownSourceEtag(
        sitemap.response.headers.get("etag"),
        sha256Etag(sitemap.body),
      ) &&
      sitemapUrls.includes(`${origin.origin}/archive`) &&
      sitemapUrls.includes(`${origin.origin}/activity`) &&
      sitemapUrls.includes(`${origin.origin}/subscribe`) &&
      sitemapUrls.length >= 27,
    "Sitemap URL 数量或条件验证器异常",
  );
  invariant(
    !sitemap.body.includes("/opensearch.xml"),
    "OpenSearch 描述不应进入 Sitemap",
  );
  invariant(
    !sitemap.body.includes("/tags/typescript/rss.xml"),
    "标签 RSS 不应进入 Sitemap",
  );
  invariant(
    !sitemap.body.includes("/series/build-my-blog/rss.xml"),
    "专题 RSS 不应进入 Sitemap",
  );
  invariant(
    !sitemap.body.includes("/feeds.opml"),
    "OPML 不应进入 Sitemap",
  );
  invariant(
    !sitemap.body.includes("/updates.atom"),
    "Atom 不应进入 Sitemap",
  );
  const opmlSubscriptions = extractOpmlSubscriptions(opml.body);
  const rootOpmlSubscriptions = extractOpmlGroupSubscriptions(
    opml.body,
    "全部更新",
  );
  const tagOpmlSubscriptions = extractOpmlGroupSubscriptions(
    opml.body,
    "按标签",
  );
  const seriesOpmlSubscriptions = extractOpmlGroupSubscriptions(
    opml.body,
    "按专题",
  );
  const expectedTagFeedUrls = sitemapUrls
    .filter((url) => /^\/tags\/[^/]+$/u.test(new URL(url).pathname))
    .map((url) => `${url}/rss.xml`)
    .sort();
  const expectedSeriesFeedUrls = sitemapUrls
    .filter((url) => /^\/series\/[^/]+$/u.test(new URL(url).pathname))
    .map((url) => `${url}/rss.xml`)
    .sort();
  const opmlGroupsInOrder = ["全部更新", "按标签", "按专题"].map(
    (label) => opml.body.indexOf(`<outline text="${label}">`),
  );
  invariant(
    opml.response.status === 200 &&
      opml.response.headers.get("content-type") ===
        "text/x-opml; charset=utf-8" &&
      opml.response.headers.get("content-disposition") ===
        'attachment; filename="zach424-subscriptions.opml"' &&
      hasJsonFeedCachePolicy(opml.response.headers.get("cache-control")) &&
      sameMarkdownSourceEtag(
        opml.response.headers.get("etag"),
        sha256Etag(opml.body),
      ) &&
      opml.response.headers.get("last-modified") === null &&
      opml.response.headers.get("x-robots-tag") === "noindex" &&
      opml.response.headers.get("link") ===
        `<${origin.origin}/feeds.opml>; rel="self"; type="text/x-opml", <${origin.origin}/subscribe>; rel="up"; type="text/html"` &&
      opml.body.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">',
      ) &&
      opml.body.includes("<title>Zach424 / Engineering Notes — 全部订阅</title>") &&
      opml.body.includes("<ownerName>Zach424</ownerName>") &&
      opml.body.includes("<ownerId>https://github.com/Zach424</ownerId>") &&
      opml.body.includes("<docs>https://opml.org/spec2.opml</docs>") &&
      !/<date(?:Created|Modified)>/u.test(opml.body) &&
      opmlGroupsInOrder.every((position) => position >= 0) &&
      opmlGroupsInOrder.every(
        (position, index) =>
          index === 0 || opmlGroupsInOrder[index - 1] < position,
      ) &&
      rootOpmlSubscriptions.length === 1 &&
      rootOpmlSubscriptions[0].xmlUrl === `${origin.origin}/rss.xml` &&
      JSON.stringify(tagOpmlSubscriptions.map(({ xmlUrl }) => xmlUrl).sort()) ===
        JSON.stringify(expectedTagFeedUrls) &&
      JSON.stringify(
        seriesOpmlSubscriptions.map(({ xmlUrl }) => xmlUrl).sort(),
      ) === JSON.stringify(expectedSeriesFeedUrls) &&
      opmlSubscriptions.length ===
        1 + expectedTagFeedUrls.length + expectedSeriesFeedUrls.length &&
      new Set(opmlSubscriptions.map(({ xmlUrl }) => xmlUrl)).size ===
        opmlSubscriptions.length &&
      opmlSubscriptions.every((subscription) => {
        const expectedHtmlUrl =
          subscription.xmlUrl === `${origin.origin}/rss.xml`
            ? `${origin.origin}/`
            : subscription.xmlUrl.replace(/\/rss\.xml$/u, "");
        return (
          subscription.type === "rss" &&
          subscription.text === subscription.title &&
          subscription.xmlUrl.startsWith(`${origin.origin}/`) &&
          subscription.htmlUrl === expectedHtmlUrl &&
          subscription.description.length > 0 &&
          subscription.language === "zh-CN" &&
          subscription.version === "RSS"
        );
      }),
    "OPML 2.0 聚合订阅异常",
  );
  const conditionalDiscoveryResponses = await Promise.all(
    [
      ["/feed.json", "application/feed+json", jsonFeed],
      ["/rss.xml", "application/rss+xml", rss],
      ["/tags/typescript/rss.xml", "application/rss+xml", tagRss],
      ["/series/build-my-blog/rss.xml", "application/rss+xml", seriesRss],
      ["/updates.atom", "application/atom+xml", atom],
      ["/feeds.opml", "text/x-opml", opml],
      ["/sitemap.xml", "application/xml", sitemap],
      ["/robots.txt", "text/plain", robots],
      [
        "/opensearch.xml",
        "application/opensearchdescription+xml",
        openSearch,
      ],
    ].map(([pathname, accept, source]) =>
      request(origin, pathname, {
        accept,
        headers: { "if-none-match": source.response.headers.get("etag") },
      }),
    ),
  );
  for (const [index, conditional] of conditionalDiscoveryResponses.entries()) {
    const [pathname, , source, cachePolicy] = [
      ["/feed.json", "application/feed+json", jsonFeed, hasJsonFeedCachePolicy],
      ["/rss.xml", "application/rss+xml", rss, hasJsonFeedCachePolicy],
      [
        "/tags/typescript/rss.xml",
        "application/rss+xml",
        tagRss,
        hasJsonFeedCachePolicy,
      ],
      [
        "/series/build-my-blog/rss.xml",
        "application/rss+xml",
        seriesRss,
        hasJsonFeedCachePolicy,
      ],
      ["/updates.atom", "application/atom+xml", atom, hasJsonFeedCachePolicy],
      ["/feeds.opml", "text/x-opml", opml, hasJsonFeedCachePolicy],
      ["/sitemap.xml", "application/xml", sitemap, hasJsonFeedCachePolicy],
      ["/robots.txt", "text/plain", robots, hasRobotsCachePolicy],
      [
        "/opensearch.xml",
        "application/opensearchdescription+xml",
        openSearch,
        hasJsonFeedCachePolicy,
      ],
    ][index];
    const conditionalType = conditional.response.headers.get("content-type");
    const sourceLastModified = source.response.headers.get("last-modified");
    const conditionalLastModified =
      conditional.response.headers.get("last-modified");
    invariant(
      conditional.response.status === 304 &&
        conditional.body === "" &&
        sameMarkdownSourceEtag(
          conditional.response.headers.get("etag"),
          source.response.headers.get("etag"),
        ) &&
        cachePolicy(conditional.response.headers.get("cache-control")) &&
        (conditionalType === null ||
          conditionalType === source.response.headers.get("content-type")) &&
        (sourceLastModified === null
          ? conditionalLastModified === null
          : conditionalLastModified === null ||
            conditionalLastModified === sourceLastModified),
      `${pathname} 条件请求契约异常`,
    );
  }
  const [jsonDateMatch, rssDateMatch, tagRssDateMatch, seriesRssDateMatch, atomDateMatch, staleTagWins, staleDate, malformedDate] =
    await Promise.all([
      request(origin, "/feed.json", {
        accept: "application/feed+json",
        headers: { "if-modified-since": jsonFeedLastModified },
      }),
      request(origin, "/rss.xml", {
        accept: "application/rss+xml",
        headers: { "if-modified-since": rssLastModified },
      }),
      request(origin, "/tags/typescript/rss.xml", {
        accept: "application/rss+xml",
        headers: { "if-modified-since": tagRssLastModified },
      }),
      request(origin, "/series/build-my-blog/rss.xml", {
        accept: "application/rss+xml",
        headers: { "if-modified-since": seriesRssLastModified },
      }),
      request(origin, "/updates.atom", {
        accept: "application/atom+xml",
        headers: { "if-modified-since": atomLastModified },
      }),
      request(origin, "/feed.json", {
        accept: "application/feed+json",
        headers: {
          "if-none-match": '"sha256-stale"',
          "if-modified-since": jsonFeedLastModified,
        },
      }),
      request(origin, "/rss.xml", {
        accept: "application/rss+xml",
        headers: {
          "if-modified-since": "Mon, 10 Aug 2026 21:26:24 GMT",
        },
      }),
      request(origin, "/rss.xml", {
        accept: "application/rss+xml",
        headers: { "if-modified-since": "2026-08-10T22:25:11Z" },
      }),
    ]);
  for (const [pathname, conditional, source, lastModified, cachePolicy] of [
    [
      "/feed.json",
      jsonDateMatch,
      jsonFeed,
      jsonFeedLastModified,
      hasJsonFeedCachePolicy,
    ],
    [
      "/rss.xml",
      rssDateMatch,
      rss,
      rssLastModified,
      hasJsonFeedCachePolicy,
    ],
    [
      "/tags/typescript/rss.xml",
      tagRssDateMatch,
      tagRss,
      tagRssLastModified,
      hasJsonFeedCachePolicy,
    ],
    [
      "/series/build-my-blog/rss.xml",
      seriesRssDateMatch,
      seriesRss,
      seriesRssLastModified,
      hasJsonFeedCachePolicy,
    ],
    [
      "/updates.atom",
      atomDateMatch,
      atom,
      atomLastModified,
      hasJsonFeedCachePolicy,
    ],
  ]) {
    const conditionalLastModified =
      conditional.response.headers.get("last-modified");
    invariant(
      conditional.response.status === 304 &&
        conditional.body === "" &&
        sameMarkdownSourceEtag(
          conditional.response.headers.get("etag"),
          source.response.headers.get("etag"),
        ) &&
        cachePolicy(conditional.response.headers.get("cache-control")) &&
        (conditionalLastModified === null ||
          conditionalLastModified === lastModified),
      `${pathname} If-Modified-Since 契约异常`,
    );
  }
  invariant(
    staleTagWins.response.status === 200 &&
      staleTagWins.body === jsonFeed.body &&
      staleTagWins.response.headers.get("last-modified") ===
        jsonFeedLastModified,
    "JSON Feed 未保持 If-None-Match 优先级",
  );
  invariant(
    staleDate.response.status === 200 && staleDate.body === rss.body,
    "RSS 旧 If-Modified-Since 不应命中",
  );
  invariant(
    malformedDate.response.status === 200 && malformedDate.body === rss.body,
    "RSS 非 HTTP-date 条件不应命中",
  );
  const conditionalHeadTargets = [
    ["/content.json", "application/json", contentManifest, hasMarkdownSourceCachePolicy],
    [
      "/content.schema.json",
      "application/schema+json",
      contentSchema,
      hasMarkdownSourceCachePolicy,
    ],
    ["/feed.json", "application/feed+json", jsonFeed, hasJsonFeedCachePolicy],
    ["/rss.xml", "application/rss+xml", rss, hasJsonFeedCachePolicy],
    [
      "/tags/typescript/rss.xml",
      "application/rss+xml",
      tagRss,
      hasJsonFeedCachePolicy,
    ],
    [
      "/series/build-my-blog/rss.xml",
      "application/rss+xml",
      seriesRss,
      hasJsonFeedCachePolicy,
    ],
    ["/updates.atom", "application/atom+xml", atom, hasJsonFeedCachePolicy],
    ["/feeds.opml", "text/x-opml", opml, hasJsonFeedCachePolicy],
    ["/sitemap.xml", "application/xml", sitemap, hasJsonFeedCachePolicy],
    ["/robots.txt", "text/plain", robots, hasRobotsCachePolicy],
    [
      "/opensearch.xml",
      "application/opensearchdescription+xml",
      openSearch,
      hasJsonFeedCachePolicy,
    ],
    [
      markdownSources[0].pathname,
      "text/markdown",
      sourceResponses[0],
      hasMarkdownSourceCachePolicy,
    ],
    [
      markdownSources[1].pathname,
      "text/markdown",
      sourceResponses[1],
      hasMarkdownSourceCachePolicy,
    ],
  ];
  for (const [pathname, accept, source, cachePolicy] of conditionalHeadTargets) {
    const etag = source.response.headers.get("etag");
    const lastModified = source.response.headers.get("last-modified");
    const [head, tagMatch] = await Promise.all([
      request(origin, pathname, { accept, method: "HEAD" }),
      request(origin, pathname, {
        accept,
        method: "HEAD",
        headers: { "if-none-match": etag },
      }),
    ]);
    invariant(
      head.response.status === 200 &&
        head.body === "" &&
        sameMarkdownSourceEtag(head.response.headers.get("etag"), etag) &&
        cachePolicy(head.response.headers.get("cache-control")) &&
        hasEquivalentHeadHeaders(source.response, head.response),
      `${pathname} HEAD 条件响应契约异常`,
    );
    invariant(
      tagMatch.response.status === 304 &&
        tagMatch.body === "" &&
        sameMarkdownSourceEtag(tagMatch.response.headers.get("etag"), etag) &&
        cachePolicy(tagMatch.response.headers.get("cache-control")) &&
        hasEquivalentHeadHeaders(source.response, tagMatch.response, true),
      `${pathname} ETag HEAD 条件响应契约异常`,
    );

    if (lastModified) {
      const staleDate = new Date(Date.parse(lastModified) - 1_000).toUTCString();
      const malformedDate = new Date(Date.parse(lastModified)).toISOString();
      const [dateMatch, staleDateResponse, malformedDateResponse, staleTagWins] =
        await Promise.all([
          request(origin, pathname, {
            accept,
            method: "HEAD",
            headers: { "if-modified-since": lastModified },
          }),
          request(origin, pathname, {
            accept,
            method: "HEAD",
            headers: { "if-modified-since": staleDate },
          }),
          request(origin, pathname, {
            accept,
            method: "HEAD",
            headers: { "if-modified-since": malformedDate },
          }),
          request(origin, pathname, {
            accept,
            method: "HEAD",
            headers: {
              "if-none-match": '"sha256-stale"',
              "if-modified-since": lastModified,
            },
          }),
        ]);
      invariant(
        dateMatch.response.status === 304 &&
          dateMatch.body === "" &&
          sameMarkdownSourceEtag(dateMatch.response.headers.get("etag"), etag) &&
          cachePolicy(dateMatch.response.headers.get("cache-control")) &&
          hasEquivalentHeadHeaders(source.response, dateMatch.response, true),
        `${pathname} 日期 HEAD 条件响应契约异常`,
      );
      for (const [label, response] of [
        ["旧日期", staleDateResponse],
        ["非法日期", malformedDateResponse],
        ["ETag 优先", staleTagWins],
      ]) {
        invariant(
          response.response.status === 200 &&
            response.body === "" &&
            sameMarkdownSourceEtag(response.response.headers.get("etag"), etag) &&
            cachePolicy(response.response.headers.get("cache-control")) &&
            hasEquivalentHeadHeaders(source.response, response.response),
          `${pathname} ${label} HEAD 条件响应契约异常`,
        );
      }
    }
  }
  const missingMarkdownHead = await request(
    origin,
    "/posts/not-a-public-record/source.md",
    { accept: "text/markdown", method: "HEAD", redirect: "manual" },
  );
  invariant(
    missingMarkdownHead.response.status === 404 &&
      missingMarkdownHead.body === "" &&
      missingMarkdownHead.response.headers.get("cache-control") === "no-store" &&
      missingMarkdownHead.response.headers.get("etag") === null &&
      missingMarkdownHead.response.headers.get("last-modified") === null,
    "未知 Markdown HEAD 不得生成公开验证器",
  );
  const [missingTagRss, missingTagRssHead] = await Promise.all([
    request(origin, "/tags/not-a-real-tag/rss.xml", {
      accept: "application/rss+xml",
      redirect: "manual",
    }),
    request(origin, "/tags/not-a-real-tag/rss.xml", {
      accept: "application/rss+xml",
      method: "HEAD",
      redirect: "manual",
    }),
  ]);
  invariant(
    missingTagRss.response.status === 404 &&
      missingTagRss.body === "Tag RSS not found.\n" &&
      missingTagRssHead.response.status === 404 &&
      missingTagRssHead.body === "" &&
      [missingTagRss, missingTagRssHead].every(
        (result) =>
          result.response.headers.get("cache-control") === "no-store" &&
          result.response.headers.get("content-type")?.startsWith("text/plain") &&
          result.response.headers.get("x-robots-tag") === "noindex" &&
          result.response.headers.get("etag") === null &&
          result.response.headers.get("last-modified") === null,
      ),
    "未知标签 RSS 不得生成公开验证器",
  );
  const [missingSeriesRss, missingSeriesRssHead] = await Promise.all([
    request(origin, "/series/not-a-real-series/rss.xml", {
      accept: "application/rss+xml",
      redirect: "manual",
    }),
    request(origin, "/series/not-a-real-series/rss.xml", {
      accept: "application/rss+xml",
      method: "HEAD",
      redirect: "manual",
    }),
  ]);
  invariant(
    missingSeriesRss.response.status === 404 &&
      missingSeriesRss.body === "Series RSS not found.\n" &&
      missingSeriesRssHead.response.status === 404 &&
      missingSeriesRssHead.body === "" &&
      [missingSeriesRss, missingSeriesRssHead].every(
        (result) =>
          result.response.headers.get("cache-control") === "no-store" &&
          result.response.headers.get("content-type")?.startsWith("text/plain") &&
          result.response.headers.get("x-robots-tag") === "noindex" &&
          result.response.headers.get("etag") === null &&
          result.response.headers.get("last-modified") === null,
      ),
    "未知专题 RSS 不得生成公开验证器",
  );
  const routeResponses = await Promise.all(
    sitemapUrls.map((url) => fetchWithRetry(url, { redirect: "manual" })),
  );
  const failedRoutes = routeResponses
    .map((response, index) => ({ status: response.status, url: sitemapUrls[index] }))
    .filter((entry) => entry.status !== 200);
  invariant(failedRoutes.length === 0, `Sitemap 路由失败：${JSON.stringify(failedRoutes)}`);

  return {
    origin: origin.origin,
    sitemapCount: sitemapUrls.length,
    oauth: oauth.response.status,
    htmlBudgetReports,
    discoveryBudgetReports,
  };
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isEntryPoint) {
  const origin = process.argv[2];
  if (!origin) {
    console.error("用法：npm run production:smoke -- https://example.com [--expect-oauth]");
    process.exit(1);
  }
  try {
    const result = await runProductionSmoke(origin, { expectOAuth: process.argv.includes("--expect-oauth") });
    console.log(formatHtmlBudgetReport(result.htmlBudgetReports));
    console.log(formatDiscoveryBudgetReport(result.discoveryBudgetReports));
    console.log(`[smoke] ${result.origin}: ${result.sitemapCount} routes, OAuth ${result.oauth}`);
  } catch (error) {
    console.error(`[smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
