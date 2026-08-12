import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_FAQ_MAX_COUNT = 3;
export const MARKDOWN_FAQ_MIN_ITEMS = 2;
export const MARKDOWN_FAQ_MAX_ITEMS = 10;
export const MARKDOWN_FAQ_MAX_TOTAL_ITEMS = 24;
export const MARKDOWN_FAQ_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_FAQ_MAX_QUESTION_LENGTH = 160;
export const MARKDOWN_FAQ_MAX_ANSWER_PARAGRAPHS = 3;
export const MARKDOWN_FAQ_MAX_ANSWER_PARAGRAPH_LENGTH = 600;
export const MARKDOWN_FAQ_MAX_ANSWER_LENGTH = 1_200;

export interface MarkdownFaqItem {
  answers: string[];
  line?: number;
  question: string;
}

export interface MarkdownFaqSource {
  items: MarkdownFaqItem[];
  line?: number;
  title: string;
}

export interface MarkdownFaqIssue {
  kind: "faq";
  line?: number;
  message: string;
}

class MarkdownFaqError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const FAQ_MARKER = /^\[!faq\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_FAQ_MARKER = /^\[!faq\](?:[+\-]|[ \t]|$)/iu;

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

function faqMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const children = visibleMarkdownChildren(first);
  const marker = children[0]?.type === "text" ? children[0] : undefined;
  return marker && POTENTIAL_FAQ_MARKER.test(marker.value ?? "")
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
  throw new MarkdownFaqError(
    "FAQ 答案只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注、硬换行与嵌套内容请移到问答块外。",
    line,
  );
}

function questionFromParagraph(paragraph: MarkdownNode, line?: number) {
  const children = visibleMarkdownChildren(paragraph);
  const strong =
    paragraph.type === "paragraph" &&
    children.length === 1 &&
    children[0]?.type === "strong"
      ? children[0]
      : undefined;
  if (!strong) {
    throw new MarkdownFaqError(
      "每个 FAQ 条目的第一段必须只包含粗体问题，例如 **为什么发布前仍要运行完整检查？**。",
      line,
    );
  }
  for (const child of strong.children ?? []) {
    if (child.type !== "text" && child.type !== "inlineCode") {
      throw new MarkdownFaqError(
        "FAQ 问题只接受单行文本或行内代码，不能包含链接、图片或额外格式。",
        line,
      );
    }
  }
  const question = inlineText(strong).replace(/\s+/gu, " ").trim();
  if (!question || question.length > MARKDOWN_FAQ_MAX_QUESTION_LENGTH) {
    throw new MarkdownFaqError(
      `FAQ 问题必须为 1–${MARKDOWN_FAQ_MAX_QUESTION_LENGTH} 个字符。`,
      line,
    );
  }
  return question;
}

function answerFromParagraph(paragraph: MarkdownNode, line?: number) {
  if (paragraph.type !== "paragraph") {
    throw new MarkdownFaqError("FAQ 答案必须使用普通段落。", line);
  }
  for (const child of paragraph.children ?? []) validateInlineNode(child, line);
  const answer = inlineText(paragraph).replace(/\s+/gu, " ").trim();
  if (!answer || answer.length > MARKDOWN_FAQ_MAX_ANSWER_PARAGRAPH_LENGTH) {
    throw new MarkdownFaqError(
      `FAQ 每个答案段落必须为 1–${MARKDOWN_FAQ_MAX_ANSWER_PARAGRAPH_LENGTH} 个字符。`,
      line,
    );
  }
  return answer;
}

function faqItemFromMarkdownNode(
  item: MarkdownNode,
  index: number,
): MarkdownFaqItem {
  const line = item.position?.start?.line;
  const paragraphs = visibleMarkdownChildren(item);
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    paragraphs.length < 2 ||
    paragraphs.length > MARKDOWN_FAQ_MAX_ANSWER_PARAGRAPHS + 1 ||
    paragraphs.some((paragraph) => paragraph.type !== "paragraph")
  ) {
    throw new MarkdownFaqError(
      `第 ${index + 1} 个 FAQ 必须包含“粗体问题 + 1–${MARKDOWN_FAQ_MAX_ANSWER_PARAGRAPHS} 个答案段落”，不能使用任务状态、嵌套列表或额外段落。`,
      line,
    );
  }
  const question = questionFromParagraph(paragraphs[0], line);
  const answers = paragraphs.slice(1).map((paragraph) =>
    answerFromParagraph(paragraph, paragraph.position?.start?.line ?? line),
  );
  if (answers.join(" ").length > MARKDOWN_FAQ_MAX_ANSWER_LENGTH) {
    throw new MarkdownFaqError(
      `第 ${index + 1} 个 FAQ 的全部答案合计不能超过 ${MARKDOWN_FAQ_MAX_ANSWER_LENGTH} 个字符。`,
      line,
    );
  }
  return { answers, ...(line ? { line } : {}), question };
}

