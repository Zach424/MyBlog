import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStudioCodeChangeEditorDefinition,
  registerStudioCodeChangeEditor,
  STUDIO_CODE_CHANGE_EDITOR_ID,
} from "../studio/codechange-editor.mjs";

function h(type, props, ...children) { return { props: { ...props, children }, type }; }
const data = {
  date: "2026-08-12",
  diff: "diff --git a/lib/example.ts b/lib/example.ts\n--- a/lib/example.ts\n+++ b/lib/example.ts\n@@ -1 +1 @@\n-export const enabled = false;\n+export const enabled = true;",
  files: [{ status: "MODIFIED", path: "lib/example.ts", description: "收敛共享解析与渲染入口。" }],
  mode: "UNIFIED",
  purpose: "让文章保留可审阅的实现依据，而不连接线上 Git 仓库。",
  risks: [{ title: "示例漂移", description: "编辑器与服务端必须继续共享固定契约。" }],
  title: "为 Studio 增加代码变更编辑器",
  verifications: [{ label: "Unit tests", value: "8/8", description: "解析和失败路径全部通过。" }],
};

test("round-trips unified and before/after evidence to portable Markdown", () => {
  const definition = createStudioCodeChangeEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_CODE_CHANGE_EDITOR_ID);
  assert.equal(definition.label, "代码变更证据");
  assert.deepEqual(definition.fields.map(({ name }) => name), [
    "title", "mode", "date", "purpose", "files", "diff", "language", "before", "after", "verifications", "risks",
  ]);
  assert.equal(definition.fields[5].condition.value, "UNIFIED");
  assert.equal(definition.fields[7].condition.value, "BEFORE_AFTER");
  const markdown = definition.toBlock(data);
  assert.match(markdown, /^> \[!codechange\] 为 Studio 增加代码变更编辑器$/mu);
  assert.match(markdown, /^> ~~~diff$/mu);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), {
    ...data,
    after: "", before: "", language: "",
  });

  const split = {
    ...data,
    before: "export const enabled = false;",
    after: "export const enabled = true;",
    diff: "",
    language: "ts",
    mode: "BEFORE_AFTER",
  };
  const splitMarkdown = definition.toBlock(split);
  assert.match(splitMarkdown, /^> \*\*BEFORE:\*\* `ts`$/mu);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(splitMarkdown)), split);
  const preview = JSON.stringify(definition.toPreview(split));
  assert.match(preview, /markdown-codechange.*review-docket.*CHANGE \/ REVIEW/u);
  assert.match(preview, /BEFORE.*AFTER.*VERIFICATION.*KNOWN RISKS/u);
});

test("rejects invalid modes, dates, paths, mismatched diffs, duplicates, and secrets", () => {
  const definition = createStudioCodeChangeEditorDefinition({ h });
  assert.throws(() => definition.toBlock({ ...data, mode: "PATCH" }), /模式只允许/u);
  assert.throws(() => definition.toBlock({ ...data, date: "2026-02-30" }), /真实的 YYYY-MM-DD/u);
  assert.throws(() => definition.toBlock({ ...data, files: [{ ...data.files[0], path: "../secret.ts" }] }), /不能越界/u);
  assert.throws(() => definition.toBlock({ ...data, files: [{ ...data.files[0], path: "lib/other.ts" }] }), /diff --git 文件头一致/u);
  assert.throws(() => definition.toBlock({ ...data, verifications: [data.verifications[0], data.verifications[0]] }), /重复的验证项/u);
  assert.throws(() => definition.toBlock({ ...data, diff: data.diff.replace("enabled = true", "github_pat_abcdefghijklmnopqrstuvwxyz123456") }), /访问令牌/u);
  assert.throws(() => definition.toBlock({ ...data, mode: "BEFORE_AFTER", diff: "", language: "ts", before: "same", after: "same" }), /不能完全相同/u);
});

test("registers and serves one idempotent Studio code-change editor", async () => {
  const registrations = [];
  const CMS = { registerEditorComponent(definition) { registrations.push(definition); } };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioCodeChangeEditor({ CMS, documentRef, h });
  assert.equal(first, registerStudioCodeChangeEditor({ CMS, documentRef, h }));
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.codeChangeEditor, "registered");
  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/codechange-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-codechange/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/codechange-editor\.mjs"/u);
  assert.match(html, /registerStudioCodeChangeEditor\(\)/u);
  assert.match(assets, /codechange-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("codechange-editor\.mjs"\)/u);
});
