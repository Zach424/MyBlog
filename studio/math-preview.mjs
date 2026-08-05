export const STUDIO_MATH_PREVIEW_ENDPOINT = "/studio/math-preview";
export const STUDIO_MATH_PREVIEW_DELAY_MS = 240;

const REGISTRATION_KEY = "__MYBLOG_MATH_PREVIEW_TEMPLATE__";
const COLLECTIONS = ["posts", "projects"];

function textValue(value) {
  return typeof value === "string" ? value : "";
}

function readEntryField(props, field) {
  return textValue(props?.entry?.getIn?.(["data", field]));
}

export function hasPotentialStudioMath(markdown) {
  return textValue(markdown).includes("$");
}

export async function requestStudioMathPreview(
  markdown,
  { fetcher = globalThis.fetch, signal } = {},
) {
  if (typeof fetcher !== "function") {
    throw new Error("Studio 公式预览缺少 fetch 运行时。");
  }

  const response = await fetcher(STUDIO_MATH_PREVIEW_ENDPOINT, {
    body: JSON.stringify({ markdown }),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal,
  });
  const payload = await response.json();
  if (!payload || typeof payload !== "object" || typeof payload.ok !== "boolean") {
    throw new Error("Studio 公式预览返回了未知响应。");
  }
  if (!response.ok && response.status !== 422) {
    throw new Error(payload.message || `Studio 公式预览失败（HTTP ${response.status}）。`);
  }
  return payload;
}

export function getStudioMathPreviewStatus(state) {
  switch (state?.status) {
    case "plain":
      return {
        detail: "正文没有数学公式，继续使用 Decap 原生 Markdown 预览。",
        label: "STANDARD / MARKDOWN",
        title: "普通 Markdown 预览",
      };
    case "loading":
      return {
        detail: "仅发送当前正文到同源预览端点，不会保存或发布。",
        label: "FORMULA / CHECKING",
        title: "正在按发布规则校验公式",
      };
    case "ready":
      return {
        detail: "这里与正式页面共享 remark、rehype 和受限 KaTeX 配置。",
        label: "FORMULA / VERIFIED",
        title: `${state.formulaCount} 个公式已按生产规则渲染`,
      };
    case "invalid": {
      const line = state.issue?.line ? `第 ${state.issue.line} 行：` : "";
      return {
        detail: `${line}${state.issue?.message || "请检查公式语法。"}`,
        label: "FORMULA / NEEDS FIX",
        title: "公式尚不能发布",
      };
    }
    case "unavailable":
      return {
        detail: "Markdown 没有丢失；请稍后重试。保存后的构建门仍会再次校验。",
        label: "FORMULA / PREVIEW UNAVAILABLE",
        title: "公式预览服务暂不可用",
      };
    default:
      return {
        detail: "正在准备当前草稿。",
        label: "PREVIEW / PREPARING",
        title: "准备作者预览",
      };
  }
}

export function createStudioMathPreviewTemplate({
  abortControllerFactory = () => new AbortController(),
  cancelSchedule = globalThis.clearTimeout,
  createClass,
  fetcher = globalThis.fetch,
  h,
  schedule = globalThis.setTimeout,
} = {}) {
  if (typeof createClass !== "function" || typeof h !== "function") {
    throw new Error("Studio 公式预览缺少 Decap React 运行时。");
  }

  return createClass({
    displayName: "MyBlogMathPreviewTemplate",

    getInitialState() {
      return {
        formulaCount: 0,
        html: "",
        issue: undefined,
        status: "preparing",
      };
    },

    componentDidMount() {
      this.previewDisposed = false;
      this.scheduleMathPreview(readEntryField(this.props, "body"));
    },

    componentDidUpdate(previousProps) {
      const previousBody = readEntryField(previousProps, "body");
      const body = readEntryField(this.props, "body");
      if (previousBody !== body) this.scheduleMathPreview(body);
    },

    componentWillUnmount() {
      this.previewDisposed = true;
      this.cancelMathPreview();
    },

    cancelMathPreview() {
      if (this.previewTimer !== undefined && typeof cancelSchedule === "function") {
        cancelSchedule(this.previewTimer);
      }
      this.previewTimer = undefined;
      this.previewAbortController?.abort();
      this.previewAbortController = undefined;
    },

    scheduleMathPreview(body) {
      this.cancelMathPreview();
      this.previewGeneration = (this.previewGeneration || 0) + 1;
      const generation = this.previewGeneration;

      if (!hasPotentialStudioMath(body)) {
        this.setState({
          formulaCount: 0,
          html: "",
          issue: undefined,
          status: "plain",
        });
        return;
      }

      this.setState({ issue: undefined, status: "loading" });
      this.previewTimer = schedule(() => {
        this.previewTimer = undefined;
        void this.loadMathPreview(body, generation);
      }, STUDIO_MATH_PREVIEW_DELAY_MS);
    },

    async loadMathPreview(body, generation) {
      const controller = abortControllerFactory();
      this.previewAbortController = controller;
      try {
        const result = await requestStudioMathPreview(body, {
          fetcher,
          signal: controller?.signal,
        });
        if (this.previewDisposed || generation !== this.previewGeneration) return;
        if (result.ok) {
          this.setState({
            formulaCount: result.formulaCount,
            html: result.html,
            issue: undefined,
            status: "ready",
          });
        } else {
          this.setState({
            formulaCount: 0,
            html: "",
            issue: result.issue,
            status: "invalid",
          });
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
        if (this.previewDisposed || generation !== this.previewGeneration) return;
        this.setState({
          formulaCount: 0,
          html: "",
          issue: undefined,
          status: "unavailable",
        });
      } finally {
        if (generation === this.previewGeneration) this.previewAbortController = undefined;
      }
    },

    render() {
      const title = readEntryField(this.props, "title") || "未命名草稿";
      const description = readEntryField(this.props, "description");
      const status = getStudioMathPreviewStatus(this.state);
      const usesServerPreview = this.state.status === "ready";
      const fallback = this.props.widgetFor?.("body") ?? null;
      const statusRole = this.state.status === "invalid" ? "alert" : "status";

      return h(
        "article",
        {
          "aria-busy": this.state.status === "loading" ? "true" : "false",
          className: "studio-preview-shell",
          "data-math-preview-state": this.state.status,
        },
        h(
          "header",
          { className: "studio-preview-header" },
          h("p", { className: "studio-preview-eyebrow" }, "AUTHOR PROOF / GIT DRAFT"),
          h("h1", {}, title),
          description ? h("p", { className: "studio-preview-description" }, description) : null,
        ),
        h(
          "div",
          {
            "aria-live": "polite",
            className: "studio-preview-status",
            "data-state": this.state.status,
            role: statusRole,
          },
          h("p", { className: "studio-preview-status-label" }, status.label),
          h("strong", {}, status.title),
          h("span", {}, status.detail),
        ),
        usesServerPreview
          ? h("div", {
              className: "studio-preview-rendered",
              dangerouslySetInnerHTML: { __html: this.state.html },
            })
          : h("div", { className: "studio-preview-fallback" }, fallback),
      );
    },
  });
}

export function registerStudioMathPreview({
  CMS = globalThis.CMS,
  createClass = globalThis.createClass,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerPreviewTemplate !== "function") {
    throw new Error("Studio 公式预览无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];

  const template = createStudioMathPreviewTemplate({ createClass, h });
  for (const collection of COLLECTIONS) {
    CMS.registerPreviewTemplate(collection, template);
  }
  CMS[REGISTRATION_KEY] = template;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.mathPreview = "registered";
  return template;
}
