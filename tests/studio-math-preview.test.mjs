import assert from "node:assert/strict";
import test from "node:test";
import {
  createStudioMathPreviewTemplate,
  getStudioMathPreviewStatus,
  hasPotentialStudioMath,
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

test("registers one idempotent formula preview template for posts and projects", () => {
  const registrations = [];
  const CMS = {
    registerPreviewTemplate(collection, template) {
      registrations.push({ collection, template });
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const template = registerStudioMathPreview({
    CMS,
    createClass: (specification) => specification,
    documentRef,
    h,
  });

  assert.deepEqual(
    registrations.map(({ collection }) => collection),
    ["posts", "projects"],
  );
  assert.ok(registrations.every((registration) => registration.template === template));
  assert.equal(documentRef.documentElement.dataset.mathPreview, "registered");
  assert.equal(
    registerStudioMathPreview({ CMS, createClass: () => assert.fail(), documentRef, h }),
    template,
  );
  assert.equal(registrations.length, 2);
});

test("requests only potential formula content from the same-origin preview endpoint", async () => {
  assert.equal(STUDIO_MATH_PREVIEW_ENDPOINT, "/studio/math-preview");
  assert.equal(STUDIO_MATH_PREVIEW_DELAY_MS, 240);
  assert.equal(hasPotentialStudioMath("普通 Markdown"), false);
  assert.equal(hasPotentialStudioMath("行内 $E = mc^2$"), true);
  assert.equal(hasPotentialStudioMath("金额 \\$5"), true);

  const calls = [];
  const result = await requestStudioMathPreview("$E = mc^2$", {
    fetcher: async (url, options) => {
      calls.push({ options, url });
      return {
        json: async () => ({ formulaCount: 1, html: "<span>math</span>", ok: true }),
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

test("keeps plain Markdown on the native preview and exposes recoverable formula states", async () => {
  let scheduled;
  const template = createStudioMathPreviewTemplate({
    abortControllerFactory: () => ({ abort() {}, signal: undefined }),
    createClass: (specification) => specification,
    fetcher: async () => ({
      json: async () => ({ formulaCount: 2, html: "<div class=\"katex\">ok</div>", ok: true }),
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
  assert.equal(scheduled, undefined);
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
  const readyTree = template.render.call(context);
  assert.match(textContent(readyTree), /2 个公式已按生产规则渲染/u);

  context.state = {
    ...context.state,
    html: "",
    issue: { line: 7, message: "Expected '}'" },
    status: "invalid",
  };
  const invalidTree = template.render.call(context);
  assert.equal(invalidTree.props["data-math-preview-state"], "invalid");
  assert.match(textContent(invalidTree), /公式尚不能发布.*第 7 行.*Expected/u);
  assert.equal(getStudioMathPreviewStatus({ status: "unavailable" }).label, "FORMULA / PREVIEW UNAVAILABLE");
});
