import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_EXPERIMENT_MAX_COUNT = 3;
export const MARKDOWN_EXPERIMENT_MIN_MEASUREMENTS = 1;
export const MARKDOWN_EXPERIMENT_MAX_MEASUREMENTS = 8;
export const MARKDOWN_EXPERIMENT_MIN_LIMITATIONS = 1;
export const MARKDOWN_EXPERIMENT_MAX_LIMITATIONS = 6;
export const MARKDOWN_EXPERIMENT_MAX_TOTAL_ITEMS = 30;
export const MARKDOWN_EXPERIMENT_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_EXPERIMENT_MAX_COPY_LENGTH = 800;
export const MARKDOWN_EXPERIMENT_MAX_ITEM_TITLE_LENGTH = 120;
export const MARKDOWN_EXPERIMENT_MAX_VALUE_LENGTH = 80;
export const MARKDOWN_EXPERIMENT_MAX_ITEM_DESCRIPTION_LENGTH = 400;
export const MARKDOWN_EXPERIMENT_STATUSES = [
  "SUPPORTED",
  "REFUTED",
  "INCONCLUSIVE",
  "FAILED",
] as const;

export type MarkdownExperimentStatus = (typeof MARKDOWN_EXPERIMENT_STATUSES)[number];

export interface MarkdownExperimentMeasurement {
  description: string;
  label: string;
  line?: number;
  value: string;
}

export interface MarkdownExperimentLimitation {
  description: string;
  line?: number;
  title: string;
}

export interface MarkdownExperimentSource {
  conclusion: string;
  date: string;
  environment: string;
  hypothesis: string;
  limitations: MarkdownExperimentLimitation[];
  line?: number;
  measurements: MarkdownExperimentMeasurement[];
  method: string;
  sample: string;
  status: MarkdownExperimentStatus;
  title: string;
}

export interface MarkdownExperimentIssue {
  kind: "experiment";
  line?: number;
  message: string;
}

export interface MarkdownExperimentOptions {
  maximumDate?: string;
}

