import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStudioGlossaryEditorDefinition,
  registerStudioGlossaryEditor,
  STUDIO_GLOSSARY_EDITOR_ID,
} from "../studio/glossary-editor.mjs";

function h(type, props, ...children) {
  return { props: { ...props, children }, type };
}

const data = {
  items: [
    {
      aliases: ["RSC", "React Server Component"],
      context: "在 Next.js App Router 中默认用于服务端数据读取和组合界面。",
      definition: "只在服务端渲染的 React 组件，不向浏览器发送该组件本身的 JavaScript。",
      term: "Server Component",
    },
    {
      aliases: ["Hydration"],
      context: "只发生在需要浏览器交互的 Client Component 边界。",
      definition: "React 在已有服务端 HTML 上绑定客户端行为的过程。",
      term: "水合",
    },
  ],
  title: "React 核心概念",
};

test("serializes reorderable Studio glossaries to the portable Markdown contract", () => {
  const definition = createStudioGlossaryEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_GLOSSARY_EDITOR_ID);
  assert.equal(definition.label, "术语定义表");
  assert.deepEqual(definition.fields.map(({ name }) => name), ["title", "items"]);
  assert.equal(definition.fields[1].min, 2);
  assert.equal(definition.fields[1].max, 12);
  assert.equal(definition.fields[1].allow_reorder, true);
  assert.deepEqual(
    definition.fields[1].fields.map(({ name }) => name),
    ["term", "definition", "aliases", "context"],
  );

  const markdown = definition.toBlock(data);
  assert.match(markdown, /^> \[!glossary\] React 核心概念$/mu);
  assert.equal((markdown.match(/^> - \*\*/gmu) ?? []).length, 2);
  assert.equal((markdown.match(/^> {3}\*\*别名：\*\*/gmu) ?? []).length, 2);
  assert.equal((markdown.match(/^> {3}\*\*上下文：\*\*/gmu) ?? []).length, 2);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = definition.toPreview(data);
  assert.equal(preview.type, "section");
  assert.match(
    JSON.stringify(preview),
    /markdown-glossary.*GLOSSARY \/ 02 TERMS.*Server Component.*ALIASES.*CONTEXT/u,
  );
  assert.doesNotMatch(JSON.stringify(preview), /onClick|contentEditable|checkbox/u);
});

test("rejects short, duplicate, multiline, unsafe, and oversized Studio glossary data", () => {
  const definition = createStudioGlossaryEditorDefinition({ h });
  assert.throws(
    () => definition.toBlock({ ...data, items: [data.items[0]] }),
    /2–12/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], term: "RSC" }],
    }),
    /不能互相重复/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], definition: "两行\n定义" }],
    }),
    /单行/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], definition: "![图](/uploads/x.png)" }],
    }),
    /不能包含图片/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], context: "上".repeat(401) }],
    }),
    /400/u,
  );
  assert.throws(
    () => definition.toBlock({
      ...data,
      items: [data.items[0], { ...data.items[1], aliases: ["A", "B", "C", "D", "E", "F"] }],
    }),
    /最多填写 5/u,
  );
});

test("registers and serves one idempotent Studio glossary editor", async () => {
  const registrations = [];
  const CMS = {
    registerEditorComponent(definition) {
      registrations.push(definition);
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioGlossaryEditor({ CMS, documentRef, h });
  const second = registerStudioGlossaryEditor({ CMS, documentRef, h });

  assert.equal(first, second);
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.glossaryEditor, "registered");

  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/glossary-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-glossary/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/glossary-editor\.mjs"/u);
  assert.match(html, /registerStudioGlossaryEditor\(\)/u);
  assert.match(assets, /glossary-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("glossary-editor\.mjs"\)/u);
});
