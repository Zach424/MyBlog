import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import {
  parseMarkdown,
  type MarkdownNode,
} from "./content/markdown.ts";

export const MARKDOWN_TABLE_MAX_COUNT = 4;
export const MARKDOWN_TABLE_MIN_COLUMNS = 2;
export const MARKDOWN_TABLE_MAX_COLUMNS = 6;
export const MARKDOWN_TABLE_MIN_ROWS = 1;
export const MARKDOWN_TABLE_MAX_ROWS = 20;
export const MARKDOWN_TABLE_MAX_DATA_CELLS = 120;
export const MARKDOWN_TABLE_MAX_TOTAL_DATA_CELLS = 240;
export const MARKDOWN_TABLE_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_TABLE_MAX_HEADER_LENGTH = 60;
export const MARKDOWN_TABLE_MAX_CELL_LENGTH = 240;

export type MarkdownTableAlignment = "left" | "center" | "right" | null;

export interface MarkdownTableSource {
  align: MarkdownTableAlignment[];
  headers: string[];
  line?: number;
  rowCount: number;
  rows: string[][];
  title: string;
}

export interface MarkdownTableIssue {
  kind: "table";
  line?: number;
  message: string;
}

class MarkdownTableError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const TABLE_MARKER = /^\[!table\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_TABLE_MARKER = /^\[!table\](?:[+\-]|[ \t]|$)/iu;

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

function tableMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const children = visibleMarkdownChildren(first);
  const marker = children.length === 1 && children[0]?.type === "text"
    ? children[0]
    : undefined;
  return marker && POTENTIAL_TABLE_MARKER.test(marker.value ?? "")
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

function validateInlineNode(
  node: MarkdownNode,
  line: number | undefined,
  { header = false }: { header?: boolean } = {},
) {
  if (node.type === "text" || node.type === "inlineCode") return;
  if (!header && node.type === "inlineMath") return;
  if (
    node.type === "emphasis" ||
    node.type === "strong" ||
    node.type === "delete" ||
    (!header && (node.type === "link" || node.type === "linkReference"))
  ) {
    for (const child of node.children ?? []) {
      validateInlineNode(child, line, { header });
    }
    return;
  }
  throw new MarkdownTableError(
    header
      ? "表头只接受纯文本、行内代码和简单强调，不接受链接、图片、公式、HTML 或脚注。"
      : "表格单元格只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注与换行请移到表格外。",
    line,
  );
}

function validateMarkdownCell(
  cell: MarkdownNode,
  { header = false }: { header?: boolean } = {},
) {
  const line = cell.position?.start?.line;
  for (const child of cell.children ?? []) {
    validateInlineNode(child, line, { header });
  }
  const value = inlineText(cell).replace(/\s+/gu, " ").trim();
  if (!value) {
    throw new MarkdownTableError(
      header ? "表头名称不能为空。" : "技术表格不接受空白单元格，请填写值或明确写“—”。",
      line,
    );
  }
  const maximum = header
    ? MARKDOWN_TABLE_MAX_HEADER_LENGTH
    : MARKDOWN_TABLE_MAX_CELL_LENGTH;
  if (value.length > maximum) {
    throw new MarkdownTableError(
      `${header ? "表头" : "表格单元格"}可见文本不能超过 ${maximum} 个字符。`,
      line,
    );
  }
  return value;
}

function tableFromMarkdownNode(blockquote: MarkdownNode): MarkdownTableSource | undefined {
  const markerNode = tableMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  const marker = TABLE_MARKER.exec(markerNode.value ?? "");
  if (!marker) {
    throw new MarkdownTableError(
      "技术表格标记必须写成静态的 > [!table] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title) {
    throw new MarkdownTableError("技术表格必须填写可见标题。", line);
  }
  if (title.length > MARKDOWN_TABLE_MAX_TITLE_LENGTH) {
    throw new MarkdownTableError(
      `技术表格标题不能超过 ${MARKDOWN_TABLE_MAX_TITLE_LENGTH} 个字符。`,
      line,
    );
  }

  const children = visibleMarkdownChildren(blockquote);
  if (children.length !== 2 || children[1]?.type !== "table") {
    throw new MarkdownTableError(
      "技术表格标题后必须紧跟一个 GFM 表格，区块内不能混入其他段落。",
      line,
    );
  }
  const table = children[1];
  const tableRows = visibleMarkdownChildren(table);
  const headerRow = tableRows[0];
  const dataRows = tableRows.slice(1);
  if (headerRow?.type !== "tableRow") {
    throw new MarkdownTableError("技术表格必须包含一行表头。", line);
  }
  const columns = visibleMarkdownChildren(headerRow);
  if (
    columns.length < MARKDOWN_TABLE_MIN_COLUMNS ||
    columns.length > MARKDOWN_TABLE_MAX_COLUMNS
  ) {
    throw new MarkdownTableError(
      `技术表格必须包含 ${MARKDOWN_TABLE_MIN_COLUMNS}–${MARKDOWN_TABLE_MAX_COLUMNS} 列。`,
      headerRow.position?.start?.line ?? line,
    );
  }
  if (
    dataRows.length < MARKDOWN_TABLE_MIN_ROWS ||
    dataRows.length > MARKDOWN_TABLE_MAX_ROWS
  ) {
    throw new MarkdownTableError(
      `每个技术表格必须包含 ${MARKDOWN_TABLE_MIN_ROWS}–${MARKDOWN_TABLE_MAX_ROWS} 条数据行。`,
      table.position?.start?.line ?? line,
    );
  }

  const headers = columns.map((cell) => validateMarkdownCell(cell, { header: true }));
  const normalizedHeaders = headers.map((header) =>
    header.normalize("NFKC").trim().toLocaleLowerCase("zh-CN")
  );
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new MarkdownTableError("同一技术表格的表头名称不能重复。", line);
  }

  const rows = dataRows.map((row) => {
    const cells = visibleMarkdownChildren(row);
    if (row.type !== "tableRow" || cells.length !== columns.length) {
      throw new MarkdownTableError(
        `每条数据行必须恰好包含 ${columns.length} 个单元格，不能依赖 GFM 自动补空或忽略超额列。`,
        row.position?.start?.line ?? line,
      );
    }
    return cells.map((cell) => validateMarkdownCell(cell));
  });
  const dataCellCount = rows.length * columns.length;
  if (dataCellCount > MARKDOWN_TABLE_MAX_DATA_CELLS) {
    throw new MarkdownTableError(
      `每个技术表格最多允许 ${MARKDOWN_TABLE_MAX_DATA_CELLS} 个数据单元格。`,
      line,
    );
  }
  const rawAlign = Array.isArray(table.align) ? table.align : [];
  const align = columns.map((_, index) => {
    const value = rawAlign[index];
    return value === "left" || value === "center" || value === "right"
      ? value
      : null;
  });

  return {
    align,
    headers,
    ...(line ? { line } : {}),
    rowCount: rows.length,
    rows,
    title,
  };
}

function parseMarkdownTables(markdown: string) {
  const tables: MarkdownTableSource[] = [];
  const tree = parseMarkdown(markdown);

  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && tableMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownTableError(
          "技术表格必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const table = tableFromMarkdownNode(node);
      if (table) tables.push(table);
      return;
    }
    if (node.type === "table") {
      throw new MarkdownTableError(
        "GFM 表格必须放入带标题的 > [!table] 技术表格区块，避免无标题数据进入公开页面。",
        node.position?.start?.line,
      );
    }
    for (const child of node.children ?? []) walk(child, node);
  }

  walk(tree);
  if (tables.length > MARKDOWN_TABLE_MAX_COUNT) {
    throw new MarkdownTableError(
      `每篇内容最多允许 ${MARKDOWN_TABLE_MAX_COUNT} 个技术表格。`,
    );
  }
  const totalDataCells = tables.reduce(
    (total, table) => total + table.headers.length * table.rowCount,
    0,
  );
  if (totalDataCells > MARKDOWN_TABLE_MAX_TOTAL_DATA_CELLS) {
    throw new MarkdownTableError(
      `每篇内容的技术表格合计最多允许 ${MARKDOWN_TABLE_MAX_TOTAL_DATA_CELLS} 个数据单元格。`,
    );
  }
  return tables;
}

