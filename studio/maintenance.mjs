export const STUDIO_MAINTENANCE_ENDPOINT = "/studio/maintenance.json";

const STATUSES = ["healthy", "review-soon", "due-soon", "overdue"];
const STATUS_LABELS = {
  healthy: "健康",
  "review-soon": "进入复核窗口",
  "due-soon": "即将到期",
  overdue: "已过期",
};
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function expectedRecordUrls(record) {
  const collection = record.kind === "post" ? "posts" : "projects";
  return {
    editUrl: `/studio/#/collections/${collection}/entries/${record.slug}`,
    publicUrl: `/${collection}/${record.slug}`,
  };
}

function isMaintenanceRecord(record) {
  if (!isPlainObject(record)) return false;
  if (!STATUSES.includes(record.status)) return false;
  if (!["post", "project"].includes(record.kind)) return false;
  if (typeof record.title !== "string" || record.title.trim() === "") return false;
  if (typeof record.slug !== "string" || !SLUG_PATTERN.test(record.slug)) return false;
  if (!ISO_DATE_PATTERN.test(record.reviewedAt) || !ISO_DATE_PATTERN.test(record.reviewBy)) return false;
  if (!Number.isSafeInteger(record.remainingDays)) return false;
  const expected = expectedRecordUrls(record);
  return record.editUrl === expected.editUrl && record.publicUrl === expected.publicUrl;
}

export function parseStudioMaintenanceSnapshot(payload) {
  if (!isPlainObject(payload) || payload.version !== 1) {
    throw new Error("Studio 维护队列返回了未知响应。");
  }
  if (!ISO_DATE_PATTERN.test(payload.reportDate) || !isNonNegativeInteger(payload.maxAgeDays)) {
    throw new Error("Studio 维护队列返回了未知响应。");
  }
  if (!isNonNegativeInteger(payload.currentCount) || !isNonNegativeInteger(payload.historicalCount)) {
    throw new Error("Studio 维护队列返回了未知响应。");
  }
  if (!isPlainObject(payload.counts) || !STATUSES.every((status) => isNonNegativeInteger(payload.counts[status]))) {
    throw new Error("Studio 维护队列返回了未知响应。");
  }
  if (
    !isPlainObject(payload.thresholds) ||
    !isNonNegativeInteger(payload.thresholds.reviewSoonDays) ||
    !isNonNegativeInteger(payload.thresholds.dueSoonDays) ||
    payload.thresholds.dueSoonDays > payload.thresholds.reviewSoonDays ||
    payload.thresholds.reviewSoonDays > payload.maxAgeDays
  ) {
    throw new Error("Studio 维护队列返回了未知响应。");
  }
  if (!Array.isArray(payload.records) || !payload.records.every(isMaintenanceRecord)) {
    throw new Error("Studio 维护队列返回了未知响应。");
  }
  if (!Array.isArray(payload.reviewChecklist) || !payload.reviewChecklist.every((item) => typeof item === "string" && item.trim() !== "")) {
    throw new Error("Studio 维护队列返回了未知响应。");
  }
  if (payload.records.length !== payload.currentCount) {
    throw new Error("Studio 维护队列返回了未知响应。");
  }
  const countTotal = STATUSES.reduce((total, status) => total + payload.counts[status], 0);
  if (
    countTotal !== payload.currentCount ||
    !STATUSES.every(
      (status) => payload.records.filter((record) => record.status === status).length === payload.counts[status],
    )
  ) {
    throw new Error("Studio 维护队列返回了未知响应。");
  }
  return payload;
}

export async function requestStudioMaintenance({ fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== "function") {
    throw new Error("Studio 维护队列缺少 fetch 运行时。");
  }
  const response = await fetcher(STUDIO_MAINTENANCE_ENDPOINT, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`Studio 维护队列暂不可用（HTTP ${response.status}）。`);
  }
  return parseStudioMaintenanceSnapshot(await response.json());
}

export function formatStudioMaintenanceRemaining(remainingDays) {
  return remainingDays >= 0
    ? `剩余 ${remainingDays} 天`
    : `逾期 ${Math.abs(remainingDays)} 天`;
}

export function createStudioMaintenanceView(snapshot) {
  const records = snapshot.records.map((record) => ({
    ...record,
    kindLabel: record.kind === "post" ? "文章 / TIL" : "项目",
    remainingLabel: formatStudioMaintenanceRemaining(record.remainingDays),
    statusLabel: STATUS_LABELS[record.status],
  }));
  if (records.length === 0) {
    return {
      records,
      state: "empty",
      summary: "当前没有需要持续复核的公开内容。Historical 快照仍保留，但不进入周期队列。",
    };
  }
  const attention = snapshot.counts.overdue + snapshot.counts["due-soon"] + snapshot.counts["review-soon"];
  return {
    records,
    state: "ready",
    summary: `${snapshot.currentCount} 条 Current · ${attention} 条进入复核视野 · ${snapshot.historicalCount} 条 Historical 不计时`,
  };
}

