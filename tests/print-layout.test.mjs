import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps print provenance and recommendations server-rendered on detail routes", async () => {
  const [views, postPage, projectPage] = await Promise.all([
    readFile(new URL("../components/ContentViews.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/posts/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/projects/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(views, /["']use client["']/u);
  assert.match(views, /export function PrintSource/u);
  assert.match(views, /export function ContentRecommendations/u);
  assert.match(views, /<p className="print-source">/u);
  assert.match(views, /Source \/ <a href=\{url\}>\{url\}<\/a>/u);
  assert.match(postPage, /<PrintSource url=\{canonicalUrl\} \/>/u);
  assert.match(projectPage, /<PrintSource url=\{projectUrl\} \/>/u);
  assert.match(postPage, /<ContentRecommendations items=\{recommendations\} \/>/u);
  assert.match(projectPage, /<ContentRecommendations items=\{recommendations\} \/>/u);
});

test("defines a scoped A4 print reading and pagination contract", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /@page\s*\{\s*size:\s*A4;/u);
  assert.match(styles, /@media print\s*\{[\s\S]*?color-scheme:\s*light;/u);
  assert.match(
    styles,
    /\.site-header,[\s\S]*?\.content-toc,[\s\S]*?\.content-neighbors,[\s\S]*?\.content-recommendations,[\s\S]*?\.code-copy-button,[\s\S]*?display:\s*none !important;/u,
  );
  assert.match(styles, /\.print-source\s*\{[\s\S]*?display:\s*flex;/u);
  assert.match(styles, /\.content-facts dl\s*\{[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)/u);
  assert.match(styles, /\.markdown-content h2,[\s\S]*?break-inside:\s*avoid-page;/u);
  assert.match(styles, /\.markdown-content h2,[\s\S]*?break-after:\s*avoid-page;/u);
  assert.match(styles, /\.markdown-content h2\s*\{[\s\S]*?border-image:\s*linear-gradient/u);
  assert.match(styles, /\.markdown-content h2::before\s*\{\s*display:\s*none;/u);
  assert.match(styles, /\.markdown-content h2 \+ \*,[\s\S]*?break-before:\s*avoid-page;/u);
  assert.match(styles, /\.markdown-content pre\s*\{[\s\S]*?white-space:\s*pre-wrap;/u);
  assert.match(styles, /\.markdown-content table\s*\{[\s\S]*?min-width:\s*0;/u);
  assert.match(styles, /@media print[\s\S]*?\.markdown-content \.katex-display[\s\S]*?overflow:\s*visible;/u);
  assert.match(styles, /a\[href\^="http"\]::after[\s\S]*?attr\(href\)/u);
  assert.match(styles, /\.content-relation-group\s*\{[\s\S]*?break-inside:\s*avoid-page;/u);
  assert.match(styles, /\.content-relation-group \.content-index-row\s*\{\s*min-height:\s*0;/u);
});

test("keeps the chronological archive server-rendered and printable", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/archive/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /["']use client["']/u);
  assert.match(page, /createContentArchive\(records\)/u);
  assert.match(page, /<time[\s\S]*?dateTime=\{record\.publishedAt\}/u);
  assert.match(styles, /@media print[\s\S]*?\.archive-entry\s*\{[\s\S]*?break-inside:\s*avoid-page;/u);
  assert.match(styles, /@media print[\s\S]*?\.archive-page \.collection-links\s*\{\s*display:\s*none;/u);
});
