import assert from "node:assert/strict";
import test from "node:test";

import { createSubscriptionCatalog } from "../lib/subscriptions.ts";

function record({ publishedAt, title, url }) {
  return { publishedAt, title, url };
}

test("publishes every supported read-only channel in a stable routing order", () => {
  const catalog = createSubscriptionCatalog([
    record({
      publishedAt: "2026-07-18",
      title: "Newest note",
      url: "/posts/newest-note",
    }),
  ]);

  assert.deepEqual(
    catalog.map(({ audience, format, id, pathLabel }) => ({
      audience,
      format,
      id,
      pathLabel,
    })),
    [
      {
        audience: "阅读器",
        format: "application/rss+xml",
        id: "rss",
        pathLabel: "/rss.xml",
      },
      {
        audience: "更新阅读器",
        format: "application/atom+xml",
        id: "atom",
        pathLabel: "/updates.atom",
      },
      {
        audience: "阅读器迁移",
        format: "text/x-opml",
        id: "opml",
        pathLabel: "/feeds.opml",
      },
      {
        audience: "JSON READER",
        format: "application/feed+json",
        id: "json-feed",
        pathLabel: "/feed.json",
      },
      {
        audience: "浏览器 / 搜索工具",
        format: "application/opensearchdescription+xml",
        id: "opensearch",
        pathLabel: "/opensearch.xml",
      },
      {
        audience: "同步器 / 自动化",
        format: "application/json + schema",
        id: "manifest",
        pathLabel: "/content.json + /content.schema.json",
      },
      {
        audience: "OBSIDIAN / 引用工具",
        format: "text/markdown; charset=utf-8",
        id: "markdown",
        pathLabel: "/posts|projects/<slug>/source.md",
      },
    ],
  );
  assert.equal(new Set(catalog.map(({ id }) => id)).size, catalog.length);
  assert.ok(
    catalog.every(
      ({ description, freshness, title }) =>
        description.length > 0 && freshness.length > 0 && title.length > 0,
    ),
  );
  assert.deepEqual(catalog[1].links, [
    { href: "/updates.atom", label: "订阅更新优先 Atom" },
  ]);
  assert.deepEqual(catalog[2].links, [
    { href: "/feeds.opml", label: "下载 OPML" },
  ]);
  assert.deepEqual(catalog[5].links, [
    { href: "/content.json", label: "打开内容清单" },
    { href: "/content.schema.json", label: "查看清单 Schema" },
  ]);
});

test("selects the newest portable Markdown source without mutating input order", () => {
  const records = [
    record({
      publishedAt: "2026-06-04",
      title: "Older project",
      url: "/projects/older-project",
    }),
    record({
      publishedAt: "2026-08-10",
      title: "Zulu",
      url: "/posts/zulu",
    }),
    record({
      publishedAt: "2026-08-10",
      title: "Alpha",
      url: "/posts/alpha",
    }),
  ];
  const originalOrder = records.map(({ url }) => url);

  const markdown = createSubscriptionCatalog(records).at(-1);

  assert.deepEqual(records.map(({ url }) => url), originalOrder);
  assert.deepEqual(markdown.links, [
    { href: "/posts/alpha/source.md", label: "查看最新：Alpha" },
  ]);
  assert.equal(markdown.statusNote, "当前示例来自 2026-08-10 的最新公开记录。");
});

test("keeps the Markdown channel explicit before the first public record exists", () => {
  const markdown = createSubscriptionCatalog([]).at(-1);

  assert.deepEqual(markdown.links, []);
  assert.equal(
    markdown.statusNote,
    "发布第一条公开内容后，这里会出现可读取的 Markdown 示例。",
  );
});
