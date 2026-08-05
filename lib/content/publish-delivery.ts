export const CONTENT_PUBLISH_DELIVERY_REPORT_VERSION = 1;
export const CONTENT_PUBLISH_DELIVERY_RECEIPT_VERSION = 1;
export const CONTENT_PUBLISH_LOCAL_REF = "refs/heads/main";
export const CONTENT_PUBLISH_TRACKING_REF = "refs/remotes/origin/main";
export const CONTENT_PUBLISH_GIT_OBJECT_ID_PATTERN =
  /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

export type ContentPublishDeliveryStatus =
  | "synchronized"
  | "pending-publication"
  | "local-ahead"
  | "behind"
  | "diverged"
  | "tracking-missing";

export type ContentPublishDeliveryChange = {
  newBlobOid: string | null;
  oldBlobOid: string | null;
  path: string;
  status: "added" | "deleted" | "modified";
};

export type ContentPublishDeliveryCommitInput = {
  changes: ContentPublishDeliveryChange[];
  commitOid: string;
  parentOids: string[];
  publication: {
    kind: "post" | "project";
    slug: string;
    targetPath: string;
    title: string;
  } | null;
  subject: string;
  treeOid: string;
};

export type ContentPublishDeliveryInput = {
  ahead: number | null;
  behind: number | null;
  currentBranch: string | null;
  localHead: string;
  pendingCommit: ContentPublishDeliveryCommitInput | null;
  trackingHead: string | null;
};

export type ContentPublishDeliveryReport = {
  version: 1;
  mode: "read-only";
  observation: {
    currentBranch: string | null;
    localHead: string;
    localRef: typeof CONTENT_PUBLISH_LOCAL_REF;
    networkChecked: false;
    trackingHead: string | null;
    trackingRef: typeof CONTENT_PUBLISH_TRACKING_REF;
  };
  relation: {
    ahead: number | null;
    behind: number | null;
    status: ContentPublishDeliveryStatus;
  };
  pendingPublication: {
    attachmentCount: number;
    changes: ContentPublishDeliveryChange[];
    commitOid: string;
    inboxSourcePath: string;
    kind: "post" | "project";
    parentOid: string;
    slug: string;
    sourceDeletionTracked: boolean;
    subject: string;
    targetBlobOid: string;
    targetPath: string;
    title: string;
    treeOid: string;
  } | null;
  recovery: {
    action: "none" | "push-pending-publication" | "inspect-git-state";
    autoExecuted: false;
    command: string | null;
  };
};

export type ContentPublishDeliveryReceipt = {
  version: 1;
  mode: "delivered";
  publication: NonNullable<ContentPublishDeliveryReport["pendingPublication"]>;
  transition: {
    before: {
      localHead: string;
      relation: "pending-publication";
      trackingHead: string;
    };
    after: {
      localHead: string;
      relation: "synchronized";
      trackingHead: string;
    };
    command: string;
  };
  safety: {
    fetchExecuted: false;
    headStable: true;
    indexStable: true;
    manifestStable: true;
    rebaseExecuted: false;
    resetExecuted: false;
    worktreeStable: true;
  };
};

type ContentPublishDeliveryReceiptInput = {
  after: ContentPublishDeliveryReport;
  before: ContentPublishDeliveryReport;
  indexStable: boolean;
  manifestStable: boolean;
  worktreeStable: boolean;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_PATH_PATTERN = /^[a-zA-Z0-9._/-]+$/u;

function assertOid(value: string, label: string) {
  if (!CONTENT_PUBLISH_GIT_OBJECT_ID_PATTERN.test(value)) {
    throw new Error(`${label} 必须是 40 或 64 位小写 Git object id`);
  }
}

function assertCount(value: number | null, label: string) {
  if (value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new Error(`${label} 必须是非负整数或 null`);
  }
}

function validChange(change: ContentPublishDeliveryChange) {
  if (
    !SAFE_PATH_PATTERN.test(change.path) ||
    change.path.startsWith("/") ||
    change.path.includes("//") ||
    change.path.split("/").some((part) => part === "." || part === "..")
  ) {
    return false;
  }
  if (change.status === "added") {
    return (
      change.oldBlobOid === null &&
      change.newBlobOid !== null &&
      CONTENT_PUBLISH_GIT_OBJECT_ID_PATTERN.test(change.newBlobOid)
    );
  }
  if (change.status === "deleted") {
    return (
      change.newBlobOid === null &&
      change.oldBlobOid !== null &&
      CONTENT_PUBLISH_GIT_OBJECT_ID_PATTERN.test(change.oldBlobOid)
    );
  }
  return (
    change.oldBlobOid !== null &&
    change.newBlobOid !== null &&
    CONTENT_PUBLISH_GIT_OBJECT_ID_PATTERN.test(change.oldBlobOid) &&
    CONTENT_PUBLISH_GIT_OBJECT_ID_PATTERN.test(change.newBlobOid)
  );
}

function exactPendingPublication(
  commit: ContentPublishDeliveryCommitInput | null,
  localHead: string,
  trackingHead: string,
): ContentPublishDeliveryReport["pendingPublication"] {
  if (
    commit === null ||
    commit.commitOid !== localHead ||
    !CONTENT_PUBLISH_GIT_OBJECT_ID_PATTERN.test(commit.treeOid) ||
    commit.parentOids.length !== 1 ||
    commit.parentOids[0] !== trackingHead ||
    commit.publication === null ||
    commit.changes.length === 0
  ) {
    return null;
  }

  const publication = commit.publication;
  if (
    !SLUG_PATTERN.test(publication.slug) ||
    publication.title.trim() !== publication.title ||
    publication.title.length === 0 ||
    /[\u0000-\u001f\u007f]/u.test(publication.title)
  ) {
    return null;
  }
  const targetPath = `content/${publication.kind === "post" ? "posts" : "projects"}/${publication.slug}.md`;
  const inboxSourcePath = `content/inbox/${publication.slug}.md`;
  if (
    publication.targetPath !== targetPath ||
    commit.subject !== `content: publish ${publication.slug}`
  ) {
    return null;
  }

  const changes = [...commit.changes].sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  );
  const paths = new Set<string>();
  for (const change of changes) {
    if (!validChange(change) || paths.has(change.path)) return null;
    paths.add(change.path);
  }

  const target = changes.find((change) => change.path === targetPath);
  if (
    target?.status !== "added" ||
    target.oldBlobOid !== null ||
    target.newBlobOid === null
  ) {
    return null;
  }
  const source = changes.find((change) => change.path === inboxSourcePath);
  if (
    source &&
    (source.status !== "deleted" ||
      source.oldBlobOid === null ||
      source.newBlobOid !== null)
  ) {
    return null;
  }

  const attachmentPattern = new RegExp(
    `^public/uploads/${publication.slug}/[a-z0-9]+(?:-[a-z0-9]+)*(?:-[a-f0-9]{8})?\\.(?:avif|gif|webp)$`,
    "u",
  );
  const attachments = changes.filter((change) =>
    attachmentPattern.test(change.path),
  );
  if (
    attachments.some(
      (change) =>
        change.status !== "added" ||
        change.oldBlobOid !== null ||
        change.newBlobOid === null,
    )
  ) {
    return null;
  }
  const allowed = new Set([
    targetPath,
    ...(source ? [inboxSourcePath] : []),
    ...attachments.map((change) => change.path),
  ]);
  if (allowed.size !== changes.length || changes.some(({ path }) => !allowed.has(path))) {
    return null;
  }

  return {
    attachmentCount: attachments.length,
    changes,
    commitOid: commit.commitOid,
    inboxSourcePath,
    kind: publication.kind,
    parentOid: trackingHead,
    slug: publication.slug,
    sourceDeletionTracked: source !== undefined,
    subject: commit.subject,
    targetBlobOid: target.newBlobOid,
    targetPath,
    title: publication.title,
    treeOid: commit.treeOid,
  };
}