function normalizedQuestion(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

function faqFromMarkdownNode(
  blockquote: MarkdownNode,
): MarkdownFaqSource | undefined {
  const markerNode = faqMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  const marker = FAQ_MARKER.exec(markerNode.value ?? "");
  if (!marker) {
    throw new MarkdownFaqError(
      "FAQ 标记必须写成静态的 > [!faq] 标题，不能使用折叠 Callout 标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_FAQ_MAX_TITLE_LENGTH) {
    throw new MarkdownFaqError(
      `FAQ 必须填写 1–${MARKDOWN_FAQ_MAX_TITLE_LENGTH} 个字符的可见标题。`,
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
    throw new MarkdownFaqError(
      "FAQ 标题后必须紧跟无序列表，区块内不能混入有序列表或其他段落。",
      line,
    );
  }
  const rawItems = visibleMarkdownChildren(list);
  if (
    rawItems.length < MARKDOWN_FAQ_MIN_ITEMS ||
    rawItems.length > MARKDOWN_FAQ_MAX_ITEMS
  ) {
    throw new MarkdownFaqError(
      `每个 FAQ 必须包含 ${MARKDOWN_FAQ_MIN_ITEMS}–${MARKDOWN_FAQ_MAX_ITEMS} 个问题。`,
      list.position?.start?.line ?? line,
    );
  }
  const items = rawItems.map(faqItemFromMarkdownNode);
  const keys = items.map((item) => normalizedQuestion(item.question));
  if (new Set(keys).size !== keys.length) {
    throw new MarkdownFaqError("同一 FAQ 中的问题不能重复。", line);
  }
  return { items, ...(line ? { line } : {}), title };
}

function parseMarkdownFaqs(markdown: string) {
  const faqs: MarkdownFaqSource[] = [];
  const tree = parseMarkdown(markdown);

  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && faqMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownFaqError(
          "FAQ 必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const faq = faqFromMarkdownNode(node);
      if (faq) faqs.push(faq);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }

  walk(tree);
  if (faqs.length > MARKDOWN_FAQ_MAX_COUNT) {
    throw new MarkdownFaqError(
      `每篇内容最多允许 ${MARKDOWN_FAQ_MAX_COUNT} 个 FAQ。`,
    );
  }
  const totalItems = faqs.reduce(
    (total, faq) => total + faq.items.length,
    0,
  );
  if (totalItems > MARKDOWN_FAQ_MAX_TOTAL_ITEMS) {
    throw new MarkdownFaqError(
      `每篇内容的 FAQ 合计最多允许 ${MARKDOWN_FAQ_MAX_TOTAL_ITEMS} 个问题。`,
    );
  }
  return faqs;
}

export function extractMarkdownFaqs(markdown: string) {
  return parseMarkdownFaqs(markdown);
}

export function getMarkdownFaqIssue(
  markdown: string,
): MarkdownFaqIssue | undefined {
  try {
    parseMarkdownFaqs(markdown);
    return undefined;
  } catch (error) {
    return {
      kind: "faq",
      ...(error instanceof MarkdownFaqError && error.line
        ? { line: error.line }
        : {}),
      message: compactError(error) || "FAQ 无法解析。",
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

function renderedFaqItemFromHast(item: Element, index: number) {
  const paragraphs = visibleHastChildren(item).filter(
    (child): child is Element => isElement(child) && child.tagName === "p",
  );
  if (
    paragraphs.length < 2 ||
    paragraphs.length > MARKDOWN_FAQ_MAX_ANSWER_PARAGRAPHS + 1
  ) {
    throw new MarkdownFaqError("FAQ 条目必须包含粗体问题和 1–3 个答案段落。");
  }
  const questionChildren = visibleHastChildren(paragraphs[0]);
  const questionNode =
    questionChildren.length === 1 &&
    isElement(questionChildren[0]) &&
    questionChildren[0].tagName === "strong"
      ? questionChildren[0]
      : undefined;
  if (!questionNode) throw new MarkdownFaqError("FAQ 条目缺少粗体问题。");

  return element(
    "details",
    {
      className: ["markdown-faq-entry"],
      ...(index === 0 ? { open: true } : {}),
    },
    [
      element("summary", { className: ["markdown-faq-question"] }, [
        element(
          "span",
          { ariaHidden: "true", className: ["markdown-faq-question-mark"] },
          [text("Q")],
        ),
        element(
          "strong",
          { className: ["markdown-faq-question-copy"] },
          questionNode.children,
        ),
        element(
          "span",
          { ariaHidden: "true", className: ["markdown-faq-toggle"] },
          [text("+")],
        ),
      ]),
      element("div", { className: ["markdown-faq-answer"] }, [
        element(
          "span",
          { ariaHidden: "true", className: ["markdown-faq-answer-mark"] },
          [text("A")],
        ),
        element(
          "div",
          { className: ["markdown-faq-answer-copy"] },
          paragraphs.slice(1),
        ),
      ]),
    ],
  );
}

function faqFromHastBlockquote(blockquote: Element, index: number) {
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
  if (!markerChild || !POTENTIAL_FAQ_MARKER.test(markerChild.value)) {
    return undefined;
  }
  const marker = FAQ_MARKER.exec(markerChild.value);
  if (!marker?.[1]?.trim()) {
    throw new MarkdownFaqError("FAQ 标记必须写成静态的 > [!faq] 标题。");
  }
  const title = marker[1].trim();
  const list =
    children.length === 2 &&
    isElement(children[1]) &&
    children[1].tagName === "ul"
      ? children[1]
      : undefined;
  if (!list) throw new MarkdownFaqError("FAQ 标题后必须紧跟无序列表。");
  const items = visibleHastChildren(list).filter(
    (child): child is Element => isElement(child) && child.tagName === "li",
  );
  if (
    items.length < MARKDOWN_FAQ_MIN_ITEMS ||
    items.length > MARKDOWN_FAQ_MAX_ITEMS
  ) {
    throw new MarkdownFaqError("FAQ 问题数量超出发布预算。");
  }
  const titleId = `markdown-faq-${index}-title`;
  return element(
    "section",
    {
      ariaLabelledBy: [titleId],
      className: ["markdown-faq"],
      dataFaq: "answer-cabinet",
      dataQuestionCount: items.length,
    },
    [
      element("header", { className: ["markdown-faq-header"] }, [
        element("span", { className: ["markdown-faq-rail"] }, [
          element("span", { className: ["markdown-faq-kind"] }, [
            text(`FAQ / ${String(items.length).padStart(2, "0")} QUESTIONS`),
          ]),
          element("span", { className: ["markdown-faq-mode"] }, [
            text("ANSWERS · NATIVE"),
          ]),
        ]),
        element(
          "strong",
          { className: ["markdown-faq-title"], id: titleId },
          [text(title)],
        ),
      ]),
      element(
        "div",
        { className: ["markdown-faq-items"] },
        items.map(renderedFaqItemFromHast),
      ),
    ],
  );
}

export function rehypeMarkdownFaqs() {
  return function transform(tree: Root) {
    let faqCount = 0;
    let totalItems = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const faq = faqFromHastBlockquote(child, faqCount + 1);
      if (!faq) continue;
      faqCount += 1;
      totalItems += Number(faq.properties.dataQuestionCount);
      if (faqCount > MARKDOWN_FAQ_MAX_COUNT) {
        throw new MarkdownFaqError(
          `每篇内容最多允许 ${MARKDOWN_FAQ_MAX_COUNT} 个 FAQ。`,
        );
      }
      if (totalItems > MARKDOWN_FAQ_MAX_TOTAL_ITEMS) {
        throw new MarkdownFaqError(
          `每篇内容的 FAQ 合计最多允许 ${MARKDOWN_FAQ_MAX_TOTAL_ITEMS} 个问题。`,
        );
      }
      tree.children[index] = faq as RootContent;
    }
  };
}

export function normalizeMarkdownFaqsForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && faqMarkerNode(node)) {
      const marker = faqMarkerNode(node);
      const parsed = marker ? FAQ_MARKER.exec(marker.value ?? "") : undefined;
      if (marker && parsed?.[1]) marker.value = parsed[1].trim();
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
