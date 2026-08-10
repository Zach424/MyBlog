import type { ContentRecord } from "./contract.ts";
import type { ContentRelations } from "./relations.ts";

const MAX_RECOMMENDATIONS = 3;
const SCORE = {
  backlink: 70,
  mutualReference: 120,
  outgoingReference: 80,
  sameSeries: 60,
  sharedTag: 15,
} as const;

export type ContentRecommendationReason =
  | {
      kind: "mutual-reference" | "outgoing-reference" | "backlink";
      label: string;
    }
  | {
      kind: "same-series";
      label: string;
    }
  | {
      kind: "shared-tags";
      label: string;
      tags: string[];
    };

export interface ContentRecommendation {
  reasons: ContentRecommendationReason[];
  record: ContentRecord;
  score: number;
}

function sharedSeriesTitle(source: ContentRecord, candidate: ContentRecord) {
  if (
    source.kind === "post" &&
    candidate.kind === "post" &&
    source.series &&
    source.series?.slug === candidate.series?.slug
  ) {
    return source.series.title;
  }
  return undefined;
}

function sharedTags(source: ContentRecord, candidate: ContentRecord) {
  const candidateTags = new Set(candidate.tags);
  return source.tags.filter((tag) => candidateTags.has(tag));
}

function relationReason(
  outgoing: boolean,
  incoming: boolean,
): { reason?: ContentRecommendationReason; score: number } {
  if (outgoing && incoming) {
    return {
      reason: { kind: "mutual-reference", label: "双向引用" },
      score: SCORE.mutualReference,
    };
  }
  if (outgoing) {
    return {
      reason: { kind: "outgoing-reference", label: "当前记录引用" },
      score: SCORE.outgoingReference,
    };
  }
  if (incoming) {
    return {
      reason: { kind: "backlink", label: "引用当前记录" },
      score: SCORE.backlink,
    };
  }
  return { score: 0 };
}

export function deriveContentRecommendations(
  source: ContentRecord,
  records: ContentRecord[],
  relations: ContentRelations,
): ContentRecommendation[] {
  const outgoingUrls = new Set(
    (relations.outgoingByUrl.get(source.url) ?? []).map((record) => record.url),
  );
  const incomingUrls = new Set(
    (relations.backlinksByUrl.get(source.url) ?? []).map((record) => record.url),
  );

  return records
    .filter((candidate) => candidate.url !== source.url)
    .map((candidate) => {
      const reasons: ContentRecommendationReason[] = [];
      let score = 0;
      const relation = relationReason(
        outgoingUrls.has(candidate.url),
        incomingUrls.has(candidate.url),
      );

      if (relation.reason) reasons.push(relation.reason);
      score += relation.score;

      const seriesTitle = sharedSeriesTitle(source, candidate);
      if (seriesTitle) {
        reasons.push({
          kind: "same-series",
          label: `同专题 · ${seriesTitle}`,
        });
        score += SCORE.sameSeries;
      }

      const tags = sharedTags(source, candidate);
      if (tags.length > 0) {
        reasons.push({
          kind: "shared-tags",
          label: `共同标签 · ${tags.join(" / ")}`,
          tags,
        });
        score += tags.length * SCORE.sharedTag;
      }

      return { reasons, record: candidate, score };
    })
    .filter((recommendation) => recommendation.reasons.length > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.record.publishedAt.localeCompare(left.record.publishedAt) ||
        left.record.title.localeCompare(right.record.title, "zh-CN") ||
        left.record.url.localeCompare(right.record.url, "en-US"),
    )
    .slice(0, MAX_RECOMMENDATIONS);
}
