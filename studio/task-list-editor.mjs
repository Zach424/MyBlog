export const STUDIO_TASK_LIST_EDITOR_ID = "myblog-task-list";
export const STUDIO_TASK_LIST_MIN_ITEMS = 2;
export const STUDIO_TASK_LIST_MAX_ITEMS = 20;

const TASK_LINE_SOURCE = String.raw`> - \[[ xX]\] [^\r\n]+`;
export const STUDIO_TASK_LIST_PATTERN = new RegExp(
  String.raw`^> \[!tasks\] ([^\[\]\r\n]{1,120})\r?\n((?:${TASK_LINE_SOURCE}(?:\r?\n|$)){2,20})(?!> - \[[ xX]\])`,
  "imu",
);
const REGISTRATION_KEY = "__MYBLOG_TASK_LIST_EDITOR_COMPONENT__";

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
            completed: item.completed === true,
            text: typeof item.text === "string" ? item.text.trim() : "",
          };
        })
      : [],
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function validateTaskList(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("任务清单标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (
    normalized.items.length < STUDIO_TASK_LIST_MIN_ITEMS ||
    normalized.items.length > STUDIO_TASK_LIST_MAX_ITEMS
  ) {
    throw new Error(
      `任务清单必须包含 ${STUDIO_TASK_LIST_MIN_ITEMS}–${STUDIO_TASK_LIST_MAX_ITEMS} 项任务。`,
    );
  }
  const keys = normalized.items.map((item, index) => {
    if (!item.text || item.text.length > 240 || /[\r\n]/u.test(item.text)) {
      throw new Error(`第 ${index + 1} 项任务必须是 1–240 字符的单行内容。`);
    }
    return item.text.normalize("NFKC").toLocaleLowerCase("zh-CN");
  });
  if (new Set(keys).size !== keys.length) {
    throw new Error("同一任务清单不能包含重复任务。");
  }
  return normalized;
}

function serializeTaskList(data) {
  const normalized = validateTaskList(data);
  return [
    `> [!tasks] ${normalized.title}`,
    ...normalized.items.map(
      (item) => `> - [${item.completed ? "x" : " "}] ${item.text}`,
    ),
  ].join("\n");
}

function parseTaskListMatch(match) {
  if (!match) throw new Error("无法解析 Studio 任务清单块。");
  const items = match[2]
    .trimEnd()
    .split(/\r?\n/u)
    .map((line) => {
      const item = /^> - \[([ xX])\] (.+)$/u.exec(line);
      if (!item) throw new Error("Studio 任务项必须写成 > - [ ] 或 > - [x]。");
      return { completed: item[1].toLowerCase() === "x", text: item[2] };
    });
  return validateTaskList({ items, title: match[1] });
}

function previewTask(h, item, index) {
  return h(
    "li",
    {
      className: `markdown-task-item ${item.completed ? "is-complete" : "is-pending"}`,
      "data-task-state": item.completed ? "complete" : "pending",
      key: `task-${index + 1}`,
    },
    h(
      "span",
      { className: "markdown-task-control" },
      h("input", {
        "aria-label": `${item.completed ? "已完成" : "待完成"}：${item.text}`,
        checked: item.completed,
        className: "markdown-task-input",
        disabled: true,
        readOnly: true,
        type: "checkbox",
      }),
      h(
        "span",
        { "aria-hidden": "true", className: "markdown-task-mark" },
        item.completed ? "✓" : "",
      ),
    ),
    h("span", { className: "markdown-task-copy" }, item.text),
    h(
      "span",
      { "aria-hidden": "true", className: "markdown-task-state" },
      item.completed ? "DONE" : "OPEN",
    ),
  );
}

export function createStudioTaskListEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") {
    throw new Error("Studio 任务清单组件缺少 React 运行时。");
  }

  return {
    collapsed: false,
    id: STUDIO_TASK_LIST_EDITOR_ID,
    label: "项目任务清单",
    fields: [
      {
        hint: "公开页面会显示此标题、完成数量和只读进度。",
        label: "清单标题",
        name: "title",
        pattern: ["^[^\\[\\]\\r\\n]{1,120}$", "填写 1–120 字符的单行纯文本标题"],
        widget: "string",
      },
      {
        allow_add: true,
        allow_remove: true,
        allow_reorder: true,
        collapsed: false,
        default: [
          { completed: true, text: "冻结内容契约" },
          { completed: false, text: "完成真实主题验收" },
          { completed: false, text: "发布稳定生产" },
        ],
        fields: [
          {
            default: false,
            label: "已完成",
            name: "completed",
            widget: "boolean",
          },
          {
            hint: "可使用简单行内 Markdown；不要插入换行、图片或子列表。",
            label: "任务内容",
            name: "text",
            pattern: ["^[^\\r\\n]{1,240}$", "填写 1–240 字符的单行任务"],
            widget: "string",
          },
        ],
        label: "任务项",
        label_singular: "任务",
        max: STUDIO_TASK_LIST_MAX_ITEMS,
        min: STUDIO_TASK_LIST_MIN_ITEMS,
        name: "items",
        summary: "{{fields.completed}} · {{fields.text}}",
        widget: "list",
      },
    ],
    pattern: STUDIO_TASK_LIST_PATTERN,
    fromBlock: parseTaskListMatch,
    toBlock: serializeTaskList,
    toPreview(data) {
      const normalized = validateTaskList(data);
      const completeCount = normalized.items.filter((item) => item.completed).length;
      const pendingCount = normalized.items.length - completeCount;
      const total = normalized.items.length;
      return h(
        "div",
        {
          className: "markdown-task-ledger",
          "data-task-complete": completeCount,
          "data-task-list": "readonly-ledger",
          "data-task-pending": pendingCount,
          "data-task-total": total,
          role: "group",
        },
        h(
          "div",
          { className: "markdown-task-header" },
          h(
            "span",
            { className: "markdown-task-rail" },
            h(
              "span",
              { className: "markdown-task-kind" },
              `TASK LEDGER / ${String(total).padStart(2, "0")} ITEMS`,
            ),
            h(
              "span",
              { className: "markdown-task-counts" },
              `${String(completeCount).padStart(2, "0")} DONE · ${String(pendingCount).padStart(2, "0")} OPEN`,
            ),
          ),
          h("strong", { className: "markdown-task-title" }, normalized.title),
          h(
            "span",
            { className: "markdown-task-progress-row" },
            h(
              "progress",
              {
                "aria-label": `${normalized.title}，已完成 ${completeCount} 项，共 ${total} 项`,
                className: "markdown-task-progress",
                max: total,
                value: completeCount,
              },
              `${completeCount}/${total}`,
            ),
            h(
              "span",
              { className: "markdown-task-ratio" },
              `${Math.round((completeCount / total) * 100)}% COMPLETE`,
            ),
          ),
        ),
        h(
          "ul",
          { className: "markdown-task-items" },
          ...normalized.items.map((item, index) => previewTask(h, item, index)),
        ),
      );
    },
  };
}

export function registerStudioTaskListEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 任务清单组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];

  const definition = createStudioTaskListEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.taskListEditor = "registered";
  return definition;
}
