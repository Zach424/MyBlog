import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_TASK_LIST_MAX_COUNT = 4;
export const MARKDOWN_TASK_LIST_MIN_ITEMS = 2;
export const MARKDOWN_TASK_LIST_MAX_ITEMS = 20;
export const MARKDOWN_TASK_LIST_MAX_TOTAL_ITEMS = 40;
export const MARKDOWN_TASK_LIST_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_TASK_LIST_MAX_ITEM_LENGTH = 240;

export interface MarkdownTaskListItem {
  completed: boolean;
  text: string;
}

export interface MarkdownTaskListSource {
  completeCount: number;
  items: MarkdownTaskListItem[];
  line?: number;
  pendingCount: number;
  title: string;
}

export interface MarkdownTaskListIssue {
  kind: "task-list";
  line?: number;
  message: string;
}

class MarkdownTaskListError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const TASK_LIST_MARKER = /^\[!tasks\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_TASK_LIST_MARKER = /^\[!tasks\](?:[+\-]|[ \t]|$)/iu;

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

function taskListMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const children = visibleMarkdownChildren(first);
  const marker =
    children.length === 1 && children[0]?.type === "text"
      ? children[0]
      : undefined;
  return marker && POTENTIAL_TASK_LIST_MARKER.test(marker.value ?? "")
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

function validateInlineNode(node: MarkdownNode, line?: number) {
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
    for (const child of node.children ?? []) validateInlineNode(child, line);
    return;
  }
  throw new MarkdownTaskListError(
    "任务项只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注、换行与嵌套列表请移到任务清单外。",
    line,
  );
}

function taskListFromMarkdownNode(
  blockquote: MarkdownNode,
): MarkdownTaskListSource | undefined {
  const markerNode = taskListMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  const marker = TASK_LIST_MARKER.exec(markerNode.value ?? "");
  if (!marker) {
    throw new MarkdownTaskListError(
      "任务清单标记必须写成静态的 > [!tasks] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title) {
    throw new MarkdownTaskListError("任务清单必须填写可见标题。", line);
  }
  if (title.length > MARKDOWN_TASK_LIST_MAX_TITLE_LENGTH) {
    throw new MarkdownTaskListError(
      `任务清单标题不能超过 ${MARKDOWN_TASK_LIST_MAX_TITLE_LENGTH} 个字符。`,
      line,
    );
  }

  const children = visibleMarkdownChildren(blockquote);
  const list = children[1];
  if (
    children.length !== 2 ||
    list?.type !== "list" ||
    list.ordered === true ||
    list.spread === true
  ) {
    throw new MarkdownTaskListError(
      "任务清单标题后必须紧跟一个无序 GFM 任务列表，区块内不能混入段落、编号列表或嵌套内容。",
      line,
    );
  }
  const listItems = visibleMarkdownChildren(list);
  if (
    listItems.length < MARKDOWN_TASK_LIST_MIN_ITEMS ||
    listItems.length > MARKDOWN_TASK_LIST_MAX_ITEMS
  ) {
    throw new MarkdownTaskListError(
      `每个任务清单必须包含 ${MARKDOWN_TASK_LIST_MIN_ITEMS}–${MARKDOWN_TASK_LIST_MAX_ITEMS} 项任务。`,
      list.position?.start?.line ?? line,
    );
  }

  const items = listItems.map<MarkdownTaskListItem>((item, index) => {
    const itemLine = item.position?.start?.line ?? line;
    const itemChildren = visibleMarkdownChildren(item);
    if (
      item.type !== "listItem" ||
      typeof item.checked !== "boolean" ||
      item.spread === true ||
      itemChildren.length !== 1 ||
      itemChildren[0]?.type !== "paragraph"
    ) {
      throw new MarkdownTaskListError(
        `第 ${index + 1} 项必须是单段 [ ] 或 [x] 任务，不能嵌套子列表或附加段落。`,
        itemLine,
      );
    }
    const paragraph = itemChildren[0];
    for (const child of paragraph.children ?? []) {
      validateInlineNode(child, itemLine);
    }
    const value = inlineText(paragraph).replace(/\s+/gu, " ").trim();
    if (!value) {
      throw new MarkdownTaskListError(`第 ${index + 1} 项任务不能为空。`, itemLine);
    }
    if (value.length > MARKDOWN_TASK_LIST_MAX_ITEM_LENGTH) {
      throw new MarkdownTaskListError(
        `第 ${index + 1} 项任务不能超过 ${MARKDOWN_TASK_LIST_MAX_ITEM_LENGTH} 个字符。`,
        itemLine,
      );
    }
    return { completed: item.checked, text: value };
  });

  const normalizedItems = items.map((item) =>
    item.text.normalize("NFKC").trim().toLocaleLowerCase("zh-CN"),
  );
  if (new Set(normalizedItems).size !== normalizedItems.length) {
    throw new MarkdownTaskListError("同一任务清单不能包含重复任务。", line);
  }
  const completeCount = items.filter((item) => item.completed).length;

  return {
    completeCount,
    items,
    ...(line ? { line } : {}),
    pendingCount: items.length - completeCount,
    title,
  };
}

function parseMarkdownTaskLists(markdown: string) {
  const taskLists: MarkdownTaskListSource[] = [];
  const tree = parseMarkdown(markdown);

  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && taskListMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownTaskListError(
          "任务清单必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const taskList = taskListFromMarkdownNode(node);
      if (taskList) taskLists.push(taskList);
      return;
    }
    if (
      node.type === "list" &&
      (node.children ?? []).some(
        (child) => child.type === "listItem" && typeof child.checked === "boolean",
      )
    ) {
      throw new MarkdownTaskListError(
        "GFM 任务列表必须放入带标题的 > [!tasks] 任务清单区块，避免无标题或无预算的任务进入公开页面。",
        node.position?.start?.line,
      );
    }
    for (const child of node.children ?? []) walk(child, node);
  }

  walk(tree);
  if (taskLists.length > MARKDOWN_TASK_LIST_MAX_COUNT) {
    throw new MarkdownTaskListError(
      `每篇内容最多允许 ${MARKDOWN_TASK_LIST_MAX_COUNT} 个任务清单。`,
    );
  }
  const totalItems = taskLists.reduce(
    (total, taskList) => total + taskList.items.length,
    0,
  );
  if (totalItems > MARKDOWN_TASK_LIST_MAX_TOTAL_ITEMS) {
    throw new MarkdownTaskListError(
      `每篇内容的任务清单合计最多允许 ${MARKDOWN_TASK_LIST_MAX_TOTAL_ITEMS} 项任务。`,
    );
  }
  return taskLists;
}

