import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import {
  parseMarkdown,
  type MarkdownNode,
} from "./content/markdown.ts";

export const MARKDOWN_REFERENCE_MAX_COUNT = 3;
export const MARKDOWN_REFERENCE_MIN_ITEMS = 2;
export const MARKDOWN_REFERENCE_MAX_ITEMS = 12;
export const MARKDOWN_REFERENCE_MAX_TOTAL_ITEMS = 24;
export const MARKDOWN_REFERENCE_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_REFERENCE_MAX_LABEL_LENGTH = 160;
export const MARKDOWN_REFERENCE_MAX_NOTE_LENGTH = 240;
export const MARKDOWN_REFERENCE_MAX_TARGET_LENGTH = 2048;

export interface MarkdownReferenceItem {
  external: boolean;
  label: string;
  line?: number;
  note?: string;
  origin: string;
  target: string;
}

export interface MarkdownReferenceListSource {
  items: MarkdownReferenceItem[];
  line?: number;
  title: string;
}

export interface MarkdownReferenceIssue {
  kind: "references";
  line?: number;
  message: string;
}

class MarkdownReferenceError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const REFERENCE_MARKER = /^\[!references\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_REFERENCE_MARKER = /^\[!references\](?:[+\-]|[ \t]|$)/iu;
const NOTE_SEPARATOR = /^\s+—\s+([^\r\n]+)$/u;

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

function referenceMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const children = visibleMarkdownChildren(first);
  const marker = children.length === 1 && children[0]?.type === "text"
    ? children[0]
    : undefined;
  return marker && POTENTIAL_REFERENCE_MARKER.test(marker.value ?? "")
    ? marker
    : undefined;
}

function inlineText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  return (node.children ?? []).map(inlineText).join("");
}

function validateLabelNode(node: MarkdownNode, line?: number) {
  if (node.type === "text" || node.type === "inlineCode") return;
  if (node.type === "emphasis" || node.type === "strong") {
    for (const child of node.children ?? []) validateLabelNode(child, line);
    return;
  }
  throw new MarkdownReferenceError(
    "参考资料名称只接受文本、行内代码和简单强调，不接受图片、公式、HTML、脚注或嵌套链接。",
    line,
  );
}

function validateReferenceTarget(value: string, line?: number) {
  const target = value.trim();
  if (!target || target.length > MARKDOWN_REFERENCE_MAX_TARGET_LENGTH) {
    throw new MarkdownReferenceError(
      `参考资料链接必须为 1–${MARKDOWN_REFERENCE_MAX_TARGET_LENGTH} 个字符。`,
      line,
    );
  }
  if (/[()\s]/u.test(target)) {
    throw new MarkdownReferenceError(
      "参考资料链接不能包含空白或未编码的圆括号，请使用可移植 URL。",
      line,
    );
  }
  if (target.startsWith("/") && !target.startsWith("//")) {
    return { external: false, origin: "本站", target };
  }
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new MarkdownReferenceError(
      "参考资料链接只接受完整 HTTPS URL 或以 / 开头的站内绝对路径。",
      line,
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new MarkdownReferenceError(
      "外部参考资料必须使用无凭据的 HTTPS URL 和默认端口。",
      line,
    );
  }
  return {
    external: true,
    origin: url.hostname.replace(/^www\./iu, ""),
    target,
  };
}

function referenceItemFromMarkdownNode(
  item: MarkdownNode,
  index: number,
): MarkdownReferenceItem {
  const line = item.position?.start?.line;
  const children = visibleMarkdownChildren(item);
  if (
    item.type !== "listItem" ||
    item.spread === true ||
    children.length !== 1 ||
    children[0]?.type !== "paragraph"
  ) {
    throw new MarkdownReferenceError(
      `第 ${index + 1} 条参考资料必须是单段有序列表项，不能嵌套列表或附加段落。`,
      line,
    );
  }
  const inline = visibleMarkdownChildren(children[0]);
  const link = inline[0];
  if (link?.type !== "link" || !link.url || link.title) {
    throw new MarkdownReferenceError(
      `第 ${index + 1} 条参考资料必须以行内 Markdown 链接开头，且不要添加隐藏 title。`,
      line,
    );
  }
  for (const child of link.children ?? []) validateLabelNode(child, line);
  const label = inlineText(link).replace(/\s+/gu, " ").trim();
  if (!label || label.length > MARKDOWN_REFERENCE_MAX_LABEL_LENGTH) {
    throw new MarkdownReferenceError(
      `第 ${index + 1} 条参考资料的可见名称必须为 1–${MARKDOWN_REFERENCE_MAX_LABEL_LENGTH} 个字符。`,
      line,
    );
  }
  let note: string | undefined;
  const remainder = inline.slice(1);
  if (remainder.length > 0) {
    if (remainder.length !== 1 || remainder[0]?.type !== "text") {
      throw new MarkdownReferenceError(
        `第 ${index + 1} 条参考资料的链接后只允许一个纯文本短注。`,
        line,
      );
    }
    const match = NOTE_SEPARATOR.exec(remainder[0].value ?? "");
    note = match?.[1]?.trim();
    if (!note || note.length > MARKDOWN_REFERENCE_MAX_NOTE_LENGTH) {
      throw new MarkdownReferenceError(
        `第 ${index + 1} 条参考资料的可选短注必须写成“ — 说明”，且不超过 ${MARKDOWN_REFERENCE_MAX_NOTE_LENGTH} 个字符。`,
        line,
      );
    }
  }
  const target = validateReferenceTarget(link.url, line);
  return {
    ...target,
    label,
    ...(line ? { line } : {}),
    ...(note ? { note } : {}),
  };
}

