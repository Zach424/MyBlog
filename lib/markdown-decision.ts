import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_DECISION_MAX_COUNT = 3;
export const MARKDOWN_DECISION_MIN_ITEMS = 1;
export const MARKDOWN_DECISION_MAX_ITEMS = 6;
export const MARKDOWN_DECISION_MAX_TOTAL_ITEMS = 24;
export const MARKDOWN_DECISION_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_DECISION_MAX_COPY_LENGTH = 800;
export const MARKDOWN_DECISION_MAX_ITEM_TITLE_LENGTH = 120;
export const MARKDOWN_DECISION_MAX_ITEM_DESCRIPTION_LENGTH = 400;
export const MARKDOWN_DECISION_STATUSES = [
  "ACCEPTED",
  "SUPERSEDED",
  "DEPRECATED",
  "REJECTED",
] as const;
export const MARKDOWN_DECISION_CONSEQUENCE_TONES = [
  "POSITIVE",
  "NEGATIVE",
  "NEUTRAL",
] as const;

export type MarkdownDecisionStatus = (typeof MARKDOWN_DECISION_STATUSES)[number];
export type MarkdownDecisionConsequenceTone =
  (typeof MARKDOWN_DECISION_CONSEQUENCE_TONES)[number];

export interface MarkdownDecisionAlternative {
  description: string;
  line?: number;
  title: string;
}

export interface MarkdownDecisionConsequence {
  description: string;
  line?: number;
  tone: MarkdownDecisionConsequenceTone;
}

export interface MarkdownDecisionSource {
  alternatives: MarkdownDecisionAlternative[];
  consequences: MarkdownDecisionConsequence[];
  context: string;
  date: string;
  decision: string;
  line?: number;
  rationale: string;
  status: MarkdownDecisionStatus;
  title: string;
}

export interface MarkdownDecisionIssue {
  kind: "decision";
  line?: number;
  message: string;
}

export interface MarkdownDecisionOptions {
  maximumDate?: string;
}

class MarkdownDecisionError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const DECISION_MARKER = /^\[!decision\](?:[ \t]+([^\r\n]*?))?[ \t]*\r?\n$/iu;
const POTENTIAL_DECISION_MARKER = /^\[!decision\](?:[+\-]|[ \t]|$)/iu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STATUS = new Set<string>(MARKDOWN_DECISION_STATUSES);
const CONSEQUENCE_TONE = new Set<string>(MARKDOWN_DECISION_CONSEQUENCE_TONES);
const SECTION_LABELS = [
  "CONTEXT",
  "DECISION",
  "RATIONALE",
  "ALTERNATIVES",
  "CONSEQUENCES",
] as const;

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

function decisionMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const marker = first.children?.[0];
  return marker?.type === "text" && POTENTIAL_DECISION_MARKER.test(marker.value ?? "")
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

function validateInline(node: MarkdownNode, line?: number) {
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
    for (const child of node.children ?? []) validateInline(child, line);
    return;
  }
  throw new MarkdownDecisionError(
    "技术决策记录只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注、硬换行与嵌套内容请移到记录外。",
    line,
  );
}

function isLabel(node: MarkdownNode, label: (typeof SECTION_LABELS)[number]) {
  const children = visibleMarkdownChildren(node);
  const strong = children[0];
  return node.type === "paragraph" &&
    children.length === 1 &&
    strong?.type === "strong" &&
    inlineText(strong) === label;
}

function parseCopy(node: MarkdownNode, label: string) {
  const line = node.position?.start?.line;
  if (node.type !== "paragraph") {
    throw new MarkdownDecisionError(`${label} 必须是一个独立段落。`, line);
  }
  for (const child of node.children ?? []) validateInline(child, line);
  const value = inlineText(node).replace(/\s+/gu, " ").trim();
  if (!value || value.length > MARKDOWN_DECISION_MAX_COPY_LENGTH) {
    throw new MarkdownDecisionError(
      `${label} 必须为 1–${MARKDOWN_DECISION_MAX_COPY_LENGTH} 个字符。`,
      line,
    );
  }
  return value;
}

