import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { inspectContentDraft } from "../lib/content/contract.ts";
import {
  extractMarkdownFileTrees,
  getMarkdownFileTreeIssue,
  MARKDOWN_FILETREE_MAX_COUNT,
  MARKDOWN_FILETREE_MAX_TOTAL_NODES,
  rehypeMarkdownFileTrees,
} from "../lib/markdown-filetree.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const fileTree = `> [!filetree] MyBlog 核心结构
> - \`app/\` — 页面、布局与同源路由。
>   - \`studio/\` — Git-backed 发布后台。
>     - \`page.tsx\` — 后台静态入口。
> - \`lib/\` — 共享内容解析与渲染。
> - \`package.json\` — 脚本、依赖与**质量门**。`;

function render(markdown) {
  return String(
    unified().use(remarkParse).use(remarkGfm).use(remarkRehype)
      .use(rehypeMarkdownFileTrees).use(rehypeStringify).processSync(markdown),
  );
}

test("renders a portable project file tree as a repository slice", () => {
  const html = render(fileTree);
  assert.match(html, /data-filetree="repository-slice"/u);
  assert.match(html, /data-node-count="5"/u);
  assert.match(html, /data-max-depth="3"/u);
  assert.match(html, /FILE MAP \/ 05 NODES/u);
  assert.match(html, /DEPTH · 03 MAX/u);
  assert.equal((html.match(/class="markdown-filetree-node"/gu) ?? []).length, 5);
  assert.equal((html.match(/data-kind="folder"/gu) ?? []).length, 3);
  assert.match(html, /<ul class="markdown-filetree-children"/u);
  assert.match(html, /<code class="markdown-filetree-name">page\.tsx<\/code>/u);
  assert.doesNotMatch(html, /button|input|details|contenteditable|onclick=/iu);
});

test("extracts stable complete paths, kinds, depths, descriptions, and source lines", () => {
  assert.deepEqual(extractMarkdownFileTrees(fileTree), [{
    line: 1,
    maxDepth: 3,
    nodes: [
      { depth: 1, description: "页面、布局与同源路由。", kind: "folder", line: 2, name: "app", path: "app/" },
      { depth: 2, description: "Git-backed 发布后台。", kind: "folder", line: 3, name: "studio", path: "app/studio/" },
      { depth: 3, description: "后台静态入口。", kind: "file", line: 4, name: "page.tsx", path: "app/studio/page.tsx" },
      { depth: 1, description: "共享内容解析与渲染。", kind: "folder", line: 5, name: "lib", path: "lib/" },
      { depth: 1, description: "脚本、依赖与质量门。", kind: "file", line: 6, name: "package.json", path: "package.json" },
    ],
    title: "MyBlog 核心结构",
  }]);
});

test("rejects malformed, ambiguous, and over-budget file trees", () => {
  const validTail = "> - `README.md` — 项目入口说明。";
  const invalid = [
    [`> [!filetree]+ 折叠\n> - \`app/\` — 页面。\n${validTail}`, /静态|折叠/u],
    [`> [!filetree]\n> - \`app/\` — 页面。\n${validTail}`, /标题/u],
    ["> [!filetree] 太短\n> - `app/` — 页面。", /2–32/u],
    [`> [!filetree] 有序\n> 1. \`app/\` — 页面。\n> 2. \`README.md\` — 说明。`, /无序列表/u],
    [`> [!filetree] 缺代码\n> - app/ — 页面。\n${validTail}`, /路径段/u],
    [`> [!filetree] 路径越界\n> - \`../\` — 上级。\n${validTail}`, /安全路径段/u],
    [`> [!filetree] 文件有子节点\n> - \`app.ts\` — 文件。\n>   - \`child.ts\` — 子文件。\n${validTail}`, /不能拥有子节点/u],
    [`> [!filetree] 重复\n> - \`ＡＰＰ/\` — 目录。\n> - \`app/\` — 重复。`, /完整路径.*不能重复/u],
    [`> [!filetree] 图片\n> - \`app/\` — ![图](/uploads/x.png)\n${validTail}`, /图片.*文件树外/u],
  ];
  for (const [source, expected] of invalid) {
    const issue = getMarkdownFileTreeIssue(source);
    assert.equal(issue?.kind, "filetree");
    assert.match(issue?.message ?? "", expected);
  }
  const treeOf = (index, count = 2) => [
    `> [!filetree] 树 ${index}`,
    ...Array.from({ length: count }, (_, node) =>
      `> - \`node-${index}-${node + 1}.ts\` — 节点 ${node + 1}。`),
  ].join("\n");
  const tooMany = Array.from({ length: MARKDOWN_FILETREE_MAX_COUNT + 1 }, (_, index) => treeOf(index + 1)).join("\n\n");
  assert.match(getMarkdownFileTreeIssue(tooMany)?.message ?? "", /最多允许.*文件树/u);
  const tooManyNodes = Array.from({ length: 3 }, (_, index) =>
    treeOf(index + 1, Math.floor(MARKDOWN_FILETREE_MAX_TOTAL_NODES / 3) + 1)).join("\n\n");
  assert.match(getMarkdownFileTreeIssue(tooManyNodes)?.message ?? "", /合计最多/u);
});

test("keeps file names and responsibilities searchable without marker noise", () => {
  const plainText = markdownToPlainText(fileTree);
  assert.match(plainText, /MyBlog 核心结构 app 页面.*studio Git-backed.*page\.tsx 后台静态入口.*package\.json 脚本/u);
  assert.doesNotMatch(plainText, /\[!filetree\]|FILE MAP|DEPTH ·|ROOT|BR/u);
});

test("makes the same file-tree contract authoritative for Studio preflight", () => {
  const fields = { body: fileTree, description: "验证文件树进入统一内容契约。", draft: true,
    featured: false, freshness: "historical", publishedAt: "2026-08-12",
    reviewedAt: "2026-08-12", slug: "filetree-contract", tags: ["Project Management"],
    title: "文件树内容契约", type: "article" };
  assert.equal(inspectContentDraft("post", fields, "2026-08-12").ok, true);
  const invalid = inspectContentDraft("post", {
    ...fields, body: "> [!filetree] 只有一个\n> - `app/` — 页面。",
  }, "2026-08-12");
  assert.equal(invalid.ok, false);
  assert.match(invalid.issues[0]?.message ?? "", /项目文件树/u);
});

test("wires one file-tree contract into reading, Studio, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);
  assert.match(pipeline, /rehypeMarkdownFileTrees/u);
  assert.match(previewRuntime, /fileTreeNodeCount/u);
  assert.match(previewRuntime, /hasPotentialStudioFileTree/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-filetree\s*\{/u);
    assert.match(styles, /\.markdown-filetree-children/u);
    assert.match(styles, /\.markdown-filetree-node\[data-kind="folder"\]/u);
  }
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-filetree-row/u);
  assert.match(richStyles, /@media \(max-width: 32rem\)[\s\S]*?\.markdown-filetree-row[\s\S]*?grid-template-columns/u);
});
