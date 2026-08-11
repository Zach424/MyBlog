import {
  getStudioEntryPreflightStatus,
  readStudioEntryField,
  requestStudioEntryPreflight,
  serializeStudioEntry,
  studioEntryFieldLabel,
  studioEntrySignature,
  STUDIO_ENTRY_PREFLIGHT_DELAY_MS,
} from "./entry-preflight.mjs";

export const STUDIO_MATH_PREVIEW_ENDPOINT = "/studio/math-preview";
export const STUDIO_MATH_PREVIEW_DELAY_MS = 240;

const REGISTRATION_KEY = "__MYBLOG_MATH_PREVIEW_TEMPLATE__";
const COLLECTIONS = ["posts", "projects"];

function textValue(value) {
  return typeof value === "string" ? value : "";
}

export function hasPotentialStudioMath(markdown) {
  return textValue(markdown).includes("$");
}

export function hasPotentialStudioDiagram(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const opening = /^[ \t]*(`{3,}|~{3,})(?:[ \t]*([^\s`~]+))?/u.exec(line);
    if (fenceCharacter) {
      const closing = /^[ \t]*(`{3,}|~{3,})[ \t]*$/u.exec(line);
      if (
        closing &&
        closing[1][0] === fenceCharacter &&
        closing[1].length >= fenceLength
      ) {
        fenceCharacter = "";
        fenceLength = 0;
      }
      continue;
    }
    if (!opening) continue;
    if (opening[2]?.toLowerCase() === "mermaid") return true;
    fenceCharacter = opening[1][0];
    fenceLength = opening[1].length;
  }

  return false;
}

function hasPotentialStudioCallout(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^(`{3,}|~{3,})/u.exec(line);
    if (fenceCharacter) {
      if (fence && fence[1][0] === fenceCharacter && fence[1].length >= fenceLength) {
        fenceCharacter = "";
        fenceLength = 0;
      }
      continue;
    }
    if (fence) {
      fenceCharacter = fence[1][0];
      fenceLength = fence[1].length;
      continue;
    }
    if (/^[ \t]*(?:>[ \t]*)+\[![a-z][a-z0-9-]{0,31}\][+-]?(?:[ \t]|$)/iu.test(sourceLine)) {
      return true;
    }
  }

  return false;
}