function parseMetadata(paragraph: MarkdownNode) {
  const line = paragraph.position?.start?.line;
  const children = paragraph.children ?? [];
  const [marker, statusLabel, statusSpace, statusNode, separator, dateLabel, dateSpace, dateNode] = children;
  const markerMatch = marker?.type === "text"
    ? DECISION_MARKER.exec(marker.value ?? "")
    : undefined;
  if (!markerMatch) {
    throw new MarkdownDecisionError(
      "技术决策标记必须写成静态的 > [!decision] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = markerMatch[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_DECISION_MAX_TITLE_LENGTH) {
    throw new MarkdownDecisionError(
      `技术决策标题必须为 1–${MARKDOWN_DECISION_MAX_TITLE_LENGTH} 个字符。`,
      line,
    );
  }
  if (
    children.length !== 8 ||
    statusLabel?.type !== "strong" ||
    inlineText(statusLabel) !== "STATUS:" ||
    statusSpace?.type !== "text" ||
    statusSpace.value !== " " ||
    statusNode?.type !== "inlineCode" ||
    separator?.type !== "text" ||
    separator.value !== " · " ||
    dateLabel?.type !== "strong" ||
    inlineText(dateLabel) !== "DATE:" ||
    dateSpace?.type !== "text" ||
    dateSpace.value !== " " ||
    dateNode?.type !== "inlineCode"
  ) {
    throw new MarkdownDecisionError(
      "技术决策元数据必须写成 **STATUS:** `ACCEPTED` · **DATE:** `YYYY-MM-DD`。",
      line,
    );
  }
  const status = (statusNode.value ?? "").trim();
  if (!STATUS.has(status)) {
    throw new MarkdownDecisionError(
      `技术决策状态只允许 ${MARKDOWN_DECISION_STATUSES.join(" / ")}。`,
      line,
    );
  }
  const date = (dateNode.value ?? "").trim();
  if (!isRealIsoDate(date)) {
    throw new MarkdownDecisionError("技术决策日期必须是真实的 YYYY-MM-DD。", line);
  }
  return { date, status: status as MarkdownDecisionStatus, title };
}

function parseAlternative(item: MarkdownNode, index: number) {
  const line = item.position?.start?.line;
  const children = visibleMarkdownChildren(item);
  const paragraph = children[0];
  const inline = paragraph?.children ?? [];
  const [titleNode, separator, ...descriptionNodes] = inline;
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    children.length !== 1 ||
    paragraph?.type !== "paragraph" ||
    titleNode?.type !== "strong" ||
    separator?.type !== "text" ||
    !(separator.value ?? "").startsWith(" — ")
  ) {
    throw new MarkdownDecisionError(
      `第 ${index + 1} 个备选方案必须写成 - **方案名** — 说明。`,
      line,
    );
  }
  const title = inlineText(titleNode).replace(/\s+/gu, " ").trim();
  if (!title || title.length > MARKDOWN_DECISION_MAX_ITEM_TITLE_LENGTH) {
    throw new MarkdownDecisionError(
      `第 ${index + 1} 个备选方案名称必须为 1–${MARKDOWN_DECISION_MAX_ITEM_TITLE_LENGTH} 个字符。`,
      line,
    );
  }
  const descriptionPrefix = { ...separator, value: (separator.value ?? "").slice(3) };
  const copyNodes = [descriptionPrefix, ...descriptionNodes];
  for (const child of copyNodes) validateInline(child, line);
  const description = copyNodes.map(inlineText).join("").replace(/\s+/gu, " ").trim();
  if (!description || description.length > MARKDOWN_DECISION_MAX_ITEM_DESCRIPTION_LENGTH) {
    throw new MarkdownDecisionError(
      `第 ${index + 1} 个备选方案说明必须为 1–${MARKDOWN_DECISION_MAX_ITEM_DESCRIPTION_LENGTH} 个字符。`,
      line,
    );
  }
  return { description, ...(line ? { line } : {}), title };
}

