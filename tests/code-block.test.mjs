import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getCodeLanguageLabel } from "../lib/code-block.ts";

test("normalizes common fenced code language labels", () => {
  assert.equal(getCodeLanguageLabel("hljs language-ts"), "TYPESCRIPT");
  assert.equal(getCodeLanguageLabel("language-json hljs"), "JSON");
  assert.equal(getCodeLanguageLabel("language-shell-session"), "SHELL SESSION");
  assert.equal(getCodeLanguageLabel("hljs"), "TEXT");
});

test("keeps copy enhancement progressive and accessible", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../components/CodeBlock.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /^"use client";/u);
  assert.match(source, /<button[\s\S]*?hidden[\s\S]*?type="button"/u);
  assert.match(source, /removeAttribute\("hidden"\)/u);
  assert.match(source, /querySelector\("code"\)\?\.textContent/u);
  assert.match(source, /navigator\.clipboard\?\.writeText/u);
  assert.match(source, /aria-live="polite"/u);
  assert.match(source, /clearTimeout\(resetTimerRef\.current\)/u);
  assert.doesNotMatch(source, /execCommand/u);
  assert.match(
    styles,
    /\.code-copy-button\[hidden\]\s*\{\s*display:\s*none;/u,
  );
  assert.match(
    styles,
    /\.markdown-content \.code-block pre\s*\{[^}]*margin:\s*0;/su,
  );
});
