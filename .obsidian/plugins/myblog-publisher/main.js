/* eslint-disable @typescript-eslint/no-require-imports */
const { FileSystemAdapter, Modal, Notice, Plugin } = require("obsidian");
const { spawn } = require("node:child_process");

const MAX_CAPTURED_OUTPUT = 200_000;
const MAINTENANCE_REPORT_VERSION = 1;
const CONTENT_REVIEW_PROOF_VERSION = 3;
const CONTENT_REVIEW_DELIVERY_REPORT_VERSION = 1;
const CONTENT_REVIEW_DELIVERY_RECEIPT_VERSION = 1;
const CONTENT_PUBLISH_DELIVERY_REPORT_VERSION = 1;
const CONTENT_PUBLISH_DELIVERY_RECEIPT_VERSION = 1;
const GIT_OBJECT_ID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const CONTENT_REVIEW_DELIVERY_STATUSES = [
  "synchronized",
  "pending-review",
  "local-ahead",
  "behind",
  "diverged",
  "tracking-missing",
];
const CONTENT_PUBLISH_DELIVERY_STATUSES = [
  "synchronized",
  "pending-publication",
  "local-ahead",
  "behind",
  "diverged",
  "tracking-missing",
];
const MAINTENANCE_STATUSES = [
  "healthy",
  "review-soon",
  "due-soon",
  "overdue",
];
const STATUS_LABELS = {
  healthy: "健康",
  "review-soon": "进入复核窗口",
  "due-soon": "即将到期",
  overdue: "已过期",
};
const STATUS_ORDER = {
  overdue: 0,
  "due-soon": 1,
  "review-soon": 2,
  healthy: 3,
};

function valueError(label, expectation) {
  throw new Error(`${label} ${expectation}`);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    valueError(label, "必须是对象");
  }
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    valueError(label, `字段必须严格为 ${expected.join(", ")}`);
  }
}

function assertInteger(value, label, minimum = Number.NEGATIVE_INFINITY) {
  if (!Number.isInteger(value) || value < minimum) {
    valueError(label, `必须是大于等于 ${minimum} 的整数`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    valueError(label, "必须是无首尾空白的非空字符串");
  }
}

function parseIsoDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    valueError(label, "必须是 YYYY-MM-DD 日期");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    valueError(label, "不是有效日期");
  }
  return date;
}

function addIsoDays(value, days) {
  const date = parseIsoDate(value, "日期");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayDifference(later, earlier) {
  return (later.getTime() - earlier.getTime()) / 86_400_000;
}

function expectedStatus(remainingDays, thresholds) {
  if (remainingDays < 0) return "overdue";
  if (remainingDays <= thresholds.dueSoonDays) return "due-soon";
  if (remainingDays <= thresholds.reviewSoonDays) return "review-soon";
  return "healthy";
}

function parseMaintenanceReport(output) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("维护报告不是有效 JSON");
  }

  assertPlainObject(report, "维护报告");
  assertExactKeys(
    report,
    [
      "version",
      "buildDate",
      "counts",
      "currentCount",
      "excludedCount",
      "historicalCount",
      "maxAgeDays",
      "records",
      "reviewChecklist",
      "thresholds",
    ],
    "维护报告",
  );
  if (report.version !== MAINTENANCE_REPORT_VERSION) {
    valueError(
      "维护报告 version",
      `必须是 ${MAINTENANCE_REPORT_VERSION}`,
    );
  }

  const buildDate = parseIsoDate(report.buildDate, "维护报告 buildDate");
  assertInteger(report.currentCount, "维护报告 currentCount", 0);
  assertInteger(report.excludedCount, "维护报告 excludedCount", 0);
  assertInteger(report.historicalCount, "维护报告 historicalCount", 0);
  assertInteger(report.maxAgeDays, "维护报告 maxAgeDays", 1);

  assertPlainObject(report.thresholds, "维护报告 thresholds");
  assertExactKeys(
    report.thresholds,
    ["dueSoonDays", "reviewSoonDays"],
    "维护报告 thresholds",
  );
  assertInteger(
    report.thresholds.dueSoonDays,
    "维护报告 thresholds.dueSoonDays",
    0,
  );
  assertInteger(
    report.thresholds.reviewSoonDays,
    "维护报告 thresholds.reviewSoonDays",
    0,
  );
  if (
    report.thresholds.dueSoonDays > report.thresholds.reviewSoonDays ||
    report.thresholds.reviewSoonDays > report.maxAgeDays
  ) {
    valueError(
      "维护报告 thresholds",
      "必须满足 dueSoonDays ≤ reviewSoonDays ≤ maxAgeDays",
    );
  }

  assertPlainObject(report.counts, "维护报告 counts");
  assertExactKeys(report.counts, MAINTENANCE_STATUSES, "维护报告 counts");
  for (const status of MAINTENANCE_STATUSES) {
    assertInteger(report.counts[status], `维护报告 counts.${status}`, 0);
  }

  if (!Array.isArray(report.reviewChecklist) || report.reviewChecklist.length === 0) {
    valueError("维护报告 reviewChecklist", "必须是非空数组");
  }
  const checklist = new Set();
  for (const [index, item] of report.reviewChecklist.entries()) {
    assertNonEmptyString(item, `维护报告 reviewChecklist[${index}]`);
    if (checklist.has(item)) {
      valueError("维护报告 reviewChecklist", "不能包含重复项");
    }
    checklist.add(item);
  }

  if (!Array.isArray(report.records)) {
    valueError("维护报告 records", "必须是数组");
  }
  const sources = new Set();
  const countedStatuses = Object.fromEntries(
    MAINTENANCE_STATUSES.map((status) => [status, 0]),
  );
  for (const [index, record] of report.records.entries()) {
    const label = `维护报告 records[${index}]`;
    assertPlainObject(record, label);
    assertExactKeys(
      record,
      [
        "ageDays",
        "kind",
        "remainingDays",
        "reviewedAt",
        "reviewBy",
        "slug",
        "sourcePath",
        "status",
        "title",
        "url",
      ],
      label,
    );
    assertInteger(record.ageDays, `${label}.ageDays`, 0);
    assertInteger(record.remainingDays, `${label}.remainingDays`);
    assertNonEmptyString(record.title, `${label}.title`);
    if (record.kind !== "post" && record.kind !== "project") {
      valueError(`${label}.kind`, "必须是 post 或 project");
    }
    if (
      typeof record.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.slug)
    ) {
      valueError(`${label}.slug`, "必须是稳定的小写 kebab-case slug");
    }
    const directory = record.kind === "post" ? "posts" : "projects";
    const expectedSourcePath = `content/${directory}/${record.slug}.md`;
    if (record.sourcePath !== expectedSourcePath) {
      valueError(`${label}.sourcePath`, `必须是 ${expectedSourcePath}`);
    }
    if (record.url !== `/${directory}/${record.slug}`) {
      valueError(`${label}.url`, "必须与 kind 和 slug 的公开路由一致");
    }
    if (sources.has(record.sourcePath)) {
      valueError(`${label}.sourcePath`, "不能重复");
    }
    sources.add(record.sourcePath);

    const reviewedAt = parseIsoDate(record.reviewedAt, `${label}.reviewedAt`);
    parseIsoDate(record.reviewBy, `${label}.reviewBy`);
    if (dayDifference(buildDate, reviewedAt) !== record.ageDays) {
      valueError(`${label}.ageDays`, "必须等于 buildDate 与 reviewedAt 的日差");
    }
    if (record.reviewBy !== addIsoDays(record.reviewedAt, report.maxAgeDays)) {
      valueError(`${label}.reviewBy`, "必须等于 reviewedAt 加 maxAgeDays");
    }
    if (record.remainingDays !== report.maxAgeDays - record.ageDays) {
      valueError(`${label}.remainingDays`, "必须等于 maxAgeDays 减 ageDays");
    }
    if (!MAINTENANCE_STATUSES.includes(record.status)) {
      valueError(`${label}.status`, "不是受支持的状态");
    }
    if (record.status !== expectedStatus(record.remainingDays, report.thresholds)) {
      valueError(`${label}.status`, "与剩余天数和阈值不一致");
    }
    countedStatuses[record.status] += 1;
  }

  if (report.currentCount !== report.records.length) {
    valueError("维护报告 currentCount", "必须等于 records 数量");
  }
  for (const status of MAINTENANCE_STATUSES) {
    if (report.counts[status] !== countedStatuses[status]) {
      valueError(`维护报告 counts.${status}`, "必须与 records 一致");
    }
  }
  for (let index = 1; index < report.records.length; index += 1) {
    const previous = report.records[index - 1];
    const current = report.records[index];
    const outOfOrder =
      STATUS_ORDER[previous.status] > STATUS_ORDER[current.status] ||
      (STATUS_ORDER[previous.status] === STATUS_ORDER[current.status] &&
        previous.remainingDays > current.remainingDays) ||
      (STATUS_ORDER[previous.status] === STATUS_ORDER[current.status] &&
        previous.remainingDays === current.remainingDays &&
        previous.sourcePath.localeCompare(current.sourcePath, "en") > 0);
    if (outOfOrder) {
      valueError("维护报告 records", "必须按紧急程度、剩余天数和来源路径排序");
    }
  }

  return report;
}