function parseConsequence(item: MarkdownNode, index: number) {
  const line = item.position?.start?.line;
  const children = visibleMarkdownChildren(item);
  const paragraph = children[0];
  const inline = paragraph?.children ?? [];
  const [toneNode, separator, ...descriptionNodes] = inline;
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    children.length !== 1 ||
    paragraph?.type !== "paragraph" ||
    toneNode?.type !== "inlineCode" ||
    separator?.type !== "text" ||
    !(separator.value ?? "").startsWith(" ")
  ) {
    throw new MarkdownDecisionError(
      `第 ${index + 1} 条影响必须写成 - \`POSITIVE\` 说明。`,
      line,
    );
  }
  const tone = (toneNode.value ?? "").trim();
  if (!CONSEQUENCE_TONE.has(tone)) {
    throw new MarkdownDecisionError(
      `第 ${index + 1} 条影响类型只允许 ${MARKDOWN_DECISION_CONSEQUENCE_TONES.join(" / ")}。`,
      line,
    );
  }
  const descriptionPrefix = { ...separator, value: (separator.value ?? "").slice(1) };
  const copyNodes = [descriptionPrefix, ...descriptionNodes];
  for (const child of copyNodes) validateInline(child, line);
  const description = copyNodes.map(inlineText).join("").replace(/\s+/gu, " ").trim();
  if (!description || description.length > MARKDOWN_DECISION_MAX_ITEM_DESCRIPTION_LENGTH) {
    throw new MarkdownDecisionError(
      `第 ${index + 1} 条影响说明必须为 1–${MARKDOWN_DECISION_MAX_ITEM_DESCRIPTION_LENGTH} 个字符。`,
      line,
    );
  }
  return {
    description,
    ...(line ? { line } : {}),
    tone: tone as MarkdownDecisionConsequenceTone,
  };
}

function parseList(
  node: MarkdownNode,
  label: string,
  parseItem: (item: MarkdownNode, index: number) => unknown,
) {
  const line = node.position?.start?.line;
  if (node.type !== "list" || node.ordered !== false) {
    throw new MarkdownDecisionError(`${label} 必须使用无序列表。`, line);
  }
  const items = visibleMarkdownChildren(node);
  if (items.length < MARKDOWN_DECISION_MIN_ITEMS || items.length > MARKDOWN_DECISION_MAX_ITEMS) {
    throw new MarkdownDecisionError(
      `${label} 必须包含 ${MARKDOWN_DECISION_MIN_ITEMS}–${MARKDOWN_DECISION_MAX_ITEMS} 项。`,
      line,
    );
  }
  return items.map(parseItem);
}

function decisionFromMarkdownNode(blockquote: MarkdownNode) {
  const marker = decisionMarkerNode(blockquote);
  if (!marker) return undefined;
  const line = blockquote.position?.start?.line;
  const children = visibleMarkdownChildren(blockquote);
  if (children.length !== 11 || children[0]?.type !== "paragraph") {
    throw new MarkdownDecisionError(
      "技术决策必须依次包含元数据、CONTEXT、DECISION、RATIONALE、ALTERNATIVES 和 CONSEQUENCES，不能增删区段。",
      line,
    );
  }
  for (const [index, label] of SECTION_LABELS.entries()) {
    const childIndex = index < 3 ? index * 2 + 1 : index * 2 + 1;
    if (!isLabel(children[childIndex], label)) {
      throw new MarkdownDecisionError(`技术决策缺少固定区段 **${label}** 或顺序错误。`, children[childIndex]?.position?.start?.line ?? line);
    }
  }
  const metadata = parseMetadata(children[0]);
  const context = parseCopy(children[2], "CONTEXT");
  const decision = parseCopy(children[4], "DECISION");
  const rationale = parseCopy(children[6], "RATIONALE");
  const alternatives = parseList(children[8], "ALTERNATIVES", parseAlternative) as MarkdownDecisionAlternative[];
  const consequences = parseList(children[10], "CONSEQUENCES", parseConsequence) as MarkdownDecisionConsequence[];
  const keys = alternatives.map((item) => item.title.normalize("NFKC").toLocaleLowerCase("zh-CN"));
  if (new Set(keys).size !== keys.length) {
    throw new MarkdownDecisionError("同一技术决策不能包含名称重复的备选方案。", line);
  }
  return {
    alternatives,
    consequences,
    context,
    decision,
    ...metadata,
    ...(line ? { line } : {}),
    rationale,
  } satisfies MarkdownDecisionSource;
}

