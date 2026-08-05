import {
  ContentValidationError,
  isPublished,
  parsePostFile,
  parseProjectFile,
  type ContentRecord,
} from "./contract.ts";

export const PUBLISHED_NOTE_PATTERN =
  /^content\/(posts|projects)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/u;
export const CONTENT_REVIEW_PROOF_VERSION = 1;

type ContentReviewInput = {
  currentContent: string;
  previousContent: string;
  reviewDate: string;
  sourcePath: string;
};

export type ContentReviewInspection = {
  kind: ContentRecord["kind"];
  previousReviewedAt: string;
  previousUpdatedAt: string | undefined;
  reviewedAt: string;
  slug: string;
  sourcePath: string;
  substantiveChanged: boolean;
  title: string;
  updatedAt: string | undefined;
};

export type ContentReviewProof = {
  version: 1;
  mode: "check-only";
  review: {
    kind: ContentRecord["kind"];
    previousReviewedAt: string;
    previousUpdatedAt: string | null;
    reviewedAt: string;
    slug: string;
    sourcePath: string;
    substantiveChanged: boolean;
    title: string;
    updatedAt: string | null;
  };
  git: {
    branch: "main";
    changedPaths: [string];
    committablePaths: [string];
    stagedPaths: [];
    untrackedPaths: [];
  };
  qualityGate: {
    command: "npm run check";
    status: "passed";
  };
};

function reject(sourcePath: string, message: string): never {
  throw new ContentValidationError(sourcePath, message);
}

function assertIsoDate(value: string, label: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} 必须是有效的 YYYY-MM-DD 日期`);
  }
}

function parsePublishedNote(sourcePath: string, content: string) {
  return sourcePath.startsWith("content/posts/")
    ? parsePostFile(sourcePath, content)
    : parseProjectFile(sourcePath, content);
}

function substantiveSnapshot(record: ContentRecord) {
  const snapshot = { ...record } as Partial<ContentRecord>;
  delete snapshot.readingMinutes;
  delete snapshot.reviewedAt;
  delete snapshot.updatedAt;
  delete snapshot.wordCount;
  return snapshot;
}

export function inspectContentReview({
  currentContent,
  previousContent,
  reviewDate,
  sourcePath,
}: ContentReviewInput): ContentReviewInspection {
  assertIsoDate(reviewDate, "复核日");
  if (!PUBLISHED_NOTE_PATTERN.test(sourcePath)) {
    reject(
      sourcePath,
      "复核命令只接受 content/posts 或 content/projects 中的正式文章或项目",
    );
  }

  const previous = parsePublishedNote(sourcePath, previousContent);
  const current = parsePublishedNote(sourcePath, currentContent);
  const reviewTime = new Date(`${reviewDate}T12:00:00.000Z`);
  if (!isPublished(previous, reviewTime) || !isPublished(current, reviewTime)) {
    reject(sourcePath, "复核命令只接受在本次复核日已经公开的内容");
  }
  if (previous.freshness !== "current" || current.freshness !== "current") {
    reject(sourcePath, "复核命令只接受 freshness: current 的持续维护内容");
  }
  if (current.publishedAt !== previous.publishedAt) {
    reject(sourcePath, "publishedAt 不能在复核流程中改变");
  }
  if (current.reviewedAt !== reviewDate) {
    reject(sourcePath, `reviewedAt 必须更新为本次复核日 ${reviewDate}`);
  }
  if (current.reviewedAt <= previous.reviewedAt) {
    reject(
      sourcePath,
      `reviewedAt 必须晚于上次复核日 ${previous.reviewedAt}；同一天不能重复声明复核`,
    );
  }

  const substantiveChanged =
    JSON.stringify(substantiveSnapshot(current)) !==
    JSON.stringify(substantiveSnapshot(previous));
  if (substantiveChanged && current.updatedAt !== reviewDate) {
    reject(
      sourcePath,
      `正文或元数据发生变化时，updatedAt 必须更新为 ${reviewDate}`,
    );
  }
  if (!substantiveChanged && current.updatedAt !== previous.updatedAt) {
    reject(
      sourcePath,
      "没有事实变化时只能推进 reviewedAt，不能单独改变 updatedAt",
    );
  }

  return {
    kind: current.kind,
    previousReviewedAt: previous.reviewedAt,
    previousUpdatedAt: previous.updatedAt,
    reviewedAt: current.reviewedAt,
    slug: current.slug,
    sourcePath,
    substantiveChanged,
    title: current.title,
    updatedAt: current.updatedAt,
  };
}

export function createContentReviewProof(
  inspection: ContentReviewInspection,
): ContentReviewProof {
  return {
    version: CONTENT_REVIEW_PROOF_VERSION,
    mode: "check-only",
    review: {
      kind: inspection.kind,
      previousReviewedAt: inspection.previousReviewedAt,
      previousUpdatedAt: inspection.previousUpdatedAt ?? null,
      reviewedAt: inspection.reviewedAt,
      slug: inspection.slug,
      sourcePath: inspection.sourcePath,
      substantiveChanged: inspection.substantiveChanged,
      title: inspection.title,
      updatedAt: inspection.updatedAt ?? null,
    },
    git: {
      branch: "main",
      changedPaths: [inspection.sourcePath],
      committablePaths: [inspection.sourcePath],
      stagedPaths: [],
      untrackedPaths: [],
    },
    qualityGate: {
      command: "npm run check",
      status: "passed",
    },
  };
}
