import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createStudioFileTreeEditorDefinition, registerStudioFileTreeEditor, STUDIO_FILETREE_EDITOR_ID } from "../studio/filetree-editor.mjs";

function h(type, props, ...children) { return { props: { ...props, children }, type }; }
const data = { nodes: [
  { description: "页面、布局与同源路由。", path: "app/" },
  { description: "Git-backed 发布后台。", path: "app/studio/" },
  { description: "后台静态入口。", path: "app/studio/page.tsx" },
  { description: "共享内容解析与渲染。", path: "lib/" },
  { description: "脚本、依赖与质量门。", path: "package.json" },
], title: "MyBlog 核心结构" };

test("serializes ordered Studio paths to portable nested Markdown", () => {
  const definition = createStudioFileTreeEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_FILETREE_EDITOR_ID);
  assert.equal(definition.label, "项目文件树");
  assert.deepEqual(definition.fields.map(({ name }) => name), ["title", "nodes"]);
  assert.equal(definition.fields[1].min, 2);
  assert.equal(definition.fields[1].max, 32);
  assert.equal(definition.fields[1].allow_reorder, true);
  const markdown = definition.toBlock(data);
  assert.match(markdown, /^> \[!filetree\] MyBlog 核心结构$/mu);
  assert.match(markdown, /^> {3}- `studio\/`/mu);
  assert.match(markdown, /^> {5}- `page\.tsx`/mu);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  assert.match(JSON.stringify(definition.toPreview(data)), /markdown-filetree.*FILE MAP \/ 05 NODES.*DEPTH · 03 MAX.*page\.tsx/u);
});

test("rejects invalid Studio file-tree paths and descriptions", () => {
  const definition = createStudioFileTreeEditorDefinition({ h });
  assert.throws(() => definition.toBlock({ ...data, nodes: [data.nodes[0]] }), /2–32/u);
  assert.throws(() => definition.toBlock({ ...data, nodes: [data.nodes[0], { description: "重复", path: "ＡＰＰ/" }] }), /不能重复/u);
  assert.throws(() => definition.toBlock({ ...data, nodes: [{ description: "文件", path: "file.ts" }, { description: "孤儿", path: "file.ts/child.ts" }] }), /父文件夹/u);
  assert.throws(() => definition.toBlock({ ...data, nodes: [{ description: "越界", path: "../" }, data.nodes[4]] }), /安全路径段/u);
  assert.throws(() => definition.toBlock({ ...data, nodes: [{ description: "图片 ![图](/x.png)", path: "app/" }, data.nodes[4]] }), /不能包含图片/u);
  assert.throws(() => definition.toBlock({ ...data, nodes: [{ description: "两行\n说明", path: "app/" }, data.nodes[4]] }), /单行/u);
});

test("registers and serves one idempotent Studio file-tree editor", async () => {
  const registrations = [];
  const CMS = { registerEditorComponent(definition) { registrations.push(definition); } };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioFileTreeEditor({ CMS, documentRef, h });
  assert.equal(first, registerStudioFileTreeEditor({ CMS, documentRef, h }));
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.filetreeEditor, "registered");
  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/filetree-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-filetree/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/filetree-editor\.mjs"/u);
  assert.match(html, /registerStudioFileTreeEditor\(\)/u);
  assert.match(assets, /filetree-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("filetree-editor\.mjs"\)/u);
});
