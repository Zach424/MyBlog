import assert from "node:assert/strict";
import { access, readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  assertHtmlBudgetCoverage,
  assertHtmlBudgets,
  formatHtmlBudgetReport,
  HTML_BUDGET_ORIGIN,
  measureHtmlBudget,
} from "../scripts/html-budget.mjs";

async function request(pathname = "/") {
  if (!process.env.TEST_BASE_URL) throw new Error("TEST_BASE_URL is required");
  return fetch(new URL(pathname, process.env.TEST_BASE_URL), {
    redirect: "manual",
    headers: {
      accept: "text/html",
      "x-forwarded-host": HTML_BUDGET_ORIGIN.host,
      "x-forwarded-proto": "https",
    },
  });
}

async function postStudioMathPreview(body, headers = {}) {
  if (!process.env.TEST_BASE_URL) throw new Error("TEST_BASE_URL is required");
  return fetch(new URL("/studio/math-preview", process.env.TEST_BASE_URL), {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-host": HTML_BUDGET_ORIGIN.host,
      "x-forwarded-proto": "https",
      ...headers,
    },
    method: "POST",
    redirect: "manual",
  });
}

async function postStudioEntryPreflight(body, headers = {}) {
  if (!process.env.TEST_BASE_URL) throw new Error("TEST_BASE_URL is required");
  return fetch(new URL("/studio/entry-preflight", process.env.TEST_BASE_URL), {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-host": HTML_BUDGET_ORIGIN.host,
      "x-forwarded-proto": "https",
      ...headers,
    },
    method: "POST",
    redirect: "manual",
  });
}

function visibleDocument(html) {
  const documentEnd = html.indexOf("</html>");
  return documentEnd >= 0 ? html.slice(0, documentEnd + 7) : html;
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function luminance(hexColor) {
  const channels = hexColor
    .slice(1)
    .match(/../g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function cssTokens(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [
      match[1],
      match[2],
    ]),
  );
}

async function directoryStats(url) {
  const entries = await readdir(url, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, url);
    if (entry.isDirectory()) files.push(...(await directoryStats(entryUrl)));
    else files.push({ url: entryUrl, size: (await stat(entryUrl)).size });
  }

  return files;
}

