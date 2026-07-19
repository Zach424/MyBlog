import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

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
    redirect: options.redirect ?? "follow",
    headers: { accept: options.accept ?? "text/html" },
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

  for (const [pathname, marker] of [
    ["/posts", "文章与 TIL"],
    ["/projects", "项目复盘"],
    ["/posts/building-a-maintainable-blog", "从零搭建可维护的个人技术博客"],
    ["/projects/myblog", "MyBlog"],
    ["/search?q=cloudflare", "Cloudflare"],
  ]) {
    const page = await request(origin, pathname);
    invariant(page.response.status === 200, `${pathname} 状态 ${page.response.status}`);
    invariant(page.body.includes(marker), `${pathname} 缺少预期内容`);
  }

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

  const [studioConfig, studioPreview, studioRuntime, unknownStudioAsset] = await Promise.all([
    request(origin, "/studio/config.mjs", { accept: "text/javascript" }),
    request(origin, "/studio/preview.css", { accept: "text/css" }),
    request(origin, "/studio/editor-runtime-3.14.1.js", { accept: "text/javascript" }),
    request(origin, "/studio/definitely-missing", { redirect: "manual" }),
  ]);
  invariant(
    studioConfig.response.status === 200 && studioConfig.body.includes('repo: "Zach424/MyBlog"'),
    "Studio 配置模块不可用",
  );
  invariant(
    studioConfig.response.headers.get("content-type")?.startsWith("text/javascript"),
    "Studio 配置模块类型不正确",
  );
  invariant(
    studioPreview.response.status === 200 && studioPreview.body.includes("--canvas:"),
    "Studio 预览样式不可用",
  );
  invariant(
    studioPreview.response.headers.get("content-type")?.startsWith("text/css"),
    "Studio 预览样式类型不正确",
  );
  for (const asset of [studioConfig, studioPreview]) {
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

  return { origin: origin.origin, sitemapCount: sitemapUrls.length, oauth: oauth.response.status };
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
    console.log(`[smoke] ${result.origin}: ${result.sitemapCount} routes, OAuth ${result.oauth}`);
  } catch (error) {
    console.error(`[smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
