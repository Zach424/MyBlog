import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_TIMELINE_MAX_COUNT = 3;
export const MARKDOWN_TIMELINE_MIN_EVENTS = 2;
export const MARKDOWN_TIMELINE_MAX_EVENTS = 16;
export const MARKDOWN_TIMELINE_MAX_TOTAL_EVENTS = 32;
export const MARKDOWN_TIMELINE_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_TIMELINE_MAX_EVENT_TITLE_LENGTH = 120;
export const MARKDOWN_TIMELINE_MAX_DESCRIPTION_LENGTH = 600;
export const MARKDOWN_TIMELINE_EVENT_TYPES = [
  "START",
  "DECISION",
  "SHIP",
  "CHANGE",
  "VERIFY",
  "RETIRE",
] as const;

export type MarkdownTimelineEventType =
  (typeof MARKDOWN_TIMELINE_EVENT_TYPES)[number];

export interface MarkdownTimelineEvent {
  date: string;
  description: string;
  line?: number;
  title: string;
  type: MarkdownTimelineEventType;
}

export interface MarkdownTimelineSource {
  events: MarkdownTimelineEvent[];
  line?: number;
  title: string;
}

export interface MarkdownTimelineIssue {
  kind: "timeline";
  line?: number;
  message: string;
}

export interface MarkdownTimelineOptions {
  maximumDate?: string;
}

class MarkdownTimelineError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const TIMELINE_MARKER = /^\[!timeline\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_TIMELINE_MARKER = /^\[!timeline\](?:[+\-]|[ \t]|$)/iu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const EVENT_TYPE = new Set<string>(MARKDOWN_TIMELINE_EVENT_TYPES);

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 320);
}

function visibleMarkdownChildren(node: MarkdownNode) {
  return (node.children ?? []).filter(
    (child) => child.type !== "text" || (child.value ?? "").trim() !== "",
  );
}

function timelineMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const children = visibleMarkdownChildren(first);
  const marker = children[0]?.type === "text" ? children[0] : undefined;
  return marker && POTENTIAL_TIMELINE_MARKER.test(marker.value ?? "")
    ? marker
    : undefined;
}

function inlineText(node: MarkdownNode): string {
  if (
    node.type === "text" ||
    node.type === "inlineCode" ||
    node.type === "inlineMath"
  ) {
    return node.value ?? "";
  }
  return (node.children ?? []).map(inlineText).join("");
}

function isRealIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateDescriptionInline(node: MarkdownNode, line?: number) {
  if (
    node.type === "text" ||
    node.type === "inlineCode" ||
    node.type === "inlineMath"
  ) {
    return;
  }
  if (
    node.type === "emphasis" ||
    node.type === "strong" ||
    node.type === "delete" ||
    node.type === "link" ||
    node.type === "linkReference"
  ) {
    for (const child of node.children ?? []) validateDescriptionInline(child, line);
    return;
  }
  throw new MarkdownTimelineError(
    "里程碑说明只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注、硬换行与嵌套内容请移到时间线外。",
    line,
  );
}

function eventTitleFromStrong(strong: MarkdownNode, line?: number) {
  for (const child of strong.children ?? []) {
    if (child.type !== "text" && child.type !== "inlineCode") {
      throw new MarkdownTimelineError(
        "里程碑标题只接受单行文本或行内代码，不能包含链接、图片或额外格式。",
        line,
      );
    }
  }
  const title = inlineText(strong).replace(/\s+/gu, " ").trim();
  if (!title || title.length > MARKDOWN_TIMELINE_MAX_EVENT_TITLE_LENGTH) {
    throw new MarkdownTimelineError(
      `里程碑标题必须为 1–${MARKDOWN_TIMELINE_MAX_EVENT_TITLE_LENGTH} 个字符。`,
      line,
    );
  }
  return title;
}

