import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStudioTableEditorDefinition,
  registerStudioTableEditor,
  STUDIO_TABLE_EDITOR_ID,
} from "../studio/table-editor.mjs";

function h(type, props, ...children) {
  return { props: { ...props, children }, type };
}

const data = {
  columns: [
    { align: "left", label: "环境" },
    { align: "right", label: "P50" },
    { align: "right", label: "P95" },
  ],
  rows: [
    { cells: ["本地", "18 ms", "44 ms"] },
    { cells: ["生产", "42 ms", "118 ms"] },
  ],
  title: "API 延迟对比",
};

test("serializes reorderable Studio columns and rows to the portable table contract", () => {
  const definition = createStudioTableEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_TABLE_EDITOR_ID);
  assert.equal(definition.label, "技术数据表格");
  assert.deepEqual(definition.fields.map(({ name }) => name), ["title", "columns", "rows"]);
  assert.equal(definition.fields[1].min, 2);
  assert.equal(definition.fields[1].max, 6);
  assert.equal(definition.fields[1].allow_reorder, true);
  assert.equal(definition.fields[2].min, 1);
  assert.equal(definition.fields[2].max, 20);
  assert.equal(definition.fields[2].allow_reorder, true);

  const markdown = definition.toBlock(data);
  assert.equal(
    markdown,
    "> [!table] API 延迟对比\n> | 环境 | P50 | P95 |\n> | --- | ---: | ---: |\n> | 本地 | 18 ms | 44 ms |\n> | 生产 | 42 ms | 118 ms |",
  );
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = definition.toPreview(data);
  assert.equal(preview.type, "figure");
  assert.match(JSON.stringify(preview), /markdown-data-table.*DATA TABLE \/ 03 COLUMNS.*118 ms/u);
});

test("round-trips escaped pipes and rejects mismatched, empty, and duplicate data", () => {
  const definition = createStudioTableEditorDefinition({ h });
  const withPipe = {
    ...data,
    rows: [{ cells: ["Node | Edge", "18 ms", "44 ms"] }],
  };
  const markdown = definition.toBlock(withPipe);
  assert.match(markdown, /Node \\| Edge/u);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), withPipe);

  assert.throws(
    () => definition.toBlock({ ...data, rows: [{ cells: ["本地", "18 ms"] }] }),
    /必须填写 3 个/u,
  );
  assert.throws(
    () => definition.toBlock({ ...data, rows: [{ cells: ["本地", "", "44 ms"] }] }),
    /不能为空/u,
  );
  assert.throws(
    () => definition.toBlock({ ...data, columns: [data.columns[0], data.columns[0]] }),
    /表头名称不能重复/u,
  );
});

test("registers and serves one idempotent Studio table editor", async () => {
  const registrations = [];
  const CMS = {
    registerEditorComponent(definition) {
      registrations.push(definition);
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioTableEditor({ CMS, documentRef, h });
  const second = registerStudioTableEditor({ CMS, documentRef, h });

  assert.equal(first, second);
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.tableEditor, "registered");

  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/table-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-table/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/table-editor\.mjs"/u);
  assert.match(html, /registerStudioTableEditor\(\)/u);
  assert.match(assets, /table-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("table-editor\.mjs"\)/u);
});
