import type { Element, ElementContent, Root, RootContent, Text } from "hast";

export type MarkdownCalloutCanonicalType =
  | "abstract"
  | "bug"
  | "danger"
  | "example"
  | "failure"
  | "info"
  | "note"
  | "question"
  | "quote"
  | "success"
  | "tip"
  | "todo"
  | "warning";

export type MarkdownCalloutFold = "closed" | "open" | "static";

export interface MarkdownCalloutMarker {
  bodyStart: string;
  canonicalType: MarkdownCalloutCanonicalType;
  fold: MarkdownCalloutFold;
  identifier: string;
  kind: string;
  title: string;
}

type MarkdownTreeNode = {
  children?: MarkdownTreeNode[];
  type: string;
  value?: string;
};

const CALLOUT_TYPES = Object.freeze({
  abstract: { aliases: ["summary", "tldr"], title: "摘要" },
  bug: { aliases: [], title: "缺陷" },
  danger: { aliases: ["error"], title: "危险" },
  example: { aliases: [], title: "示例" },
  failure: { aliases: ["fail", "missing"], title: "失败" },
  info: { aliases: [], title: "信息" },
  note: { aliases: [], title: "笔记" },
  question: { aliases: ["help", "faq"], title: "问题" },
  quote: { aliases: ["cite"], title: "引用" },
  success: { aliases: ["check", "done"], title: "完成" },
  tip: { aliases: ["hint", "important"], title: "提示" },
  todo: { aliases: [], title: "待办" },
  warning: { aliases: ["caution", "attention"], title: "警告" },
} satisfies Record<
  MarkdownCalloutCanonicalType,
  { aliases: readonly string[]; title: string }
>);

const TYPE_BY_IDENTIFIER = new Map<string, MarkdownCalloutCanonicalType>();
for (const [canonicalType, definition] of Object.entries(CALLOUT_TYPES)) {
  TYPE_BY_IDENTIFIER.set(
    canonicalType,
    canonicalType as MarkdownCalloutCanonicalType,
  );
  for (const alias of definition.aliases) {
    TYPE_BY_IDENTIFIER.set(alias, canonicalType as MarkdownCalloutCanonicalType);
  }
}

const CALLOUT_MARKER =
  /^\[!([a-z][a-z0-9-]{0,31})\]([+-])?(?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;

function titleCaseIdentifier(identifier: string) {
  return identifier
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0].toLocaleUpperCase("en")}${part.slice(1)}`)
    .join(" ");
}

export function parseMarkdownCalloutMarker(
  value: string,
): MarkdownCalloutMarker | undefined {
  const newline = value.search(/\r?\n/u);
  const firstLine = newline < 0 ? value : value.slice(0, newline);
  const bodyStart = newline < 0 ? "" : value.slice(newline + (value[newline] === "\r" ? 2 : 1));
  const match = CALLOUT_MARKER.exec(firstLine);
  if (!match) return undefined;

  const identifier = match[1].toLocaleLowerCase("en");
  const canonicalType = TYPE_BY_IDENTIFIER.get(identifier) ?? "note";
  const customTitle = match[3]?.trim();
  const knownType = TYPE_BY_IDENTIFIER.has(identifier);

  return {
    bodyStart,
    canonicalType,
    fold: match[2] === "+" ? "open" : match[2] === "-" ? "closed" : "static",
    identifier,
    kind: identifier.replaceAll("-", " ").toLocaleUpperCase("en"),
    title:
      customTitle ||
      (knownType
        ? CALLOUT_TYPES[canonicalType].title
        : titleCaseIdentifier(identifier)),
  };
}

function isElement(node: ElementContent | RootContent): node is Element {
  return node.type === "element";
}

function isText(node: ElementContent | RootContent): node is Text {
  return node.type === "text";
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

function calloutTitle(
  marker: MarkdownCalloutMarker,
  tagName: "div" | "summary",
) {
  return element(tagName, { className: ["markdown-callout-title"] }, [
    element(
      "span",
      { ariaHidden: "true", className: ["markdown-callout-kind"] },
      [text(`${marker.kind} /`)],
    ),
    element("span", { className: ["markdown-callout-title-text"] }, [
      text(marker.title),
    ]),
  ]);
}

function hasVisibleContent(node: Element) {
  return node.children.some(
    (child) => isElement(child) || (isText(child) && child.value.trim() !== ""),
  );
}

function transformBlockquote(blockquote: Element): Element | undefined {
  const paragraphIndex = blockquote.children.findIndex(
    (child) => isElement(child) && child.tagName === "p",
  );
  if (paragraphIndex < 0) return undefined;
  const paragraph = blockquote.children[paragraphIndex];
  if (!isElement(paragraph)) return undefined;
  const first = paragraph.children[0];
  if (!first || !isText(first)) return undefined;
  const marker = parseMarkdownCalloutMarker(first.value);
  if (!marker) return undefined;

  if (marker.bodyStart) first.value = marker.bodyStart;
  else paragraph.children.shift();
  if (!hasVisibleContent(paragraph)) blockquote.children.splice(paragraphIndex, 1);

  const body = blockquote.children.some(
    (child) => isElement(child) || (isText(child) && child.value.trim() !== ""),
  )
    ? element(
        "div",
        { className: ["markdown-callout-body"] },
        blockquote.children,
      )
    : undefined;
  const properties: Element["properties"] = {
    className: ["markdown-callout"],
    dataCallout: marker.canonicalType,
    dataCalloutSource: marker.identifier,
  };

  if (marker.fold === "static") {
    return element(
      "aside",
      { ...properties, role: "note" },
      [calloutTitle(marker, "div"), ...(body ? [body] : [])],
    );
  }

  return element(
    "details",
    { ...properties, ...(marker.fold === "open" ? { open: true } : {}) },
    [calloutTitle(marker, "summary"), ...(body ? [body] : [])],
  );
}

export function rehypeMarkdownCallouts() {
  return function transform(tree: Root) {
    function walk(parent: Root | Element) {
      for (let index = 0; index < parent.children.length; index += 1) {
        const child = parent.children[index];
        if (!isElement(child)) continue;
        walk(child);
        if (child.tagName !== "blockquote") continue;
        const callout = transformBlockquote(child);
        if (callout) parent.children[index] = callout;
      }
    }

    walk(tree);
  };
}

export function normalizeMarkdownCalloutsForPlainText(tree: MarkdownTreeNode) {
  function walk(node: MarkdownTreeNode) {
    if (node.type === "blockquote") {
      const paragraph = node.children?.find((child) => child.type === "paragraph");
      const first = paragraph?.children?.[0];
      if (first?.type === "text" && typeof first.value === "string") {
        const marker = parseMarkdownCalloutMarker(first.value);
        if (marker) {
          first.value = [marker.title, marker.bodyStart].filter(Boolean).join("\n");
        }
      }
    }
    for (const child of node.children ?? []) walk(child);
  }

  walk(tree);
  return tree;
}
