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
  extractMarkdownSteps,
  getMarkdownStepsIssue,
  MARKDOWN_STEPS_MAX_COUNT,
  MARKDOWN_STEPS_MAX_TOTAL_ITEMS,
  rehypeMarkdownSteps,
} from "../lib/markdown-steps.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const steps = `> [!steps] 发布流程
> 1. **运行完整检查**
>
>    执行 \`npm run release:check\`，处理全部失败项。
>
>    **验证：** 命令以退出码 0 完成。
> 2. **推送主分支**
>
>    将已审阅提交推送到 \`main\`。`;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownSteps)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("renders a portable ordered procedure as a static runbook path", () => {
  const html = render(steps);

  assert.match(html, /class="markdown-procedure"/u);
  assert.match(html, /data-procedure="runbook-path"/u);
  assert.match(html, /data-step-count="2"/u);
  assert.match(html, /PROCEDURE \/ 02 STEPS/u);
  assert.match(html, /ORDERED · STATIC/u);
  assert.match(html, /class="markdown-procedure-index">01/u);
  assert.match(html, /class="markdown-procedure-step-name">运行完整检查/u);
  assert.match(html, /class="markdown-procedure-check-label">CHECK/u);
  assert.match(html, /命令以退出码 0 完成/u);
  assert.doesNotMatch(html, /input|button|contenteditable|onclick=/iu);
});

test("extracts ordered names, instructions, optional verification, and source lines", () => {
  assert.deepEqual(extractMarkdownSteps(steps), [
    {
      items: [
        {
          instruction: "执行 npm run release:check，处理全部失败项。",
          line: 2,
          name: "运行完整检查",
          verification: "命令以退出码 0 完成。",
        },
        {
          instruction: "将已审阅提交推送到 main。",
          line: 7,
          name: "推送主分支",
        },
      ],
      line: 1,
      title: "发布流程",
    },
  ]);
});

test("rejects folded, untitled, short, wrong-start, flat, nested, duplicate, media, and over-budget procedures", () => {
  const validTail = `> 2. **推送主分支**
>
>    推送已审阅提交。`;
  const invalid = [
    [`> [!steps]+ 折叠\n> 1. **检查**\n>\n>    运行检查。\n${validTail}`, /静态|不能折叠/u],
    [`> [!steps]\n> 1. **检查**\n>\n>    运行检查。\n${validTail}`, /标题/u],
    ["> [!steps] 太短\n> 1. **检查**\n>\n>    运行检查。", /2–10/u],
    [`> [!steps] 起点错误\n> 3. **检查**\n>\n>    运行检查。\n> 4. **推送**\n>\n>    推送提交。`, /从 1 开始/u],
    [`> [!steps] 扁平\n> 1. **检查** — 运行检查。\n> 2. **推送** — 推送提交。`, /两到三段|粗体步骤名/u],
    [`> [!steps] 嵌套\n> 1. **检查**\n>\n>    运行检查。\n>\n>    - 子步骤\n> 2. **推送**\n>\n>    推送提交。`, /不能使用.*嵌套列表|两到三段/u],
    [`> [!steps] 重复\n> 1. **发布 MAIN**\n>\n>    运行检查。\n> 2. **发布 main**\n>\n>    推送提交。`, /不能包含重复/u],
    [`> [!steps] 图片\n> 1. **检查**\n>\n>    ![截图](/uploads/demo/a.png)\n> 2. **推送**\n>\n>    推送提交。`, /图片.*流程外/u],
    [`> [!steps] 验证格式\n> 1. **检查**\n>\n>    运行检查。\n>\n>    **结果：** 通过。\n> 2. **推送**\n>\n>    推送提交。`, /验证条件|验证：/u],
  ];

  for (const [source, expected] of invalid) {
    const issue = getMarkdownStepsIssue(source);
    assert.equal(issue?.kind, "steps");
    assert.match(issue?.message ?? "", expected);
  }

  const procedureOf = (index, itemCount = 2) => [
    `> [!steps] 流程 ${index}`,
    ...Array.from({ length: itemCount }, (_, item) => [
      `> ${item + 1}. **步骤 ${index}-${item + 1}**`,
      ">",
      `>    执行操作 ${index}-${item + 1}。`,
    ].join("\n")),
  ].join("\n");
  const tooMany = Array.from(
    { length: MARKDOWN_STEPS_MAX_COUNT + 1 },
    (_, index) => procedureOf(index + 1),
  ).join("\n\n");
  assert.match(getMarkdownStepsIssue(tooMany)?.message ?? "", /最多允许.*步骤流程/u);

  const tooManyItems = Array.from(
    { length: 3 },
    (_, index) => procedureOf(index + 1, Math.floor(MARKDOWN_STEPS_MAX_TOTAL_ITEMS / 3) + 1),
  ).join("\n\n");
  assert.match(getMarkdownStepsIssue(tooManyItems)?.message ?? "", /合计最多/u);
});

test("keeps procedure meaning searchable without marker or verification-label noise", () => {
  const plainText = markdownToPlainText(steps);
  assert.match(
    plainText,
    /发布流程 运行完整检查 执行 npm run release:check，处理全部失败项。 命令以退出码 0 完成。 推送主分支/u,
  );
  assert.doesNotMatch(plainText, /\[!steps\]|验证：|PROCEDURE|CHECK/u);
});

test("makes the same procedure contract authoritative for Studio preflight", () => {
  const fields = {
    body: steps,
    description: "验证步骤流程进入统一内容契约。",
    draft: true,
    featured: false,
    freshness: "historical",
    publishedAt: "2026-08-12",
    reviewedAt: "2026-08-12",
    slug: "procedure-contract",
    tags: ["Project Management"],
    title: "步骤流程契约",
    type: "article",
  };
  assert.equal(inspectContentDraft("post", fields, "2026-08-12").ok, true);
  const invalid = inspectContentDraft(
    "post",
    { ...fields, body: "> [!steps] 只有一步\n> 1. **检查**\n>\n>    运行检查。" },
    "2026-08-12",
  );
  assert.equal(invalid.ok, false);
  assert.match(invalid.issues[0]?.message ?? "", /步骤流程/u);
});

test("wires one procedure contract into reading, Studio, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);

  assert.match(pipeline, /rehypeMarkdownSteps/u);
  assert.match(previewRuntime, /procedureStepCount/u);
  assert.match(previewRuntime, /hasPotentialStudioSteps/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-procedure\s*\{/u);
    assert.match(styles, /\.markdown-procedure-step/u);
    assert.match(styles, /\.markdown-procedure-check/u);
  }
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-procedure/u);
  assert.match(
    richStyles,
    /@media \(max-width: 32rem\)[\s\S]*?\.markdown-procedure-step[\s\S]*?grid-template-columns/u,
  );
});
