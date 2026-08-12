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
  extractMarkdownFaqs,
  getMarkdownFaqIssue,
  MARKDOWN_FAQ_MAX_COUNT,
  MARKDOWN_FAQ_MAX_TOTAL_ITEMS,
  rehypeMarkdownFaqs,
} from "../lib/markdown-faq.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const faq = `> [!faq] 发布常见问题
> - **应该使用 Studio 还是 Obsidian？**
>
>   Studio 适合浏览器内结构化编辑；Obsidian 适合本地知识库写作。
>
>   两者最终发布同一份 **Markdown**，并通过 \`release:check\`。
> - **FAQ 会保存读者的展开状态吗？**
>
>   不会。展开只存在于当前页面，不写回 Git，也不会跨访问保存。`;

function render(markdown) {
  return String(
    unified().use(remarkParse).use(remarkGfm).use(remarkRehype)
      .use(rehypeMarkdownFaqs).use(rehypeStringify).processSync(markdown),
  );
}

test("renders a portable FAQ as a native answer cabinet", () => {
  const html = render(faq);
  assert.match(html, /data-faq="answer-cabinet"/u);
  assert.match(html, /data-question-count="2"/u);
  assert.match(html, /FAQ \/ 02 QUESTIONS/u);
  assert.match(html, /ANSWERS · NATIVE/u);
  assert.equal((html.match(/<details/gu) ?? []).length, 2);
  assert.equal((html.match(/<summary/gu) ?? []).length, 2);
  assert.match(html, /<details class="markdown-faq-entry" open>/u);
  assert.match(html, /class="markdown-faq-answer-copy"/u);
  assert.doesNotMatch(html, /button|input|contenteditable|onclick=/iu);
});

test("extracts questions, answer paragraphs, and source lines", () => {
  assert.deepEqual(extractMarkdownFaqs(faq), [{
    items: [{
      answers: [
        "Studio 适合浏览器内结构化编辑；Obsidian 适合本地知识库写作。",
        "两者最终发布同一份 Markdown，并通过 release:check。",
      ],
      line: 2,
      question: "应该使用 Studio 还是 Obsidian？",
    }, {
      answers: ["不会。展开只存在于当前页面，不写回 Git，也不会跨访问保存。"],
      line: 7,
      question: "FAQ 会保存读者的展开状态吗？",
    }],
    line: 1,
    title: "发布常见问题",
  }]);
});

test("rejects malformed and over-budget FAQs", () => {
  const tail = `> - **第二个问题？**\n>\n>   第二个答案。`;
  const invalid = [
    [`> [!faq]+ 折叠\n> - **第一个问题？**\n>\n>   第一个答案。\n${tail}`, /静态|折叠/u],
    [`> [!faq]\n> - **第一个问题？**\n>\n>   第一个答案。\n${tail}`, /标题/u],
    ["> [!faq] 太短\n> - **第一个问题？**\n>\n>   第一个答案。", /2–10/u],
    [`> [!faq] 有序错误\n> 1. **第一个问题？**\n>\n>    第一个答案。\n> 2. **第二个问题？**\n>\n>    第二个答案。`, /无序列表/u],
    [`> [!faq] 扁平\n> - **第一个问题？** 第一个答案。\n${tail}`, /粗体问题|1–3/u],
    [`> [!faq] 嵌套\n> - **第一个问题？**\n>\n>   第一个答案。\n>\n>   - 子答案\n${tail}`, /嵌套列表|额外段落/u],
    [`> [!faq] 重复\n> - **应该使用 Studio 吗？**\n>\n>   是。\n> - **应该使用 Ｓｔｕｄｉｏ 吗？**\n>\n>   仍然是。`, /问题不能重复/u],
    [`> [!faq] 图片\n> - **第一个问题？**\n>\n>   ![图](/uploads/demo/a.png)\n${tail}`, /图片.*问答块外/u],
  ];
  for (const [source, expected] of invalid) {
    const issue = getMarkdownFaqIssue(source);
    assert.equal(issue?.kind, "faq");
    assert.match(issue?.message ?? "", expected);
  }
  const faqOf = (index, itemCount = 2) => [
    `> [!faq] 问答 ${index}`,
    ...Array.from({ length: itemCount }, (_, item) =>
      `> - **问题 ${index}-${item + 1}？**\n>\n>   答案 ${index}-${item + 1}。`),
  ].join("\n");
  const tooMany = Array.from({ length: MARKDOWN_FAQ_MAX_COUNT + 1 }, (_, index) => faqOf(index + 1)).join("\n\n");
  assert.match(getMarkdownFaqIssue(tooMany)?.message ?? "", /最多允许.*FAQ/u);
  const tooManyItems = Array.from({ length: 3 }, (_, index) =>
    faqOf(index + 1, Math.floor(MARKDOWN_FAQ_MAX_TOTAL_ITEMS / 3) + 1)).join("\n\n");
  assert.match(getMarkdownFaqIssue(tooManyItems)?.message ?? "", /合计最多/u);
});

test("keeps FAQ meaning searchable without marker or visual-label noise", () => {
  const plainText = markdownToPlainText(faq);
  assert.match(plainText, /发布常见问题 应该使用 Studio 还是 Obsidian.*最终发布.*FAQ 会保存.*不会/u);
  assert.doesNotMatch(plainText, /\[!faq\]|FAQ \/|QUESTIONS|ANSWERS · NATIVE/u);
});

test("makes the same FAQ contract authoritative for Studio preflight", () => {
  const fields = { body: faq, description: "验证 FAQ 进入统一内容契约。", draft: true,
    featured: false, freshness: "historical", publishedAt: "2026-08-12",
    reviewedAt: "2026-08-12", slug: "faq-contract", tags: ["Project Management"],
    title: "FAQ 内容契约", type: "article" };
  assert.equal(inspectContentDraft("post", fields, "2026-08-12").ok, true);
  const invalid = inspectContentDraft("post", {
    ...fields, body: "> [!faq] 只有一个\n> - **问题？**\n>\n>   答案。",
  }, "2026-08-12");
  assert.equal(invalid.ok, false);
  assert.match(invalid.issues[0]?.message ?? "", /FAQ/u);
});

test("wires one FAQ contract into reading, Studio, mobile, focus, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);
  assert.match(pipeline, /rehypeMarkdownFaqs/u);
  assert.match(previewRuntime, /faqQuestionCount/u);
  assert.match(previewRuntime, /hasPotentialStudioFaq/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-faq\s*\{/u);
    assert.match(styles, /\.markdown-faq-question:focus-visible/u);
    assert.match(styles, /\.markdown-faq-answer-copy/u);
  }
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-faq-entry:not\(\[open\]\)/u);
  assert.match(richStyles, /@media \(max-width: 32rem\)[\s\S]*?\.markdown-faq-question[\s\S]*?grid-template-columns/u);
});