export function analyzeContentPublishDelivery(
  input: ContentPublishDeliveryInput,
): ContentPublishDeliveryReport {
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

  let status: ContentPublishDeliveryStatus;
  let pendingPublication: ContentPublishDeliveryReport["pendingPublication"] = null;
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
        pendingPublication = exactPendingPublication(
          input.pendingCommit,
          input.localHead,
          input.trackingHead,
        );
      }
      status = pendingPublication ? "pending-publication" : "local-ahead";
    } else {
      status = "synchronized";
    }
  }

  return {
    version: CONTENT_PUBLISH_DELIVERY_REPORT_VERSION,
    mode: "read-only",
    observation: {
      currentBranch: input.currentBranch,
      localHead: input.localHead,
      localRef: CONTENT_PUBLISH_LOCAL_REF,
      networkChecked: false,
      trackingHead: input.trackingHead,
      trackingRef: CONTENT_PUBLISH_TRACKING_REF,
    },
    relation: { ahead: input.ahead, behind: input.behind, status },
    pendingPublication,
    recovery: pendingPublication
      ? {
          action: "push-pending-publication",
          autoExecuted: false,
          command: `git push origin ${pendingPublication.commitOid}:refs/heads/main`,
        }
      : status === "synchronized"
        ? { action: "none", autoExecuted: false, command: null }
        : { action: "inspect-git-state", autoExecuted: false, command: null },
  };
}

export function createContentPublishDeliveryReceipt({
  after,
  before,
  indexStable,
  manifestStable,
  worktreeStable,
}: ContentPublishDeliveryReceiptInput): ContentPublishDeliveryReceipt {
  if (
    before.relation.status !== "pending-publication" ||
    before.pendingPublication === null
  ) {
    throw new Error("交付前必须存在一个精确待同步新内容发布包");
  }
  if (before.observation.currentBranch !== "main") {
    throw new Error("只能在 main 分支重新同步新内容发布包");
  }
  const publication = before.pendingPublication;
  if (
    before.observation.localHead !== publication.commitOid ||
    before.observation.trackingHead !== publication.parentOid
  ) {
    throw new Error("交付前的 HEAD、父级与新内容发布包不一致");
  }
  if (
    after.relation.status !== "synchronized" ||
    after.observation.currentBranch !== "main" ||
    after.observation.localHead !== publication.commitOid ||
    after.observation.trackingHead !== publication.commitOid
  ) {
    throw new Error("交付后的 main 必须仍是已验证发布提交并与 tracking ref 同步");
  }
  if (!indexStable) throw new Error("交付期间 index 必须保持不变");
  if (!worktreeStable) throw new Error("交付期间 worktree 必须保持不变");
  if (!manifestStable) throw new Error("交付期间发布路径与 blob 清单必须保持不变");

  return {
    version: CONTENT_PUBLISH_DELIVERY_RECEIPT_VERSION,
    mode: "delivered",
    publication: {
      ...publication,
      changes: publication.changes.map((change) => ({ ...change })),
    },
    transition: {
      before: {
        localHead: publication.commitOid,
        relation: "pending-publication",
        trackingHead: publication.parentOid,
      },
      after: {
        localHead: publication.commitOid,
        relation: "synchronized",
        trackingHead: publication.commitOid,
      },
      command: `git push origin ${publication.commitOid}:refs/heads/main`,
    },
    safety: {
      fetchExecuted: false,
      headStable: true,
      indexStable: true,
      manifestStable: true,
      rebaseExecuted: false,
      resetExecuted: false,
      worktreeStable: true,
    },
  };
}