class MarkdownExperimentError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const EXPERIMENT_MARKER = /^\[!experiment\](?:[ \t]+([^\r\n]*?))?[ \t]*\r?\n$/iu;
const POTENTIAL_EXPERIMENT_MARKER = /^\[!experiment\](?:[+\-]|[ \t]|$)/iu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STATUS = new Set<string>(MARKDOWN_EXPERIMENT_STATUSES);
const SECTION_LABELS = [
  "HYPOTHESIS",
  "ENVIRONMENT",
  "METHOD",
  "SAMPLE",
  "MEASUREMENTS",
  "CONCLUSION",
  "LIMITATIONS",
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

function experimentMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const marker = first.children?.[0];
  return marker?.type === "text" && POTENTIAL_EXPERIMENT_MARKER.test(marker.value ?? "")
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
  throw new MarkdownExperimentError(
    "技术实验记录只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注、硬换行与嵌套内容请移到记录外。",
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
    throw new MarkdownExperimentError(`${label} 必须是一个独立段落。`, line);
  }
  for (const child of node.children ?? []) validateInline(child, line);
  const value = inlineText(node).replace(/\s+/gu, " ").trim();
  if (!value || value.length > MARKDOWN_EXPERIMENT_MAX_COPY_LENGTH) {
    throw new MarkdownExperimentError(
      `${label} 必须为 1–${MARKDOWN_EXPERIMENT_MAX_COPY_LENGTH} 个字符。`,
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
    ? EXPERIMENT_MARKER.exec(marker.value ?? "")
    : undefined;
  if (!markerMatch) {
    throw new MarkdownExperimentError(
      "技术实验标记必须写成静态的 > [!experiment] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = markerMatch[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_EXPERIMENT_MAX_TITLE_LENGTH) {
    throw new MarkdownExperimentError(
      `技术实验标题必须为 1–${MARKDOWN_EXPERIMENT_MAX_TITLE_LENGTH} 个字符。`,
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
    throw new MarkdownExperimentError(
      "技术实验元数据必须写成 **STATUS:** `SUPPORTED` · **DATE:** `YYYY-MM-DD`。",
      line,
    );
  }
  const status = (statusNode.value ?? "").trim();
  if (!STATUS.has(status)) {
    throw new MarkdownExperimentError(
      `技术实验状态只允许 ${MARKDOWN_EXPERIMENT_STATUSES.join(" / ")}。`,
      line,
    );
  }
  const date = (dateNode.value ?? "").trim();
  if (!isRealIsoDate(date)) {
    throw new MarkdownExperimentError("技术实验日期必须是真实的 YYYY-MM-DD。", line);
  }
  return { date, status: status as MarkdownExperimentStatus, title };
}

function parseMeasurement(item: MarkdownNode, index: number) {
  const line = item.position?.start?.line;
  const children = visibleMarkdownChildren(item);
  const paragraph = children[0];
  const inline = paragraph?.children ?? [];
  const [labelNode, valueSpace, valueNode, separator, ...descriptionNodes] = inline;
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    children.length !== 1 ||
    paragraph?.type !== "paragraph" ||
    labelNode?.type !== "strong" ||
    valueSpace?.type !== "text" ||
    valueSpace.value !== " " ||
    valueNode?.type !== "inlineCode" ||
    separator?.type !== "text" ||
    !(separator.value ?? "").startsWith(" — ")
  ) {
    throw new MarkdownExperimentError(
      `第 ${index + 1} 项测量必须写成 - **指标名** \`测量值\` — 说明。`,
      line,
    );
  }
  const label = inlineText(labelNode).replace(/\s+/gu, " ").trim();
  const value = (valueNode.value ?? "").replace(/\s+/gu, " ").trim();
  if (!label || label.length > MARKDOWN_EXPERIMENT_MAX_ITEM_TITLE_LENGTH) {
    throw new MarkdownExperimentError(
      `第 ${index + 1} 项测量名称必须为 1–${MARKDOWN_EXPERIMENT_MAX_ITEM_TITLE_LENGTH} 个字符。`,
      line,
    );
  }
  if (!value || value.length > MARKDOWN_EXPERIMENT_MAX_VALUE_LENGTH) {
    throw new MarkdownExperimentError(
      `第 ${index + 1} 项测量值必须为 1–${MARKDOWN_EXPERIMENT_MAX_VALUE_LENGTH} 个字符。`,
      line,
    );
  }
  const descriptionPrefix = { ...separator, value: (separator.value ?? "").slice(3) };
  const copyNodes = [descriptionPrefix, ...descriptionNodes];
  for (const child of copyNodes) validateInline(child, line);
  const description = copyNodes.map(inlineText).join("").replace(/\s+/gu, " ").trim();
  if (!description || description.length > MARKDOWN_EXPERIMENT_MAX_ITEM_DESCRIPTION_LENGTH) {
    throw new MarkdownExperimentError(
      `第 ${index + 1} 项测量说明必须为 1–${MARKDOWN_EXPERIMENT_MAX_ITEM_DESCRIPTION_LENGTH} 个字符。`,
      line,
    );
  }
  return { description, label, ...(line ? { line } : {}), value };
}

function parseLimitation(item: MarkdownNode, index: number) {
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
    throw new MarkdownExperimentError(
      `第 ${index + 1} 项局限必须写成 - **局限名** — 说明。`,
      line,
    );
  }
  const title = inlineText(titleNode).replace(/\s+/gu, " ").trim();
  if (!title || title.length > MARKDOWN_EXPERIMENT_MAX_ITEM_TITLE_LENGTH) {
    throw new MarkdownExperimentError(
      `第 ${index + 1} 项局限名称必须为 1–${MARKDOWN_EXPERIMENT_MAX_ITEM_TITLE_LENGTH} 个字符。`,
      line,
    );
  }
  const descriptionPrefix = { ...separator, value: (separator.value ?? "").slice(3) };
  const copyNodes = [descriptionPrefix, ...descriptionNodes];
  for (const child of copyNodes) validateInline(child, line);
  const description = copyNodes.map(inlineText).join("").replace(/\s+/gu, " ").trim();
  if (!description || description.length > MARKDOWN_EXPERIMENT_MAX_ITEM_DESCRIPTION_LENGTH) {
    throw new MarkdownExperimentError(
      `第 ${index + 1} 项局限说明必须为 1–${MARKDOWN_EXPERIMENT_MAX_ITEM_DESCRIPTION_LENGTH} 个字符。`,
      line,
    );
  }
  return { description, ...(line ? { line } : {}), title };
}

function parseList<T>(
  node: MarkdownNode,
  label: string,
  minimum: number,
  maximum: number,
  parseItem: (item: MarkdownNode, index: number) => T,
) {
  const line = node.position?.start?.line;
  if (node.type !== "list" || node.ordered !== false) {
    throw new MarkdownExperimentError(`${label} 必须使用无序列表。`, line);
  }
  const items = visibleMarkdownChildren(node);
  if (items.length < minimum || items.length > maximum) {
    throw new MarkdownExperimentError(`${label} 必须包含 ${minimum}–${maximum} 项。`, line);
  }
  return items.map(parseItem);
}

function experimentFromMarkdownNode(blockquote: MarkdownNode) {
  const marker = experimentMarkerNode(blockquote);
  if (!marker) return undefined;
  const line = blockquote.position?.start?.line;
  const children = visibleMarkdownChildren(blockquote);
  if (children.length !== 15 || children[0]?.type !== "paragraph") {
    throw new MarkdownExperimentError(
      "技术实验必须依次包含元数据、HYPOTHESIS、ENVIRONMENT、METHOD、SAMPLE、MEASUREMENTS、CONCLUSION 和 LIMITATIONS，不能增删区段。",
      line,
    );
  }
  for (const [index, label] of SECTION_LABELS.entries()) {
    const childIndex = index * 2 + 1;
    if (!isLabel(children[childIndex], label)) {
      throw new MarkdownExperimentError(
        `技术实验缺少固定区段 **${label}** 或顺序错误。`,
        children[childIndex]?.position?.start?.line ?? line,
      );
    }
  }
  const metadata = parseMetadata(children[0]);
  const hypothesis = parseCopy(children[2], "HYPOTHESIS");
  const environment = parseCopy(children[4], "ENVIRONMENT");
  const method = parseCopy(children[6], "METHOD");
  const sample = parseCopy(children[8], "SAMPLE");
  const measurements = parseList(
    children[10],
    "MEASUREMENTS",
    MARKDOWN_EXPERIMENT_MIN_MEASUREMENTS,
    MARKDOWN_EXPERIMENT_MAX_MEASUREMENTS,
    parseMeasurement,
  );
  const conclusion = parseCopy(children[12], "CONCLUSION");
  const limitations = parseList(
    children[14],
    "LIMITATIONS",
    MARKDOWN_EXPERIMENT_MIN_LIMITATIONS,
    MARKDOWN_EXPERIMENT_MAX_LIMITATIONS,
    parseLimitation,
  );
  const measurementKeys = measurements.map((item) =>
    item.label.normalize("NFKC").toLocaleLowerCase("zh-CN")
  );
  if (new Set(measurementKeys).size !== measurementKeys.length) {
    throw new MarkdownExperimentError("同一技术实验不能包含名称重复的测量项。", line);
  }
  const limitationKeys = limitations.map((item) =>
    item.title.normalize("NFKC").toLocaleLowerCase("zh-CN")
  );
  if (new Set(limitationKeys).size !== limitationKeys.length) {
    throw new MarkdownExperimentError("同一技术实验不能包含名称重复的局限项。", line);
  }
  return {
    conclusion,
    environment,
    hypothesis,
    limitations,
    ...(line ? { line } : {}),
    measurements,
    method,
    sample,
    ...metadata,
  } satisfies MarkdownExperimentSource;
}

function parseMarkdownExperiments(markdown: string, options: MarkdownExperimentOptions = {}) {
  const experiments: MarkdownExperimentSource[] = [];
  const tree = parseMarkdown(markdown);
  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && experimentMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownExperimentError(
          "技术实验必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const experiment = experimentFromMarkdownNode(node);
      if (experiment) experiments.push(experiment);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }
  walk(tree);
  if (experiments.length > MARKDOWN_EXPERIMENT_MAX_COUNT) {
    throw new MarkdownExperimentError(`每篇内容最多允许 ${MARKDOWN_EXPERIMENT_MAX_COUNT} 个技术实验记录。`);
  }
  const totalItems = experiments.reduce(
    (total, item) => total + item.measurements.length + item.limitations.length,
    0,
  );
  if (totalItems > MARKDOWN_EXPERIMENT_MAX_TOTAL_ITEMS) {
    throw new MarkdownExperimentError(`每篇内容的技术实验测量与局限合计最多允许 ${MARKDOWN_EXPERIMENT_MAX_TOTAL_ITEMS} 项。`);
  }
  if (options.maximumDate) {
    if (!isRealIsoDate(options.maximumDate)) {
      throw new MarkdownExperimentError("技术实验的最大日期边界无效。");
    }
    const future = experiments.find((item) => item.date > options.maximumDate!);
    if (future) {
      throw new MarkdownExperimentError(
        `技术实验只记录已经完成的运行；${future.date} 晚于当前内容日期 ${options.maximumDate}。`,
        future.line,
      );
    }
  }
  return experiments;
}

export function extractMarkdownExperiments(
  markdown: string,
  options: MarkdownExperimentOptions = {},
) {
  return parseMarkdownExperiments(markdown, options);
}

export function getMarkdownExperimentIssue(
  markdown: string,
  options: MarkdownExperimentOptions = {},
): MarkdownExperimentIssue | undefined {
  try {
    parseMarkdownExperiments(markdown, options);
    return undefined;
  } catch (error) {
    return {
      kind: "experiment",
      ...(error instanceof MarkdownExperimentError && error.line ? { line: error.line } : {}),
      message: compactError(error) || "技术实验记录无法解析。",
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
  return children.length === 1 &&
    isElement(children[0]) &&
    children[0].tagName === "strong" &&
    hastText(children[0]) === label;
}

function renderedMeasurement(item: Element) {
  const first = visibleHastChildren(item)[0];
  const inline = isElement(first) && first.tagName === "p" ? first.children : item.children;
  const [label, valueSpace, value, separator, ...rest] = inline;
  if (
    !isElement(label) || label.tagName !== "strong" ||
    !isText(valueSpace) || valueSpace.value !== " " ||
    !isElement(value) || value.tagName !== "code" ||
    !isText(separator) || !separator.value.startsWith(" — ")
  ) {
    throw new MarkdownExperimentError("技术实验测量缺少名称、值或说明。");
  }
  return element("li", { className: ["markdown-experiment-measurement"] }, [
    element("strong", { className: ["markdown-experiment-measurement-label"] }, label.children),
    element("code", { className: ["markdown-experiment-measurement-value"] }, value.children),
    element("span", { className: ["markdown-experiment-measurement-copy"] }, [
      text(separator.value.slice(3)),
      ...rest,
    ]),
  ]);
}

function renderedLimitation(item: Element) {
  const first = visibleHastChildren(item)[0];
  const inline = isElement(first) && first.tagName === "p" ? first.children : item.children;
  const [title, separator, ...rest] = inline;
  if (!isElement(title) || title.tagName !== "strong" || !isText(separator) || !separator.value.startsWith(" — ")) {
    throw new MarkdownExperimentError("技术实验局限缺少名称或说明。");
  }
  return element("li", { className: ["markdown-experiment-limitation"] }, [
    element("strong", { className: ["markdown-experiment-limitation-title"] }, title.children),
    element("span", { className: ["markdown-experiment-limitation-copy"] }, [
      text(separator.value.slice(3)),
      ...rest,
    ]),
  ]);
}

function renderedCopyPanel(label: string, paragraph: Element, className: string) {
  return element("div", { className: ["markdown-experiment-copy-panel", className] }, [
    element("span", { className: ["markdown-experiment-copy-label"] }, [text(label)]),
    element("div", { className: ["markdown-experiment-copy"] }, paragraph.children),
  ]);
}

function renderedListItems(list: Element, renderer: (item: Element) => Element) {
  if (list.tagName !== "ul") throw new MarkdownExperimentError("技术实验台账必须使用无序列表。");
  return visibleHastChildren(list)
    .filter((child): child is Element => isElement(child) && child.tagName === "li")
    .map(renderer);
}

function experimentFromHastBlockquote(blockquote: Element, index: number) {
  const children = visibleHastChildren(blockquote);
  const metadata = children[0];
  if (!isElement(metadata) || metadata.tagName !== "p") return undefined;
  const metadataChildren = metadata.children;
  const markerNode = metadataChildren[0];
  if (!isText(markerNode) || !POTENTIAL_EXPERIMENT_MARKER.test(markerNode.value)) return undefined;
  const marker = EXPERIMENT_MARKER.exec(markerNode.value);
  const statusNode = metadataChildren[3];
  const dateNode = metadataChildren[7];
  const status = isElement(statusNode) ? hastText(statusNode).trim() : "";
  const date = isElement(dateNode) ? hastText(dateNode).trim() : "";
  if (
    children.length !== 15 ||
    !marker?.[1]?.trim() ||
    !STATUS.has(status) ||
    !isRealIsoDate(date) ||
    !SECTION_LABELS.every((label, labelIndex) => hastLabel(children[labelIndex * 2 + 1], label))
  ) {
    throw new MarkdownExperimentError("技术实验记录的渲染结构无效。");
  }
  const hypothesis = children[2];
  const environment = children[4];
  const method = children[6];
  const sample = children[8];
  const measurements = children[10];
  const conclusion = children[12];
  const limitations = children[14];
  if (
    !isElement(hypothesis) || hypothesis.tagName !== "p" ||
    !isElement(environment) || environment.tagName !== "p" ||
    !isElement(method) || method.tagName !== "p" ||
    !isElement(sample) || sample.tagName !== "p" ||
    !isElement(measurements) ||
    !isElement(conclusion) || conclusion.tagName !== "p" ||
    !isElement(limitations)
  ) {
    throw new MarkdownExperimentError("技术实验记录缺少叙述、测量或局限内容。");
  }
  const measurementItems = renderedListItems(measurements, renderedMeasurement);
  const limitationItems = renderedListItems(limitations, renderedLimitation);
  const titleId = `markdown-experiment-${index}-title`;
  return element("section", {
    ariaLabelledBy: [titleId],
    className: ["markdown-experiment"],
    dataExperiment: "bench-sheet",
    dataLedgerItemCount: measurementItems.length + limitationItems.length,
    dataStatus: status.toLocaleLowerCase("en-US"),
  }, [
    element("header", { className: ["markdown-experiment-header"] }, [
      element("span", { className: ["markdown-experiment-spine"], ariaHidden: "true" }, [text("EXPERIMENT / RUN")]),
      element("span", { className: ["markdown-experiment-heading"] }, [
        element("span", { className: ["markdown-experiment-meta"] }, [
          element("span", { className: ["markdown-experiment-status"] }, [text(status)]),
          element("time", { className: ["markdown-experiment-date"], dateTime: date }, [text(date)]),
        ]),
        element("strong", { className: ["markdown-experiment-title"], id: titleId }, [text(marker[1].trim())]),
      ]),
    ]),
    renderedCopyPanel("HYPOTHESIS", hypothesis, "markdown-experiment-hypothesis"),
    element("div", { className: ["markdown-experiment-setup"] }, [
      renderedCopyPanel("ENVIRONMENT", environment, "markdown-experiment-environment"),
      renderedCopyPanel("METHOD", method, "markdown-experiment-method"),
      renderedCopyPanel("SAMPLE", sample, "markdown-experiment-sample"),
    ]),
    element("div", { className: ["markdown-experiment-results"] }, [
      element("div", { className: ["markdown-experiment-measurements"] }, [
        element("header", { className: ["markdown-experiment-ledger-header"] }, [
          element("span", { className: ["markdown-experiment-ledger-label"] }, [text("MEASUREMENTS")]),
          element("span", { className: ["markdown-experiment-ledger-count"] }, [text(String(measurementItems.length).padStart(2, "0"))]),
        ]),
        element("ul", { className: ["markdown-experiment-measurement-list"] }, measurementItems),
      ]),
      renderedCopyPanel("CONCLUSION", conclusion, "markdown-experiment-conclusion"),
      element("div", { className: ["markdown-experiment-limitations"] }, [
        element("header", { className: ["markdown-experiment-ledger-header"] }, [
          element("span", { className: ["markdown-experiment-ledger-label"] }, [text("LIMITATIONS")]),
          element("span", { className: ["markdown-experiment-ledger-count"] }, [text(String(limitationItems.length).padStart(2, "0"))]),
        ]),
        element("ul", { className: ["markdown-experiment-limitation-list"] }, limitationItems),
      ]),
    ]),
  ]);
}

export function rehypeMarkdownExperiments() {
  return function transform(tree: Root) {
    let experimentCount = 0;
    let totalItems = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const experiment = experimentFromHastBlockquote(child, experimentCount + 1);
      if (!experiment) continue;
      experimentCount += 1;
      totalItems += Number(experiment.properties.dataLedgerItemCount);
      if (experimentCount > MARKDOWN_EXPERIMENT_MAX_COUNT) {
        throw new MarkdownExperimentError(`每篇内容最多允许 ${MARKDOWN_EXPERIMENT_MAX_COUNT} 个技术实验记录。`);
      }
      if (totalItems > MARKDOWN_EXPERIMENT_MAX_TOTAL_ITEMS) {
        throw new MarkdownExperimentError(`每篇内容的技术实验测量与局限合计最多允许 ${MARKDOWN_EXPERIMENT_MAX_TOTAL_ITEMS} 项。`);
      }
      tree.children[index] = experiment as RootContent;
    }
  };
}

export function normalizeMarkdownExperimentsForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && experimentMarkerNode(node)) {
      const parsed = experimentFromMarkdownNode(node);
      if (!parsed) return;
      const children = visibleMarkdownChildren(node);
      children[0].children = [{ type: "text", value: `${parsed.title} ${parsed.date}` }];
      for (const index of [1, 3, 5, 7, 9, 11, 13]) children[index].children = [];
      for (const item of visibleMarkdownChildren(children[10])) {
        const paragraph = visibleMarkdownChildren(item)[0];
        const separator = paragraph?.children?.[3];
        if (separator?.type === "text" && separator.value?.startsWith(" — ")) {
          separator.value = ` ${separator.value.slice(3)}`;
        }
      }
      for (const item of visibleMarkdownChildren(children[14])) {
        const paragraph = visibleMarkdownChildren(item)[0];
        const separator = paragraph?.children?.[1];
        if (separator?.type === "text" && separator.value?.startsWith(" — ")) {
          separator.value = ` ${separator.value.slice(3)}`;
        }
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
