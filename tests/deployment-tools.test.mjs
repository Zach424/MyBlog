import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractSitemapUrls } from "../scripts/smoke-production.mjs";

test("extracts exact production routes from a Sitemap", () => {
  assert.deepEqual(
    extractSitemapUrls("<urlset><url><loc>https://blog.test/</loc></url><url><loc>https://blog.test/posts/a</loc></url></urlset>"),
    ["https://blog.test/", "https://blog.test/posts/a"],
  );
});

test("connects Vercel verification, rollback, and Studio routing without Cloudflare", async () => {
  const [productionSmoke, rollback, smoke, nextConfig, authRoute, packageJson, vercelConfig] = await Promise.all([
    readFile(new URL("../.github/workflows/production-smoke.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/rollback.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/smoke-production.mjs", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cms/auth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);
  assert.match(productionSmoke, /deployment_status/);
  assert.match(productionSmoke, /environment_url/);
  assert.match(productionSmoke, /--expect-oauth/);
  assert.match(rollback, /vercel@56\.3\.2/);
  assert.match(rollback, /VERCEL_PRODUCTION_URL/);
  assert.match(rollback, /args=\(rollback\)/);
  assert.match(smoke, /Sitemap 路由失败/);
  assert.match(smoke, /same-origin-allow-popups/);
  assert.match(smoke, /\/studio\/config\.mjs/);
  assert.match(smoke, /\/studio\/preview\.css/);
  assert.match(smoke, /frame-ancestors 'none'/);
  assert.doesNotMatch(smoke, /CLOUDFLARE_API_TOKEN|GITHUB_OAUTH_SECRET/);
  assert.match(nextConfig, /STUDIO_CONTENT_SECURITY_POLICY/);
  assert.match(nextConfig, /same-origin-allow-popups/);
  assert.match(authRoute, /handleCmsOAuth/);
  assert.match(packageJson, /"build": "next build"/);
  assert.doesNotMatch(packageJson, /cloudflare|vinext|wrangler/i);
  assert.match(vercelConfig, /"framework": "nextjs"/);
});
