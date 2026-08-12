import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createStudioHttpEditorDefinition,
  registerStudioHttpEditor,
  STUDIO_HTTP_EDITOR_ID,
} from "../studio/http-editor.mjs";

function h(type, props, ...children) { return { props: { ...props, children }, type }; }

const data = {
  date: "2026-08-13",
  method: "POST",
  purpose: "记录草稿创建接口的脱敏请求与响应。",
  requestBody: "{\"title\":\"HTTP 交换台账\"}",
  requestBodyLanguage: "json",
  requestHeaders: [
    { name: "Accept", value: "application/json" },
    { name: "Content-Type", value: "application/json" },
  ],
  responseBody: "{\"id\":\"42\",\"status\":\"draft\"}",
  responseBodyLanguage: "json",
  responseHeaders: [{ name: "Content-Type", value: "application/json" }],
  status: "201",
  target: "https://api.example.com/v1/posts?draft=true",
  title: "创建草稿文章",
  verifications: [{ label: "Status and schema", value: "PASS", description: "状态码和脱敏响应结构与预期一致。" }],
};

test("round-trips a portable static HTTP exchange", () => {
  const definition = createStudioHttpEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_HTTP_EDITOR_ID);
  assert.equal(definition.label, "HTTP 请求 / 响应证据");
  assert.deepEqual(definition.fields.map(({ name }) => name), [
    "title", "method", "status", "date", "purpose", "target", "requestHeaders",
    "requestBodyLanguage", "requestBody", "responseHeaders", "responseBodyLanguage",
    "responseBody", "verifications",
  ]);
  const markdown = definition.toBlock(data);
  assert.match(markdown, /^> \[!http\] 创建草稿文章/mu);
  assert.match(markdown, /^> \*\*METHOD:\*\* `POST` · \*\*STATUS:\*\* `201`/mu);
  assert.match(markdown, /^> ~~~json$/mu);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = JSON.stringify(definition.toPreview(data));
  assert.match(preview, /markdown-http.*exchange-ledger.*REQUEST → RESPONSE/u);
  assert.match(preview, /STATIC \/ REDACTED.*201 \/ OBSERVED.*VERIFICATION/u);
  assert.doesNotMatch(preview, /button|onclick|contenteditable/iu);
});

test("serializes empty headers and bodies as explicit NONE", () => {
  const definition = createStudioHttpEditorDefinition({ h });
  const empty = {
    ...data,
    method: "HEAD",
    requestBody: "",
    requestBodyLanguage: "NONE",
    requestHeaders: [],
    responseBody: "",
    responseBodyLanguage: "NONE",
    responseHeaders: [],
    status: "204",
    target: "http://localhost:3000/health",
  };
  const markdown = definition.toBlock(empty);
  assert.equal((markdown.match(/^> - `NONE`$/gmu) ?? []).length, 2);
  assert.match(markdown, /^> \*\*REQUEST BODY:\*\* `NONE`$/mu);
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), empty);
});

test("rejects unsafe credentials, invalid body semantics, and media-type drift", () => {
  const definition = createStudioHttpEditorDefinition({ h });
  const invalid = [
    [{ ...data, target: "http://api.example.com/v1/posts" }, /只允许 HTTPS/u],
    [{ ...data, target: "https://api.example.com/v1/posts?access_token=secret" }, /查询参数.*凭据/u],
    [{ ...data, requestHeaders: [{ name: "Authorization", value: "Bearer abcdefghijklmnop" }] }, /鉴权|不能发布/u],
    [{ ...data, method: "GET" }, /GET.*不能包含请求正文/u],
    [{ ...data, requestHeaders: [{ name: "Content-Type", value: "text/plain" }] }, /Content-Type.*json/u],
    [{ ...data, status: "204" }, /204 响应不能包含正文/u],
  ];
  for (const [value, expected] of invalid) assert.throws(() => definition.toBlock(value), expected);
});

test("registers and serves one idempotent Studio HTTP editor", async () => {
  const registrations = [];
  const CMS = { registerEditorComponent(definition) { registrations.push(definition); } };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioHttpEditor({ CMS, documentRef, h });
  assert.equal(first, registerStudioHttpEditor({ CMS, documentRef, h }));
  assert.equal(registrations.length, 1);
  assert.equal(documentRef.documentElement.dataset.httpEditor, "registered");
  const [configSource, html, assets, route] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/http-editor.mjs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((configSource.match(/myblog-http/gu) ?? []).length, 2);
  assert.match(html, /from "\/studio\/http-editor\.mjs"/u);
  assert.match(html, /registerStudioHttpEditor\(\)/u);
  assert.match(assets, /http-editor\.mjs/u);
  assert.match(route, /studioAssetResponse\("http-editor\.mjs"\)/u);
});
