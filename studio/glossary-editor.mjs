export const STUDIO_GLOSSARY_EDITOR_ID = "myblog-glossary";
export const STUDIO_GLOSSARY_MIN_ITEMS = 2;
export const STUDIO_GLOSSARY_MAX_ITEMS = 12;
export const STUDIO_GLOSSARY_MAX_ALIASES = 5;

const GLOSSARY_ITEM_SOURCE = String.raw`> - \*\*([^*\r\n]{1,100})\*\*\r?\n>\r?\n> {3}([^\r\n]{1,800})(?:\r?\n>\r?\n> {3}\*\*别名：\*\* ([^\r\n]{1,304}))?(?:\r?\n>\r?\n> {3}\*\*上下文：\*\* ([^\r\n]{1,400}))?`;
export const STUDIO_GLOSSARY_PATTERN = new RegExp(
  String.raw`^> \[!glossary\] ([^\[\]\r\n]{1,120})\r?\n((?:${GLOSSARY_ITEM_SOURCE}(?:\r?\n|$)){2,12})(?!> - \*\*)`,
  "imu",
);
const REGISTRATION_KEY = "__MYBLOG_GLOSSARY_EDITOR_COMPONENT__";

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
          const rawAliases = plainValue(item.aliases);
          return {
            aliases: Array.isArray(rawAliases)
              ? rawAliases.map((alias) => String(plainValue(alias) ?? "").trim())
              : [],
            context: typeof item.context === "string" ? item.context.trim() : "",
            definition:
              typeof item.definition === "string" ? item.definition.trim() : "",
            term: typeof item.term === "string" ? item.term.trim() : "",
          };
        })
      : [],
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function normalizedLabel(value) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

