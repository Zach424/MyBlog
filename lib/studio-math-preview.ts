import type { Element, Root } from "hast";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { extractMarkdownMathExpressions } from "@/lib/content/markdown";
import {
  extractMarkdownDiagrams,
  getMarkdownDiagramIssue,
  type MarkdownDiagramIssue,
} from "@/lib/markdown-diagram";
import {
  MARKDOWN_REHYPE_OPTIONS,
  MARKDOWN_REHYPE_PLUGINS,
  MARKDOWN_REMARK_PLUGINS,
  transformMarkdownUrl,
} from "@/lib/markdown-pipeline";
import {
  extractMarkdownGalleries,
  getMarkdownGalleryIssue,
  type MarkdownGalleryIssue,
} from "@/lib/markdown-gallery";
import { getMarkdownMathIssue, type MarkdownMathIssue } from "@/lib/markdown-math";
import {
  extractMarkdownTables,
  getMarkdownTableIssue,
  type MarkdownTableIssue,
} from "@/lib/markdown-table";
import {
  extractMarkdownVideos,
  getMarkdownVideoIssue,
  type MarkdownVideoIssue,
} from "@/lib/markdown-video";

export const STUDIO_MATH_PREVIEW_MAX_BYTES = 100_000;

export type StudioMathPreviewResult =
  | {
      calloutCount: number;
      diagramCount: number;
      formulaCount: number;
      galleryCount: number;
      galleryImageCount: number;
      html: string;
      ok: true;
      tableCount: number;
      tableDataCellCount: number;
      videoCount: number;
    }
  | {
      issue:
        | MarkdownDiagramIssue
        | MarkdownGalleryIssue
        | MarkdownMathIssue
        | MarkdownTableIssue
        | MarkdownVideoIssue;
      ok: false;
    };

function isElement(node: Root["children"][number]): node is Element {
  return node.type === "element";
}

function addStudioPreviewAccessibility() {
  return function transform(tree: Root) {
    function walk(node: Root | Element) {
      for (const child of node.children) {
        if (!isElement(child)) continue;
        const classNames = Array.isArray(child.properties.className)
          ? child.properties.className
          : [];
        if (child.tagName === "span" && classNames.includes("katex-display")) {
          child.properties.ariaLabel = "数学公式，可横向滚动";
          child.properties.role = "region";
          child.properties.tabIndex = 0;
        }
        walk(child);
      }
    }

    walk(tree);
  };
}

function sanitizeStudioPreviewUrls() {
  return function transform(tree: Root) {
    function walk(node: Root | Element) {
      for (const child of node.children) {
        if (!isElement(child)) continue;
        for (const property of ["href", "src"] as const) {
          const value = child.properties[property];
          if (typeof value === "string") {
            child.properties[property] = transformMarkdownUrl(value);
          }
        }
        walk(child);
      }
    }

    walk(tree);
  };
}

export function renderStudioMathPreview(
  markdown: string,
): StudioMathPreviewResult {
  const issue = getMarkdownMathIssue(markdown);
  if (issue) return { issue, ok: false };
  const diagramIssue = getMarkdownDiagramIssue(markdown);
  if (diagramIssue) return { issue: diagramIssue, ok: false };
  const galleryIssue = getMarkdownGalleryIssue(markdown);
  if (galleryIssue) return { issue: galleryIssue, ok: false };
  const tableIssue = getMarkdownTableIssue(markdown);
  if (tableIssue) return { issue: tableIssue, ok: false };
  const videoIssue = getMarkdownVideoIssue(markdown);
  if (videoIssue) return { issue: videoIssue, ok: false };

  const formulaCount = extractMarkdownMathExpressions(markdown).length;
  const diagramCount = extractMarkdownDiagrams(markdown).length;
  const galleries = extractMarkdownGalleries(markdown);
  const galleryCount = galleries.length;
  const galleryImageCount = galleries.reduce(
    (total, gallery) => total + gallery.images.length,
    0,
  );
  const tables = extractMarkdownTables(markdown);
  const tableCount = tables.length;
  const tableDataCellCount = tables.reduce(
    (total, table) => total + table.headers.length * table.rowCount,
    0,
  );
  const videoCount = extractMarkdownVideos(markdown).length;
  const file = unified()
    .use(remarkParse)
    .use(MARKDOWN_REMARK_PLUGINS)
    .use(remarkRehype, MARKDOWN_REHYPE_OPTIONS)
    .use(MARKDOWN_REHYPE_PLUGINS)
    .use(sanitizeStudioPreviewUrls)
    .use(addStudioPreviewAccessibility)
    .use(rehypeStringify)
    .processSync(markdown);
  const rendered = String(file);
  const calloutCount = (rendered.match(/data-callout=/gu) ?? []).length;
  const html = `<div class="markdown-content" data-studio-renderer="production-pipeline">${rendered}</div>`;

  return {
    calloutCount,
    diagramCount,
    formulaCount,
    galleryCount,
    galleryImageCount,
    html,
    ok: true,
    tableCount,
    tableDataCellCount,
    videoCount,
  };
}
