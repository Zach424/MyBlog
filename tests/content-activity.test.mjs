import assert from "node:assert/strict";
import test from "node:test";

import { createContentActivity } from "../lib/content/activity.ts";

function record({
  kind = "post",
  publishedAt,
  updatedAt,
  title,
  type = "article",
  url,
}) {
  return {
    description: `${title} description`,
    kind,
    publishedAt,
    title,
    type,
    updatedAt,
    url,
  };
}

test("derives published and later updated events without changing the input", () => {
  const input = [
    record({
      publishedAt: "2026-07-01",
      updatedAt: "2026-08-10",
      title: "持续维护文章",
      url: "/posts/maintained",
    }),
    record({
      kind: "project",
      publishedAt: "2026-08-10",
      title: "新项目",
      type: undefined,
      url: "/projects/new-project",
    }),
    record({
      publishedAt: "2026-07-05",
      updatedAt: "2026-07-05",
      title: "同日修订",
      type: "til",
      url: "/posts/same-day",
    }),
  ];
  const original = structuredClone(input);

  const activity = createContentActivity(input);

  assert.deepEqual(input, original);
  assert.deepEqual(activity.counts, {
    days: 3,
    events: 4,
    published: 3,
    records: 3,
    updated: 1,
  });
  assert.deepEqual(
    activity.days.map((day) => ({
      date: day.date,
      events: day.events.map(({ contentType, id, mode, title, url }) => ({
        contentType,
        id,
        mode,
        title,
        url,
      })),
    })),
    [
      {
        date: "2026-08-10",
        events: [
          {
            contentType: "article",
            id: "updated:/posts/maintained",
            mode: "updated",
            title: "持续维护文章",
            url: "/posts/maintained",
          },
          {
            contentType: "project",
            id: "published:/projects/new-project",
            mode: "published",
            title: "新项目",
            url: "/projects/new-project",
          },
        ],
      },
      {
        date: "2026-07-05",
        events: [
          {
            contentType: "til",
            id: "published:/posts/same-day",
            mode: "published",
            title: "同日修订",
            url: "/posts/same-day",
          },
        ],
      },
      {
        date: "2026-07-01",
        events: [
          {
            contentType: "article",
            id: "published:/posts/maintained",
            mode: "published",
            title: "持续维护文章",
            url: "/posts/maintained",
          },
        ],
      },
    ],
  );
});

test("keeps same-day ties deterministic across repository input order", () => {
  const input = [
    record({
      publishedAt: "2026-08-01",
      title: "Zulu",
      url: "/posts/zulu",
    }),
    record({
      publishedAt: "2026-08-01",
      title: "Alpha",
      url: "/posts/alpha",
    }),
  ];

  const first = createContentActivity(input);
  const second = createContentActivity([...input].reverse());

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.days[0].events.map((event) => event.url),
    ["/posts/alpha", "/posts/zulu"],
  );
});

test("returns an explicit empty activity ledger", () => {
  assert.deepEqual(createContentActivity([]), {
    counts: {
      days: 0,
      events: 0,
      published: 0,
      records: 0,
      updated: 0,
    },
    days: [],
  });
});