function parseContentReviewProof(output, expectedSourcePath) {
  let proof;
  try {
    proof = JSON.parse(output);
  } catch {
    throw new Error("正式内容复核证据不是有效 JSON");
  }

  assertPlainObject(proof, "正式内容复核证据");
  assertExactKeys(
    proof,
    ["version", "mode", "candidate", "review", "git", "qualityGate"],
    "正式内容复核证据",
  );
  if (proof.version !== CONTENT_REVIEW_PROOF_VERSION) {
    valueError(
      "正式内容复核证据 version",
      `必须是 ${CONTENT_REVIEW_PROOF_VERSION}`,
    );
  }
  if (proof.mode !== "check-only") {
    valueError("正式内容复核证据 mode", "必须是 check-only");
  }

  assertPlainObject(proof.candidate, "正式内容复核证据 candidate");
  assertExactKeys(
    proof.candidate,
    ["algorithm", "digest", "stableAfterQualityGate"],
    "正式内容复核证据 candidate",
  );
  if (proof.candidate.algorithm !== "sha256") {
    valueError("正式内容复核证据 candidate.algorithm", "必须是 sha256");
  }
  if (
    typeof proof.candidate.digest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(proof.candidate.digest)
  ) {
    valueError(
      "正式内容复核证据 candidate.digest",
      "必须是 64 位小写 SHA-256",
    );
  }
  if (proof.candidate.stableAfterQualityGate !== true) {
    valueError(
      "正式内容复核证据 candidate.stableAfterQualityGate",
      "必须证明门前与门后候选一致",
    );
  }

  assertPlainObject(proof.review, "正式内容复核证据 review");
  assertExactKeys(
    proof.review,
    [
      "kind",
      "previousReviewedAt",
      "previousUpdatedAt",
      "reviewedAt",
      "slug",
      "sourcePath",
      "substantiveChanged",
      "title",
      "updatedAt",
    ],
    "正式内容复核证据 review",
  );
  if (proof.review.kind !== "post" && proof.review.kind !== "project") {
    valueError("正式内容复核证据 review.kind", "必须是 post 或 project");
  }
  if (
    typeof proof.review.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(proof.review.slug)
  ) {
    valueError("正式内容复核证据 review.slug", "必须是稳定 kebab-case slug");
  }
  assertNonEmptyString(proof.review.title, "正式内容复核证据 review.title");
  const directory = proof.review.kind === "post" ? "posts" : "projects";
  const derivedSourcePath = `content/${directory}/${proof.review.slug}.md`;
  if (
    proof.review.sourcePath !== derivedSourcePath ||
    proof.review.sourcePath !== expectedSourcePath
  ) {
    valueError(
      "正式内容复核证据 review.sourcePath",
      `必须与活动笔记严格一致：${expectedSourcePath}`,
    );
  }
  parseIsoDate(
    proof.review.previousReviewedAt,
    "正式内容复核证据 review.previousReviewedAt",
  );
  parseIsoDate(
    proof.review.reviewedAt,
    "正式内容复核证据 review.reviewedAt",
  );
  if (proof.review.previousReviewedAt >= proof.review.reviewedAt) {
    valueError(
      "正式内容复核证据 review.reviewedAt",
      "必须晚于 previousReviewedAt",
    );
  }
  for (const field of ["previousUpdatedAt", "updatedAt"]) {
    const value = proof.review[field];
    if (value !== null) {
      parseIsoDate(value, `正式内容复核证据 review.${field}`);
    }
  }
  if (
    proof.review.previousUpdatedAt !== null &&
    proof.review.previousUpdatedAt > proof.review.previousReviewedAt
  ) {
    valueError(
      "正式内容复核证据 review.previousUpdatedAt",
      "不能晚于 previousReviewedAt",
    );
  }
  if (
    proof.review.updatedAt !== null &&
    proof.review.updatedAt > proof.review.reviewedAt
  ) {
    valueError(
      "正式内容复核证据 review.updatedAt",
      "不能晚于 reviewedAt",
    );
  }
  if (typeof proof.review.substantiveChanged !== "boolean") {
    valueError(
      "正式内容复核证据 review.substantiveChanged",
      "必须是 boolean",
    );
  }
  if (
    proof.review.substantiveChanged &&
    proof.review.updatedAt !== proof.review.reviewedAt
  ) {
    valueError(
      "正式内容复核证据 review.updatedAt",
      "事实变化时必须等于 reviewedAt",
    );
  }
  if (
    !proof.review.substantiveChanged &&
    proof.review.updatedAt !== proof.review.previousUpdatedAt
  ) {
    valueError(
      "正式内容复核证据 review.updatedAt",
      "事实未变时必须保持 previousUpdatedAt",
    );
  }

  assertPlainObject(proof.git, "正式内容复核证据 git");
  assertExactKeys(
    proof.git,
    [
      "branch",
      "changedPaths",
      "committablePaths",
      "deferredPaths",
      "stagedPaths",
      "untrackedPaths",
    ],
    "正式内容复核证据 git",
  );
  if (proof.git.branch !== "main") {
    valueError("正式内容复核证据 git.branch", "必须是 main");
  }
  for (const field of [
    "changedPaths",
    "committablePaths",
    "deferredPaths",
    "stagedPaths",
    "untrackedPaths",
  ]) {
    const paths = proof.git[field];
    if (!Array.isArray(paths)) {
      valueError(`正式内容复核证据 git.${field}`, "必须是数组");
    }
    for (const path of paths) {
      if (
        typeof path !== "string" ||
        path.length === 0 ||
        path.trim() !== path ||
        path.startsWith("/") ||
        path.includes("\\") ||
        path.includes("//")
      ) {
        valueError(`正式内容复核证据 git.${field}`, "包含不安全的仓库路径");
      }
    }
    if (new Set(paths).size !== paths.length) {
      valueError(`正式内容复核证据 git.${field}`, "不能包含重复路径");
    }
    const sorted = [...paths].sort((left, right) =>
      left.localeCompare(right, "en"),
    );
    if (paths.some((path, index) => path !== sorted[index])) {
      valueError(`正式内容复核证据 git.${field}`, "必须按路径确定性排序");
    }
  }
  if (
    proof.git.committablePaths.length !== 1 ||
    proof.git.committablePaths[0] !== expectedSourcePath
  ) {
    valueError(
      "正式内容复核证据 git.committablePaths",
      `必须只包含 ${expectedSourcePath}`,
    );
  }
  if (proof.git.stagedPaths.length !== 0) {
    valueError("正式内容复核证据 git.stagedPaths", "必须是空数组");
  }
  if (!proof.git.changedPaths.includes(expectedSourcePath)) {
    valueError(
      "正式内容复核证据 git.changedPaths",
      `必须包含 ${expectedSourcePath}`,
    );
  }
  const modifiedDeferred = proof.git.changedPaths.filter(
    (path) => path !== expectedSourcePath,
  );
  if (
    modifiedDeferred.some(
      (path) => !/^content\/inbox\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(path),
    )
  ) {
    valueError(
      "正式内容复核证据 git.changedPaths",
      "除目标外只能包含稳定 inbox 草稿",
    );
  }
  if (
    proof.git.untrackedPaths.some(
      (path) =>
        !/^content\/inbox\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(path) &&
        !/^public\/uploads\/[^/\u0000-\u001f\u007f]+\.(?:avif|gif|jpe?g|png|webp)$/iu.test(
          path,
        ),
    )
  ) {
    valueError(
      "正式内容复核证据 git.untrackedPaths",
      "只能包含稳定 inbox 草稿或未跟踪的根暂存图片",
    );
  }
  const untrackedSet = new Set(proof.git.untrackedPaths);
  if (modifiedDeferred.some((path) => untrackedSet.has(path))) {
    valueError("正式内容复核证据 git", "changed 与 untracked 路径不能重叠");
  }
  const expectedDeferred = [...modifiedDeferred, ...proof.git.untrackedPaths].sort(
    (left, right) => left.localeCompare(right, "en"),
  );
  if (
    proof.git.deferredPaths.length !== expectedDeferred.length ||
    proof.git.deferredPaths.some(
      (path, index) => path !== expectedDeferred[index],
    )
  ) {
    valueError(
      "正式内容复核证据 git.deferredPaths",
      "必须精确等于已修改 inbox 与安全未跟踪作者工作的并集",
    );
  }

  assertPlainObject(proof.qualityGate, "正式内容复核证据 qualityGate");
  assertExactKeys(
    proof.qualityGate,
    ["command", "status"],
    "正式内容复核证据 qualityGate",
  );
  if (
    proof.qualityGate.command !== "npm run check" ||
    proof.qualityGate.status !== "passed"
  ) {
    valueError(
      "正式内容复核证据 qualityGate",
      "必须证明 npm run check 已通过",
    );
  }

  return proof;
}

function assertGitObjectId(value, label) {
  if (typeof value !== "string" || !GIT_OBJECT_ID_PATTERN.test(value)) {
    valueError(label, "必须是 40 或 64 位小写 Git object id");
  }
}

function parseContentReviewDeliveryReport(output) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("正式复核交付证据不是有效 JSON");
  }
  assertPlainObject(report, "正式复核交付证据");
  assertExactKeys(
    report,
    ["version", "mode", "observation", "relation", "pendingReview", "recovery"],
    "正式复核交付证据",
  );
  if (report.version !== CONTENT_REVIEW_DELIVERY_REPORT_VERSION) {
    valueError(
      "正式复核交付证据 version",
      `必须是 ${CONTENT_REVIEW_DELIVERY_REPORT_VERSION}`,
    );
  }
  if (report.mode !== "read-only") {
    valueError("正式复核交付证据 mode", "必须是 read-only");
  }

  assertPlainObject(report.observation, "正式复核交付证据 observation");
  assertExactKeys(
    report.observation,
    [
      "currentBranch",
      "localHead",
      "localRef",
      "networkChecked",
      "trackingHead",
      "trackingRef",
    ],
    "正式复核交付证据 observation",
  );
  if (report.observation.currentBranch !== null) {
    assertNonEmptyString(
      report.observation.currentBranch,
      "正式复核交付证据 observation.currentBranch",
    );
    if (/[\u0000-\u001f\u007f]/u.test(report.observation.currentBranch)) {
      valueError(
        "正式复核交付证据 observation.currentBranch",
        "不能包含控制字符",
      );
    }
  }
  assertGitObjectId(
    report.observation.localHead,
    "正式复核交付证据 observation.localHead",
  );
  if (report.observation.localRef !== "refs/heads/main") {
    valueError("正式复核交付证据 observation.localRef", "必须是 refs/heads/main");
  }
  if (report.observation.networkChecked !== false) {
    valueError("正式复核交付证据 observation.networkChecked", "必须是 false");
  }
  if (report.observation.trackingHead !== null) {
    assertGitObjectId(
      report.observation.trackingHead,
      "正式复核交付证据 observation.trackingHead",
    );
  }
  if (report.observation.trackingRef !== "refs/remotes/origin/main") {
    valueError(
      "正式复核交付证据 observation.trackingRef",
      "必须是 refs/remotes/origin/main",
    );
  }

  assertPlainObject(report.relation, "正式复核交付证据 relation");
  assertExactKeys(
    report.relation,
    ["ahead", "behind", "status"],
    "正式复核交付证据 relation",
  );
  if (!CONTENT_REVIEW_DELIVERY_STATUSES.includes(report.relation.status)) {
    valueError("正式复核交付证据 relation.status", "不是受支持的状态");
  }
  const trackingMissing = report.observation.trackingHead === null;
  if (trackingMissing) {
    if (
      report.relation.ahead !== null ||
      report.relation.behind !== null ||
      report.relation.status !== "tracking-missing"
    ) {
      valueError(
        "正式复核交付证据 relation",
        "tracking ref 缺失时必须是 tracking-missing 且计数为 null",
      );
    }
  } else {
    assertInteger(report.relation.ahead, "正式复核交付证据 relation.ahead", 0);
    assertInteger(report.relation.behind, "正式复核交付证据 relation.behind", 0);
    const { ahead, behind } = report.relation;
    const expectedStatus = ahead > 0 && behind > 0
      ? "diverged"
      : behind > 0
        ? "behind"
        : ahead > 0
          ? (report.pendingReview === null ? "local-ahead" : "pending-review")
          : "synchronized";
    if (report.relation.status !== expectedStatus) {
      valueError(
        "正式复核交付证据 relation.status",
        "与 ahead/behind/pendingReview 不一致",
      );
    }
    if (
      (ahead === 0 && behind === 0) !==
      (report.observation.localHead === report.observation.trackingHead)
    ) {
      valueError(
        "正式复核交付证据 relation",
        "HEAD 身份与 ahead/behind 不一致",
      );
    }
  }

  if (report.pendingReview !== null) {
    assertPlainObject(report.pendingReview, "正式复核交付证据 pendingReview");
    assertExactKeys(
      report.pendingReview,
      [
        "blobOid",
        "commitOid",
        "parentOid",
        "slug",
        "sourcePath",
        "subject",
        "treeOid",
      ],
      "正式复核交付证据 pendingReview",
    );
    for (const field of ["blobOid", "commitOid", "parentOid", "treeOid"]) {
      assertGitObjectId(
        report.pendingReview[field],
        `正式复核交付证据 pendingReview.${field}`,
      );
    }
    if (
      report.relation.status !== "pending-review" ||
      report.relation.ahead !== 1 ||
      report.relation.behind !== 0 ||
      report.pendingReview.commitOid !== report.observation.localHead ||
      report.pendingReview.parentOid !== report.observation.trackingHead
    ) {
      valueError(
        "正式复核交付证据 pendingReview",
        "必须是直接领先 tracking ref 的唯一 HEAD 提交",
      );
    }
    if (
      typeof report.pendingReview.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(report.pendingReview.slug)
    ) {
      valueError("正式复核交付证据 pendingReview.slug", "必须是稳定 slug");
    }
    const expectedPathPattern = new RegExp(
      `^content/(?:posts|projects)/${report.pendingReview.slug}\\.md$`,
      "u",
    );
    if (!expectedPathPattern.test(report.pendingReview.sourcePath)) {
      valueError(
        "正式复核交付证据 pendingReview.sourcePath",
        "必须是与 slug 对应的正式内容路径",
      );
    }
    if (report.pendingReview.subject !== `content: review ${report.pendingReview.slug}`) {
      valueError(
        "正式复核交付证据 pendingReview.subject",
        "必须是与 slug 对应的正式复核提交",
      );
    }
  } else if (report.relation.status === "pending-review") {
    valueError("正式复核交付证据 pendingReview", "pending-review 状态不能缺失");
  }

  assertPlainObject(report.recovery, "正式复核交付证据 recovery");
  assertExactKeys(
    report.recovery,
    ["action", "autoExecuted", "command"],
    "正式复核交付证据 recovery",
  );
  if (report.recovery.autoExecuted !== false) {
    valueError("正式复核交付证据 recovery.autoExecuted", "必须是 false");
  }
  const expectedRecovery = report.relation.status === "pending-review"
    ? ["push-origin-main", "git push origin main"]
    : report.relation.status === "synchronized"
      ? ["none", null]
      : ["inspect-git-state", null];
  if (
    report.recovery.action !== expectedRecovery[0] ||
    report.recovery.command !== expectedRecovery[1]
  ) {
    valueError("正式复核交付证据 recovery", "与 relation 状态不一致");
  }
  return report;
}

