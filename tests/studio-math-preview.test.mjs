import assert from "node:assert/strict";
import test from "node:test";
import {
  createStudioMathPreviewTemplate,
  getStudioMathPreviewStatus,
  hasPotentialStudioDiagram,
  hasPotentialStudioAudio,
  hasPotentialStudioGallery,
  hasPotentialStudioRichMarkdown,
  hasPotentialStudioMath,
  hasPotentialStudioReferences,
  hasPotentialStudioSteps,
  hasPotentialStudioTable,
  hasPotentialStudioVideo,
  registerStudioMathPreview,
  requestStudioMathPreview,
  STUDIO_MATH_PREVIEW_DELAY_MS,
  STUDIO_MATH_PREVIEW_ENDPOINT,
} from "../studio/math-preview.mjs";

function entry(data) {
  return {
    getIn(path) {
      return path[0] === "data" ? data[path[1]] : undefined;
    },
  };
}

function h(type, props, ...children) {
  return { props: { ...props, children }, type };
}

function textContent(node) {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  return (node.props?.children ?? []).map(textContent).join("");
}

test("registers one idempotent rich Markdown preview template for posts and projects", () => {
  const registrations = [];
  const CMS = {
    registerPreviewTemplate(collection, template) {
      registrations.push({ collection, template });
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const templates = registerStudioMathPreview({
    CMS,
    createClass: (specification) => specification,
    documentRef,
    h,
  });

  assert.deepEqual(
    registrations.map(({ collection }) => collection),
    ["posts", "projects"],
  );
  assert.equal(registrations[0].template, templates.posts);
  assert.equal(registrations[1].template, templates.projects);
  assert.notEqual(templates.posts, templates.projects);
  assert.equal(documentRef.documentElement.dataset.entryPreflight, "registered");
  assert.equal(documentRef.documentElement.dataset.mathPreview, "registered");
  assert.equal(
    registerStudioMathPreview({ CMS, createClass: () => assert.fail(), documentRef, h }),
    templates,
  );
  assert.equal(registrations.length, 2);
});

test("requests only potential rich Markdown from the same-origin preview endpoint", async () => {
  assert.equal(STUDIO_MATH_PREVIEW_ENDPOINT, "/studio/math-preview");
  assert.equal(STUDIO_MATH_PREVIEW_DELAY_MS, 240);
  assert.equal(hasPotentialStudioMath("普通 Markdown"), false);
  assert.equal(hasPotentialStudioMath("行内 $E = mc^2$"), true);
  assert.equal(hasPotentialStudioMath("金额 \\$5"), true);
  assert.equal(hasPotentialStudioRichMarkdown("普通 Markdown"), false);
  assert.equal(hasPotentialStudioAudio("> [!audio] 复盘口述"), true);
  assert.equal(hasPotentialStudioAudio("```md\n> [!audio] 示例\n```"), false);
  assert.equal(hasPotentialStudioRichMarkdown("> [!note] 证据"), true);
  assert.equal(hasPotentialStudioGallery("> [!gallery] 步骤证据"), true);
  assert.equal(hasPotentialStudioGallery("```md\n> [!gallery] 示例\n```"), false);
  assert.equal(hasPotentialStudioTable("> [!table] 延迟"), true);
  assert.equal(hasPotentialStudioTable("```md\n> [!table] 示例\n```"), false);
  assert.equal(hasPotentialStudioReferences("> [!references] 延伸阅读"), true);
  assert.equal(hasPotentialStudioReferences("```md\n> [!references] 示例\n```"), false);
  assert.equal(hasPotentialStudioSteps("> [!steps] 发布流程"), true);
  assert.equal(hasPotentialStudioSteps("```md\n> [!steps] 示例\n```"), false);
  assert.equal(hasPotentialStudioRichMarkdown("```md\n> [!note]\n```"), false);
  assert.equal(hasPotentialStudioDiagram("```mermaid\nflowchart LR\nA --> B\n```"), true);
  assert.equal(hasPotentialStudioDiagram("```md\n```mermaid\nA --> B\n```\n```"), false);
  assert.equal(hasPotentialStudioRichMarkdown("~~~Mermaid\nsequenceDiagram\nA->>B: hi\n~~~"), true);
  assert.equal(
    hasPotentialStudioVideo('![完整画面说明](/uploads/demo/demo.mp4 "演示")'),
    true,
  );
  assert.equal(hasPotentialStudioVideo('`![示例](/uploads/demo/demo.mp4 "代码")`'), true);
  assert.equal(hasPotentialStudioVideo('```md\n![示例](/uploads/demo/demo.mp4 "代码")\n```'), false);

  const calls = [];
  const result = await requestStudioMathPreview("$E = mc^2$", {
    fetcher: async (url, options) => {
      calls.push({ options, url });
      return {
      json: async () => ({
        audioCount: 0,
        diagramCount: 0,
        formulaCount: 1,
        galleryCount: 0,
        galleryImageCount: 0,
        html: "<span>math</span>",
        ok: true,
        referenceItemCount: 0,
        referenceListCount: 0,
        procedureCount: 0,
        procedureStepCount: 0,
        tableCount: 0,
        tableDataCellCount: 0,
        taskCompleteCount: 0,
        taskItemCount: 0,
        taskListCount: 0,
        videoCount: 0,
      }),
        ok: true,
        status: 200,
      };
    },
  });
  assert.equal(result.formulaCount, 1);
  assert.equal(calls[0].url, STUDIO_MATH_PREVIEW_ENDPOINT);
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), { markdown: "$E = mc^2$" });
});

