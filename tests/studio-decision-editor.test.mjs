import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStudioDecisionEditorDefinition,
  registerStudioDecisionEditor,
  STUDIO_DECISION_EDITOR_ID,
} from "../studio/decision-editor.mjs";

function h(type, props, ...children) { return { props: { ...props, children }, type }; }
const data = {
  alternatives: [
    { title: "Cloudflare Pages", description: "需要额外适配与维护。" },
    { title: "自托管", description: "运维成本超出个人博客需要。" },
  ],
  consequences: [
    { tone: "POSITIVE", description: "发布链路更短，框架支持更直接。" },
    { tone: "NEGATIVE", description: "托管能力与 Vercel 平台耦合。" },
  ],
  context: "需要一个能直接运行 Next.js 且减少额外平台层的公开托管方案。",
  date: "2026-08-12",
  decision: "使用 Vercel 作为生产托管平台。",
  rationale: "它与当前 Next.js 构建、预览和 Git 交付链路直接对齐。",
  status: "ACCEPTED",
  title: "选择 Vercel 原生托管",
};

test("round-trips one structured Studio decision to portable Markdown", () => {
  const definition = createStudioDecisionEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_DECISION_EDITOR_ID);
  assert.equal(definition.label, "技术决策记录");
  assert.deepEqual(definition.fields.map(({ name }) => name), [
    "title", "status", "date", "context", "decision", "rationale", "alternatives", "consequences",
  ]);
  assert.equal(definition.fields[6].allow_reorder, true);
  assert.equal(definition.fields[7].max, 6);
  const markdown = definition.toBlock(data);
  assert.match(markdown, /^> \[!decision\] 选择 Vercel 原生托管$/mu);
  assert.match(markdown, /^> \*\*STATUS:\*\* `ACCEPTED` · \*\*DATE:\*\* `2026-08-12`$/mu);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = JSON.stringify(definition.toPreview(data));
  assert.match(preview, /markdown-decision.*decision-brief.*DECISION \/ LOCK/u);
  assert.match(preview, /NOT SELECTED.*IMPACT LEDGER/u);
});

test("rejects invalid Studio decision statuses, dates, duplicates, and copy", () => {
  const definition = createStudioDecisionEditorDefinition({ h });
  assert.throws(() => definition.toBlock({ ...data, status: "PENDING" }), /状态只允许/u);
  assert.throws(() => definition.toBlock({ ...data, date: "2026-02-30" }), /真实的 YYYY-MM-DD/u);
  assert.throws(() => definition.toBlock({ ...data, alternatives: [] }), /1–6/u);
  assert.throws(() => definition.toBlock({ ...data, alternatives: [data.alternatives[0], { ...data.alternatives[0], title: "Ｃｌｏｕｄｆｌａｒｅ　Ｐａｇｅｓ" }] }), /重复的备选方案/u);
  assert.throws(() => definition.toBlock({ ...data, context: "![图片](/x.png)" }), /不能包含图片/u);
  assert.throws(() => definition.toBlock({ ...data, consequences: [{ tone: "RISK", description: "不受支持。" }] }), /影响类型只允许/u);
});

test("registers and serves one idempotent Studio decision editor", async () => {
  const registrations = [];
  const CMS = { registerEditorComponent(definition) { registrations.push(definition); } };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioDecisionEditor({ CMS, documentRef, h });
  assert.equal(first, registerStudioDecisionEditor({ CMS, documentRef, h }));
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.decisionEditor, "registered");
  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/decision-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-decision/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/decision-editor\.mjs"/u);
  assert.match(html, /registerStudioDecisionEditor\(\)/u);
  assert.match(assets, /decision-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("decision-editor\.mjs"\)/u);
});
