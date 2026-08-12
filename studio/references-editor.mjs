export const STUDIO_REFERENCES_EDITOR_ID = "myblog-references";
export const STUDIO_REFERENCES_MIN_ITEMS = 2;
export const STUDIO_REFERENCES_MAX_ITEMS = 12;

const REFERENCE_ITEM_SOURCE = String.raw`> \d+\. \[([^\]\r\n]{1,160})\]\((https:\/\/[^\s()]+|\/[^\s()]*)\)(?: — ([^\r\n]{1,240}))?`;
export const STUDIO_REFERENCES_PATTERN = new RegExp(
  String.raw`^> \[!references\] ([^\[\]\r\n]{1,120})\r?\n((?:${REFERENCE_ITEM_SOURCE}(?:\r?\n|$)){2,12})(?!> \d+\.)`,
  "imu",
);
const STUDIO_REFERENCE_ITEM_PATTERN = new RegExp(`^${REFERENCE_ITEM_SOURCE}$`, "iu");
const REGISTRATION_KEY = "__MYBLOG_REFERENCES_EDITOR_COMPONENT__";

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
          return {
            label: typeof item.label === "string" ? item.label.trim() : "",
            note: typeof item.note === "string" ? item.note.trim() : "",
            target: typeof item.target === "string" ? item.target.trim() : "",
          };
        })
      : [],
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function targetFacts(value) {
  if (!value || value.length > 2048 || /[()\s]/u.test(value)) {
    throw new Error("链接目标必须为 1–2048 个字符，且不能包含空白或未编码的圆括号。");
  }
  if (value.startsWith("/") && !value.startsWith("//")) {
    return { external: false, origin: "本站" };
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("链接只接受完整 HTTPS URL 或以 / 开头的站内绝对路径。");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("外部链接必须使用无凭据的 HTTPS URL 和默认端口。");
  }
  return { external: true, origin: url.hostname.replace(/^www\./iu, "") };
}

function validateReferences(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("参考资料清单标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (
    normalized.items.length < STUDIO_REFERENCES_MIN_ITEMS ||
    normalized.items.length > STUDIO_REFERENCES_MAX_ITEMS
  ) {
    throw new Error(
      `参考资料清单必须包含 ${STUDIO_REFERENCES_MIN_ITEMS}–${STUDIO_REFERENCES_MAX_ITEMS} 条。`,
    );
  }
  const targets = normalized.items.map((item, index) => {
    if (!item.label || item.label.length > 160 || /[\]\r\n]/u.test(item.label)) {
      throw new Error(`第 ${index + 1} 条的可见名称必须是 1–160 字符的单行文本。`);
    }
    if (item.note.length > 240 || /[\r\n]/u.test(item.note)) {
      throw new Error(`第 ${index + 1} 条的可选短注不能超过 240 字符或包含换行。`);
    }
    targetFacts(item.target);
    return item.target.normalize("NFKC").toLocaleLowerCase("en-US");
  });
  if (new Set(targets).size !== targets.length) {
    throw new Error("同一参考资料清单不能包含重复链接。");
  }
  return normalized;
}

function serializeReferences(data) {
  const normalized = validateReferences(data);
  return [
    `> [!references] ${normalized.title}`,
    ...normalized.items.map(
      (item, index) =>
        `> ${index + 1}. [${item.label}](${item.target})${item.note ? ` — ${item.note}` : ""}`,
    ),
  ].join("\n");
}

function parseReferencesMatch(match) {
  if (!match) throw new Error("无法解析 Studio 参考资料清单块。");
  const items = match[2]
    .trimEnd()
    .split(/\r?\n/u)
    .map((line, index) => {
      const item = STUDIO_REFERENCE_ITEM_PATTERN.exec(line);
      if (!item) throw new Error(`无法解析第 ${index + 1} 条 Studio 参考资料。`);
      return { label: item[1], note: item[3] ?? "", target: item[2] };
    });
  return validateReferences({ items, title: match[1] });
}

function previewItem(h, item, index) {
  const facts = targetFacts(item.target);
  return h(
    "li",
    {
      className: "markdown-reference-item",
      "data-reference-scope": facts.external ? "external" : "local",
      key: `${item.target}-${index}`,
    },
    h(
      "span",
      { "aria-hidden": "true", className: "markdown-reference-index" },
      String(index + 1).padStart(2, "0"),
    ),
    h(
      "span",
      { className: "markdown-reference-copy" },
      h(
        "a",
        { className: "markdown-reference-link", href: item.target },
        item.label,
      ),
      h("span", { className: "markdown-reference-origin" }, facts.origin),
      item.note ? h("span", { className: "markdown-reference-note" }, item.note) : null,
    ),
  );
}

export function createStudioReferencesEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") {
    throw new Error("Studio 参考资料组件缺少 React 运行时。");
  }
  return {
    collapsed: false,
    id: STUDIO_REFERENCES_EDITOR_ID,
    label: "参考资料清单",
    fields: [
      {
        hint: "例如：延伸阅读、官方资料、实现依据。",
        label: "清单标题",
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
          { label: "官方文档标题", note: "说明这份资料与正文的关系。", target: "https://example.com/docs" },
          { label: "本站相关记录", note: "补充项目背景与实现过程。", target: "/projects/myblog" },
        ],
        fields: [
          {
            hint: "使用可独立理解的名称，不要只写‘点击这里’。",
            label: "可见名称",
            name: "label",
            pattern: ["^[^\\]\\r\\n]{1,160}$", "填写 1–160 字符的单行名称"],
            widget: "string",
          },
          {
            hint: "完整 HTTPS URL，或以 / 开头的本站路径；不抓取远程元数据。",
            label: "链接目标",
            name: "target",
            pattern: ["^(?:https://|/)[^\\s]+$", "填写 HTTPS URL 或站内绝对路径"],
            widget: "string",
          },
          {
            hint: "可选；说明为什么值得阅读，不要复制远程摘要。",
            label: "短注",
            name: "note",
            pattern: ["^[^\\r\\n]{0,240}$", "最多 240 字符，不能换行"],
            required: false,
            widget: "string",
          },
        ],
        label: "资料条目",
        label_singular: "参考资料",
        max: STUDIO_REFERENCES_MAX_ITEMS,
        min: STUDIO_REFERENCES_MIN_ITEMS,
        name: "items",
        summary: "{{fields.label}} · {{fields.target}}",
        widget: "list",
      },
    ],
    pattern: STUDIO_REFERENCES_PATTERN,
    fromBlock: parseReferencesMatch,
    toBlock: serializeReferences,
    toPreview(data) {
      const normalized = validateReferences(data);
      return h(
        "section",
        {
          className: "markdown-references",
          "data-reference-count": normalized.items.length,
          "data-references": "curated-index",
        },
        h(
          "header",
          { className: "markdown-reference-header" },
          h(
            "span",
            { className: "markdown-reference-rail" },
            h(
              "span",
              { className: "markdown-reference-kind" },
              `SOURCE INDEX / ${String(normalized.items.length).padStart(2, "0")} REFERENCES`,
            ),
            h("span", { className: "markdown-reference-mode" }, "HTTPS + LOCAL · STATIC"),
          ),
          h("strong", { className: "markdown-reference-title" }, normalized.title),
        ),
        h(
          "ol",
          { className: "markdown-reference-items" },
          ...normalized.items.map((item, index) => previewItem(h, item, index)),
        ),
      );
    },
  };
}

export function registerStudioReferencesEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 参考资料组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioReferencesEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.referencesEditor = "registered";
  return definition;
}
