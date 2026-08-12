export const STUDIO_STEPS_EDITOR_ID = "myblog-steps";
export const STUDIO_STEPS_MIN_ITEMS = 2;
export const STUDIO_STEPS_MAX_ITEMS = 10;

const STEP_ITEM_SOURCE = String.raw`> \d+\. \*\*([^*\r\n]{1,100})\*\*\r?\n>\r?\n> {4}([^\r\n]{1,600})(?:\r?\n>\r?\n> {4}\*\*验证：\*\* ([^\r\n]{1,240}))?`;
export const STUDIO_STEPS_PATTERN = new RegExp(
  String.raw`^> \[!steps\] ([^\[\]\r\n]{1,120})\r?\n((?:${STEP_ITEM_SOURCE}(?:\r?\n|$)){2,10})(?!> \d+\.)`,
  "imu",
);
const REGISTRATION_KEY = "__MYBLOG_STEPS_EDITOR_COMPONENT__";

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
            instruction:
              typeof item.instruction === "string" ? item.instruction.trim() : "",
            name: typeof item.name === "string" ? item.name.trim() : "",
            verification:
              typeof item.verification === "string" ? item.verification.trim() : "",
          };
        })
      : [],
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function validateSteps(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("步骤流程标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (
    normalized.items.length < STUDIO_STEPS_MIN_ITEMS ||
    normalized.items.length > STUDIO_STEPS_MAX_ITEMS
  ) {
    throw new Error(
      `步骤流程必须包含 ${STUDIO_STEPS_MIN_ITEMS}–${STUDIO_STEPS_MAX_ITEMS} 步。`,
    );
  }
  const names = normalized.items.map((item, index) => {
    if (!item.name || item.name.length > 100 || /[*\r\n]/u.test(item.name)) {
      throw new Error(`第 ${index + 1} 步名称必须是 1–100 字符的单行文本，且不能包含 *。`);
    }
    if (
      !item.instruction ||
      item.instruction.length > 600 ||
      /[\r\n]/u.test(item.instruction)
    ) {
      throw new Error(`第 ${index + 1} 步说明必须是 1–600 字符的单行内容。`);
    }
    if (/!\[|<[^>]+>|\[\^/u.test(item.instruction)) {
      throw new Error(`第 ${index + 1} 步说明不能包含图片、HTML 或脚注。`);
    }
    if (
      item.verification.length > 240 ||
      /[\r\n]/u.test(item.verification)
    ) {
      throw new Error(`第 ${index + 1} 步的可选验证不能超过 240 字符或包含换行。`);
    }
    if (/!\[|<[^>]+>|\[\^/u.test(item.verification)) {
      throw new Error(`第 ${index + 1} 步验证不能包含图片、HTML 或脚注。`);
    }
    return item.name.normalize("NFKC").toLocaleLowerCase("zh-CN");
  });
  if (new Set(names).size !== names.length) {
    throw new Error("同一步骤流程不能包含重复步骤名。");
  }
  return normalized;
}

function serializeSteps(data) {
  const normalized = validateSteps(data);
  const lines = [`> [!steps] ${normalized.title}`];
  for (const [index, item] of normalized.items.entries()) {
    lines.push(
      `> ${index + 1}. **${item.name}**`,
      ">",
      `>    ${item.instruction}`,
    );
    if (item.verification) {
      lines.push(">", `>    **验证：** ${item.verification}`);
    }
  }
  return lines.join("\n");
}

function parseStepsMatch(match) {
  if (!match) throw new Error("无法解析 Studio 步骤流程块。");
  const itemMatches = [...match[2].trimEnd().matchAll(new RegExp(STEP_ITEM_SOURCE, "giu"))];
  if (itemMatches.length < STUDIO_STEPS_MIN_ITEMS) {
    throw new Error("Studio 步骤流程没有解析出足够的步骤。");
  }
  const items = itemMatches.map((item) => ({
    instruction: item[2],
    name: item[1],
    verification: item[3] ?? "",
  }));
  return validateSteps({ items, title: match[1] });
}

function previewStep(h, item, index) {
  return h(
    "li",
    { className: "markdown-procedure-step", key: `step-${index + 1}` },
    h(
      "span",
      { "aria-hidden": "true", className: "markdown-procedure-marker" },
      h(
        "span",
        { className: "markdown-procedure-index" },
        String(index + 1).padStart(2, "0"),
      ),
      h("span", { className: "markdown-procedure-index-label" }, "STEP"),
    ),
    h(
      "span",
      { className: "markdown-procedure-copy" },
      h("strong", { className: "markdown-procedure-step-name" }, item.name),
      h("span", { className: "markdown-procedure-instruction" }, item.instruction),
      item.verification
        ? h(
            "span",
            { className: "markdown-procedure-check" },
            h("span", { className: "markdown-procedure-check-label" }, "CHECK"),
            h(
              "span",
              { className: "markdown-procedure-check-copy" },
              item.verification,
            ),
          )
        : null,
    ),
  );
}

export function createStudioStepsEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") {
    throw new Error("Studio 步骤流程组件缺少 React 运行时。");
  }
  return {
    collapsed: false,
    id: STUDIO_STEPS_EDITOR_ID,
    label: "操作步骤流程",
    fields: [
      {
        hint: "例如：发布流程、环境搭建、故障排查。",
        label: "流程标题",
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
            instruction: "执行 `npm run release:check`，处理全部失败项。",
            name: "运行完整检查",
            verification: "命令以退出码 0 完成。",
          },
          {
            instruction: "将已审阅提交推送到 `main`。",
            name: "推送主分支",
            verification: "远端 HEAD 与本地一致。",
          },
        ],
        fields: [
          {
            hint: "使用动作开头，例如“安装依赖”“验证生产”。",
            label: "步骤名称",
            name: "name",
            pattern: ["^[^*\\r\\n]{1,100}$", "填写 1–100 字符的单行名称，不能包含 *"],
            widget: "string",
          },
          {
            hint: "说明要做什么；可使用链接、行内代码、强调和行内公式。",
            label: "操作说明",
            name: "instruction",
            pattern: ["^[^\\r\\n]{1,600}$", "填写 1–600 字符的单行说明"],
            widget: "string",
          },
          {
            hint: "可选；写出读者如何确认这一步已经得到预期结果。",
            label: "验证条件",
            name: "verification",
            pattern: ["^[^\\r\\n]{0,240}$", "最多 240 字符，不能换行"],
            required: false,
            widget: "string",
          },
        ],
        label: "步骤",
        label_singular: "步骤",
        max: STUDIO_STEPS_MAX_ITEMS,
        min: STUDIO_STEPS_MIN_ITEMS,
        name: "items",
        summary: "{{fields.name}} · {{fields.instruction}}",
        widget: "list",
      },
    ],
    pattern: STUDIO_STEPS_PATTERN,
    fromBlock: parseStepsMatch,
    toBlock: serializeSteps,
    toPreview(data) {
      const normalized = validateSteps(data);
      return h(
        "section",
        {
          className: "markdown-procedure",
          "data-procedure": "runbook-path",
          "data-step-count": normalized.items.length,
        },
        h(
          "header",
          { className: "markdown-procedure-header" },
          h(
            "span",
            { className: "markdown-procedure-rail" },
            h(
              "span",
              { className: "markdown-procedure-kind" },
              `PROCEDURE / ${String(normalized.items.length).padStart(2, "0")} STEPS`,
            ),
            h("span", { className: "markdown-procedure-mode" }, "ORDERED · STATIC"),
          ),
          h("strong", { className: "markdown-procedure-title" }, normalized.title),
        ),
        h(
          "ol",
          { className: "markdown-procedure-items" },
          ...normalized.items.map((item, index) => previewStep(h, item, index)),
        ),
      );
    },
  };
}

export function registerStudioStepsEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 步骤流程组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioStepsEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.stepsEditor = "registered";
  return definition;
}
