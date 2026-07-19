/** Cloudflare Worker entry point for Zach424 Engineering Notes. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleCmsOAuth, type CmsOAuthEnv } from "../lib/cms-oauth";
import studioConfig from "../studio/config.mjs?raw";
import studioHtml from "../studio/index.html?raw";
import studioPreviewCss from "../studio/preview.css?raw";

interface Env extends CmsOAuthEnv {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

const STUDIO_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://api.github.com https://github.com",
  "font-src 'self' data:",
  "form-action 'self' https://github.com",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://github.com",
  "manifest-src 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

const STUDIO_ASSETS = new Map<string, { body: string; contentType: string }>([
  ["/studio", { body: studioHtml, contentType: "text/html; charset=utf-8" }],
  ["/studio/", { body: studioHtml, contentType: "text/html; charset=utf-8" }],
  ["/studio/config.mjs", { body: studioConfig, contentType: "text/javascript; charset=utf-8" }],
  ["/studio/preview.css", { body: studioPreviewCss, contentType: "text/css; charset=utf-8" }],
]);

function withProductionHeaders(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  const pathname = new URL(request.url).pathname;
  const isPublishingRoute = pathname.startsWith("/studio") || pathname.startsWith("/api/cms/");
  const contentType = headers.get("content-type") ?? "";
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    .trim();
  const isHttps = forwardedProtocol === "https" || new URL(request.url).protocol === "https:";

  headers.set(
    "content-security-policy",
    pathname.startsWith("/studio") ? STUDIO_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY,
  );
  headers.set(
    "cross-origin-opener-policy",
    isPublishingRoute ? "same-origin-allow-popups" : "same-origin",
  );
  headers.set("permissions-policy", "camera=(), geolocation=(), microphone=()");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.delete("x-powered-by");

  if (isHttps) {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  if (isPublishingRoute) {
    headers.set("cache-control", "no-store");
  } else if (contentType.startsWith("text/html") && response.ok) {
    headers.set(
      "cache-control",
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
  } else if (contentType.startsWith("text/html")) {
    headers.set("cache-control", "no-store");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const studioAsset = STUDIO_ASSETS.get(url.pathname);
    if (studioAsset) {
      return withProductionHeaders(
        request,
        new Response(studioAsset.body, {
          headers: { "content-type": studioAsset.contentType },
        }),
      );
    }

    if (url.pathname.startsWith("/studio/")) {
      return withProductionHeaders(request, new Response("Not found", { status: 404 }));
    }

    if (url.pathname === "/api/cms/auth" || url.pathname === "/api/cms/callback") {
      return withProductionHeaders(request, await handleCmsOAuth(request, env));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withProductionHeaders(request, response);
    }

    const response = await handler.fetch(request, env, ctx);
    return withProductionHeaders(request, response);
  },
};

export default worker;
