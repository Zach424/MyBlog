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
  extractMarkdownTimelines,
  getMarkdownTimelineIssue,
  MARKDOWN_TIMELINE_MAX_COUNT,
  MARKDOWN_TIMELINE_MAX_TOTAL_EVENTS,
  rehypeMarkdownTimelines,
} from "../lib/markdown-timeline.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const timeline = `> [!timeline] MyBlog 交付里程碑
> - \`2026-07-19\` \`START\` **建立内容契约**
>
>   用 Markdown、YAML 与 **Zod** 冻结第一版内容边界。
> - \`2026-08-02\` \`DECISION\` **统一作者入口**
>
>   选择 [Studio](/studio) 与 \`Obsidian\` 共享发布契约。
> - \`2026-08-12\` \`VERIFY\` **通过生产验证**
>
>   完成自动化、移动端与打印验证。`;

function render(markdown) {
  return String(
    unified().use(remarkParse).use(remarkGfm).use(remarkRehype)
      .use(rehypeMarkdownTimelines).use(rehypeStringify).processSync(markdown),
  );
}

function timelineOf(index, count = 2) {
  return [
    `> [!timeline] 时间线 ${index}`,
    ...Array.from({ length: count }, (_, eventIndex) => {
      const day = String(eventIndex + 1).padStart(2, "0");
      return `> - \`2026-07-${day}\` \`CHANGE\` **事件 ${index}-${eventIndex + 1}**\n>\n>   已完成的历史事件 ${eventIndex + 1}。`;
    }),
  ].join("\n");
}

test("renders a portable project timeline as a semantic release tape", () => {
  const html = render(timeline);
  assert.match(html, /data-timeline="release-tape"/u);
  assert.match(html, /data-event-count="3"/u);
  assert.match(html, /HISTORY \/ 03 EVENTS/u);
  assert.match(html, /2026-07-19 → 2026-08-12/u);
  assert.equal((html.match(/class="markdown-timeline-event"/gu) ?? []).length, 3);
  assert.match(html, /<time class="markdown-timeline-date" datetime="2026-08-02">/u);
  assert.match(html, /data-event-type="decision"/u);
  assert.match(html, /<strong class="markdown-timeline-event-title">统一作者入口<\/strong>/u);
  assert.doesNotMatch(html, /button|input|details|contenteditable|onclick=/iu);
});

test("extracts stable dates, types, titles, descriptions, and source lines", () => {
  assert.deepEqual(extractMarkdownTimelines(timeline), [{
    events: [
      { date: "2026-07-19", description: "用 Markdown、YAML 与 Zod 冻结第一版内容边界。", line: 2, title: "建立内容契约", type: "START" },
      { date: "2026-08-02", description: "选择 Studio 与 Obsidian 共享发布契约。", line: 5, title: "统一作者入口", type: "DECISION" },
      { date: "2026-08-12", description: "完成自动化、移动端与打印验证。", line: 8, title: "通过生产验证", type: "VERIFY" },
    ],
    line: 1,
    title: "MyBlog 交付里程碑",
  }]);
});