function parseContentPublishDeliveryReport(output) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("新内容发布交付证据不是有效 JSON");
  }
  const label = "新内容发布交付证据";
  assertPlainObject(report, label);
  assertExactKeys(
    report,
    ["version", "mode", "observation", "relation", "pendingPublication", "recovery"],
    label,
  );
  if (report.version !== CONTENT_PUBLISH_DELIVERY_REPORT_VERSION) {
    valueError(`${label} version`, `必须是 ${CONTENT_PUBLISH_DELIVERY_REPORT_VERSION}`);
  }
  if (report.mode !== "read-only") {
    valueError(`${label} mode`, "必须是 read-only");
  }

  assertPlainObject(report.observation, `${label} observation`);
  assertExactKeys(
    report.observation,
    [
      "currentBranch",
      "localHead",
      "localRef",
      "networkChecked",
      "trackingHead",
      "trackingRef",
    ],
    `${label} observation`,
  );
  if (report.observation.currentBranch !== null) {
    assertNonEmptyString(
      report.observation.currentBranch,
      `${label} observation.currentBranch`,
    );
    if (/[ -]/u.test(report.observation.currentBranch)) {
      valueError(`${label} observation.currentBranch`, "不能包含控制字符");
    }
  }
  assertGitObjectId(report.observation.localHead, `${label} observation.localHead`);
  if (report.observation.localRef !== "refs/heads/main") {
    valueError(`${label} observation.localRef`, "必须是 refs/heads/main");
  }
  if (report.observation.networkChecked !== false) {
    valueError(`${label} observation.networkChecked`, "必须是 false");
  }
  if (report.observation.trackingHead !== null) {
    assertGitObjectId(
      report.observation.trackingHead,
      `${label} observation.trackingHead`,
    );
  }
  if (report.observation.trackingRef !== "refs/remotes/origin/main") {
    valueError(
      `${label} observation.trackingRef`,
      "必须是 refs/remotes/origin/main",
    );
  }

  assertPlainObject(report.relation, `${label} relation`);
  assertExactKeys(report.relation, ["ahead", "behind", "status"], `${label} relation`);
  if (!CONTENT_PUBLISH_DELIVERY_STATUSES.includes(report.relation.status)) {
    valueError(`${label} relation.status`, "不是受支持的状态");
  }
  const trackingMissing = report.observation.trackingHead === null;
  if (trackingMissing) {
    if (
      report.relation.ahead !== null ||
      report.relation.behind !== null ||
      report.relation.status !== "tracking-missing"
    ) {
      valueError(
        `${label} relation`,
        "tracking ref 缺失时必须是 tracking-missing 且计数为 null",
      );
    }
  } else {
    assertInteger(report.relation.ahead, `${label} relation.ahead`, 0);
    assertInteger(report.relation.behind, `${label} relation.behind`, 0);
    const { ahead, behind } = report.relation;
    const expectedStatus = ahead > 0 && behind > 0
      ? "diverged"
      : behind > 0
        ? "behind"
        : ahead > 0
          ? (report.pendingPublication === null ? "local-ahead" : "pending-publication")
          : "synchronized";
    if (report.relation.status !== expectedStatus) {
      valueError(
        `${label} relation.status`,
        "与 ahead/behind/pendingPublication 不一致",
      );
    }
    if (
      (ahead === 0 && behind === 0) !==
      (report.observation.localHead === report.observation.trackingHead)
    ) {
      valueError(`${label} relation`, "HEAD 身份与 ahead/behind 不一致");
    }
  }

  if (report.pendingPublication !== null) {
    const pending = report.pendingPublication;
    const pendingLabel = `${label} pendingPublication`;
    assertPlainObject(pending, pendingLabel);
    assertExactKeys(
      pending,
      [
        "attachmentCount",
        "changes",
        "commitOid",
        "inboxSourcePath",
        "kind",
        "parentOid",
        "slug",
        "sourceDeletionTracked",
        "subject",
        "targetBlobOid",
        "targetPath",
        "title",
        "treeOid",
      ],
      pendingLabel,
    );
    assertInteger(pending.attachmentCount, `${pendingLabel}.attachmentCount`, 0);
    for (const field of ["commitOid", "parentOid", "targetBlobOid", "treeOid"]) {
      assertGitObjectId(pending[field], `${pendingLabel}.${field}`);
    }
    if (
      report.relation.status !== "pending-publication" ||
      report.relation.ahead !== 1 ||
      report.relation.behind !== 0 ||
      pending.commitOid !== report.observation.localHead ||
      pending.parentOid !== report.observation.trackingHead
    ) {
      valueError(pendingLabel, "必须是直接领先 tracking ref 的唯一 HEAD 提交");
    }
    if (
      typeof pending.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(pending.slug)
    ) {
      valueError(`${pendingLabel}.slug`, "必须是稳定 slug");
    }
    if (pending.kind !== "post" && pending.kind !== "project") {
      valueError(`${pendingLabel}.kind`, "必须是 post 或 project");
    }
    assertNonEmptyString(pending.title, `${pendingLabel}.title`);
    if (/[ -]/u.test(pending.title)) {
      valueError(`${pendingLabel}.title`, "不能包含控制字符");
    }
    const expectedTargetPath = `content/${pending.kind === "post" ? "posts" : "projects"}/${pending.slug}.md`;
    const expectedInboxPath = `content/inbox/${pending.slug}.md`;
    if (pending.targetPath !== expectedTargetPath) {
      valueError(`${pendingLabel}.targetPath`, "必须与 kind/slug 严格对应");
    }
    if (pending.inboxSourcePath !== expectedInboxPath) {
      valueError(`${pendingLabel}.inboxSourcePath`, "必须与 slug 严格对应");
    }
    if (pending.subject !== `content: publish ${pending.slug}`) {
      valueError(`${pendingLabel}.subject`, "必须与 slug 严格对应");
    }
    if (typeof pending.sourceDeletionTracked !== "boolean") {
      valueError(`${pendingLabel}.sourceDeletionTracked`, "必须是布尔值");
    }
    if (!Array.isArray(pending.changes) || pending.changes.length === 0) {
      valueError(`${pendingLabel}.changes`, "必须是非空数组");
    }

    const seenPaths = new Set();
    const attachmentPattern = new RegExp(
      `^public/uploads/${pending.slug}/[a-z0-9]+(?:-[a-z0-9]+)*(?:-[a-f0-9]{8})?\\.(?:avif|gif|webp)$`,
      "u",
    );
    for (const [index, change] of pending.changes.entries()) {
      const changeLabel = `${pendingLabel}.changes[${index}]`;
      assertPlainObject(change, changeLabel);
      assertExactKeys(
        change,
        ["newBlobOid", "oldBlobOid", "path", "status"],
        changeLabel,
      );
      assertNonEmptyString(change.path, `${changeLabel}.path`);
      if (
        !/^[a-zA-Z0-9._/-]+$/u.test(change.path) ||
        change.path.startsWith("/") ||
        change.path.includes("//") ||
        change.path.split("/").some((part) => part === "." || part === "..") ||
        seenPaths.has(change.path)
      ) {
        valueError(`${changeLabel}.path`, "必须是唯一安全仓库路径");
      }
      seenPaths.add(change.path);
      if (!['added', 'deleted', 'modified'].includes(change.status)) {
        valueError(`${changeLabel}.status`, "不是受支持的变更状态");
      }
      if (change.oldBlobOid !== null) {
        assertGitObjectId(change.oldBlobOid, `${changeLabel}.oldBlobOid`);
      }
      if (change.newBlobOid !== null) {
        assertGitObjectId(change.newBlobOid, `${changeLabel}.newBlobOid`);
      }
      const shapeValid = change.status === "added"
        ? change.oldBlobOid === null && change.newBlobOid !== null
        : change.status === "deleted"
          ? change.oldBlobOid !== null && change.newBlobOid === null
          : change.oldBlobOid !== null && change.newBlobOid !== null;
      if (!shapeValid) {
        valueError(changeLabel, "blob 身份与变更状态不一致");
      }
    }
    const sortedPaths = pending.changes
      .map((change) => change.path)
      .sort((left, right) => left.localeCompare(right, "en"));
    if (pending.changes.some((change, index) => change.path !== sortedPaths[index])) {
      valueError(`${pendingLabel}.changes`, "必须按路径确定性排序");
    }
    const target = pending.changes.find((change) => change.path === expectedTargetPath);
    const inbox = pending.changes.find((change) => change.path === expectedInboxPath);
    const attachments = pending.changes.filter((change) => attachmentPattern.test(change.path));
    if (
      target?.status !== "added" ||
      target.oldBlobOid !== null ||
      target.newBlobOid !== pending.targetBlobOid
    ) {
      valueError(`${pendingLabel}.changes`, "必须包含与 targetBlobOid 一致的新增正式内容");
    }
    if (
      pending.sourceDeletionTracked !== (inbox !== undefined) ||
      (inbox && inbox.status !== "deleted")
    ) {
      valueError(`${pendingLabel}.changes`, "inbox 删除与 sourceDeletionTracked 不一致");
    }
    if (
      attachments.length !== pending.attachmentCount ||
      attachments.some((change) => change.status !== "added")
    ) {
      valueError(`${pendingLabel}.changes`, "媒体清单与 attachmentCount 不一致");
    }
    const allowedPaths = new Set([
      expectedTargetPath,
      ...(inbox ? [expectedInboxPath] : []),
      ...attachments.map((change) => change.path),
    ]);
    if (
      allowedPaths.size !== pending.changes.length ||
      pending.changes.some((change) => !allowedPaths.has(change.path))
    ) {
      valueError(`${pendingLabel}.changes`, "包含原子发布包之外的路径");
    }
  } else if (report.relation.status === "pending-publication") {
    valueError(`${label} pendingPublication`, "pending-publication 状态不能缺失");
  }

  assertPlainObject(report.recovery, `${label} recovery`);
  assertExactKeys(
    report.recovery,
    ["action", "autoExecuted", "command"],
    `${label} recovery`,
  );
  if (report.recovery.autoExecuted !== false) {
    valueError(`${label} recovery.autoExecuted`, "必须是 false");
  }
  const expectedRecovery = report.relation.status === "pending-publication"
    ? [
        "push-pending-publication",
        `git push origin ${report.pendingPublication.commitOid}:refs/heads/main`,
      ]
    : report.relation.status === "synchronized"
      ? ["none", null]
      : ["inspect-git-state", null];
  if (
    report.recovery.action !== expectedRecovery[0] ||
    report.recovery.command !== expectedRecovery[1]
  ) {
    valueError(`${label} recovery`, "与 relation 状态或精确 commit 身份不一致");
  }
  return report;
}

