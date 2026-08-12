export const STUDIO_AUDIO_EDITOR_ID = "myblog-audio";
export const STUDIO_AUDIO_MAX_FILE_SIZE = 8 * 1024 * 1024;
export const STUDIO_AUDIO_PATTERN =
  /^> \[!audio\] ([^\r\n]{1,120})\r?\n> \[下载 MP3\]\((\/uploads\/[a-z0-9]+(?:-[a-z0-9]+)*\/[^()\s]+\.mp3) "\1"\)\r?\n> ([^\r\n]{1,320})\r?\n>\r?\n> \*\*文字稿\*\*\r?\n((?:>[^\r\n]*(?:\r?\n|$))+)/mu;

const REGISTRATION_KEY = "__MYBLOG_AUDIO_EDITOR_COMPONENT__";

function normalizedData(data) {
  return {
    description: typeof data?.description === "string" ? data.description.trim() : "",
    source: typeof data?.source === "string" ? data.source.trim() : "",
    title: typeof data?.title === "string" ? data.title.trim() : "",
    transcript: typeof data?.transcript === "string" ? data.transcript.trim() : "",
  };
}

function quoteTranscript(transcript) {
  return transcript.split(/\r?\n/u).map((line) => `> ${line}`).join("\n");
}

function serializeAudio(data) {
  const normalized = normalizedData(data);
  if (!normalized.transcript || normalized.transcript.length > 12_000) {
    throw new Error("音频块字段无效：请填写 1–12000 字符的完整文字稿。");
  }
  const markdown = [
    `> [!audio] ${normalized.title}`,
    `> [下载 MP3](${normalized.source} "${normalized.title}")`,
    `> ${normalized.description}`,
    ">",
    "> **文字稿**",
    quoteTranscript(normalized.transcript),
  ].join("\n");
  if (!STUDIO_AUDIO_PATTERN.test(markdown)) {
    throw new Error(
      "音频块字段无效：请使用归档后的本地 .mp3 路径，并填写单行标题、简述和文字稿。",
    );
  }
  return markdown;
}

export function createStudioAudioEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") throw new Error("Studio 音频组件缺少 React 运行时。");

  return {
    id: STUDIO_AUDIO_EDITOR_ID,
    label: "本地音频笔记",
    fields: [
      {
        choose_url: false,
        hint: "只上传 8 MiB 以内、15 分钟以内、单声道或双声道的 MP3；保存后的构建门会解析真实编码、时长、采样率和码率。",
        label: "MP3 文件",
        media_library: { config: { max_file_size: STUDIO_AUDIO_MAX_FILE_SIZE } },
        name: "source",
        pattern: [
          "^/uploads/[a-z0-9]+(?:-[a-z0-9]+)*/[^()\\s]+\\.mp3$",
          "必须使用当前条目归档目录中的本地 .mp3",
        ],
        widget: "file",
      },
      {
        label: "音频标题",
        name: "title",
        pattern: ['^[^"\\r\\n]{1,120}$', "填写 1–120 字符单行标题，不能包含双引号"],
        widget: "string",
      },
      {
        hint: "用一句话说明这段录音讲了什么。",
        label: "内容简述",
        name: "description",
        pattern: ["^[^\\r\\n]{1,320}$", "填写 1–320 字符单行简述"],
        widget: "string",
      },
      {
        hint: "必须提供与录音等价的完整文字内容；多位说话者请标明身份，重要声音也应描述。",
        label: "完整文字稿",
        name: "transcript",
        pattern: ["^[\\s\\S]{1,12000}$", "填写 1–12000 字符完整文字稿"],
        widget: "text",
      },
    ],
    pattern: STUDIO_AUDIO_PATTERN,
    fromBlock(match) {
      if (!match) throw new Error("无法解析 Studio 音频块。");
      return {
        description: match[3],
        source: match[2],
        title: match[1],
        transcript: match[4]
          .split(/\r?\n/u)
          .map((line) => line.replace(/^> ?/u, ""))
          .join("\n")
          .trim(),
      };
    },
    toBlock: serializeAudio,
    toPreview(data) {
      const normalized = normalizedData(data);
      return h(
        "figure",
        { className: "markdown-audio", "data-audio": "local-mp3" },
        h("figcaption", { className: "markdown-audio-header" },
          h("strong", { className: "markdown-audio-title" }, normalized.title),
          h("span", { className: "markdown-audio-description" }, normalized.description),
        ),
        h("audio", {
          "aria-label": `${normalized.title}。${normalized.description}`,
          className: "markdown-audio-player",
          controls: true,
          preload: "metadata",
          src: normalized.source,
        }),
        h("div", { className: "markdown-audio-transcript" },
          h("span", { className: "markdown-audio-transcript-label" }, "TRANSCRIPT"),
          h("p", {}, normalized.transcript),
        ),
      );
    },
  };
}

export function registerStudioAudioEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 音频组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];

  const definition = createStudioAudioEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.audioEditor = "registered";
  return definition;
}
