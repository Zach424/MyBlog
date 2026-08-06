import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  assertHtmlBudgetCoverage,
  assertHtmlBudgets,
  formatHtmlBudgetReport,
  HTML_ROUTE_BASELINES,
  measureHtmlBudget,
} from "./html-budget.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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

  const htmlBudgetReports = [
    measureHtmlBudget({ pathname: "/", html: home.body }),
  ];

  for (const [pathname, marker] of [
    ["/posts", "文章与 TIL"],
    ["/projects", "项目复盘"],
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
    if (HTML_ROUTE_BASELINES[pathname]) {
      htmlBudgetReports.push(measureHtmlBudget({ pathname, html: page.body }));
    }
  }
  assertHtmlBudgetCoverage(htmlBudgetReports);
  assertHtmlBudgets(htmlBudgetReports);

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

  const [studioMaintenancePage, studioMaintenanceModule, studioMaintenanceStyles, studioMaintenanceResponse, studioConfig, studioManifest, studioPreflight, stableSlugWidget, entryPreflightModule, mathPreviewModule, studioPreview, katexStyles, studioRuntime, unknownStudioAsset] = await Promise.all([
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
    request(origin, "/studio/preview.css", { accept: "text/css" }),
    request(origin, "/studio/katex-0.16.47.css", { accept: "text/css" }),
    request(origin, "/studio/editor-runtime-3.14.1.js", { accept: "text/javascript" }),
    request(origin, "/studio/definitely-missing", { redirect: "manual" }),
  ]);
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
  for (const asset of [studioMaintenancePage, studioMaintenanceModule, studioMaintenanceStyles, studioMaintenanceResponse, studioConfig, studioManifest, studioPreflight, stableSlugWidget, entryPreflightModule, mathPreviewModule, studioPreview]) {
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
      markdown: "行内 $E = mc^2$。\n\n$$\nB = \\sum_i B_i\n$$",
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
      mathPreviewPayload.html.includes('class="katex"') &&
      mathPreviewPayload.html.includes("<math"),
    "Studio 公式生产管线预览不可用",
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

  const [rss, robots, sitemap] = await Promise.all([
    request(origin, "/rss.xml", { accept: "application/rss+xml" }),
    request(origin, "/robots.txt", { accept: "text/plain" }),
    request(origin, "/sitemap.xml", { accept: "application/xml" }),
  ]);
  invariant(rss.response.status === 200 && (rss.body.match(/<item>/gu) ?? []).length >= 4, "RSS 条目异常");
  invariant(robots.body.includes("Disallow: /studio"), "robots 未排除 Studio");
  invariant(robots.body.includes(`${origin.origin}/sitemap.xml`), "robots Sitemap 主机异常");

  const sitemapUrls = extractSitemapUrls(sitemap.body);
  invariant(sitemap.response.status === 200 && sitemapUrls.length >= 23, "Sitemap URL 数量异常");
  const routeResponses = await Promise.all(
    sitemapUrls.map((url) => fetchWithRetry(url, { redirect: "manual" })),
  );
  const failedRoutes = routeResponses
    .map((response, index) => ({ status: response.status, url: sitemapUrls[index] }))
    .filter((entry) => entry.status !== 200);
  invariant(failedRoutes.length === 0, `Sitemap 路由失败：${JSON.stringify(failedRoutes)}`);

  const missing = await request(origin, `/definitely-missing-${Date.now()}`);
  invariant(missing.response.status === 404, `未知路由状态 ${missing.response.status}`);
  invariant(
    (missing.response.headers.get("cache-control") ?? "").includes("no-store"),
    "404 必须 no-store",
  );

  return {
    origin: origin.origin,
    sitemapCount: sitemapUrls.length,
    oauth: oauth.response.status,
    htmlBudgetReports,
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
    console.log(`[smoke] ${result.origin}: ${result.sitemapCount} routes, OAuth ${result.oauth}`);
  } catch (error) {
    console.error(`[smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
