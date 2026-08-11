import type { ContentRecord } from "./content";

export type FeedRepresentation = "atom" | "json" | "rss";

// These timestamps record when each serialized body contract was approved.
// Bump the matching revision whenever that feed representation changes.
const FEED_REPRESENTATION_REVISIONS = Object.freeze({
  atom: "2026-08-11T00:13:39Z", // Iteration 0129: Atom 1.0 update feed introduced
  json: "2026-08-06T10:09:53Z", // a55e68b: JSON Feed 1.1 introduced
  rss: "2026-08-10T22:25:11Z", // Iteration 0125: RSS categories aligned with public tags
});

function contentDateTimestamp(record: ContentRecord) {
  const date = record.updatedAt ?? record.publishedAt;
  const timestamp = Date.parse(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`Invalid public content date: ${date}`);
  }
  return timestamp;
}

export function createFeedUpdatedAt(
  representation: FeedRepresentation,
  records: readonly ContentRecord[],
) {
  const revision = Date.parse(FEED_REPRESENTATION_REVISIONS[representation]);
  const latest = records.reduce(
    (timestamp, record) => Math.max(timestamp, contentDateTimestamp(record)),
    revision,
  );

  return new Date(latest).toISOString().replace(".000Z", "Z");
}

export function createFeedLastModified(
  representation: FeedRepresentation,
  records: readonly ContentRecord[],
) {
  return new Date(createFeedUpdatedAt(representation, records)).toUTCString();
}
