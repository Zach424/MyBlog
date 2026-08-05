import GithubSlugger from "github-slugger";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mathFromMarkdown } from "mdast-util-math";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";

export interface TableOfContentsItem {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface MarkdownHeadingAnchor {
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  id: string;
  line?: number;
  text: string;
}

export type InternalContentReference =
  | {
      bodyLine?: number;
      fragment?: string;
      kind: "post" | "project";
      slug: string;
      url: `/posts/${string}` | `/projects/${string}`;
    }
  | {
      bodyLine?: number;
      fragment: string;
      kind: "self";
    };

export type InternalContentReferenceEvidence = InternalContentReference & {
  occurrences: number;
  sourceLines: number[];
};

export type MarkdownNode = {
  alt?: string;
  children?: MarkdownNode[];
  depth?: number;
  identifier?: string;
  position?: {
    start?: {
      line?: number;
    };
  };
  type: string;
  url?: string;
  value?: string;
};

export function parseMarkdown(markdown: string) {
  return fromMarkdown(markdown, {
    extensions: [gfm(), math({ singleDollarTextMath: true })],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  }) as MarkdownNode;
}

export function walkMarkdown(
  node: MarkdownNode,
  visit: (node: MarkdownNode) => void,
) {
  visit(node);
  for (const child of node.children ?? []) walkMarkdown(child, visit);
}

function renderedHeadingText(node: MarkdownNode): string {
  if (
    node.type === "text" ||
    node.type === "inlineCode" ||
    node.type === "inlineMath"
  ) {
    return node.value ?? "";
  }
  if (
    node.type === "break" ||
    node.type === "html" ||
    node.type === "image" ||
    node.type === "imageReference"
  ) {
    return "";
  }
  return (node.children ?? []).map(renderedHeadingText).join("");
}

export interface MarkdownMathExpression {
  display: boolean;
  line?: number;
  value: string;
}

export function extractMarkdownMathExpressions(markdown: string) {
  const expressions: MarkdownMathExpression[] = [];
  walkMarkdown(parseMarkdown(markdown), (node) => {
    if (node.type !== "math" && node.type !== "inlineMath") return;
    expressions.push({
      display: node.type === "math",
      ...(node.position?.start?.line ? { line: node.position.start.line } : {}),
      value: node.value ?? "",
    });
  });
  return expressions;
}

function internalReferenceFromUrl(
  value: string,
  bodyLine?: number,
): InternalContentReference | undefined {
  const self = /^#([^#\s]+)$/u.exec(value);
  if (self) {
    return {
      ...(bodyLine ? { bodyLine } : {}),
      fragment: self[1],
      kind: "self",
    };
  }

  const target = /^\/(posts|projects)\/([^/#?\s]+)(?:#([^#\s]+))?$/u.exec(value);
  if (!target) return undefined;
  const kind = target[1] === "posts" ? "post" : "project";
  const url = `/${target[1]}/${target[2]}` as
    | `/posts/${string}`
    | `/projects/${string}`;
  return {
    ...(bodyLine ? { bodyLine } : {}),
    ...(target[3] ? { fragment: target[3] } : {}),
    kind,
    slug: target[2],
    url,
  };
}

function transformOutsideInlineCode(
  markdown: string,
  sourceOffset: number,
  transform: (segment: string, sourceOffset: number) => string,
) {
  let output = "";
  let cursor = 0;

  while (cursor < markdown.length) {
    const openingIndex = markdown.indexOf("`", cursor);
    if (openingIndex < 0) {
      return output + transform(markdown.slice(cursor), sourceOffset + cursor);
    }

    let markerLength = 1;
    while (markdown[openingIndex + markerLength] === "`") markerLength += 1;
    const marker = "`".repeat(markerLength);
    const closingIndex = markdown.indexOf(marker, openingIndex + markerLength);
    if (closingIndex < 0) {
      return output + transform(markdown.slice(cursor), sourceOffset + cursor);
    }

    output += transform(markdown.slice(cursor, openingIndex), sourceOffset + cursor);
    output += markdown.slice(openingIndex, closingIndex + markerLength);
    cursor = closingIndex + markerLength;
  }

  return output;
}

export function transformMarkdownProse(
  markdown: string,
  transform: (segment: string, sourceOffset: number) => string,
) {
  let output = "";
  let prose = "";
  let proseOffset = 0;
  let sourceOffset = 0;
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const line of markdown.match(/.*(?:\r?\n|$)/gu) ?? []) {
    if (!line) continue;
    const fence = /^\s*(`{3,}|~{3,})/u.exec(line);

    if (!fenceCharacter && fence) {
      output += transformOutsideInlineCode(prose, proseOffset, transform) + line;
      prose = "";
      sourceOffset += line.length;
      proseOffset = sourceOffset;
      fenceCharacter = fence[1][0];
      fenceLength = fence[1].length;
      continue;
    }

    if (fenceCharacter) {
      output += line;
      sourceOffset += line.length;
      proseOffset = sourceOffset;
      const closingFence = /^\s*(`{3,}|~{3,})\s*$/u.exec(line.trimEnd());
      if (
        closingFence &&
        closingFence[1][0] === fenceCharacter &&
        closingFence[1].length >= fenceLength
      ) {
        fenceCharacter = "";
        fenceLength = 0;
      }
      continue;
    }

    if (!prose) proseOffset = sourceOffset;
    prose += line;
    sourceOffset += line.length;
  }

  return output + transformOutsideInlineCode(prose, proseOffset, transform);
}

export function markdownHeadingAnchor(value: string) {
  return extractMarkdownHeadingAnchors(`# ${value.replace(/\r?\n/gu, " ")}`)[0]?.id ?? "";
}

export function extractInternalContentReferenceEvidence(markdown: string) {
  const tree = parseMarkdown(markdown);
  const definitions = new Map<string, string>();
  walkMarkdown(tree, (node) => {
    if (node.type === "definition" && node.identifier && node.url) {
      definitions.set(node.identifier, node.url);
    }
  });

  const references = new Map<string, InternalContentReferenceEvidence>();
  walkMarkdown(tree, (node) => {
    const value = node.type === "link"
      ? node.url
      : node.type === "linkReference" && node.identifier
        ? definitions.get(node.identifier)
        : undefined;
    if (!value) return;
    const reference = internalReferenceFromUrl(value, node.position?.start?.line);
    if (!reference) return;
    const key = reference.kind === "self"
      ? `self#${reference.fragment}`
      : `${reference.url}#${reference.fragment ?? ""}`;
    const existing = references.get(key);
    if (existing) {
      existing.occurrences += 1;
      if (reference.bodyLine) existing.sourceLines.push(reference.bodyLine);
      return;
    }
    references.set(key, {
      ...reference,
      occurrences: 1,
      sourceLines: reference.bodyLine ? [reference.bodyLine] : [],
    });
  });
  return [...references.values()];
}

export function extractInternalContentReferences(markdown: string) {
  return extractInternalContentReferenceEvidence(markdown).map((reference) => {
    const location = reference.bodyLine ? { bodyLine: reference.bodyLine } : {};
    if (reference.kind === "self") {
      return { ...location, fragment: reference.fragment, kind: reference.kind };
    }
    return {
      ...location,
      ...(reference.fragment === undefined ? {} : { fragment: reference.fragment }),
      kind: reference.kind,
      slug: reference.slug,
      url: reference.url,
    };
  });
}

export function extractMarkdownHeadingAnchors(markdown: string) {
  const slugger = new GithubSlugger();
  const anchors: MarkdownHeadingAnchor[] = [];
  walkMarkdown(parseMarkdown(markdown), (node) => {
    if (node.type !== "heading" || !node.depth || node.depth < 1 || node.depth > 6) return;
    const text = renderedHeadingText(node);
    anchors.push({
      depth: node.depth as MarkdownHeadingAnchor["depth"],
      id: slugger.slug(text),
      ...(node.position?.start?.line ? { line: node.position.start.line } : {}),
      text,
    });
  });
  return anchors;
}

export function decodeMarkdownHeadingFragment(fragment: string) {
  return decodeURIComponent(fragment);
}

export function extractTableOfContents(markdown: string) {
  return extractMarkdownHeadingAnchors(markdown)
    .filter(
      (heading): heading is MarkdownHeadingAnchor & { depth: 2 | 3 } =>
        (heading.depth === 2 || heading.depth === 3) && Boolean(heading.text),
    )
    .map(({ depth, id, text }) => ({ depth, id, text }));
}
