import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        "x-forwarded-host": "blog.example.test",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the engineering log homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>Zach424 \/ Engineering Notes<\/title>/i);
  assert.match(
    html,
    /<meta name="description" content="记录学习路径、技术取舍和项目复盘，把写过的代码变成可复用的判断。"/i,
  );
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/blog\.example\.test\/"/i,
  );
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/blog\.example\.test\/og\.png"/i,
  );
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
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /Starter Project|react-loading-skeleton|Your site is taking shape/);
});

test("removes starter artifacts and keeps the design contract explicit", async () => {
  const [page, layout, css, packageJson, ogImage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(page, /className="trace"/);
  assert.match(page, /className="evidence-rail"/);
  assert.match(page, /href="https:\/\/github\.com\/Zach424\/MyBlog"/);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview|codex-preview/);

  assert.match(layout, /export async function generateMetadata/);
  assert.match(layout, /x-forwarded-host/);
  assert.match(layout, /<html lang="zh-CN">/);
  assert.doesNotMatch(layout, /next\/font|Starter Project|favicon\.svg/);

  assert.match(css, /--signal:\s*#e4572e/i);
  assert.match(css, /@media \(prefers-color-scheme:\s*dark\)/i);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /a:focus-visible/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  assert.equal(ogImage.readUInt32BE(16), 1200);
  assert.equal(ogImage.readUInt32BE(20), 630);

  await Promise.all([
    assert.rejects(
      access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
    ),
    assert.rejects(access(new URL("../public/favicon.svg", import.meta.url))),
    assert.rejects(access(new URL("../public/file.svg", import.meta.url))),
    assert.rejects(access(new URL("../public/globe.svg", import.meta.url))),
    assert.rejects(access(new URL("../public/window.svg", import.meta.url))),
  ]);
});