export function hasPotentialStudioRichMarkdown(markdown) {
  return (
    hasPotentialStudioMath(markdown) ||
    hasPotentialStudioCallout(markdown) ||
    hasPotentialStudioDiagram(markdown)
  );
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
        detail: "正文没有公式或 Callout，继续使用 Decap 原生 Markdown 预览。",
        label: "STANDARD / MARKDOWN",
        title: "普通 Markdown 预览",
      };
    case "loading":
      return {
        detail: "仅发送当前正文到同源预览端点，不会保存或发布。",
        label: "RICH MARKDOWN / CHECKING",
        title: "正在按发布规则渲染增强内容",
      };
    case "ready": {
      const evidence = [];
      if (state.formulaCount > 0) evidence.push(`${state.formulaCount} 个公式`);
      if (state.calloutCount > 0) evidence.push(`${state.calloutCount} 个信息块`);
      if (state.diagramCount > 0) evidence.push(`${state.diagramCount} 张图表`);
      return {
        detail: "这里与正式页面共享 remark、rehype、受限 KaTeX、Callout 与 Mermaid 服务端渲染配置。",
        label: "RICH MARKDOWN / VERIFIED",
        title: `${evidence.join("、")}已按生产规则渲染`,
      };
    }
    case "invalid": {
      const line = state.issue?.line ? `第 ${state.issue.line} 行：` : "";
      const isDiagram = state.issue?.kind === "diagram";
      return {
        detail: `${line}${state.issue?.message || "请检查增强 Markdown 语法。"}`,
        label: isDiagram ? "DIAGRAM / NEEDS FIX" : "FORMULA / NEEDS FIX",
        title: isDiagram ? "图表尚不能发布" : "公式尚不能发布",
      };
    }
    case "unavailable":
      return {
        detail: "Markdown 没有丢失；请稍后重试。保存后的构建门仍会再次校验。",
        label: "RICH MARKDOWN / PREVIEW UNAVAILABLE",
        title: "增强预览服务暂不可用",
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
  collection = "posts",
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
        entryFacts: [],
        entryIssueCount: 0,
        entryIssues: [],
        entryNote: "",
        entryStatus: "preparing",
        calloutCount: 0,
        diagramCount: 0,
        formulaCount: 0,
        html: "",
        issue: undefined,
        status: "preparing",
      };
    },

    componentDidMount() {
      this.previewDisposed = false;
      this.scheduleMathPreview(readStudioEntryField(this.props, "body"));
      this.scheduleEntryPreflight(serializeStudioEntry(this.props, collection));
    },

    componentDidUpdate(previousProps) {
      const previousBody = readStudioEntryField(previousProps, "body");
      const body = readStudioEntryField(this.props, "body");
      if (previousBody !== body) this.scheduleMathPreview(body);
      if (studioEntrySignature(previousProps, collection) !== studioEntrySignature(this.props, collection)) {
        this.scheduleEntryPreflight(serializeStudioEntry(this.props, collection));
      }
    },

    componentWillUnmount() {
      this.previewDisposed = true;
      this.cancelMathPreview();
      this.cancelEntryPreflight();
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

      if (!hasPotentialStudioRichMarkdown(body)) {
        this.setState({
          calloutCount: 0,
          diagramCount: 0,
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
            calloutCount: result.calloutCount,
            diagramCount: result.diagramCount,
            formulaCount: result.formulaCount,
            html: result.html,
            issue: undefined,
            status: "ready",
          });
        } else {
          this.setState({
            calloutCount: 0,
            diagramCount: 0,
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
          calloutCount: 0,
          diagramCount: 0,
          formulaCount: 0,
          html: "",
          issue: undefined,
          status: "unavailable",
        });
      } finally {
        if (generation === this.previewGeneration) this.previewAbortController = undefined;
      }
    },

    cancelEntryPreflight() {
      if (this.entryTimer !== undefined && typeof cancelSchedule === "function") {
        cancelSchedule(this.entryTimer);
      }
      this.entryTimer = undefined;
      this.entryAbortController?.abort();
      this.entryAbortController = undefined;
    },

    scheduleEntryPreflight(fields) {
      this.cancelEntryPreflight();
      this.entryGeneration = (this.entryGeneration || 0) + 1;
      const generation = this.entryGeneration;
      this.setState({ entryStatus: "checking" });
      this.entryTimer = schedule(() => {
        this.entryTimer = undefined;
        void this.loadEntryPreflight(fields, generation);
      }, STUDIO_ENTRY_PREFLIGHT_DELAY_MS);
    },

    async loadEntryPreflight(fields, generation) {
      const controller = abortControllerFactory();
      this.entryAbortController = controller;
      try {
        const result = await requestStudioEntryPreflight(collection, fields, {
          fetcher,
          signal: controller?.signal,
        });
        if (this.previewDisposed || generation !== this.entryGeneration) return;
        this.setState({
          entryFacts: result.facts,
          entryIssueCount: result.issueCount,
          entryIssues: result.issues,
          entryNote: result.note,
          entryStatus: result.ok ? "ready" : "invalid",
        });
      } catch (error) {
        if (error?.name === "AbortError") return;
        if (this.previewDisposed || generation !== this.entryGeneration) return;
        this.setState({
          entryFacts: [],
          entryIssueCount: 0,
          entryIssues: [],
          entryNote: "",
          entryStatus: "unavailable",
        });
      } finally {
        if (generation === this.entryGeneration) this.entryAbortController = undefined;
      }
    },

    render() {
      const title = readStudioEntryField(this.props, "title") || "未命名草稿";
      const description = readStudioEntryField(this.props, "description");
      const status = getStudioMathPreviewStatus(this.state);
      const entryStatus = getStudioEntryPreflightStatus(this.state);
      const usesServerPreview = this.state.status === "ready";
      const fallback = this.props.widgetFor?.("body") ?? null;
      const statusRole = this.state.status === "invalid" ? "alert" : "status";
      const entryStatusRole = this.state.entryStatus === "invalid" ? "alert" : "status";
      const visibleIssues = this.state.entryIssues.slice(0, 8);

      return h(
        "article",
        {
          "aria-busy":
            this.state.status === "loading" || this.state.entryStatus === "checking"
              ? "true"
              : "false",
          className: "studio-preview-shell",
          "data-entry-preflight-state": this.state.entryStatus,
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
          "section",
          {
            "aria-live": "polite",
            className: "studio-entry-ledger",
            "data-state": this.state.entryStatus,
            role: entryStatusRole,
          },
          h(
            "div",
            { className: "studio-entry-ledger-heading" },
            h("p", { className: "studio-preview-status-label" }, entryStatus.label),
            h("strong", {}, entryStatus.title),
            h("span", {}, entryStatus.detail),
          ),
          this.state.entryFacts.length > 0
            ? h(
                "dl",
                { className: "studio-entry-facts" },
                ...this.state.entryFacts.flatMap((fact) => [
                  h("div", { className: "studio-entry-fact", key: `${fact.label}-fact` },
                    h("dt", {}, fact.label),
                    h("dd", {}, fact.value),
                  ),
                ]),
              )
            : null,
          visibleIssues.length > 0
            ? h(
                "ol",
                { className: "studio-entry-issues" },
                ...visibleIssues.map((issue, index) =>
                  h(
                    "li",
                    { key: `${issue.field}-${index}` },
                    h("span", {}, studioEntryFieldLabel(issue.field)),
                    h("p", {}, issue.message),
                  ),
                ),
              )
            : null,
          this.state.entryIssueCount > visibleIssues.length
            ? h(
                "p",
                { className: "studio-entry-more" },
                `另有 ${this.state.entryIssueCount - visibleIssues.length} 项；继续修改后会自动收敛。`,
              )
            : null,
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

  const templates = {};
  for (const collection of COLLECTIONS) {
    const template = createStudioMathPreviewTemplate({ collection, createClass, h });
    templates[collection] = template;
    CMS.registerPreviewTemplate(collection, template);
  }
  CMS[REGISTRATION_KEY] = templates;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) {
    dataset.entryPreflight = "registered";
    dataset.mathPreview = "registered";
  }
  return templates;
}
