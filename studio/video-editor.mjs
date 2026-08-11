export const STUDIO_VIDEO_EDITOR_ID = "myblog-video";
export const STUDIO_VIDEO_MAX_FILE_SIZE = 12 * 1024 * 1024;
export const STUDIO_VIDEO_PATTERN =
  /^!\[([^\]\r\n]{1,320})\]\((\/uploads\/[a-z0-9]+(?:-[a-z0-9]+)*\/[^()\s]+\.mp4) "([^"\r\n]{1,120})"\)$/mu;

const REGISTRATION_KEY = "__MYBLOG_VIDEO_EDITOR_COMPONENT__";

function normalizedData(data) {
  return {
    description: typeof data?.description === "string" ? data.description.trim() : "",
    source: typeof data?.source === "string" ? data.source.trim() : "",
    title: typeof data?.title === "string" ? data.title.trim() : "",
  };
}

function serializeVideo(data) {
  const normalized = normalizedData(data);
  const markdown = `![${normalized.description}](${normalized.source} "${normalized.title}")`;
  if (!STUDIO_VIDEO_PATTERN.test(markdown)) {
    throw new Error(
      "视频块字段无效：请使用归档后的本地 .mp4 路径，并填写单行标题与文字说明。",
    );
  }
  return markdown;
}

export function createStudioVideoEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") {
    throw new Error("Studio 视频组件缺少 React 运行时。");
  }

  return {
    id: STUDIO_VIDEO_EDITOR_ID,
    label: "本地静音视频",
    fields: [
      {
        choose_url: false,
        hint: "只上传 12 MiB 以内、90 秒以内、1080p、fast-start、无音轨的 H.264 MP4；保存后的构建门会再次解析真实轨道。",
        label: "MP4 文件",
        media_library: { config: { max_file_size: STUDIO_VIDEO_MAX_FILE_SIZE } },
        name: "source",
        pattern: [
          "^/uploads/[a-z0-9]+(?:-[a-z0-9]+)*/[^()\\s]+\\.mp4$",
          "必须使用当前条目归档目录中的本地 .mp4",
        ],
        widget: "file",
      },
      {
        label: "视频标题",
        name: "title",
        pattern: ['^[^"\\r\\n]{1,120}$', "填写 1–120 字符单行标题，不能包含双引号"],
        widget: "string",
      },
      {
        hint: "说明看不到画面时仍需知道的操作步骤与结果；v1 视频必须无音轨。",
        label: "画面文字说明",
        name: "description",
        pattern: ["^[^\\r\\n\\]]{1,320}$", "填写 1–320 字符单行说明，不能包含 ]"],
        widget: "string",
      },
    ],
    pattern: STUDIO_VIDEO_PATTERN,
    fromBlock(match) {
      if (!match) throw new Error("无法解析 Studio 视频块。");
      return { description: match[1], source: match[2], title: match[3] };
    },
    toBlock: serializeVideo,
    toPreview(data) {
      const normalized = normalizedData(data);
      return h(
        "figure",
        { className: "markdown-video", "data-video": "silent-mp4" },
        h(
          "video",
          {
            "aria-label": `${normalized.title}。${normalized.description}`,
            className: "markdown-video-player",
            controls: true,
            playsInline: true,
            preload: "none",
          },
          h("source", { src: normalized.source, type: "video/mp4" }),
        ),
        h(
          "figcaption",
          { className: "markdown-video-caption" },
          h("strong", {}, normalized.title),
          h("span", {}, normalized.description),
        ),
      );
    },
  };
}

export function registerStudioVideoEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 视频组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];

  const definition = createStudioVideoEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.videoEditor = "registered";
  return definition;
}
