import type { Element, ElementContent, Root, RootContent } from "hast";
import { parseMarkdown, walkMarkdown } from "./content/markdown.ts";

export const MARKDOWN_VIDEO_MAX_COUNT = 2;
export const MARKDOWN_VIDEO_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_VIDEO_MAX_DESCRIPTION_LENGTH = 320;

export interface MarkdownVideoSource {
  description: string;
  line?: number;
  src: string;
  title: string;
}

export interface MarkdownVideoIssue {
  kind: "video";
  line?: number;
  message: string;
}

type ImageTarget = {
  title?: string;
  url: string;
};

class MarkdownVideoError extends Error {}

function text(value: string): ElementContent {
  return { type: "text", value };
}

function element(
  tagName: string,
  properties: Element["properties"],
  children: ElementContent[],
): Element {
  return { children, properties, tagName, type: "element" };
}

function isPotentialVideoUrl(value: string) {
  return /\.mp4(?:[?#]|$)/iu.test(value.trim());
}

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 320);
}

function validateVideo(video: MarkdownVideoSource) {
  const source = video.src.trim();
  if (/^https?:\/\//iu.test(source) || source.startsWith("//")) {
    throw new MarkdownVideoError(
      "视频必须使用 /uploads/<内容 slug>/<文件>.mp4 仓库内本地路径；暂不接受外部托管或第三方播放器。",
    );
  }
  if (/[?#]/u.test(source)) {
    throw new MarkdownVideoError("本地视频路径不能包含查询参数或锚点。");
  }
  if (!/^\/uploads\/[a-z0-9]+(?:-[a-z0-9]+)*\/[^/]+\.mp4$/u.test(source)) {
    throw new MarkdownVideoError(
      "视频必须归档到 /uploads/<内容 slug>/<文件>.mp4，不能停留在根暂存区。",
    );
  }
  if (/%(?:2f|5c)/iu.test(source) || /[\\\u0000-\u001f\u007f]/u.test(source)) {
    throw new MarkdownVideoError("本地视频路径包含不安全字符。");
  }
  try {
    const decoded = decodeURIComponent(source);
    if (
      decoded.split("/").some((segment) => segment === "." || segment === "..") ||
      /[<>:"|*]/u.test(decoded)
    ) {
      throw new MarkdownVideoError("本地视频路径不安全。");
    }
  } catch (error) {
    if (error instanceof MarkdownVideoError) throw error;
    throw new MarkdownVideoError("本地视频路径包含无效的 URL 编码。");
  }

  const title = video.title.trim();
  if (!title) {
    throw new MarkdownVideoError(
      '视频必须在 Markdown 链接末尾填写标题，例如 ![文字说明](视频.mp4 "演示标题")。',
    );
  }
  if (title.length > MARKDOWN_VIDEO_MAX_TITLE_LENGTH) {
    throw new MarkdownVideoError(
      `视频标题不能超过 ${MARKDOWN_VIDEO_MAX_TITLE_LENGTH} 个字符。`,
    );
  }

  const description = video.description.trim();
  if (!description) {
    throw new MarkdownVideoError(
      "视频必须填写文字说明，描述看不到画面时仍需知道的步骤与结果。",
    );
  }
  if (description.length > MARKDOWN_VIDEO_MAX_DESCRIPTION_LENGTH) {
    throw new MarkdownVideoError(
      `视频文字说明不能超过 ${MARKDOWN_VIDEO_MAX_DESCRIPTION_LENGTH} 个字符。`,
    );
  }
}

function imageTargetFromElement(node: Element): MarkdownVideoSource | undefined {
  if (node.tagName !== "img") return undefined;
  const src = typeof node.properties.src === "string" ? node.properties.src : "";
  if (!isPotentialVideoUrl(src)) return undefined;
  return {
    description:
      typeof node.properties.alt === "string" ? node.properties.alt : "",
    src,
    title:
      typeof node.properties.title === "string" ? node.properties.title : "",
  };
}

function videoFigure(video: MarkdownVideoSource) {
  validateVideo(video);
  const accessibleLabel = `${video.title}。${video.description}`;
  return element(
    "figure",
    {
      className: ["markdown-video"],
      dataVideo: "silent-mp4",
    },
    [
      element("div", { className: ["markdown-video-rail"] }, [
        element("span", { className: ["markdown-video-kind"] }, [
          text("VIDEO / SILENT MP4"),
        ]),
        element("span", { className: ["markdown-video-origin"] }, [
          text("LOCAL · NO TRACKING"),
        ]),
      ]),
      element("div", { className: ["markdown-video-stage"] }, [
        element(
          "video",
          {
            ariaLabel: accessibleLabel,
            className: ["markdown-video-player"],
            controls: true,
            preload: "none",
            playsInline: true,
          },
          [
            element("source", { src: video.src, type: "video/mp4" }, []),
            element("p", {}, [
              text("当前浏览器无法播放该视频。"),
              element("a", { href: video.src }, [text("下载视频文件")]),
            ]),
          ],
        ),
      ]),
      element("figcaption", { className: ["markdown-video-caption"] }, [
        element("strong", {}, [text(video.title)]),
        element("span", {}, [text(video.description)]),
        element("span", { className: ["markdown-video-note"] }, [
          text("静音演示 · 点击播放后加载"),
        ]),
      ]),
      element("p", { className: ["markdown-video-print"] }, [
        text("视频文件："),
        element("a", { href: video.src }, [text(video.src)]),
      ]),
    ],
  );
}

export function extractMarkdownVideos(markdown: string) {
  const tree = parseMarkdown(markdown);
  const definitions = new Map<string, ImageTarget>();
  walkMarkdown(tree, (node) => {
    if (node.type === "definition" && node.identifier && node.url) {
      definitions.set(node.identifier, {
        ...(node.title ? { title: node.title } : {}),
        url: node.url,
      });
    }
  });

  const videos: MarkdownVideoSource[] = [];
  walkMarkdown(tree, (node) => {
    const target = node.type === "image" && node.url
      ? { title: node.title, url: node.url }
      : node.type === "imageReference" && node.identifier
        ? definitions.get(node.identifier)
        : undefined;
    if (!target || !isPotentialVideoUrl(target.url)) return;
    videos.push({
      description: node.alt ?? "",
      ...(node.position?.start?.line ? { line: node.position.start.line } : {}),
      src: target.url,
      title: target.title ?? "",
    });
  });
  return videos;
}

export function getMarkdownVideoIssue(
  markdown: string,
): MarkdownVideoIssue | undefined {
  const videos = extractMarkdownVideos(markdown);
  if (videos.length > MARKDOWN_VIDEO_MAX_COUNT) {
    return {
      kind: "video",
      message: `每篇内容最多允许 ${MARKDOWN_VIDEO_MAX_COUNT} 段本地视频。`,
    };
  }

  for (const video of videos) {
    try {
      validateVideo(video);
    } catch (error) {
      return {
        kind: "video",
        ...(video.line ? { line: video.line } : {}),
        message: compactError(error) || "视频声明无法解析。",
      };
    }
  }
  return undefined;
}

export function rehypeMarkdownVideos() {
  return function transform(tree: Root) {
    let videoCount = 0;

    function walk(parent: Root | Element) {
      for (let index = 0; index < parent.children.length; index += 1) {
        const child = parent.children[index];
        if (child.type !== "element") continue;
        const directVideo = imageTargetFromElement(child);
        const paragraphVideo = child.tagName === "p" && child.children.length === 1
          && child.children[0]?.type === "element"
          ? imageTargetFromElement(child.children[0])
          : undefined;
        const video = directVideo ?? paragraphVideo;
        if (!video) {
          if (
            child.tagName === "p" &&
            child.children.some(
              (nested) => nested.type === "element" && imageTargetFromElement(nested),
            )
          ) {
            throw new MarkdownVideoError("视频声明必须独占一个段落，前后不能混排其他文字。");
          }
          walk(child);
          continue;
        }
        if (videoCount >= MARKDOWN_VIDEO_MAX_COUNT) {
          throw new MarkdownVideoError(
            `每篇内容最多允许 ${MARKDOWN_VIDEO_MAX_COUNT} 段本地视频。`,
          );
        }
        parent.children[index] = videoFigure(video) as RootContent;
        videoCount += 1;
      }
    }

    walk(tree);
  };
}