function parseMarkdownDecisions(markdown: string, options: MarkdownDecisionOptions = {}) {
  const decisions: MarkdownDecisionSource[] = [];
  const tree = parseMarkdown(markdown);
  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && decisionMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownDecisionError(
          "技术决策必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const decision = decisionFromMarkdownNode(node);
      if (decision) decisions.push(decision);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }
  walk(tree);
  if (decisions.length > MARKDOWN_DECISION_MAX_COUNT) {
    throw new MarkdownDecisionError(`每篇内容最多允许 ${MARKDOWN_DECISION_MAX_COUNT} 个技术决策记录。`);
  }
  const totalItems = decisions.reduce(
    (total, item) => total + item.alternatives.length + item.consequences.length,
    0,
  );
  if (totalItems > MARKDOWN_DECISION_MAX_TOTAL_ITEMS) {
    throw new MarkdownDecisionError(`每篇内容的技术决策台账合计最多允许 ${MARKDOWN_DECISION_MAX_TOTAL_ITEMS} 项。`);
  }
  if (options.maximumDate) {
    if (!isRealIsoDate(options.maximumDate)) {
      throw new MarkdownDecisionError("技术决策的最大日期边界无效。");
    }
    const future = decisions.find((item) => item.date > options.maximumDate!);
    if (future) {
      throw new MarkdownDecisionError(
        `技术决策只记录已经作出的决定；${future.date} 晚于当前内容日期 ${options.maximumDate}。`,
        future.line,
      );
    }
  }
  return decisions;
}

export function extractMarkdownDecisions(markdown: string, options: MarkdownDecisionOptions = {}) {
  return parseMarkdownDecisions(markdown, options);
}

