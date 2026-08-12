import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStudioExperimentEditorDefinition,
  registerStudioExperimentEditor,
  STUDIO_EXPERIMENT_EDITOR_ID,
} from "../studio/experiment-editor.mjs";

function h(type, props, ...children) { return { props: { ...props, children }, type }; }
const data = {
  conclusion: "本次运行支持当前工作站能在约三分钟内完成完整发布检查。",
  date: "2026-08-12",
  environment: "Windows、Node.js 22、Next.js 16.3.0，使用仓库锁定依赖。",
  hypothesis: "当前工作站可以在三分钟内完成全部本地发布质量门。",
  limitations: [
    { title: "单次运行", description: "没有重复样本，不能证明长期耗时分布。" },
    { title: "单机范围", description: "结果只覆盖当前硬件、系统与依赖版本。" },
  ],
  measurements: [
    { label: "完整发布检查", value: "184.3 s", description: "配置、内容、测试、类型、构建、应用和审计全部通过。" },
    { label: "应用测试", value: "35/35", description: "真实生产服务器路径全部通过。" },
  ],
  method: "在干净依赖环境中运行一次 `npm run release:check` 并记录最终结果。",
  sample: "单台工作站、一次完整运行，覆盖当前公开内容与全部测试。",
  status: "SUPPORTED",
  title: "验证博客完整发布门耗时",
};

test("round-trips one structured Studio experiment to portable Markdown", () => {
  const definition = createStudioExperimentEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_EXPERIMENT_EDITOR_ID);
  assert.equal(definition.label, "技术实验记录");
  assert.deepEqual(definition.fields.map(({ name }) => name), [
    "title", "status", "date", "hypothesis", "environment", "method", "sample", "measurements", "conclusion", "limitations",
  ]);
  assert.equal(definition.fields[7].allow_reorder, true);
  assert.equal(definition.fields[9].max, 6);
  const markdown = definition.toBlock(data);
  assert.match(markdown, /^> \[!experiment\] 验证博客完整发布门耗时$/mu);
  assert.match(markdown, /^> \*\*STATUS:\*\* `SUPPORTED` · \*\*DATE:\*\* `2026-08-12`$/mu);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = JSON.stringify(definition.toPreview(data));
  assert.match(preview, /markdown-experiment.*bench-sheet.*EXPERIMENT \/ RUN/u);
  assert.match(preview, /MEASUREMENTS.*LIMITATIONS/u);
});

test("rejects invalid Studio experiment statuses, dates, duplicates, and copy", () => {
  const definition = createStudioExperimentEditorDefinition({ h });
  assert.throws(() => definition.toBlock({ ...data, status: "RUNNING" }), /状态只允许/u);
  assert.throws(() => definition.toBlock({ ...data, date: "2026-02-30" }), /真实的 YYYY-MM-DD/u);
  assert.throws(() => definition.toBlock({ ...data, measurements: [] }), /1–8/u);
  assert.throws(() => definition.toBlock({ ...data, measurements: [data.measurements[0], { ...data.measurements[0], label: "完整发布检查" }] }), /重复的测量项/u);
  assert.throws(() => definition.toBlock({ ...data, limitations: [data.limitations[0], { ...data.limitations[0], title: "单次运行" }] }), /重复的局限项/u);
  assert.throws(() => definition.toBlock({ ...data, hypothesis: "![图片](/x.png)" }), /不能包含图片/u);
});

test("registers and serves one idempotent Studio experiment editor", async () => {
  const registrations = [];
  const CMS = { registerEditorComponent(definition) { registrations.push(definition); } };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioExperimentEditor({ CMS, documentRef, h });
  assert.equal(first, registerStudioExperimentEditor({ CMS, documentRef, h }));
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.experimentEditor, "registered");
  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/experiment-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-experiment/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/experiment-editor\.mjs"/u);
  assert.match(html, /registerStudioExperimentEditor\(\)/u);
  assert.match(assets, /experiment-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("experiment-editor\.mjs"\)/u);
});
