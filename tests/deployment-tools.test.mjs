import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  extractSitemapUrls,
  hasJsonFeedCachePolicy,
  hasMarkdownSourceCachePolicy,
  hasMarkdownSourceEtag,
  sameMarkdownSourceEtag,
} from "../scripts/smoke-production.mjs";

test("extracts exact production routes from a Sitemap", () => {
  assert.deepEqual(
    extractSitemapUrls("<urlset><url><loc>https://blog.test/</loc></url><url><loc>https://blog.test/posts/a</loc></url></urlset>"),
    ["https://blog.test/", "https://blog.test/posts/a"],
  );
});

test("accepts the JSON Feed cache policy before and after Vercel consumes SWR", () => {
  assert.equal(
    hasJsonFeedCachePolicy("public, max-age=3600, stale-while-revalidate=86400"),
    true,
  );
  assert.equal(hasJsonFeedCachePolicy("public, max-age=3600"), true);
  assert.equal(hasJsonFeedCachePolicy("public, max-age=60"), false);
  assert.equal(hasJsonFeedCachePolicy("private, max-age=3600"), false);
  assert.equal(hasJsonFeedCachePolicy("public, max-age=3600, stale-while-revalidate=60"), false);
});

test("accepts the Markdown source cache policy before and after Vercel consumes CDN directives", () => {
  assert.equal(
    hasMarkdownSourceCachePolicy(
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    ),
    true,
  );
  assert.equal(hasMarkdownSourceCachePolicy("public, max-age=0"), true);
  assert.equal(hasMarkdownSourceCachePolicy("public, max-age=3600"), false);
  assert.equal(
    hasMarkdownSourceCachePolicy("public, max-age=0, s-maxage=60"),
    false,
  );
  assert.equal(hasMarkdownSourceCachePolicy("private, max-age=0"), false);
});

test("accepts Vercel weakening without losing the Markdown source digest identity", () => {
  const strong = `"sha256-${"a".repeat(64)}"`;
  const weak = `W/${strong}`;
  assert.equal(hasMarkdownSourceEtag(strong), true);
  assert.equal(hasMarkdownSourceEtag(weak), true);
  assert.equal(sameMarkdownSourceEtag(strong, weak), true);
  assert.equal(sameMarkdownSourceEtag(weak, strong), true);
  assert.equal(sameMarkdownSourceEtag(strong, `"sha256-${"b".repeat(64)}"`), false);
  assert.equal(hasMarkdownSourceEtag(`"md5-${"a".repeat(32)}"`), false);
  assert.equal(hasMarkdownSourceEtag('W/"sha256-short"'), false);
  assert.equal(sameMarkdownSourceEtag(null, strong), false);
});

test("connects Vercel verification, maintenance reporting, rollback, and Studio routing without Cloudflare", async () => {
  const [productionSmoke, quality, rollback, smoke, maintenance, stagingMedia, inboxReadiness, externalLinks, migrationStatus, nextConfig, authRoute, packageJson, vercelConfig] = await Promise.all([
    readFile(new URL("../.github/workflows/production-smoke.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/rollback.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/smoke-production.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/report-content-maintenance.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/report-staging-media.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/report-inbox-readiness.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/report-external-links.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/check-migration-status.mjs", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cms/auth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);
  assert.match(productionSmoke, /deployment_status/);
  assert.match(productionSmoke, /vars\.VERCEL_PRODUCTION_URL/);
  assert.match(productionSmoke, /environment_url/);
  assert.match(productionSmoke, /--expect-oauth/);
  assert.match(quality, /content:status/);
  assert.match(quality, /media:staging/);
  assert.match(quality, /--github-summary/);
  assert.match(quality, /cron: "0 1 \* \* 1"/);
  assert.match(rollback, /vercel@56\.3\.2/);
  assert.match(rollback, /VERCEL_PRODUCTION_URL/);
  assert.match(rollback, /args=\(rollback "\$DEPLOYMENT_URL"\)/);
  assert.match(smoke, /Sitemap 路由失败/);
  assert.match(smoke, /assertHtmlBudgets/);
  assert.match(smoke, /assertHtmlBudgetCoverage/);
  assert.match(smoke, /\/feed\.json/);
  assert.match(smoke, /application\/feed\+json/);
  assert.match(smoke, /https:\/\/jsonfeed\.org\/version\/1\.1/);
  assert.match(smoke, /\/posts\/building-a-maintainable-blog\/source\.md/);
  assert.match(smoke, /\/projects\/myblog\/source\.md/);
  assert.match(smoke, /text\/markdown/);
  assert.match(smoke, /if-none-match/);
  assert.match(smoke, /last-modified/);
  assert.match(smoke, /sha256-/);
  assert.match(smoke, /formatHtmlBudgetReport/);
  assert.match(smoke, /\/knowledge/);
  assert.match(smoke, /\/blog 永久重定向/);
  assert.match(smoke, /same-origin-allow-popups/);
  assert.match(smoke, /\/studio\/config\.mjs/);
  assert.match(smoke, /\/studio\/media-preflight\.mjs/);
  assert.match(smoke, /\/studio\/stable-slug-widget\.mjs/);
  assert.match(smoke, /\/studio\/entry-preflight\.mjs/);
  assert.match(smoke, /\/studio\/entry-preflight/);
  assert.match(smoke, /\/studio\/maintenance\.mjs/);
  assert.match(smoke, /\/studio\/maintenance\.json/);
  assert.match(smoke, /\/studio\/math-preview\.mjs/);
  assert.match(smoke, /\/studio\/math-preview/);
  assert.match(smoke, /\/studio\/katex-0\.16\.47\.css/);
  assert.match(smoke, /\/studio\/preview\.css/);
  assert.match(smoke, /frame-ancestors 'none'/);
  assert.doesNotMatch(smoke, /CLOUDFLARE_API_TOKEN|GITHUB_OAUTH_SECRET/);
  assert.match(maintenance, /GITHUB_STEP_SUMMARY/);
  assert.match(maintenance, /formatContentMaintenanceAnnotations/);
  assert.match(stagingMedia, /formatStagingMediaAnnotations/);
  assert.match(stagingMedia, /不会自动删除文件/);
  assert.match(inboxReadiness, /inspectInboxReadiness/);
  assert.match(inboxReadiness, /不会移动、改写、提交或推送/u);
  assert.match(externalLinks, /--check/u);
  assert.match(externalLinks, /--fail-on-broken/u);
  assert.match(externalLinks, /默认模式只读取公开 Markdown/u);
  assert.match(migrationStatus, /process\.env\.ComSpec/);
  assert.match(migrationStatus, /vercel@56\.3\.2", "whoami/);
  assert.match(nextConfig, /STUDIO_CONTENT_SECURITY_POLICY/);
  assert.match(nextConfig, /same-origin-allow-popups/);
  assert.match(authRoute, /handleCmsOAuth/);
  assert.match(packageJson, /"build": "next build"/);
  assert.match(packageJson, /"content:status"/);
  assert.match(packageJson, /"content:inbox"/);
  assert.match(packageJson, /"release:check": "[^"]*content:inbox/u);
  assert.match(packageJson, /"links:external"/);
  assert.match(packageJson, /"release:check": "[^"]*links:external/u);
  assert.match(packageJson, /"media:staging"/);
  assert.doesNotMatch(quality, /links:external/u);
  assert.doesNotMatch(packageJson, /cloudflare|vinext|wrangler/i);
  assert.match(vercelConfig, /"framework": "nextjs"/);
});
