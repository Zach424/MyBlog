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

test("connects deployment, smoke testing, rollback, and Studio routing without interpolated credentials", async () => {
  const [deploy, rollback, smoke, viteConfig, worker, staticHeaders] = await Promise.all([
    readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/rollback.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/smoke-production.mjs", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/_headers", import.meta.url), "utf8"),
  ]);
  assert.match(deploy, /id: deploy/);
  assert.match(deploy, /outputs\.deployment-url/);
  assert.match(deploy, /--expect-oauth/);
  assert.match(rollback, /npx wrangler/);
  assert.match(rollback, /CLOUDFLARE_PRODUCTION_URL/);
  assert.match(rollback, /args=\(rollback\)/);
  assert.match(rollback, /--yes/);
  assert.match(smoke, /Sitemap 路由失败/);
  assert.match(smoke, /same-origin-allow-popups/);
  assert.doesNotMatch(smoke, /CLOUDFLARE_API_TOKEN|GITHUB_OAUTH_SECRET/);
  assert.match(viteConfig, /run_worker_first: \["\/studio", "\/studio\/\*", "\/api\/cms\/\*"\]/);
  assert.match(worker, /url\.pathname\.startsWith\("\/studio\/"\)/);
  assert.match(staticHeaders, /\/studio\/\*/);
  assert.match(staticHeaders, /Cache-Control: no-store/);
  assert.match(staticHeaders, /Cross-Origin-Opener-Policy: same-origin-allow-popups/);
  assert.match(staticHeaders, /Content-Security-Policy: default-src 'self'/);
});
