import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_STEPS_MAX_COUNT = 3;
export const MARKDOWN_STEPS_MIN_ITEMS = 2;
export const MARKDOWN_STEPS_MAX_ITEMS = 10;
export const MARKDOWN_STEPS_MAX_TOTAL_ITEMS = 24;
export const MARKDOWN_STEPS_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_STEP_MAX_NAME_LENGTH = 100;
export const MARKDOWN_STEP_MAX_INSTRUCTION_LENGTH = 600;
export const MARKDOWN_STEP_MAX_VERIFICATION_LENGTH = 240;

export interface MarkdownStepItem {
  instruction: string;
  line?: number;
  name: string;
  verification?: string;
}

export interface MarkdownStepsSource {
  items: MarkdownStepItem[];
  line?: number;
  title: string;
}

export interface MarkdownStepsIssue {
  kind: "steps";
  line?: number;
  message: string;
}

class MarkdownStepsError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const STEPS_MARKER = /^\[!steps\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_STEPS_MARKER = /^\[!steps\](?:[+\-]|[ \t]|$)/iu;
const VERIFICATION_LABEL = "验证：";

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

function stepsMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const children = visibleMarkdownChildren(first);
  const marker =
    children[0]?.type === "text"
      ? children[0]
      : undefined;
  return marker && POTENTIAL_STEPS_MARKER.test(marker.value ?? "")
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
  throw new MarkdownStepsError(
    "步骤说明与验证只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注、硬换行与嵌套内容请移到步骤流程外。",
    line,
  );
}

function paragraphText(paragraph: MarkdownNode, line?: number) {
  if (paragraph.type !== "paragraph") {
    throw new MarkdownStepsError("步骤内容必须使用普通段落。", line);
  }
  for (const child of paragraph.children ?? []) validateInlineNode(child, line);
  return inlineText(paragraph).replace(/\s+/gu, " ").trim();
}

function stepNameFromParagraph(paragraph: MarkdownNode, line?: number) {
  const children = visibleMarkdownChildren(paragraph);
  const strong =
    paragraph.type === "paragraph" &&
    children.length === 1 &&
    children[0]?.type === "strong"
      ? children[0]
      : undefined;
  if (!strong) {
    throw new MarkdownStepsError(
      "每一步的第一段必须只包含粗体步骤名，例如 **运行完整检查**。",
      line,
    );
  }
  for (const child of strong.children ?? []) {
    if (child.type !== "text" && child.type !== "inlineCode") {
      throw new MarkdownStepsError(
        "步骤名只接受单行文本或行内代码，不能包含链接、图片或额外格式。",
        line,
      );
    }
  }
  const name = inlineText(strong).replace(/\s+/gu, " ").trim();
  if (!name || name.length > MARKDOWN_STEP_MAX_NAME_LENGTH) {
    throw new MarkdownStepsError(
      `步骤名必须为 1–${MARKDOWN_STEP_MAX_NAME_LENGTH} 个字符。`,
      line,
    );
  }
  return name;
}

function verificationFromParagraph(paragraph: MarkdownNode, line?: number) {
  const children = visibleMarkdownChildren(paragraph);
  const label = children[0];
  if (
    label?.type !== "strong" ||
    inlineText(label).replace(/\s+/gu, " ").trim() !== VERIFICATION_LABEL
  ) {
    throw new MarkdownStepsError(
      "第三段是可选验证条件；使用 **验证：** 开头，或删除整段。",
      line,
    );
  }
  for (const child of children.slice(1)) validateInlineNode(child, line);
  const verification = children
    .slice(1)
    .map(inlineText)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  if (!verification || verification.length > MARKDOWN_STEP_MAX_VERIFICATION_LENGTH) {
    throw new MarkdownStepsError(
      `步骤验证必须为 1–${MARKDOWN_STEP_MAX_VERIFICATION_LENGTH} 个字符。`,
      line,
    );
  }
  return verification;
}

function stepItemFromMarkdownNode(
  item: MarkdownNode,
  index: number,
): MarkdownStepItem {
  const line = item.position?.start?.line;
  const paragraphs = visibleMarkdownChildren(item);
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    paragraphs.length < 2 ||
    paragraphs.length > 3 ||
    paragraphs.some((paragraph) => paragraph.type !== "paragraph")
  ) {
    throw new MarkdownStepsError(
      `第 ${index + 1} 步必须包含“粗体步骤名 + 说明 + 可选验证”两到三段，不能使用任务状态、嵌套列表或额外段落。`,
      line,
    );
  }
  const name = stepNameFromParagraph(paragraphs[0], line);
  const instruction = paragraphText(paragraphs[1], line);
  if (!instruction || instruction.length > MARKDOWN_STEP_MAX_INSTRUCTION_LENGTH) {
    throw new MarkdownStepsError(
      `第 ${index + 1} 步说明必须为 1–${MARKDOWN_STEP_MAX_INSTRUCTION_LENGTH} 个字符。`,
      paragraphs[1]?.position?.start?.line ?? line,
    );
  }
  const verification = paragraphs[2]
    ? verificationFromParagraph(
        paragraphs[2],
        paragraphs[2].position?.start?.line ?? line,
      )
    : undefined;
  return {
    instruction,
    ...(line ? { line } : {}),
    name,
    ...(verification ? { verification } : {}),
  };
}