test("applies the production security and cache baseline", async () => {
  for (const pathname of [
    "/",
    "/posts/building-a-maintainable-blog",
    "/posts/building-a-maintainable-blog/source.md",
    "/feed.json",
    "/rss.xml",
  ]) {
    const response = await request(pathname);
    assert.equal(response.status, 200, pathname);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", pathname);
    assert.equal(response.headers.get("x-frame-options"), "DENY", pathname);
    assert.equal(
      response.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
      pathname,
    );
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin", pathname);
    assert.equal(
      response.headers.get("permissions-policy"),
      "camera=(), geolocation=(), microphone=()",
      pathname,
    );
    assert.match(
      response.headers.get("strict-transport-security") ?? "",
      /^max-age=31536000;/,
      pathname,
    );
    const policy = response.headers.get("content-security-policy") ?? "";
    assert.match(policy, /default-src 'self'/, pathname);
    assert.match(policy, /frame-ancestors 'none'/, pathname);
    assert.match(policy, /object-src 'none'/, pathname);
    assert.match(policy, /img-src 'self' data: https:/, pathname);
    assert.equal(response.headers.get("x-powered-by"), null, pathname);
  }

  const htmlResponse = await request("/");
  assert.equal(
    htmlResponse.headers.get("cache-control"),
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );
  const rssResponse = await request("/rss.xml");
  assert.match(rssResponse.headers.get("cache-control") ?? "", /max-age=3600/);
  const missingResponse = await request("/definitely-missing");
  assert.equal(missingResponse.status, 404);
  assert.match(missingResponse.headers.get("cache-control") ?? "", /no-store/);
  const missingHtml = await missingResponse.text();
  assert.match(missingHtml, /<meta name="robots" content="noindex"/i);
  assert.match(missingHtml, /这条轨迹在这里中断。/u);
  assert.equal((missingHtml.match(/class="not-found-route [^"]+"/gu) ?? []).length, 4);

  const studioResponse = await request("/studio");
  assert.equal(studioResponse.status, 200);
  assert.equal(studioResponse.headers.get("cache-control"), "no-store");
  assert.equal(
    studioResponse.headers.get("cross-origin-opener-policy"),
    "same-origin-allow-popups",
  );
  assert.match(
    studioResponse.headers.get("content-security-policy") ?? "",
    /connect-src 'self' https:\/\/api\.github\.com https:\/\/github\.com/,
  );
});

test("serves Studio, its maintenance queue, and media inventory through explicit Next.js routes", async () => {
  await assert.rejects(access(new URL("../public/studio", import.meta.url)));
  const [studio, maintenancePage, maintenanceModule, maintenanceStyles, maintenanceResponse, config, manifest, preflight, stableSlugWidget, entryPreflightModule, mathPreviewModule, galleryEditorModule, glossaryEditorModule, faqEditorModule, fileTreeEditorModule, timelineEditorModule, decisionEditorModule, experimentEditorModule, codeChangeEditorModule, httpEditorModule, tableEditorModule, taskListEditorModule, referencesEditorModule, stepsEditorModule, videoEditorModule, preview, katexStyles, runtime, unknown] = await Promise.all([
    request("/studio"),
    request("/studio/maintenance"),
    request("/studio/maintenance.mjs"),
    request("/studio/maintenance.css"),
    request("/studio/maintenance.json"),
    request("/studio/config.mjs"),
    request("/studio/media-manifest.json"),
    request("/studio/media-preflight.mjs"),
    request("/studio/stable-slug-widget.mjs"),
    request("/studio/entry-preflight.mjs"),
    request("/studio/math-preview.mjs"),
    request("/studio/gallery-editor.mjs"),
    request("/studio/glossary-editor.mjs"),
    request("/studio/faq-editor.mjs"),
    request("/studio/filetree-editor.mjs"),
    request("/studio/timeline-editor.mjs"),
    request("/studio/decision-editor.mjs"),
    request("/studio/experiment-editor.mjs"),
    request("/studio/codechange-editor.mjs"),
    request("/studio/http-editor.mjs"),
    request("/studio/table-editor.mjs"),
    request("/studio/task-list-editor.mjs"),
    request("/studio/references-editor.mjs"),
    request("/studio/steps-editor.mjs"),
    request("/studio/video-editor.mjs"),
    request("/studio/preview.css"),
    request("/studio/katex-0.16.47.css"),
    request("/studio/editor-runtime-3.14.1.js"),
    request("/studio/definitely-missing"),
  ]);
  assert.equal(studio.status, 200);
  assert.match(await studio.text(), /Publishing studio \/ Git-backed/);
  assert.equal(taskListEditorModule.status, 200);
  assert.match(await taskListEditorModule.text(), /registerStudioTaskListEditor/u);
  assert.equal(maintenancePage.status, 200);
  assert.match(await maintenancePage.text(), /REVIEW HORIZON/u);
  assert.equal(maintenancePage.headers.get("cache-control"), "no-store");
  assert.match(await maintenanceModule.text(), /requestStudioMaintenance/u);
  assert.equal(maintenanceModule.headers.get("cache-control"), "no-store");
  assert.match(await maintenanceStyles.text(), /grid-template-columns:\s*minmax\(0,\s*14rem\)/u);
  assert.equal(maintenanceStyles.headers.get("cache-control"), "no-store");
  assert.equal(maintenanceResponse.status, 200);
  assert.equal(maintenanceResponse.headers.get("cache-control"), "no-store");
  assert.equal(maintenanceResponse.headers.get("x-robots-tag"), "noindex, nofollow");
  const maintenance = await maintenanceResponse.json();
  assert.equal(maintenance.version, 1);
  assert.match(maintenance.reportDate, /^\d{4}-\d{2}-\d{2}$/u);
  assert.equal(maintenance.currentCount, 1);
  assert.equal(maintenance.historicalCount, 3);
  assert.deepEqual(maintenance.records.map((record) => record.slug), ["myblog"]);
  assert.equal(maintenance.records[0].editUrl, "/studio/#/collections/projects/entries/myblog");
  assert.equal(maintenance.records[0].publicUrl, "/projects/myblog");
  assert.equal(maintenance.records[0].status, "healthy");
  assert.ok(!("body" in maintenance.records[0]));
  assert.ok(!("sourcePath" in maintenance.records[0]));
  assert.match(await config.text(), /repo: "Zach424\/MyBlog"/);
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get("content-type") ?? "", /^application\/json/u);
  assert.equal(manifest.headers.get("cache-control"), "no-store");
  assert.equal(manifest.headers.get("x-robots-tag"), "noindex, nofollow");
  const mediaInventory = await manifest.json();
  assert.equal(mediaInventory.version, 1);
  assert.equal(mediaInventory.root, "public/uploads");
  assert.deepEqual(
    mediaInventory.entries.map((entry) => entry.path),
    [
      "public/uploads/building-a-maintainable-blog/content-delivery-pipeline.webp",
      "public/uploads/myblog/cover.webp",
    ],
  );
  for (const entry of mediaInventory.entries) {
    assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(entry.bytes > 0);
  }
  assert.match(await preflight.text(), /inspectStudioMediaFile/);
  assert.match(await request("/studio/media-preflight.mjs").then((response) => response.text()), /media-manifest\.json/u);
  assert.equal(preflight.headers.get("cache-control"), "no-store");
  assert.match(await stableSlugWidget.text(), /registerStableSlugWidget/);
  assert.equal(stableSlugWidget.headers.get("cache-control"), "no-store");
  assert.match(await entryPreflightModule.text(), /serializeStudioEntry/);
  assert.equal(entryPreflightModule.headers.get("cache-control"), "no-store");
  assert.match(await mathPreviewModule.text(), /registerStudioMathPreview/);
  assert.equal(mathPreviewModule.headers.get("cache-control"), "no-store");
  assert.match(await galleryEditorModule.text(), /registerStudioGalleryEditor/);
  assert.equal(galleryEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(glossaryEditorModule.status, 200);
  assert.match(await glossaryEditorModule.text(), /registerStudioGlossaryEditor/u);
  assert.equal(glossaryEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(faqEditorModule.status, 200);
  assert.match(await faqEditorModule.text(), /registerStudioFaqEditor/u);
  assert.equal(faqEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(fileTreeEditorModule.status, 200);
  assert.match(await fileTreeEditorModule.text(), /registerStudioFileTreeEditor/u);
  assert.equal(fileTreeEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(timelineEditorModule.status, 200);
  assert.match(await timelineEditorModule.text(), /registerStudioTimelineEditor/u);
  assert.equal(timelineEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(decisionEditorModule.status, 200);
  assert.match(await decisionEditorModule.text(), /registerStudioDecisionEditor/u);
  assert.equal(decisionEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(experimentEditorModule.status, 200);
  assert.match(await experimentEditorModule.text(), /registerStudioExperimentEditor/u);
  assert.equal(experimentEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(codeChangeEditorModule.status, 200);
  assert.match(await codeChangeEditorModule.text(), /registerStudioCodeChangeEditor/u);
  assert.equal(codeChangeEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(httpEditorModule.status, 200);
  assert.match(await httpEditorModule.text(), /registerStudioHttpEditor/u);
  assert.equal(httpEditorModule.headers.get("cache-control"), "no-store");
  assert.match(await tableEditorModule.text(), /registerStudioTableEditor/);
  assert.equal(tableEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(referencesEditorModule.status, 200);
  assert.match(await referencesEditorModule.text(), /registerStudioReferencesEditor/u);
  assert.equal(referencesEditorModule.headers.get("cache-control"), "no-store");
  assert.equal(stepsEditorModule.status, 200);
  assert.match(await stepsEditorModule.text(), /registerStudioStepsEditor/u);
  assert.equal(stepsEditorModule.headers.get("cache-control"), "no-store");
  assert.match(await videoEditorModule.text(), /registerStudioVideoEditor/);
  assert.equal(videoEditorModule.headers.get("cache-control"), "no-store");
  const previewCss = await preview.text();
  assert.match(previewCss, /--canvas:/);
  assert.match(previewCss, /\*::before,[\s\S]*?box-sizing: border-box/u);
  const katexCss = await katexStyles.text();
  assert.equal(katexStyles.status, 200);
  assert.equal(
    katexStyles.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  assert.match(katexCss, /data:font\/woff2;base64,/u);
  assert.match(katexCss, /\.katex-version:after\{content:"0\.16\.47"\}/u);
  assert.doesNotMatch(katexCss, /url\(fonts\//u);
  assert.ok(katexCss.length > 250_000 && katexCss.length < 500_000);
  assert.match(await runtime.text(), /decap-cms 3\.14\.1/);
  assert.equal(runtime.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get("cache-control") ?? "", /no-store/);
});

test("preflights bounded Studio entries with the production content contract", async () => {
  const validFields = {
    body: "## 结论\n\n这是一段经过校验的正文。",
    description: "说明这篇文章会给读者带来什么。",
    draft: false,
    featured: false,
    freshness: "historical",
    publishedAt: "2026-08-01",
    reviewedAt: "2026-08-01",
    slug: "author-proof",
    tags: ["TypeScript", "Personal Knowledge"],
    title: "Author Proof 发布清单",
    type: "article",
  };
  const valid = await postStudioEntryPreflight({ collection: "posts", fields: validFields });
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.equal(valid.headers.get("x-robots-tag"), "noindex, nofollow");
  const validPayload = await valid.json();
  assert.equal(validPayload.ok, true);
  assert.equal(validPayload.issueCount, 0);
  assert.deepEqual(validPayload.facts.map((fact) => fact.label), ["PATH", "VISIBILITY", "CONTEXT", "BODY"]);

  const invalid = await postStudioEntryPreflight({
    collection: "posts",
    fields: { ...validFields, body: "", draft: true, featured: true, slug: "Bad Slug" },
  });
  assert.equal(invalid.status, 422);
  const invalidPayload = await invalid.json();
  assert.equal(invalidPayload.ok, false);
  assert.ok(invalidPayload.issues.some((issue) => issue.field === "body"));
  assert.ok(invalidPayload.issues.some((issue) => issue.field === "featured"));
  assert.ok(invalidPayload.issues.some((issue) => issue.field === "slug"));

  const invalidDiagram = await postStudioEntryPreflight({
    collection: "posts",
    fields: {
      ...validFields,
      body: "```mermaid\nflowchart LR\n  A --> B\n  style A fill:#f00\n```",
    },
  });
  assert.equal(invalidDiagram.status, 422);
  const invalidDiagramPayload = await invalidDiagram.json();
  assert.ok(
    invalidDiagramPayload.issues.some(
      (issue) => issue.field === "body" && /Mermaid/u.test(issue.message),
    ),
  );

  const wrongOrigin = await postStudioEntryPreflight(
    { collection: "posts", fields: validFields },
    { origin: "https://attacker.example" },
  );
  assert.equal(wrongOrigin.status, 403);

  const wrongType = await postStudioEntryPreflight("plain text", {
    "content-type": "text/plain",
  });
  assert.equal(wrongType.status, 415);

  const tooLarge = await postStudioEntryPreflight({
    collection: "posts",
    fields: { ...validFields, body: "x".repeat(128 * 1024) },
  });
  assert.equal(tooLarge.status, 413);
});

test("renders bounded Studio formula previews with the production Markdown pipeline", async () => {
  const valid = await postStudioMathPreview({
    markdown:
      "> [!warning] 发布前检查\n> 行内 $E = mc^2$。\n\n$$\nB = \\sum_i B_i\n$$\n\n```mermaid\nflowchart LR\n  Draft[Draft] --> Review{Review}\n  Review --> Publish[Publish]\n```\n\n> [!gallery] 发布流程证据\n> - ![编辑器中的画廊表单](/uploads/author-proof/gallery-one.webp \"编辑\")\n> - ![发布后的双栏画廊](/uploads/author-proof/gallery-two.webp \"上线\")\n\n> [!table] 发布延迟\n> | 环境 | P95 |\n> | --- | ---: |\n> | 本地 | 44 ms |\n> | 生产 | 118 ms |\n\n> [!tasks] 发布准备\n> - [x] 冻结内容契约\n> - [ ] 完成真实主题验收\n> - [x] 发布 `main`\n\n> [!references] 延伸阅读\n> 1. [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — 官方路由处理器说明。\n> 2. [MyBlog 项目复盘](/projects/myblog) — 本站实现与演进记录。\n\n> [!steps] 发布流程\n> 1. **运行完整检查**\n>\n>    执行 `npm run release:check`。\n>\n>    **验证：** 命令以退出码 0 完成。\n> 2. **推送主分支**\n>\n>    推送已审阅提交。",
  });
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.equal(valid.headers.get("x-robots-tag"), "noindex, nofollow");
  const validPayload = await valid.json();
  assert.equal(validPayload.ok, true);
  assert.equal(validPayload.formulaCount, 2);
  assert.equal(validPayload.calloutCount, 1);
  assert.equal(validPayload.diagramCount, 1);
  assert.equal(validPayload.galleryCount, 1);
  assert.equal(validPayload.galleryImageCount, 2);
  assert.equal(validPayload.tableCount, 1);
  assert.equal(validPayload.tableDataCellCount, 4);
  assert.equal(validPayload.taskListCount, 1);
  assert.equal(validPayload.taskItemCount, 3);
  assert.equal(validPayload.taskCompleteCount, 2);
  assert.equal(validPayload.referenceListCount, 1);
  assert.equal(validPayload.referenceItemCount, 2);
  assert.equal(validPayload.procedureCount, 1);
  assert.equal(validPayload.procedureStepCount, 2);
  assert.match(validPayload.html, /data-studio-renderer="production-pipeline"/u);
  assert.match(validPayload.html, /<aside[^>]*data-callout="warning"/u);
  assert.doesNotMatch(validPayload.html, /\[!warning\]/iu);
  assert.match(validPayload.html, /class="katex"/u);
  assert.match(validPayload.html, /<math/u);
  assert.match(validPayload.html, /data-diagram="flowchart"/u);
  assert.match(validPayload.html, /data-gallery="ordered-images"/u);
  assert.match(validPayload.html, /class="markdown-gallery-grid"/u);
  assert.match(validPayload.html, /data-table="bounded-ledger"/u);
  assert.match(validPayload.html, /class="markdown-data-table-grid"/u);
  assert.match(validPayload.html, /data-task-list="readonly-ledger"/u);
  assert.match(validPayload.html, /<progress[^>]*max="3"[^>]*value="2"/u);
  assert.match(validPayload.html, /data-references="curated-index"/u);
  assert.match(validPayload.html, /SOURCE INDEX \/ 02 REFERENCES/u);
  assert.match(validPayload.html, /data-procedure="runbook-path"/u);
  assert.match(validPayload.html, /PROCEDURE \/ 02 STEPS/u);
  assert.equal((validPayload.html.match(/type="checkbox"/gu) ?? []).length, 3);
  assert.doesNotMatch(validPayload.html, /<button|contenteditable|onclick=/iu);
  assert.match(validPayload.html, /data-renderer="server-svg"/u);
  assert.match(validPayload.html, /<svg[^>]*role="img"/u);
  const diagramHtml = validPayload.html.match(
    /<figure class="markdown-diagram"[\s\S]*?<\/figure>/u,
  )?.[0];
  assert.ok(diagramHtml);
  assert.doesNotMatch(diagramHtml, /@import|https?:|<foreignObject/iu);
  assert.doesNotMatch(validPayload.html, /<script/u);

  const glossary = await postStudioMathPreview({
    markdown:
      "> [!glossary] React 核心概念\n> - **Server Component**\n>\n>   只在服务端渲染的 React 组件。\n>\n>   **别名：** RSC、React Server Component\n>\n>   **上下文：** 在 Next.js App Router 中用于服务端数据读取。\n> - **水合**\n>\n>   React 在已有服务端 HTML 上绑定客户端行为的过程。\n>\n>   **别名：** Hydration",
  });
  assert.equal(glossary.status, 200);
  const glossaryPayload = await glossary.json();
  assert.equal(glossaryPayload.glossaryCount, 1);
  assert.equal(glossaryPayload.glossaryTermCount, 2);
  assert.match(glossaryPayload.html, /data-glossary="definition-ledger"/u);
  assert.match(glossaryPayload.html, /GLOSSARY \/ 02 TERMS/u);
  assert.match(glossaryPayload.html, /<dl class="markdown-glossary-items"/u);
  assert.doesNotMatch(glossaryPayload.html, /<button|contenteditable|onclick=/iu);

  const faq = await postStudioMathPreview({
    markdown:
      "> [!faq] 发布常见问题\n> - **应该使用 Studio 还是 Obsidian？**\n>\n>   两者都可以，最终发布同一份 Markdown。\n> - **FAQ 会保存展开状态吗？**\n>\n>   不会；展开只属于当前页面。",
  });
  assert.equal(faq.status, 200);
  const faqPayload = await faq.json();
  assert.equal(faqPayload.faqCount, 1);
  assert.equal(faqPayload.faqQuestionCount, 2);
  assert.match(faqPayload.html, /data-faq="answer-cabinet"/u);
  assert.match(faqPayload.html, /FAQ \/ 02 QUESTIONS/u);
  assert.match(faqPayload.html, /<details[^>]*open/u);
  assert.match(faqPayload.html, /<summary class="markdown-faq-question"/u);
  assert.doesNotMatch(faqPayload.html, /<button|contenteditable|onclick=/iu);

  const fileTree = await postStudioMathPreview({
    markdown:
      "> [!filetree] MyBlog 核心结构\n> - `app/` — 页面与同源路由。\n>   - `studio/` — Git-backed 发布后台。\n>     - `page.tsx` — 后台静态入口。\n> - `lib/` — 内容解析与渲染。\n> - `package.json` — 脚本与质量门。",
  });
  assert.equal(fileTree.status, 200);
  const fileTreePayload = await fileTree.json();
  assert.equal(fileTreePayload.fileTreeCount, 1);
  assert.equal(fileTreePayload.fileTreeNodeCount, 5);
  assert.equal(fileTreePayload.fileTreeMaxDepth, 3);
  assert.match(fileTreePayload.html, /data-filetree="repository-slice"/u);
  assert.match(fileTreePayload.html, /FILE MAP \/ 05 NODES/u);
  assert.doesNotMatch(fileTreePayload.html, /<button|contenteditable|onclick=/iu);

  const unsafeLink = await postStudioMathPreview({
    markdown: "[unsafe](javascript:alert(1)) $x$",
  });
  assert.equal(unsafeLink.status, 200);
  assert.doesNotMatch(await unsafeLink.text(), /href=\\?"javascript:/u);

  const invalid = await postStudioMathPreview({
    markdown: "before\n\n$\\frac{1}{$",
  });
  assert.equal(invalid.status, 422);
  const invalidPayload = await invalid.json();
  assert.equal(invalidPayload.ok, false);
  assert.equal(invalidPayload.issue.line, 3);
  assert.match(invalidPayload.issue.message, /Expected|end of input/u);

  const invalidDiagram = await postStudioMathPreview({
    markdown: "```mermaid\nflowchart LR\n  A --> B\n  click A https://example.com\n```",
  });
  assert.equal(invalidDiagram.status, 422);
  const invalidDiagramPayload = await invalidDiagram.json();
  assert.equal(invalidDiagramPayload.ok, false);
  assert.equal(invalidDiagramPayload.issue.kind, "diagram");
  assert.match(invalidDiagramPayload.issue.message, /交互|链接/u);

  const wrongOrigin = await postStudioMathPreview(
    { markdown: "$x$" },
    { origin: "https://attacker.example" },
  );
  assert.equal(wrongOrigin.status, 403);

  const tooLarge = await postStudioMathPreview({
    markdown: "x".repeat(100_001),
  });
  assert.equal(tooLarge.status, 413);
});

test("keeps key HTML routes structurally valid and within explainable transfer budgets", async (context) => {
  const paths = [
    "/",
    "/posts",
    "/posts/building-a-maintainable-blog",
    "/projects/myblog",
    "/archive",
    "/activity",
    "/subscribe",
    "/series/build-my-blog",
    "/tags/typescript",
    "/search?q=cloudflare",
    "/knowledge",
    "/about",
    "/definitely-missing",
  ];

  const budgetReports = [];

  for (const pathname of paths) {
    const response = await request(pathname);
    assert.equal(response.status, pathname === "/definitely-missing" ? 404 : 200, pathname);
    const responseHtml = await response.text();
    const html = visibleDocument(responseHtml);
    budgetReports.push(measureHtmlBudget({ pathname, html: responseHtml }));
    assert.equal(countMatches(html, /<main\b/g), 1, `${pathname}: main`);
    assert.equal(countMatches(html, /<h1\b/g), 1, `${pathname}: h1`);
    assert.match(html, /<html lang="zh-CN">/, pathname);
    assert.match(html, /<meta name="description" content="[^"]+"/, pathname);
    assert.ok(
      html.includes(`<link rel="canonical" href="${HTML_BUDGET_ORIGIN.origin}`),
      `${pathname}: canonical origin`,
    );
    assert.match(html, /<a class="skip-link" href="#main-content">/, pathname);

    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${pathname}: duplicate id`);
  }

  context.diagnostic(formatHtmlBudgetReport(budgetReports));
  assertHtmlBudgetCoverage(budgetReports);
  assertHtmlBudgets(budgetReports);
});

test("keeps every visible internal navigation target healthy", async () => {
  const sourcePaths = [
    "/",
    "/posts",
    "/posts/building-a-maintainable-blog",
    "/posts/cross-platform-npm-scripts",
    "/projects",
    "/projects/myblog",
    "/archive",
    "/activity",
    "/subscribe",
    "/series",
    "/tags",
    "/search",
    "/knowledge",
    "/about",
  ];
  const targetPaths = new Set();

  for (const sourcePath of sourcePaths) {
    const response = await request(sourcePath);
    const html = visibleDocument(await response.text());
    for (const match of html.matchAll(/\shref="([^"]+)"/g)) {
      const href = match[1];
      if (href.startsWith("#") || href.startsWith("/assets/")) continue;
      const url = new URL(href, HTML_BUDGET_ORIGIN);
      if (url.origin !== HTML_BUDGET_ORIGIN.origin) continue;
      targetPaths.add(`${url.pathname}${url.search}`);
    }
  }

  for (const pathname of [...targetPaths].sort()) {
    const response = await request(pathname);
    assert.ok(response.status < 400, `${pathname}: ${response.status}`);
  }
});

test("enforces deployment artifact budgets", async () => {
  const clientFiles = await directoryStats(new URL("../.next/static/", import.meta.url));
  const clientBytes = clientFiles.reduce((total, file) => total + file.size, 0);
  const largestClientJavaScript = Math.max(
    ...clientFiles.filter((file) => file.url.pathname.endsWith(".js")).map((file) => file.size),
  );
  const cssBytes = (await readFile(new URL("../app/globals.css", import.meta.url))).byteLength;

  assert.ok(clientBytes < 3_000_000, `client total ${clientBytes} >= 3 MB`);
  assert.ok(largestClientJavaScript < 300_000, `largest client JS ${largestClientJavaScript} >= 300 KB`);
  assert.ok(cssBytes < 100_000, `global CSS ${cssBytes} >= 100 KB`);
});

test("keeps text design tokens at WCAG AA contrast", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const lightBlock = css.match(/:root\s*{([^}]+)}/)?.[1] ?? "";
  const darkBlock = css.match(
    /@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*?:root\s*{([^}]+)}/,
  )?.[1] ?? "";
  const themes = [
    ["light", cssTokens(lightBlock)],
    ["dark", cssTokens(darkBlock)],
  ];

  for (const [name, tokens] of themes) {
    for (const role of ["ink", "muted", "faint", "signal", "trace-dark"]) {
      const ratio = contrastRatio(tokens[role], tokens.canvas);
      assert.ok(ratio >= 4.5, `${name} ${role} contrast ${ratio.toFixed(2)} < 4.5`);
    }
    const searchHitRatio = contrastRatio(tokens.ink, tokens.trace);
    assert.ok(
      searchHitRatio >= 4.5,
      `${name} search-hit contrast ${searchHitRatio.toFixed(2)} < 4.5`,
    );
  }
});

test("keeps the root layout fluid at 320px viewports", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const htmlBlock = css.match(/html\s*{([^}]+)}/)?.[1] ?? "";
  const bodyBlock = css.match(/body\s*{([^}]+)}/)?.[1] ?? "";

  assert.doesNotMatch(htmlBlock, /min-width\s*:/, "html must not force horizontal overflow");
  assert.doesNotMatch(bodyBlock, /min-width\s*:/, "body must not force horizontal overflow");
  assert.match(css, /\.page-shell\s*{[^}]*width:\s*min\(calc\(100%/s);
  assert.match(css, /\.knowledge-map-scroll\s*{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media \(max-width:\s*42rem\)[\s\S]*?\.knowledge-map-frame\s*{[^}]*display:\s*none/s);
  assert.match(css, /@media \(max-width:\s*42rem\)[\s\S]*?\.knowledge-mobile-note\s*{[^}]*display:\s*block/s);
  assert.match(
    css,
    /\.search-input-row input:focus-visible\s*{[^}]*outline:\s*0\.125rem solid var\(--signal\)[^}]*outline-offset:\s*0\.3125rem/s,
  );
  assert.match(
    css,
    /@media \(max-width:\s*55rem\)[\s\S]*?\.content-recommendation-list\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
  );
  assert.match(
    css,
    /\.content-recommendation-list > li\s*{[^}]*min-width:\s*0/s,
  );
  assert.match(css, /\.breadcrumbs a\s*{[^}]*flex-shrink:\s*0/s);
  assert.match(
    css,
    /\.breadcrumbs \[aria-current="page"\]\s*{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/s,
  );
});
