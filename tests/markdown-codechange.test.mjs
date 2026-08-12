import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  extractMarkdownCodeChanges,
  getMarkdownCodeChangeIssue,
  rehypeMarkdownCodeChanges,
} from "../lib/markdown-codechange.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const unifiedChange = `> [!codechange] 为 Studio 增加代码变更编辑器
> **MODE:** \`UNIFIED\` · **DATE:** \`2026-08-12\`
>
> **PURPOSE**
>
> 让发布者在文章中保留可审阅的实现依据，而不连接线上 Git 仓库。
>
> **FILES**
>
> - \`MODIFIED\` \`lib/example.ts\` — 收敛共享解析与渲染入口。
>
> **CHANGE**
>
> **DIFF**
>
> ~~~diff
> diff --git a/lib/example.ts b/lib/example.ts
> --- a/lib/example.ts
> +++ b/lib/example.ts
> @@ -1 +1 @@
> -export const enabled = false;
> +export const enabled = true;
> ~~~
>
> **VERIFICATION**
>
> - **Unit tests** \`8/8\` — 解析、预算和失败路径全部通过。
>
> **RISKS**
>
> - **示例漂移** — 编辑器与服务端必须继续共享同一份固定契约。`;

const beforeAfterChange = `> [!codechange] 收紧发布日期校验
> **MODE:** \`BEFORE_AFTER\` · **DATE:** \`2026-08-11\`
>
> **PURPOSE**
>
> 直观比较单文件的小范围代码修改。
>
> **FILES**
>
> - \`MODIFIED\` \`lib/date.ts\` — 拒绝无效日期。
>
> **CHANGE**
>
> **BEFORE:** \`ts\`
>
> ~~~ts
> export const valid = (value: string) => Boolean(value);
> ~~~
>
> **AFTER:** \`ts\`
>
> ~~~ts
> export const valid = (value: string) => /^\\d{4}-\\d{2}-\\d{2}$/.test(value);
> ~~~
>
> **VERIFICATION**
>
> - **Date cases** \`12/12\` — 真实与无效日期样例均符合预期。
>
> **RISKS**
>
> - **时区语义** — 该片段只校验格式，完整日期语义仍由共享层处理。`;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeMarkdownCodeChanges)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

function renamedChange() {
  return unifiedChange
    .replace("`MODIFIED` `lib/example.ts`", "`RENAMED` `lib/old.ts -> lib/new.ts`")
    .replace("diff --git a/lib/example.ts b/lib/example.ts\n> --- a/lib/example.ts\n> +++ b/lib/example.ts\n> @@ -1 +1 @@\n> -export const enabled = false;\n> +export const enabled = true;", "diff --git a/lib/old.ts b/lib/new.ts\n> similarity index 100%\n> rename from lib/old.ts\n> rename to lib/new.ts");
}

test("renders unified and before/after evidence as non-interactive review dockets", () => {
  const unifiedHtml = render(unifiedChange);
  assert.match(unifiedHtml, /data-code-change="review-docket"/u);
  assert.match(unifiedHtml, /data-mode="unified"/u);
  assert.match(unifiedHtml, /CHANGE \/ REVIEW/u);
  assert.match(unifiedHtml, /FILES \/ REVIEW INDEX/u);
  assert.match(unifiedHtml, /UNIFIED DIFF/u);
  assert.match(unifiedHtml, /data-file-status="modified"/u);
  assert.doesNotMatch(unifiedHtml, /<button|contenteditable|onclick=/iu);

  const splitHtml = render(beforeAfterChange);
  assert.match(splitHtml, /data-mode="before-after"/u);
  assert.match(splitHtml, /markdown-codechange-split/u);
  assert.match(splitHtml, />BEFORE<.*>AFTER</su);
});

test("extracts both code-change modes without live repository state", () => {
  const [unifiedSource, splitSource, renameSource] = extractMarkdownCodeChanges(
    `${unifiedChange}\n\n${beforeAfterChange}`,
    { maximumDate: "2026-08-12" },
  );
  assert.equal(unifiedSource.mode, "UNIFIED");
  assert.equal(unifiedSource.title, "为 Studio 增加代码变更编辑器");
  assert.deepEqual(unifiedSource.files[0], {
    description: "收敛共享解析与渲染入口。",
    line: 10,
    path: "lib/example.ts",
    status: "MODIFIED",
  });
  assert.match(unifiedSource.diff, /^diff --git a\/lib\/example\.ts/u);
  assert.equal(splitSource.mode, "BEFORE_AFTER");
  assert.equal(splitSource.language, "ts");
  assert.notEqual(splitSource.before, splitSource.after);
  assert.equal(renameSource, undefined);

  const [renamed] = extractMarkdownCodeChanges(renamedChange());
  assert.equal(renamed.files[0].status, "RENAMED");
  assert.match(renamed.diff, /rename from lib\/old\.ts/u);
});

