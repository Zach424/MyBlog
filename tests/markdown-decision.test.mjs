import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  extractMarkdownDecisions,
  getMarkdownDecisionIssue,
  rehypeMarkdownDecisions,
} from "../lib/markdown-decision.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const decision = `> [!decision] 选择 Vercel 原生托管
> **STATUS:** \`ACCEPTED\` · **DATE:** \`2026-08-12\`
>
> **CONTEXT**
>
> 需要一个能直接运行 Next.js 且减少额外平台层的公开托管方案。
>
> **DECISION**
>
> 使用 Vercel 作为生产托管平台。
>
> **RATIONALE**
>
> 它与当前 Next.js 构建、预览和 Git 交付链路直接对齐。
>
> **ALTERNATIVES**
>
> - **Cloudflare Pages** — 需要额外适配与维护。
> - **自托管** — 运维成本超出个人博客需要。
>
> **CONSEQUENCES**
>
> - \`POSITIVE\` 发布链路更短，框架支持更直接。
> - \`NEGATIVE\` 托管能力与 Vercel 平台耦合。`;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownDecisions)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

function decisionOf(index, items = 1) {
  return decision
    .replace("选择 Vercel 原生托管", `选择托管方案 ${index}`)
    .replace(
      "> - **Cloudflare Pages** — 需要额外适配与维护。\n> - **自托管** — 运维成本超出个人博客需要。",
      Array.from({ length: items }, (_, item) => `> - **备选 ${index}-${item}** — 未满足当前约束。`).join("\n"),
    )
    .replace(
      "> - `POSITIVE` 发布链路更短，框架支持更直接。\n> - `NEGATIVE` 托管能力与 Vercel 平台耦合。",
      Array.from({ length: items }, (_, item) => `> - \`NEUTRAL\` 影响 ${index}-${item} 已记录。`).join("\n"),
    );
}

test("renders a portable technical decision as a semantic decision brief", () => {
  const html = render(decision);
  assert.match(html, /data-decision="decision-brief"/u);
  assert.match(html, /data-status="accepted"/u);
  assert.match(html, /<time class="markdown-decision-date" datetime="2026-08-12">/u);
  assert.match(html, /DECISION \/ LOCK/u);
  assert.match(html, /NOT SELECTED.*IMPACT LEDGER/u);
  assert.equal((html.match(/class="markdown-decision-ledger-item"/gu) ?? []).length, 4);
  assert.doesNotMatch(html, /<button|contenteditable|onclick=/iu);
});

test("extracts fixed decision evidence without presentation state", () => {
  assert.deepEqual(extractMarkdownDecisions(decision), [{
    alternatives: [
      { description: "需要额外适配与维护。", line: 18, title: "Cloudflare Pages" },
      { description: "运维成本超出个人博客需要。", line: 19, title: "自托管" },
    ],
    consequences: [
      { description: "发布链路更短，框架支持更直接。", line: 23, tone: "POSITIVE" },
      { description: "托管能力与 Vercel 平台耦合。", line: 24, tone: "NEGATIVE" },
    ],
    context: "需要一个能直接运行 Next.js 且减少额外平台层的公开托管方案。",
    date: "2026-08-12",
    decision: "使用 Vercel 作为生产托管平台。",
    line: 1,
    rationale: "它与当前 Next.js 构建、预览和 Git 交付链路直接对齐。",
    status: "ACCEPTED",
    title: "选择 Vercel 原生托管",
  }]);
});

test("rejects malformed, ambiguous, future, duplicate, and over-budget decisions", () => {
  const invalid = [
    [decision.replace("[!decision]", "[!decision]+"), /静态|折叠/u],
    [decision.replace("**STATUS:** `ACCEPTED`", "**STATUS:** `PENDING`"), /状态只允许/u],
    [decision.replace("`2026-08-12`", "`2026-02-30`"), /真实的 YYYY-MM-DD/u],
    [decision.replace("> **DECISION**", "> **RATIONALE**"), /固定区段|顺序/u],
    [decision.replace("> - **自托管** — 运维成本超出个人博客需要。", "> - **Ｃｌｏｕｄｆｌａｒｅ　Ｐａｇｅｓ** — 重复名称。"), /重复的备选方案/u],
    [decision.replace("> - `NEGATIVE`", "> - `RISK`"), /影响类型只允许/u],
    [decision.replace("需要额外适配与维护。", "![图片](/x.png)"), /图片.*记录外/u],
    [`- 外层\n${decision.split("\n").map((line) => `  ${line}`).join("\n")}`, /顶层区块/u],
    [[1, 2, 3, 4].map((index) => decisionOf(index)).join("\n\n"), /最多允许 3/u],
    [[1, 2, 3].map((index) => decisionOf(index, 5)).join("\n\n"), /合计最多允许 24/u],
  ];
  for (const [source, expected] of invalid) {
    const issue = getMarkdownDecisionIssue(source);
    assert.equal(issue?.kind, "decision");
    assert.match(issue?.message ?? "", expected);
  }
  assert.match(
    getMarkdownDecisionIssue(decision, { maximumDate: "2026-08-11" })?.message ?? "",
    /只记录已经作出的决定/u,
  );
});

test("keeps decision evidence searchable while removing structural tokens", () => {
  const plain = markdownToPlainText(decision);
  assert.match(plain, /选择 Vercel 原生托管 2026-08-12/u);
  assert.match(plain, /Cloudflare Pages 需要额外适配与维护/u);
  assert.match(plain, /发布链路更短/u);
  assert.doesNotMatch(plain, /\[!decision\]|STATUS|CONTEXT|POSITIVE|NEGATIVE/u);
});

test("wires one decision contract into reading, Studio, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);
  assert.match(pipeline, /rehypeMarkdownDecisions/u);
  assert.match(previewRuntime, /decisionAlternativeCount/u);
  assert.match(previewRuntime, /hasPotentialStudioDecision/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-decision\s*\{/u);
    assert.match(styles, /\.markdown-decision-ledger/u);
    assert.match(styles, /data-consequence-tone="positive"/u);
  }
});
