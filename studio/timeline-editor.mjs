export const STUDIO_TIMELINE_EDITOR_ID = "myblog-timeline";
export const STUDIO_TIMELINE_MIN_EVENTS = 2;
export const STUDIO_TIMELINE_MAX_EVENTS = 16;
export const STUDIO_TIMELINE_EVENT_TYPES = [
  "START",
  "DECISION",
  "SHIP",
  "CHANGE",
  "VERIFY",
  "RETIRE",
];

const TIMELINE_EVENT_SOURCE = String.raw`> - \x60(\d{4}-\d{2}-\d{2})\x60 \x60(START|DECISION|SHIP|CHANGE|VERIFY|RETIRE)\x60 \*\*([^*\r\n]{1,120})\*\*\r?\n>\r?\n> {3}([^\r\n]{1,600})`;
export const STUDIO_TIMELINE_PATTERN = new RegExp(
  String.raw`^> \[!timeline\] ([^\[\]\r\n]{1,120})\r?\n((?:${TIMELINE_EVENT_SOURCE}(?:\r?\n|$)){2,16})(?!> - \x60\d{4}-\d{2}-\d{2})`,
  "imu",
);
const REGISTRATION_KEY = "__MYBLOG_TIMELINE_EDITOR_COMPONENT__";
const EVENT_TYPES = new Set(STUDIO_TIMELINE_EVENT_TYPES);

function plainValue(value) {
  return value && typeof value.toJS === "function" ? value.toJS() : value;
}

