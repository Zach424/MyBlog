export const STUDIO_GALLERY_EDITOR_ID = "myblog-gallery";
export const STUDIO_GALLERY_MIN_IMAGES = 2;
export const STUDIO_GALLERY_MAX_IMAGES = 6;
export const STUDIO_GALLERY_MAX_FILE_SIZE = 3 * 1024 * 1024;

const GALLERY_ITEM_SOURCE = String.raw`> - !\[([^\]\r\n]{1,320})\]\((\/uploads\/[a-z0-9]+(?:-[a-z0-9]+)*\/[^()\s?#]+\.(?:avif|gif|jpe?g|png|webp)) "([^"\r\n]{1,120})"\)`;
export const STUDIO_GALLERY_PATTERN = new RegExp(
  String.raw`^> \[!gallery\] ([^\[\]\r\n]{1,120})\r?\n((?:${GALLERY_ITEM_SOURCE}(?:\r?\n|$)){${STUDIO_GALLERY_MIN_IMAGES},${STUDIO_GALLERY_MAX_IMAGES}})`,
  "imu",
);
const STUDIO_GALLERY_ITEM_PATTERN = new RegExp(`^${GALLERY_ITEM_SOURCE}$`, "imu");
const REGISTRATION_KEY = "__MYBLOG_GALLERY_EDITOR_COMPONENT__";

function plainValue(value) {
  return value && typeof value.toJS === "function" ? value.toJS() : value;
}

