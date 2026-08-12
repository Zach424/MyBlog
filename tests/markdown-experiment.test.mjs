import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  extractMarkdownExperiments,
  getMarkdownExperimentIssue,
  rehypeMarkdownExperiments,
} from "../lib/markdown-experiment.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const experiment = `> [!experiment] 验证博客完整发布门耗时
> **STATUS:** \`SUPPORTED\` · **DATE:** \`2026-08-12\`
>
> **HYPOTHESIS**
>
> 当前工作站可以在三分钟内完成全部本地发布质量门。
>
> **ENVIRONMENT**
>
> Windows、Node.js 22、Next.js 16.3.0，使用仓库锁定依赖。
>
> **METHOD**
>
> 在干净依赖环境中运行一次 \`npm run release:check\` 并记录最终结果。
>
> **SAMPLE**
>
> 单台工作站、一次完整运行，覆盖当前公开内容与全部测试。
>
> **MEASUREMENTS**
>
> - **完整发布检查** \`184.3 s\` — 配置、内容、测试、类型、构建、应用和审计全部通过。
> - **应用测试** \`35/35\` — 真实生产服务器路径全部通过。
>
> **CONCLUSION**
>
> 本次运行支持当前工作站能在约三分钟内完成完整发布检查。
>
> **LIMITATIONS**
>
> - **单次运行** — 没有重复样本，不能证明长期耗时分布。
> - **单机范围** — 结果只覆盖当前硬件、系统与依赖版本。`;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownExperiments)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

function experimentOf(index, measurementCount = 1, limitationCount = 1) {
  return experiment
    .replace("验证博客完整发布门耗时", `验证发布门 ${index}`)
    .replace(
      "> - **完整发布检查** `184.3 s` — 配置、内容、测试、类型、构建、应用和审计全部通过。\n> - **应用测试** `35/35` — 真实生产服务器路径全部通过。",
      Array.from({ length: measurementCount }, (_, item) => `> - **指标 ${index}-${item}** \`${item + 1} ms\` — 测量说明已记录。`).join("\n"),
    )
    .replace(
      "> - **单次运行** — 没有重复样本，不能证明长期耗时分布。\n> - **单机范围** — 结果只覆盖当前硬件、系统与依赖版本。",
      Array.from({ length: limitationCount }, (_, item) => `> - **局限 ${index}-${item}** — 局限说明已记录。`).join("\n"),
    );
}

test("renders a portable technical experiment as a semantic bench sheet", () => {
  const html = render(experiment);
  assert.match(html, /data-experiment="bench-sheet"/u);
  assert.match(html, /data-status="supported"/u);
  assert.match(html, /<time class="markdown-experiment-date" datetime="2026-08-12">/u);
  assert.match(html, /EXPERIMENT \/ RUN/u);
  assert.match(html, /MEASUREMENTS.*LIMITATIONS/u);
  assert.equal((html.match(/class="markdown-experiment-measurement"/gu) ?? []).length, 2);
  assert.equal((html.match(/class="markdown-experiment-limitation"/gu) ?? []).length, 2);
  assert.doesNotMatch(html, /<button|contenteditable|onclick=/iu);
});

test("extracts fixed experiment evidence without execution state", () => {
  assert.deepEqual(extractMarkdownExperiments(experiment), [{
    conclusion: "本次运行支持当前工作站能在约三分钟内完成完整发布检查。",
    date: "2026-08-12",
    environment: "Windows、Node.js 22、Next.js 16.3.0，使用仓库锁定依赖。",
    hypothesis: "当前工作站可以在三分钟内完成全部本地发布质量门。",
    limitations: [
      { description: "没有重复样本，不能证明长期耗时分布。", line: 31, title: "单次运行" },
      { description: "结果只覆盖当前硬件、系统与依赖版本。", line: 32, title: "单机范围" },
    ],
    line: 1,
    measurements: [
      { description: "配置、内容、测试、类型、构建、应用和审计全部通过。", label: "完整发布检查", line: 22, value: "184.3 s" },
      { description: "真实生产服务器路径全部通过。", label: "应用测试", line: 23, value: "35/35" },
    ],
    method: "在干净依赖环境中运行一次 npm run release:check 并记录最终结果。",
    sample: "单台工作站、一次完整运行，覆盖当前公开内容与全部测试。",
    status: "SUPPORTED",
    title: "验证博客完整发布门耗时",
  }]);
});

test("rejects malformed, future, duplicate, unsafe, and over-budget experiments", () => {
  const invalid = [
    [experiment.replace("[!experiment]", "[!experiment]+"), /静态|折叠/u],
    [experiment.replace("**STATUS:** `SUPPORTED`", "**STATUS:** `RUNNING`"), /状态只允许/u],
    [experiment.replace("`2026-08-12`", "`2026-02-30`"), /真实的 YYYY-MM-DD/u],
    [experiment.replace("> **METHOD**", "> **SAMPLE**"), /固定区段|顺序/u],
    [experiment.replace("**应用测试**", "**完整发布检查**"), /重复的测量项/u],
    [experiment.replace("**单机范围**", "**单次运行**"), /重复的局限项/u],
    [experiment.replace("配置、内容、测试、类型、构建、应用和审计全部通过。", "![图片](/x.png)"), /图片.*记录外/u],
    [`- 外层\n${experiment.split("\n").map((line) => `  ${line}`).join("\n")}`, /顶层区块/u],
    [[1, 2, 3, 4].map((index) => experimentOf(index)).join("\n\n"), /最多允许 3/u],
    [[1, 2, 3].map((index) => experimentOf(index, 6, 5)).join("\n\n"), /合计最多允许 30/u],
  ];
  for (const [source, expected] of invalid) {
    const issue = getMarkdownExperimentIssue(source);
    assert.equal(issue?.kind, "experiment");
    assert.match(issue?.message ?? "", expected);
  }
  assert.match(
    getMarkdownExperimentIssue(experiment, { maximumDate: "2026-08-11" })?.message ?? "",
    /只记录已经完成的运行/u,
  );
});

test("keeps experiment evidence searchable while removing structural tokens", () => {
  const plain = markdownToPlainText(experiment);
  assert.match(plain, /验证博客完整发布门耗时 2026-08-12/u);
  assert.match(plain, /完整发布检查 184\.3 s 配置、内容/u);
  assert.match(plain, /单次运行 没有重复样本/u);
  assert.doesNotMatch(plain, /\[!experiment\]|STATUS|HYPOTHESIS|MEASUREMENTS|LIMITATIONS|SUPPORTED/u);
});

test("wires one experiment contract into reading, Studio, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);
  assert.match(pipeline, /rehypeMarkdownExperiments/u);
  assert.match(previewRuntime, /experimentMeasurementCount/u);
  assert.match(previewRuntime, /hasPotentialStudioExperiment/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-experiment\s*\{/u);
    assert.match(styles, /\.markdown-experiment-measurement/u);
    assert.match(styles, /data-status="failed"/u);
  }
});
