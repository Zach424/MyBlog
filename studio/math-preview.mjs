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

export function hasPotentialStudioVideo(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
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
    if (/!\[[^\]]*\]\([^\r\n)]*\.mp4(?:[?#\s)]|$)/iu.test(line)) return true;
  }
  return false;
}

export function hasPotentialStudioAudio(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
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
    if (/^[ \t]*(?:>[ \t]*)+\[!audio\](?=[+\-\s]|$)/iu.test(sourceLine)) {
      return true;
    }
  }
  return false;
}

export function hasPotentialStudioGallery(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
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
    if (/^[ \t]*(?:>[ \t]*)+\[!gallery\](?:[+\-]|[ \t]|$)/iu.test(sourceLine)) {
      return true;
    }
  }
  return false;
}

export function hasPotentialStudioTable(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
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
    if (/^[ \t]*(?:>[ \t]*)+\[!table\](?:[+\-]|[ \t]|$)/iu.test(sourceLine)) {
      return true;
    }
  }
  return false;
}

export function hasPotentialStudioTaskList(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
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
    if (/^[ \t]*(?:>[ \t]*)+\[!tasks\](?:[+\-]|[ \t]|$)/iu.test(sourceLine)) {
      return true;
    }
  }
  return false;
}

export function hasPotentialStudioReferences(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
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
    if (/^[ \t]*(?:>[ \t]*)+\[!references\](?:[+\-]|[ \t]|$)/iu.test(sourceLine)) {
      return true;
    }
  }
  return false;
}

