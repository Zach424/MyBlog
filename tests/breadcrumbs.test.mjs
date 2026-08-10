import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createBreadcrumbList } from "../lib/breadcrumbs.ts";

test("creates one absolute ordered BreadcrumbList without mutating visible items", () => {
  const items = [
    { href: "/", name: "首页" },
    { href: "/posts", name: "文章" },
    {
      href: "/posts/building-a-maintainable-blog",
      name: "从零搭建可维护的个人技术博客",
    },
  ];
  const snapshot = structuredClone(items);

  assert.deepEqual(
    createBreadcrumbList(new URL("https://blog.example.test"), items),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "首页",
          item: "https://blog.example.test/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "文章",
          item: "https://blog.example.test/posts",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "从零搭建可维护的个人技术博客",
          item:
            "https://blog.example.test/posts/building-a-maintainable-blog",
        },
      ],
    },
  );
  assert.deepEqual(items, snapshot);
});

test("keeps positions stable for the same typical user path", () => {
  const items = [
    { href: "/", name: "首页" },
    { href: "/tags", name: "标签" },
    { href: "/tags/typescript", name: "TypeScript" },
  ];

  assert.deepEqual(
    createBreadcrumbList(new URL("https://blog.example.test/preview"), items)
      .itemListElement.map(({ position, name, item }) => [position, name, item]),
    [
      [1, "首页", "https://blog.example.test/"],
      [2, "标签", "https://blog.example.test/tags"],
      [3, "TypeScript", "https://blog.example.test/tags/typescript"],
    ],
  );
});

test("rejects incomplete, ambiguous, or cross-origin breadcrumb paths", () => {
  const siteUrl = new URL("https://blog.example.test");
  const valid = [
    { href: "/", name: "首页" },
    { href: "/posts", name: "文章" },
  ];

  assert.throws(
    () => createBreadcrumbList(siteUrl, valid.slice(0, 1)),
    /at least two items/u,
  );
  assert.throws(
    () =>
      createBreadcrumbList(siteUrl, [valid[0], { href: "/posts", name: " " }]),
    /non-empty name/u,
  );
  assert.throws(
    () =>
      createBreadcrumbList(siteUrl, [
        valid[0],
        { href: "https://outside.example/posts", name: "文章" },
      ]),
    /root-relative path/u,
  );
  assert.throws(
    () =>
      createBreadcrumbList(siteUrl, [
        valid[0],
        { href: "/posts?view=all", name: "文章" },
      ]),
    /query or fragment/u,
  );
  assert.throws(
    () => createBreadcrumbList(siteUrl, [valid[0], valid[0]]),
    /unique URL/u,
  );
});

test("keeps all detail routes on one server-rendered breadcrumb boundary", async () => {
  const component = await readFile(
    new URL("../components/BreadcrumbTrail.tsx", import.meta.url),
    "utf8",
  );
  const pages = await Promise.all(
    ["posts", "projects", "series", "tags"].map((kind) =>
      readFile(
        new URL(`../app/${kind}/[slug]/page.tsx`, import.meta.url),
        "utf8",
      ),
    ),
  );

  assert.doesNotMatch(component, /^["']use client["'];?/mu);
  assert.match(component, /createBreadcrumbList\(siteUrl, items\)/u);
  assert.match(component, /<StructuredData/u);
  assert.match(component, /aria-current="page"/u);
  for (const page of pages) {
    assert.match(page, /<BreadcrumbTrail/u);
    assert.doesNotMatch(page, /<nav className="breadcrumbs"/u);
  }
});
