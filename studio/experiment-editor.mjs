export const STUDIO_EXPERIMENT_EDITOR_ID = "myblog-experiment";
export const STUDIO_EXPERIMENT_MIN_MEASUREMENTS = 1;
export const STUDIO_EXPERIMENT_MAX_MEASUREMENTS = 8;
export const STUDIO_EXPERIMENT_MIN_LIMITATIONS = 1;
export const STUDIO_EXPERIMENT_MAX_LIMITATIONS = 6;
export const STUDIO_EXPERIMENT_STATUSES = [
  "SUPPORTED",
  "REFUTED",
  "INCONCLUSIVE",
  "FAILED",
];

const MEASUREMENT_PATTERN_SOURCE = String.raw`> - \*\*[^*\r\n]{1,120}\*\* \x60[^\x60\r\n]{1,80}\x60 — [^\r\n]{1,400}`;
const LIMITATION_PATTERN_SOURCE = String.raw`> - \*\*[^*\r\n]{1,120}\*\* — [^\r\n]{1,400}`;
const MEASUREMENT_SOURCE = String.raw`> - \*\*([^*\r\n]{1,120})\*\* \x60([^\x60\r\n]{1,80})\x60 — ([^\r\n]{1,400})`;
const LIMITATION_SOURCE = String.raw`> - \*\*([^*\r\n]{1,120})\*\* — ([^\r\n]{1,400})`;

export const STUDIO_EXPERIMENT_PATTERN = new RegExp(
  String.raw`^> \[!experiment\] ([^\[\]\r\n]{1,120})\r?\n> \*\*STATUS:\*\* \x60(SUPPORTED|REFUTED|INCONCLUSIVE|FAILED)\x60 · \*\*DATE:\*\* \x60(\d{4}-\d{2}-\d{2})\x60\r?\n>\r?\n> \*\*HYPOTHESIS\*\*\r?\n>\r?\n> ([^\r\n]{1,800})\r?\n>\r?\n> \*\*ENVIRONMENT\*\*\r?\n>\r?\n> ([^\r\n]{1,800})\r?\n>\r?\n> \*\*METHOD\*\*\r?\n>\r?\n> ([^\r\n]{1,800})\r?\n>\r?\n> \*\*SAMPLE\*\*\r?\n>\r?\n> ([^\r\n]{1,800})\r?\n>\r?\n> \*\*MEASUREMENTS\*\*\r?\n>\r?\n((?:${MEASUREMENT_PATTERN_SOURCE}(?:\r?\n|$)){1,8})>\r?\n> \*\*CONCLUSION\*\*\r?\n>\r?\n> ([^\r\n]{1,800})\r?\n>\r?\n> \*\*LIMITATIONS\*\*\r?\n>\r?\n((?:${LIMITATION_PATTERN_SOURCE}(?:\r?\n|$)){1,6})(?!> - \*\*)`,
  "imu",
);

const REGISTRATION_KEY = "__MYBLOG_EXPERIMENT_EDITOR_COMPONENT__";
const STATUSES = new Set(STUDIO_EXPERIMENT_STATUSES);

function plainValue(value) {
  return value && typeof value.toJS === "function" ? value.toJS() : value;
}

function normalizeList(value, fields) {
  const raw = plainValue(value);
  if (!Array.isArray(raw)) return [];
  return raw.map((candidate) => {
    const item = plainValue(candidate) ?? {};
    return Object.fromEntries(
      fields.map((field) => [field, typeof item[field] === "string" ? item[field].trim() : ""]),
    );
  });
}

