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
  extractMarkdownTaskLists,
  getMarkdownTaskListIssue,
  MARKDOWN_TASK_LIST_MAX_COUNT,
  MARKDOWN_TASK_LIST_MAX_TOTAL_ITEMS,
  rehypeMarkdownTaskLists,
} from "../lib/markdown-task-list.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const taskList = `> [!tasks] 发布准备
> - [x] 冻结内容契约
> - [ ] 完成 **真实主题** 验收
> - [X] 发布 \`main\``;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownTaskLists)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("renders a titled portable GFM task list as a read-only progress ledger", () => {
  const html = render(taskList);

  assert.match(html, /class="markdown-task-ledger"/u);
  assert.match(html, /data-task-list="readonly-ledger"/u);
  assert.match(html, /data-task-complete="2"/u);
  assert.match(html, /TASK LEDGER \/ 03 ITEMS/u);
  assert.match(html, /02 DONE · 01 OPEN/u);
  assert.match(html, /<progress[^>]*max="3"[^>]*value="2"/u);
  assert.equal((html.match(/type="checkbox"/gu) ?? []).length, 3);
  assert.equal((html.match(/disabled/gu) ?? []).length, 3);
  assert.match(html, /aria-label="已完成：冻结内容契约"/u);
  assert.doesNotMatch(html, /<script|button|contenteditable|onclick=/iu);
});

test("extracts task order, state, counts, title, and source line", () => {
  assert.deepEqual(extractMarkdownTaskLists(taskList), [
    {
      completeCount: 2,
      items: [
        { completed: true, text: "冻结内容契约" },
        { completed: false, text: "完成 真实主题 验收" },
        { completed: true, text: "发布 main" },
      ],
      line: 1,
      pendingCount: 1,
      title: "发布准备",
    },
  ]);
});

test("rejects bare, folded, untitled, short, nested, duplicate, media, and over-budget task lists", () => {
  const invalid = [
    ["- [x] 已完成\n- [ ] 待完成", /必须放入.*\[!tasks\]|无标题/u],
    ["> [!tasks]+ 折叠\n> - [x] 已完成\n> - [ ] 待完成", /静态|不能折叠/u],
    ["> [!tasks]\n> - [x] 已完成\n> - [ ] 待完成", /标题/u],
    ["> [!tasks] 太短\n> - [ ] 只有一项", /2–20/u],
    [
      "> [!tasks] 松散列表\n> - [x] 已完成\n>\n> - [ ] 待完成",
      /紧跟|不能混入|单段/u,
    ],
    [
      "> [!tasks] 嵌套\n> - [ ] 父任务\n>   - [ ] 子任务\n> - [ ] 下一项",
      /不能嵌套|单段/u,
    ],
    [
      "> [!tasks] 重复\n> - [x] 发布 MAIN\n> - [ ] 发布 main",
      /不能包含重复/u,
    ],
    [
      "> [!tasks] 图片越界\n> - [x] 已完成\n> - [ ] ![截图](/uploads/demo/x.png)",
      /图片.*清单外/u,
    ],
  ];

  for (const [source, expected] of invalid) {
    const issue = getMarkdownTaskListIssue(source);
    assert.equal(issue?.kind, "task-list");
    assert.match(issue?.message ?? "", expected);
  }

  const listOf = (index, items = 2) => [
    `> [!tasks] 清单 ${index}`,
    ...Array.from(
      { length: items },
      (_, item) => `> - [${item % 2 === 0 ? "x" : " "}] 任务 ${index}-${item + 1}`,
    ),
  ].join("\n");
  const tooMany = Array.from(
    { length: MARKDOWN_TASK_LIST_MAX_COUNT + 1 },
    (_, index) => listOf(index + 1),
  ).join("\n\n");
  assert.match(getMarkdownTaskListIssue(tooMany)?.message ?? "", /最多允许.*任务清单/u);

  const tooManyItems = Array.from(
    { length: 3 },
    (_, index) => listOf(index + 1, Math.floor(MARKDOWN_TASK_LIST_MAX_TOTAL_ITEMS / 3) + 1),
  ).join("\n\n");
  assert.match(getMarkdownTaskListIssue(tooManyItems)?.message ?? "", /合计最多/u);
});

test("keeps task titles and copy searchable without authoring marker noise", () => {
  const plainText = markdownToPlainText(taskList);
  assert.match(plainText, /发布准备 冻结内容契约 完成 真实主题 验收 发布 main/u);
  assert.doesNotMatch(plainText, /\[!tasks\]|TASK LEDGER|DONE|OPEN/u);
});

test("makes the same task-list contract authoritative for Studio preflight", () => {
  const fields = {
    body: taskList,
    description: "验证任务清单进入统一内容契约。",
    draft: true,
    featured: false,
    freshness: "historical",
    publishedAt: "2026-08-12",
    reviewedAt: "2026-08-12",
    slug: "task-list-contract",
    tags: ["Project Management"],
    title: "任务清单契约",
    type: "article",
  };
  assert.equal(inspectContentDraft("post", fields, "2026-08-12").ok, true);
  const invalid = inspectContentDraft(
    "post",
    { ...fields, body: "- [x] 已完成\n- [ ] 待完成" },
    "2026-08-12",
  );
  assert.equal(invalid.ok, false);
  assert.match(invalid.issues[0]?.message ?? "", /\[!tasks\]|任务清单/u);
});

test("wires one task contract into reading, Studio, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);

  assert.match(pipeline, /rehypeMarkdownTaskLists/u);
  assert.match(previewRuntime, /taskCompleteCount/u);
  assert.match(previewRuntime, /hasPotentialStudioTaskList/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-task-ledger\s*\{/u);
    assert.match(styles, /\.markdown-task-progress/u);
    assert.match(styles, /\.markdown-task-input/u);
  }
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-task-ledger/u);
  assert.match(
    richStyles,
    /@media \(max-width: 32rem\)[\s\S]*?\.markdown-task-item[\s\S]*?grid-template-columns/u,
  );
});
