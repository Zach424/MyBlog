import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getHeadingDepthMarker,
  getHeadingPermalink,
} from "../lib/heading-permalink.ts";

test("preserves renderer-owned heading ids in native fragment links", () => {
  assert.equal(getHeadingPermalink("先冻结内容契约"), "#先冻结内容契约");
  assert.equal(getHeadingPermalink("duplicate-1"), "#duplicate-1");
  assert.equal(getHeadingDepthMarker(2), "##");
  assert.equal(getHeadingDepthMarker(3), "###");
});

test("keeps heading permalinks server-rendered, discoverable and printable", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../components/MarkdownHeading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(component, /["']use client["']/u);
  assert.match(component, /href=\{getHeadingPermalink\(id\)\}/u);
  assert.match(component, /aria-label="本节永久链接"/u);
  assert.match(component, /<span aria-hidden="true">/u);
  assert.match(component, /\{children\}[\s\S]*?\{id \?/u);
  assert.match(styles, /\.markdown-content h2:hover > \.heading-permalink/u);
  assert.match(styles, /\.markdown-content \.heading-permalink:focus-visible/u);
  assert.match(styles, /\.markdown-content h2:target > \.heading-permalink/u);
  assert.match(styles, /@media \(max-width: 42rem\)[\s\S]*?min-height:\s*2\.75rem;/u);
  assert.match(styles, /@media \(hover: none\)[\s\S]*?min-height:\s*2\.75rem;/u);
  assert.match(
    styles,
    /@media print\s*\{[\s\S]*?\.markdown-content \.heading-permalink\s*\{\s*display:\s*none !important;/u,
  );
});