function normalizedData(data) {
  const value = plainValue(data) ?? {};
  const rawImages = plainValue(value.images);
  return {
    images: Array.isArray(rawImages)
      ? rawImages.map((candidate) => {
          const image = plainValue(candidate) ?? {};
          return {
            alt: typeof image.alt === "string" ? image.alt.trim() : "",
            caption:
              typeof image.caption === "string" ? image.caption.trim() : "",
            source: typeof image.source === "string" ? image.source.trim() : "",
          };
        })
      : [],
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function validateGallery(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("画廊标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (
    normalized.images.length < STUDIO_GALLERY_MIN_IMAGES ||
    normalized.images.length > STUDIO_GALLERY_MAX_IMAGES
  ) {
    throw new Error(
      `每组画廊必须包含 ${STUDIO_GALLERY_MIN_IMAGES}–${STUDIO_GALLERY_MAX_IMAGES} 张图片。`,
    );
  }
  const sources = new Set();
  for (const [index, image] of normalized.images.entries()) {
    const markdown = `> - ![${image.alt}](${image.source} "${image.caption}")`;
    if (!STUDIO_GALLERY_ITEM_PATTERN.test(markdown)) {
      throw new Error(
        `画廊第 ${index + 1} 张图片无效：请使用当前 slug 目录中的本地图片，并填写单行短标题和画面说明。`,
      );
    }
    if (sources.has(image.source)) {
      throw new Error(`画廊第 ${index + 1} 张图片与前面的路径重复。`);
    }
    sources.add(image.source);
  }
  return normalized;
}

function serializeGallery(data) {
  const normalized = validateGallery(data);
  return [
    `> [!gallery] ${normalized.title}`,
    ...normalized.images.map(
      (image) => `> - ![${image.alt}](${image.source} "${image.caption}")`,
    ),
  ].join("\n");
}

function parseGalleryMatch(match) {
  if (!match) throw new Error("无法解析 Studio 画廊块。");
  const images = match[2]
    .trimEnd()
    .split(/\r?\n/u)
    .map((line, index) => {
      const item = STUDIO_GALLERY_ITEM_PATTERN.exec(line);
      if (!item) throw new Error(`无法解析 Studio 画廊的第 ${index + 1} 张图片。`);
      return { alt: item[1], source: item[2], caption: item[3] };
    });
  return validateGallery({ images, title: match[1] });
}

export function createStudioGalleryEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") {
    throw new Error("Studio 画廊组件缺少 React 运行时。");
  }

  return {
    collapsed: false,
    id: STUDIO_GALLERY_EDITOR_ID,
    label: "多图证据画廊",
    fields: [
      {
        hint: "说明这一组图片共同证明什么；公开页面会显示为画廊总标题。",
        label: "画廊标题",
        name: "title",
        pattern: ["^[^\\[\\]\\r\\n]{1,120}$", "填写 1–120 字符的单行纯文本标题"],
        widget: "string",
      },
      {
        allow_add: true,
        allow_remove: true,
        allow_reorder: true,
        collapsed: false,
        default: [
          { alt: "", caption: "", source: "" },
          { alt: "", caption: "", source: "" },
        ],
        fields: [
          {
            choose_url: false,
            hint: "先填写稳定 slug；单图仍受 3 MiB、2560 px 和真实格式构建门约束。",
            label: "图片文件",
            media_library: {
              config: { max_file_size: STUDIO_GALLERY_MAX_FILE_SIZE },
            },
            name: "source",
            pattern: [
              "^/uploads/[a-z0-9]+(?:-[a-z0-9]+)*/[^()\\s?#]+\\.(?:avif|gif|jpe?g|png|webp)$",
              "必须使用当前条目 slug 目录中的本地图片",
            ],
            widget: "image",
          },
          {
            hint: "公开页面中显示在帧编号旁边。",
            label: "可见短标题",
            name: "caption",
            pattern: ['^[^"\\r\\n]{1,120}$', "填写 1–120 字符单行标题，不能包含双引号"],
            widget: "string",
          },
          {
            hint: "描述图片传达的状态、差异或结果；不要只写‘截图’。",
            label: "画面替代文本",
            name: "alt",
            pattern: ["^[^\\]\\r\\n]{1,320}$", "填写 1–320 字符单行说明，不能包含 ]"],
            widget: "string",
          },
        ],
        label: "有序图片",
        label_singular: "图片帧",
        max: STUDIO_GALLERY_MAX_IMAGES,
        min: STUDIO_GALLERY_MIN_IMAGES,
        name: "images",
        summary: "{{fields.caption}} · {{fields.source}}",
        widget: "list",
      },
    ],
    pattern: STUDIO_GALLERY_PATTERN,
    fromBlock: parseGalleryMatch,
    toBlock: serializeGallery,
    toPreview(data) {
      const normalized = validateGallery(data);
      return h(
        "figure",
        { className: "markdown-gallery", "data-gallery": "ordered-images" },
        h(
          "figcaption",
          { className: "markdown-gallery-header" },
          h(
            "span",
            { className: "markdown-gallery-rail" },
            h(
              "span",
              { className: "markdown-gallery-kind" },
              `GALLERY / ${String(normalized.images.length).padStart(2, "0")} FRAMES`,
            ),
            h("span", { className: "markdown-gallery-origin" }, "ORDERED · LOCAL"),
          ),
          h("strong", { className: "markdown-gallery-title" }, normalized.title),
        ),
        h(
          "ol",
          {
            "aria-label": `${normalized.title}，共 ${normalized.images.length} 张图片`,
            className: "markdown-gallery-grid",
          },
          ...normalized.images.map((image, index) =>
            h(
              "li",
              { className: "markdown-gallery-item", key: image.source },
              h(
                "figure",
                {},
                h(
                  "div",
                  { className: "markdown-gallery-stage" },
                  h("img", {
                    alt: image.alt,
                    className: "markdown-gallery-image",
                    src: image.source,
                    title: image.caption,
                  }),
                ),
                h(
                  "figcaption",
                  { className: "markdown-gallery-item-caption" },
                  h(
                    "span",
                    { "aria-hidden": "true", className: "markdown-gallery-index" },
                    `FRAME ${String(index + 1).padStart(2, "0")}`,
                  ),
                  h("strong", {}, image.caption),
                  h("span", { className: "markdown-gallery-description" }, image.alt),
                ),
              ),
            ),
          ),
        ),
      );
    },
  };
}

export function registerStudioGalleryEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 画廊组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];

  const definition = createStudioGalleryEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.galleryEditor = "registered";
  return definition;
}