test("keeps plain Markdown on the native preview and exposes recoverable rich-content states", async () => {
  let scheduled;
  const template = createStudioMathPreviewTemplate({
    abortControllerFactory: () => ({ abort() {}, signal: undefined }),
    createClass: (specification) => specification,
    fetcher: async () => ({
      json: async () => ({
        audioCount: 1,
        diagramCount: 1,
        formulaCount: 2,
        galleryCount: 1,
        galleryImageCount: 3,
        html: "<div class=\"katex\">ok</div>",
        ok: true,
        referenceItemCount: 2,
        referenceListCount: 1,
        procedureCount: 1,
        procedureStepCount: 2,
        tableCount: 1,
        tableDataCellCount: 6,
        taskCompleteCount: 2,
        taskItemCount: 3,
        taskListCount: 1,
        videoCount: 1,
      }),
      ok: true,
      status: 200,
    }),
    h,
    schedule(callback) {
      scheduled = callback;
      return 7;
    },
  });
  const context = {
    ...template,
    props: {
      entry: entry({ body: "普通 Markdown", description: "摘要", title: "作者草稿" }),
      widgetFor: () => h("p", {}, "原生正文"),
    },
    setState(update) {
      this.state = { ...this.state, ...update };
    },
    state: template.getInitialState(),
  };

  template.componentDidMount.call(context);
  assert.equal(context.state.status, "plain");
  assert.equal(context.state.entryStatus, "checking");
  assert.equal(typeof scheduled, "function");
  assert.match(textContent(template.render.call(context)), /普通 Markdown 预览.*原生正文/u);

  context.props = {
    ...context.props,
    entry: entry({ body: "$x$\n\n$$y$$", description: "摘要", title: "作者草稿" }),
  };
  template.scheduleMathPreview.call(context, "$x$\n\n$$y$$");
  assert.equal(context.state.status, "loading");
  await template.loadMathPreview.call(context, "$x$\n\n$$y$$", context.previewGeneration);
  assert.equal(context.state.status, "ready");
  assert.equal(context.state.formulaCount, 2);
  assert.equal(context.state.audioCount, 1);
  assert.equal(context.state.diagramCount, 1);
  assert.equal(context.state.galleryCount, 1);
  assert.equal(context.state.galleryImageCount, 3);
  assert.equal(context.state.tableCount, 1);
  assert.equal(context.state.tableDataCellCount, 6);
  assert.equal(context.state.taskListCount, 1);
  assert.equal(context.state.taskItemCount, 3);
  assert.equal(context.state.taskCompleteCount, 2);
  assert.equal(context.state.referenceListCount, 1);
  assert.equal(context.state.referenceItemCount, 2);
  assert.equal(context.state.procedureCount, 1);
  assert.equal(context.state.procedureStepCount, 2);
  assert.equal(context.state.videoCount, 1);
  const readyTree = template.render.call(context);
  assert.match(
    textContent(readyTree),
    /1 段音频 \/ 含文字稿、2 个公式、1 张图表、1 组画廊 \/ 3 张图片、1 个表格 \/ 6 个数据单元格、1 个任务清单 \/ 2 项已完成 \/ 3 项总计、1 个参考资料清单 \/ 2 条来源、1 个步骤流程 \/ 2 步、1 段视频已按生产规则渲染/u,
  );

  context.state = {
    ...context.state,
    html: "",
    issue: { line: 7, message: "Expected '}'" },
    status: "invalid",
  };
  const invalidTree = template.render.call(context);
  assert.equal(invalidTree.props["data-math-preview-state"], "invalid");
  assert.match(textContent(invalidTree), /公式尚不能发布.*第 7 行.*Expected/u);
  assert.equal(
    getStudioMathPreviewStatus({ issue: { kind: "audio" }, status: "invalid" }).label,
    "AUDIO / NEEDS FIX",
  );
  assert.equal(
    getStudioMathPreviewStatus({ status: "unavailable" }).label,
    "RICH MARKDOWN / PREVIEW UNAVAILABLE",
  );
  assert.equal(
    getStudioMathPreviewStatus({ issue: { kind: "diagram" }, status: "invalid" }).label,
    "DIAGRAM / NEEDS FIX",
  );
  assert.equal(
    getStudioMathPreviewStatus({ issue: { kind: "video" }, status: "invalid" }).label,
    "VIDEO / NEEDS FIX",
  );
  assert.equal(
    getStudioMathPreviewStatus({ issue: { kind: "gallery" }, status: "invalid" }).label,
    "GALLERY / NEEDS FIX",
  );
  assert.equal(
    getStudioMathPreviewStatus({ issue: { kind: "table" }, status: "invalid" }).label,
    "TABLE / NEEDS FIX",
  );
  assert.equal(
    getStudioMathPreviewStatus({ issue: { kind: "task-list" }, status: "invalid" }).label,
    "TASKS / NEEDS FIX",
  );
  assert.equal(
    getStudioMathPreviewStatus({ issue: { kind: "references" }, status: "invalid" }).label,
    "REFERENCES / NEEDS FIX",
  );
  assert.equal(
    getStudioMathPreviewStatus({ issue: { kind: "steps" }, status: "invalid" }).label,
    "STEPS / NEEDS FIX",
  );
});

