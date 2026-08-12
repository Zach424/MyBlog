import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStudioStepsEditorDefinition,
  registerStudioStepsEditor,
  STUDIO_STEPS_EDITOR_ID,
} from "../studio/steps-editor.mjs";

function h(type, props, ...children) {
  return { props: { ...props, children }, type };
}

const data = {
  items: [
    {
      instruction: "执行 `npm run release:check`，处理全部失败项。",
      name: "运行完整检查",
      verification: "命令以退出码 0 完成。",
    },
    {
      instruction: "将已审阅提交推送到 `main`。",
      name: "推送主分支",
      verification: "远端 HEAD 与本地一致。",
    },
  ],
  title: "发布流程",
};

test("serializes reorderable Studio procedures to the portable Markdown contract", () => {
  const definition = createStudioStepsEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_STEPS_EDITOR_ID);
  assert.equal(definition.label, "操作步骤流程");
  assert.deepEqual(definition.fields.map(({ name }) => name), ["title", "items"]);
  assert.equal(definition.fields[1].min, 2);
  assert.equal(definition.fields[1].max, 10);
  assert.equal(definition.fields[1].allow_reorder, true);
  assert.deepEqual(
    definition.fields[1].fields.map(({ name }) => name),
    ["name", "instruction", "verification"],
  );

  const markdown = definition.toBlock(data);
  assert.match(markdown, /^> \[!steps\] 发布流程$/mu);
  assert.equal((markdown.match(/^> \d+\. \*\*/gmu) ?? []).length, 2);
  assert.equal((markdown.match(/^> {4}\*\*验证：\*\*/gmu) ?? []).length, 2);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = definition.toPreview(data);
  assert.equal(preview.type, "section");
  assert.match(
    JSON.stringify(preview),
    /markdown-procedure.*PROCEDURE \/ 02 STEPS.*运行完整检查.*CHECK/u,
  );
  assert.doesNotMatch(JSON.stringify(preview), /onClick|contentEditable|checkbox/u);
});

test("rejects short, duplicate, multiline, missing, and oversized Studio procedure data", () => {
  const definition = createStudioStepsEditorDefinition({ h });
  assert.throws(
    () => definition.toBlock({ ...data, items: [data.items[0]] }),
    /2–10/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], name: "运行完整检查" }],
    }),
    /不能包含重复/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], instruction: "两行\n说明" }],
    }),
    /单行/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], instruction: "" }],
    }),
    /1–600/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], verification: "验".repeat(241) }],
    }),
    /240/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], instruction: "![截图](/uploads/x.png)" }],
    }),
    /不能包含图片/u,
  );
});

test("registers and serves one idempotent Studio procedure editor", async () => {
  const registrations = [];
  const CMS = {
    registerEditorComponent(definition) {
      registrations.push(definition);
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioStepsEditor({ CMS, documentRef, h });
  const second = registerStudioStepsEditor({ CMS, documentRef, h });

  assert.equal(first, second);
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.stepsEditor, "registered");

  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/steps-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-steps/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/steps-editor\.mjs"/u);
  assert.match(html, /registerStudioStepsEditor\(\)/u);
  assert.match(assets, /steps-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("steps-editor\.mjs"\)/u);
});
