import type { Element, Root } from "hast";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { extractMarkdownMathExpressions } from "@/lib/content/markdown";
import {
  MARKDOWN_REHYPE_OPTIONS,
  MARKDOWN_REHYPE_PLUGINS,
  MARKDOWN_REMARK_PLUGINS,
  transformMarkdownUrl,
} from "@/lib/markdown-pipeline";
import { getMarkdownMathIssue, type MarkdownMathIssue } from "@/lib/markdown-math";

export const STUDIO_MATH_PREVIEW_MAX_BYTES = 100_000;

export type StudioMathPreviewResult =
  | {
      formulaCount: number;
      html: string;
      ok: true;
    }
  | {
      issue: MarkdownMathIssue;
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

  const formulaCount = extractMarkdownMathExpressions(markdown).length;
  const file = unified()
    .use(remarkParse)
    .use(MARKDOWN_REMARK_PLUGINS)
    .use(remarkRehype, MARKDOWN_REHYPE_OPTIONS)
    .use(MARKDOWN_REHYPE_PLUGINS)
    .use(sanitizeStudioPreviewUrls)
    .use(addStudioPreviewAccessibility)
    .use(rehypeStringify)
    .processSync(markdown);
  const html = `<div class="markdown-content" data-studio-renderer="production-pipeline">${String(file)}</div>`;

  return { formulaCount, html, ok: true };
}