function parseContentPublishDeliveryReceipt(output) {
  let receipt;
  try {
    receipt = JSON.parse(output);
  } catch {
    throw new Error("新内容发布交付回执不是有效 JSON");
  }
  const label = "新内容发布交付回执";
  assertPlainObject(receipt, label);
  assertExactKeys(
    receipt,
    ["version", "mode", "publication", "transition", "safety"],
    label,
  );
  if (receipt.version !== CONTENT_PUBLISH_DELIVERY_RECEIPT_VERSION) {
    valueError(
      `${label} version`,
      `必须是 ${CONTENT_PUBLISH_DELIVERY_RECEIPT_VERSION}`,
    );
  }
  if (receipt.mode !== "delivered") {
    valueError(`${label} mode`, "必须是 delivered");
  }

  assertPlainObject(receipt.publication, `${label} publication`);
  const publication = receipt.publication;
  const validated = parseContentPublishDeliveryReport(
    JSON.stringify({
      version: CONTENT_PUBLISH_DELIVERY_REPORT_VERSION,
      mode: "read-only",
      observation: {
        currentBranch: "main",
        localHead: publication.commitOid,
        localRef: "refs/heads/main",
        networkChecked: false,
        trackingHead: publication.parentOid,
        trackingRef: "refs/remotes/origin/main",
      },
      relation: { ahead: 1, behind: 0, status: "pending-publication" },
      pendingPublication: publication,
      recovery: {
        action: "push-pending-publication",
        autoExecuted: false,
        command: `git push origin ${publication.commitOid}:refs/heads/main`,
      },
    }),
  );
  receipt.publication = validated.pendingPublication;

  assertPlainObject(receipt.transition, `${label} transition`);
  assertExactKeys(
    receipt.transition,
    ["before", "after", "command"],
    `${label} transition`,
  );
  for (const phase of ["before", "after"]) {
    assertPlainObject(receipt.transition[phase], `${label} transition.${phase}`);
    assertExactKeys(
      receipt.transition[phase],
      ["localHead", "relation", "trackingHead"],
      `${label} transition.${phase}`,
    );
    assertGitObjectId(
      receipt.transition[phase].localHead,
      `${label} transition.${phase}.localHead`,
    );
    assertGitObjectId(
      receipt.transition[phase].trackingHead,
      `${label} transition.${phase}.trackingHead`,
    );
  }
  if (
    receipt.transition.before.relation !== "pending-publication" ||
    receipt.transition.before.localHead !== publication.commitOid ||
    receipt.transition.before.trackingHead !== publication.parentOid
  ) {
    valueError(
      `${label} transition.before`,
      "必须绑定待交付发布 commit 与父 tracking head",
    );
  }
  if (
    receipt.transition.after.relation !== "synchronized" ||
    receipt.transition.after.localHead !== publication.commitOid ||
    receipt.transition.after.trackingHead !== publication.commitOid
  ) {
    valueError(
      `${label} transition.after`,
      "必须证明 local/tracking 都是已交付发布 commit",
    );
  }
  const expectedCommand = `git push origin ${publication.commitOid}:refs/heads/main`;
  if (receipt.transition.command !== expectedCommand) {
    valueError(
      `${label} transition.command`,
      "必须是绑定已验证发布 commit 的精确非强制 push",
    );
  }

  assertPlainObject(receipt.safety, `${label} safety`);
  assertExactKeys(
    receipt.safety,
    [
      "fetchExecuted",
      "headStable",
      "indexStable",
      "manifestStable",
      "rebaseExecuted",
      "resetExecuted",
      "worktreeStable",
    ],
    `${label} safety`,
  );
  const expectedSafety = {
    fetchExecuted: false,
    headStable: true,
    indexStable: true,
    manifestStable: true,
    rebaseExecuted: false,
    resetExecuted: false,
    worktreeStable: true,
  };
  for (const [field, expected] of Object.entries(expectedSafety)) {
    if (receipt.safety[field] !== expected) {
      valueError(`${label} safety.${field}`, `必须是 ${expected}`);
    }
  }
  return receipt;
}

function parseContentReviewDeliveryReceipt(output) {
  let receipt;
  try {
    receipt = JSON.parse(output);
  } catch {
    throw new Error("正式复核交付回执不是有效 JSON");
  }
  assertPlainObject(receipt, "正式复核交付回执");
  assertExactKeys(
    receipt,
    ["version", "mode", "review", "transition", "safety"],
    "正式复核交付回执",
  );
  if (receipt.version !== CONTENT_REVIEW_DELIVERY_RECEIPT_VERSION) {
    valueError(
      "正式复核交付回执 version",
      `必须是 ${CONTENT_REVIEW_DELIVERY_RECEIPT_VERSION}`,
    );
  }
  if (receipt.mode !== "delivered") {
    valueError("正式复核交付回执 mode", "必须是 delivered");
  }

  assertPlainObject(receipt.review, "正式复核交付回执 review");
  assertExactKeys(
    receipt.review,
    [
      "blobOid",
      "commitOid",
      "parentOid",
      "slug",
      "sourcePath",
      "subject",
      "treeOid",
    ],
    "正式复核交付回执 review",
  );
  for (const field of ["blobOid", "commitOid", "parentOid", "treeOid"]) {
    assertGitObjectId(
      receipt.review[field],
      `正式复核交付回执 review.${field}`,
    );
  }
  if (
    typeof receipt.review.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(receipt.review.slug)
  ) {
    valueError("正式复核交付回执 review.slug", "必须是稳定 slug");
  }
  const expectedSource = new RegExp(
    `^content/(?:posts|projects)/${receipt.review.slug}\\.md$`,
    "u",
  );
  if (!expectedSource.test(receipt.review.sourcePath)) {
    valueError("正式复核交付回执 review.sourcePath", "必须与 slug 严格对应");
  }
  if (receipt.review.subject !== `content: review ${receipt.review.slug}`) {
    valueError("正式复核交付回执 review.subject", "必须与 slug 严格对应");
  }

  assertPlainObject(receipt.transition, "正式复核交付回执 transition");
  assertExactKeys(
    receipt.transition,
    ["before", "after", "command"],
    "正式复核交付回执 transition",
  );
  for (const phase of ["before", "after"]) {
    assertPlainObject(
      receipt.transition[phase],
      `正式复核交付回执 transition.${phase}`,
    );
    assertExactKeys(
      receipt.transition[phase],
      ["localHead", "relation", "trackingHead"],
      `正式复核交付回执 transition.${phase}`,
    );
    assertGitObjectId(
      receipt.transition[phase].localHead,
      `正式复核交付回执 transition.${phase}.localHead`,
    );
    assertGitObjectId(
      receipt.transition[phase].trackingHead,
      `正式复核交付回执 transition.${phase}.trackingHead`,
    );
  }
  if (
    receipt.transition.before.relation !== "pending-review" ||
    receipt.transition.before.localHead !== receipt.review.commitOid ||
    receipt.transition.before.trackingHead !== receipt.review.parentOid
  ) {
    valueError(
      "正式复核交付回执 transition.before",
      "必须绑定待交付 commit 与父 tracking head",
    );
  }
  if (
    receipt.transition.after.relation !== "synchronized" ||
    receipt.transition.after.localHead !== receipt.review.commitOid ||
    receipt.transition.after.trackingHead !== receipt.review.commitOid
  ) {
    valueError(
      "正式复核交付回执 transition.after",
      "必须证明 local/tracking 都是已交付 commit",
    );
  }
  const expectedCommand = `git push origin ${receipt.review.commitOid}:refs/heads/main`;
  if (receipt.transition.command !== expectedCommand) {
    valueError(
      "正式复核交付回执 transition.command",
      "必须是绑定已验证 commit 的精确非强制 push",
    );
  }

  assertPlainObject(receipt.safety, "正式复核交付回执 safety");
  assertExactKeys(
    receipt.safety,
    [
      "fetchExecuted",
      "headStable",
      "indexStable",
      "rebaseExecuted",
      "resetExecuted",
      "worktreeStable",
    ],
    "正式复核交付回执 safety",
  );
  const expectedSafety = {
    fetchExecuted: false,
    headStable: true,
    indexStable: true,
    rebaseExecuted: false,
    resetExecuted: false,
    worktreeStable: true,
  };
  for (const [field, expected] of Object.entries(expectedSafety)) {
    if (receipt.safety[field] !== expected) {
      valueError(
        `正式复核交付回执 safety.${field}`,
        `必须是 ${expected}`,
      );
    }
  }
  return receipt;
}

function remainingLabel(remainingDays) {
  return remainingDays >= 0
    ? `剩余 ${remainingDays} 天`
    : `逾期 ${Math.abs(remainingDays)} 天`;
}