function stepsFromMarkdownNode(
  blockquote: MarkdownNode,
): MarkdownStepsSource | undefined {
  const markerNode = stepsMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  if (/\r?\n[2-9]\d*[.)][ \t]/u.test(markerNode.value ?? "")) {
    throw new MarkdownStepsError(
      "步骤流程的有序列表必须从 1 开始。",
      line,
    );
  }
  const marker = STEPS_MARKER.exec(markerNode.value ?? "");
  if (!marker) {
    throw new MarkdownStepsError(
      "步骤流程标记必须写成静态的 > [!steps] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_STEPS_MAX_TITLE_LENGTH) {
    throw new MarkdownStepsError(
      `步骤流程必须填写 1–${MARKDOWN_STEPS_MAX_TITLE_LENGTH} 个字符的可见标题。`,
      line,
    );
  }
  const children = visibleMarkdownChildren(blockquote);
  const list = children[1];
  if (
    children.length !== 2 ||
    list?.type !== "list" ||
    list.ordered !== true ||
    list.start !== 1
  ) {
    throw new MarkdownStepsError(
      "步骤流程标题后必须紧跟从 1 开始的有序列表，区块内不能混入无序列表或其他段落。",
      line,
    );
  }
  const rawItems = visibleMarkdownChildren(list);
  if (
    rawItems.length < MARKDOWN_STEPS_MIN_ITEMS ||
    rawItems.length > MARKDOWN_STEPS_MAX_ITEMS
  ) {
    throw new MarkdownStepsError(
      `每个步骤流程必须包含 ${MARKDOWN_STEPS_MIN_ITEMS}–${MARKDOWN_STEPS_MAX_ITEMS} 步。`,
      list.position?.start?.line ?? line,
    );
  }
  const items = rawItems.map(stepItemFromMarkdownNode);
  const normalizedNames = items.map((item) =>
    item.name.normalize("NFKC").toLocaleLowerCase("zh-CN"),
  );
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    throw new MarkdownStepsError("同一步骤流程不能包含重复步骤名。", line);
  }
  return { items, ...(line ? { line } : {}), title };
}

function parseMarkdownSteps(markdown: string) {
  const procedures: MarkdownStepsSource[] = [];
  const tree = parseMarkdown(markdown);

  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && stepsMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownStepsError(
          "步骤流程必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const procedure = stepsFromMarkdownNode(node);
      if (procedure) procedures.push(procedure);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }

  walk(tree);
  if (procedures.length > MARKDOWN_STEPS_MAX_COUNT) {
    throw new MarkdownStepsError(
      `每篇内容最多允许 ${MARKDOWN_STEPS_MAX_COUNT} 个步骤流程。`,
    );
  }
  const totalItems = procedures.reduce(
    (total, procedure) => total + procedure.items.length,
    0,
  );
  if (totalItems > MARKDOWN_STEPS_MAX_TOTAL_ITEMS) {
    throw new MarkdownStepsError(
      `每篇内容的步骤流程合计最多允许 ${MARKDOWN_STEPS_MAX_TOTAL_ITEMS} 步。`,
    );
  }
  return procedures;
}

export function extractMarkdownSteps(markdown: string) {
  return parseMarkdownSteps(markdown);
}