function eventFromMarkdownNode(
  item: MarkdownNode,
  index: number,
): MarkdownTimelineEvent {
  const line = item.position?.start?.line;
  const children = visibleMarkdownChildren(item);
  const heading = children[0];
  const descriptionParagraph = children[1];
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    children.length !== 2 ||
    heading?.type !== "paragraph" ||
    descriptionParagraph?.type !== "paragraph"
  ) {
    throw new MarkdownTimelineError(
      `第 ${index + 1} 个里程碑必须包含“日期 + 类型 + 粗体标题”和一段说明，不能使用任务状态、嵌套列表或额外段落。`,
      line,
    );
  }
  const headingChildren = heading.children ?? [];
  const [dateNode, firstSpace, typeNode, secondSpace, titleNode] = headingChildren;
  if (
    headingChildren.length !== 5 ||
    dateNode?.type !== "inlineCode" ||
    firstSpace?.type !== "text" ||
    firstSpace.value !== " " ||
    typeNode?.type !== "inlineCode" ||
    secondSpace?.type !== "text" ||
    secondSpace.value !== " " ||
    titleNode?.type !== "strong"
  ) {
    throw new MarkdownTimelineError(
      `第 ${index + 1} 个里程碑首行必须写成 \`YYYY-MM-DD\` \`TYPE\` **标题**。`,
      line,
    );
  }
  const date = (dateNode.value ?? "").trim();
  if (!isRealIsoDate(date)) {
    throw new MarkdownTimelineError(
      `第 ${index + 1} 个里程碑日期必须是真实的 YYYY-MM-DD。`,
      line,
    );
  }
  const type = (typeNode.value ?? "").trim();
  if (!EVENT_TYPE.has(type)) {
    throw new MarkdownTimelineError(
      `第 ${index + 1} 个里程碑类型只允许 ${MARKDOWN_TIMELINE_EVENT_TYPES.join(" / ")}。`,
      line,
    );
  }
  const title = eventTitleFromStrong(titleNode, line);
  for (const child of descriptionParagraph.children ?? []) {
    validateDescriptionInline(child, descriptionParagraph.position?.start?.line ?? line);
  }
  const description = inlineText(descriptionParagraph)
    .replace(/\s+/gu, " ")
    .trim();
  if (
    !description ||
    description.length > MARKDOWN_TIMELINE_MAX_DESCRIPTION_LENGTH
  ) {
    throw new MarkdownTimelineError(
      `第 ${index + 1} 个里程碑说明必须为 1–${MARKDOWN_TIMELINE_MAX_DESCRIPTION_LENGTH} 个字符。`,
      descriptionParagraph.position?.start?.line ?? line,
    );
  }
  return {
    date,
    description,
    ...(line ? { line } : {}),
    title,
    type: type as MarkdownTimelineEventType,
  };
}