function normalizedData(data) {
  const value = plainValue(data) ?? {};
  return {
    conclusion: typeof value.conclusion === "string" ? value.conclusion.trim() : "",
    date: typeof value.date === "string" ? value.date.trim() : "",
    environment: typeof value.environment === "string" ? value.environment.trim() : "",
    hypothesis: typeof value.hypothesis === "string" ? value.hypothesis.trim() : "",
    limitations: normalizeList(value.limitations, ["title", "description"]),
    measurements: normalizeList(value.measurements, ["label", "value", "description"]),
    method: typeof value.method === "string" ? value.method.trim() : "",
    sample: typeof value.sample === "string" ? value.sample.trim() : "",
    status: typeof value.status === "string" ? value.status.trim() : "",
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function isRealIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateCopy(value, label, maximum = 800) {
  if (!value || value.length > maximum || /[\r\n]/u.test(value)) {
    throw new Error(`${label} 必须是 1–${maximum} 字符的单行内容。`);
  }
  if (/!\[|<[^>]+>|\[\^/u.test(value)) {
    throw new Error(`${label} 不能包含图片、HTML 或脚注。`);
  }
}

function uniqueKeys(items, field, label) {
  const keys = items.map((item) => item[field].normalize("NFKC").toLocaleLowerCase("zh-CN"));
  if (new Set(keys).size !== keys.length) throw new Error(`同一技术实验不能包含名称重复的${label}。`);
}

function validateExperiment(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("技术实验标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (!STATUSES.has(normalized.status)) {
    throw new Error(`技术实验状态只允许 ${STUDIO_EXPERIMENT_STATUSES.join(" / ")}。`);
  }
  if (!isRealIsoDate(normalized.date)) {
    throw new Error("技术实验日期必须是真实的 YYYY-MM-DD。");
  }
  for (const [label, value] of [
    ["假设", normalized.hypothesis],
    ["环境", normalized.environment],
    ["方法", normalized.method],
    ["样本", normalized.sample],
    ["结论", normalized.conclusion],
  ]) validateCopy(value, label);
  if (
    normalized.measurements.length < STUDIO_EXPERIMENT_MIN_MEASUREMENTS ||
    normalized.measurements.length > STUDIO_EXPERIMENT_MAX_MEASUREMENTS
  ) {
    throw new Error(`测量必须包含 ${STUDIO_EXPERIMENT_MIN_MEASUREMENTS}–${STUDIO_EXPERIMENT_MAX_MEASUREMENTS} 项。`);
  }
  if (
    normalized.limitations.length < STUDIO_EXPERIMENT_MIN_LIMITATIONS ||
    normalized.limitations.length > STUDIO_EXPERIMENT_MAX_LIMITATIONS
  ) {
    throw new Error(`局限必须包含 ${STUDIO_EXPERIMENT_MIN_LIMITATIONS}–${STUDIO_EXPERIMENT_MAX_LIMITATIONS} 项。`);
  }
  normalized.measurements.forEach((item, index) => {
    if (!item.label || item.label.length > 120 || /[*\r\n]/u.test(item.label)) {
      throw new Error(`第 ${index + 1} 项测量名称必须是 1–120 字符的单行文本，且不能包含 *。`);
    }
    if (!item.value || item.value.length > 80 || /[`\r\n]/u.test(item.value)) {
      throw new Error(`第 ${index + 1} 项测量值必须是 1–80 字符的单行文本，且不能包含反引号。`);
    }
    validateCopy(item.description, `第 ${index + 1} 项测量说明`, 400);
  });
  normalized.limitations.forEach((item, index) => {
    if (!item.title || item.title.length > 120 || /[*\r\n]/u.test(item.title)) {
      throw new Error(`第 ${index + 1} 项局限名称必须是 1–120 字符的单行文本，且不能包含 *。`);
    }
    validateCopy(item.description, `第 ${index + 1} 项局限说明`, 400);
  });
  uniqueKeys(normalized.measurements, "label", "测量项");
  uniqueKeys(normalized.limitations, "title", "局限项");
  return normalized;
}

function serializeExperiment(data) {
  const value = validateExperiment(data);
  return [
    `> [!experiment] ${value.title}`,
    `> **STATUS:** \`${value.status}\` · **DATE:** \`${value.date}\``,
    ">",
    "> **HYPOTHESIS**",
    ">",
    `> ${value.hypothesis}`,
    ">",
    "> **ENVIRONMENT**",
    ">",
    `> ${value.environment}`,
    ">",
    "> **METHOD**",
    ">",
    `> ${value.method}`,
    ">",
    "> **SAMPLE**",
    ">",
    `> ${value.sample}`,
    ">",
    "> **MEASUREMENTS**",
    ">",
    ...value.measurements.map((item) => `> - **${item.label}** \`${item.value}\` — ${item.description}`),
    ">",
    "> **CONCLUSION**",
    ">",
    `> ${value.conclusion}`,
    ">",
    "> **LIMITATIONS**",
    ">",
    ...value.limitations.map((item) => `> - **${item.title}** — ${item.description}`),
  ].join("\n");
}

function parseExperimentMatch(match) {
  if (!match) throw new Error("无法解析 Studio 技术实验记录。");
  const measurements = [...match[8].trimEnd().matchAll(new RegExp(MEASUREMENT_SOURCE, "giu"))];
  const limitations = [...match[10].trimEnd().matchAll(new RegExp(LIMITATION_SOURCE, "giu"))];
  return validateExperiment({
    conclusion: match[9],
    date: match[3],
    environment: match[5],
    hypothesis: match[4],
    limitations: limitations.map((item) => ({ title: item[1], description: item[2] })),
    measurements: measurements.map((item) => ({ label: item[1], value: item[2], description: item[3] })),
    method: match[6],
    sample: match[7],
    status: match[2],
    title: match[1],
  });
}

function copyPanel(h, label, copy, className) {
  return h(
    "div",
    { className: `markdown-experiment-copy-panel ${className}` },
    h("span", { className: "markdown-experiment-copy-label" }, label),
    h("div", { className: "markdown-experiment-copy" }, copy),
  );
}

export function createStudioExperimentEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") throw new Error("Studio 技术实验组件缺少 React 运行时。");
  return {
    collapsed: false,
    id: STUDIO_EXPERIMENT_EDITOR_ID,
    label: "技术实验记录",
    fields: [
      { label: "实验标题", name: "title", widget: "string", pattern: ["^[^\\[\\]\\r\\n]{1,120}$", "填写 1–120 字符的单行标题"] },
      { label: "结果状态", name: "status", widget: "select", options: STUDIO_EXPERIMENT_STATUSES, default: "SUPPORTED", hint: "SUPPORTED 支持假设；REFUTED 反驳；INCONCLUSIVE 证据不足；FAILED 未完成有效测量。" },
      { label: "运行日期", name: "date", widget: "datetime", format: "YYYY-MM-DD", time_format: false, picker_utc: false, hint: "只记录已运行实验；完整发布预检会拒绝未来日期。" },
      { label: "假设 / Hypothesis", name: "hypothesis", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单段可检验假设"] },
      { label: "环境 / Environment", name: "environment", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单段环境说明"], hint: "记录硬件、软件、版本或数据条件。" },
      { label: "方法 / Method", name: "method", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单段方法"] },
      { label: "样本 / Sample", name: "sample", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的样本或运行次数"], hint: "说明数据范围、重复次数或观察窗口。" },
      {
        label: "测量结果", label_singular: "测量", name: "measurements", widget: "list",
        allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false,
        min: STUDIO_EXPERIMENT_MIN_MEASUREMENTS, max: STUDIO_EXPERIMENT_MAX_MEASUREMENTS,
        summary: "{{fields.label}} · {{fields.value}}",
        default: [
          { label: "完整发布检查", value: "184.3 s", description: "在当前工作站完成全部本地发布门。" },
          { label: "应用测试", value: "35/35", description: "真实生产服务器路径全部通过。" },
        ],
        fields: [
          { label: "指标名称", name: "label", widget: "string", pattern: ["^[^*\\r\\n]{1,120}$", "填写 1–120 字符的名称，不能包含 *"] },
          { label: "测量值", name: "value", widget: "string", pattern: ["^[^`\\r\\n]{1,80}$", "填写 1–80 字符的值，包含单位且不能使用反引号"] },
          { label: "测量说明", name: "description", widget: "text", pattern: ["^[^\\r\\n]{1,400}$", "填写 1–400 字符的单行说明"] },
        ],
      },
      { label: "结论 / Conclusion", name: "conclusion", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单段结论"], hint: "只陈述测量能支持的范围。" },
      {
        label: "已知局限", label_singular: "局限", name: "limitations", widget: "list",
        allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false,
        min: STUDIO_EXPERIMENT_MIN_LIMITATIONS, max: STUDIO_EXPERIMENT_MAX_LIMITATIONS,
        summary: "{{fields.title}}",
        default: [{ title: "单机范围", description: "结果只覆盖当前工作站与依赖版本。" }],
        fields: [
          { label: "局限名称", name: "title", widget: "string", pattern: ["^[^*\\r\\n]{1,120}$", "填写 1–120 字符的名称，不能包含 *"] },
          { label: "局限说明", name: "description", widget: "text", pattern: ["^[^\\r\\n]{1,400}$", "填写 1–400 字符的单行说明"] },
        ],
      },
    ],
    pattern: STUDIO_EXPERIMENT_PATTERN,
    fromBlock: parseExperimentMatch,
    toBlock: serializeExperiment,
    toPreview(data) {
      const value = validateExperiment(data);
      return h(
        "section",
        { className: "markdown-experiment", "data-experiment": "bench-sheet", "data-status": value.status.toLocaleLowerCase("en-US") },
        h(
          "header",
          { className: "markdown-experiment-header" },
          h("span", { className: "markdown-experiment-spine", "aria-hidden": "true" }, "EXPERIMENT / RUN"),
          h(
            "span",
            { className: "markdown-experiment-heading" },
            h(
              "span",
              { className: "markdown-experiment-meta" },
              h("span", { className: "markdown-experiment-status" }, value.status),
              h("time", { className: "markdown-experiment-date", dateTime: value.date }, value.date),
            ),
            h("strong", { className: "markdown-experiment-title" }, value.title),
          ),
        ),
        copyPanel(h, "HYPOTHESIS", value.hypothesis, "markdown-experiment-hypothesis"),
        h(
          "div",
          { className: "markdown-experiment-setup" },
          copyPanel(h, "ENVIRONMENT", value.environment, "markdown-experiment-environment"),
          copyPanel(h, "METHOD", value.method, "markdown-experiment-method"),
          copyPanel(h, "SAMPLE", value.sample, "markdown-experiment-sample"),
        ),
        h(
          "div",
          { className: "markdown-experiment-results" },
          h(
            "div",
            { className: "markdown-experiment-measurements" },
            h("header", { className: "markdown-experiment-ledger-header" }, h("span", { className: "markdown-experiment-ledger-label" }, "MEASUREMENTS"), h("span", { className: "markdown-experiment-ledger-count" }, String(value.measurements.length).padStart(2, "0"))),
            h("ul", { className: "markdown-experiment-measurement-list" }, ...value.measurements.map((item, index) => h("li", { className: "markdown-experiment-measurement", key: `${item.label}-${index}` }, h("strong", { className: "markdown-experiment-measurement-label" }, item.label), h("code", { className: "markdown-experiment-measurement-value" }, item.value), h("span", { className: "markdown-experiment-measurement-copy" }, item.description)))),
          ),
          copyPanel(h, "CONCLUSION", value.conclusion, "markdown-experiment-conclusion"),
          h(
            "div",
            { className: "markdown-experiment-limitations" },
            h("header", { className: "markdown-experiment-ledger-header" }, h("span", { className: "markdown-experiment-ledger-label" }, "LIMITATIONS"), h("span", { className: "markdown-experiment-ledger-count" }, String(value.limitations.length).padStart(2, "0"))),
            h("ul", { className: "markdown-experiment-limitation-list" }, ...value.limitations.map((item, index) => h("li", { className: "markdown-experiment-limitation", key: `${item.title}-${index}` }, h("strong", { className: "markdown-experiment-limitation-title" }, item.title), h("span", { className: "markdown-experiment-limitation-copy" }, item.description)))),
          ),
        ),
      );
    },
  };
}

export function registerStudioExperimentEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 技术实验组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioExperimentEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.experimentEditor = "registered";
  return definition;
}
