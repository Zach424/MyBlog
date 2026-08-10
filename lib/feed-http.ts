import type { ContentRecord } from "./content";

export type FeedRepresentation = "json" | "rss";

// These are the exact commits that last changed each serialized representation.
// Bump the matching revision when its feed body contract changes.
const FEED_REPRESENTATION_REVISIONS = Object.freeze({
  json: "2026-08-06T10:09:53Z", // a55e68b: JSON Feed 1.1 introduced
  rss: "2026-08-10T21:26:25Z", // 97eabce: RSS modification dates introduced
});

function contentDateTimestamp(record: ContentRecord) {
  const date = record.updatedAt ?? record.publishedAt;
  const timestamp = Date.parse(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`Invalid public content date: ${date}`);
  }
  return timestamp;
}

export function createFeedLastModified(
  representation: FeedRepresentation,
  records: readonly ContentRecord[],
) {
  const revision = Date.parse(FEED_REPRESENTATION_REVISIONS[representation]);
  const latest = records.reduce(
    (timestamp, record) => Math.max(timestamp, contentDateTimestamp(record)),
    revision,
  );

  return new Date(latest).toUTCString();
}