function timelineFromMarkdownNode(
  blockquote: MarkdownNode,
): MarkdownTimelineSource | undefined {
  const markerNode = timelineMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  const marker = TIMELINE_MARKER.exec(markerNode.value ?? "");
  if (!marker) {
    throw new MarkdownTimelineError(
      "项目时间线标记必须写成静态的 > [!timeline] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_TIMELINE_MAX_TITLE_LENGTH) {
    throw new MarkdownTimelineError(
      `项目时间线必须填写 1–${MARKDOWN_TIMELINE_MAX_TITLE_LENGTH} 个字符的可见标题。`,
      line,
    );
  }
  const children = visibleMarkdownChildren(blockquote);
  const list = children[1];
  if (
    children.length !== 2 ||
    list?.type !== "list" ||
    list.ordered !== false
  ) {
    throw new MarkdownTimelineError(
      "项目时间线标题后必须紧跟无序列表，区块内不能混入有序列表或其他段落。",
      line,
    );
  }
  const rawEvents = visibleMarkdownChildren(list);
  if (
    rawEvents.length < MARKDOWN_TIMELINE_MIN_EVENTS ||
    rawEvents.length > MARKDOWN_TIMELINE_MAX_EVENTS
  ) {
    throw new MarkdownTimelineError(
      `每个项目时间线必须包含 ${MARKDOWN_TIMELINE_MIN_EVENTS}–${MARKDOWN_TIMELINE_MAX_EVENTS} 个里程碑。`,
      list.position?.start?.line ?? line,
    );
  }
  const events = rawEvents.map(eventFromMarkdownNode);
  for (let index = 1; index < events.length; index += 1) {
    if (events[index].date < events[index - 1].date) {
      throw new MarkdownTimelineError(
        `项目时间线必须按日期从早到晚排列；第 ${index + 1} 项早于前一项。`,
        events[index].line,
      );
    }
  }
  const keys = events.map((event) =>
    `${event.date}\u0000${event.title.normalize("NFKC").toLocaleLowerCase("zh-CN")}`,
  );
  if (new Set(keys).size !== keys.length) {
    throw new MarkdownTimelineError(
      "同一项目时间线不能包含日期与标题都相同的重复里程碑。",
      line,
    );
  }
  return { events, ...(line ? { line } : {}), title };
}

function parseMarkdownTimelines(
  markdown: string,
  options: MarkdownTimelineOptions = {},
) {
  const timelines: MarkdownTimelineSource[] = [];
  const tree = parseMarkdown(markdown);

  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && timelineMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownTimelineError(
          "项目时间线必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const timeline = timelineFromMarkdownNode(node);
      if (timeline) timelines.push(timeline);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }

  walk(tree);
  if (timelines.length > MARKDOWN_TIMELINE_MAX_COUNT) {
    throw new MarkdownTimelineError(
      `每篇内容最多允许 ${MARKDOWN_TIMELINE_MAX_COUNT} 个项目时间线。`,
    );
  }
  const totalEvents = timelines.reduce(
    (total, timeline) => total + timeline.events.length,
    0,
  );
  if (totalEvents > MARKDOWN_TIMELINE_MAX_TOTAL_EVENTS) {
    throw new MarkdownTimelineError(
      `每篇内容的项目时间线合计最多允许 ${MARKDOWN_TIMELINE_MAX_TOTAL_EVENTS} 个里程碑。`,
    );
  }
  if (options.maximumDate) {
    if (!isRealIsoDate(options.maximumDate)) {
      throw new MarkdownTimelineError("项目时间线的最大日期边界无效。");
    }
    const future = timelines
      .flatMap((timeline) => timeline.events)
      .find((event) => event.date > options.maximumDate!);
    if (future) {
      throw new MarkdownTimelineError(
        `项目时间线只记录已发生事件；${future.date} 晚于当前内容日期 ${options.maximumDate}。`,
        future.line,
      );
    }
  }
  return timelines;
}

export function extractMarkdownTimelines(
  markdown: string,
  options: MarkdownTimelineOptions = {},
) {
  return parseMarkdownTimelines(markdown, options);
}

export function getMarkdownTimelineIssue(
  markdown: string,
  options: MarkdownTimelineOptions = {},
): MarkdownTimelineIssue | undefined {
  try {
    parseMarkdownTimelines(markdown, options);
    return undefined;
  } catch (error) {
    return {
      kind: "timeline",
      ...(error instanceof MarkdownTimelineError && error.line
        ? { line: error.line }
        : {}),
      message: compactError(error) || "项目时间线无法解析。",
    };
  }
}

function isElement(node: ElementContent | RootContent): node is Element {
  return node.type === "element";
}

function isText(node: ElementContent | RootContent): node is Text {
  return node.type === "text";
}

function visibleHastChildren(node: Element) {
  return node.children.filter(
    (child) => !isText(child) || child.value.trim() !== "",
  );
}

function text(value: string): Text {
  return { type: "text", value };
}

function element(
  tagName: string,
  properties: Element["properties"],
  children: ElementContent[],
): Element {
  return { children, properties, tagName, type: "element" };
}

function hastText(node: ElementContent): string {
  if (isText(node)) return node.value;
  if (!isElement(node)) return "";
  return node.children.map(hastText).join("");
}

function renderedEventFromHast(item: Element) {
  const children = visibleHastChildren(item);
  const heading = children[0];
  const description = children[1];
  if (
    children.length !== 2 ||
    !isElement(heading) ||
    heading.tagName !== "p" ||
    !isElement(description) ||
    description.tagName !== "p"
  ) {
    throw new MarkdownTimelineError("里程碑必须包含首行和一段说明。");
  }
  const headingChildren = heading.children;
  const [dateNode, firstSpace, typeNode, secondSpace, titleNode] = headingChildren;
  if (
    headingChildren.length !== 5 ||
    !isElement(dateNode) ||
    dateNode.tagName !== "code" ||
    !isText(firstSpace) ||
    firstSpace.value !== " " ||
    !isElement(typeNode) ||
    typeNode.tagName !== "code" ||
    !isText(secondSpace) ||
    secondSpace.value !== " " ||
    !isElement(titleNode) ||
    titleNode.tagName !== "strong"
  ) {
    throw new MarkdownTimelineError("里程碑首行缺少日期、类型或粗体标题。");
  }
  const date = hastText(dateNode).trim();
  const type = hastText(typeNode).trim();
  if (!isRealIsoDate(date) || !EVENT_TYPE.has(type)) {
    throw new MarkdownTimelineError("里程碑日期或类型无效。");
  }
  const [year, month, day] = date.split("-");
  return element(
    "li",
    {
      className: ["markdown-timeline-event"],
      dataEventType: type.toLocaleLowerCase("en-US"),
    },
    [
      element("span", { ariaHidden: "true", className: ["markdown-timeline-trace"] }, [
        element("span", { className: ["markdown-timeline-node"] }, []),
      ]),
      element("time", { className: ["markdown-timeline-date"], dateTime: date }, [
        element("span", { className: ["markdown-timeline-year"] }, [text(year)]),
        element("span", { className: ["markdown-timeline-day"] }, [text(`${month}.${day}`)]),
      ]),
      element("span", { className: ["markdown-timeline-copy"] }, [
        element("span", { className: ["markdown-timeline-event-type"] }, [text(type)]),
        element("strong", { className: ["markdown-timeline-event-title"] }, titleNode.children),
        element("span", { className: ["markdown-timeline-description"] }, description.children),
      ]),
    ],
  );
}

function timelineFromHastBlockquote(blockquote: Element, index: number) {
  const children = visibleHastChildren(blockquote);
  const markerParagraph =
    children[0] && isElement(children[0]) && children[0].tagName === "p"
      ? children[0]
      : undefined;
  const markerChildren = markerParagraph
    ? visibleHastChildren(markerParagraph)
    : [];
  const markerChild =
    markerChildren.length === 1 && isText(markerChildren[0])
      ? markerChildren[0]
      : undefined;
  if (!markerChild || !POTENTIAL_TIMELINE_MARKER.test(markerChild.value)) {
    return undefined;
  }
  const marker = TIMELINE_MARKER.exec(markerChild.value);
  if (!marker?.[1]?.trim()) {
    throw new MarkdownTimelineError(
      "项目时间线标记必须写成静态的 > [!timeline] 标题。",
    );
  }
  const list =
    children.length === 2 &&
    isElement(children[1]) &&
    children[1].tagName === "ul"
      ? children[1]
      : undefined;
  if (!list) throw new MarkdownTimelineError("项目时间线标题后必须紧跟无序列表。");
  const items = visibleHastChildren(list).filter(
    (child): child is Element => isElement(child) && child.tagName === "li",
  );
  if (
    items.length < MARKDOWN_TIMELINE_MIN_EVENTS ||
    items.length > MARKDOWN_TIMELINE_MAX_EVENTS
  ) {
    throw new MarkdownTimelineError("项目时间线里程碑数量超出发布预算。");
  }
  const dates = items.map((item) => {
    const heading = visibleHastChildren(item)[0];
    const dateNode = isElement(heading) ? visibleHastChildren(heading)[0] : undefined;
    return dateNode && isElement(dateNode) ? hastText(dateNode).trim() : "";
  });
  const titleId = `markdown-timeline-${index}-title`;
  return element(
    "section",
    {
      ariaLabelledBy: [titleId],
      className: ["markdown-timeline"],
      dataEventCount: items.length,
      dataTimeline: "release-tape",
    },
    [
      element("header", { className: ["markdown-timeline-header"] }, [
        element("span", { className: ["markdown-timeline-rail"] }, [
          element("span", { className: ["markdown-timeline-kind"] }, [
            text(`HISTORY / ${String(items.length).padStart(2, "0")} EVENTS`),
          ]),
          element("span", { className: ["markdown-timeline-range"] }, [
            text(`${dates[0]} → ${dates.at(-1)}`),
          ]),
        ]),
        element(
          "strong",
          { className: ["markdown-timeline-title"], id: titleId },
          [text(marker[1].trim())],
        ),
      ]),
      element(
        "ol",
        { className: ["markdown-timeline-items"] },
        items.map(renderedEventFromHast),
      ),
    ],
  );
}

export function rehypeMarkdownTimelines() {
  return function transform(tree: Root) {
    let timelineCount = 0;
    let totalEvents = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const timeline = timelineFromHastBlockquote(child, timelineCount + 1);
      if (!timeline) continue;
      timelineCount += 1;
      totalEvents += Number(timeline.properties.dataEventCount);
      if (timelineCount > MARKDOWN_TIMELINE_MAX_COUNT) {
        throw new MarkdownTimelineError(
          `每篇内容最多允许 ${MARKDOWN_TIMELINE_MAX_COUNT} 个项目时间线。`,
        );
      }
      if (totalEvents > MARKDOWN_TIMELINE_MAX_TOTAL_EVENTS) {
        throw new MarkdownTimelineError(
          `每篇内容的项目时间线合计最多允许 ${MARKDOWN_TIMELINE_MAX_TOTAL_EVENTS} 个里程碑。`,
        );
      }
      tree.children[index] = timeline as RootContent;
    }
  };
}

export function normalizeMarkdownTimelinesForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && timelineMarkerNode(node)) {
      const marker = timelineMarkerNode(node);
      const parsed = marker ? TIMELINE_MARKER.exec(marker.value ?? "") : undefined;
      if (marker && parsed?.[1]) marker.value = parsed[1].trim();
      const list = visibleMarkdownChildren(node)[1];
      for (const item of list?.children ?? []) {
        const heading = visibleMarkdownChildren(item)[0];
        const children = heading?.children ?? [];
        const typeNode = children[2];
        const secondSpace = children[3];
        if (typeNode?.type === "inlineCode" && EVENT_TYPE.has(typeNode.value ?? "")) {
          typeNode.value = "";
          if (secondSpace?.type === "text") secondSpace.value = "";
        }
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