function createMetric(container, label, value, className) {
  const metric = container.createEl("div", {
    cls: `myblog-maintenance__metric ${className ?? ""}`.trim(),
  });
  metric.createEl("dt", { text: label });
  metric.createEl("dd", { text: String(value) });
  return metric;
}

function createProofRow(container, label, value, options = {}) {
  const row = container.createEl("div", {
    cls: "myblog-review-proof__row",
  });
  if (options.state) row.setAttr("data-state", options.state);
  row.createEl("dt", { text: label });
  const detail = row.createEl("dd");
  if (options.code) detail.createEl("code", { text: String(value) });
  else detail.setText(String(value));
  return row;
}

function createDeferredProofRow(container, git) {
  const row = container.createEl("div", {
    cls: "myblog-review-proof__row myblog-review-proof__deferred",
  });
  row.setAttr("data-state", "deferred");
  row.createEl("dt", { text: "隔离作者工作" });
  const detail = row.createEl("dd");
  detail.createEl("p", {
    cls: "myblog-review-proof__deferred-label",
    text: "DEFERRED / NOT IN COMMIT",
  });
  detail.createEl("p", {
    cls: "myblog-review-proof__deferred-summary",
    text: git.deferredPaths.length
      ? `${git.deferredPaths.length} 条 · 保留在本地，不进入本次提交`
      : "0 条 · 没有并行作者工作",
  });
  if (git.deferredPaths.length === 0) return row;

  const untracked = new Set(git.untrackedPaths);
  const list = detail.createEl("ul", {
    cls: "myblog-review-proof__path-list",
  });
  for (const path of git.deferredPaths) {
    const item = list.createEl("li");
    item.createEl("span", {
      cls: "myblog-review-proof__path-state",
      text: untracked.has(path) ? "UNTRACKED" : "MODIFIED",
    });
    item.createEl("code", { text: path });
  }
  return row;
}

function createCandidateProofRow(container, candidate) {
  const row = container.createEl("div", {
    cls: "myblog-review-proof__row myblog-review-proof__candidate",
  });
  row.setAttr("data-state", "candidate");
  row.createEl("dt", { text: "内容候选" });
  const detail = row.createEl("dd");
  detail.createEl("p", {
    cls: "myblog-review-proof__candidate-label",
    text: "CANDIDATE / GATE-STABLE",
  });
  const digest = detail.createEl("code", {
    cls: "myblog-review-proof__candidate-digest",
    text: `sha256:${candidate.digest.slice(0, 12)}…${candidate.digest.slice(-8)}`,
  });
  digest.setAttr("title", `sha256:${candidate.digest}`);
  digest.setAttr(
    "aria-label",
    `完整内容候选 SHA-256：${candidate.digest}`,
  );
  detail.createEl("p", {
    cls: "myblog-review-proof__candidate-note",
    text: "门前与完整质量门后的字节一致。",
  });
  return row;
}

class ReadOnlyReportModal extends Modal {
  constructor(app, { description, report, title }) {
    super(app);
    this.description = description;
    this.report = report;
    this.title = title;
  }

  onOpen() {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: this.title });
    this.contentEl.createEl("p", { text: this.description });
    const output = this.contentEl.createEl("pre");
    output.setText(this.report || "没有报告输出。");
    output.style.whiteSpace = "pre-wrap";
    output.style.overflowWrap = "anywhere";
    output.style.maxHeight = "65vh";
    output.style.overflow = "auto";
  }
}

class InboxReadinessModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description: "只读检查；不会移动、改写、提交或推送文件。",
      report,
      title: "收件箱发布就绪状态",
    });
  }
}

class ContentMaintenanceTextModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description:
        "结构化视图不可用，以下为只读纯文本证据；不会修改 reviewedAt、内容、提交或推送文件。",
      report,
      title: "已发布内容复核台账 · 纯文本",
    });
  }
}

class ContentReviewProofTextModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description:
        "结构化 Author Proof 不可用，以下为重新执行后的只读文本证据；同步仍需单独运行。",
      report,
      title: "正式内容复核证据 · 纯文本",
    });
  }
}

class ContentReviewDeliveryTextModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description:
        "结构化交付证据不可用，以下为重新执行后的本地只读文本；没有 fetch、push 或历史修改。",
      report,
      title: "正式内容复核交付状态 · 纯文本",
    });
  }
}

class ContentPublishDeliveryTextModal extends ReadOnlyReportModal {
  constructor(app, report) {
    super(app, {
      description:
        "结构化发布交付证据不可用，以下为重新执行后的本地只读文本；没有 fetch、push 或历史修改。",
      report,
      title: "新内容发布交付状态 · 纯文本",
    });
  }
}

function createDeliveryRow(container, label, value, options = {}) {
  const row = container.createEl("div", {
    cls: "myblog-review-delivery__row",
  });
  if (options.state) row.setAttr("data-state", options.state);
  row.createEl("dt", { text: label });
  const detail = row.createEl("dd");
  if (options.code) detail.createEl("code", { text: String(value) });
  else detail.setText(String(value));
  return row;
}

function shortGitObjectId(oid) {
  return oid ? `${oid.slice(0, 12)}…${oid.slice(-8)}` : "MISSING";
}

class ContentReviewDeliveryModal extends Modal {
  constructor(app, report) {
    super(app);
    this.report = report;
  }

  onOpen() {
    const { contentEl, report } = this;
    const pending = report.pendingReview;
    const synchronized = report.relation.status === "synchronized";
    contentEl.empty();
    contentEl.addClass("myblog-review-delivery");
    contentEl.setAttr("data-status", report.relation.status);
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__eyebrow",
      text: pending
        ? "DELIVERY HOLD / LOCAL ONLY"
        : synchronized
          ? "DELIVERY EVIDENCE / ALIGNED"
          : "DELIVERY EVIDENCE / INSPECT",
    });
    contentEl.createEl("h2", {
      cls: "myblog-review-delivery__title",
      text: "正式内容复核交付状态",
    });
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__boundary",
      text: "只读取本地 Git 引用；没有 fetch、push 或历史修改。origin/main 仅代表最后一次本地观察，不是实时远端声明。",
    });

    const transition = contentEl.createEl("section", {
      cls: "myblog-review-delivery__transition",
    });
    transition.setAttr("aria-label", "origin/main 最后本地观察与 local main 的提交关系");
    const tracking = transition.createEl("div", {
      cls: "myblog-review-delivery__node",
    });
    tracking.createEl("span", { text: "ORIGIN/MAIN · LAST OBSERVED" });
    tracking.createEl("code", {
      text: shortGitObjectId(report.observation.trackingHead),
    });
    const track = transition.createEl("div", {
      cls: "myblog-review-delivery__track",
    });
    track.createEl("span", {
      text: report.relation.ahead === null ? "+?" : `+${report.relation.ahead}`,
    });
    const local = transition.createEl("div", {
      cls: "myblog-review-delivery__node myblog-review-delivery__node--local",
    });
    local.createEl("span", { text: "LOCAL MAIN" });
    local.createEl("code", {
      text: shortGitObjectId(report.observation.localHead),
    });

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-review-delivery__ledger",
    });
    const statusLabel = pending
      ? "PENDING / NOT ON TRACKING REF"
      : synchronized
        ? "SYNCHRONIZED / NO PENDING REVIEW"
        : `INSPECT / ${report.relation.status.toUpperCase()}`;
    createDeliveryRow(ledger, "交付状态", statusLabel, {
      state: pending ? "pending" : synchronized ? "synchronized" : "inspect",
    });
    createDeliveryRow(
      ledger,
      "提交关系",
      `behind ${report.relation.behind ?? "unknown"} · ahead ${report.relation.ahead ?? "unknown"}`,
      { code: true },
    );
    createDeliveryRow(
      ledger,
      "当前分支",
      report.observation.currentBranch ?? "detached HEAD",
      { code: true },
    );
    if (pending) {
      createDeliveryRow(ledger, "正式内容", pending.sourcePath, { code: true });
      createDeliveryRow(ledger, "提交声明", pending.subject, { code: true });
      createDeliveryRow(ledger, "commit", pending.commitOid, { code: true });
      createDeliveryRow(ledger, "tree", pending.treeOid, { code: true });
      createDeliveryRow(ledger, "content blob", pending.blobOid, { code: true });
      createDeliveryRow(ledger, "恢复命令", report.recovery.command, {
        code: true,
        state: "recovery",
      });
    } else if (!synchronized) {
      createDeliveryRow(
        ledger,
        "下一步",
        "先在仓库中检查 Git 状态；当前证据不足以自动建议 push。",
        { state: "inspect" },
      );
    }
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__note",
      text: pending
        ? "该提交已通过本地候选、父级、唯一路径与 tree/blob 验证；联网恢复后执行显示的命令，不要重新创建复核提交。"
        : synchronized
          ? "本地 main 与最后观察到的 origin/main 一致；没有待同步正式内容复核。"
          : "本地引用关系需要人工检查；本视图不会自动同步或改写历史。",
    });
  }
}

function createPublishManifestItem(container, label, change) {
  const item = container.createEl("div", {
    cls: "myblog-publish-delivery__manifest-item",
  });
  item.createEl("span", {
    cls: "myblog-publish-delivery__manifest-state",
    text: label,
  });
  item.createEl("code", { text: change.path });
  item.createEl("span", {
    cls: "myblog-publish-delivery__manifest-blob",
    text: shortGitObjectId(change.newBlobOid ?? change.oldBlobOid),
  });
}

function createPublishDeliveryRow(container, label, value, options = {}) {
  const row = container.createEl("div", {
    cls: "myblog-publish-delivery__row",
  });
  if (options.state) row.setAttr("data-state", options.state);
  row.createEl("dt", { text: label });
  const detail = row.createEl("dd");
  if (options.code) detail.createEl("code", { text: String(value) });
  else detail.setText(String(value));
  return row;
}

class ContentPublishDeliveryModal extends Modal {
  constructor(app, report) {
    super(app);
    this.report = report;
  }

