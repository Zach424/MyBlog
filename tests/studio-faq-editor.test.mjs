import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createStudioFaqEditorDefinition, registerStudioFaqEditor, STUDIO_FAQ_EDITOR_ID } from "../studio/faq-editor.mjs";

function h(type, props, ...children) { return { props: { ...props, children }, type }; }
const data = { items: [{ answers: ["Studio 适合浏览器内结构化编辑；Obsidian 适合本地知识库写作。", "两者最终发布同一份 Markdown。"], question: "应该使用 Studio 还是 Obsidian？" }, { answers: ["不会。展开只存在于当前页面，不写回 Git。"], question: "FAQ 会保存读者的展开状态吗？" }], title: "发布常见问题" };

test("serializes reorderable Studio FAQs to the portable Markdown contract", () => {
  const definition = createStudioFaqEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_FAQ_EDITOR_ID);
  assert.equal(definition.label, "常见问题 FAQ");
  assert.deepEqual(definition.fields.map(({ name }) => name), ["title", "items"]);
  assert.equal(definition.fields[1].min, 2);
  assert.equal(definition.fields[1].max, 10);
  assert.equal(definition.fields[1].allow_reorder, true);
  assert.deepEqual(definition.fields[1].fields.map(({ name }) => name), ["question", "answers"]);
  const markdown = definition.toBlock(data);
  assert.match(markdown, /^> \[!faq\] 发布常见问题$/mu);
  assert.equal((markdown.match(/^> - \*\*/gmu) ?? []).length, 2);
  assert.equal((markdown.match(/^> {3}/gmu) ?? []).length, 3);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  assert.match(JSON.stringify(definition.toPreview(data)), /markdown-faq.*FAQ \/ 02 QUESTIONS.*ANSWERS · NATIVE.*Studio.*markdown-faq-answer/u);
});

test("rejects invalid Studio FAQ data", () => {
  const definition = createStudioFaqEditorDefinition({ h });
  assert.throws(() => definition.toBlock({ ...data, items: [data.items[0]] }), /2–10/u);
  assert.throws(() => definition.toBlock({ ...data, items: [data.items[0], { ...data.items[1], question: "应该使用 Ｓｔｕｄｉｏ 还是 Obsidian？" }] }), /不能重复/u);
  assert.throws(() => definition.toBlock({ ...data, items: [data.items[0], { ...data.items[1], answers: ["两行\n答案"] }] }), /单行/u);
  assert.throws(() => definition.toBlock({ ...data, items: [data.items[0], { ...data.items[1], answers: ["![图](/uploads/x.png)"] }] }), /不能包含图片/u);
  assert.throws(() => definition.toBlock({ ...data, items: [data.items[0], { ...data.items[1], answers: [] }] }), /1–3/u);
  assert.throws(() => definition.toBlock({ ...data, items: [data.items[0], { ...data.items[1], answers: ["A".repeat(601)] }] }), /600/u);
});

test("registers and serves one idempotent Studio FAQ editor", async () => {
  const registrations = [];
  const CMS = { registerEditorComponent(definition) { registrations.push(definition); } };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioFaqEditor({ CMS, documentRef, h });
  assert.equal(first, registerStudioFaqEditor({ CMS, documentRef, h }));
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.faqEditor, "registered");
  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/faq-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-faq/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/faq-editor\.mjs"/u);
  assert.match(html, /registerStudioFaqEditor\(\)/u);
  assert.match(assets, /faq-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("faq-editor\.mjs"\)/u);
});
