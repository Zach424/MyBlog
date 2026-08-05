import { PUBLISHED_NOTE_PATTERN } from "./review-note.ts";

export const CONTENT_REVIEW_DELIVERY_REPORT_VERSION = 1;
export const CONTENT_REVIEW_LOCAL_REF = "refs/heads/main";
export const CONTENT_REVIEW_TRACKING_REF = "refs/remotes/origin/main";
export const GIT_OBJECT_ID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

export type ContentReviewDeliveryStatus =
  | "synchronized"
  | "pending-review"
  | "local-ahead"
  | "behind"
  | "diverged"
  | "tracking-missing";

export type ContentReviewDeliveryCommitInput = {
  blobOid: string | null;
  commitOid: string;
  parentOids: string[];
  paths: string[];
  subject: string;
  treeOid: string;
};

export type ContentReviewDeliveryInput = {
  ahead: number | null;
  behind: number | null;
  currentBranch: string | null;
  localHead: string;
  pendingCommit: ContentReviewDeliveryCommitInput | null;
  trackingHead: string | null;
};

export type ContentReviewDeliveryReport = {
  version: 1;
  mode: "read-only";
  observation: {
    currentBranch: string | null;
    localHead: string;
    localRef: typeof CONTENT_REVIEW_LOCAL_REF;
    networkChecked: false;
    trackingHead: string | null;
    trackingRef: typeof CONTENT_REVIEW_TRACKING_REF;
  };
  relation: {
    ahead: number | null;
    behind: number | null;
    status: ContentReviewDeliveryStatus;
  };
  pendingReview: {
    blobOid: string;
    commitOid: string;
    parentOid: string;
    slug: string;
    sourcePath: string;
    subject: string;
    treeOid: string;
  } | null;
  recovery: {
    action: "none" | "push-origin-main" | "inspect-git-state";
    autoExecuted: false;
    command: "git push origin main" | null;
  };
};

function assertOid(value: string, label: string) {
  if (!GIT_OBJECT_ID_PATTERN.test(value)) {
    throw new Error(`${label} 必须是 40 或 64 位小写 Git object id`);
  }
}

function assertCount(value: number | null, label: string) {
  if (value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new Error(`${label} 必须是非负整数或 null`);
  }
}

function exactPendingReview(
  commit: ContentReviewDeliveryCommitInput | null,
  localHead: string,
  trackingHead: string,
) {
  if (
    commit === null ||
    commit.commitOid !== localHead ||
    !GIT_OBJECT_ID_PATTERN.test(commit.treeOid) ||
    commit.blobOid === null ||
    !GIT_OBJECT_ID_PATTERN.test(commit.blobOid) ||
    commit.parentOids.length !== 1 ||
    commit.parentOids[0] !== trackingHead ||
    commit.paths.length !== 1
  ) {
    return null;
  }
  const sourcePath = commit.paths[0];
  const match = sourcePath.match(PUBLISHED_NOTE_PATTERN);
  if (!match) return null;
  const slug = match[2];
  if (commit.subject !== `content: review ${slug}`) return null;
  return {
    blobOid: commit.blobOid,
    commitOid: commit.commitOid,
    parentOid: trackingHead,
    slug,
    sourcePath,
    subject: commit.subject,
    treeOid: commit.treeOid,
  };
}

export function analyzeContentReviewDelivery(
  input: ContentReviewDeliveryInput,
): ContentReviewDeliveryReport {
  assertOid(input.localHead, "本地 main");
  assertCount(input.ahead, "ahead");
  assertCount(input.behind, "behind");
  if (
    input.currentBranch !== null &&
    (input.currentBranch.trim() !== input.currentBranch ||
      input.currentBranch.length === 0 ||
      /[\u0000-\u001f\u007f]/u.test(input.currentBranch))
  ) {
    throw new Error("当前分支名称不安全");
  }

  let status: ContentReviewDeliveryStatus;
  let pendingReview: ContentReviewDeliveryReport["pendingReview"] = null;
  if (input.trackingHead === null) {
    if (input.ahead !== null || input.behind !== null) {
      throw new Error("tracking ref 缺失时 ahead/behind 必须为 null");
    }
    status = "tracking-missing";
  } else {
    assertOid(input.trackingHead, "origin/main tracking ref");
    if (input.ahead === null || input.behind === null) {
      throw new Error("tracking ref 存在时 ahead/behind 必须可计算");
    }
    if (
      (input.ahead === 0 && input.behind === 0) !==
      (input.localHead === input.trackingHead)
    ) {
      throw new Error("HEAD 身份与 ahead/behind 关系不一致");
    }
    if (input.ahead > 0 && input.behind > 0) {
      status = "diverged";
    } else if (input.behind > 0) {
      status = "behind";
    } else if (input.ahead > 0) {
      if (input.ahead === 1) {
        pendingReview = exactPendingReview(
          input.pendingCommit,
          input.localHead,
          input.trackingHead,
        );
      }
      status = pendingReview ? "pending-review" : "local-ahead";
    } else {
      status = "synchronized";
    }
  }

  return {
    version: CONTENT_REVIEW_DELIVERY_REPORT_VERSION,
    mode: "read-only",
    observation: {
      currentBranch: input.currentBranch,
      localHead: input.localHead,
      localRef: CONTENT_REVIEW_LOCAL_REF,
      networkChecked: false,
      trackingHead: input.trackingHead,
      trackingRef: CONTENT_REVIEW_TRACKING_REF,
    },
    relation: {
      ahead: input.ahead,
      behind: input.behind,
      status,
    },
    pendingReview,
    recovery: pendingReview
      ? {
          action: "push-origin-main",
          autoExecuted: false,
          command: "git push origin main",
        }
      : status === "synchronized"
        ? { action: "none", autoExecuted: false, command: null }
        : {
            action: "inspect-git-state",
            autoExecuted: false,
            command: null,
          },
  };
}
