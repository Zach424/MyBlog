export const STUDIO_TABLE_EDITOR_ID = "myblog-table";
export const STUDIO_TABLE_MIN_COLUMNS = 2;
export const STUDIO_TABLE_MAX_COLUMNS = 6;
export const STUDIO_TABLE_MIN_ROWS = 1;
export const STUDIO_TABLE_MAX_ROWS = 20;

const TABLE_LINE_SOURCE = String.raw`> \|[^\r\n]*\|`;
export const STUDIO_TABLE_PATTERN = new RegExp(
  String.raw`^> \[!table\] ([^\[\]\r\n]{1,120})\r?\n((?:${TABLE_LINE_SOURCE}(?:\r?\n|$)){3,22})(?!> \|)`,
  "imu",
);
const REGISTRATION_KEY = "__MYBLOG_TABLE_EDITOR_COMPONENT__";

function plainValue(value) {
  return value && typeof value.toJS === "function" ? value.toJS() : value;
}

function normalizedData(data) {
  const value = plainValue(data) ?? {};
  const rawColumns = plainValue(value.columns);
  const rawRows = plainValue(value.rows);
  return {
    columns: Array.isArray(rawColumns)
      ? rawColumns.map((candidate) => {
          const column = plainValue(candidate) ?? {};
          return {
            align: ["left", "center", "right"].includes(column.align)
              ? column.align
              : "left",
            label: typeof column.label === "string" ? column.label.trim() : "",
          };
        })
      : [],
    rows: Array.isArray(rawRows)
      ? rawRows.map((candidate) => {
          const row = plainValue(candidate) ?? {};
          const cells = plainValue(row.cells);
          return {
            cells: Array.isArray(cells)
              ? cells.map((cell) =>
                  typeof plainValue(cell) === "string"
                    ? plainValue(cell).replace(/\s+/gu, " ").trim()
                    : ""
                )
              : [],
          };
        })
      : [],
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function validateTable(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("技术表格标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (
    normalized.columns.length < STUDIO_TABLE_MIN_COLUMNS ||
    normalized.columns.length > STUDIO_TABLE_MAX_COLUMNS
  ) {
    throw new Error(
      `技术表格必须包含 ${STUDIO_TABLE_MIN_COLUMNS}–${STUDIO_TABLE_MAX_COLUMNS} 列。`,
    );
  }
  const headerKeys = normalized.columns.map((column, index) => {
    if (!/^[^|\r\n]{1,60}$/u.test(column.label)) {
      throw new Error(`第 ${index + 1} 列表头无效：请填写 1–60 字符且不含竖线的名称。`);
    }
    return column.label.normalize("NFKC").toLocaleLowerCase("zh-CN");
  });
  if (new Set(headerKeys).size !== headerKeys.length) {
    throw new Error("同一技术表格的表头名称不能重复。");
  }
  if (
    normalized.rows.length < STUDIO_TABLE_MIN_ROWS ||
    normalized.rows.length > STUDIO_TABLE_MAX_ROWS
  ) {
    throw new Error(
      `技术表格必须包含 ${STUDIO_TABLE_MIN_ROWS}–${STUDIO_TABLE_MAX_ROWS} 条数据行。`,
    );
  }
  normalized.rows.forEach((row, rowIndex) => {
    if (row.cells.length !== normalized.columns.length) {
      throw new Error(
        `第 ${rowIndex + 1} 条数据必须填写 ${normalized.columns.length} 个单元格。`,
      );
    }
    row.cells.forEach((cell, cellIndex) => {
      if (!cell) {
        throw new Error(
          `第 ${rowIndex + 1} 条数据的第 ${cellIndex + 1} 个单元格不能为空；未知值请明确写“—”。`,
        );
      }
      if (cell.length > 240) {
        throw new Error(
          `第 ${rowIndex + 1} 条数据的第 ${cellIndex + 1} 个单元格不能超过 240 字符。`,
        );
      }
    });
  });
  return normalized;
}

function escapeCell(value) {
  return value.replace(/\\*\|/gu, "\\|");
}

function delimiterFor(align) {
  if (align === "center") return ":---:";
  if (align === "right") return "---:";
  return "---";
}

function serializeTable(data) {
  const normalized = validateTable(data);
  const row = (cells) => `> | ${cells.map(escapeCell).join(" | ")} |`;
  return [
    `> [!table] ${normalized.title}`,
    row(normalized.columns.map((column) => column.label)),
    row(normalized.columns.map((column) => delimiterFor(column.align))),
    ...normalized.rows.map((item) => row(item.cells)),
  ].join("\n");
}

function splitTableRow(line) {
  const source = line.replace(/^> /u, "").trim();
  if (!source.startsWith("|") || !source.endsWith("|")) {
    throw new Error("Studio 技术表格行缺少首尾竖线。");
  }
  const body = source.slice(1, -1);
  const cells = [];
  let cell = "";
  let codeFenceLength = 0;

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "\\" && index + 1 < body.length) {
      const next = body[index + 1];
      cell += next === "|" ? "|" : `${character}${next}`;
      index += 1;
      continue;
    }
    if (character === "`") {
      let runLength = 1;
      while (body[index + runLength] === "`") runLength += 1;
      if (codeFenceLength === 0) codeFenceLength = runLength;
      else if (codeFenceLength === runLength) codeFenceLength = 0;
      cell += "`".repeat(runLength);
      index += runLength - 1;
      continue;
    }
    if (character === "|" && codeFenceLength === 0) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

function parseAlignment(value) {
  if (!/^:?-{3,}:?$/u.test(value)) {
    throw new Error("Studio 技术表格的对齐分隔行无效。");
  }
  if (value.startsWith(":")) return value.endsWith(":") ? "center" : "left";
  return value.endsWith(":") ? "right" : "left";
}

function parseTableMatch(match) {
  if (!match) throw new Error("无法解析 Studio 技术表格块。");
  const lines = match[2].trimEnd().split(/\r?\n/u);
  if (lines.length < 3) throw new Error("Studio 技术表格至少需要一条数据行。");
  const headers = splitTableRow(lines[0]);
  const align = splitTableRow(lines[1]);
  if (headers.length !== align.length) {
    throw new Error("Studio 技术表格的表头与对齐行列数不一致。");
  }
  const rows = lines.slice(2).map((line) => ({ cells: splitTableRow(line) }));
  return validateTable({
    columns: headers.map((label, index) => ({
      align: parseAlignment(align[index]),
      label,
    })),
    rows,
    title: match[1],
  });
}

export function createStudioTableEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") {
    throw new Error("Studio 技术表格组件缺少 React 运行时。");
  }

  return {
    collapsed: false,
    id: STUDIO_TABLE_EDITOR_ID,
    label: "技术数据表格",
    fields: [
      {
        hint: "说明这组数据回答什么问题；公开页面会把它显示为表格标题。",
        label: "表格标题",
        name: "title",
        pattern: ["^[^\\[\\]\\r\\n]{1,120}$", "填写 1–120 字符的单行纯文本标题"],
        widget: "string",
      },
      {
        allow_add: true,
        allow_remove: true,
        allow_reorder: true,
        collapsed: false,
        default: [
          { align: "left", label: "环境" },
          { align: "right", label: "P50" },
          { align: "right", label: "P95" },
        ],
        fields: [
          {
            label: "表头名称",
            name: "label",
            pattern: ["^[^|\\r\\n]{1,60}$", "填写 1–60 字符且不含竖线的名称"],
            widget: "string",
          },
          {
            default: "left",
            label: "对齐方式",
            name: "align",
            options: [
              { label: "左对齐", value: "left" },
              { label: "居中", value: "center" },
              { label: "右对齐（数字推荐）", value: "right" },
            ],
            widget: "select",
          },
        ],
        label: "列定义",
        label_singular: "数据列",
        max: STUDIO_TABLE_MAX_COLUMNS,
        min: STUDIO_TABLE_MIN_COLUMNS,
        name: "columns",
        summary: "{{fields.label}} · {{fields.align}}",
        widget: "list",
      },
      {
        allow_add: true,
        allow_remove: true,
        allow_reorder: true,
        collapsed: false,
        default: [
          { cells: ["本地", "18 ms", "44 ms"] },
          { cells: ["生产", "42 ms", "118 ms"] },
        ],
        fields: [
          {
            allow_add: true,
            allow_remove: true,
            allow_reorder: true,
            field: {
              label: "单元格值",
              name: "value",
              widget: "string",
            },
            hint: "值的数量必须与列定义一致；未知值请明确写“—”。",
            label: "单元格",
            max: STUDIO_TABLE_MAX_COLUMNS,
            min: STUDIO_TABLE_MIN_COLUMNS,
            name: "cells",
            widget: "list",
          },
        ],
        label: "数据行",
        label_singular: "数据行",
        max: STUDIO_TABLE_MAX_ROWS,
        min: STUDIO_TABLE_MIN_ROWS,
        name: "rows",
        summary: "{{fields.cells}}",
        widget: "list",
      },
    ],
    pattern: STUDIO_TABLE_PATTERN,
    fromBlock: parseTableMatch,
    toBlock: serializeTable,
    toPreview(data) {
      const normalized = validateTable(data);
      return h(
        "figure",
        { className: "markdown-data-table", "data-table": "bounded-ledger" },
        h(
          "figcaption",
          { className: "markdown-data-table-header" },
          h(
            "span",
            { className: "markdown-data-table-rail" },
            h(
              "span",
              { className: "markdown-data-table-kind" },
              `DATA TABLE / ${String(normalized.columns.length).padStart(2, "0")} COLUMNS`,
            ),
            h(
              "span",
              { className: "markdown-data-table-origin" },
              `${String(normalized.rows.length).padStart(2, "0")} ROWS · STATIC`,
            ),
          ),
          h("strong", { className: "markdown-data-table-title" }, normalized.title),
          h(
            "span",
            { className: "markdown-data-table-key" },
            `KEY COLUMN · ${normalized.columns[0].label}`,
          ),
        ),
        h(
          "div",
          {
            "aria-label": `${normalized.title}，可横向滚动的技术表格`,
            className: "markdown-data-table-viewport",
            role: "region",
            tabIndex: 0,
          },
          h(
            "table",
            { "aria-label": normalized.title, className: "markdown-data-table-grid" },
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                ...normalized.columns.map((column) =>
                  h(
                    "th",
                    { key: column.label, scope: "col", style: { textAlign: column.align } },
                    column.label,
                  )
                ),
              ),
            ),
            h(
              "tbody",
              {},
              ...normalized.rows.map((row, rowIndex) =>
                h(
                  "tr",
                  { key: `row-${rowIndex + 1}` },
                  ...row.cells.map((cell, cellIndex) =>
                    h(
                      "td",
                      {
                        key: `cell-${cellIndex + 1}`,
                        style: { textAlign: normalized.columns[cellIndex].align },
                      },
                      cell,
                    )
                  ),
                )
              ),
            ),
          ),
        ),
      );
    },
  };
}

export function registerStudioTableEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 技术表格组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];

  const definition = createStudioTableEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.tableEditor = "registered";
  return definition;
}