  onOpen() {
    const { contentEl, report } = this;
    const pending = report.pendingPublication;
    const synchronized = report.relation.status === "synchronized";
    contentEl.empty();
    contentEl.addClass("myblog-publish-delivery");
    contentEl.setAttr("data-status", report.relation.status);
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__eyebrow",
      text: pending
        ? "PUBLICATION HOLD / ATOMIC BUNDLE"
        : synchronized
          ? "PUBLICATION EVIDENCE / ALIGNED"
          : "PUBLICATION EVIDENCE / INSPECT",
    });
    contentEl.createEl("h2", {
      cls: "myblog-publish-delivery__title",
      text: "新内容发布交付状态",
    });
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__boundary",
      text: "只读取本地 Git 引用与提交对象；没有 fetch、push 或历史修改。origin/main 仅代表最后一次本地观察，不是实时远端声明。",
    });

    const transition = contentEl.createEl("section", {
      cls: "myblog-publish-delivery__transition",
    });
    transition.setAttr("aria-label", "origin/main 最后本地观察与 local main 的发布提交关系");
    const tracking = transition.createEl("div", {
      cls: "myblog-publish-delivery__node",
    });
    tracking.createEl("span", { text: "ORIGIN/MAIN · LAST OBSERVED" });
    tracking.createEl("code", {
      text: shortGitObjectId(report.observation.trackingHead),
    });
    const track = transition.createEl("div", {
      cls: "myblog-publish-delivery__track",
    });
    track.createEl("span", {
      text: report.relation.ahead === null ? "+?" : `+${report.relation.ahead}`,
    });
    const local = transition.createEl("div", {
      cls: "myblog-publish-delivery__node myblog-publish-delivery__node--local",
    });
    local.createEl("span", { text: "LOCAL MAIN" });
    local.createEl("code", {
      text: shortGitObjectId(report.observation.localHead),
    });

    if (pending) {
      const manifest = contentEl.createEl("section", {
        cls: "myblog-publish-delivery__manifest",
      });
      manifest.setAttr("aria-label", "发布提交原子路径清单");
      manifest.createEl("p", {
        cls: "myblog-publish-delivery__manifest-label",
        text: `COMMIT ENVELOPE / ${pending.changes.length} PATHS`,
      });
      const target = pending.changes.find(
        (change) => change.path === pending.targetPath,
      );
      const attachments = pending.changes.filter((change) =>
        change.path.startsWith(`public/uploads/${pending.slug}/`),
      );
      const inbox = pending.changes.find(
        (change) => change.path === pending.inboxSourcePath,
      );
      createPublishManifestItem(manifest, "NOTE / ADDED", target);
      attachments.forEach((change, index) => {
        createPublishManifestItem(
          manifest,
          `MEDIA ${String(index + 1).padStart(2, "0")} / ADDED`,
          change,
        );
      });
      if (inbox) createPublishManifestItem(manifest, "INBOX / DELETED", inbox);
    }

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-publish-delivery__ledger",
    });
    const statusLabel = pending
      ? "PENDING / NOT ON TRACKING REF"
      : synchronized
        ? "SYNCHRONIZED / NO PENDING PUBLICATION"
        : `INSPECT / ${report.relation.status.toUpperCase()}`;
    createPublishDeliveryRow(ledger, "交付状态", statusLabel, {
      state: pending ? "pending" : synchronized ? "synchronized" : "inspect",
    });
    createPublishDeliveryRow(
      ledger,
      "提交关系",
      `behind ${report.relation.behind ?? "unknown"} · ahead ${report.relation.ahead ?? "unknown"}`,
      { code: true },
    );
    createPublishDeliveryRow(
      ledger,
      "当前分支",
      report.observation.currentBranch ?? "detached HEAD",
      { code: true },
    );
    if (pending) {
      createPublishDeliveryRow(ledger, "内容标题", pending.title);
      createPublishDeliveryRow(ledger, "提交声明", pending.subject, { code: true });
      createPublishDeliveryRow(ledger, "commit", pending.commitOid, { code: true });
      createPublishDeliveryRow(ledger, "tree", pending.treeOid, { code: true });
      createPublishDeliveryRow(ledger, "target blob", pending.targetBlobOid, {
        code: true,
      });
      createPublishDeliveryRow(ledger, "恢复命令", report.recovery.command, {
        code: true,
        state: "recovery",
      });
    } else if (!synchronized) {
      createPublishDeliveryRow(
        ledger,
        "下一步",
        "先在仓库中检查 Git 状态；当前证据不足以建议 push。",
        { state: "inspect" },
      );
    }
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__note",
      text: pending
        ? "该 commit 已通过父级、主题、正式笔记、可选 inbox 删除与全部归档媒体身份验证；不要再次发布同一草稿。联网恢复后只执行显示的精确 OID 命令。"
        : synchronized
          ? "本地 main 与最后观察到的 origin/main 一致；没有待同步的新内容发布包。"
          : "本地引用关系需要人工检查；本视图不会自动同步、重建发布提交或改写历史。",
    });
  }
}

class ContentPublishDeliveryReceiptModal extends Modal {
  constructor(app, receipt) {
    super(app);
    this.receipt = receipt;
  }

  onOpen() {
    const { contentEl, receipt } = this;
    const publication = receipt.publication;
    contentEl.empty();
    contentEl.addClass("myblog-publish-delivery");
    contentEl.addClass("myblog-publish-delivery-receipt");
    contentEl.setAttr("data-status", "synchronized");
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__eyebrow",
      text: "PUBLICATION RECEIPT / SEALED ENVELOPE",
    });
    contentEl.createEl("h2", {
      cls: "myblog-publish-delivery__title",
      text: "新内容发布包已重新同步",
    });
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__boundary",
      text: "已把验证过的精确 Commit Envelope 推送到 origin/main；未执行 fetch、rebase、reset，也未修改 index 或工作区。",
    });

    const transition = contentEl.createEl("section", {
      cls: "myblog-publish-delivery__transition",
    });
    transition.setAttr("aria-label", "已验证发布提交精确送达到 origin/main");
    const local = transition.createEl("div", {
      cls: "myblog-publish-delivery__node",
    });
    local.createEl("span", { text: "VERIFIED COMMIT ENVELOPE" });
    local.createEl("code", {
      text: shortGitObjectId(receipt.transition.before.localHead),
    });
    const track = transition.createEl("div", {
      cls: "myblog-publish-delivery__track myblog-publish-delivery__track--sealed",
    });
    track.createEl("span", { text: "SEALED PUSH" });
    const tracking = transition.createEl("div", {
      cls: "myblog-publish-delivery__node myblog-publish-delivery__node--local",
    });
    tracking.createEl("span", { text: "ORIGIN/MAIN · OBSERVED AFTER PUSH" });
    tracking.createEl("code", {
      text: shortGitObjectId(receipt.transition.after.trackingHead),
    });

    const manifest = contentEl.createEl("section", {
      cls: "myblog-publish-delivery__manifest myblog-publish-delivery__manifest--sealed",
    });
    manifest.setAttr("aria-label", "已交付发布提交原子路径清单");
    manifest.createEl("p", {
      cls: "myblog-publish-delivery__manifest-label",
      text: `DELIVERED ENVELOPE / ${publication.changes.length} PATHS`,
    });
    const target = publication.changes.find(
      (change) => change.path === publication.targetPath,
    );
    const attachments = publication.changes.filter((change) =>
      change.path.startsWith(`public/uploads/${publication.slug}/`),
    );
    const inbox = publication.changes.find(
      (change) => change.path === publication.inboxSourcePath,
    );
    createPublishManifestItem(manifest, "NOTE / ADDED", target);
    attachments.forEach((change, index) => {
      createPublishManifestItem(
        manifest,
        `MEDIA ${String(index + 1).padStart(2, "0")} / ADDED`,
        change,
      );
    });
    if (inbox) createPublishManifestItem(manifest, "INBOX / DELETED", inbox);

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-publish-delivery__ledger",
    });
    createPublishDeliveryRow(ledger, "交付状态", "DELIVERED / SYNCHRONIZED", {
      state: "synchronized",
    });
    createPublishDeliveryRow(ledger, "内容标题", publication.title);
    createPublishDeliveryRow(ledger, "commit", publication.commitOid, {
      code: true,
    });
    createPublishDeliveryRow(ledger, "tree", publication.treeOid, {
      code: true,
    });
    createPublishDeliveryRow(ledger, "target blob", publication.targetBlobOid, {
      code: true,
    });
    createPublishDeliveryRow(ledger, "精确 refspec", receipt.transition.command, {
      code: true,
    });

    const stability = contentEl.createEl("p", {
      cls: "myblog-publish-delivery-receipt__stability",
    });
    stability.createEl("span", { text: "HEAD STABLE" });
    stability.createEl("span", { text: "INDEX STABLE" });
    stability.createEl("span", { text: "WORKTREE STABLE" });
    stability.createEl("span", { text: "MANIFEST STABLE" });
    contentEl.createEl("p", {
      cls: "myblog-publish-delivery__note",
      text: "local main 与最后观察到的 origin/main 已对齐到同一发布提交；线上部署仍由 GitHub 与 Vercel 的独立检查确认。",
    });
  }
}

class ContentReviewDeliveryReceiptModal extends Modal {
  constructor(app, receipt) {
    super(app);
    this.receipt = receipt;
  }

  onOpen() {
    const { contentEl, receipt } = this;
    contentEl.empty();
    contentEl.addClass("myblog-review-delivery-receipt");
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__eyebrow",
      text: "DELIVERY RECEIPT / SYNCHRONIZED",
    });
    contentEl.createEl("h2", {
      cls: "myblog-review-delivery__title",
      text: "正式内容复核已重新同步",
    });
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__boundary",
      text: "已把验证过的精确 commit 推送到 origin/main；未执行 fetch、rebase、reset，也未修改 index 或工作区。",
    });

    const transition = contentEl.createEl("section", {
      cls: "myblog-review-delivery__transition",
    });
    transition.setAttr("aria-label", "已验证本地提交精确送达到 origin/main");
    const local = transition.createEl("div", {
      cls: "myblog-review-delivery__node",
    });
    local.createEl("span", { text: "VERIFIED LOCAL COMMIT" });
    local.createEl("code", {
      text: shortGitObjectId(receipt.transition.before.localHead),
    });
    const track = transition.createEl("div", {
      cls: "myblog-review-delivery__track myblog-review-delivery__track--sealed",
    });
    track.createEl("span", { text: "SEALED PUSH" });
    const tracking = transition.createEl("div", {
      cls: "myblog-review-delivery__node myblog-review-delivery__node--local",
    });
    tracking.createEl("span", { text: "ORIGIN/MAIN · OBSERVED AFTER PUSH" });
    tracking.createEl("code", {
      text: shortGitObjectId(receipt.transition.after.trackingHead),
    });

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-review-delivery__ledger",
    });
    createDeliveryRow(ledger, "交付状态", "DELIVERED / SYNCHRONIZED", {
      state: "synchronized",
    });
    createDeliveryRow(ledger, "正式内容", receipt.review.sourcePath, {
      code: true,
    });
    createDeliveryRow(ledger, "commit", receipt.review.commitOid, { code: true });
    createDeliveryRow(ledger, "tree", receipt.review.treeOid, { code: true });
    createDeliveryRow(ledger, "content blob", receipt.review.blobOid, {
      code: true,
    });
    createDeliveryRow(ledger, "精确 refspec", receipt.transition.command, {
      code: true,
    });

    const stability = contentEl.createEl("p", {
      cls: "myblog-review-delivery-receipt__stability",
    });
    stability.createEl("span", { text: "HEAD STABLE" });
    stability.createEl("span", { text: "INDEX STABLE" });
    stability.createEl("span", { text: "WORKTREE STABLE" });
    contentEl.createEl("p", {
      cls: "myblog-review-delivery__note",
      text: "local main 与最后观察到的 origin/main 已对齐到同一复核提交；线上部署仍由 GitHub 与 Vercel 的独立检查确认。",
    });
  }
}

