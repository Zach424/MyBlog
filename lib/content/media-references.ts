import { fromMarkdown } from "mdast-util-from-markdown";
import path from "node:path";
import { isSupportedImageExtension } from "../media-policy.ts";
import { ContentValidationError } from "./contract.ts";

type MarkdownNode = {
  alt?: string;
  children?: MarkdownNode[];
  identifier?: string;
  position?: {
    start?: {
      line?: number;
    };
  };
  type: string;
  url?: string;
};

export interface MarkdownImageReference {
  alt: string;
  line?: number;
  url: string;
}

function walkMarkdown(node: MarkdownNode, visit: (node: MarkdownNode) => void) {
  visit(node);
  for (const child of node.children ?? []) walkMarkdown(child, visit);
}

export function extractMarkdownImageReferences(markdown: string) {
  const tree = fromMarkdown(markdown) as MarkdownNode;
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
    references.push({
      alt: node.alt ?? "",
      line: node.position?.start?.line,
      url,
    });
  });
  return references;
}

function invalidReference(sourcePath: string, reference: string, message: string): never {
  throw new ContentValidationError(
    sourcePath,
    `本地图片“${reference}”${message}`,
  );
}

export function resolveContentMediaPath(reference: string, sourcePath: string) {
  const value = reference.trim();
  if (/^https:\/\//iu.test(value)) {
    try {
      new URL(value);
      return undefined;
    } catch {
      invalidReference(sourcePath, reference, "不是有效的 HTTPS URL");
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(value) || value.startsWith("//")) {
    invalidReference(sourcePath, reference, "必须使用 HTTPS 外链或 /uploads/... 本地路径");
  }
  if (!value.startsWith("/uploads/")) {
    invalidReference(sourcePath, reference, "必须使用 /uploads/... 根路径");
  }
  if (/[?#]/u.test(value)) {
    invalidReference(sourcePath, reference, "不能包含查询参数或锚点");
  }
  if (/%(?:2f|5c)/iu.test(value)) {
    invalidReference(sourcePath, reference, "不能编码路径分隔符");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    invalidReference(sourcePath, reference, "包含无效的 URL 编码");
  }
  if (/[\\?#\u0000-\u001f]/u.test(decoded)) {
    invalidReference(sourcePath, reference, "包含不安全字符");
  }

  const segments = decoded.slice("/uploads/".length).split("/");
  if (
    segments.some(
      (segment) =>
        !segment || segment === "." || segment === ".." || /[<>:"|*]/u.test(segment),
    )
  ) {
    invalidReference(sourcePath, reference, "路径不安全");
  }
  if (!isSupportedImageExtension(path.posix.extname(segments.at(-1) ?? ""))) {
    invalidReference(sourcePath, reference, "必须指向受支持的图片格式");
  }

  return `public/uploads/${segments.join("/")}`;
}
