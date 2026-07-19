import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

async function request(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("quality", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: {
        accept: "text/html",
        "x-forwarded-host": "blog.example.test",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const assetPath = new URL(request.url).pathname.replace(/^\//u, "");
          try {
            const body = await readFile(new URL(`../dist/client/${assetPath}`, import.meta.url));
            const contentType = assetPath.endsWith(".html")
              ? "text/html; charset=utf-8"
              : "application/octet-stream";
            return new Response(body, { headers: { "content-type": contentType } });
          } catch {
            return new Response("Not found", { status: 404 });
          }
        },
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
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
  assert.equal(missingResponse.headers.get("cache-control"), "no-store");

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

test("keeps key HTML routes structurally valid and uniquely identified", async () => {
  const paths = [
    "/",
    "/posts",
    "/posts/building-a-maintainable-blog",
    "/projects/myblog",
    "/series/build-my-blog",
    "/tags/typescript",
    "/search?q=cloudflare",
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
    assert.match(html, /<link rel="canonical" href="https:\/\/blog\.example\.test\//, pathname);
    assert.match(html, /<a class="skip-link" href="#main-content">/, pathname);
    assert.ok(Buffer.byteLength(html) < 100_000, `${pathname}: HTML exceeds 100 KB`);

    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${pathname}: duplicate id`);
  }
});

test("keeps every visible internal navigation target healthy", async () => {
  const sourcePaths = ["/", "/posts", "/projects", "/series", "/tags", "/search", "/about"];
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
  const clientFiles = await directoryStats(new URL("../dist/client/", import.meta.url));
  const serverFiles = await directoryStats(new URL("../dist/server/", import.meta.url));
  const clientBytes = clientFiles.reduce((total, file) => total + file.size, 0);
  const serverBytes = serverFiles.reduce((total, file) => total + file.size, 0);
  const largestClientJavaScript = Math.max(
    ...clientFiles.filter((file) => file.url.pathname.endsWith(".js")).map((file) => file.size),
  );
  const workerBytes = (await stat(new URL("../dist/server/index.js", import.meta.url))).size;
  const cssBytes = (await readFile(new URL("../app/globals.css", import.meta.url))).byteLength;

  assert.ok(clientBytes < 2_000_000, `client total ${clientBytes} >= 2 MB`);
  assert.ok(serverBytes < 5_000_000, `server total ${serverBytes} >= 5 MB`);
  assert.ok(largestClientJavaScript < 250_000, `largest client JS ${largestClientJavaScript} >= 250 KB`);
  assert.ok(workerBytes < 3_000_000, `worker ${workerBytes} >= 3 MB`);
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
});
