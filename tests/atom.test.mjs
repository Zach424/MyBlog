import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createAtomResponse, createAtomXml } from "../lib/atom.ts";
import { createFeedLastModified } from "../lib/feed-http.ts";

const baseRecord = {
  body: "# Evidence\n\nVisible **plain text** & source.",
  description: "A concise summary & decision.",
  draft: false,
  featured: false,
  freshness: "current",
  kind: "post",
  readingMinutes: 1,
  reviewedAt: "2026-08-06",
  slug: "entry",
  sourcePath: "content/posts/entry.md",
  tags: ["TypeScript", "Data & XML"],
  title: "Entry",
  type: "article",
  wordCount: 20,
};

function record(overrides) {
  return { ...baseRecord, ...overrides };
}

function atomEntries(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gu)].map((match) => ({
    categories: [...match[1].matchAll(/<category term="([^"]+)" \/>/gu)].map(
      (category) => category[1],
    ),
    id: match[1].match(/<id>([^<]+)<\/id>/u)?.[1],
    published: match[1].match(/<published>([^<]+)<\/published>/u)?.[1],
    title: match[1].match(/<title>([^<]+)<\/title>/u)?.[1],
    updated: match[1].match(/<updated>([^<]+)<\/updated>/u)?.[1],
  }));
}

test("creates one Atom 1.0 feed ordered by significant content change", () => {
  const records = [
    record({
      publishedAt: "2026-07-20",
      title: "Published only",
      url: "/posts/published-only",
    }),
    record({
      publishedAt: "2026-07-17",
      title: "Recently updated",
      updatedAt: "2026-08-06",
      url: "/posts/recently-updated",
    }),
    record({
      publishedAt: "2026-07-18",
      title: "Zulu",
      updatedAt: "2026-08-04",
      url: "/posts/zulu",
    }),
    record({
      publishedAt: "2026-07-18",
      title: "Alpha & <Beta>",
      updatedAt: "2026-08-04",
      url: "/posts/alpha",
    }),
  ];
  const originalOrder = records.map(({ url }) => url);

  const xml = createAtomXml(new URL("https://blog.example.test"), records);
  const entries = atomEntries(xml);

  assert.match(
    xml,
    /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom" xml:lang="zh-CN">/u,
  );
  assert.equal((xml.match(/<title>Zach424 \/ Engineering Notes — 更新订阅<\/title>/gu) ?? []).length, 1);
  assert.match(xml, /<id>https:\/\/blog\.example\.test\/updates\.atom<\/id>/u);
  assert.match(
    xml,
    /<link href="https:\/\/blog\.example\.test\/updates\.atom" rel="self" type="application\/atom\+xml" \/>/u,
  );
  assert.match(
    xml,
    /<link href="https:\/\/blog\.example\.test\/" rel="alternate" type="text\/html" \/>/u,
  );
  assert.match(
    xml,
    /<author>\n    <name>Zach424<\/name>\n    <uri>https:\/\/github\.com\/Zach424<\/uri>\n  <\/author>/u,
  );
  assert.match(xml, /<updated>2026-08-11T00:13:39Z<\/updated>/u);
  assert.deepEqual(
    entries.map(({ id }) => id),
    [
      "https://blog.example.test/posts/recently-updated",
      "https://blog.example.test/posts/alpha",
      "https://blog.example.test/posts/zulu",
      "https://blog.example.test/posts/published-only",
    ],
  );
  assert.deepEqual(entries[0], {
    categories: ["TypeScript", "Data &amp; XML"],
    id: "https://blog.example.test/posts/recently-updated",
    published: "2026-07-17T00:00:00+08:00",
    title: "Recently updated",
    updated: "2026-08-06T00:00:00+08:00",
  });
  assert.equal(entries[1].title, "Alpha &amp; &lt;Beta&gt;");
  assert.equal(entries.at(-1).published, entries.at(-1).updated);
  assert.match(xml, /<summary type="text">A concise summary &amp; decision\.<\/summary>/u);
  assert.match(xml, /<content type="text">Evidence Visible plain text &amp; source\.<\/content>/u);
  assert.deepEqual(records.map(({ url }) => url), originalOrder);
});

test("serves Atom with digest and date validators from one response boundary", async () => {
  const records = [
    record({
      publishedAt: "2026-07-17",
      title: "Recently updated",
      updatedAt: "2026-08-06",
      url: "/posts/recently-updated",
    }),
  ];
  const request = new Request("https://blog.example.test/updates.atom");
  const response = createAtomResponse(
    request,
    new URL("https://blog.example.test"),
    records,
  );
  const body = await response.text();
  const etag = `"sha256-${createHash("sha256").update(body, "utf8").digest("hex")}"`;

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/atom+xml; charset=utf-8");
  assert.equal(response.headers.get("content-disposition"), 'inline; filename="updates.atom"');
  assert.equal(response.headers.get("cache-control"), "public, max-age=3600, stale-while-revalidate=86400");
  assert.equal(response.headers.get("etag"), etag);
  assert.equal(response.headers.get("last-modified"), "Tue, 11 Aug 2026 00:13:39 GMT");
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
  assert.equal(
    response.headers.get("link"),
    '<https://blog.example.test/updates.atom>; rel="self"; type="application/atom+xml", <https://blog.example.test/>; rel="alternate"; type="text/html"',
  );
  assert.equal(
    createFeedLastModified("atom", records),
    "Tue, 11 Aug 2026 00:13:39 GMT",
  );

  const conditional = createAtomResponse(
    new Request("https://blog.example.test/updates.atom", {
      headers: { "if-none-match": `W/${etag}` },
    }),
    new URL("https://blog.example.test"),
    records,
  );
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
  assert.equal(conditional.headers.get("etag"), etag);
  assert.equal(
    conditional.headers.get("last-modified"),
    "Tue, 11 Aug 2026 00:13:39 GMT",
  );
});