test("keeps only the latest entry preflight and recovers from network failure", async () => {
  const pending = [];
  let failNext = false;
  const template = createStudioMathPreviewTemplate({
    abortControllerFactory: () => ({ abort() {}, signal: undefined }),
    collection: "posts",
    createClass: (specification) => specification,
    fetcher: async () => {
      if (failNext) throw new Error("offline");
      return new Promise((resolve) => pending.push(resolve));
    },
    h,
  });
  const context = {
    ...template,
    props: {
      entry: entry({ body: "正文", title: "快速编辑" }),
      widgetFor: () => h("p", {}, "正文"),
    },
    setState(update) {
      this.state = { ...this.state, ...update };
    },
    state: template.getInitialState(),
  };

  context.entryGeneration = 1;
  const stale = template.loadEntryPreflight.call(context, { title: "旧标题" }, 1);
  context.entryGeneration = 2;
  const current = template.loadEntryPreflight.call(context, { title: "新标题" }, 2);
  pending[1]({
    json: async () => ({
      facts: [{ label: "PATH", value: "/posts/new" }],
      issueCount: 0,
      issues: [],
      note: "当前字段已通过",
      ok: true,
    }),
    ok: true,
    status: 200,
  });
  await current;
  pending[0]({
    json: async () => ({
      facts: [],
      issueCount: 1,
      issues: [{ field: "title", message: "旧问题" }],
      note: "旧结果",
      ok: false,
    }),
    ok: false,
    status: 422,
  });
  await stale;

  assert.equal(context.state.entryStatus, "ready");
  assert.equal(context.state.entryFacts[0].value, "/posts/new");
  assert.doesNotMatch(textContent(template.render.call(context)), /旧问题/u);

  failNext = true;
  context.entryGeneration = 3;
  await template.loadEntryPreflight.call(context, { title: "离线" }, 3);
  assert.equal(context.state.entryStatus, "unavailable");
  assert.match(textContent(template.render.call(context)), /发布清单暂不可用.*内容没有丢失/u);
});
