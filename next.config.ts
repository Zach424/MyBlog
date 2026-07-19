import type { NextConfig } from "next";
import { resolveContentBuildDate } from "./build/content-build-date";
import { validateContentRepository } from "./build/validate-content";

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
  // Decap CMS evaluates editor/parser modules at runtime. Keep this exception
  // isolated to the noindex Studio routes; the public site retains the strict CSP.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

const baseSecurityHeaders = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const publishingHeaders = [
  { key: "Cache-Control", value: "no-store" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const contentCacheHeader = {
  key: "Cache-Control",
  value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
};

export default async function createNextConfig(): Promise<NextConfig> {
  await validateContentRepository(process.cwd());

  return {
    poweredByHeader: false,
    env: {
      CONTENT_BUILD_DATE: resolveContentBuildDate(),
    },
    outputFileTracingIncludes: {
      "/*": [
        "./content/**/*.md",
        "./studio/**/*",
        "./node_modules/decap-cms/dist/decap-cms.js",
      ],
    },
    async headers() {
      return [
        { source: "/:path*", headers: baseSecurityHeaders },
        {
          source: "/studio",
          headers: [
            ...publishingHeaders,
            { key: "Content-Security-Policy", value: STUDIO_CONTENT_SECURITY_POLICY },
          ],
        },
        {
          source: "/studio/:path*",
          headers: [
            ...publishingHeaders,
            { key: "Content-Security-Policy", value: STUDIO_CONTENT_SECURITY_POLICY },
          ],
        },
        {
          source: "/studio/editor-runtime-3.14.1.js",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
        { source: "/api/cms/:path*", headers: publishingHeaders },
        { source: "/", headers: [contentCacheHeader] },
        { source: "/posts/:path*", headers: [contentCacheHeader] },
        { source: "/projects/:path*", headers: [contentCacheHeader] },
        { source: "/series/:path*", headers: [contentCacheHeader] },
        { source: "/tags/:path*", headers: [contentCacheHeader] },
        { source: "/search", headers: [contentCacheHeader] },
        { source: "/about", headers: [contentCacheHeader] },
      ];
    },
  };
}
