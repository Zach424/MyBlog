import type { ContentPublishDeliveryReport } from "./publish-delivery.ts";
import type { ContentReviewDeliveryReport } from "./review-delivery.ts";

export const CONTENT_DELIVERY_TRIAGE_REPORT_VERSION = 1;
export const CONTENT_DELIVERY_LOCAL_REF = "refs/heads/main";
export const CONTENT_DELIVERY_TRACKING_REF = "refs/remotes/origin/main";

export type ContentDeliveryTriageStatus =
  | "synchronized"
  | "pending-review"
  | "pending-publication"
  | "local-ahead"
  | "behind"
  | "diverged"
  | "tracking-missing";

export type ContentDeliveryTriageReport = {
  version: 1;
  mode: "read-only";
  observation: {
    currentBranch: string | null;
    localHead: string;
    localRef: typeof CONTENT_DELIVERY_LOCAL_REF;
    networkChecked: false;
    trackingHead: string | null;
    trackingRef: typeof CONTENT_DELIVERY_TRACKING_REF;
  };
  relation: {
    ahead: number | null;
    behind: number | null;
    status: ContentDeliveryTriageStatus;
  };
  pending: {
    kind: "review";
    publication: null;
    review: NonNullable<ContentReviewDeliveryReport["pendingReview"]>;
  } | {
    kind: "publication";
    publication: NonNullable<
      ContentPublishDeliveryReport["pendingPublication"]
    >;
    review: null;
  } | null;
  route: {
    autoExecuted: false;
    deliverCommand:
      | "npm run content:review:deliver -- --format json"
      | "npm run content:publish:deliver -- --format json"
      | null;
    deliverable: boolean;
    kind: "none" | "review" | "publication" | "inspect";
    statusCommand:
      | "npm run content:review:status"
      | "npm run content:publish:status"
      | null;
  };
};

type ContentDeliveryTriageInput = {
  publication: ContentPublishDeliveryReport;
  review: ContentReviewDeliveryReport;
};

const SHARED_STATUSES = new Set([
  "synchronized",
  "local-ahead",
  "behind",
  "diverged",
  "tracking-missing",
]);

function sameObservation(
  publication: ContentPublishDeliveryReport,
  review: ContentReviewDeliveryReport,
) {
  return (
    publication.observation.currentBranch === review.observation.currentBranch &&
    publication.observation.localHead === review.observation.localHead &&
    publication.observation.localRef === review.observation.localRef &&
    publication.observation.networkChecked ===
      review.observation.networkChecked &&
    publication.observation.trackingHead === review.observation.trackingHead &&
    publication.observation.trackingRef === review.observation.trackingRef &&
    publication.relation.ahead === review.relation.ahead &&
    publication.relation.behind === review.relation.behind
  );
}

export function analyzeContentDeliveryTriage({
  publication,
  review,
}: ContentDeliveryTriageInput): ContentDeliveryTriageReport {
  if (
    publication.version !== 1 ||
    review.version !== 1 ||
    publication.mode !== "read-only" ||
    review.mode !== "read-only"
  ) {
    throw new Error("交付分诊只接受受支持的只读领域报告");
  }
  if (!sameObservation(publication, review)) {
    throw new Error("复核与发布报告必须来自同一 Git 观察");
  }

  const pendingReview = review.pendingReview;
  const pendingPublication = publication.pendingPublication;
  const reviewPending =
    review.relation.status === "pending-review" &&
    pendingReview !== null;
  const publicationPending =
    publication.relation.status === "pending-publication" &&
    pendingPublication !== null;
  if (reviewPending && publicationPending) {
    throw new Error("同一个本地提交不能同时是复核与新内容发布");
  }
  if (
    (review.relation.status === "pending-review") !==
      (review.pendingReview !== null) ||
    (publication.relation.status === "pending-publication") !==
      (publication.pendingPublication !== null)
  ) {
    throw new Error("领域报告的 pending 身份与关系状态不一致");
  }

  let status: ContentDeliveryTriageStatus;
  let pending: ContentDeliveryTriageReport["pending"] = null;
  let kind: ContentDeliveryTriageReport["route"]["kind"];
  let statusCommand: ContentDeliveryTriageReport["route"]["statusCommand"] =
    null;
  let exactDeliverCommand: ContentDeliveryTriageReport["route"]["deliverCommand"] =
    null;

  if (reviewPending) {
    if (pendingReview === null) {
      throw new Error("复核分诊缺少待投递复核证据");
    }
    if (publication.relation.status !== "local-ahead") {
      throw new Error("复核分诊要求发布报告把同一提交视为普通 local-ahead");
    }
    status = "pending-review";
    kind = "review";
    statusCommand = "npm run content:review:status";
    exactDeliverCommand =
      "npm run content:review:deliver -- --format json";
    pending = {
      kind: "review",
      publication: null,
      review: { ...pendingReview },
    };
  } else if (publicationPending) {
    if (pendingPublication === null) {
      throw new Error("发布分诊缺少待投递发布证据");
    }
    if (review.relation.status !== "local-ahead") {
      throw new Error("发布分诊要求复核报告把同一提交视为普通 local-ahead");
    }
    status = "pending-publication";
    kind = "publication";
    statusCommand = "npm run content:publish:status";
    exactDeliverCommand =
      "npm run content:publish:deliver -- --format json";
    pending = {
      kind: "publication",
      publication: {
        ...pendingPublication,
        changes: pendingPublication.changes.map((change) => ({
          ...change,
        })),
      },
      review: null,
    };
  } else {
    if (
      review.relation.status !== publication.relation.status ||
      !SHARED_STATUSES.has(review.relation.status)
    ) {
      throw new Error("复核与发布报告的 Git 关系状态不一致");
    }
    status = review.relation.status as ContentDeliveryTriageStatus;
    kind = status === "synchronized" ? "none" : "inspect";
  }

  const deliverable =
    exactDeliverCommand !== null &&
    review.observation.currentBranch === "main";
  return {
    version: CONTENT_DELIVERY_TRIAGE_REPORT_VERSION,
    mode: "read-only",
    observation: {
      currentBranch: review.observation.currentBranch,
      localHead: review.observation.localHead,
      localRef: CONTENT_DELIVERY_LOCAL_REF,
      networkChecked: false,
      trackingHead: review.observation.trackingHead,
      trackingRef: CONTENT_DELIVERY_TRACKING_REF,
    },
    relation: {
      ahead: review.relation.ahead,
      behind: review.relation.behind,
      status,
    },
    pending,
    route: {
      autoExecuted: false,
      deliverCommand: deliverable ? exactDeliverCommand : null,
      deliverable,
      kind,
      statusCommand,
    },
  };
}