function normalizedData(data) {
  const value = plainValue(data) ?? {};
  const rawEvents = plainValue(value.events);
  return {
    events: Array.isArray(rawEvents)
      ? rawEvents.map((candidate) => {
          const event = plainValue(candidate) ?? {};
          return {
            date: typeof event.date === "string" ? event.date.trim() : "",
            description:
              typeof event.description === "string" ? event.description.trim() : "",
            title: typeof event.title === "string" ? event.title.trim() : "",
            type: typeof event.type === "string" ? event.type.trim() : "",
          };
        })
      : [],
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function isRealIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateDescription(value, index) {
  if (!value || value.length > 600 || /[\r\n]/u.test(value)) {
    throw new Error(`第 ${index + 1} 个里程碑说明必须是 1–600 字符的单行内容。`);
  }
  if (/!\[|<[^>]+>|\[\^/u.test(value)) {
    throw new Error(`第 ${index + 1} 个里程碑说明不能包含图片、HTML 或脚注。`);
  }
}

function validateTimeline(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("项目时间线标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (
    normalized.events.length < STUDIO_TIMELINE_MIN_EVENTS ||
    normalized.events.length > STUDIO_TIMELINE_MAX_EVENTS
  ) {
    throw new Error(
      `项目时间线必须包含 ${STUDIO_TIMELINE_MIN_EVENTS}–${STUDIO_TIMELINE_MAX_EVENTS} 个里程碑。`,
    );
  }
  normalized.events.forEach((event, index) => {
    if (!isRealIsoDate(event.date)) {
      throw new Error(`第 ${index + 1} 个里程碑日期必须是真实的 YYYY-MM-DD。`);
    }
    if (!EVENT_TYPES.has(event.type)) {
      throw new Error(
        `第 ${index + 1} 个里程碑类型只允许 ${STUDIO_TIMELINE_EVENT_TYPES.join(" / ")}。`,
      );
    }
    if (!event.title || event.title.length > 120 || /[*\r\n]/u.test(event.title)) {
      throw new Error(`第 ${index + 1} 个里程碑标题必须是 1–120 字符的单行文本，且不能包含 *。`);
    }
    validateDescription(event.description, index);
    if (index > 0 && event.date < normalized.events[index - 1].date) {
      throw new Error(`第 ${index + 1} 个里程碑日期不能早于前一项。`);
    }
  });
  const keys = normalized.events.map((event) =>
    `${event.date}\u0000${event.title.normalize("NFKC").toLocaleLowerCase("zh-CN")}`,
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error("同一项目时间线不能包含日期与标题都相同的重复里程碑。");
  }
  return normalized;
}

function serializeTimeline(data) {
  const normalized = validateTimeline(data);
  const lines = [`> [!timeline] ${normalized.title}`];
  for (const event of normalized.events) {
    lines.push(
      `> - \`${event.date}\` \`${event.type}\` **${event.title}**`,
      ">",
      `>   ${event.description}`,
    );
  }
  return lines.join("\n");
}

function parseTimelineMatch(match) {
  if (!match) throw new Error("无法解析 Studio 项目时间线。");
  const eventMatches = [
    ...match[2].trimEnd().matchAll(new RegExp(TIMELINE_EVENT_SOURCE, "giu")),
  ];
  return validateTimeline({
    events: eventMatches.map((event) => ({
      date: event[1],
      type: event[2],
      title: event[3],
      description: event[4],
    })),
    title: match[1],
  });
}

function previewEvent(h, event, index) {
  const [year, month, day] = event.date.split("-");
  return h(
    "li",
    {
      className: "markdown-timeline-event",
      "data-event-type": event.type.toLocaleLowerCase("en-US"),
      key: `${event.date}-${event.title}-${index}`,
    },
    h(
      "span",
      { className: "markdown-timeline-trace", "aria-hidden": "true" },
      h("span", { className: "markdown-timeline-node" }),
    ),
    h(
      "time",
      { className: "markdown-timeline-date", dateTime: event.date },
      h("span", { className: "markdown-timeline-year" }, year),
      h("span", { className: "markdown-timeline-day" }, `${month}.${day}`),
    ),
    h(
      "span",
      { className: "markdown-timeline-copy" },
      h("span", { className: "markdown-timeline-event-type" }, event.type),
      h("strong", { className: "markdown-timeline-event-title" }, event.title),
      h("span", { className: "markdown-timeline-description" }, event.description),
    ),
  );
}

export function createStudioTimelineEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") {
    throw new Error("Studio 项目时间线组件缺少 React 运行时。");
  }
  return {
    collapsed: false,
    id: STUDIO_TIMELINE_EDITOR_ID,
    label: "项目里程碑时间线",
    fields: [
      {
        hint: "例如：MyBlog 交付里程碑、重构决策记录、版本演进。",
        label: "时间线标题",
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
            date: "2026-07-19",
            description: "用 Markdown、YAML 与 Zod 冻结第一版内容边界。",
            title: "建立内容契约",
            type: "START",
          },
          {
            date: "2026-08-12",
            description: "Studio 与 Obsidian 共享同一套可发布富内容契约。",
            title: "完成双端作者工作流",
            type: "SHIP",
          },
        ],
        fields: [
          {
            format: "YYYY-MM-DD",
            hint: "只记录已经发生的事件；完整发布预检会拒绝未来日期。",
            label: "事件日期",
            name: "date",
            time_format: false,
            picker_utc: false,
            widget: "datetime",
          },
          {
            hint: "START 启动、DECISION 决策、SHIP 交付、CHANGE 变更、VERIFY 验证、RETIRE 退役。",
            label: "事件类型",
            name: "type",
            options: STUDIO_TIMELINE_EVENT_TYPES,
            widget: "select",
          },
          {
            hint: "写清这次里程碑本身，不要重复日期或类型。",
            label: "里程碑标题",
            name: "title",
            pattern: ["^[^*\\r\\n]{1,120}$", "填写 1–120 字符的单行标题，不能包含 *"],
            widget: "string",
          },
          {
            hint: "说明发生了什么以及为什么重要；可使用链接、行内代码、强调和行内公式。",
            label: "简短说明",
            name: "description",
            pattern: ["^[^\\r\\n]{1,600}$", "填写 1–600 字符的单行说明"],
            widget: "text",
          },
        ],
        label: "里程碑事件",
        label_singular: "事件",
        max: STUDIO_TIMELINE_MAX_EVENTS,
        min: STUDIO_TIMELINE_MIN_EVENTS,
        name: "events",
        summary: "{{fields.date}} · {{fields.type}} · {{fields.title}}",
        widget: "list",
      },
    ],
    pattern: STUDIO_TIMELINE_PATTERN,
    fromBlock: parseTimelineMatch,
    toBlock: serializeTimeline,
    toPreview(data) {
      const normalized = validateTimeline(data);
      return h(
        "section",
        {
          className: "markdown-timeline",
          "data-event-count": normalized.events.length,
          "data-timeline": "release-tape",
        },
        h(
          "header",
          { className: "markdown-timeline-header" },
          h(
            "span",
            { className: "markdown-timeline-rail" },
            h("span", { className: "markdown-timeline-kind" }, `HISTORY / ${String(normalized.events.length).padStart(2, "0")} EVENTS`),
            h("span", { className: "markdown-timeline-range" }, `${normalized.events[0].date} → ${normalized.events.at(-1).date}`),
          ),
          h("strong", { className: "markdown-timeline-title" }, normalized.title),
        ),
        h(
          "ol",
          { className: "markdown-timeline-items" },
          ...normalized.events.map((event, index) => previewEvent(h, event, index)),
        ),
      );
    },
  };
}

export function registerStudioTimelineEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 项目时间线组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioTimelineEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.timelineEditor = "registered";
  return definition;
}