export function getMarkdownDecisionIssue(
  markdown: string,
  options: MarkdownDecisionOptions = {},
): MarkdownDecisionIssue | undefined {
  try {
    parseMarkdownDecisions(markdown, options);
    return undefined;
  } catch (error) {
    return {
      kind: "decision",
      ...(error instanceof MarkdownDecisionError && error.line ? { line: error.line } : {}),
      message: compactError(error) || "技术决策记录无法解析。",
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
  return node.children.filter((child) => !isText(child) || child.value.trim() !== "");
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

function hastLabel(node: ElementContent, label: string) {
  if (!isElement(node) || node.tagName !== "p") return false;
  const children = visibleHastChildren(node);
  return children.length === 1 && isElement(children[0]) && children[0].tagName === "strong" && hastText(children[0]) === label;
}

function renderedAlternative(item: Element) {
  const first = visibleHastChildren(item)[0];
  const inline = isElement(first) && first.tagName === "p"
    ? first.children
    : item.children;
  const [title, separator, ...rest] = inline;
  if (!isElement(title) || title.tagName !== "strong" || !isText(separator) || !separator.value.startsWith(" — ")) {
    throw new MarkdownDecisionError("备选方案缺少粗体名称或说明。");
  }
  const description = [text(separator.value.slice(3)), ...rest];
  return element("li", { className: ["markdown-decision-ledger-item"] }, [
    element("strong", { className: ["markdown-decision-alternative-title"] }, title.children),
    element("span", { className: ["markdown-decision-ledger-copy"] }, description),
  ]);
}

function renderedConsequence(item: Element) {
  const first = visibleHastChildren(item)[0];
  const inline = isElement(first) && first.tagName === "p"
    ? first.children
    : item.children;
  const [toneNode, separator, ...rest] = inline;
  const tone = isElement(toneNode) && toneNode.tagName === "code" ? hastText(toneNode).trim() : "";
  if (!CONSEQUENCE_TONE.has(tone) || !isText(separator) || !separator.value.startsWith(" ")) {
    throw new MarkdownDecisionError("决策影响缺少有效类型或说明。");
  }
  return element("li", {
    className: ["markdown-decision-ledger-item"],
    dataConsequenceTone: tone.toLocaleLowerCase("en-US"),
  }, [
    element("span", { className: ["markdown-decision-consequence-tone"] }, [text(tone)]),
    element("span", { className: ["markdown-decision-ledger-copy"] }, [text(separator.value.slice(1)), ...rest]),
  ]);
}

function renderedList(
  list: Element,
  kind: "alternatives" | "consequences",
) {
  if (list.tagName !== "ul") throw new MarkdownDecisionError("技术决策台账必须使用无序列表。");
  const items = visibleHastChildren(list).filter(
    (child): child is Element => isElement(child) && child.tagName === "li",
  );
  const renderItem = kind === "alternatives" ? renderedAlternative : renderedConsequence;
  return element("div", { className: ["markdown-decision-ledger-panel", `markdown-decision-${kind}`] }, [
    element("header", { className: ["markdown-decision-ledger-header"] }, [
      element("span", { className: ["markdown-decision-ledger-label"] }, [
        text(kind === "alternatives" ? "NOT SELECTED" : "IMPACT LEDGER"),
      ]),
      element("span", { className: ["markdown-decision-ledger-count"] }, [
        text(String(items.length).padStart(2, "0")),
      ]),
    ]),
    element("ul", { className: ["markdown-decision-ledger-list"] }, items.map(renderItem)),
  ]);
}

function renderedCopyPanel(label: string, paragraph: Element, className: string) {
  return element("div", { className: ["markdown-decision-copy-panel", className] }, [
    element("span", { className: ["markdown-decision-copy-label"] }, [text(label)]),
    element("div", { className: ["markdown-decision-copy"] }, paragraph.children),
  ]);
}

function decisionFromHastBlockquote(blockquote: Element, index: number) {
  const children = visibleHastChildren(blockquote);
  const metadata = children[0];
  if (!isElement(metadata) || metadata.tagName !== "p") return undefined;
  const metadataChildren = metadata.children;
  const markerNode = metadataChildren[0];
  if (!isText(markerNode) || !POTENTIAL_DECISION_MARKER.test(markerNode.value)) return undefined;
  const marker = DECISION_MARKER.exec(markerNode.value);
  const statusNode = metadataChildren[3];
  const dateNode = metadataChildren[7];
  const status = isElement(statusNode) ? hastText(statusNode).trim() : "";
  const date = isElement(dateNode) ? hastText(dateNode).trim() : "";
  if (
    children.length !== 11 ||
    !marker?.[1]?.trim() ||
    !STATUS.has(status) ||
    !isRealIsoDate(date) ||
    !hastLabel(children[1], "CONTEXT") ||
    !hastLabel(children[3], "DECISION") ||
    !hastLabel(children[5], "RATIONALE") ||
    !hastLabel(children[7], "ALTERNATIVES") ||
    !hastLabel(children[9], "CONSEQUENCES")
  ) {
    throw new MarkdownDecisionError("技术决策记录的渲染结构无效。");
  }
  const context = children[2];
  const decision = children[4];
  const rationale = children[6];
  const alternatives = children[8];
  const consequences = children[10];
  if (
    !isElement(context) || context.tagName !== "p" ||
    !isElement(decision) || decision.tagName !== "p" ||
    !isElement(rationale) || rationale.tagName !== "p" ||
    !isElement(alternatives) || !isElement(consequences)
  ) {
    throw new MarkdownDecisionError("技术决策记录缺少叙述或台账内容。");
  }
  const titleId = `markdown-decision-${index}-title`;
  return element("section", {
    ariaLabelledBy: [titleId],
    className: ["markdown-decision"],
    dataDecision: "decision-brief",
    dataLedgerItemCount:
      visibleHastChildren(alternatives).length + visibleHastChildren(consequences).length,
    dataStatus: status.toLocaleLowerCase("en-US"),
  }, [
    element("header", { className: ["markdown-decision-header"] }, [
      element("span", { className: ["markdown-decision-spine"], ariaHidden: "true" }, [text("DECISION / LOCK")]),
      element("span", { className: ["markdown-decision-heading"] }, [
        element("span", { className: ["markdown-decision-meta"] }, [
          element("span", { className: ["markdown-decision-status"] }, [text(status)]),
          element("time", { className: ["markdown-decision-date"], dateTime: date }, [text(date)]),
        ]),
        element("strong", { className: ["markdown-decision-title"], id: titleId }, [text(marker[1].trim())]),
      ]),
    ]),
    element("div", { className: ["markdown-decision-brief"] }, [
      renderedCopyPanel("CONTEXT", context, "markdown-decision-context"),
      renderedCopyPanel("DECISION", decision, "markdown-decision-verdict"),
      renderedCopyPanel("RATIONALE", rationale, "markdown-decision-rationale"),
    ]),
    element("div", { className: ["markdown-decision-ledger"] }, [
      renderedList(alternatives, "alternatives"),
      renderedList(consequences, "consequences"),
    ]),
  ]);
}

export function rehypeMarkdownDecisions() {
  return function transform(tree: Root) {
    let decisionCount = 0;
    let totalItems = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const decision = decisionFromHastBlockquote(child, decisionCount + 1);
      if (!decision) continue;
      decisionCount += 1;
      totalItems += Number(decision.properties.dataLedgerItemCount);
      if (decisionCount > MARKDOWN_DECISION_MAX_COUNT) {
        throw new MarkdownDecisionError(`每篇内容最多允许 ${MARKDOWN_DECISION_MAX_COUNT} 个技术决策记录。`);
      }
      if (totalItems > MARKDOWN_DECISION_MAX_TOTAL_ITEMS) {
        throw new MarkdownDecisionError(`每篇内容的技术决策台账合计最多允许 ${MARKDOWN_DECISION_MAX_TOTAL_ITEMS} 项。`);
      }
      tree.children[index] = decision as RootContent;
    }
  };
}

export function normalizeMarkdownDecisionsForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && decisionMarkerNode(node)) {
      const parsed = decisionFromMarkdownNode(node);
      if (!parsed) return;
      const children = visibleMarkdownChildren(node);
      children[0].children = [{ type: "text", value: `${parsed.title} ${parsed.date}` }];
      for (const index of [1, 3, 5, 7, 9]) children[index].children = [];
      for (const item of visibleMarkdownChildren(children[8])) {
        const paragraph = visibleMarkdownChildren(item)[0];
        const separator = paragraph?.children?.[1];
        if (separator?.type === "text" && separator.value?.startsWith(" — ")) {
          separator.value = separator.value.slice(3);
          paragraph?.children?.splice(1, 0, { type: "text", value: " " });
        }
      }
      for (const item of visibleMarkdownChildren(children[10])) {
        const paragraph = visibleMarkdownChildren(item)[0];
        if (paragraph?.children?.[0]?.type === "inlineCode") paragraph.children[0].value = "";
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
