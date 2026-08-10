import assert from "node:assert/strict";
import test from "node:test";

import { createContentArchive } from "../lib/content/archive.ts";

function record({
  kind = "post",
  publishedAt,
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
    url,
  };
}

test("groups one mixed content stream into descending year and month ledgers", () => {
  const input = [
    record({
      publishedAt: "2025-12-31",
      title: "Year boundary",
      url: "/posts/year-boundary",
    }),
    record({
      kind: "project",
      publishedAt: "2026-07-18",
      title: "Project evidence",
      type: undefined,
      url: "/projects/project-evidence",
    }),
    record({
      publishedAt: "2026-08-02",
      title: "August note",
      type: "til",
      url: "/posts/august-note",
    }),
    record({
      publishedAt: "2026-07-19",
      title: "July article",
      url: "/posts/july-article",
    }),
  ];
  const originalOrder = input.map((item) => item.url);

  const archive = createContentArchive(input);

  assert.deepEqual(input.map((item) => item.url), originalOrder);
  assert.deepEqual(
    archive.map(({ entryCount, months, year }) => ({
      entryCount,
      months: months.map(({ entries, key, month }) => ({
        entries: entries.map((entry) => entry.url),
        key,
        month,
      })),
      year,
    })),
    [
      {
        entryCount: 3,
        months: [
          {
            entries: ["/posts/august-note"],
            key: "2026-08",
            month: "08",
          },
          {
            entries: ["/posts/july-article", "/projects/project-evidence"],
            key: "2026-07",
            month: "07",
          },
        ],
        year: "2026",
      },
      {
        entryCount: 1,
        months: [
          {
            entries: ["/posts/year-boundary"],
            key: "2025-12",
            month: "12",
          },
        ],
        year: "2025",
      },
    ],
  );
});

test("uses title and URL tie breakers without changing equal-date records", () => {
  const input = [
    record({
      publishedAt: "2026-08-10",
      title: "Zulu",
      url: "/posts/zulu-b",
    }),
    record({
      publishedAt: "2026-08-10",
      title: "Alpha",
      url: "/posts/alpha",
    }),
    record({
      publishedAt: "2026-08-10",
      title: "Zulu",
      url: "/posts/zulu-a",
    }),
  ];

  assert.deepEqual(
    createContentArchive(input)[0].months[0].entries.map((entry) => entry.url),
    ["/posts/alpha", "/posts/zulu-a", "/posts/zulu-b"],
  );
});

test("returns an explicit empty archive when there is no public content", () => {
  assert.deepEqual(createContentArchive([]), []);
});
