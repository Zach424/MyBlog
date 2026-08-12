export const STUDIO_DECISION_EDITOR_ID = "myblog-decision";
export const STUDIO_DECISION_MIN_ITEMS = 1;
export const STUDIO_DECISION_MAX_ITEMS = 6;
export const STUDIO_DECISION_STATUSES = [
  "ACCEPTED",
  "SUPERSEDED",
  "DEPRECATED",
  "REJECTED",
];
export const STUDIO_DECISION_CONSEQUENCE_TONES = [
  "POSITIVE",
  "NEGATIVE",
  "NEUTRAL",
];

const ALT_SOURCE = String.raw`> - \*\*([^*\r\n]{1,120})\*\* — ([^\r\n]{1,400})`;
const CONSEQUENCE_SOURCE = String.raw`> - \x60(POSITIVE|NEGATIVE|NEUTRAL)\x60 ([^\r\n]{1,400})`;
export const STUDIO_DECISION_PATTERN = new RegExp(
  String.raw`^> \[!decision\] ([^\[\]\r\n]{1,120})\r?\n> \*\*STATUS:\*\* \x60(ACCEPTED|SUPERSEDED|DEPRECATED|REJECTED)\x60 · \*\*DATE:\*\* \x60(\d{4}-\d{2}-\d{2})\x60\r?\n>\r?\n> \*\*CONTEXT\*\*\r?\n>\r?\n> ([^\r\n]{1,800})\r?\n>\r?\n> \*\*DECISION\*\*\r?\n>\r?\n> ([^\r\n]{1,800})\r?\n>\r?\n> \*\*RATIONALE\*\*\r?\n>\r?\n> ([^\r\n]{1,800})\r?\n>\r?\n> \*\*ALTERNATIVES\*\*\r?\n>\r?\n((?:${ALT_SOURCE}(?:\r?\n|$)){1,6})>\r?\n> \*\*CONSEQUENCES\*\*\r?\n>\r?\n((?:${CONSEQUENCE_SOURCE}(?:\r?\n|$)){1,6})(?!> - \x60(?:POSITIVE|NEGATIVE|NEUTRAL)\x60)` ,
  "imu",
);
const REGISTRATION_KEY = "__MYBLOG_DECISION_EDITOR_COMPONENT__";
const STATUSES = new Set(STUDIO_DECISION_STATUSES);
const TONES = new Set(STUDIO_DECISION_CONSEQUENCE_TONES);

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
    alternatives: normalizeList(value.alternatives, ["title", "description"]),
    consequences: normalizeList(value.consequences, ["tone", "description"]),
    context: typeof value.context === "string" ? value.context.trim() : "",
    date: typeof value.date === "string" ? value.date.trim() : "",
    decision: typeof value.decision === "string" ? value.decision.trim() : "",
    rationale: typeof value.rationale === "string" ? value.rationale.trim() : "",
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

function validateDecision(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("技术决策标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (!STATUSES.has(normalized.status)) {
    throw new Error(`技术决策状态只允许 ${STUDIO_DECISION_STATUSES.join(" / ")}。`);
  }
  if (!isRealIsoDate(normalized.date)) {
    throw new Error("技术决策日期必须是真实的 YYYY-MM-DD。");
  }
  validateCopy(normalized.context, "背景");
  validateCopy(normalized.decision, "决定");
  validateCopy(normalized.rationale, "理由");
  for (const [label, items] of [
    ["备选方案", normalized.alternatives],
    ["决策影响", normalized.consequences],
  ]) {
    if (items.length < STUDIO_DECISION_MIN_ITEMS || items.length > STUDIO_DECISION_MAX_ITEMS) {
      throw new Error(`${label}必须包含 ${STUDIO_DECISION_MIN_ITEMS}–${STUDIO_DECISION_MAX_ITEMS} 项。`);
    }
  }
  normalized.alternatives.forEach((item, index) => {
    if (!item.title || item.title.length > 120 || /[*\r\n]/u.test(item.title)) {
      throw new Error(`第 ${index + 1} 个备选方案名称必须是 1–120 字符的单行文本，且不能包含 *。`);
    }
    validateCopy(item.description, `第 ${index + 1} 个备选方案说明`, 400);
  });
  const keys = normalized.alternatives.map((item) =>
    item.title.normalize("NFKC").toLocaleLowerCase("zh-CN"),
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error("同一技术决策不能包含名称重复的备选方案。");
  }
  normalized.consequences.forEach((item, index) => {
    if (!TONES.has(item.tone)) {
      throw new Error(`第 ${index + 1} 条影响类型只允许 ${STUDIO_DECISION_CONSEQUENCE_TONES.join(" / ")}。`);
    }
    validateCopy(item.description, `第 ${index + 1} 条影响说明`, 400);
  });
  return normalized;
}

