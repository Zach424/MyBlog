import assert from "node:assert/strict";
import test from "node:test";
import {
  createSearchTextSegments,
  searchDocuments,
} from "../lib/search.ts";
import {
  createSearchDocuments,
  markdownToPlainText,
} from "../lib/search-index.ts";

const documents = [
  {
    kind: "article",
    title: "Cloudflare 部署边界",
    description: "验证 Worker 构建与域名元数据。",
    publishedAt: "2026-07-18",
    freshness: "historical",
    reviewedAt: "2026-08-04",
    tags: ["Cloudflare", "TypeScript"],
    url: "/posts/cloudflare-boundary",
    body: "先定义运行时边界，再处理构建输出。",
  },
  {
    kind: "til",
    title: "Windows npm scripts",
    description: "消除 shell 假设。",
    publishedAt: "2026-07-17",
    freshness: "historical",
    reviewedAt: "2026-08-04",
    tags: ["Tooling"],
    url: "/posts/windows-scripts",
    body: "在 Windows 上统一开发命令，并验证 Cloudflare 构建。",
  },
  {
    kind: "project",
    title: "MyBlog",
    description: "个人技术博客项目复盘。",
    publishedAt: "2026-07-16",
    freshness: "current",
    reviewedAt: "2026-08-04",
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

test("keeps footnote evidence searchable without leaking authoring markers", () => {
  const source = `判断[^当前架构]，再次引用[^当前架构]。

[^当前架构]: 证据见 [项目复盘](/projects/myblog)，并包含 \`main\`。`;

  assert.equal(
    markdownToPlainText(source),
    "判断，再次引用。 证据见 项目复盘，并包含 main。",
  );
});

test("keeps audio title, summary, and full transcript searchable without authoring markers", () => {
  const source = [
    "> [!audio] 发布复盘口述",
    '> [下载 MP3](/uploads/demo/release-retro.mp3 "发布复盘口述")',
    "> 总结发布检查、上线确认与复盘结论。",
    ">",
    "> **文字稿**",
    "> 先运行完整检查，再确认生产冒烟通过。",
  ].join("\n");

  const plain = markdownToPlainText(source);
  assert.match(plain, /发布复盘口述.*总结发布检查.*文字稿.*生产冒烟通过/u);
  assert.doesNotMatch(plain, /\[!audio\]|下载 MP3|\/uploads\//u);
});

test("preserves update dates in search documents without changing publication order", () => {
  const records = [
    {
      body: "旧内容后来发生了重要更新。",
      description: "首发较早但更新较晚。",
      kind: "post",
      publishedAt: "2026-07-01",
      updatedAt: "2026-09-01",
      tags: ["TypeScript"],
      title: "旧文章新更新",
      type: "article",
      url: "/posts/older-updated",
    },
    {
      body: "首发时间较新。",
      description: "没有后续更新。",
      kind: "post",
      publishedAt: "2026-08-01",
      tags: ["TypeScript"],
      title: "较新文章",
      type: "article",
      url: "/posts/newer-published",
    },
  ];

  const indexed = createSearchDocuments(records);

  assert.deepEqual(
    indexed.map(({ publishedAt, updatedAt, url }) => ({
      publishedAt,
      updatedAt,
      url,
    })),
    [
      {
        publishedAt: "2026-08-01",
        updatedAt: undefined,
        url: "/posts/newer-published",
      },
      {
        publishedAt: "2026-07-01",
        updatedAt: "2026-09-01",
        url: "/posts/older-updated",
      },
    ],
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
  assert.equal(results[0].excerptSource, "摘要");
  assert.equal(results[1].excerptSource, "正文");
});

test("uses AND semantics, NFKC normalization and useful empty states", () => {
  assert.deepEqual(
    searchDocuments(documents, "内容 搜索").map((result) => result.document.url),
    ["/projects/myblog"],
  );
  assert.equal(searchDocuments(documents, "ＣＬＯＵＤＦＬＡＲＥ").length, 2);
  assert.equal(searchDocuments(documents, "不存在").length, 0);
  const unfiltered = searchDocuments(documents, "");
  assert.equal(unfiltered.length, documents.length);
  assert.ok(unfiltered.every((result) => result.reason === "首发顺序"));
});

test("selects the evidence field that proves the most query terms", () => {
  const [result] = searchDocuments(
    [
      {
        ...documents[2],
        description: "内容契约包含搜索证据。",
        body: "正文只提到搜索。",
      },
    ],
    "内容 搜索",
  );

  assert.equal(result.excerpt, "内容契约包含搜索证据。");
  assert.equal(result.excerptSource, "摘要");
  assert.equal(result.reason, "匹配摘要、正文");
});

test("segments normalized matches without changing authored text", () => {
  assert.deepEqual(
    createSearchTextSegments(
      "Cloudflare 与 cloudflare",
      "ＣＬＯＵＤＦＬＡＲＥ",
    ),
    [
      { text: "Cloudflare", matched: true },
      { text: " 与 ", matched: false },
      { text: "cloudflare", matched: true },
    ],
  );
  assert.deepEqual(
    createSearchTextSegments("Café / ﬁle", "Cafe\u0301 fi"),
    [
      { text: "Café", matched: true },
      { text: " / ", matched: false },
      { text: "ﬁ", matched: true },
      { text: "le", matched: false },
    ],
  );

  const authored = "<script>alert(1)</script>";
  const segments = createSearchTextSegments(authored, "<script>");
  assert.equal(segments.map((segment) => segment.text).join(""), authored);
  assert.deepEqual(segments[0], { text: "<script>", matched: true });
  assert.deepEqual(createSearchTextSegments(authored, ""), [
    { text: authored, matched: false },
  ]);
});
