import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_FILETREE_MAX_COUNT = 3;
export const MARKDOWN_FILETREE_MIN_NODES = 2;
export const MARKDOWN_FILETREE_MAX_NODES = 32;
export const MARKDOWN_FILETREE_MAX_TOTAL_NODES = 64;
export const MARKDOWN_FILETREE_MAX_DEPTH = 4;
export const MARKDOWN_FILETREE_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_FILETREE_MAX_NAME_LENGTH = 79;
export const MARKDOWN_FILETREE_MAX_DESCRIPTION_LENGTH = 240;

export interface MarkdownFileTreeNode {
  depth: number;
  description: string;
  kind: "folder" | "file";
  line?: number;
  name: string;
  path: string;
}

export interface MarkdownFileTreeSource {
  line?: number;
  maxDepth: number;
  nodes: MarkdownFileTreeNode[];
  title: string;
}

export interface MarkdownFileTreeIssue {
  kind: "filetree";
  line?: number;
  message: string;
}

class MarkdownFileTreeError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const FILETREE_MARKER = /^\[!filetree\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_FILETREE_MARKER = /^\[!filetree\](?:[+\-]|[ \t]|$)/iu;
const PATH_SEGMENT = /^[^\s/\\`\u0000-\u001f\u007f]{1,79}$/u;

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

function fileTreeMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const children = visibleMarkdownChildren(first);
  const marker = children[0]?.type === "text" ? children[0] : undefined;
  return marker && POTENTIAL_FILETREE_MARKER.test(marker.value ?? "")
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
  throw new MarkdownFileTreeError(
    "文件树说明只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注与硬换行请移到文件树外。",
    line,
  );
}

function fileTreeLineFromParagraph(paragraph: MarkdownNode, line?: number) {
  const children = visibleMarkdownChildren(paragraph);
  const pathNode = children[0]?.type === "inlineCode" ? children[0] : undefined;
  const delimiterNode = children[1]?.type === "text" ? children[1] : undefined;
  if (
    paragraph.type !== "paragraph" ||
    !pathNode ||
    !delimiterNode ||
    !(delimiterNode.value ?? "").startsWith(" — ")
  ) {
    throw new MarkdownFileTreeError(
      "每个文件树节点必须写成 `路径段` — 简短说明。",
      line,
    );
  }
  const displayName = (pathNode.value ?? "").trim();
  const kind = displayName.endsWith("/") ? "folder" : "file";
  const name = kind === "folder" ? displayName.slice(0, -1) : displayName;
  if (
    !PATH_SEGMENT.test(name) ||
    name === "." ||
    name === ".." ||
    displayName.length > MARKDOWN_FILETREE_MAX_NAME_LENGTH + 1
  ) {
    throw new MarkdownFileTreeError(
      `文件树路径必须是单个安全路径段，名称为 1–${MARKDOWN_FILETREE_MAX_NAME_LENGTH} 字符；文件夹仅在末尾添加 /。`,
      line,
    );
  }
  const descriptionChildren = children.slice(1).map((child, index) =>
    index === 0
      ? { ...child, value: (child.value ?? "").slice(3) }
      : child,
  );
  for (const child of descriptionChildren) validateDescriptionInline(child, line);
  const description = descriptionChildren
    .map(inlineText)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  if (
    !description ||
    description.length > MARKDOWN_FILETREE_MAX_DESCRIPTION_LENGTH
  ) {
    throw new MarkdownFileTreeError(
      `文件树节点说明必须为 1–${MARKDOWN_FILETREE_MAX_DESCRIPTION_LENGTH} 个字符。`,
      line,
    );
  }
  return { description, kind, name } as const;
}

function normalizedPath(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

function nodesFromMarkdownList(
  list: MarkdownNode,
  depth: number,
  ancestors: string[],
  nodes: MarkdownFileTreeNode[],
  paths: Set<string>,
) {
  const line = list.position?.start?.line;
  if (depth > MARKDOWN_FILETREE_MAX_DEPTH) {
    throw new MarkdownFileTreeError(
      `文件树最多允许 ${MARKDOWN_FILETREE_MAX_DEPTH} 层。`,
      line,
    );
  }
  if (list.type !== "list" || list.ordered !== false) {
    throw new MarkdownFileTreeError("文件树只能使用无序列表。", line);
  }
  for (const item of visibleMarkdownChildren(list)) {
    const itemLine = item.position?.start?.line ?? line;
    const children = visibleMarkdownChildren(item);
    const paragraph = children[0];
    const childList = children[1];
    if (
      item.type !== "listItem" ||
      typeof item.checked === "boolean" ||
      !paragraph ||
      paragraph.type !== "paragraph" ||
      children.length > 2 ||
      (childList && (childList.type !== "list" || childList.ordered !== false))
    ) {
      throw new MarkdownFileTreeError(
        "文件树节点只能包含一行路径说明和一个可选的嵌套无序列表，不能使用任务状态或额外段落。",
        itemLine,
      );
    }
    const parsed = fileTreeLineFromParagraph(paragraph, itemLine);
    if (childList && parsed.kind !== "folder") {
      throw new MarkdownFileTreeError(
        `文件 ${parsed.name} 不能拥有子节点；有子节点的路径必须以 / 结尾。`,
        itemLine,
      );
    }
    const pathSegments = [...ancestors, parsed.name];
    const path = `${pathSegments.join("/")}${parsed.kind === "folder" ? "/" : ""}`;
    const key = normalizedPath(path.replace(/\/$/u, ""));
    if (paths.has(key)) {
      throw new MarkdownFileTreeError(`文件树中的完整路径 ${path} 不能重复。`, itemLine);
    }
    paths.add(key);
    nodes.push({
      depth,
      description: parsed.description,
      kind: parsed.kind,
      ...(itemLine ? { line: itemLine } : {}),
      name: parsed.name,
      path,
    });
    if (childList) {
      nodesFromMarkdownList(
        childList,
        depth + 1,
        pathSegments,
        nodes,
        paths,
      );
    }
  }
}

function fileTreeFromMarkdownNode(
  blockquote: MarkdownNode,
): MarkdownFileTreeSource | undefined {
  const markerNode = fileTreeMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  const marker = FILETREE_MARKER.exec(markerNode.value ?? "");
  if (!marker) {
    throw new MarkdownFileTreeError(
      "文件树标记必须写成静态的 > [!filetree] 标题，不能使用折叠 Callout 标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_FILETREE_MAX_TITLE_LENGTH) {
    throw new MarkdownFileTreeError(
      `文件树必须填写 1–${MARKDOWN_FILETREE_MAX_TITLE_LENGTH} 个字符的可见标题。`,
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
    throw new MarkdownFileTreeError(
      "文件树标题后必须紧跟无序列表，区块内不能混入其他段落。",
      line,
    );
  }
  const nodes: MarkdownFileTreeNode[] = [];
  nodesFromMarkdownList(list, 1, [], nodes, new Set());
  if (
    nodes.length < MARKDOWN_FILETREE_MIN_NODES ||
    nodes.length > MARKDOWN_FILETREE_MAX_NODES
  ) {
    throw new MarkdownFileTreeError(
      `每个文件树必须包含 ${MARKDOWN_FILETREE_MIN_NODES}–${MARKDOWN_FILETREE_MAX_NODES} 个节点。`,
      list.position?.start?.line ?? line,
    );
  }
  return {
    ...(line ? { line } : {}),
    maxDepth: Math.max(...nodes.map((node) => node.depth)),
    nodes,
    title,
  };
}

function parseMarkdownFileTrees(markdown: string) {
  const trees: MarkdownFileTreeSource[] = [];
  const tree = parseMarkdown(markdown);

  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && fileTreeMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownFileTreeError(
          "文件树必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const fileTree = fileTreeFromMarkdownNode(node);
      if (fileTree) trees.push(fileTree);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }

  walk(tree);
  if (trees.length > MARKDOWN_FILETREE_MAX_COUNT) {
    throw new MarkdownFileTreeError(
      `每篇内容最多允许 ${MARKDOWN_FILETREE_MAX_COUNT} 个文件树。`,
    );
  }
  const totalNodes = trees.reduce(
    (total, fileTree) => total + fileTree.nodes.length,
    0,
  );
  if (totalNodes > MARKDOWN_FILETREE_MAX_TOTAL_NODES) {
    throw new MarkdownFileTreeError(
      `每篇内容的文件树合计最多允许 ${MARKDOWN_FILETREE_MAX_TOTAL_NODES} 个节点。`,
    );
  }
  return trees;
}

export function extractMarkdownFileTrees(markdown: string) {
  return parseMarkdownFileTrees(markdown);
}

export function getMarkdownFileTreeIssue(
  markdown: string,
): MarkdownFileTreeIssue | undefined {
  try {
    parseMarkdownFileTrees(markdown);
    return undefined;
  } catch (error) {
    return {
      kind: "filetree",
      ...(error instanceof MarkdownFileTreeError && error.line
        ? { line: error.line }
        : {}),
      message: compactError(error) || "文件树无法解析。",
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

function renderedFileTreeListFromHast(
  list: Element,
  depth: number,
): { list: Element; maxDepth: number; nodeCount: number } {
  if (depth > MARKDOWN_FILETREE_MAX_DEPTH) {
    throw new MarkdownFileTreeError("文件树层级超出发布预算。");
  }
  const renderedItems: Element[] = [];
  let maxDepth = depth;
  let nodeCount = 0;
  for (const child of visibleHastChildren(list)) {
    if (!isElement(child) || child.tagName !== "li") {
      throw new MarkdownFileTreeError("文件树列表包含无效节点。");
    }
    const itemChildren = visibleHastChildren(child);
    const nestedListCandidate = itemChildren.at(-1);
    const nestedList =
      nestedListCandidate &&
      isElement(nestedListCandidate) &&
      nestedListCandidate.tagName === "ul"
        ? nestedListCandidate
        : undefined;
    const content = nestedList ? itemChildren.slice(0, -1) : itemChildren;
    const inlineContent =
      content.length === 1 && isElement(content[0]) && content[0].tagName === "p"
        ? visibleHastChildren(content[0])
        : content;
    const pathNode =
      inlineContent[0] &&
      isElement(inlineContent[0]) &&
      inlineContent[0].tagName === "code"
        ? inlineContent[0]
        : undefined;
    const delimiter = inlineContent[1];
    if (
      !pathNode ||
      !delimiter ||
      !isText(delimiter) ||
      !delimiter.value.startsWith(" — ")
    ) {
      throw new MarkdownFileTreeError("文件树节点缺少路径或说明。");
    }
    const displayName = pathNode.children
      .filter(isText)
      .map((node) => node.value)
      .join("");
    const kind = displayName.endsWith("/") ? "folder" : "file";
    if (nestedList && kind !== "folder") {
      throw new MarkdownFileTreeError("文件节点不能拥有子节点。");
    }
    const descriptionChildren: ElementContent[] = [
      { ...delimiter, value: delimiter.value.slice(3) },
      ...inlineContent.slice(2),
    ];
    const renderedChildren: ElementContent[] = [
      element("div", { className: ["markdown-filetree-row"] }, [
        element(
          "span",
          { ariaHidden: "true", className: ["markdown-filetree-branch"] },
          [text(depth === 1 ? "ROOT" : "BR")],
        ),
        element(
          "span",
          { className: ["markdown-filetree-kind"] },
          [text(kind === "folder" ? "DIR" : "FILE")],
        ),
        element(
          "code",
          { className: ["markdown-filetree-name"] },
          pathNode.children,
        ),
        element(
          "span",
          { className: ["markdown-filetree-description"] },
          descriptionChildren,
        ),
      ]),
    ];
    if (nestedList) {
      const renderedNested = renderedFileTreeListFromHast(nestedList, depth + 1);
      renderedChildren.push(renderedNested.list);
      nodeCount += renderedNested.nodeCount;
      maxDepth = Math.max(maxDepth, renderedNested.maxDepth);
    }
    renderedItems.push(
      element(
        "li",
        {
          className: ["markdown-filetree-node"],
          dataDepth: depth,
          dataKind: kind,
        },
        renderedChildren,
      ),
    );
    nodeCount += 1;
  }
  return {
    list: element(
      "ul",
      { className: [depth === 1 ? "markdown-filetree-items" : "markdown-filetree-children"] },
      renderedItems,
    ),
    maxDepth,
    nodeCount,
  };
}

function fileTreeFromHastBlockquote(blockquote: Element, index: number) {
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
  if (!markerChild || !POTENTIAL_FILETREE_MARKER.test(markerChild.value)) {
    return undefined;
  }
  const marker = FILETREE_MARKER.exec(markerChild.value);
  if (!marker?.[1]?.trim()) {
    throw new MarkdownFileTreeError("文件树标记必须写成静态的 > [!filetree] 标题。");
  }
  const list =
    children.length === 2 &&
    isElement(children[1]) &&
    children[1].tagName === "ul"
      ? children[1]
      : undefined;
  if (!list) throw new MarkdownFileTreeError("文件树标题后必须紧跟无序列表。");
  const rendered = renderedFileTreeListFromHast(list, 1);
  if (
    rendered.nodeCount < MARKDOWN_FILETREE_MIN_NODES ||
    rendered.nodeCount > MARKDOWN_FILETREE_MAX_NODES
  ) {
    throw new MarkdownFileTreeError("文件树节点数量超出发布预算。");
  }
  const titleId = `markdown-filetree-${index}-title`;
  return element(
    "section",
    {
      ariaLabelledBy: [titleId],
      className: ["markdown-filetree"],
      dataFiletree: "repository-slice",
      dataMaxDepth: rendered.maxDepth,
      dataNodeCount: rendered.nodeCount,
    },
    [
      element("header", { className: ["markdown-filetree-header"] }, [
        element("span", { className: ["markdown-filetree-rail"] }, [
          element("span", { className: ["markdown-filetree-kind-label"] }, [
            text(`FILE MAP / ${String(rendered.nodeCount).padStart(2, "0")} NODES`),
          ]),
          element("span", { className: ["markdown-filetree-mode"] }, [
            text(`DEPTH · ${String(rendered.maxDepth).padStart(2, "0")} MAX`),
          ]),
        ]),
        element(
          "strong",
          { className: ["markdown-filetree-title"], id: titleId },
          [text(marker[1].trim())],
        ),
      ]),
      rendered.list,
    ],
  );
}

export function rehypeMarkdownFileTrees() {
  return function transform(tree: Root) {
    let fileTreeCount = 0;
    let totalNodes = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const fileTree = fileTreeFromHastBlockquote(child, fileTreeCount + 1);
      if (!fileTree) continue;
      fileTreeCount += 1;
      totalNodes += Number(fileTree.properties.dataNodeCount);
      if (fileTreeCount > MARKDOWN_FILETREE_MAX_COUNT) {
        throw new MarkdownFileTreeError(
          `每篇内容最多允许 ${MARKDOWN_FILETREE_MAX_COUNT} 个文件树。`,
        );
      }
      if (totalNodes > MARKDOWN_FILETREE_MAX_TOTAL_NODES) {
        throw new MarkdownFileTreeError(
          `每篇内容的文件树合计最多允许 ${MARKDOWN_FILETREE_MAX_TOTAL_NODES} 个节点。`,
        );
      }
      tree.children[index] = fileTree as RootContent;
    }
  };
}

export function normalizeMarkdownFileTreesForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && fileTreeMarkerNode(node)) {
      const marker = fileTreeMarkerNode(node);
      const parsed = marker ? FILETREE_MARKER.exec(marker.value ?? "") : undefined;
      if (marker && parsed?.[1]) marker.value = parsed[1].trim();
      const list = visibleMarkdownChildren(node)[1];
      function normalizeList(current: MarkdownNode | undefined) {
        if (current?.type !== "list") return;
        for (const item of visibleMarkdownChildren(current)) {
          const children = visibleMarkdownChildren(item);
          const paragraph = children[0];
          if (paragraph?.type === "paragraph") {
            const inline = visibleMarkdownChildren(paragraph);
            if (inline[0]?.type === "inlineCode") {
              inline[0].value = (inline[0].value ?? "").replace(/\/$/u, "");
            }
            if (inline[1]?.type === "text") {
              inline[1].value = (inline[1].value ?? "").replace(/^ — /u, " ");
            }
          }
          normalizeList(children[1]);
        }
      }
      normalizeList(list);
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