function serializeDecision(data) {
  const value = validateDecision(data);
  return [
    `> [!decision] ${value.title}`,
    `> **STATUS:** \`${value.status}\` · **DATE:** \`${value.date}\``,
    ">",
    "> **CONTEXT**",
    ">",
    `> ${value.context}`,
    ">",
    "> **DECISION**",
    ">",
    `> ${value.decision}`,
    ">",
    "> **RATIONALE**",
    ">",
    `> ${value.rationale}`,
    ">",
    "> **ALTERNATIVES**",
    ">",
    ...value.alternatives.map((item) => `> - **${item.title}** — ${item.description}`),
    ">",
    "> **CONSEQUENCES**",
    ">",
    ...value.consequences.map((item) => `> - \`${item.tone}\` ${item.description}`),
  ].join("\n");
}

function parseDecisionMatch(match) {
  if (!match) throw new Error("无法解析 Studio 技术决策记录。");
  const alternatives = [...match[7].trimEnd().matchAll(new RegExp(ALT_SOURCE, "giu"))];
  const consequences = [...match[10].trimEnd().matchAll(new RegExp(CONSEQUENCE_SOURCE, "giu"))];
  return validateDecision({
    alternatives: alternatives.map((item) => ({ title: item[1], description: item[2] })),
    consequences: consequences.map((item) => ({ tone: item[1], description: item[2] })),
    context: match[4],
    date: match[3],
    decision: match[5],
    rationale: match[6],
    status: match[2],
    title: match[1],
  });
}

function copyPanel(h, label, copy, className) {
  return h(
    "div",
    { className: `markdown-decision-copy-panel ${className}` },
    h("span", { className: "markdown-decision-copy-label" }, label),
    h("div", { className: "markdown-decision-copy" }, copy),
  );
}

function ledger(h, kind, items) {
  const alternatives = kind === "alternatives";
  return h(
    "div",
    { className: `markdown-decision-ledger-panel markdown-decision-${kind}` },
    h(
      "header",
      { className: "markdown-decision-ledger-header" },
      h("span", { className: "markdown-decision-ledger-label" }, alternatives ? "NOT SELECTED" : "IMPACT LEDGER"),
      h("span", { className: "markdown-decision-ledger-count" }, String(items.length).padStart(2, "0")),
    ),
    h(
      "ul",
      { className: "markdown-decision-ledger-list" },
      ...items.map((item, index) => h(
        "li",
        {
          className: "markdown-decision-ledger-item",
          ...(alternatives ? {} : { "data-consequence-tone": item.tone.toLocaleLowerCase("en-US") }),
          key: `${alternatives ? item.title : item.tone}-${index}`,
        },
        alternatives
          ? h("strong", { className: "markdown-decision-alternative-title" }, item.title)
          : h("span", { className: "markdown-decision-consequence-tone" }, item.tone),
        h("span", { className: "markdown-decision-ledger-copy" }, item.description),
      )),
    ),
  );
}

