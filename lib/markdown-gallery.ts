import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import {
  parseMarkdown,
  type MarkdownNode,
} from "./content/markdown.ts";

export const MARKDOWN_GALLERY_MAX_COUNT = 3;
export const MARKDOWN_GALLERY_MIN_IMAGES = 2;
export const MARKDOWN_GALLERY_MAX_IMAGES = 6;
export const MARKDOWN_GALLERY_MAX_TOTAL_IMAGES = 12;
export const MARKDOWN_GALLERY_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_GALLERY_MAX_CAPTION_LENGTH = 120;
export const MARKDOWN_GALLERY_MAX_ALT_LENGTH = 320;

export interface MarkdownGalleryImage {
  alt: string;
  caption: string;
  line?: number;
  src: string;
}

export interface MarkdownGallerySource {
  images: MarkdownGalleryImage[];
  line?: number;
  title: string;
}

export interface MarkdownGalleryIssue {
  kind: "gallery";
  line?: number;
  message: string;
}

type GalleryOptions = {
  allowStagingPaths?: boolean;
};

class MarkdownGalleryError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const GALLERY_MARKER = /^\[!gallery\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_GALLERY_MARKER = /^\[!gallery\](?:[+\-]|[ \t]|$)/iu;
const FORMAL_GALLERY_IMAGE =
  /^\/uploads\/[a-z0-9]+(?:-[a-z0-9]+)*\/[^/\s()?#]+\.(?:avif|gif|jpe?g|png|webp)$/iu;
const STAGING_GALLERY_IMAGE =
  /^\/uploads\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?[^/\s()?#]+\.(?:avif|gif|jpe?g|png|webp)$/iu;

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 320);
}

function visibleMarkdownChildren(node: MarkdownNode) {
  return (node.children ?? []).filter(
    (child) => child.type !== "text" || (child.value ?? "").trim() !== "",
  );
}

function galleryMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const children = visibleMarkdownChildren(first);
  const marker = children.length === 1 && children[0]?.type === "text"
    ? children[0]
    : undefined;
  return marker && POTENTIAL_GALLERY_MARKER.test(marker.value ?? "")
    ? marker
    : undefined;
}

