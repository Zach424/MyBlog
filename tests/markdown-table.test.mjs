import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  extractMarkdownTables,
  getMarkdownTableIssue,
  MARKDOWN_TABLE_MAX_COUNT,
  MARKDOWN_TABLE_MAX_TOTAL_DATA_CELLS,
  rehypeMarkdownTables,
} from "../lib/markdown-table.ts";
import { inspectContentDraft } from "../lib/content/contract.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const table = `> [!table] API 延迟对比
> | 环境 | P50 | P95 |
> | --- | ---: | ---: |
> | 本地 | 18 ms | 44 ms |
> | 生产 | **42 ms** | [118 ms](/posts/performance) |`;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownTables)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("renders a titled portable GFM table as a no-script data ledger", () => {
  const html = render(table);

  assert.match(html, /<figure class="markdown-data-table" data-table="bounded-ledger"/u);
  assert.match(html, /DATA TABLE \/ 03 COLUMNS/u);
  assert.match(html, /02 ROWS · STATIC/u);
  assert.match(html, /KEY COLUMN · 环境/u);
  assert.match(html, /role="region" tabindex="0"/u);
  assert.match(html, /<table[^>]*aria-label="API 延迟对比"[^>]*class="markdown-data-table-grid"/u);
  assert.equal((html.match(/scope="col"/gu) ?? []).length, 3);
  assert.doesNotMatch(html, /<script|button|dialog|contenteditable/iu);
});

test("extracts title, alignment, headers, rows, and source line", () => {
  assert.deepEqual(extractMarkdownTables(table), [
    {
      align: [null, "right", "right"],
      headers: ["环境", "P50", "P95"],
      line: 1,
      rowCount: 2,
      rows: [
        ["本地", "18 ms", "44 ms"],
        ["生产", "42 ms", "118 ms"],
      ],
      title: "API 延迟对比",
    },
  ]);
});

test("rejects untitled, malformed, ambiguous, empty, media, and over-budget tables", () => {
  const invalid = [
    [
      "| 环境 | P95 |\n| --- | ---: |\n| 生产 | 118 ms |",
      /必须放入.*\[!table\]|无标题/u,
    ],
    [
      "> [!table]+ 折叠\n> | 环境 | P95 |\n> | --- | ---: |\n> | 生产 | 118 ms |",
      /静态|不能折叠/u,
    ],
    [
      "> [!table]\n> | 环境 | P95 |\n> | --- | ---: |\n> | 生产 | 118 ms |",
      /标题/u,
    ],
    [
      "> [!table] 列数错位\n> | 环境 | P50 | P95 |\n> | --- | ---: | ---: |\n> | 生产 | 118 ms |",
      /恰好包含 3 个/u,
    ],
    [
      "> [!table] 重复表头\n> | 环境 | 环境 |\n> | --- | --- |\n> | 本地 | 生产 |",
      /表头名称不能重复/u,
    ],
    [
      "> [!table] 空值\n> | 环境 | 结果 |\n> | --- | --- |\n> | 生产 | |",
      /空白单元格/u,
    ],
    [
      "> [!table] 图片越界\n> | 环境 | 结果 |\n> | --- | --- |\n> | 生产 | ![图](/uploads/demo/x.png) |",
      /图片.*表格外/u,
    ],
  ];

  for (const [source, expected] of invalid) {
    const issue = getMarkdownTableIssue(source);
    assert.equal(issue?.kind, "table");
    assert.match(issue?.message ?? "", expected);
  }

  const tableOf = (index, rows = 1) => [
    `> [!table] 表格 ${index}`,
    "> | 项目 | 结果 |",
    "> | --- | ---: |",
    ...Array.from({ length: rows }, (_, row) => `> | 数据 ${row + 1} | ${row + 1} |`),
  ].join("\n");
  const tooMany = Array.from(
    { length: MARKDOWN_TABLE_MAX_COUNT + 1 },
    (_, index) => tableOf(index + 1),
  ).join("\n\n");
  assert.match(getMarkdownTableIssue(tooMany)?.message ?? "", /最多允许.*技术表格/u);

  const tooManyCells = Array.from(
    { length: 3 },
    (_, index) => {
      const headers = ["A", "B", "C", "D", "E"];
      return [
        `> [!table] 大表 ${index + 1}`,
        `> | ${headers.join(" | ")} |`,
        `> | ${headers.map(() => "---").join(" | ")} |`,
        ...Array.from(
          { length: Math.floor(MARKDOWN_TABLE_MAX_TOTAL_DATA_CELLS / 15) + 1 },
          (_, row) => `> | ${headers.map((_, cell) => `${row}-${cell}`).join(" | ")} |`,
        ),
      ].join("\n");
    },
  ).join("\n\n");
  assert.match(getMarkdownTableIssue(tooManyCells)?.message ?? "", /合计最多/u);
});

test("keeps table titles, headers, and values searchable without marker noise", () => {
  const plainText = markdownToPlainText(table);
  assert.match(plainText, /API 延迟对比 环境 P50 P95/u);
  assert.match(plainText, /生产 42 ms 118 ms/u);
  assert.doesNotMatch(plainText, /\[!table\]|DATA TABLE|KEY COLUMN/u);
});

test("makes the same table contract authoritative for Studio entry preflight", () => {
  const fields = {
    body: table,
    description: "验证技术表格进入统一内容契约。",
    draft: true,
    featured: false,
    freshness: "historical",
    publishedAt: "2026-08-12",
    reviewedAt: "2026-08-12",
    slug: "table-contract",
    tags: ["TypeScript"],
    title: "技术表格契约",
    type: "article",
  };
  assert.equal(inspectContentDraft("post", fields, "2026-08-12").ok, true);
  const invalid = inspectContentDraft(
    "post",
    {
      ...fields,
      body: "| 环境 | P95 |\n| --- | ---: |\n| 生产 | 118 ms |",
    },
    "2026-08-12",
  );
  assert.equal(invalid.ok, false);
  assert.match(invalid.issues[0]?.message ?? "", /\[!table\]|技术表格/u);
});

test("wires one table contract into reading, Studio, mobile, and print", async () => {
  const [pipeline, component, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/MarkdownContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);

  assert.match(pipeline, /rehypeMarkdownTables/u);
  assert.match(component, /markdown-data-table-grid/u);
  assert.match(previewRuntime, /tableDataCellCount/u);
  assert.match(previewRuntime, /hasPotentialStudioTable/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-data-table\s*\{/u);
    assert.match(styles, /\.markdown-data-table-viewport/u);
    assert.match(styles, /\.markdown-data-table-grid/u);
    assert.match(styles, /td:first-child[\s\S]*?position:\s*sticky/u);
  }
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-data-table/u);
  assert.match(
    richStyles,
    /@media \(max-width: 32rem\)[\s\S]*?\.markdown-data-table-grid[\s\S]*?width:\s*36rem/u,
  );
});
