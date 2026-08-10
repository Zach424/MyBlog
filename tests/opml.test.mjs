import assert from "node:assert/strict";
import test from "node:test";

import { createSubscriptionOpml } from "../lib/opml.ts";

function subscriptionAttributes(xml) {
  return [...xml.matchAll(/<outline (?=[^>]*\btype="rss")([^>]*)\/>/gu)].map(
    (match) =>
      Object.fromEntries(
        [...match[1].matchAll(/([A-Za-z]+)="([^"]*)"/gu)].map(
          (attribute) => [attribute[1], attribute[2]],
        ),
      ),
  );
}

test("creates one grouped OPML 2.0 subscription bundle in stable title order", () => {
  const tags = [
    { count: 1, name: "Zulu", slug: "zulu" },
    { count: 2, name: "Alpha", slug: "alpha" },
  ];
  const series = [
    { count: 3, slug: "z-series", title: "终章" },
    { count: 2, slug: "a-series", title: "开篇" },
  ];
  const tagOrder = tags.map(({ slug }) => slug);
  const seriesOrder = series.map(({ slug }) => slug);

  const xml = createSubscriptionOpml(new URL("https://blog.example.test"), {
    series,
    tags,
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<opml version="2\.0">/u);
  assert.match(xml, /<head>\n    <title>Zach424 \/ Engineering Notes — 全部订阅<\/title>/u);
  assert.match(xml, /<ownerName>Zach424<\/ownerName>/u);
  assert.match(xml, /<ownerId>https:\/\/github\.com\/Zach424<\/ownerId>/u);
  assert.match(xml, /<docs>https:\/\/opml\.org\/spec2\.opml<\/docs>/u);
  assert.doesNotMatch(xml, /<date(?:Created|Modified)>/u);
  assert.ok(
    xml.indexOf('<outline text="全部更新">') <
      xml.indexOf('<outline text="按标签">') &&
      xml.indexOf('<outline text="按标签">') <
        xml.indexOf('<outline text="按专题">'),
  );

  const subscriptions = subscriptionAttributes(xml);
  assert.deepEqual(
    subscriptions.map(({ htmlUrl, text, title, type, version, xmlUrl }) => ({
      htmlUrl,
      text,
      title,
      type,
      version,
      xmlUrl,
    })),
    [
      {
        htmlUrl: "https://blog.example.test/",
        text: "Zach424 / Engineering Notes",
        title: "Zach424 / Engineering Notes",
        type: "rss",
        version: "RSS",
        xmlUrl: "https://blog.example.test/rss.xml",
      },
      {
        htmlUrl: "https://blog.example.test/tags/alpha",
        text: "Alpha — Zach424 / Engineering Notes",
        title: "Alpha — Zach424 / Engineering Notes",
        type: "rss",
        version: "RSS",
        xmlUrl: "https://blog.example.test/tags/alpha/rss.xml",
      },
      {
        htmlUrl: "https://blog.example.test/tags/zulu",
        text: "Zulu — Zach424 / Engineering Notes",
        title: "Zulu — Zach424 / Engineering Notes",
        type: "rss",
        version: "RSS",
        xmlUrl: "https://blog.example.test/tags/zulu/rss.xml",
      },
      {
        htmlUrl: "https://blog.example.test/series/a-series",
        text: "开篇 — Zach424 / Engineering Notes",
        title: "开篇 — Zach424 / Engineering Notes",
        type: "rss",
        version: "RSS",
        xmlUrl: "https://blog.example.test/series/a-series/rss.xml",
      },
      {
        htmlUrl: "https://blog.example.test/series/z-series",
        text: "终章 — Zach424 / Engineering Notes",
        title: "终章 — Zach424 / Engineering Notes",
        type: "rss",
        version: "RSS",
        xmlUrl: "https://blog.example.test/series/z-series/rss.xml",
      },
    ],
  );
  assert.ok(subscriptions.every(({ description, language }) => description && language === "zh-CN"));
  assert.deepEqual(tags.map(({ slug }) => slug), tagOrder);
  assert.deepEqual(series.map(({ slug }) => slug), seriesOrder);
});

test("escapes every OPML XML field and omits empty scoped groups", () => {
  const xml = createSubscriptionOpml(new URL("https://blog.example.test"), {
    series: [],
    tags: [{ count: 1, name: 'A & "B" <C>', slug: "safe-slug" }],
  });

  assert.match(xml, /text="A &amp; &quot;B&quot; &lt;C&gt; — Zach424 \/ Engineering Notes"/u);
  assert.match(xml, /description="与 A &amp; &quot;B&quot; &lt;C&gt; 相关的文章和项目，共 1 条。"/u);
  assert.doesNotMatch(xml, /<outline text="按专题">/u);
  assert.equal(subscriptionAttributes(xml).length, 2);
});