export function hasPotentialStudioSteps(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
    if (fenceCharacter) {
      if (
        new RegExp(`^[ \\t]*${fenceCharacter}{${fenceLength},}[ \\t]*$`, "u").test(line)
      ) {
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
    if (/^[ \t]*(?:>[ \t]*)+\[!steps\](?:[+\-]|[ \t]|$)/iu.test(sourceLine)) {
      return true;
    }
  }
  return false;
}

export function hasPotentialStudioGlossary(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
    if (fenceCharacter) {
      if (
        new RegExp(`^[ \\t]*${fenceCharacter}{${fenceLength},}[ \\t]*$`, "u").test(line)
      ) {
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
    if (/^[ \t]*(?:>[ \t]*)+\[!glossary\](?:[+\-]|[ \t]|$)/iu.test(sourceLine)) {
      return true;
    }
  }
  return false;
}

export function hasPotentialStudioFaq(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
    if (fenceCharacter) {
      if (new RegExp(`^[ \\t]*${fenceCharacter}{${fenceLength},}[ \\t]*$`, "u").test(line)) {
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
    if (/^[ \t]*(?:>[ \t]*)+\[!faq\](?:[+\-]|[ \t]|$)/iu.test(sourceLine)) return true;
  }
  return false;
}

export function hasPotentialStudioFileTree(markdown) {
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const sourceLine of textValue(markdown).split(/\r?\n/u)) {
    const line = sourceLine.replace(/^[ \t]*(?:>[ \t]*)+/u, "");
    const fence = /^[ \t]*(`{3,}|~{3,})/u.exec(line);
    if (fenceCharacter) {
      if (new RegExp(`^[ \\t]*${fenceCharacter}{${fenceLength},}[ \\t]*$`, "u").test(line)) {
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
    if (/^[ \t]*(?:>[ \t]*)+\[!filetree\](?:[+\-]|[ \t]|$)/iu.test(sourceLine)) return true;
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
    hasPotentialStudioAudio(markdown) ||
    hasPotentialStudioGallery(markdown) ||
    hasPotentialStudioTable(markdown) ||
    hasPotentialStudioTaskList(markdown) ||
    hasPotentialStudioReferences(markdown) ||
    hasPotentialStudioSteps(markdown) ||
    hasPotentialStudioGlossary(markdown) ||
    hasPotentialStudioFaq(markdown) ||
    hasPotentialStudioFileTree(markdown) ||
    hasPotentialStudioCallout(markdown) ||
    hasPotentialStudioDiagram(markdown) ||
    hasPotentialStudioVideo(markdown)
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
      if (state.audioCount > 0) evidence.push(`${state.audioCount} 段音频 / 含文字稿`);
      if (state.formulaCount > 0) evidence.push(`${state.formulaCount} 个公式`);
      if (state.calloutCount > 0) evidence.push(`${state.calloutCount} 个信息块`);
      if (state.diagramCount > 0) evidence.push(`${state.diagramCount} 张图表`);
      if (state.galleryCount > 0) {
        evidence.push(`${state.galleryCount} 组画廊 / ${state.galleryImageCount} 张图片`);
      }
      if (state.tableCount > 0) {
        evidence.push(`${state.tableCount} 个表格 / ${state.tableDataCellCount} 个数据单元格`);
      }
      if (state.taskListCount > 0) {
        evidence.push(
          `${state.taskListCount} 个任务清单 / ${state.taskCompleteCount} 项已完成 / ${state.taskItemCount} 项总计`,
        );
      }
      if (state.referenceListCount > 0) {
        evidence.push(
          `${state.referenceListCount} 个参考资料清单 / ${state.referenceItemCount} 条来源`,
        );
      }
      if (state.procedureCount > 0) {
        evidence.push(
          `${state.procedureCount} 个步骤流程 / ${state.procedureStepCount} 步`,
        );
      }
      if (state.glossaryCount > 0) {
        evidence.push(
          `${state.glossaryCount} 个术语定义表 / ${state.glossaryTermCount} 个术语`,
        );
      }
      if (state.faqCount > 0) {
        evidence.push(`${state.faqCount} 个 FAQ / ${state.faqQuestionCount} 个问题`);
      }
      if (state.fileTreeCount > 0) {
        evidence.push(
          `${state.fileTreeCount} 个项目文件树 / ${state.fileTreeNodeCount} 个节点 / 最大 ${state.fileTreeMaxDepth} 层`,
        );
      }
      if (state.videoCount > 0) evidence.push(`${state.videoCount} 段视频`);
      return {
        detail: "这里与正式页面共享 remark、rehype、受限 KaTeX、Callout、画廊、技术表格、只读任务清单、参考资料清单、步骤流程、术语定义表、FAQ、项目文件树、Mermaid、本地音频与本地视频渲染配置。",
        label: "RICH MARKDOWN / VERIFIED",
        title: `${evidence.join("、")}已按生产规则渲染`,
      };
    }
    case "invalid": {
      const line = state.issue?.line ? `第 ${state.issue.line} 行：` : "";
      const isDiagram = state.issue?.kind === "diagram";
      const isGallery = state.issue?.kind === "gallery";
      const isTable = state.issue?.kind === "table";
      const isTaskList = state.issue?.kind === "task-list";
      const isVideo = state.issue?.kind === "video";
      const isAudio = state.issue?.kind === "audio";
      const isReferences = state.issue?.kind === "references";
      const isSteps = state.issue?.kind === "steps";
      const isGlossary = state.issue?.kind === "glossary";
      const isFaq = state.issue?.kind === "faq";
      const isFileTree = state.issue?.kind === "filetree";
      return {
        detail: `${line}${state.issue?.message || "请检查增强 Markdown 语法。"}`,
        label: isFileTree
          ? "FILE TREE / NEEDS FIX"
          : isFaq
          ? "FAQ / NEEDS FIX"
          : isGlossary
          ? "GLOSSARY / NEEDS FIX"
          : isSteps
          ? "STEPS / NEEDS FIX"
          : isReferences
          ? "REFERENCES / NEEDS FIX"
          : isAudio
          ? "AUDIO / NEEDS FIX"
          : isTaskList
          ? "TASKS / NEEDS FIX"
          : isTable
          ? "TABLE / NEEDS FIX"
          : isGallery
          ? "GALLERY / NEEDS FIX"
          : isVideo
          ? "VIDEO / NEEDS FIX"
          : isDiagram
            ? "DIAGRAM / NEEDS FIX"
            : "FORMULA / NEEDS FIX",
        title: isFileTree
          ? "项目文件树尚不能发布"
          : isFaq
          ? "FAQ 尚不能发布"
          : isGlossary
          ? "术语定义表尚不能发布"
          : isSteps
          ? "步骤流程尚不能发布"
          : isReferences
          ? "参考资料清单尚不能发布"
          : isAudio
          ? "音频尚不能发布"
          : isTaskList
          ? "任务清单尚不能发布"
          : isTable
          ? "技术表格尚不能发布"
          : isGallery
          ? "画廊尚不能发布"
          : isVideo
            ? "视频尚不能发布"
            : isDiagram
              ? "图表尚不能发布"
              : "公式尚不能发布",
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
        audioCount: 0,
        entryFacts: [],
        entryIssueCount: 0,
        entryIssues: [],
        entryNote: "",
        entryStatus: "preparing",
        calloutCount: 0,
        diagramCount: 0,
        faqCount: 0,
        faqQuestionCount: 0,
        fileTreeCount: 0,
        fileTreeMaxDepth: 0,
        fileTreeNodeCount: 0,
        formulaCount: 0,
        galleryCount: 0,
        galleryImageCount: 0,
        glossaryCount: 0,
        glossaryTermCount: 0,
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
          audioCount: 0,
          calloutCount: 0,
          diagramCount: 0,
          faqCount: 0,
          faqQuestionCount: 0,
          fileTreeCount: 0,
          fileTreeMaxDepth: 0,
          fileTreeNodeCount: 0,
          formulaCount: 0,
          galleryCount: 0,
          galleryImageCount: 0,
          glossaryCount: 0,
          glossaryTermCount: 0,
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
            audioCount: result.audioCount,
            calloutCount: result.calloutCount,
            diagramCount: result.diagramCount,
            faqCount: result.faqCount,
            faqQuestionCount: result.faqQuestionCount,
            fileTreeCount: result.fileTreeCount,
            fileTreeMaxDepth: result.fileTreeMaxDepth,
            fileTreeNodeCount: result.fileTreeNodeCount,
            formulaCount: result.formulaCount,
            galleryCount: result.galleryCount,
            galleryImageCount: result.galleryImageCount,
            glossaryCount: result.glossaryCount,
            glossaryTermCount: result.glossaryTermCount,
            referenceItemCount: result.referenceItemCount,
            referenceListCount: result.referenceListCount,
            procedureCount: result.procedureCount,
            procedureStepCount: result.procedureStepCount,
            tableCount: result.tableCount,
            tableDataCellCount: result.tableDataCellCount,
            taskCompleteCount: result.taskCompleteCount,
            taskItemCount: result.taskItemCount,
            taskListCount: result.taskListCount,
            videoCount: result.videoCount,
            html: result.html,
            issue: undefined,
            status: "ready",
          });
        } else {
          this.setState({
            audioCount: 0,
            calloutCount: 0,
            diagramCount: 0,
            faqCount: 0,
            faqQuestionCount: 0,
            fileTreeCount: 0,
            fileTreeMaxDepth: 0,
            fileTreeNodeCount: 0,
            formulaCount: 0,
            galleryCount: 0,
            galleryImageCount: 0,
            glossaryCount: 0,
            glossaryTermCount: 0,
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
            html: "",
            issue: result.issue,
            status: "invalid",
          });
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
        if (this.previewDisposed || generation !== this.previewGeneration) return;
        this.setState({
          audioCount: 0,
          calloutCount: 0,
          diagramCount: 0,
          faqCount: 0,
          faqQuestionCount: 0,
          fileTreeCount: 0,
          fileTreeMaxDepth: 0,
          fileTreeNodeCount: 0,
          formulaCount: 0,
          galleryCount: 0,
          galleryImageCount: 0,
          glossaryCount: 0,
          glossaryTermCount: 0,
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
