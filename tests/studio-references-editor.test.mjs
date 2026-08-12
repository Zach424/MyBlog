import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStudioReferencesEditorDefinition,
  registerStudioReferencesEditor,
  STUDIO_REFERENCES_EDITOR_ID,
} from "../studio/references-editor.mjs";

function h(type, props, ...children) {
  return { props: { ...props, children }, type };
}

const data = {
  items: [
    {
      label: "Next.js Route Handlers",
      note: "官方路由处理器说明。",
      target: "https://nextjs.org/docs/app/getting-started/route-handlers",
    },
    {
      label: "MyBlog 项目复盘",
      note: "本站实现与演进记录。",
      target: "/projects/myblog",
    },
  ],
  title: "延伸阅读",
};

test("serializes reorderable Studio references to the portable Markdown contract", () => {
  const definition = createStudioReferencesEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_REFERENCES_EDITOR_ID);
  assert.equal(definition.label, "参考资料清单");
  assert.deepEqual(definition.fields.map(({ name }) => name), ["title", "items"]);
  assert.equal(definition.fields[1].min, 2);
  assert.equal(definition.fields[1].max, 12);
  assert.equal(definition.fields[1].allow_reorder, true);

  const markdown = definition.toBlock(data);
  assert.equal(
    markdown,
    "> [!references] 延伸阅读\n> 1. [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — 官方路由处理器说明。\n> 2. [MyBlog 项目复盘](/projects/myblog) — 本站实现与演进记录。",
  );
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = definition.toPreview(data);
  assert.equal(preview.type, "section");
  assert.match(JSON.stringify(preview), /SOURCE INDEX \/ 02 REFERENCES.*nextjs\.org.*本站/u);
});

test("rejects unsafe, duplicate, short, and oversized Studio reference data", () => {
  const definition = createStudioReferencesEditorDefinition({ h });
  assert.throws(() => definition.toBlock({ ...data, items: [data.items[0]] }), /2–12/u);
  assert.throws(
    () => definition.toBlock({ ...data, items: [data.items[0], { ...data.items[1], target: "http://example.com" }] }),
    /HTTPS/u,
  );
  assert.throws(
    () => definition.toBlock({ ...data, items: [data.items[0], { ...data.items[1], target: data.items[0].target.toUpperCase() }] }),
    /重复链接/u,
  );
  assert.throws(
    () => definition.toBlock({ ...data, items: [data.items[0], { ...data.items[1], note: "注".repeat(241) }] }),
    /240/u,
  );
});

test("registers and serves one idempotent Studio references editor", async () => {
  const registrations = [];
  const CMS = { registerEditorComponent(definition) { registrations.push(definition); } };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioReferencesEditor({ CMS, documentRef, h });
  const second = registerStudioReferencesEditor({ CMS, documentRef, h });
  assert.equal(first, second);
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.referencesEditor, "registered");

  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/references-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-references/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/references-editor\.mjs"/u);
  assert.match(html, /registerStudioReferencesEditor\(\)/u);
  assert.match(assets, /references-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("references-editor\.mjs"\)/u);
});
