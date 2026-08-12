export const STUDIO_FAQ_EDITOR_ID = "myblog-faq";
export const STUDIO_FAQ_MIN_ITEMS = 2;
export const STUDIO_FAQ_MAX_ITEMS = 10;
export const STUDIO_FAQ_MAX_ANSWERS = 3;

const FAQ_ANSWER_SOURCE = String.raw`\r?\n>\r?\n> {3}([^\r\n]{1,600})`;
const FAQ_ITEM_SOURCE = String.raw`> - \*\*([^*\r\n]{1,160})\*\*((?:${FAQ_ANSWER_SOURCE}){1,3})`;
export const STUDIO_FAQ_PATTERN = new RegExp(
  String.raw`^> \[!faq\] ([^\[\]\r\n]{1,120})\r?\n((?:${FAQ_ITEM_SOURCE}(?:\r?\n|$)){2,10})(?!> - \*\*)`,
  "imu",
);
const REGISTRATION_KEY = "__MYBLOG_FAQ_EDITOR_COMPONENT__";

function plainValue(value) {
  return value && typeof value.toJS === "function" ? value.toJS() : value;
}

function normalizedData(data) {
  const value = plainValue(data) ?? {};
  const rawItems = plainValue(value.items);
  return {
    items: Array.isArray(rawItems)
      ? rawItems.map((candidate) => {
          const item = plainValue(candidate) ?? {};
          const rawAnswers = plainValue(item.answers);
          return {
            answers: Array.isArray(rawAnswers)
              ? rawAnswers.map((answer) => String(plainValue(answer) ?? "").trim())
              : [],
            question: typeof item.question === "string" ? item.question.trim() : "",
          };
        })
      : [],
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function validateRichLine(value, label, maximum) {
  if (!value || value.length > maximum || /[\r\n]/u.test(value)) {
    throw new Error(`${label}必须是 1–${maximum} 字符的单行内容。`);
  }
  if (/!\[|<[^>]+>|\[\^/u.test(value)) {
    throw new Error(`${label}不能包含图片、HTML 或脚注。`);
  }
}

function validateFaq(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("FAQ 标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (
    normalized.items.length < STUDIO_FAQ_MIN_ITEMS ||
    normalized.items.length > STUDIO_FAQ_MAX_ITEMS
  ) {
    throw new Error(`FAQ 必须包含 ${STUDIO_FAQ_MIN_ITEMS}–${STUDIO_FAQ_MAX_ITEMS} 个问题。`);
  }
  normalized.items.forEach((item, index) => {
    if (!item.question || item.question.length > 160 || /[*\r\n]/u.test(item.question)) {
      throw new Error(`第 ${index + 1} 个问题必须是 1–160 字符的单行文本，且不能包含 *。`);
    }
    if (item.answers.length < 1 || item.answers.length > STUDIO_FAQ_MAX_ANSWERS) {
      throw new Error(`第 ${index + 1} 个问题必须填写 1–${STUDIO_FAQ_MAX_ANSWERS} 个答案段落。`);
    }
    item.answers.forEach((answer, answerIndex) =>
      validateRichLine(answer, `第 ${index + 1} 个问题的第 ${answerIndex + 1} 个答案段落`, 600),
    );
    if (item.answers.join(" ").length > 1_200) {
      throw new Error(`第 ${index + 1} 个问题的全部答案合计不能超过 1200 字符。`);
    }
  });
  const keys = normalized.items.map((item) =>
    item.question.normalize("NFKC").toLocaleLowerCase("zh-CN"),
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error("同一 FAQ 中的问题不能重复。");
  }
  return normalized;
}

function serializeFaq(data) {
  const normalized = validateFaq(data);
  const lines = [`> [!faq] ${normalized.title}`];
  for (const item of normalized.items) {
    lines.push(`> - **${item.question}**`);
    for (const answer of item.answers) lines.push(">", `>   ${answer}`);
  }
  return lines.join("\n");
}

function parseFaqMatch(match) {
  if (!match) throw new Error("无法解析 Studio FAQ。");
  const itemMatches = [
    ...match[2].trimEnd().matchAll(new RegExp(FAQ_ITEM_SOURCE, "giu")),
  ];
  return validateFaq({
    items: itemMatches.map((item) => ({
      answers: [
        ...item[2].matchAll(new RegExp(FAQ_ANSWER_SOURCE, "giu")),
      ].map((answer) => answer[1]),
      question: item[1],
    })),
    title: match[1],
  });
}

function previewEntry(h, item, index) {
  return h(
    "details",
    { className: "markdown-faq-entry", key: `question-${index + 1}`, open: index === 0 },
    h(
      "summary",
      { className: "markdown-faq-question" },
      h("span", { className: "markdown-faq-question-mark", "aria-hidden": "true" }, "Q"),
      h("strong", { className: "markdown-faq-question-copy" }, item.question),
      h("span", { className: "markdown-faq-toggle", "aria-hidden": "true" }, "+"),
    ),
    h(
      "div",
      { className: "markdown-faq-answer" },
      h("span", { className: "markdown-faq-answer-mark", "aria-hidden": "true" }, "A"),
      h(
        "div",
        { className: "markdown-faq-answer-copy" },
        ...item.answers.map((answer, answerIndex) =>
          h("p", { key: `answer-${answerIndex + 1}` }, answer),
        ),
      ),
    ),
  );
}

export function createStudioFaqEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") {
    throw new Error("Studio FAQ 组件缺少 React 运行时。");
  }
  return {
    collapsed: false,
    id: STUDIO_FAQ_EDITOR_ID,
    label: "常见问题 FAQ",
    fields: [
      {
        hint: "例如：发布常见问题、部署疑问、项目使用说明。",
        label: "FAQ 标题",
        name: "title",
        pattern: ["^[^\\[\\]\\r\\n]{1,120}$", "填写 1–120 字符的单行标题"],
        widget: "string",
      },
      {
        allow_add: true,
        allow_remove: true,
        allow_reorder: true,
        collapsed: false,
        default: [
          {
            answers: ["Studio 适合浏览器内结构化编辑；Obsidian 适合本地知识库写作。两者最终发布同一份 Markdown。"],
            question: "应该使用 Studio 还是 Obsidian？",
          },
          {
            answers: ["不会。问题展开只存在于当前浏览器页面，不写回 Git，也不会跨访问保存。"],
            question: "FAQ 会保存读者的展开状态吗？",
          },
        ],
        fields: [
          {
            hint: "写读者会直接提出的问题；不要在开头手写 Q。",
            label: "问题",
            name: "question",
            pattern: ["^[^*\\r\\n]{1,160}$", "填写 1–160 字符的单行问题，不能包含 *"],
            widget: "string",
          },
          {
            allow_add: true,
            allow_remove: true,
            allow_reorder: true,
            field: {
              label: "答案段落",
              pattern: ["^[^\\r\\n]{1,600}$", "填写 1–600 字符的单行答案段落"],
              widget: "text",
            },
            hint: "每个问题填写 1–3 段；可使用链接、行内代码、强调和行内公式。",
            label: "答案段落",
            max: STUDIO_FAQ_MAX_ANSWERS,
            min: 1,
            name: "answers",
            widget: "list",
          },
        ],
        label: "问答条目",
        label_singular: "问题",
        max: STUDIO_FAQ_MAX_ITEMS,
        min: STUDIO_FAQ_MIN_ITEMS,
        name: "items",
        summary: "{{fields.question}}",
        widget: "list",
      },
    ],
    pattern: STUDIO_FAQ_PATTERN,
    fromBlock: parseFaqMatch,
    toBlock: serializeFaq,
    toPreview(data) {
      const normalized = validateFaq(data);
      return h(
        "section",
        {
          className: "markdown-faq",
          "data-faq": "answer-cabinet",
          "data-question-count": normalized.items.length,
        },
        h(
          "header",
          { className: "markdown-faq-header" },
          h(
            "span",
            { className: "markdown-faq-rail" },
            h("span", { className: "markdown-faq-kind" }, `FAQ / ${String(normalized.items.length).padStart(2, "0")} QUESTIONS`),
            h("span", { className: "markdown-faq-mode" }, "ANSWERS · NATIVE"),
          ),
          h("strong", { className: "markdown-faq-title" }, normalized.title),
        ),
        h(
          "div",
          { className: "markdown-faq-items" },
          ...normalized.items.map((item, index) => previewEntry(h, item, index)),
        ),
      );
    },
  };
}

export function registerStudioFaqEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio FAQ 组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioFaqEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.faqEditor = "registered";
  return definition;
}
