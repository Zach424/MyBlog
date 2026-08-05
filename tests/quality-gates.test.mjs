import assert from "node:assert/strict";
import { access, readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

async function request(pathname = "/") {
  if (!process.env.TEST_BASE_URL) throw new Error("TEST_BASE_URL is required");
  return fetch(new URL(pathname, process.env.TEST_BASE_URL), {
    redirect: "manual",
    headers: {
      accept: "text/html",
      "x-forwarded-host": "blog.example.test",
      "x-forwarded-proto": "https",
    },
  });
}

async function postStudioMathPreview(body, headers = {}) {
  if (!process.env.TEST_BASE_URL) throw new Error("TEST_BASE_URL is required");
  return fetch(new URL("/studio/math-preview", process.env.TEST_BASE_URL), {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-host": "blog.example.test",
      "x-forwarded-proto": "https",
      ...headers,
    },
    method: "POST",
    redirect: "manual",
  });
}

async function postStudioEntryPreflight(body, headers = {}) {
  if (!process.env.TEST_BASE_URL) throw new Error("TEST_BASE_URL is required");
  return fetch(new URL("/studio/entry-preflight", process.env.TEST_BASE_URL), {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-host": "blog.example.test",
      "x-forwarded-proto": "https",
      ...headers,
    },
    method: "POST",
    redirect: "manual",
  });
}

function visibleDocument(html) {
  const documentEnd = html.indexOf("</html>");
  return documentEnd >= 0 ? html.slice(0, documentEnd + 7) : html;
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function luminance(hexColor) {
  const channels = hexColor
    .slice(1)
    .match(/../g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function cssTokens(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [
      match[1],
      match[2],
    ]),
  );
}

async function directoryStats(url) {
  const entries = await readdir(url, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, url);
    if (entry.isDirectory()) files.push(...(await directoryStats(entryUrl)));
    else files.push({ url: entryUrl, size: (await stat(entryUrl)).size });
  }

  return files;
}

test("applies the production security and cache baseline", async () => {
  for (const pathname of ["/", "/posts/building-a-maintainable-blog", "/rss.xml"]) {
    const response = await request(pathname);
    assert.equal(response.status, 200, pathname);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", pathname);
    assert.equal(response.headers.get("x-frame-options"), "DENY", pathname);
    assert.equal(
      response.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
      pathname,
    );
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin", pathname);
    assert.equal(
      response.headers.get("permissions-policy"),
      "camera=(), geolocation=(), microphone=()",
      pathname,
    );
    assert.match(
      response.headers.get("strict-transport-security") ?? "",
      /^max-age=31536000;/,
      pathname,
    );
    const policy = response.headers.get("content-security-policy") ?? "";
    assert.match(policy, /default-src 'self'/, pathname);
    assert.match(policy, /frame-ancestors 'none'/, pathname);
    assert.match(policy, /object-src 'none'/, pathname);
    assert.match(policy, /img-src 'self' data: https:/, pathname);
    assert.equal(response.headers.get("x-powered-by"), null, pathname);
  }

  const htmlResponse = await request("/");
  assert.equal(
    htmlResponse.headers.get("cache-control"),
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );
  const rssResponse = await request("/rss.xml");
  assert.match(rssResponse.headers.get("cache-control") ?? "", /max-age=3600/);
  const missingResponse = await request("/definitely-missing");
  assert.equal(missingResponse.status, 404);
  assert.match(missingResponse.headers.get("cache-control") ?? "", /no-store/);

  const studioResponse = await request("/studio");
  assert.equal(studioResponse.status, 200);
  assert.equal(studioResponse.headers.get("cache-control"), "no-store");
  assert.equal(
    studioResponse.headers.get("cross-origin-opener-policy"),
    "same-origin-allow-popups",
  );
  assert.match(
    studioResponse.headers.get("content-security-policy") ?? "",
    /connect-src 'self' https:\/\/api\.github\.com https:\/\/github\.com/,
  );
});

