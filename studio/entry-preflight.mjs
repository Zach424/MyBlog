export const STUDIO_ENTRY_PREFLIGHT_ENDPOINT = "/studio/entry-preflight";
export const STUDIO_ENTRY_PREFLIGHT_DELAY_MS = 320;

const SHARED_FIELDS = [
  "title",
  "slug",
  "description",
  "publishedAt",
  "updatedAt",
  "freshness",
  "reviewedAt",
  "tags",
  "draft",
  "featured",
  "cover",
  "coverAlt",
];

export const STUDIO_ENTRY_FIELDS = Object.freeze({
  posts: [...SHARED_FIELDS.slice(0, 3), "type", ...SHARED_FIELDS.slice(3), "series", "canonical", "body"],
  projects: [
    ...SHARED_FIELDS.slice(0, 7),
    "status",
    "stack",
    ...SHARED_FIELDS.slice(7),
    "repository",
    "demo",
    "body",
  ],
});

const OPTIONAL_FIELDS = new Set([
  "updatedAt",
  "series",
  "canonical",
  "cover",
  "coverAlt",
  "repository",
  "demo",
]);

const FIELD_LABELS = {
  body: "正文",
  canonical: "Canonical URL",
  cover: "封面",
  coverAlt: "封面替代文本",
  demo: "演示地址",
  description: "摘要",
  draft: "草稿状态",
  featured: "首页精选",
  freshness: "内容语境",
  frontmatter: "条目字段",
  publishedAt: "发布日期",
  repository: "源码地址",
  reviewedAt: "复核日期",
  series: "专题",
  slug: "稳定 Slug",
  stack: "技术栈",
  status: "项目状态",
  tags: "标签",
  title: "标题",
  type: "文章类型",
  updatedAt: "更新日期",
};

function toPlainValue(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (value && typeof value.toJS === "function") return toPlainValue(value.toJS());
  if (Array.isArray(value)) return value.map(toPlainValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, toPlainValue(child)]),
    );
  }
  return value;
}

function isEmptyOptional(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (value && typeof value === "object" && Object.keys(value).length === 0)
  );
}

export function readStudioEntryField(props, field) {
  return toPlainValue(props?.entry?.getIn?.(["data", field]));
}

export function serializeStudioEntry(props, collection) {
  const names = STUDIO_ENTRY_FIELDS[collection];
  if (!names) throw new Error("Studio 条目预检遇到未知集合。");
  const fields = {};
  for (const name of names) {
    const value = readStudioEntryField(props, name);
    if (OPTIONAL_FIELDS.has(name) && isEmptyOptional(value)) continue;
    if (value !== undefined) fields[name] = value;
  }
  return fields;
}

export function studioEntrySignature(props, collection) {
  return JSON.stringify(serializeStudioEntry(props, collection));
}

export function studioEntryFieldLabel(field) {
  const root = typeof field === "string" ? field.split(".")[0] : "frontmatter";
  return FIELD_LABELS[root] || root;
}

export async function requestStudioEntryPreflight(
  collection,
  fields,
  { fetcher = globalThis.fetch, signal } = {},
) {
  if (typeof fetcher !== "function") {
    throw new Error("Studio 条目预检缺少 fetch 运行时。");
  }
  const response = await fetcher(STUDIO_ENTRY_PREFLIGHT_ENDPOINT, {
    body: JSON.stringify({ collection, fields }),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal,
  });
  const payload = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.ok !== "boolean" ||
    !Array.isArray(payload.issues) ||
    !Array.isArray(payload.facts)
  ) {
    throw new Error("Studio 条目预检返回了未知响应。");
  }
  if (!response.ok && response.status !== 422) {
    throw new Error(payload.message || `Studio 条目预检失败（HTTP ${response.status}）。`);
  }
  return payload;
}

export function getStudioEntryPreflightStatus(state) {
  switch (state?.entryStatus) {
    case "checking":
      return {
        detail: "只读检查当前条目字段；输入停顿后会自动刷新。",
        label: "ENTRY CONTRACT / CHECKING",
        title: "正在核对发布清单",
      };
    case "ready":
      return {
        detail: state.entryNote,
        label: "ENTRY CONTRACT / READY",
        title: "当前条目字段已就绪",
      };
    case "invalid":
      return {
        detail: state.entryNote,
        label: "ENTRY CONTRACT / NEEDS WORK",
        title: `${state.entryIssueCount || state.entryIssues?.length || 0} 项需要处理`,
      };
    case "unavailable":
      return {
        detail: "内容没有丢失；请稍后重试。保存后的完整构建仍会执行权威检查。",
        label: "ENTRY CONTRACT / PREVIEW UNAVAILABLE",
        title: "发布清单暂不可用",
      };
    default:
      return {
        detail: "正在整理当前条目的字段证据。",
        label: "ENTRY CONTRACT / PREPARING",
        title: "准备发布清单",
      };
  }
}
