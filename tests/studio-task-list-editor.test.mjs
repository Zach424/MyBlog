import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStudioTaskListEditorDefinition,
  registerStudioTaskListEditor,
  STUDIO_TASK_LIST_EDITOR_ID,
} from "../studio/task-list-editor.mjs";

function h(type, props, ...children) {
  return { props: { ...props, children }, type };
}

const data = {
  items: [
    { completed: true, text: "冻结内容契约" },
    { completed: false, text: "完成真实主题验收" },
    { completed: false, text: "发布稳定生产" },
  ],
  title: "发布准备",
};

test("serializes reorderable Studio tasks to the portable GFM contract", () => {
  const definition = createStudioTaskListEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_TASK_LIST_EDITOR_ID);
  assert.equal(definition.label, "项目任务清单");
  assert.deepEqual(definition.fields.map(({ name }) => name), ["title", "items"]);
  assert.equal(definition.fields[1].min, 2);
  assert.equal(definition.fields[1].max, 20);
  assert.equal(definition.fields[1].allow_reorder, true);
  assert.equal(definition.fields[1].fields[0].widget, "boolean");

  const markdown = definition.toBlock(data);
  assert.equal(
    markdown,
    "> [!tasks] 发布准备\n> - [x] 冻结内容契约\n> - [ ] 完成真实主题验收\n> - [ ] 发布稳定生产",
  );
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = definition.toPreview(data);
  assert.equal(preview.type, "div");
  assert.match(JSON.stringify(preview), /markdown-task-ledger.*TASK LEDGER \/ 03 ITEMS.*33% COMPLETE/u);
  assert.doesNotMatch(JSON.stringify(preview), /onClick|contentEditable/u);
});

test("rejects short, multiline, duplicate, and oversized Studio task data", () => {
  const definition = createStudioTaskListEditorDefinition({ h });
  assert.throws(() => definition.toBlock({ ...data, items: [data.items[0]] }), /2–20/u);
  assert.throws(
    () => definition.toBlock({ ...data, items: [data.items[0], { completed: false, text: "两行\n任务" }] }),
    /单行/u,
  );
  assert.throws(
    () => definition.toBlock({ ...data, items: [data.items[0], { completed: false, text: "冻结内容契约" }] }),
    /不能包含重复/u,
  );
  assert.throws(
    () => definition.toBlock({ ...data, items: [data.items[0], { completed: false, text: "任".repeat(241) }] }),
    /1–240/u,
  );
});

test("registers and serves one idempotent Studio task-list editor", async () => {
  const registrations = [];
  const CMS = {
    registerEditorComponent(definition) {
      registrations.push(definition);
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioTaskListEditor({ CMS, documentRef, h });
  const second = registerStudioTaskListEditor({ CMS, documentRef, h });

  assert.equal(first, second);
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.taskListEditor, "registered");

  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/task-list-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-task-list/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/task-list-editor\.mjs"/u);
  assert.match(html, /registerStudioTaskListEditor\(\)/u);
  assert.match(assets, /task-list-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("task-list-editor\.mjs"\)/u);
});