export function getMarkdownStepsIssue(
  markdown: string,
): MarkdownStepsIssue | undefined {
  try {
    parseMarkdownSteps(markdown);
    return undefined;
  } catch (error) {
    return {
      kind: "steps",
      ...(error instanceof MarkdownStepsError && error.line
        ? { line: error.line }
        : {}),
      message: compactError(error) || "步骤流程无法解析。",
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

function renderedStepFromHast(item: Element, index: number) {
  const paragraphs = visibleHastChildren(item).filter(
    (child): child is Element => isElement(child) && child.tagName === "p",
  );
  if (paragraphs.length < 2 || paragraphs.length > 3) {
    throw new MarkdownStepsError("步骤必须包含两到三个普通段落。");
  }
  const nameChildren = visibleHastChildren(paragraphs[0]);
  const nameNode =
    nameChildren.length === 1 &&
    isElement(nameChildren[0]) &&
    nameChildren[0].tagName === "strong"
      ? nameChildren[0]
      : undefined;
  if (!nameNode) throw new MarkdownStepsError("步骤缺少粗体步骤名。");
  const verificationParagraph = paragraphs[2];
  let verificationChildren: ElementContent[] | undefined;
  if (verificationParagraph) {
    const children = visibleHastChildren(verificationParagraph);
    const label =
      children[0] &&
      isElement(children[0]) &&
      children[0].tagName === "strong" &&
      hastText(children[0]).trim() === VERIFICATION_LABEL
        ? children[0]
        : undefined;
    if (!label) throw new MarkdownStepsError("步骤验证缺少 **验证：** 标签。");
    verificationChildren = children.slice(1);
  }
  return element(
    "li",
    { className: ["markdown-procedure-step"] },
    [
      element("span", { ariaHidden: "true", className: ["markdown-procedure-marker"] }, [
        element("span", { className: ["markdown-procedure-index"] }, [
          text(String(index + 1).padStart(2, "0")),
        ]),
        element("span", { className: ["markdown-procedure-index-label"] }, [text("STEP")]),
      ]),
      element("span", { className: ["markdown-procedure-copy"] }, [
        element("strong", { className: ["markdown-procedure-step-name"] }, nameNode.children),
        element(
          "span",
          { className: ["markdown-procedure-instruction"] },
          paragraphs[1].children,
        ),
        ...(verificationChildren
          ? [
              element("span", { className: ["markdown-procedure-check"] }, [
                element("span", { className: ["markdown-procedure-check-label"] }, [
                  text("CHECK"),
                ]),
                element(
                  "span",
                  { className: ["markdown-procedure-check-copy"] },
                  verificationChildren,
                ),
              ]),
            ]
          : []),
      ]),
    ],
  );
}

function stepsFromHastBlockquote(blockquote: Element, index: number) {
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
  if (!markerChild || !POTENTIAL_STEPS_MARKER.test(markerChild.value)) {
    return undefined;
  }
  const marker = STEPS_MARKER.exec(markerChild.value);
  if (!marker?.[1]?.trim()) {
    throw new MarkdownStepsError(
      "步骤流程标记必须写成静态的 > [!steps] 标题。",
    );
  }
  const title = marker[1].trim();
  const list =
    children.length === 2 &&
    isElement(children[1]) &&
    children[1].tagName === "ol"
      ? children[1]
      : undefined;
  if (!list) throw new MarkdownStepsError("步骤流程标题后必须紧跟有序列表。");
  const items = visibleHastChildren(list).filter(
    (child): child is Element => isElement(child) && child.tagName === "li",
  );
  if (
    items.length < MARKDOWN_STEPS_MIN_ITEMS ||
    items.length > MARKDOWN_STEPS_MAX_ITEMS
  ) {
    throw new MarkdownStepsError("步骤数量超出发布预算。");
  }
  const titleId = `markdown-procedure-${index}-title`;
  return element(
    "section",
    {
      ariaLabelledBy: [titleId],
      className: ["markdown-procedure"],
      dataProcedure: "runbook-path",
      dataStepCount: items.length,
    },
    [
      element("header", { className: ["markdown-procedure-header"] }, [
        element("span", { className: ["markdown-procedure-rail"] }, [
          element("span", { className: ["markdown-procedure-kind"] }, [
            text(`PROCEDURE / ${String(items.length).padStart(2, "0")} STEPS`),
          ]),
          element("span", { className: ["markdown-procedure-mode"] }, [
            text("ORDERED · STATIC"),
          ]),
        ]),
        element(
          "strong",
          { className: ["markdown-procedure-title"], id: titleId },
          [text(title)],
        ),
      ]),
      element(
        "ol",
        { className: ["markdown-procedure-items"] },
        items.map(renderedStepFromHast),
      ),
    ],
  );
}

export function rehypeMarkdownSteps() {
  return function transform(tree: Root) {
    let procedureCount = 0;
    let totalItems = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const procedure = stepsFromHastBlockquote(child, procedureCount + 1);
      if (!procedure) continue;
      procedureCount += 1;
      totalItems += Number(procedure.properties.dataStepCount);
      if (procedureCount > MARKDOWN_STEPS_MAX_COUNT) {
        throw new MarkdownStepsError(
          `每篇内容最多允许 ${MARKDOWN_STEPS_MAX_COUNT} 个步骤流程。`,
        );
      }
      if (totalItems > MARKDOWN_STEPS_MAX_TOTAL_ITEMS) {
        throw new MarkdownStepsError(
          `每篇内容的步骤流程合计最多允许 ${MARKDOWN_STEPS_MAX_TOTAL_ITEMS} 步。`,
        );
      }
      tree.children[index] = procedure as RootContent;
    }
  };
}

export function normalizeMarkdownStepsForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && stepsMarkerNode(node)) {
      const marker = stepsMarkerNode(node);
      const parsed = marker ? STEPS_MARKER.exec(marker.value ?? "") : undefined;
      if (marker && parsed?.[1]) marker.value = parsed[1].trim();
      const list = visibleMarkdownChildren(node)[1];
      for (const item of list?.children ?? []) {
        const verification = visibleMarkdownChildren(item)[2];
        const label = verification?.children?.[0];
        if (label?.type === "strong" && inlineText(label).trim() === VERIFICATION_LABEL) {
          label.children = [];
        }
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
