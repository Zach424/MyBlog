import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  extractMarkdownHttpExchanges,
  getMarkdownHttpIssue,
  rehypeMarkdownHttpExchanges,
} from "../lib/markdown-http.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const exchange = `> [!http] 创建草稿文章
> **METHOD:** \`POST\` · **STATUS:** \`201\` · **DATE:** \`2026-08-13\`
>
> **PURPOSE**
>
> 记录草稿创建接口的脱敏请求与响应，方便复盘字段约定。
>
> **TARGET**
>
> \`https://api.example.com/v1/posts?draft=true\`
>
> **REQUEST HEADERS**
>
> - \`Accept: application/json\`
> - \`Content-Type: application/json; charset=utf-8\`
>
> **REQUEST BODY:** \`json\`
>
> ~~~json
> {"title":"HTTP 交换台账","status":"draft"}
> ~~~
>
> **RESPONSE HEADERS**
>
> - \`Content-Type: application/json\`
> - \`Location: https://api.example.com/v1/posts/42\`
>
> **RESPONSE BODY:** \`json\`
>
> ~~~json
> {"id":"42","status":"draft"}
> ~~~
>
> **VERIFICATION**
>
> - **Status and schema** \`PASS\` — 状态码和脱敏响应结构与预期一致。`;

const noBodyExchange = `> [!http] 检查站点健康状态
> **METHOD:** \`HEAD\` · **STATUS:** \`204\` · **DATE:** \`2026-08-12\`
>
> **PURPOSE**
>
> 记录无正文健康检查的公开响应结果。
>
> **TARGET**
>
> \`http://localhost:3000/health\`
>
> **REQUEST HEADERS**
>
> - \`NONE\`
>
> **REQUEST BODY:** \`NONE\`
>
> **RESPONSE HEADERS**
>
> - \`Cache-Control: no-store\`
>
> **RESPONSE BODY:** \`NONE\`
>
> **VERIFICATION**
>
> - **Empty body** \`PASS\` — HEAD 与 204 都没有发布响应正文。`;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownHttpExchanges)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("extracts static, redacted request and response evidence", () => {
  const [value] = extractMarkdownHttpExchanges(exchange, { maximumDate: "2026-08-13" });
  assert.equal(value.title, "创建草稿文章");
  assert.equal(value.method, "POST");
  assert.equal(value.status, 201);
  assert.equal(value.target, "https://api.example.com/v1/posts?draft=true");
  assert.deepEqual(value.requestHeaders, [
    { name: "Accept", value: "application/json" },
    { name: "Content-Type", value: "application/json; charset=utf-8" },
  ]);
  assert.equal(value.requestBody.language, "json");
  assert.match(value.responseBody.value, /"id":"42"/u);
  assert.equal(value.verifications[0].value, "PASS");

  const [empty] = extractMarkdownHttpExchanges(noBodyExchange);
  assert.deepEqual(empty.requestHeaders, []);
  assert.deepEqual(empty.requestBody, { language: "NONE", value: "" });
  assert.deepEqual(empty.responseBody, { language: "NONE", value: "" });
});

test("renders an accessible, non-interactive exchange ledger", () => {
  const html = render(exchange);
  assert.match(html, /data-http-exchange="exchange-ledger"/u);
  assert.match(html, /data-method="post"/u);
  assert.match(html, /data-status="201"/u);
  assert.match(html, /REQUEST → RESPONSE/u);
  assert.match(html, /TARGET \/ REDACTED/u);
  assert.match(html, /markdown-http-request.*markdown-http-response/su);
  assert.match(html, /markdown-http-pre/u);
  assert.doesNotMatch(html, /<button|contenteditable|onclick=/iu);
});

test("rejects malformed structure, unsafe targets, credentials, and duplicate headers", () => {
  const invalid = [
    [exchange.replace("[!http]", "[!http]+"), /静态|折叠/u],
    [exchange.replace("`POST`", "`TRACE`"), /方法只允许/u],
    [exchange.replace("`201`", "`999`"), /100–599/u],
    [exchange.replace("`2026-08-13`", "`2026-02-30`"), /真实的 YYYY-MM-DD/u],
    [exchange.replace("https://api.example.com", "http://api.example.com"), /只允许 HTTPS/u],
    [exchange.replace("draft=true", "access_token=secret-value"), /查询参数.*凭据/u],
    [exchange.replace("`Accept: application/json`", "`Authorization: Bearer abcdefghijklmnop`"), /鉴权|不能发布/u],
    [exchange.replace("`Content-Type: application/json; charset=utf-8`", "`accept: text/plain`"), /名称重复/u],
    [`- 外层\n${exchange.split("\n").map((line) => `  ${line}`).join("\n")}`, /顶层区块/u],
  ];
  for (const [source, expected] of invalid) {
    const issue = getMarkdownHttpIssue(source);
    assert.equal(issue?.kind, "http");
    assert.match(issue?.message ?? "", expected);
  }
  assert.match(
    getMarkdownHttpIssue(exchange, { maximumDate: "2026-08-12" })?.message ?? "",
    /只记录已经完成的观察/u,
  );
});

test("enforces body semantics, media types, and article budgets", () => {
  const invalid = [
    [exchange.replace("`POST`", "`GET`"), /GET.*不能包含正文/u],
    [exchange.replace("application/json; charset=utf-8", "text/plain"), /Content-Type.*json/u],
    [exchange.replace("`201`", "`204`"), /204.*不能包含正文/u],
    [exchange.replace("{\"id\":\"42\",\"status\":\"draft\"}", "{\"access_token\":\"github_pat_abcdefghijklmnopqrstuvwxyz123456\"}"), /凭据|访问令牌/u],
  ];
  for (const [source, expected] of invalid) {
    assert.match(getMarkdownHttpIssue(source)?.message ?? "", expected);
  }
  const third = exchange.replace("创建草稿文章", "第三个交换").replaceAll("/posts", "/third");
  assert.match(
    getMarkdownHttpIssue(`${exchange}\n\n${noBodyExchange}\n\n${third}`)?.message ?? "",
    /最多允许 2/u,
  );
});

test("keeps method, status, target, safe payloads, and verification searchable without syntax noise", () => {
  const plain = markdownToPlainText(exchange);
  assert.match(plain, /创建草稿文章 POST 201 2026-08-13/u);
  assert.match(plain, /api\.example\.com\/v1\/posts/u);
  assert.match(plain, /Accept application\/json/u);
  assert.match(plain, /HTTP 交换台账/u);
  assert.match(plain, /Status and schema PASS/u);
  assert.doesNotMatch(plain, /\[!http\]|REQUEST HEADERS|RESPONSE BODY|VERIFICATION/u);
});

test("wires one HTTP exchange contract into reading, Studio, search, mobile, and print", async () => {
  const [pipeline, search, markdownContent, richStyles, previewStyles, previewRuntime] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/search-index.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/MarkdownContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(pipeline, /rehypeMarkdownHttpExchanges/u);
  assert.match(search, /normalizeMarkdownHttpExchangesForPlainText/u);
  assert.match(markdownContent, /markdown-http-pre/u);
  assert.match(previewRuntime, /httpExchangeBodyLineCount/u);
  assert.match(previewRuntime, /hasPotentialStudioHttpExchange/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-http\s*\{/u);
    assert.match(styles, /\.markdown-http-transit/u);
    assert.match(styles, /@media print[\s\S]*\.markdown-http/u);
    assert.match(styles, /@media \(max-width: 42rem\)[\s\S]*\.markdown-http/u);
  }
});
