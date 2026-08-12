import path from "node:path";
import { isSupportedImageExtension } from "../media-policy.ts";
import { ContentValidationError } from "./contract.ts";
import { parseMarkdown, walkMarkdown } from "./markdown.ts";

export interface MarkdownImageReference {
  alt: string;
  line?: number;
  url: string;
}

export function isMarkdownVideoUrl(value: string) {
  return /\.mp4(?:[?#]|$)/iu.test(value.trim());
}

export function isMarkdownAudioUrl(value: string) {
  return /\.mp3(?:[?#]|$)/iu.test(value.trim());
}

export function extractMarkdownImageReferences(markdown: string) {
  const tree = parseMarkdown(markdown);
  const definitions = new Map<string, string>();

  walkMarkdown(tree, (node) => {
    if (node.type === "definition" && node.identifier && node.url) {
      definitions.set(node.identifier, node.url);
    }
  });

  const references: MarkdownImageReference[] = [];
  walkMarkdown(tree, (node) => {
    const url = node.type === "image"
      ? node.url
      : node.type === "imageReference" && node.identifier
        ? definitions.get(node.identifier)
        : undefined;
    if (!url) return;
    if (isMarkdownVideoUrl(url) || isMarkdownAudioUrl(url)) return;
    references.push({
      alt: node.alt ?? "",
      line: node.position?.start?.line,
      url,
    });
  });
  return references;
}

function invalidReference(
  sourcePath: string,
  reference: string,
  message: string,
  label = "本地图片",
): never {
  throw new ContentValidationError(
    sourcePath,
    `${label}“${reference}”${message}`,
  );
}

function resolveContentUploadPath(
  reference: string,
  sourcePath: string,
  options: { extension: (value: string) => boolean; label: string; typeMessage: string },
) {
  const value = reference.trim();
  if (/^https:\/\//iu.test(value)) {
    try {
      new URL(value);
      return undefined;
    } catch {
      invalidReference(sourcePath, reference, "不是有效的 HTTPS URL", options.label);
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(value) || value.startsWith("//")) {
    invalidReference(sourcePath, reference, "必须使用 HTTPS 外链或 /uploads/... 本地路径", options.label);
  }
  if (!value.startsWith("/uploads/")) {
    invalidReference(sourcePath, reference, "必须使用 /uploads/... 根路径", options.label);
  }
  if (/[?#]/u.test(value)) {
    invalidReference(sourcePath, reference, "不能包含查询参数或锚点", options.label);
  }
  if (/%(?:2f|5c)/iu.test(value)) {
    invalidReference(sourcePath, reference, "不能编码路径分隔符", options.label);
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    invalidReference(sourcePath, reference, "包含无效的 URL 编码", options.label);
  }
  if (/[\\?#\u0000-\u001f]/u.test(decoded)) {
    invalidReference(sourcePath, reference, "包含不安全字符", options.label);
  }

  const segments = decoded.slice("/uploads/".length).split("/");
  if (
    segments.some(
      (segment) =>
        !segment || segment === "." || segment === ".." || /[<>:"|*]/u.test(segment),
    )
  ) {
    invalidReference(sourcePath, reference, "路径不安全", options.label);
  }
  if (!options.extension(path.posix.extname(segments.at(-1) ?? ""))) {
    invalidReference(sourcePath, reference, options.typeMessage, options.label);
  }

  return `public/uploads/${segments.join("/")}`;
}

export function resolveContentMediaPath(reference: string, sourcePath: string) {
  return resolveContentUploadPath(reference, sourcePath, {
    extension: isSupportedImageExtension,
    label: "本地图片",
    typeMessage: "必须指向受支持的图片格式",
  });
}

export function resolveContentVideoPath(reference: string, sourcePath: string) {
  return resolveContentUploadPath(reference, sourcePath, {
    extension: (value) => value.toLowerCase() === ".mp4",
    label: "本地视频",
    typeMessage: "必须指向 .mp4 视频",
  });
}

export function resolveContentAudioPath(reference: string, sourcePath: string) {
  return resolveContentUploadPath(reference, sourcePath, {
    extension: (value) => value.toLowerCase() === ".mp3",
    label: "本地音频",
    typeMessage: "必须指向 .mp3 音频",
  });
}
