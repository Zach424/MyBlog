import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const payload = {
  title: "一条可维护的工程记录",
  text: "从规范来源继续阅读。",
  url: "https://blog.example.test/posts/maintainable-record",
};

test("uses native sharing and every explicit clipboard fallback", async (context) => {
  const { shareCanonicalRecord } = await import("../lib/share.ts");

  await context.test("shares the exact canonical payload without touching the clipboard", async () => {
    const shared = [];
    let copied = false;
    const outcome = await shareCanonicalRecord(payload, {
      share: async (value) => shared.push(value),
      copy: async () => {
        copied = true;
      },
    });

    assert.equal(outcome, "shared");
    assert.deepEqual(shared, [payload]);
    assert.equal(copied, false);
  });

  await context.test("copies the canonical URL when native sharing is unavailable", async () => {
    const copied = [];
    const outcome = await shareCanonicalRecord(payload, {
      copy: async (value) => copied.push(value),
    });

    assert.equal(outcome, "copied");
    assert.deepEqual(copied, [payload.url]);
  });

  await context.test("copies after a non-cancellation native share failure", async () => {
    const copied = [];
    const outcome = await shareCanonicalRecord(payload, {
      share: async () => {
        throw new DOMException("target failed", "DataError");
      },
      copy: async (value) => copied.push(value),
    });

    assert.equal(outcome, "copied");
    assert.deepEqual(copied, [payload.url]);
  });

  await context.test("keeps user cancellation silent without copying", async () => {
    let copied = false;
    const outcome = await shareCanonicalRecord(payload, {
      share: async () => {
        throw new DOMException("cancelled", "AbortError");
      },
      copy: async () => {
        copied = true;
      },
    });

    assert.equal(outcome, "cancelled");
    assert.equal(copied, false);
  });

  await context.test("reports failure only after both capabilities fail", async () => {
    const outcome = await shareCanonicalRecord(payload, {
      share: async () => {
        throw new DOMException("not allowed", "NotAllowedError");
      },
      copy: async () => {
        throw new DOMException("not allowed", "NotAllowedError");
      },
    });

    assert.equal(outcome, "failed");
  });
});

test("keeps the canonical share trace progressive, accessible, and print-free", async () => {
  const [source, styles, postPage, projectPage] = await Promise.all([
    readFile(new URL("../components/ShareTrace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/posts/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/projects/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(source, /^"use client";/u);
  assert.match(source, /setAttribute\("data-share-enhanced", "true"\)/u);
  assert.match(source, /removeAttribute\("hidden"\)/u);
  assert.match(source, /busyRef\.current/u);
  assert.match(source, /disabled=\{shareState === "working"\}/u);
  assert.match(source, /aria-live="polite"/u);
  assert.match(source, /aria-atomic="true"/u);
  assert.match(source, /data-share-enhanced="false"/u);
  assert.match(source, /data-share-state=\{shareState\}/u);
  assert.doesNotMatch(source, /facebook|twitter|weibo|shortlink|analytics/iu);

  assert.match(styles, /\.content-share\s*\{/u);
  assert.match(styles, /\.content-share-button\s*\{/u);
  assert.match(styles, /@media \(max-width: 42rem\)[\s\S]*?\.content-share/u);
  assert.match(styles, /@media print[\s\S]*?\.content-share[\s\S]*?display:\s*none !important/u);
  assert.match(postPage, /<ShareTrace[\s\S]*?url=\{canonicalUrl\}/u);
  assert.match(projectPage, /<ShareTrace[\s\S]*?url=\{projectUrl\}/u);
});