export function extractMarkdownTaskLists(markdown: string) {
  return parseMarkdownTaskLists(markdown);
}

export function getMarkdownTaskListIssue(
  markdown: string,
): MarkdownTaskListIssue | undefined {
  try {
    parseMarkdownTaskLists(markdown);
    return undefined;
  } catch (error) {
    return {
      kind: "task-list",
      ...(error instanceof MarkdownTaskListError && error.line
        ? { line: error.line }
        : {}),
      message: compactError(error) || "任务清单声明无法解析。",
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

function taskListFromHastBlockquote(blockquote: Element, index: number) {
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
  if (!markerChild || !POTENTIAL_TASK_LIST_MARKER.test(markerChild.value)) {
    return undefined;
  }
  const marker = TASK_LIST_MARKER.exec(markerChild.value);
  if (!marker || !marker[1]?.trim()) {
    throw new MarkdownTaskListError(
      "任务清单标记必须写成静态的 > [!tasks] 标题。",
    );
  }
  const title = marker[1].trim();
  const list =
    children.length === 2 &&
    isElement(children[1]) &&
    children[1].tagName === "ul"
      ? children[1]
      : undefined;
  if (!list) {
    throw new MarkdownTaskListError(
      "任务清单标题后必须紧跟一个无序 GFM 任务列表。",
    );
  }
  const items = visibleHastChildren(list).filter(
    (child): child is Element => isElement(child) && child.tagName === "li",
  );
  if (
    items.length < MARKDOWN_TASK_LIST_MIN_ITEMS ||
    items.length > MARKDOWN_TASK_LIST_MAX_ITEMS
  ) {
    throw new MarkdownTaskListError("任务清单的任务数量超出发布预算。");
  }

  let completeCount = 0;
  const renderedItems = items.map((item) => {
    const inputIndex = item.children.findIndex(
      (child) => isElement(child) && child.tagName === "input",
    );
    const input = inputIndex >= 0 ? item.children[inputIndex] : undefined;
    if (!input || !isElement(input)) {
      throw new MarkdownTaskListError("任务清单包含缺少 [ ] 或 [x] 状态的项目。");
    }
    const completed = input.properties.checked === true;
    if (completed) completeCount += 1;
    const copy = item.children.filter((_, childIndex) => childIndex !== inputIndex);
    const itemText = hastText(item).replace(/\s+/gu, " ").trim();
    input.properties = {
      ...input.properties,
      ariaLabel: `${completed ? "已完成" : "待完成"}：${itemText}`,
      className: ["markdown-task-input"],
      disabled: true,
    };
    return element(
      "li",
      {
        className: [
          "markdown-task-item",
          completed ? "is-complete" : "is-pending",
        ],
        dataTaskState: completed ? "complete" : "pending",
      },
      [
        element("span", { className: ["markdown-task-control"] }, [
          input,
          element(
            "span",
            { ariaHidden: "true", className: ["markdown-task-mark"] },
            [text(completed ? "✓" : "")],
          ),
        ]),
        element("span", { className: ["markdown-task-copy"] }, copy),
        element(
          "span",
          { ariaHidden: "true", className: ["markdown-task-state"] },
          [text(completed ? "DONE" : "OPEN")],
        ),
      ],
    );
  });
  const total = renderedItems.length;
  const pendingCount = total - completeCount;
  const titleId = `markdown-task-list-${index}-title`;

  return element(
    "div",
    {
      ariaLabelledBy: [titleId],
      className: ["markdown-task-ledger"],
      dataTaskComplete: completeCount,
      dataTaskList: "readonly-ledger",
      dataTaskPending: pendingCount,
      dataTaskTotal: total,
      role: "group",
    },
    [
      element("div", { className: ["markdown-task-header"] }, [
        element("span", { className: ["markdown-task-rail"] }, [
          element("span", { className: ["markdown-task-kind"] }, [
            text(`TASK LEDGER / ${String(total).padStart(2, "0")} ITEMS`),
          ]),
          element("span", { className: ["markdown-task-counts"] }, [
            text(
              `${String(completeCount).padStart(2, "0")} DONE · ${String(pendingCount).padStart(2, "0")} OPEN`,
            ),
          ]),
        ]),
        element(
          "strong",
          { className: ["markdown-task-title"], id: titleId },
          [text(title)],
        ),
        element("span", { className: ["markdown-task-progress-row"] }, [
          element(
            "progress",
            {
              ariaLabel: `${title}，已完成 ${completeCount} 项，共 ${total} 项`,
              className: ["markdown-task-progress"],
              max: String(total),
              value: String(completeCount),
            },
            [text(`${completeCount}/${total}`)],
          ),
          element("span", { className: ["markdown-task-ratio"] }, [
            text(`${Math.round((completeCount / total) * 100)}% COMPLETE`),
          ]),
        ]),
      ]),
      element(
        "ul",
        { className: ["markdown-task-items"] },
        renderedItems,
      ),
    ],
  );
}

export function rehypeMarkdownTaskLists() {
  return function transform(tree: Root) {
    let taskListCount = 0;
    let totalItems = 0;

    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const taskList = taskListFromHastBlockquote(child, taskListCount + 1);
      if (!taskList) continue;
      taskListCount += 1;
      totalItems += Number(taskList.properties.dataTaskTotal);
      if (taskListCount > MARKDOWN_TASK_LIST_MAX_COUNT) {
        throw new MarkdownTaskListError(
          `每篇内容最多允许 ${MARKDOWN_TASK_LIST_MAX_COUNT} 个任务清单。`,
        );
      }
      if (totalItems > MARKDOWN_TASK_LIST_MAX_TOTAL_ITEMS) {
        throw new MarkdownTaskListError(
          `每篇内容的任务清单合计最多允许 ${MARKDOWN_TASK_LIST_MAX_TOTAL_ITEMS} 项任务。`,
        );
      }
      tree.children[index] = taskList as RootContent;
    }
  };
}

export function normalizeMarkdownTaskListsForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && taskListMarkerNode(node)) {
      const marker = taskListMarkerNode(node);
      const parsed = marker ? TASK_LIST_MARKER.exec(marker.value ?? "") : undefined;
      if (marker && parsed?.[1]) marker.value = parsed[1].trim();
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }

  walk(tree);
  return tree;
}
