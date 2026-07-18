import assert from "node:assert/strict";
import test from "node:test";
import {
  markdownToPlainText,
  searchDocuments,
} from "../lib/search.ts";

const documents = [
  {
    kind: "article",
    title: "Cloudflare 部署边界",
    description: "验证 Worker 构建与域名元数据。",
    publishedAt: "2026-07-18",
    tags: ["Cloudflare", "TypeScript"],
    url: "/posts/cloudflare-boundary",
    body: "先定义运行时边界，再处理构建输出。",
  },
  {
    kind: "til",
    title: "Windows npm scripts",
    description: "消除 shell 假设。",
    publishedAt: "2026-07-17",
    tags: ["Tooling"],
    url: "/posts/windows-scripts",
    body: "在 Windows 上统一开发命令，并验证 Cloudflare 构建。",
  },
  {
    kind: "project",
    title: "MyBlog",
    description: "个人技术博客项目复盘。",
    publishedAt: "2026-07-16",
    tags: ["Personal Knowledge"],
    url: "/projects/myblog",
    body: "内容契约、搜索与发布路径。",
  },
];

test("converts common Markdown syntax into searchable plain text", () => {
  const source = `## 内容契约

[稳定 URL](https://example.com) 与 **构建校验**。

\`\`\`ts
const worker = true;
\`\`\``;

  assert.equal(
    markdownToPlainText(source),
    "内容契约 稳定 URL 与 构建校验。 const worker = true;",
  );
});

test("ranks title and tag matches above body-only matches", () => {
  const results = searchDocuments(documents, "cloudflare");

  assert.deepEqual(
    results.map((result) => result.document.url),
    ["/posts/cloudflare-boundary", "/posts/windows-scripts"],
  );
  assert.match(results[0].reason, /标题/);
  assert.match(results[0].reason, /标签/);
});

test("uses AND semantics, NFKC normalization and useful empty states", () => {
  assert.deepEqual(
    searchDocuments(documents, "内容 搜索").map((result) => result.document.url),
    ["/projects/myblog"],
  );
  assert.equal(searchDocuments(documents, "ＣＬＯＵＤＦＬＡＲＥ").length, 2);
  assert.equal(searchDocuments(documents, "不存在").length, 0);
  assert.equal(searchDocuments(documents, "").length, documents.length);
});