export function extractMarkdownTables(markdown: string) {
  return parseMarkdownTables(markdown);
}

export function getMarkdownTableIssue(
  markdown: string,
): MarkdownTableIssue | undefined {
  try {
    parseMarkdownTables(markdown);
    return undefined;
  } catch (error) {
    return {
      kind: "table",
      ...(error instanceof MarkdownTableError && error.line
        ? { line: error.line }
        : {}),
      message: compactError(error) || "技术表格声明无法解析。",
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

function tableFromHastBlockquote(blockquote: Element) {
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
  if (!markerChild || !POTENTIAL_TABLE_MARKER.test(markerChild.value)) {
    return undefined;
  }
  const marker = TABLE_MARKER.exec(markerChild.value);
  if (!marker || !marker[1]?.trim()) {
    throw new MarkdownTableError(
      "技术表格标记必须写成静态的 > [!table] 标题。",
    );
  }
  const title = marker[1].trim();
  const table =
    children.length === 2 && isElement(children[1]) && children[1].tagName === "table"
      ? children[1]
      : undefined;
  if (!table) {
    throw new MarkdownTableError(
      "技术表格标题后必须紧跟一个 GFM 表格，区块内不能混入其他段落。",
    );
  }
  const sections = visibleHastChildren(table).filter(isElement);
  const head = sections.find((section) => section.tagName === "thead");
  const body = sections.find((section) => section.tagName === "tbody");
  const headerRow = head
    ? visibleHastChildren(head).find(
        (child): child is Element => isElement(child) && child.tagName === "tr",
      )
    : undefined;
  const headerCells = headerRow
    ? visibleHastChildren(headerRow).filter(isElement)
    : [];
  const rows = body
    ? visibleHastChildren(body).filter(
        (child): child is Element => isElement(child) && child.tagName === "tr",
      )
    : [];
  if (
    headerCells.length < MARKDOWN_TABLE_MIN_COLUMNS ||
    headerCells.length > MARKDOWN_TABLE_MAX_COLUMNS ||
    rows.length < MARKDOWN_TABLE_MIN_ROWS ||
    rows.length > MARKDOWN_TABLE_MAX_ROWS ||
    rows.some(
      (row) => visibleHastChildren(row).filter(isElement).length !== headerCells.length,
    )
  ) {
    throw new MarkdownTableError("技术表格的列数或数据行数超出发布预算。");
  }
  for (const header of headerCells) header.properties.scope = "col";
  table.properties = {
    ...table.properties,
    ariaLabel: title,
    className: ["markdown-data-table-grid"],
  };
  const rowCount = rows.length;
  const columnCount = headerCells.length;
  const firstHeader = hastText(headerCells[0]).trim();

  return element(
    "figure",
    {
      className: ["markdown-data-table"],
      dataTable: "bounded-ledger",
      dataTableColumns: columnCount,
      dataTableRows: rowCount,
    },
    [
      element("figcaption", { className: ["markdown-data-table-header"] }, [
        element("span", { className: ["markdown-data-table-rail"] }, [
          element("span", { className: ["markdown-data-table-kind"] }, [
            text(`DATA TABLE / ${String(columnCount).padStart(2, "0")} COLUMNS`),
          ]),
          element("span", { className: ["markdown-data-table-origin"] }, [
            text(`${String(rowCount).padStart(2, "0")} ROWS · STATIC`),
          ]),
        ]),
        element("strong", { className: ["markdown-data-table-title"] }, [
          text(title),
        ]),
        element("span", { className: ["markdown-data-table-key"] }, [
          text(`KEY COLUMN · ${firstHeader}`),
        ]),
      ]),
      element(
        "div",
        {
          ariaLabel: `${title}，可横向滚动的技术表格`,
          className: ["markdown-data-table-viewport"],
          role: "region",
          tabIndex: 0,
        },
        [table],
      ),
    ],
  );
}

export function rehypeMarkdownTables() {
  return function transform(tree: Root) {
    let tableCount = 0;
    let totalDataCells = 0;

    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const table = tableFromHastBlockquote(child);
      if (!table) continue;
      tableCount += 1;
      totalDataCells +=
        Number(table.properties.dataTableColumns) *
        Number(table.properties.dataTableRows);
      if (tableCount > MARKDOWN_TABLE_MAX_COUNT) {
        throw new MarkdownTableError(
          `每篇内容最多允许 ${MARKDOWN_TABLE_MAX_COUNT} 个技术表格。`,
        );
      }
      if (totalDataCells > MARKDOWN_TABLE_MAX_TOTAL_DATA_CELLS) {
        throw new MarkdownTableError(
          `每篇内容的技术表格合计最多允许 ${MARKDOWN_TABLE_MAX_TOTAL_DATA_CELLS} 个数据单元格。`,
        );
      }
      tree.children[index] = table as RootContent;
    }
  };
}

export function normalizeMarkdownTablesForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && tableMarkerNode(node)) {
      const marker = tableMarkerNode(node);
      const parsed = marker ? TABLE_MARKER.exec(marker.value ?? "") : undefined;
      if (marker && parsed?.[1]) marker.value = parsed[1].trim();
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }

  walk(tree);
  return tree;
}