function validateGlossary(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("术语定义表标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (
    normalized.items.length < STUDIO_GLOSSARY_MIN_ITEMS ||
    normalized.items.length > STUDIO_GLOSSARY_MAX_ITEMS
  ) {
    throw new Error(
      `术语定义表必须包含 ${STUDIO_GLOSSARY_MIN_ITEMS}–${STUDIO_GLOSSARY_MAX_ITEMS} 个术语。`,
    );
  }
  const labels = [];
  normalized.items.forEach((item, index) => {
    if (!item.term || item.term.length > 100 || /[*\r\n]/u.test(item.term)) {
      throw new Error(`第 ${index + 1} 个术语必须是 1–100 字符的单行文本，且不能包含 *。`);
    }
    if (
      !item.definition ||
      item.definition.length > 800 ||
      /[\r\n]/u.test(item.definition)
    ) {
      throw new Error(`第 ${index + 1} 个定义必须是 1–800 字符的单行内容。`);
    }
    if (/!\[|<[^>]+>|\[\^/u.test(item.definition)) {
      throw new Error(`第 ${index + 1} 个定义不能包含图片、HTML 或脚注。`);
    }
    if (item.aliases.length > STUDIO_GLOSSARY_MAX_ALIASES) {
      throw new Error(`第 ${index + 1} 个术语最多填写 ${STUDIO_GLOSSARY_MAX_ALIASES} 个别名。`);
    }
    item.aliases.forEach((alias, aliasIndex) => {
      if (!alias || alias.length > 60 || /[、\r\n]/u.test(alias)) {
        throw new Error(
          `第 ${index + 1} 个术语的第 ${aliasIndex + 1} 个别名必须是 1–60 字符的单行文本，且不能包含顿号。`,
        );
      }
    });
    if (item.context.length > 400 || /[\r\n]/u.test(item.context)) {
      throw new Error(`第 ${index + 1} 个术语的可选上下文不能超过 400 字符或包含换行。`);
    }
    if (/!\[|<[^>]+>|\[\^/u.test(item.context)) {
      throw new Error(`第 ${index + 1} 个术语的上下文不能包含图片、HTML 或脚注。`);
    }
    labels.push(item.term, ...item.aliases);
  });
  const keys = labels.map(normalizedLabel);
  if (new Set(keys).size !== keys.length) {
    throw new Error("同一术语定义表中的术语和别名不能互相重复。");
  }
  return normalized;
}

function serializeGlossary(data) {
  const normalized = validateGlossary(data);
  const lines = [`> [!glossary] ${normalized.title}`];
  for (const item of normalized.items) {
    lines.push(
      `> - **${item.term}**`,
      ">",
      `>   ${item.definition}`,
    );
    if (item.aliases.length > 0) {
      lines.push(">", `>   **别名：** ${item.aliases.join("、")}`);
    }
    if (item.context) {
      lines.push(">", `>   **上下文：** ${item.context}`);
    }
  }
  return lines.join("\n");
}

function parseGlossaryMatch(match) {
  if (!match) throw new Error("无法解析 Studio 术语定义表。");
  const itemMatches = [
    ...match[2].trimEnd().matchAll(new RegExp(GLOSSARY_ITEM_SOURCE, "giu")),
  ];
  if (itemMatches.length < STUDIO_GLOSSARY_MIN_ITEMS) {
    throw new Error("Studio 术语定义表没有解析出足够的术语。");
  }
  return validateGlossary({
    items: itemMatches.map((item) => ({
      aliases: item[3] ? item[3].split("、").map((alias) => alias.trim()) : [],
      context: item[4] ?? "",
      definition: item[2],
      term: item[1],
    })),
    title: match[1],
  });
}

function previewEntry(h, item, index) {
  return h(
    "div",
    { className: "markdown-glossary-entry", key: `term-${index + 1}` },
    h(
      "dt",
      { className: "markdown-glossary-term" },
      h("strong", { className: "markdown-glossary-term-name" }, item.term),
      item.aliases.length > 0
        ? h(
            "span",
            { className: "markdown-glossary-aliases" },
            h("span", { className: "markdown-glossary-alias-label" }, "ALIASES"),
            ...item.aliases.flatMap((alias, aliasIndex) => [
              " ",
              h(
                "span",
                { className: "markdown-glossary-alias", key: `alias-${aliasIndex + 1}` },
                alias,
              ),
            ]),
          )
        : null,
    ),
    h(
      "dd",
      { className: "markdown-glossary-meaning" },
      h("span", { className: "markdown-glossary-definition" }, item.definition),
      item.context
        ? h(
            "span",
            { className: "markdown-glossary-context" },
            h("span", { className: "markdown-glossary-context-label" }, "CONTEXT"),
            h("span", { className: "markdown-glossary-context-copy" }, item.context),
          )
        : null,
    ),
  );
}

export function createStudioGlossaryEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") {
    throw new Error("Studio 术语定义表组件缺少 React 运行时。");
  }
  return {
    collapsed: false,
    id: STUDIO_GLOSSARY_EDITOR_ID,
    label: "术语定义表",
    fields: [
      {
        hint: "例如：React 核心概念、部署术语、数据库基础。",
        label: "术语表标题",
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
            aliases: ["RSC", "React Server Component"],
            context: "在 Next.js App Router 中默认用于服务端数据读取和组合界面。",
            definition: "只在服务端渲染的 React 组件，不向浏览器发送该组件本身的 JavaScript。",
            term: "Server Component",
          },
          {
            aliases: ["Hydration"],
            context: "只发生在需要浏览器交互的 Client Component 边界。",
            definition: "React 在已有服务端 HTML 上绑定客户端行为的过程。",
            term: "水合",
          },
        ],
        fields: [
          {
            hint: "填写要解释的概念名称，例如 Server Component。",
            label: "术语",
            name: "term",
            pattern: ["^[^*\\r\\n]{1,100}$", "填写 1–100 字符的单行术语，不能包含 *"],
            widget: "string",
          },
          {
            hint: "先说明它是什么；可使用链接、行内代码、强调和行内公式。",
            label: "定义",
            name: "definition",
            pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单行定义"],
            widget: "string",
          },
          {
            allow_add: true,
            allow_remove: true,
            allow_reorder: true,
            field: {
              label: "别名",
              pattern: ["^[^、\\r\\n]{1,60}$", "填写 1–60 字符，不能包含顿号"],
              widget: "string",
            },
            hint: "可选；填写缩写、英文名或常见同义词，最多 5 个。",
            label: "别名",
            max: STUDIO_GLOSSARY_MAX_ALIASES,
            name: "aliases",
            required: false,
            widget: "list",
          },
          {
            hint: "可选；说明这个术语在当前文章、框架或项目中的具体边界。",
            label: "上下文",
            name: "context",
            pattern: ["^[^\\r\\n]{0,400}$", "最多 400 字符，不能换行"],
            required: false,
            widget: "string",
          },
        ],
        label: "术语条目",
        label_singular: "术语",
        max: STUDIO_GLOSSARY_MAX_ITEMS,
        min: STUDIO_GLOSSARY_MIN_ITEMS,
        name: "items",
        summary: "{{fields.term}} · {{fields.definition}}",
        widget: "list",
      },
    ],
    pattern: STUDIO_GLOSSARY_PATTERN,
    fromBlock: parseGlossaryMatch,
    toBlock: serializeGlossary,
    toPreview(data) {
      const normalized = validateGlossary(data);
      return h(
        "section",
        {
          className: "markdown-glossary",
          "data-glossary": "definition-ledger",
          "data-term-count": normalized.items.length,
        },
        h(
          "header",
          { className: "markdown-glossary-header" },
          h(
            "span",
            { className: "markdown-glossary-rail" },
            h(
              "span",
              { className: "markdown-glossary-kind" },
              `GLOSSARY / ${String(normalized.items.length).padStart(2, "0")} TERMS`,
            ),
            h("span", { className: "markdown-glossary-mode" }, "CONCEPTS · STATIC"),
          ),
          h("strong", { className: "markdown-glossary-title" }, normalized.title),
        ),
        h(
          "dl",
          { className: "markdown-glossary-items" },
          ...normalized.items.map((item, index) => previewEntry(h, item, index)),
        ),
      );
    },
  };
}

export function registerStudioGlossaryEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 术语定义表组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioGlossaryEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.glossaryEditor = "registered";
  return definition;
}
