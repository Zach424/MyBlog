import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_GLOSSARY_MAX_COUNT = 3;
export const MARKDOWN_GLOSSARY_MIN_ITEMS = 2;
export const MARKDOWN_GLOSSARY_MAX_ITEMS = 12;
export const MARKDOWN_GLOSSARY_MAX_TOTAL_ITEMS = 24;
export const MARKDOWN_GLOSSARY_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_GLOSSARY_MAX_TERM_LENGTH = 100;
export const MARKDOWN_GLOSSARY_MAX_DEFINITION_LENGTH = 800;
export const MARKDOWN_GLOSSARY_MAX_ALIASES = 5;
export const MARKDOWN_GLOSSARY_MAX_ALIAS_LENGTH = 60;
export const MARKDOWN_GLOSSARY_MAX_CONTEXT_LENGTH = 400;

export interface MarkdownGlossaryItem {
  aliases: string[];
  context?: string;
  definition: string;
  line?: number;
  term: string;
}

export interface MarkdownGlossarySource {
  items: MarkdownGlossaryItem[];
  line?: number;
  title: string;
}

export interface MarkdownGlossaryIssue {
  kind: "glossary";
  line?: number;
  message: string;
}

class MarkdownGlossaryError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const GLOSSARY_MARKER = /^\[!glossary\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_GLOSSARY_MARKER = /^\[!glossary\](?:[+\-]|[ \t]|$)/iu;
const ALIASES_LABEL = "别名：";
const CONTEXT_LABEL = "上下文：";

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

function glossaryMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const children = visibleMarkdownChildren(first);
  const marker = children[0]?.type === "text" ? children[0] : undefined;
  return marker && POTENTIAL_GLOSSARY_MARKER.test(marker.value ?? "")
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
  throw new MarkdownGlossaryError(
    "术语定义与上下文只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注、硬换行与嵌套内容请移到术语表外。",
    line,
  );
}

function termFromParagraph(paragraph: MarkdownNode, line?: number) {
  const children = visibleMarkdownChildren(paragraph);
  const strong =
    paragraph.type === "paragraph" &&
    children.length === 1 &&
    children[0]?.type === "strong"
      ? children[0]
      : undefined;
  if (!strong) {
    throw new MarkdownGlossaryError(
      "每个条目的第一段必须只包含粗体术语，例如 **Server Component**。",
      line,
    );
  }
  for (const child of strong.children ?? []) {
    if (child.type !== "text" && child.type !== "inlineCode") {
      throw new MarkdownGlossaryError(
        "术语只接受单行文本或行内代码，不能包含链接、图片或额外格式。",
        line,
      );
    }
  }
  const term = inlineText(strong).replace(/\s+/gu, " ").trim();
  if (!term || term.length > MARKDOWN_GLOSSARY_MAX_TERM_LENGTH) {
    throw new MarkdownGlossaryError(
      `术语必须为 1–${MARKDOWN_GLOSSARY_MAX_TERM_LENGTH} 个字符。`,
      line,
    );
  }
  return term;
}

function richParagraphText(
  paragraph: MarkdownNode,
  maximum: number,
  label: string,
  line?: number,
) {
  if (paragraph.type !== "paragraph") {
    throw new MarkdownGlossaryError(`${label}必须使用普通段落。`, line);
  }
  for (const child of paragraph.children ?? []) validateInlineNode(child, line);
  const value = inlineText(paragraph).replace(/\s+/gu, " ").trim();
  if (!value || value.length > maximum) {
    throw new MarkdownGlossaryError(
      `${label}必须为 1–${maximum} 个字符。`,
      line,
    );
  }
  return value;
}

function labeledParagraph(
  paragraph: MarkdownNode,
  expectedLabel: string,
  line?: number,
) {
  const children = visibleMarkdownChildren(paragraph);
  const label = children[0];
  if (
    paragraph.type !== "paragraph" ||
    label?.type !== "strong" ||
    inlineText(label).replace(/\s+/gu, " ").trim() !== expectedLabel
  ) {
    throw new MarkdownGlossaryError(
      `可选元数据必须使用 **${expectedLabel}** 标签，并保持“别名”在“上下文”之前。`,
      line,
    );
  }
  return children.slice(1);
}