export function createStudioDecisionEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") throw new Error("Studio 技术决策组件缺少 React 运行时。");
  return {
    collapsed: false,
    id: STUDIO_DECISION_EDITOR_ID,
    label: "技术决策记录",
    fields: [
      { label: "决策标题", name: "title", widget: "string", pattern: ["^[^\\[\\]\\r\\n]{1,120}$", "填写 1–120 字符的单行标题"] },
      { label: "决策状态", name: "status", widget: "select", options: STUDIO_DECISION_STATUSES, default: "ACCEPTED", hint: "ACCEPTED 已采纳；SUPERSEDED 已被替代；DEPRECATED 不再推荐；REJECTED 明确拒绝。" },
      { label: "决策日期", name: "date", widget: "datetime", format: "YYYY-MM-DD", time_format: false, picker_utc: false, hint: "只记录已经作出的决定；完整发布预检会拒绝未来日期。" },
      { label: "背景 / Context", name: "context", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单段背景"], hint: "写清约束、问题和促使你作出选择的条件。" },
      { label: "决定 / Decision", name: "decision", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单段决定"], hint: "直接陈述选择了什么。" },
      { label: "理由 / Rationale", name: "rationale", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单段理由"], hint: "说明为什么这个选择最符合当前约束。" },
      {
        label: "备选方案", label_singular: "方案", name: "alternatives", widget: "list",
        allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false,
        min: STUDIO_DECISION_MIN_ITEMS, max: STUDIO_DECISION_MAX_ITEMS,
        summary: "{{fields.title}}",
        default: [{ title: "Cloudflare Pages", description: "需要额外适配与维护。" }],
        fields: [
          { label: "方案名称", name: "title", widget: "string", pattern: ["^[^*\\r\\n]{1,120}$", "填写 1–120 字符的名称，不能包含 *"] },
          { label: "未选择原因", name: "description", widget: "text", pattern: ["^[^\\r\\n]{1,400}$", "填写 1–400 字符的单行说明"] },
        ],
      },
      {
        label: "决策影响", label_singular: "影响", name: "consequences", widget: "list",
        allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false,
        min: STUDIO_DECISION_MIN_ITEMS, max: STUDIO_DECISION_MAX_ITEMS,
        summary: "{{fields.tone}} · {{fields.description}}",
        default: [
          { tone: "POSITIVE", description: "发布链路更短，框架支持更直接。" },
          { tone: "NEGATIVE", description: "托管能力与平台存在耦合。" },
        ],
        fields: [
          { label: "影响类型", name: "tone", widget: "select", options: STUDIO_DECISION_CONSEQUENCE_TONES },
          { label: "影响说明", name: "description", widget: "text", pattern: ["^[^\\r\\n]{1,400}$", "填写 1–400 字符的单行说明"] },
        ],
      },
    ],
    pattern: STUDIO_DECISION_PATTERN,
    fromBlock: parseDecisionMatch,
    toBlock: serializeDecision,
    toPreview(data) {
      const value = validateDecision(data);
      return h(
        "section",
        { className: "markdown-decision", "data-decision": "decision-brief", "data-status": value.status.toLocaleLowerCase("en-US") },
        h(
          "header",
          { className: "markdown-decision-header" },
          h("span", { className: "markdown-decision-spine", "aria-hidden": "true" }, "DECISION / LOCK"),
          h(
            "span",
            { className: "markdown-decision-heading" },
            h(
              "span",
              { className: "markdown-decision-meta" },
              h("span", { className: "markdown-decision-status" }, value.status),
              h("time", { className: "markdown-decision-date", dateTime: value.date }, value.date),
            ),
            h("strong", { className: "markdown-decision-title" }, value.title),
          ),
        ),
        h(
          "div",
          { className: "markdown-decision-brief" },
          copyPanel(h, "CONTEXT", value.context, "markdown-decision-context"),
          copyPanel(h, "DECISION", value.decision, "markdown-decision-verdict"),
          copyPanel(h, "RATIONALE", value.rationale, "markdown-decision-rationale"),
        ),
        h(
          "div",
          { className: "markdown-decision-ledger" },
          ledger(h, "alternatives", value.alternatives),
          ledger(h, "consequences", value.consequences),
        ),
      );
    },
  };
}

export function registerStudioDecisionEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 技术决策组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioDecisionEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.decisionEditor = "registered";
  return definition;
}