class ContentReviewProofModal extends Modal {
  constructor(app, proof) {
    super(app);
    this.proof = proof;
  }

  onOpen() {
    const { contentEl, proof } = this;
    const { review } = proof;
    contentEl.empty();
    contentEl.addClass("myblog-review-proof");
    contentEl.createEl("p", {
      cls: "myblog-review-proof__eyebrow",
      text: "AUTHOR PROOF / CHECKED",
    });
    contentEl.createEl("h2", {
      cls: "myblog-review-proof__title",
      text: "正式内容复核证据",
    });
    contentEl.createEl("p", {
      cls: "myblog-review-proof__boundary",
      text: "只读检查已通过；尚未暂存、提交或推送。",
    });
    contentEl.createEl("h3", {
      cls: "myblog-review-proof__content-title",
      text: review.title,
    });
    const source = contentEl.createEl("p", {
      cls: "myblog-review-proof__source",
    });
    source.createEl("code", { text: review.sourcePath });

    const transition = contentEl.createEl("section", {
      cls: "myblog-review-proof__transition",
    });
    transition.setAttr("aria-label", "复核日期从 HEAD 推进到当前笔记");
    const previous = transition.createEl("div", {
      cls: "myblog-review-proof__date-node",
    });
    previous.createEl("span", { text: "HEAD 复核日" });
    previous.createEl("time", { text: review.previousReviewedAt });
    const track = transition.createEl("div", {
      cls: "myblog-review-proof__track",
    });
    track.setAttr("aria-hidden", "true");
    track.createEl("span", { text: "→" });
    const current = transition.createEl("div", {
      cls: "myblog-review-proof__date-node myblog-review-proof__date-node--current",
    });
    current.createEl("span", { text: "当前复核日" });
    current.createEl("time", { text: review.reviewedAt });

    const ledger = contentEl.createEl("dl", {
      cls: "myblog-review-proof__ledger",
    });
    createProofRow(
      ledger,
      "事实变化",
      review.substantiveChanged
        ? "有 · updatedAt 已同步"
        : "无 · 仅推进 reviewedAt",
      { state: review.substantiveChanged ? "changed" : "review-only" },
    );
    createProofRow(
      ledger,
      "updatedAt",
      review.updatedAt ?? "未设置",
      { code: true },
    );
    createProofRow(ledger, "质量门", "npm run check · passed", {
      state: "passed",
    });
    createCandidateProofRow(ledger, proof.candidate);
    createProofRow(
      ledger,
      "分支与工作区",
      `main · index 0 · deferred ${proof.git.deferredPaths.length}`,
    );
    createDeferredProofRow(ledger, proof.git);
    createProofRow(
      ledger,
      "唯一可提交路径",
      proof.git.committablePaths[0],
      { code: true },
    );
    contentEl.createEl("p", {
      cls: "myblog-review-proof__next",
      text: "确认以上证据后，仍需单独运行“提交并同步当前正式内容复核”。",
    });
  }
}

class ContentMaintenanceModal extends Modal {
  constructor(app, report, openSource) {
    super(app);
    this.report = report;
    this.openSource = openSource;
  }

  onOpen() {
    const { contentEl, report } = this;
    contentEl.empty();
    contentEl.addClass("myblog-maintenance");
    contentEl.createEl("h2", {
      cls: "myblog-maintenance__title",
      text: "已发布内容复核台账",
    });
    contentEl.createEl("p", {
      cls: "myblog-maintenance__boundary",
      text: "只读证据视图；Git 内容文件仍是唯一事实源。打开笔记不会修改 reviewedAt，也不会提交或推送。",
    });
    contentEl.createEl("p", {
      cls: "myblog-maintenance__stamp",
      text: `结构版本 v${report.version} · 报告日期 ${report.buildDate} · 最长复核周期 ${report.maxAgeDays} 天`,
    });

    const scope = contentEl.createEl("dl", {
      cls: "myblog-maintenance__scope",
    });
    createMetric(scope, "持续复核", report.currentCount);
    createMetric(scope, "历史快照", report.historicalCount);
    createMetric(scope, "未公开", report.excludedCount);

    const horizon = contentEl.createEl("section", {
      cls: "myblog-maintenance__horizon",
    });
    horizon.createEl("p", {
      cls: "myblog-maintenance__section-label",
      text: `期限分布 · ${report.thresholds.reviewSoonDays} 天进入复核窗口 · ${report.thresholds.dueSoonDays} 天进入到期提醒`,
    });
    const trace = horizon.createEl("ol", {
      cls: "myblog-maintenance__trace",
    });
    for (const status of MAINTENANCE_STATUSES) {
      const item = trace.createEl("li", {
        cls: "myblog-maintenance__trace-item",
      });
      item.setAttr("data-status", status);
      item.createEl("span", { text: STATUS_LABELS[status] });
      item.createEl("strong", { text: String(report.counts[status]) });
    }

    const records = contentEl.createEl("section", {
      cls: "myblog-maintenance__records-section",
    });
    records.createEl("p", {
      cls: "myblog-maintenance__section-label",
      text: `复核期限台账 · ${report.records.length} 项`,
    });
    if (report.records.length === 0) {
      records.createEl("p", {
        cls: "myblog-maintenance__empty",
        text: "当前没有已发布内容需要纳入复核。",
      });
    } else {
      const list = records.createEl("ol", {
        cls: "myblog-maintenance__records",
      });
      for (const record of report.records) {
        const item = list.createEl("li", {
          cls: "myblog-maintenance__record",
        });
        item.setAttr("data-status", record.status);
        const statusLine = item.createEl("div", {
          cls: "myblog-maintenance__record-status",
        });
        statusLine.createEl("span", { text: STATUS_LABELS[record.status] });
        statusLine.createEl("strong", {
          text: remainingLabel(record.remainingDays),
        });
        item.createEl("h3", {
          cls: "myblog-maintenance__record-title",
          text: record.title,
        });
        item.createEl("p", {
          cls: "myblog-maintenance__route",
          text: `${record.kind === "post" ? "文章" : "项目"} · ${record.url}`,
        });
        const dates = item.createEl("dl", {
          cls: "myblog-maintenance__dates",
        });
        createMetric(dates, "最近复核", record.reviewedAt);
        createMetric(dates, "最后有效日", record.reviewBy);
        createMetric(dates, "已运行", `${record.ageDays} 天`);
        const source = item.createEl("p", {
          cls: "myblog-maintenance__source",
        });
        source.createEl("span", { text: "来源 " });
        source.createEl("code", { text: record.sourcePath });
        const button = item.createEl("button", {
          cls: "mod-cta myblog-maintenance__open",
          text: "打开笔记",
        });
        button.setAttr("type", "button");
        button.setAttr("aria-label", `打开 ${record.sourcePath}`);
        button.addEventListener("click", () =>
          this.openSource(record.sourcePath, this),
        );
      }
    }

    const checklist = contentEl.createEl("details", {
      cls: "myblog-maintenance__checklist",
    });
    checklist.createEl("summary", {
      text: `复核清单（${report.reviewChecklist.length}）`,
    });
    const checklistItems = checklist.createEl("ol");
    for (const item of report.reviewChecklist) {
      checklistItems.createEl("li", { text: item });
    }
  }
}