function aliasesFromParagraph(paragraph: MarkdownNode, line?: number) {
  const children = labeledParagraph(paragraph, ALIASES_LABEL, line);
  if (children.some((child) => child.type !== "text")) {
    throw new MarkdownGlossaryError(
      "别名只接受纯文本，并使用中文顿号“、”分隔。",
      line,
    );
  }
  const raw = children.map(inlineText).join("").trim();
  const aliases = raw.split("、").map((alias) => alias.trim());
  if (
    aliases.length < 1 ||
    aliases.length > MARKDOWN_GLOSSARY_MAX_ALIASES ||
    aliases.some(
      (alias) =>
        !alias ||
        alias.length > MARKDOWN_GLOSSARY_MAX_ALIAS_LENGTH ||
        alias.includes("、"),
    )
  ) {
    throw new MarkdownGlossaryError(
      `别名必须包含 1–${MARKDOWN_GLOSSARY_MAX_ALIASES} 个不重复的纯文本名称，每个 1–${MARKDOWN_GLOSSARY_MAX_ALIAS_LENGTH} 字符，并使用“、”分隔。`,
      line,
    );
  }
  return aliases;
}

function contextFromParagraph(paragraph: MarkdownNode, line?: number) {
  const children = labeledParagraph(paragraph, CONTEXT_LABEL, line);
  for (const child of children) validateInlineNode(child, line);
  const context = children.map(inlineText).join("").replace(/\s+/gu, " ").trim();
  if (!context || context.length > MARKDOWN_GLOSSARY_MAX_CONTEXT_LENGTH) {
    throw new MarkdownGlossaryError(
      `上下文必须为 1–${MARKDOWN_GLOSSARY_MAX_CONTEXT_LENGTH} 个字符。`,
      line,
    );
  }
  return context;
}

function glossaryItemFromMarkdownNode(
  item: MarkdownNode,
  index: number,
): MarkdownGlossaryItem {
  const line = item.position?.start?.line;
  const paragraphs = visibleMarkdownChildren(item);
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    paragraphs.length < 2 ||
    paragraphs.length > 4 ||
    paragraphs.some((paragraph) => paragraph.type !== "paragraph")
  ) {
    throw new MarkdownGlossaryError(
      `第 ${index + 1} 个术语必须包含“粗体术语 + 定义 + 可选别名 + 可选上下文”两到四段，不能使用任务状态、嵌套列表或额外段落。`,
      line,
    );
  }
  const term = termFromParagraph(paragraphs[0], line);
  const definition = richParagraphText(
    paragraphs[1],
    MARKDOWN_GLOSSARY_MAX_DEFINITION_LENGTH,
    "术语定义",
    paragraphs[1]?.position?.start?.line ?? line,
  );
  let aliases: string[] = [];
  let context: string | undefined;
  for (const paragraph of paragraphs.slice(2)) {
    const paragraphLine = paragraph.position?.start?.line ?? line;
    const first = visibleMarkdownChildren(paragraph)[0];
    const label = first?.type === "strong" ? inlineText(first).trim() : "";
    if (label === ALIASES_LABEL && aliases.length === 0 && context === undefined) {
      aliases = aliasesFromParagraph(paragraph, paragraphLine);
      continue;
    }
    if (label === CONTEXT_LABEL && context === undefined) {
      context = contextFromParagraph(paragraph, paragraphLine);
      continue;
    }
    throw new MarkdownGlossaryError(
      "可选段落只允许 **别名：** 和 **上下文：**，且别名必须位于上下文之前。",
      paragraphLine,
    );
  }
  return {
    aliases,
    ...(context ? { context } : {}),
    definition,
    ...(line ? { line } : {}),
    term,
  };
}