test("rejects malformed, ambiguous, future, and over-budget timelines", () => {
  const validTail = `> - \`2026-08-12\` \`VERIFY\` **完成验证**\n>\n>   已完成生产验证。`;
  const invalid = [
    [`> [!timeline]+ 折叠\n> - \`2026-08-01\` \`START\` **开始**\n>\n>   已经开始。\n${validTail}`, /静态|折叠/u],
    [`> [!timeline]\n> - \`2026-08-01\` \`START\` **开始**\n>\n>   已经开始。\n${validTail}`, /标题/u],
    ["> [!timeline] 太短\n> - `2026-08-01` `START` **开始**\n>\n>   已经开始。", /2–16/u],
    [`> [!timeline] 有序\n> 1. \`2026-08-01\` \`START\` **开始**\n>\n>    已经开始。\n> 2. \`2026-08-12\` \`VERIFY\` **验证**\n>\n>    已经验证。`, /无序列表/u],
    [`> [!timeline] 非法日期\n> - \`2026-02-30\` \`START\` **开始**\n>\n>   已经开始。\n${validTail}`, /真实的 YYYY-MM-DD/u],
    [`> [!timeline] 非法类型\n> - \`2026-08-01\` \`PLAN\` **开始**\n>\n>   已经开始。\n${validTail}`, /类型只允许/u],
    [`> [!timeline] 倒序\n${validTail}\n> - \`2026-08-01\` \`START\` **开始**\n>\n>   已经开始。`, /从早到晚/u],
    [`> [!timeline] 重复\n> - \`2026-08-01\` \`START\` **Ａ**\n>\n>   第一次。\n> - \`2026-08-01\` \`CHANGE\` **a**\n>\n>   第二次。`, /重复里程碑/u],
    [`> [!timeline] 图片\n> - \`2026-08-01\` \`START\` **开始**\n>\n>   ![图片](/uploads/x.png)\n${validTail}`, /图片.*时间线外/u],
    [`- 外层\n  > [!timeline] 嵌套\n  > - \`2026-08-01\` \`START\` **开始**\n  >\n  >   已经开始。\n  > - \`2026-08-12\` \`VERIFY\` **验证**\n  >\n  >   已经验证。`, /顶层区块/u],
  ];
  for (const [source, expected] of invalid) {
    const issue = getMarkdownTimelineIssue(source);
    assert.equal(issue?.kind, "timeline");
    assert.match(issue?.message ?? "", expected);
  }
  assert.match(getMarkdownTimelineIssue(timeline, { maximumDate: "2026-08-11" })?.message ?? "", /只记录已发生事件/u);
  const tooMany = Array.from({ length: MARKDOWN_TIMELINE_MAX_COUNT + 1 }, (_, index) => timelineOf(index + 1)).join("\n\n");
  assert.match(getMarkdownTimelineIssue(tooMany)?.message ?? "", /最多允许 3 个/u);
  const tooManyEvents = Array.from({ length: 3 }, (_, index) => timelineOf(index + 1, Math.floor(MARKDOWN_TIMELINE_MAX_TOTAL_EVENTS / 3) + 1)).join("\n\n");
  assert.match(getMarkdownTimelineIssue(tooManyEvents)?.message ?? "", /合计最多允许 32 个/u);
});

test("keeps dates, titles, and descriptions searchable without marker or type noise", () => {
  const plainText = markdownToPlainText(timeline);
  assert.match(plainText, /MyBlog 交付里程碑 2026-07-19 建立内容契约.*2026-08-02 统一作者入口.*2026-08-12 通过生产验证/u);
  assert.doesNotMatch(plainText, /\[!timeline\]|START|DECISION|VERIFY|HISTORY/u);
});

test("makes the same timeline contract authoritative for Studio preflight", () => {
  const fields = { body: timeline, description: "验证时间线进入统一内容契约。", draft: true,
    featured: false, freshness: "historical", publishedAt: "2026-08-12",
    reviewedAt: "2026-08-12", slug: "timeline-contract", tags: ["Project Management"],
    title: "时间线内容契约", type: "article" };
  assert.equal(inspectContentDraft("post", fields, "2026-08-12").ok, true);
  const invalid = inspectContentDraft("post", {
    ...fields,
    body: timeline.replace("2026-08-12", "2026-08-13"),
  }, "2026-08-12");
  assert.equal(invalid.ok, false);
  assert.match(invalid.issues[0]?.message ?? "", /只记录已发生事件/u);
});

test("wires one timeline contract into reading, Studio, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);
  assert.match(pipeline, /rehypeMarkdownTimelines/u);
  assert.match(previewRuntime, /timelineEventCount/u);
  assert.match(previewRuntime, /hasPotentialStudioTimeline/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-timeline\s*\{/u);
    assert.match(styles, /\.markdown-timeline-date/u);
    assert.match(styles, /\.markdown-timeline-event\[data-event-type="ship"\]/u);
  }
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-timeline-event/u);
  assert.match(richStyles, /@media \(max-width: 32rem\)[\s\S]*?\.markdown-timeline-event[\s\S]*?grid-template-columns/u);
});