module.exports = class MyBlogPublisher extends Plugin {
  onload() {
    this.activeRuns = new Map();

    this.addCommand({
      id: "validate-current-note",
      name: "检查当前草稿",
      checkCallback: (checking) => this.publishCurrentNote(checking, false),
    });

    this.addCommand({
      id: "publish-current-note",
      name: "发布当前草稿并同步 GitHub",
      checkCallback: (checking) => this.publishCurrentNote(checking, true),
    });

    this.addCommand({
      id: "validate-current-published-note",
      name: "检查当前正式内容复核",
      checkCallback: (checking) =>
        this.reviewCurrentPublishedNote(checking, false),
    });

    this.addCommand({
      id: "review-current-published-note",
      name: "提交并同步当前正式内容复核",
      checkCallback: (checking) =>
        this.reviewCurrentPublishedNote(checking, true),
    });

    this.addCommand({
      id: "inspect-inbox-readiness",
      name: "查看全部草稿发布就绪状态",
      checkCallback: (checking) => this.inspectInboxReadiness(checking),
    });

    this.addCommand({
      id: "inspect-published-maintenance",
      name: "查看已发布内容复核台账",
      checkCallback: (checking) => this.inspectPublishedMaintenance(checking),
    });

    this.addCommand({
      id: "inspect-review-delivery",
      name: "查看待同步正式内容复核",
      checkCallback: (checking) => this.inspectReviewDelivery(checking),
    });

    this.addCommand({
      id: "inspect-publish-delivery",
      name: "查看待同步新内容发布",
      checkCallback: (checking) => this.inspectPublishDelivery(checking),
    });

    this.addCommand({
      id: "deliver-pending-review",
      name: "重新同步待交付正式内容复核",
      checkCallback: (checking) => this.deliverPendingReview(checking),
    });

    this.addCommand({
      id: "deliver-pending-publication",
      name: "重新同步待交付新内容发布",
      checkCallback: (checking) => this.deliverPendingPublication(checking),
    });
  }

  onunload() {
    for (const [child, run] of [...this.activeRuns]) {
      run.cancel();
      this.terminateChild(child);
    }
    this.activeRuns.clear();
  }

  terminateChild(child) {
    const killDirectly = () => {
      try {
        child.kill();
      } catch {
        // The process may already have exited between the snapshot and kill.
      }
    };

    if (process.platform !== "win32" || !Number.isInteger(child.pid)) {
      killDirectly();
      return;
    }

    try {
      const killer = spawn(
        "taskkill.exe",
        ["/pid", String(child.pid), "/t", "/f"],
        { shell: false, stdio: "ignore", windowsHide: true },
      );
      killer.on("error", killDirectly);
    } catch {
      killDirectly();
    }
  }

  isDesktopVault() {
    return this.app.vault.adapter instanceof FileSystemAdapter;
  }

  runRepositoryCommand(npmArgs, messages, onSuccess) {
    const root = this.app.vault.adapter.getBasePath();
    const executable = process.platform === "win32"
      ? (process.env.ComSpec || "cmd.exe")
      : "npm";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npm", ...npmArgs]
      : npmArgs;
    const progressNotice = new Notice(messages.progress, 0);

    let child;
    try {
      child = spawn(executable, args, {
        cwd: root,
        windowsHide: true,
        shell: false,
      });
    } catch (error) {
      progressNotice.hide();
      new Notice(`${messages.startFailure}: ${error.message}`, 10000);
      return true;
    }

    let output = "";
    let outputTruncated = false;
    let settled = false;
    const appendOutput = (chunk) => {
      if (output.length >= MAX_CAPTURED_OUTPUT) {
        outputTruncated = true;
        return;
      }
      const text = chunk.toString();
      const remaining = MAX_CAPTURED_OUTPUT - output.length;
      output += text.slice(0, remaining);
      if (text.length > remaining) outputTruncated = true;
    };
    const report = () => {
      const captured = output.trim();
      if (!outputTruncated) return captured;
      return `${captured}\n[plugin] 输出超过 ${MAX_CAPTURED_OUTPUT} 字符，后续内容已截断。`;
    };
    const cancel = () => {
      if (settled) return false;
      settled = true;
      progressNotice.hide();
      this.activeRuns.delete(child);
      return true;
    };

    this.activeRuns.set(child, { cancel, progressNotice });
    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    child.on("error", (error) => {
      if (!cancel()) return;
      new Notice(`${messages.startFailure}: ${error.message}`, 10000);
    });
    child.on("close", (code) => {
      if (!cancel()) return;
      const allowedExitCodes = messages.allowedExitCodes ?? [0];
      if (allowedExitCodes.includes(code)) {
        try {
          onSuccess(report(), code);
          if (messages.success) {
            new Notice(messages.success, messages.successDuration ?? 5000);
          }
        } catch (error) {
          new Notice(`${messages.failure}: ${error.message}`, 15000);
        }
        return;
      }
      const summary = report().split(/\r?\n/u).slice(-4).join("\n");
      new Notice(
        `${messages.failure}:\n${summary || `命令退出码 ${code}`}`,
        15000,
      );
    });
    return true;
  }

  inspectInboxReadiness(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;

    return this.runRepositoryCommand(
      ["--silent", "run", "content:inbox"],
      {
        failure: "收件箱检查未完成",
        progress: "正在检查全部收件箱草稿…",
        startFailure: "收件箱检查无法启动",
        success: "收件箱检查完成。",
      },
      (report) => new InboxReadinessModal(this.app, report).open(),
    );
  }

  inspectPublishedMaintenance(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;

    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:status",
        "--",
        "--format",
        "json",
      ],
      {
        allowedExitCodes: [0, 1],
        failure: "内容复核检查未完成",
        progress: "正在读取结构化复核台账…",
        startFailure: "内容复核检查无法启动",
      },
      (output) => this.openStructuredMaintenance(output),
    );
  }

  inspectReviewDelivery(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:review:status",
        "--",
        "--format",
        "json",
      ],
      {
        allowedExitCodes: [0, 1],
        failure: "正式复核交付状态检查未完成",
        progress: "正在读取本地正式复核交付证据…",
        startFailure: "正式复核交付状态命令无法启动",
      },
      (output) => this.openStructuredReviewDelivery(output),
    );
  }

  openStructuredReviewDelivery(output) {
    try {
      const report = parseContentReviewDeliveryReport(output);
      new ContentReviewDeliveryModal(this.app, report).open();
      new Notice("正式内容复核交付状态已更新。", 5000);
    } catch (error) {
      new Notice(
        `结构化交付证据不可用：${error.message}。正在重新读取本地纯文本证据…`,
        10000,
      );
      this.inspectReviewDeliveryText();
    }
  }

  inspectReviewDeliveryText() {
    return this.runRepositoryCommand(
      ["--silent", "run", "content:review:status"],
      {
        allowedExitCodes: [0, 1],
        failure: "纯文本正式复核交付证据未完成",
        progress: "正在读取本地纯文本交付证据…",
        startFailure: "纯文本正式复核交付状态命令无法启动",
        success: "已打开纯文本正式复核交付证据。",
      },
      (report) => new ContentReviewDeliveryTextModal(this.app, report).open(),
    );
  }

  inspectPublishDelivery(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:publish:status",
        "--",
        "--format",
        "json",
      ],
      {
        allowedExitCodes: [0, 1],
        failure: "新内容发布交付状态检查未完成",
        progress: "正在读取本地新内容发布交付证据…",
        startFailure: "新内容发布交付状态命令无法启动",
      },
      (output) => this.openStructuredPublishDelivery(output),
    );
  }

  openStructuredPublishDelivery(output) {
    try {
      const report = parseContentPublishDeliveryReport(output);
      new ContentPublishDeliveryModal(this.app, report).open();
      new Notice("新内容发布交付状态已更新。", 5000);
    } catch (error) {
      new Notice(
        `结构化发布交付证据不可用：${error.message}。正在重新读取本地纯文本证据…`,
        10000,
      );
      this.inspectPublishDeliveryText();
    }
  }

  inspectPublishDeliveryText() {
    return this.runRepositoryCommand(
      ["--silent", "run", "content:publish:status"],
      {
        allowedExitCodes: [0, 1],
        failure: "纯文本新内容发布交付证据未完成",
        progress: "正在读取本地纯文本发布交付证据…",
        startFailure: "纯文本新内容发布交付状态命令无法启动",
        success: "已打开纯文本新内容发布交付证据。",
      },
      (report) => new ContentPublishDeliveryTextModal(this.app, report).open(),
    );
  }

  deliverPendingReview(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:review:deliver",
        "--",
        "--format",
        "json",
      ],
      {
        failure: "待交付正式内容重新同步未完成",
        progress: "正在重新验证并同步精确复核提交…",
        startFailure: "待交付正式内容重新同步命令无法启动",
      },
      (output) => {
        let receipt;
        try {
          receipt = parseContentReviewDeliveryReceipt(output);
        } catch (error) {
          throw new Error(
            `重新同步未能生成可信回执：${error.message}；请运行“查看待同步正式内容复核”重新取证`,
          );
        }
        new ContentReviewDeliveryReceiptModal(this.app, receipt).open();
        this.app.vault.adapter.reconcile?.();
        new Notice("待交付正式内容复核已重新同步。", 8000);
      },
    );
  }

  deliverPendingPublication(checking) {
    if (!this.isDesktopVault()) return false;
    if (checking) return true;
    return this.runRepositoryCommand(
      [
        "--silent",
        "run",
        "content:publish:deliver",
        "--",
        "--format",
        "json",
      ],
      {
        failure: "待交付新内容发布重新同步未完成",
        progress: "正在重新验证并同步精确发布包…",
        startFailure: "待交付新内容发布重新同步命令无法启动",
      },
      (output) => {
        let receipt;
        try {
          receipt = parseContentPublishDeliveryReceipt(output);
        } catch (error) {
          throw new Error(
            `重新同步未能生成可信发布回执：${error.message}；请运行“查看待同步新内容发布”重新取证`,
          );
        }
        new ContentPublishDeliveryReceiptModal(this.app, receipt).open();
        this.app.vault.adapter.reconcile?.();
        new Notice("待交付新内容发布已重新同步。", 8000);
      },
    );
  }

  openStructuredMaintenance(output) {
    try {
      const report = parseMaintenanceReport(output);
      new ContentMaintenanceModal(
        this.app,
        report,
        (sourcePath, modal) => this.openMaintenanceSource(sourcePath, modal),
      ).open();
      new Notice("已发布内容复核台账已更新。", 5000);
    } catch (error) {
      new Notice(
        `结构化复核台账不可用：${error.message}。正在读取纯文本证据…`,
        10000,
      );
      this.inspectPublishedMaintenanceText();
    }
  }

  inspectPublishedMaintenanceText() {
    return this.runRepositoryCommand(
      ["--silent", "run", "content:status"],
      {
        allowedExitCodes: [0, 1],
        failure: "纯文本内容复核证据未完成",
        progress: "正在读取纯文本复核证据…",
        startFailure: "纯文本内容复核检查无法启动",
        success: "已打开纯文本复核证据。",
      },
      (report) => new ContentMaintenanceTextModal(this.app, report).open(),
    );
  }

  async openMaintenanceSource(sourcePath, modal) {
    if (!/^content\/(?:posts|projects)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(sourcePath)) {
      new Notice("维护记录的来源路径不安全，已拒绝打开。", 10000);
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!file || file.path !== sourcePath || file.extension !== "md") {
      new Notice(`找不到可打开的 Markdown 笔记：${sourcePath}`, 10000);
      return;
    }
    try {
      await this.app.workspace.getLeaf(false).openFile(file);
      modal.close();
    } catch (error) {
      new Notice(`笔记打开失败：${error.message}`, 10000);
    }
  }

  reviewCurrentPublishedNote(checking, push) {
    const file = this.app.workspace.getActiveFile();
    const isPublishedNote =
      file?.extension === "md" &&
      /^content\/(?:posts|projects)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(
        file.path,
      );
    if (!isPublishedNote || !this.isDesktopVault()) return false;
    if (checking) return true;

    if (!push) {
      return this.runRepositoryCommand(
        [
          "run",
          "content:review",
          "--",
          file.path,
          "--check-only",
          "--format",
          "json",
        ],
        {
          failure: "正式内容复核未完成",
          progress: "正在执行正式内容完整复核检查…",
          startFailure: "正式内容复核命令无法启动",
        },
        (output) => this.openStructuredContentReview(output, file.path),
      );
    }

    return this.runRepositoryCommand(
      ["run", "content:review", "--", file.path, "--push"],
      {
        failure: "正式内容复核未完成",
        progress: "正在执行完整检查、提交并同步复核…",
        startFailure: "正式内容复核命令无法启动",
        success: "正式内容复核已提交并同步，等待线上部署完成。",
        successDuration: 8000,
      },
      () => this.app.vault.adapter.reconcile?.(),
    );
  }

  openStructuredContentReview(output, sourcePath) {
    try {
      const proof = parseContentReviewProof(output, sourcePath);
      new ContentReviewProofModal(this.app, proof).open();
      new Notice("正式内容 Author Proof 已生成；尚未提交或推送。", 8000);
    } catch (error) {
      new Notice(
        `结构化 Author Proof 不可用：${error.message}。正在重新读取纯文本证据…`,
        10000,
      );
      this.inspectContentReviewText(sourcePath);
    }
  }

  inspectContentReviewText(sourcePath) {
    return this.runRepositoryCommand(
      ["run", "content:review", "--", sourcePath, "--check-only"],
      {
        failure: "纯文本正式内容复核未完成",
        progress: "正在重新执行纯文本正式内容复核…",
        startFailure: "纯文本正式内容复核命令无法启动",
        success: "已打开纯文本正式内容复核证据。",
        successDuration: 8000,
      },
      (report) => new ContentReviewProofTextModal(this.app, report).open(),
    );
  }

  publishCurrentNote(checking, push) {
    const file = this.app.workspace.getActiveFile();
    const isInboxNote =
      file?.extension === "md" &&
      /^content\/inbox\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(file.path);
    if (!isInboxNote || !this.isDesktopVault()) return false;
    if (checking) return true;

    return this.runRepositoryCommand(
      ["run", "content:publish", "--", file.path, push ? "--push" : "--check-only"],
      {
        failure: "发布未完成",
        progress: push ? "正在检查、提交并发布…" : "正在检查当前草稿…",
        startFailure: "发布命令无法启动",
        success: push ? "已提交并同步，等待线上部署完成。" : "草稿通过发布前检查。",
        successDuration: 8000,
      },
      () => this.app.vault.adapter.reconcile?.(),
    );
  }
};