function validateGalleryImagePath(
  value: string,
  line: number | undefined,
  { allowStagingPaths = false }: GalleryOptions,
) {
  const source = value.trim();
  if (/^https?:\/\//iu.test(source) || source.startsWith("//")) {
    throw new MarkdownGalleryError(
      "画廊只接受仓库内本地图片，不接受外链或第三方画廊。",
      line,
    );
  }
  if (/[?#]/u.test(source)) {
    throw new MarkdownGalleryError("画廊图片路径不能包含查询参数或锚点。", line);
  }
  const pattern = allowStagingPaths
    ? STAGING_GALLERY_IMAGE
    : FORMAL_GALLERY_IMAGE;
  if (!pattern.test(source)) {
    throw new MarkdownGalleryError(
      allowStagingPaths
        ? "Obsidian 画廊图片必须位于 /uploads 根暂存区或内容 slug 目录，并使用受支持的图片格式。"
        : "画廊图片必须归档到 /uploads/<内容 slug>/<文件>，并使用 AVIF、GIF、JPEG、PNG 或 WebP。",
      line,
    );
  }
  if (/%(?:2f|5c)/iu.test(source) || /[\\\u0000-\u001f\u007f]/u.test(source)) {
    throw new MarkdownGalleryError("画廊图片路径包含不安全字符。", line);
  }
  try {
    const decoded = decodeURIComponent(source);
    if (
      decoded.split("/").some((segment) => segment === "." || segment === "..") ||
      /[<>:"|*]/u.test(decoded)
    ) {
      throw new MarkdownGalleryError("画廊图片路径不安全。", line);
    }
  } catch (error) {
    if (error instanceof MarkdownGalleryError) throw error;
    throw new MarkdownGalleryError("画廊图片路径包含无效的 URL 编码。", line);
  }
  return source;
}

function validateGalleryImage(
  image: MarkdownGalleryImage,
  options: GalleryOptions,
) {
  const src = validateGalleryImagePath(image.src, image.line, options);
  const alt = image.alt.trim();
  if (!alt) {
    throw new MarkdownGalleryError(
      "画廊中的每张图片都必须填写替代文本，说明看不到图片时仍需知道的信息。",
      image.line,
    );
  }
  if (alt.length > MARKDOWN_GALLERY_MAX_ALT_LENGTH) {
    throw new MarkdownGalleryError(
      `画廊图片替代文本不能超过 ${MARKDOWN_GALLERY_MAX_ALT_LENGTH} 个字符。`,
      image.line,
    );
  }
  const caption = image.caption.trim();
  if (!caption) {
    throw new MarkdownGalleryError(
      '画廊中的每张图片都必须填写可见短标题，例如 ![画面说明](图片.webp "短标题")。',
      image.line,
    );
  }
  if (caption.length > MARKDOWN_GALLERY_MAX_CAPTION_LENGTH) {
    throw new MarkdownGalleryError(
      `画廊图片短标题不能超过 ${MARKDOWN_GALLERY_MAX_CAPTION_LENGTH} 个字符。`,
      image.line,
    );
  }
  return { ...image, alt, caption, src };
}

function galleryFromMarkdownNode(
  blockquote: MarkdownNode,
  options: GalleryOptions,
): MarkdownGallerySource | undefined {
  const markerNode = galleryMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  const marker = GALLERY_MARKER.exec(markerNode.value ?? "");
  if (!marker) {
    throw new MarkdownGalleryError(
      "画廊标记必须写成静态的 > [!gallery] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title) {
    throw new MarkdownGalleryError("画廊必须填写组标题。", line);
  }
  if (title.length > MARKDOWN_GALLERY_MAX_TITLE_LENGTH) {
    throw new MarkdownGalleryError(
      `画廊标题不能超过 ${MARKDOWN_GALLERY_MAX_TITLE_LENGTH} 个字符。`,
      line,
    );
  }

  const children = visibleMarkdownChildren(blockquote);
  if (children.length !== 2 || children[1]?.type !== "list") {
    throw new MarkdownGalleryError(
      "画廊标题后必须紧跟一个只包含图片的 Markdown 列表。",
      line,
    );
  }
  const list = children[1] as MarkdownNode & { ordered?: boolean | null };
  if (list.ordered) {
    throw new MarkdownGalleryError(
      "画廊请使用 - 图片 的无序列表；公开页面会自动生成帧序号。",
      list.position?.start?.line ?? line,
    );
  }

  const items = visibleMarkdownChildren(list);
  if (
    items.length < MARKDOWN_GALLERY_MIN_IMAGES ||
    items.length > MARKDOWN_GALLERY_MAX_IMAGES
  ) {
    throw new MarkdownGalleryError(
      `每组画廊必须包含 ${MARKDOWN_GALLERY_MIN_IMAGES}–${MARKDOWN_GALLERY_MAX_IMAGES} 张图片。`,
      list.position?.start?.line ?? line,
    );
  }

  const images = items.map((item) => {
    if (item.type !== "listItem") {
      throw new MarkdownGalleryError(
        "画廊列表只能包含图片项。",
        item.position?.start?.line ?? line,
      );
    }
    const itemChildren = visibleMarkdownChildren(item);
    const paragraph = itemChildren.length === 1 && itemChildren[0]?.type === "paragraph"
      ? itemChildren[0]
      : undefined;
    const paragraphChildren = paragraph ? visibleMarkdownChildren(paragraph) : [];
    const image = paragraphChildren.length === 1 && paragraphChildren[0]?.type === "image"
      ? paragraphChildren[0]
      : undefined;
    if (!image?.url) {
      throw new MarkdownGalleryError(
        "画廊每个列表项必须恰好是一张带 alt 与短标题的内联 Markdown 图片。",
        item.position?.start?.line ?? line,
      );
    }
    return validateGalleryImage(
      {
        alt: image.alt ?? "",
        caption: image.title ?? "",
        ...(image.position?.start?.line
          ? { line: image.position.start.line }
          : {}),
        src: image.url,
      },
      options,
    );
  });

  const uniqueSources = new Set(images.map((image) => image.src));
  if (uniqueSources.size !== images.length) {
    throw new MarkdownGalleryError("同一组画廊不能重复引用同一张图片。", line);
  }

  return { images, ...(line ? { line } : {}), title };
}

function parseMarkdownGalleries(markdown: string, options: GalleryOptions) {
  const galleries: MarkdownGallerySource[] = [];
  const tree = parseMarkdown(markdown);

  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && galleryMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownGalleryError(
          "画廊必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const gallery = galleryFromMarkdownNode(node, options);
      if (gallery) galleries.push(gallery);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }

  walk(tree);
  if (galleries.length > MARKDOWN_GALLERY_MAX_COUNT) {
    throw new MarkdownGalleryError(
      `每篇内容最多允许 ${MARKDOWN_GALLERY_MAX_COUNT} 组画廊。`,
    );
  }
  const totalImages = galleries.reduce(
    (total, gallery) => total + gallery.images.length,
    0,
  );
  if (totalImages > MARKDOWN_GALLERY_MAX_TOTAL_IMAGES) {
    throw new MarkdownGalleryError(
      `每篇内容的画廊合计最多允许 ${MARKDOWN_GALLERY_MAX_TOTAL_IMAGES} 张图片。`,
    );
  }
  return galleries;
}

export function extractMarkdownGalleries(
  markdown: string,
  options: GalleryOptions = {},
) {
  return parseMarkdownGalleries(markdown, options);
}

export function getMarkdownGalleryIssue(
  markdown: string,
): MarkdownGalleryIssue | undefined {
  try {
    parseMarkdownGalleries(markdown, {});
    return undefined;
  } catch (error) {
    return {
      kind: "gallery",
      ...(error instanceof MarkdownGalleryError && error.line
        ? { line: error.line }
        : {}),
      message: compactError(error) || "画廊声明无法解析。",
    };
  }
}

function isElement(node: ElementContent | RootContent): node is Element {
  return node.type === "element";
}

function isText(node: ElementContent | RootContent): node is Text {
  return node.type === "text";
}

function visibleHastChildren(node: Element) {
  return node.children.filter(
    (child) => !isText(child) || child.value.trim() !== "",
  );
}

function text(value: string): Text {
  return { type: "text", value };
}

function element(
  tagName: string,
  properties: Element["properties"],
  children: ElementContent[],
): Element {
  return { children, properties, tagName, type: "element" };
}

function galleryImageFromHastItem(item: Element): MarkdownGalleryImage {
  const itemChildren = visibleHastChildren(item);
  const container =
    itemChildren.length === 1 &&
    isElement(itemChildren[0]) &&
    itemChildren[0].tagName === "p"
      ? itemChildren[0]
      : item;
  const children = visibleHastChildren(container);
  const image =
    children.length === 1 && isElement(children[0]) && children[0].tagName === "img"
      ? children[0]
      : undefined;
  if (!image) {
    throw new MarkdownGalleryError(
      "画廊每个列表项必须恰好是一张带 alt 与短标题的内联 Markdown 图片。",
    );
  }
  return validateGalleryImage(
    {
      alt: typeof image.properties.alt === "string" ? image.properties.alt : "",
      caption:
        typeof image.properties.title === "string" ? image.properties.title : "",
      src: typeof image.properties.src === "string" ? image.properties.src : "",
    },
    {},
  );
}

function galleryFromHastBlockquote(blockquote: Element) {
  const children = visibleHastChildren(blockquote);
  const markerParagraph =
    children[0] && isElement(children[0]) && children[0].tagName === "p"
      ? children[0]
      : undefined;
  const markerChild = markerParagraph
    ? visibleHastChildren(markerParagraph)[0]
    : undefined;
  if (!markerChild || !isText(markerChild)) return undefined;
  if (!POTENTIAL_GALLERY_MARKER.test(markerChild.value)) return undefined;
  const marker = GALLERY_MARKER.exec(markerChild.value);
  if (!marker || !marker[1]?.trim()) {
    throw new MarkdownGalleryError(
      "画廊标记必须写成静态的 > [!gallery] 标题。",
    );
  }
  const title = marker[1].trim();
  if (children.length !== 2 || !isElement(children[1]) || children[1].tagName !== "ul") {
    throw new MarkdownGalleryError(
      "画廊标题后必须紧跟一个只包含图片的 Markdown 列表。",
    );
  }
  const items = visibleHastChildren(children[1]).filter(isElement);
  if (
    items.length < MARKDOWN_GALLERY_MIN_IMAGES ||
    items.length > MARKDOWN_GALLERY_MAX_IMAGES ||
    items.some((item) => item.tagName !== "li")
  ) {
    throw new MarkdownGalleryError(
      `每组画廊必须包含 ${MARKDOWN_GALLERY_MIN_IMAGES}–${MARKDOWN_GALLERY_MAX_IMAGES} 张图片。`,
    );
  }
  const images = items.map(galleryImageFromHastItem);

  return element(
    "figure",
    {
      className: ["markdown-gallery"],
      dataGallery: "ordered-images",
      dataGalleryCount: images.length,
    },
    [
      element("figcaption", { className: ["markdown-gallery-header"] }, [
        element("span", { className: ["markdown-gallery-rail"] }, [
          element("span", { className: ["markdown-gallery-kind"] }, [
            text(`GALLERY / ${String(images.length).padStart(2, "0")} FRAMES`),
          ]),
          element("span", { className: ["markdown-gallery-origin"] }, [
            text("ORDERED · LOCAL"),
          ]),
        ]),
        element("strong", { className: ["markdown-gallery-title"] }, [text(title)]),
      ]),
      element(
        "ol",
        {
          ariaLabel: `${title}，共 ${images.length} 张图片`,
          className: ["markdown-gallery-grid"],
        },
        images.map((image, index) =>
          element("li", { className: ["markdown-gallery-item"] }, [
            element("figure", {}, [
              element("div", { className: ["markdown-gallery-stage"] }, [
                element(
                  "img",
                  {
                    alt: image.alt,
                    className: ["markdown-gallery-image"],
                    decoding: "async",
                    loading: "lazy",
                    src: image.src,
                    title: image.caption,
                  },
                  [],
                ),
              ]),
              element("figcaption", { className: ["markdown-gallery-item-caption"] }, [
                element(
                  "span",
                  { ariaHidden: "true", className: ["markdown-gallery-index"] },
                  [text(`FRAME ${String(index + 1).padStart(2, "0")}`)],
                ),
                element("strong", {}, [text(image.caption)]),
                element("span", { className: ["markdown-gallery-description"] }, [
                  text(image.alt),
                ]),
              ]),
            ]),
          ]),
        ),
      ),
    ],
  );
}

export function rehypeMarkdownGalleries() {
  return function transform(tree: Root) {
    let galleryCount = 0;
    let totalImages = 0;

    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const gallery = galleryFromHastBlockquote(child);
      if (!gallery) continue;
      galleryCount += 1;
      const count = Number(gallery.properties.dataGalleryCount);
      totalImages += count;
      if (galleryCount > MARKDOWN_GALLERY_MAX_COUNT) {
        throw new MarkdownGalleryError(
          `每篇内容最多允许 ${MARKDOWN_GALLERY_MAX_COUNT} 组画廊。`,
        );
      }
      if (totalImages > MARKDOWN_GALLERY_MAX_TOTAL_IMAGES) {
        throw new MarkdownGalleryError(
          `每篇内容的画廊合计最多允许 ${MARKDOWN_GALLERY_MAX_TOTAL_IMAGES} 张图片。`,
        );
      }
      tree.children[index] = gallery as RootContent;
    }
  };
}

export function normalizeMarkdownGalleriesForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && galleryMarkerNode(node)) {
      const marker = galleryMarkerNode(node);
      const gallery = (() => {
        try {
          return galleryFromMarkdownNode(node, { allowStagingPaths: true });
        } catch {
          return undefined;
        }
      })();
      const parsed = marker ? GALLERY_MARKER.exec(marker.value ?? "") : undefined;
      if (marker && parsed?.[1]) marker.value = parsed[1].trim();
      if (gallery) {
        const imageText = new Map(
          gallery.images.map((image) => [
            image.line,
            `${image.caption} ${image.alt}`.trim(),
          ]),
        );
        function enrich(child: MarkdownNode) {
          if (child.type === "image" && child.position?.start?.line) {
            child.alt = imageText.get(child.position.start.line) ?? child.alt;
          }
          for (const nested of child.children ?? []) enrich(nested);
        }
        enrich(node);
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }

  walk(tree);
  return tree;
}