function normalizedLabel(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

function glossaryFromMarkdownNode(
  blockquote: MarkdownNode,
): MarkdownGlossarySource | undefined {
  const markerNode = glossaryMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  const marker = GLOSSARY_MARKER.exec(markerNode.value ?? "");
  if (!marker) {
    throw new MarkdownGlossaryError(
      "术语定义表标记必须写成静态的 > [!glossary] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_GLOSSARY_MAX_TITLE_LENGTH) {
    throw new MarkdownGlossaryError(
      `术语定义表必须填写 1–${MARKDOWN_GLOSSARY_MAX_TITLE_LENGTH} 个字符的可见标题。`,
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
    throw new MarkdownGlossaryError(
      "术语定义表标题后必须紧跟无序列表，区块内不能混入有序列表或其他段落。",
      line,
    );
  }
  const rawItems = visibleMarkdownChildren(list);
  if (
    rawItems.length < MARKDOWN_GLOSSARY_MIN_ITEMS ||
    rawItems.length > MARKDOWN_GLOSSARY_MAX_ITEMS
  ) {
    throw new MarkdownGlossaryError(
      `每个术语定义表必须包含 ${MARKDOWN_GLOSSARY_MIN_ITEMS}–${MARKDOWN_GLOSSARY_MAX_ITEMS} 个术语。`,
      list.position?.start?.line ?? line,
    );
  }
  const items = rawItems.map(glossaryItemFromMarkdownNode);
  const labels = items.flatMap((item) => [item.term, ...item.aliases]);
  const normalizedLabels = labels.map(normalizedLabel);
  if (new Set(normalizedLabels).size !== normalizedLabels.length) {
    throw new MarkdownGlossaryError(
      "同一术语定义表中的术语和别名不能互相重复。",
      line,
    );
  }
  return { items, ...(line ? { line } : {}), title };
}

function parseMarkdownGlossaries(markdown: string) {
  const glossaries: MarkdownGlossarySource[] = [];
  const tree = parseMarkdown(markdown);

  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && glossaryMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownGlossaryError(
          "术语定义表必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const glossary = glossaryFromMarkdownNode(node);
      if (glossary) glossaries.push(glossary);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }

  walk(tree);
  if (glossaries.length > MARKDOWN_GLOSSARY_MAX_COUNT) {
    throw new MarkdownGlossaryError(
      `每篇内容最多允许 ${MARKDOWN_GLOSSARY_MAX_COUNT} 个术语定义表。`,
    );
  }
  const totalItems = glossaries.reduce(
    (total, glossary) => total + glossary.items.length,
    0,
  );
  if (totalItems > MARKDOWN_GLOSSARY_MAX_TOTAL_ITEMS) {
    throw new MarkdownGlossaryError(
      `每篇内容的术语定义表合计最多允许 ${MARKDOWN_GLOSSARY_MAX_TOTAL_ITEMS} 个术语。`,
    );
  }
  return glossaries;
}

export function extractMarkdownGlossaries(markdown: string) {
  return parseMarkdownGlossaries(markdown);
}

export function getMarkdownGlossaryIssue(
  markdown: string,
): MarkdownGlossaryIssue | undefined {
  try {
    parseMarkdownGlossaries(markdown);
    return undefined;
  } catch (error) {
    return {
      kind: "glossary",
      ...(error instanceof MarkdownGlossaryError && error.line
        ? { line: error.line }
        : {}),
      message: compactError(error) || "术语定义表无法解析。",
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

function labeledHastChildren(paragraph: Element, expected: string) {
  const children = visibleHastChildren(paragraph);
  const label = children[0];
  return label &&
    isElement(label) &&
    label.tagName === "strong" &&
    hastText(label).trim() === expected
    ? children.slice(1)
    : undefined;
}

function renderedGlossaryItemFromHast(item: Element) {
  const paragraphs = visibleHastChildren(item).filter(
    (child): child is Element => isElement(child) && child.tagName === "p",
  );
  if (paragraphs.length < 2 || paragraphs.length > 4) {
    throw new MarkdownGlossaryError("术语条目必须包含两到四个普通段落。");
  }
  const termChildren = visibleHastChildren(paragraphs[0]);
  const termNode =
    termChildren.length === 1 &&
    isElement(termChildren[0]) &&
    termChildren[0].tagName === "strong"
      ? termChildren[0]
      : undefined;
  if (!termNode) throw new MarkdownGlossaryError("术语条目缺少粗体术语。");

  let aliases: string[] = [];
  let contextChildren: ElementContent[] | undefined;
  for (const paragraph of paragraphs.slice(2)) {
    const aliasChildren = labeledHastChildren(paragraph, ALIASES_LABEL);
    if (aliasChildren && aliases.length === 0 && !contextChildren) {
      aliases = aliasChildren
        .map(hastText)
        .join("")
        .trim()
        .split("、")
        .map((alias) => alias.trim());
      continue;
    }
    const candidateContext = labeledHastChildren(paragraph, CONTEXT_LABEL);
    if (candidateContext && !contextChildren) {
      contextChildren = candidateContext;
      continue;
    }
    throw new MarkdownGlossaryError("术语可选段落标签无效。");
  }

  return element("div", { className: ["markdown-glossary-entry"] }, [
    element("dt", { className: ["markdown-glossary-term"] }, [
      element(
        "strong",
        { className: ["markdown-glossary-term-name"] },
        termNode.children,
      ),
      ...(aliases.length > 0
        ? [
            element("span", { className: ["markdown-glossary-aliases"] }, [
              element(
                "span",
                { className: ["markdown-glossary-alias-label"] },
                [text("ALIASES")],
              ),
              ...aliases.flatMap((alias) => [
                text(" "),
                element(
                  "span",
                  { className: ["markdown-glossary-alias"] },
                  [text(alias)],
                ),
              ]),
            ]),
          ]
        : []),
    ]),
    element("dd", { className: ["markdown-glossary-meaning"] }, [
      element(
        "span",
        { className: ["markdown-glossary-definition"] },
        paragraphs[1].children,
      ),
      ...(contextChildren
        ? [
            element("span", { className: ["markdown-glossary-context"] }, [
              element(
                "span",
                { className: ["markdown-glossary-context-label"] },
                [text("CONTEXT")],
              ),
              element(
                "span",
                { className: ["markdown-glossary-context-copy"] },
                contextChildren,
              ),
            ]),
          ]
        : []),
    ]),
  ]);
}

function glossaryFromHastBlockquote(blockquote: Element, index: number) {
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
  if (!markerChild || !POTENTIAL_GLOSSARY_MARKER.test(markerChild.value)) {
    return undefined;
  }
  const marker = GLOSSARY_MARKER.exec(markerChild.value);
  if (!marker?.[1]?.trim()) {
    throw new MarkdownGlossaryError(
      "术语定义表标记必须写成静态的 > [!glossary] 标题。",
    );
  }
  const title = marker[1].trim();
  const list =
    children.length === 2 &&
    isElement(children[1]) &&
    children[1].tagName === "ul"
      ? children[1]
      : undefined;
  if (!list) throw new MarkdownGlossaryError("术语定义表标题后必须紧跟无序列表。");
  const items = visibleHastChildren(list).filter(
    (child): child is Element => isElement(child) && child.tagName === "li",
  );
  if (
    items.length < MARKDOWN_GLOSSARY_MIN_ITEMS ||
    items.length > MARKDOWN_GLOSSARY_MAX_ITEMS
  ) {
    throw new MarkdownGlossaryError("术语数量超出发布预算。");
  }
  const titleId = `markdown-glossary-${index}-title`;
  return element(
    "section",
    {
      ariaLabelledBy: [titleId],
      className: ["markdown-glossary"],
      dataGlossary: "definition-ledger",
      dataTermCount: items.length,
    },
    [
      element("header", { className: ["markdown-glossary-header"] }, [
        element("span", { className: ["markdown-glossary-rail"] }, [
          element("span", { className: ["markdown-glossary-kind"] }, [
            text(`GLOSSARY / ${String(items.length).padStart(2, "0")} TERMS`),
          ]),
          element("span", { className: ["markdown-glossary-mode"] }, [
            text("CONCEPTS · STATIC"),
          ]),
        ]),
        element(
          "strong",
          { className: ["markdown-glossary-title"], id: titleId },
          [text(title)],
        ),
      ]),
      element(
        "dl",
        { className: ["markdown-glossary-items"] },
        items.map(renderedGlossaryItemFromHast),
      ),
    ],
  );
}

export function rehypeMarkdownGlossaries() {
  return function transform(tree: Root) {
    let glossaryCount = 0;
    let totalItems = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const glossary = glossaryFromHastBlockquote(child, glossaryCount + 1);
      if (!glossary) continue;
      glossaryCount += 1;
      totalItems += Number(glossary.properties.dataTermCount);
      if (glossaryCount > MARKDOWN_GLOSSARY_MAX_COUNT) {
        throw new MarkdownGlossaryError(
          `每篇内容最多允许 ${MARKDOWN_GLOSSARY_MAX_COUNT} 个术语定义表。`,
        );
      }
      if (totalItems > MARKDOWN_GLOSSARY_MAX_TOTAL_ITEMS) {
        throw new MarkdownGlossaryError(
          `每篇内容的术语定义表合计最多允许 ${MARKDOWN_GLOSSARY_MAX_TOTAL_ITEMS} 个术语。`,
        );
      }
      tree.children[index] = glossary as RootContent;
    }
  };
}

export function normalizeMarkdownGlossariesForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && glossaryMarkerNode(node)) {
      const marker = glossaryMarkerNode(node);
      const parsed = marker ? GLOSSARY_MARKER.exec(marker.value ?? "") : undefined;
      if (marker && parsed?.[1]) marker.value = parsed[1].trim();
      const list = visibleMarkdownChildren(node)[1];
      for (const item of list?.children ?? []) {
        for (const paragraph of visibleMarkdownChildren(item).slice(2)) {
          const label = visibleMarkdownChildren(paragraph)[0];
          if (
            label?.type === "strong" &&
            [ALIASES_LABEL, CONTEXT_LABEL].includes(inlineText(label).trim())
          ) {
            label.children = [];
          }
        }
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