test("serves Studio, its maintenance queue, and media inventory through explicit Next.js routes", async () => {
  await assert.rejects(access(new URL("../public/studio", import.meta.url)));
  const [studio, maintenancePage, maintenanceModule, maintenanceStyles, maintenanceResponse, config, manifest, preflight, stableSlugWidget, entryPreflightModule, mathPreviewModule, preview, katexStyles, runtime, unknown] = await Promise.all([
    request("/studio"),
    request("/studio/maintenance"),
    request("/studio/maintenance.mjs"),
    request("/studio/maintenance.css"),
    request("/studio/maintenance.json"),
    request("/studio/config.mjs"),
    request("/studio/media-manifest.json"),
    request("/studio/media-preflight.mjs"),
    request("/studio/stable-slug-widget.mjs"),
    request("/studio/entry-preflight.mjs"),
    request("/studio/math-preview.mjs"),
    request("/studio/preview.css"),
    request("/studio/katex-0.16.47.css"),
    request("/studio/editor-runtime-3.14.1.js"),
    request("/studio/definitely-missing"),
  ]);
  assert.equal(studio.status, 200);
  assert.match(await studio.text(), /Publishing studio \/ Git-backed/);
  assert.equal(maintenancePage.status, 200);
  assert.match(await maintenancePage.text(), /REVIEW HORIZON/u);
  assert.equal(maintenancePage.headers.get("cache-control"), "no-store");
  assert.match(await maintenanceModule.text(), /requestStudioMaintenance/u);
  assert.equal(maintenanceModule.headers.get("cache-control"), "no-store");
  assert.match(await maintenanceStyles.text(), /grid-template-columns:\s*minmax\(0,\s*14rem\)/u);
  assert.equal(maintenanceStyles.headers.get("cache-control"), "no-store");
  assert.equal(maintenanceResponse.status, 200);
  assert.equal(maintenanceResponse.headers.get("cache-control"), "no-store");
  assert.equal(maintenanceResponse.headers.get("x-robots-tag"), "noindex, nofollow");
  const maintenance = await maintenanceResponse.json();
  assert.equal(maintenance.version, 1);
  assert.match(maintenance.reportDate, /^\d{4}-\d{2}-\d{2}$/u);
  assert.equal(maintenance.currentCount, 1);
  assert.equal(maintenance.historicalCount, 3);
  assert.deepEqual(maintenance.records.map((record) => record.slug), ["myblog"]);
  assert.equal(maintenance.records[0].editUrl, "/studio/#/collections/projects/entries/myblog");
  assert.equal(maintenance.records[0].publicUrl, "/projects/myblog");
  assert.equal(maintenance.records[0].status, "healthy");
  assert.ok(!("body" in maintenance.records[0]));
  assert.ok(!("sourcePath" in maintenance.records[0]));
  assert.match(await config.text(), /repo: "Zach424\/MyBlog"/);
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get("content-type") ?? "", /^application\/json/u);
  assert.equal(manifest.headers.get("cache-control"), "no-store");
  assert.equal(manifest.headers.get("x-robots-tag"), "noindex, nofollow");
  const mediaInventory = await manifest.json();
  assert.equal(mediaInventory.version, 1);
  assert.equal(mediaInventory.root, "public/uploads");
  assert.deepEqual(
    mediaInventory.entries.map((entry) => entry.path),
    [
      "public/uploads/building-a-maintainable-blog/content-delivery-pipeline.webp",
      "public/uploads/myblog/cover.webp",
    ],
  );
  for (const entry of mediaInventory.entries) {
    assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(entry.bytes > 0);
  }
  assert.match(await preflight.text(), /inspectStudioMediaFile/);
  assert.match(await request("/studio/media-preflight.mjs").then((response) => response.text()), /media-manifest\.json/u);
  assert.equal(preflight.headers.get("cache-control"), "no-store");
  assert.match(await stableSlugWidget.text(), /registerStableSlugWidget/);
  assert.equal(stableSlugWidget.headers.get("cache-control"), "no-store");
  assert.match(await entryPreflightModule.text(), /serializeStudioEntry/);
  assert.equal(entryPreflightModule.headers.get("cache-control"), "no-store");
  assert.match(await mathPreviewModule.text(), /registerStudioMathPreview/);
  assert.equal(mathPreviewModule.headers.get("cache-control"), "no-store");
  const previewCss = await preview.text();
  assert.match(previewCss, /--canvas:/);
  assert.match(previewCss, /\*::before,[\s\S]*?box-sizing: border-box/u);
  const katexCss = await katexStyles.text();
  assert.equal(katexStyles.status, 200);
  assert.equal(
    katexStyles.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  assert.match(katexCss, /data:font\/woff2;base64,/u);
  assert.match(katexCss, /\.katex-version:after\{content:"0\.16\.47"\}/u);
  assert.doesNotMatch(katexCss, /url\(fonts\//u);
  assert.ok(katexCss.length > 250_000 && katexCss.length < 500_000);
  assert.match(await runtime.text(), /decap-cms 3\.14\.1/);
  assert.equal(runtime.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get("cache-control") ?? "", /no-store/);
});

test("preflights bounded Studio entries with the production content contract", async () => {
  const validFields = {
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
  };
  const valid = await postStudioEntryPreflight({ collection: "posts", fields: validFields });
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.equal(valid.headers.get("x-robots-tag"), "noindex, nofollow");
  const validPayload = await valid.json();
  assert.equal(validPayload.ok, true);
  assert.equal(validPayload.issueCount, 0);
  assert.deepEqual(validPayload.facts.map((fact) => fact.label), ["PATH", "VISIBILITY", "CONTEXT", "BODY"]);

  const invalid = await postStudioEntryPreflight({
    collection: "posts",
    fields: { ...validFields, body: "", draft: true, featured: true, slug: "Bad Slug" },
  });
  assert.equal(invalid.status, 422);
  const invalidPayload = await invalid.json();
  assert.equal(invalidPayload.ok, false);
  assert.ok(invalidPayload.issues.some((issue) => issue.field === "body"));
  assert.ok(invalidPayload.issues.some((issue) => issue.field === "featured"));
  assert.ok(invalidPayload.issues.some((issue) => issue.field === "slug"));

  const wrongOrigin = await postStudioEntryPreflight(
    { collection: "posts", fields: validFields },
    { origin: "https://attacker.example" },
  );
  assert.equal(wrongOrigin.status, 403);

  const wrongType = await postStudioEntryPreflight("plain text", {
    "content-type": "text/plain",
  });
  assert.equal(wrongType.status, 415);

  const tooLarge = await postStudioEntryPreflight({
    collection: "posts",
    fields: { ...validFields, body: "x".repeat(128 * 1024) },
  });
  assert.equal(tooLarge.status, 413);
});

test("renders bounded Studio formula previews with the production Markdown pipeline", async () => {
  const valid = await postStudioMathPreview({
    markdown: "行内 $E = mc^2$。\n\n$$\nB = \\sum_i B_i\n$$",
  });
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.equal(valid.headers.get("x-robots-tag"), "noindex, nofollow");
  const validPayload = await valid.json();
  assert.equal(validPayload.ok, true);
  assert.equal(validPayload.formulaCount, 2);
  assert.match(validPayload.html, /data-studio-renderer="production-pipeline"/u);
  assert.match(validPayload.html, /class="katex"/u);
  assert.match(validPayload.html, /<math/u);
  assert.doesNotMatch(validPayload.html, /<script/u);

  const unsafeLink = await postStudioMathPreview({
    markdown: "[unsafe](javascript:alert(1)) $x$",
  });
  assert.equal(unsafeLink.status, 200);
  assert.doesNotMatch(await unsafeLink.text(), /href=\\?"javascript:/u);

  const invalid = await postStudioMathPreview({
    markdown: "before\n\n$\\frac{1}{$",
  });
  assert.equal(invalid.status, 422);
  const invalidPayload = await invalid.json();
  assert.equal(invalidPayload.ok, false);
  assert.equal(invalidPayload.issue.line, 3);
  assert.match(invalidPayload.issue.message, /Expected|end of input/u);

  const wrongOrigin = await postStudioMathPreview(
    { markdown: "$x$" },
    { origin: "https://attacker.example" },
  );
  assert.equal(wrongOrigin.status, 403);

  const tooLarge = await postStudioMathPreview({
    markdown: "x".repeat(100_001),
  });
  assert.equal(tooLarge.status, 413);
});

test("keeps key HTML routes structurally valid and uniquely identified", async () => {
  const paths = [
    "/",
    "/posts",
    "/posts/building-a-maintainable-blog",
    "/projects/myblog",
    "/series/build-my-blog",
    "/tags/typescript",
    "/search?q=cloudflare",
    "/knowledge",
    "/about",
  ];

  for (const pathname of paths) {
    const response = await request(pathname);
    assert.equal(response.status, 200, pathname);
    const html = visibleDocument(await response.text());
    assert.equal(countMatches(html, /<main\b/g), 1, `${pathname}: main`);
    assert.equal(countMatches(html, /<h1\b/g), 1, `${pathname}: h1`);
    assert.match(html, /<html lang="zh-CN">/, pathname);
    assert.match(html, /<meta name="description" content="[^"]+"/, pathname);
    assert.match(html, /<link rel="canonical" href="https:\/\/blog\.example\.test(?:\/|\")/, pathname);
    assert.match(html, /<a class="skip-link" href="#main-content">/, pathname);
    assert.ok(Buffer.byteLength(html) < 100_000, `${pathname}: HTML exceeds 100 KB`);

    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${pathname}: duplicate id`);
  }
});

test("keeps every visible internal navigation target healthy", async () => {
  const sourcePaths = [
    "/",
    "/posts",
    "/posts/building-a-maintainable-blog",
    "/posts/cross-platform-npm-scripts",
    "/projects",
    "/projects/myblog",
    "/series",
    "/tags",
    "/search",
    "/knowledge",
    "/about",
  ];
  const targetPaths = new Set();

  for (const sourcePath of sourcePaths) {
    const response = await request(sourcePath);
    const html = visibleDocument(await response.text());
    for (const match of html.matchAll(/\shref="([^"]+)"/g)) {
      const href = match[1];
      if (href.startsWith("#") || href.startsWith("/assets/")) continue;
      const url = new URL(href, "https://blog.example.test");
      if (url.origin !== "https://blog.example.test") continue;
      targetPaths.add(`${url.pathname}${url.search}`);
    }
  }

  for (const pathname of [...targetPaths].sort()) {
    const response = await request(pathname);
    assert.ok(response.status < 400, `${pathname}: ${response.status}`);
  }
});

test("enforces deployment artifact budgets", async () => {
  const clientFiles = await directoryStats(new URL("../.next/static/", import.meta.url));
  const clientBytes = clientFiles.reduce((total, file) => total + file.size, 0);
  const largestClientJavaScript = Math.max(
    ...clientFiles.filter((file) => file.url.pathname.endsWith(".js")).map((file) => file.size),
  );
  const cssBytes = (await readFile(new URL("../app/globals.css", import.meta.url))).byteLength;

  assert.ok(clientBytes < 3_000_000, `client total ${clientBytes} >= 3 MB`);
  assert.ok(largestClientJavaScript < 300_000, `largest client JS ${largestClientJavaScript} >= 300 KB`);
  assert.ok(cssBytes < 100_000, `global CSS ${cssBytes} >= 100 KB`);
});

test("keeps text design tokens at WCAG AA contrast", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const lightBlock = css.match(/:root\s*{([^}]+)}/)?.[1] ?? "";
  const darkBlock = css.match(
    /@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*?:root\s*{([^}]+)}/,
  )?.[1] ?? "";
  const themes = [
    ["light", cssTokens(lightBlock)],
    ["dark", cssTokens(darkBlock)],
  ];

  for (const [name, tokens] of themes) {
    for (const role of ["ink", "muted", "faint", "signal", "trace-dark"]) {
      const ratio = contrastRatio(tokens[role], tokens.canvas);
      assert.ok(ratio >= 4.5, `${name} ${role} contrast ${ratio.toFixed(2)} < 4.5`);
    }
  }
});

test("keeps the root layout fluid at 320px viewports", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const htmlBlock = css.match(/html\s*{([^}]+)}/)?.[1] ?? "";
  const bodyBlock = css.match(/body\s*{([^}]+)}/)?.[1] ?? "";

  assert.doesNotMatch(htmlBlock, /min-width\s*:/, "html must not force horizontal overflow");
  assert.doesNotMatch(bodyBlock, /min-width\s*:/, "body must not force horizontal overflow");
  assert.match(css, /\.page-shell\s*{[^}]*width:\s*min\(calc\(100%/s);
  assert.match(css, /\.knowledge-map-scroll\s*{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media \(max-width:\s*42rem\)[\s\S]*?\.knowledge-map-frame\s*{[^}]*display:\s*none/s);
  assert.match(css, /@media \(max-width:\s*42rem\)[\s\S]*?\.knowledge-mobile-note\s*{[^}]*display:\s*block/s);
});