test("rejects malformed metadata, structure, file ledgers, and dates", () => {
  const invalid = [
    [unifiedChange.replace("[!codechange]", "[!codechange]+"), /静态|折叠/u],
    [unifiedChange.replace("`UNIFIED`", "`PATCH`"), /模式只允许/u],
    [unifiedChange.replace("`2026-08-12`", "`2026-02-30`"), /真实的 YYYY-MM-DD/u],
    [unifiedChange.replace("> **FILES**", "> **RISKS**"), /固定区段|顺序/u],
    [unifiedChange.replace("`lib/example.ts`", "`../secret.ts`"), /不能越界|相对文件路径/u],
    [unifiedChange.replace("`MODIFIED`", "`CHANGED`"), /状态只允许/u],
    [`- 外层\n${unifiedChange.split("\n").map((line) => `  ${line}`).join("\n")}`, /顶层区块/u],
  ];
  for (const [source, expected] of invalid) {
    const issue = getMarkdownCodeChangeIssue(source);
    assert.equal(issue?.kind, "codechange");
    assert.match(issue?.message ?? "", expected);
  }
  assert.match(
    getMarkdownCodeChangeIssue(unifiedChange, { maximumDate: "2026-08-11" })?.message ?? "",
    /只记录已经完成的修改/u,
  );
});

test("rejects diff drift, incomplete patches, binary data, and suspected secrets", () => {
  const invalid = [
    [unifiedChange.replace("diff --git a/lib/example.ts b/lib/example.ts", "diff --git a/lib/other.ts b/lib/other.ts"), /路径必须与/u],
    [unifiedChange.replace("`MODIFIED`", "`ADDED`"), /声明为 ADDED.*MODIFIED/u],
    [unifiedChange.replace("> @@ -1 +1 @@\n", ""), /有效 hunk/u],
    [unifiedChange.replace("--- a/lib/example.ts", "GIT binary patch"), /二进制/u],
    [unifiedChange.replace("export const enabled = true;", "github_pat_abcdefghijklmnopqrstuvwxyz123456"), /私钥或访问令牌/u],
  ];
  for (const [source, expected] of invalid) {
    assert.match(getMarkdownCodeChangeIssue(source)?.message ?? "", expected);
  }
});

test("rejects invalid before/after comparisons", () => {
  const invalid = [
    [beforeAfterChange.replace("**AFTER:** `ts`\n>\n> ~~~ts", "**AFTER:** `js`\n>\n> ~~~js"), /同一种语言/u],
    [beforeAfterChange.replace("**AFTER:** `ts`", "**AFTER:** `python`"), /语言只允许/u],
    [beforeAfterChange.replace("`MODIFIED`", "`ADDED`"), /只允许一个 MODIFIED/u],
    [beforeAfterChange.replace("export const valid = (value: string) => /^\\d{4}-\\d{2}-\\d{2}$/.test(value);", "export const valid = (value: string) => Boolean(value);"), /不能完全相同/u],
  ];
  for (const [source, expected] of invalid) {
    assert.match(getMarkdownCodeChangeIssue(source)?.message ?? "", expected);
  }
});

test("enforces article count and code-line budgets", () => {
  const third = unifiedChange
    .replace("为 Studio 增加代码变更编辑器", "第三个代码变更")
    .replaceAll("lib/example.ts", "lib/third.ts");
  assert.match(
    getMarkdownCodeChangeIssue(`${unifiedChange}\n\n${beforeAfterChange}\n\n${third}`)?.message ?? "",
    /最多允许 2/u,
  );
  const changedLines = Array.from({ length: 125 }, (_, index) => `> +export const value${index} = ${index};`).join("\n");
  const large = unifiedChange.replace(
    "> @@ -1 +1 @@\n> -export const enabled = false;\n> +export const enabled = true;",
    `> @@ -0,0 +1,125 @@\n${changedLines}`,
  );
  const secondLarge = large
    .replace("为 Studio 增加代码变更编辑器", "第二个大型代码变更")
    .replaceAll("lib/example.ts", "lib/second.ts");
  assert.match(
    getMarkdownCodeChangeIssue(`${large}\n\n${secondLarge}`)?.message ?? "",
    /合计最多允许 240 行/u,
  );
});

test("keeps purpose, files, code, verification, and risks searchable without syntax noise", () => {
  const plain = markdownToPlainText(unifiedChange);
  assert.match(plain, /为 Studio 增加代码变更编辑器 2026-08-12/u);
  assert.match(plain, /lib\/example\.ts 收敛共享解析与渲染入口/u);
  assert.match(plain, /export const enabled = true/u);
  assert.match(plain, /Unit tests 8\/8 解析、预算/u);
  assert.match(plain, /示例漂移 编辑器与服务端/u);
  assert.doesNotMatch(plain, /\[!codechange\]|MODE|PURPOSE|FILES|CHANGE|DIFF|VERIFICATION|RISKS|diff --git|@@/u);
});

test("wires one code-change contract into reading, Studio, search, mobile, and print", async () => {
  const [pipeline, search, markdownContent, richStyles, previewStyles, previewRuntime] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/search-index.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/MarkdownContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(pipeline, /rehypeMarkdownCodeChanges/u);
  assert.match(search, /normalizeMarkdownCodeChangesForPlainText/u);
  assert.match(markdownContent, /markdown-codechange-pre/u);
  assert.match(previewRuntime, /codeChangeLineCount/u);
  assert.match(previewRuntime, /hasPotentialStudioCodeChange/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-codechange\s*\{/u);
    assert.match(styles, /\.markdown-codechange-split/u);
    assert.match(styles, /@media print[\s\S]*\.markdown-codechange/u);
    assert.match(styles, /@media \(max-width: 32rem\)[\s\S]*\.markdown-codechange/u);
  }
});