function setText(documentRef, selector, value) {
  const element = documentRef.querySelector(selector);
  if (element) element.textContent = value;
}

function makeDefinition(documentRef, label, value) {
  const wrapper = documentRef.createElement("div");
  const term = documentRef.createElement("dt");
  const detail = documentRef.createElement("dd");
  term.textContent = label;
  detail.textContent = value;
  wrapper.append(term, detail);
  return wrapper;
}

function makeRecord(documentRef, record) {
  const item = documentRef.createElement("li");
  item.className = "maintenance-record";
  item.dataset.state = record.status;

  const signal = documentRef.createElement("div");
  signal.className = "maintenance-record-signal";
  const status = documentRef.createElement("span");
  status.textContent = record.statusLabel;
  const remaining = documentRef.createElement("strong");
  remaining.textContent = record.remainingLabel;
  signal.append(status, remaining);

  const body = documentRef.createElement("div");
  body.className = "maintenance-record-body";
  const kind = documentRef.createElement("p");
  kind.textContent = `${record.kindLabel} / ${record.slug}`;
  const title = documentRef.createElement("h2");
  title.textContent = record.title;
  const dates = documentRef.createElement("dl");
  dates.append(
    makeDefinition(documentRef, "最近复核", record.reviewedAt),
    makeDefinition(documentRef, "最后有效日", record.reviewBy),
  );
  body.append(kind, title, dates);

  const actions = documentRef.createElement("nav");
  actions.className = "maintenance-record-actions";
  actions.setAttribute("aria-label", `${record.title} 操作`);
  const edit = documentRef.createElement("a");
  edit.href = record.editUrl;
  edit.textContent = "进入编辑";
  const view = documentRef.createElement("a");
  view.href = record.publicUrl;
  view.textContent = "查看公开页";
  actions.append(edit, view);

  item.append(signal, body, actions);
  return item;
}

export function renderStudioMaintenance(documentRef, snapshot) {
  const view = createStudioMaintenanceView(snapshot);
  const root = documentRef.documentElement;
  root.dataset.maintenanceState = view.state;
  setText(documentRef, "[data-report-date]", snapshot.reportDate);
  setText(documentRef, "[data-current-count]", String(snapshot.currentCount));
  setText(documentRef, "[data-historical-count]", String(snapshot.historicalCount));
  setText(documentRef, "[data-maintenance-summary]", view.summary);
  for (const status of STATUSES) {
    setText(documentRef, `[data-count="${status}"]`, String(snapshot.counts[status]));
  }

  const records = documentRef.querySelector("[data-maintenance-records]");
  records?.replaceChildren(...view.records.map((record) => makeRecord(documentRef, record)));
  const checklist = documentRef.querySelector("[data-maintenance-checklist]");
  checklist?.replaceChildren(
    ...snapshot.reviewChecklist.map((text) => {
      const item = documentRef.createElement("li");
      item.textContent = text;
      return item;
    }),
  );

  const retry = documentRef.querySelector("[data-maintenance-retry]");
  if (retry) retry.hidden = true;
  return view;
}

function renderStudioMaintenanceFailure(documentRef) {
  documentRef.documentElement.dataset.maintenanceState = "unavailable";
  setText(
    documentRef,
    "[data-maintenance-summary]",
    "维护证据没有加载；内容没有变化。请重试，或使用 npm run content:status 查看同一队列。",
  );
  const records = documentRef.querySelector("[data-maintenance-records]");
  records?.replaceChildren();
  const retry = documentRef.querySelector("[data-maintenance-retry]");
  if (retry) retry.hidden = false;
}

export function installStudioMaintenance({
  documentRef = globalThis.document,
  fetcher = globalThis.fetch,
} = {}) {
  if (!documentRef) return undefined;
  let controller;
  let generation = 0;

  const refresh = async () => {
    controller?.abort();
    controller = typeof AbortController === "function" ? new AbortController() : undefined;
    generation += 1;
    const activeGeneration = generation;
    documentRef.documentElement.dataset.maintenanceState = "loading";
    setText(documentRef, "[data-maintenance-summary]", "正在读取当前部署的公开内容复核证据…");
    try {
      const snapshot = await requestStudioMaintenance({
        fetcher: (url, options) => fetcher(url, { ...options, signal: controller?.signal }),
      });
      if (activeGeneration !== generation) return;
      renderStudioMaintenance(documentRef, snapshot);
    } catch (error) {
      if (error?.name === "AbortError" || activeGeneration !== generation) return;
      renderStudioMaintenanceFailure(documentRef);
    }
  };

  documentRef.querySelector("[data-maintenance-retry]")?.addEventListener("click", refresh);
  void refresh();
  return { refresh };
}

if (typeof document !== "undefined") {
  installStudioMaintenance();
}
