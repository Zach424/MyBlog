import assert from "node:assert/strict";
import test from "node:test";

import { deriveContentRelations } from "../lib/content/relations.ts";
import { deriveContentRecommendations } from "../lib/content/recommendations.ts";

function post(
  slug,
  {
    body = "",
    publishedAt = "2026-08-01",
    series,
    tags = ["Personal Knowledge"],
    title = `Post ${slug}`,
  } = {},
) {
  return {
    body,
    description: `用于验证 ${slug} 的确定性相关内容推荐。`,
    draft: false,
    featured: false,
    freshness: "historical",
    kind: "post",
    publishedAt,
    readingMinutes: 2,
    reviewedAt: publishedAt,
    series,
    slug,
    sourcePath: `content/posts/${slug}.md`,
    tags,
    title,
    type: "article",
    url: `/posts/${slug}`,
    wordCount: 200,
  };
}

test("combines every visible reason for one related record", () => {
  const series = { order: 2, slug: "system-notes", title: "系统笔记" };
  const source = post("source", {
    body: "[相关记录](/posts/combined)",
    series,
    tags: ["Next.js", "TypeScript"],
  });
  const combined = post("combined", {
    body: "[返回来源](/posts/source)",
    series: { ...series, order: 1 },
    tags: ["TypeScript", "Next.js", "Git"],
  });
  const records = [source, combined];

  assert.deepEqual(
    deriveContentRecommendations(
      source,
      records,
      deriveContentRelations(records),
    ),
    [
      {
        reasons: [
          { kind: "mutual-reference", label: "双向引用" },
          { kind: "same-series", label: "同专题 · 系统笔记" },
          {
            kind: "shared-tags",
            label: "共同标签 · Next.js / TypeScript",
            tags: ["Next.js", "TypeScript"],
          },
        ],
        record: combined,
        score: 210,
      },
    ],
  );
});

test("ranks direct evidence before series and tags, then keeps only three", () => {
  const series = { order: 2, slug: "system-notes", title: "系统笔记" };
  const source = post("source", {
    body: "[当前记录引用](/posts/outgoing)",
    series,
    tags: ["TypeScript"],
  });
  const outgoing = post("outgoing", { publishedAt: "2026-07-01", tags: [] });
  const incoming = post("incoming", {
    body: "[引用当前记录](/posts/source)",
    publishedAt: "2026-08-04",
    tags: [],
  });
  const sameSeries = post("same-series", {
    publishedAt: "2026-08-03",
    series: { ...series, order: 1 },
    tags: [],
  });
  const sharedTag = post("shared-tag", {
    publishedAt: "2026-08-05",
    tags: ["TypeScript"],
  });
  const unrelated = post("unrelated", {
    publishedAt: "2026-08-06",
    tags: ["Git"],
  });
  const records = [source, sharedTag, sameSeries, unrelated, incoming, outgoing];
  const relations = deriveContentRelations(records);

  assert.deepEqual(
    deriveContentRecommendations(source, records, relations).map(
      (recommendation) => [
        recommendation.record.slug,
        recommendation.score,
        recommendation.reasons[0].label,
      ],
    ),
    [
      ["outgoing", 80, "当前记录引用"],
      ["incoming", 70, "引用当前记录"],
      ["same-series", 60, "同专题 · 系统笔记"],
    ],
  );

  assert.deepEqual(
    deriveContentRecommendations(source, [...records].reverse(), relations).map(
      ({ record }) => record.slug,
    ),
    ["outgoing", "incoming", "same-series"],
  );
});

test("never recommends the current or an unrelated record", () => {
  const source = post("source", { tags: ["Next.js"] });
  const unrelated = post("unrelated", { tags: ["Git"] });
  const records = [source, unrelated];

  assert.deepEqual(
    deriveContentRecommendations(
      source,
      records,
      deriveContentRelations(records),
    ),
    [],
  );
});
