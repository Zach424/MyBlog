import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createStudioTimelineEditorDefinition, registerStudioTimelineEditor, STUDIO_TIMELINE_EDITOR_ID } from "../studio/timeline-editor.mjs";

function h(type, props, ...children) { return { props: { ...props, children }, type }; }
const data = { events: [
  { date: "2026-07-19", description: "用 Markdown 与 Zod 冻结第一版内容边界。", title: "建立内容契约", type: "START" },
  { date: "2026-08-02", description: "选择 Studio 与 Obsidian 共享发布契约。", title: "统一作者入口", type: "DECISION" },
  { date: "2026-08-12", description: "完成自动化、移动端与打印验证。", title: "通过生产验证", type: "VERIFY" },
], title: "MyBlog 交付里程碑" };

test("serializes ordered Studio milestones to portable Markdown", () => {
  const definition = createStudioTimelineEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_TIMELINE_EDITOR_ID);
  assert.equal(definition.label, "项目里程碑时间线");
  assert.deepEqual(definition.fields.map(({ name }) => name), ["title", "events"]);
  assert.equal(definition.fields[1].min, 2);
  assert.equal(definition.fields[1].max, 16);
  assert.equal(definition.fields[1].allow_reorder, true);
  const markdown = definition.toBlock(data);
  assert.match(markdown, /^> \[!timeline\] MyBlog 交付里程碑$/mu);
  assert.match(markdown, /^> - `2026-08-02` `DECISION` \*\*统一作者入口\*\*$/mu);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = JSON.stringify(definition.toPreview(data));
  assert.match(preview, /markdown-timeline.*HISTORY \/ 03 EVENTS.*2026-07-19 → 2026-08-12/u);
  assert.match(preview, /datetime|dateTime/u);
});

test("rejects invalid Studio milestone dates, order, duplicates, and descriptions", () => {
  const definition = createStudioTimelineEditorDefinition({ h });
  assert.throws(() => definition.toBlock({ ...data, events: [data.events[0]] }), /2–16/u);
  assert.throws(() => definition.toBlock({ ...data, events: [{ ...data.events[0], date: "2026-02-30" }, data.events[1]] }), /真实的 YYYY-MM-DD/u);
  assert.throws(() => definition.toBlock({ ...data, events: [{ ...data.events[0], type: "PLAN" }, data.events[1]] }), /类型只允许/u);
  assert.throws(() => definition.toBlock({ ...data, events: [data.events[1], data.events[0]] }), /不能早于/u);
  assert.throws(() => definition.toBlock({ ...data, events: [data.events[0], { ...data.events[0], title: "建立内容契约" }] }), /重复里程碑/u);
  assert.throws(() => definition.toBlock({ ...data, events: [{ ...data.events[0], description: "![图片](/x.png)" }, data.events[1]] }), /不能包含图片/u);
});

test("registers and serves one idempotent Studio timeline editor", async () => {
  const registrations = [];
  const CMS = { registerEditorComponent(definition) { registrations.push(definition); } };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioTimelineEditor({ CMS, documentRef, h });
  assert.equal(first, registerStudioTimelineEditor({ CMS, documentRef, h }));
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.timelineEditor, "registered");
  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/timeline-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-timeline/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/timeline-editor\.mjs"/u);
  assert.match(html, /registerStudioTimelineEditor\(\)/u);
  assert.match(assets, /timeline-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("timeline-editor\.mjs"\)/u);
});