function referenceListFromMarkdownNode(
  blockquote: MarkdownNode,
): MarkdownReferenceListSource | undefined {
  const markerNode = referenceMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  const marker = REFERENCE_MARKER.exec(markerNode.value ?? "");
  if (!marker) {
    throw new MarkdownReferenceError(
      "参考资料清单标记必须写成静态的 > [!references] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_REFERENCE_MAX_TITLE_LENGTH) {
    throw new MarkdownReferenceError(
      `参考资料清单必须填写 1–${MARKDOWN_REFERENCE_MAX_TITLE_LENGTH} 个字符的可见标题。`,
      line,
    );
  }
  const children = visibleMarkdownChildren(blockquote);
  const list = children[1];
  if (
    children.length !== 2 ||
    list?.type !== "list" ||
    list.ordered !== true ||
    list.spread === true
  ) {
    throw new MarkdownReferenceError(
      "参考资料标题后必须紧跟一个紧凑有序列表，区块内不能混入段落、无序列表或嵌套内容。",
      line,
    );
  }
  const rawItems = visibleMarkdownChildren(list);
  if (
    rawItems.length < MARKDOWN_REFERENCE_MIN_ITEMS ||
    rawItems.length > MARKDOWN_REFERENCE_MAX_ITEMS
  ) {
    throw new MarkdownReferenceError(
      `每个参考资料清单必须包含 ${MARKDOWN_REFERENCE_MIN_ITEMS}–${MARKDOWN_REFERENCE_MAX_ITEMS} 条。`,
      list.position?.start?.line ?? line,
    );
  }
  const items = rawItems.map(referenceItemFromMarkdownNode);
  const normalizedTargets = items.map((item) =>
    item.target.normalize("NFKC").toLocaleLowerCase("en-US"),
  );
  if (new Set(normalizedTargets).size !== normalizedTargets.length) {
    throw new MarkdownReferenceError("同一参考资料清单不能包含重复链接。", line);
  }
  return { items, ...(line ? { line } : {}), title };
}

function parseMarkdownReferenceLists(markdown: string) {
  const lists: MarkdownReferenceListSource[] = [];
  const tree = parseMarkdown(markdown);

  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && referenceMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownReferenceError(
          "参考资料清单必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const list = referenceListFromMarkdownNode(node);
      if (list) lists.push(list);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }

  walk(tree);
  if (lists.length > MARKDOWN_REFERENCE_MAX_COUNT) {
    throw new MarkdownReferenceError(
      `每篇内容最多允许 ${MARKDOWN_REFERENCE_MAX_COUNT} 个参考资料清单。`,
    );
  }
  const totalItems = lists.reduce((total, list) => total + list.items.length, 0);
  if (totalItems > MARKDOWN_REFERENCE_MAX_TOTAL_ITEMS) {
    throw new MarkdownReferenceError(
      `每篇内容的参考资料合计最多允许 ${MARKDOWN_REFERENCE_MAX_TOTAL_ITEMS} 条。`,
    );
  }
  return lists;
}

export function extractMarkdownReferenceLists(markdown: string) {
  return parseMarkdownReferenceLists(markdown);
}

export function getMarkdownReferenceIssue(
  markdown: string,
): MarkdownReferenceIssue | undefined {
  try {
    parseMarkdownReferenceLists(markdown);
    return undefined;
  } catch (error) {
    return {
      kind: "references",
      ...(error instanceof MarkdownReferenceError && error.line
        ? { line: error.line }
        : {}),
      message: compactError(error) || "参考资料清单无法解析。",
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

function targetFacts(target: string) {
  return validateReferenceTarget(target);
}

function referenceListFromHastBlockquote(blockquote: Element, index: number) {
  const children = visibleHastChildren(blockquote);
  const markerParagraph = children[0] && isElement(children[0]) && children[0].tagName === "p"
    ? children[0]
    : undefined;
  const markerChildren = markerParagraph ? visibleHastChildren(markerParagraph) : [];
  const markerChild = markerChildren.length === 1 && isText(markerChildren[0])
    ? markerChildren[0]
    : undefined;
  if (!markerChild || !POTENTIAL_REFERENCE_MARKER.test(markerChild.value)) return undefined;
  const marker = REFERENCE_MARKER.exec(markerChild.value);
  if (!marker?.[1]?.trim()) {
    throw new MarkdownReferenceError(
      "参考资料清单标记必须写成静态的 > [!references] 标题。",
    );
  }
  const title = marker[1].trim();
  const list = children.length === 2 && isElement(children[1]) && children[1].tagName === "ol"
    ? children[1]
    : undefined;
  if (!list) throw new MarkdownReferenceError("参考资料标题后必须紧跟一个有序列表。");
  const items = visibleHastChildren(list).filter(
    (child): child is Element => isElement(child) && child.tagName === "li",
  );
  if (items.length < MARKDOWN_REFERENCE_MIN_ITEMS || items.length > MARKDOWN_REFERENCE_MAX_ITEMS) {
    throw new MarkdownReferenceError("参考资料条目数量超出发布预算。");
  }
  const titleId = `markdown-references-${index}-title`;
  const renderedItems = items.map((item, itemIndex) => {
    const itemChildren = visibleHastChildren(item);
    const paragraph = itemChildren.length === 1 && isElement(itemChildren[0]) && itemChildren[0].tagName === "p"
      ? itemChildren[0]
      : undefined;
    const inline = paragraph ? visibleHastChildren(paragraph) : itemChildren;
    const link = inline[0] && isElement(inline[0]) && inline[0].tagName === "a"
      ? inline[0]
      : undefined;
    const href = typeof link?.properties.href === "string" ? link.properties.href : "";
    if (!link || !href) throw new MarkdownReferenceError("参考资料条目缺少可见链接。");
    const facts = targetFacts(href);
    const remainder = inline.slice(1).map(hastText).join("");
    const note = remainder ? NOTE_SEPARATOR.exec(remainder)?.[1]?.trim() : undefined;
    if (remainder && !note) throw new MarkdownReferenceError("参考资料短注格式无效。");
    link.properties = {
      ...link.properties,
      className: ["markdown-reference-link"],
      dataReferenceOrigin: facts.origin,
    };
    return element(
      "li",
      {
        className: ["markdown-reference-item"],
        dataReferenceScope: facts.external ? "external" : "local",
      },
      [
        element("span", { ariaHidden: "true", className: ["markdown-reference-index"] }, [
          text(String(itemIndex + 1).padStart(2, "0")),
        ]),
        element("span", { className: ["markdown-reference-copy"] }, [
          link,
          element("span", { className: ["markdown-reference-origin"] }, [text(facts.origin)]),
          ...(note
            ? [element("span", { className: ["markdown-reference-note"] }, [text(note)])]
            : []),
          element("span", { className: ["markdown-reference-print-target"] }, [text(href)]),
        ]),
      ],
    );
  });
  return element(
    "section",
    {
      ariaLabelledBy: [titleId],
      className: ["markdown-references"],
      dataReferenceCount: renderedItems.length,
      dataReferences: "curated-index",
    },
    [
      element("header", { className: ["markdown-reference-header"] }, [
        element("span", { className: ["markdown-reference-rail"] }, [
          element("span", { className: ["markdown-reference-kind"] }, [
            text(`SOURCE INDEX / ${String(renderedItems.length).padStart(2, "0")} REFERENCES`),
          ]),
          element("span", { className: ["markdown-reference-mode"] }, [
            text("HTTPS + LOCAL · STATIC"),
          ]),
        ]),
        element("strong", { className: ["markdown-reference-title"], id: titleId }, [text(title)]),
      ]),
      element("ol", { className: ["markdown-reference-items"] }, renderedItems),
    ],
  );
}

export function rehypeMarkdownReferenceLists() {
  return function transform(tree: Root) {
    let listCount = 0;
    let totalItems = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const referenceList = referenceListFromHastBlockquote(child, listCount + 1);
      if (!referenceList) continue;
      listCount += 1;
      totalItems += Number(referenceList.properties.dataReferenceCount);
      if (listCount > MARKDOWN_REFERENCE_MAX_COUNT) {
        throw new MarkdownReferenceError(
          `每篇内容最多允许 ${MARKDOWN_REFERENCE_MAX_COUNT} 个参考资料清单。`,
        );
      }
      if (totalItems > MARKDOWN_REFERENCE_MAX_TOTAL_ITEMS) {
        throw new MarkdownReferenceError(
          `每篇内容的参考资料合计最多允许 ${MARKDOWN_REFERENCE_MAX_TOTAL_ITEMS} 条。`,
        );
      }
      tree.children[index] = referenceList as RootContent;
    }
  };
}

export function normalizeMarkdownReferenceListsForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && referenceMarkerNode(node)) {
      const marker = referenceMarkerNode(node);
      const parsed = marker ? REFERENCE_MARKER.exec(marker.value ?? "") : undefined;
      if (marker && parsed?.[1]) marker.value = parsed[1].trim();
      const list = visibleMarkdownChildren(node)[1];
      for (const item of list?.children ?? []) {
        const paragraph = visibleMarkdownChildren(item)[0];
        const children = paragraph?.children ?? [];
        const remainder = children[1];
        if (remainder?.type === "text") {
          remainder.value = (remainder.value ?? "").replace(/^\s+—\s+/u, " ");
        }
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
