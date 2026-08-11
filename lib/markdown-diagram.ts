import { renderMermaidSVG } from "../node_modules/beautiful-mermaid/dist/index.js";
import type { Element, ElementContent, Root, RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import { sanitize } from "hast-util-sanitize";
import type { Schema } from "hast-util-sanitize";
import { parseMarkdown, walkMarkdown } from "./content/markdown.ts";

export const MARKDOWN_DIAGRAM_MAX_COUNT = 8;
export const MARKDOWN_DIAGRAM_MAX_SOURCE_BYTES = 8_192;
export const MARKDOWN_DIAGRAM_MAX_LINES = 160;
export const MARKDOWN_DIAGRAM_MAX_LINE_LENGTH = 500;
export const MARKDOWN_DIAGRAM_MAX_SVG_BYTES = 240_000;
export const MARKDOWN_DIAGRAM_MAX_TOTAL_SVG_BYTES = 800_000;
export const MARKDOWN_DIAGRAM_MAX_ELEMENTS = 1_800;

export type MarkdownDiagramType =
  | "class"
  | "er"
  | "flowchart"
  | "sequence"
  | "state"
  | "xychart";

export interface MarkdownDiagramSource {
  line?: number;
  value: string;
}

export interface MarkdownDiagramIssue {
  kind: "diagram";
  line?: number;
  message: string;
}

interface RenderedDiagram {
  elementCount: number;
  node: Element;
  svgBytes: number;
  type: MarkdownDiagramType;
}

const DIAGRAM_TYPE_LABELS: Record<MarkdownDiagramType, string> = {
  class: "CLASS",
  er: "ENTITY RELATIONSHIP",
  flowchart: "FLOWCHART",
  sequence: "SEQUENCE",
  state: "STATE",
  xychart: "XY CHART",
};

const SVG_SCHEMA: Schema = {
  allowComments: false,
  allowDoctypes: false,
  attributes: {
    "*": [
      "className",
      "data*",
      "id",
      "d",
      "dy",
      "cx",
      "cy",
      "r",
      "rx",
      "ry",
      "x",
      "x1",
      "x2",
      "y",
      "y1",
      "y2",
      "width",
      "height",
      "points",
      "transform",
      "fill",
      "stroke",
      "strokeWidth",
      "strokeLineJoin",
      "strokeLineCap",
      "strokeDashArray",
      "markerEnd",
      "markerStart",
      "markerWidth",
      "markerHeight",
      "refX",
      "refY",
      "orient",
      "textAnchor",
      "dominantBaseline",
      "fontSize",
      "fontWeight",
      "fontStyle",
    ],
    svg: ["xmlns", "viewBox", "width", "height"],
  },
  clobber: [],
  protocols: {},
  strip: ["a", "foreignObject", "iframe", "image", "script", "style", "use"],
  tagNames: [
    "circle",
    "defs",
    "ellipse",
    "g",
    "line",
    "marker",
    "path",
    "polygon",
    "polyline",
    "rect",
    "svg",
    "text",
    "tspan",
  ],
};

class MarkdownDiagramError extends Error {}

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

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\u0000-\u001f\u007f]+/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 240);
}

function diagramType(source: string): MarkdownDiagramType | undefined {
  const header = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%"));
  if (!header) return undefined;
  if (/^(?:flowchart|graph)\b/iu.test(header)) return "flowchart";
  if (/^stateDiagram(?:-v2)?\b/iu.test(header)) return "state";
  if (/^sequenceDiagram\b/iu.test(header)) return "sequence";
  if (/^classDiagram\b/iu.test(header)) return "class";
  if (/^erDiagram\b/iu.test(header)) return "er";
  if (/^xychart(?:-beta)?\b/iu.test(header)) return "xychart";
  return undefined;
}

function validateSource(source: string) {
  if (!source.trim()) throw new MarkdownDiagramError("Mermaid 图表源码不能为空。");
  const bytes = byteLength(source);
  if (bytes > MARKDOWN_DIAGRAM_MAX_SOURCE_BYTES) {
    throw new MarkdownDiagramError(
      `单张 Mermaid 图表源码不能超过 ${MARKDOWN_DIAGRAM_MAX_SOURCE_BYTES} 字节。`,
    );
  }
  const lines = source.split(/\r?\n/u);
  if (lines.length > MARKDOWN_DIAGRAM_MAX_LINES) {
    throw new MarkdownDiagramError(
      `单张 Mermaid 图表不能超过 ${MARKDOWN_DIAGRAM_MAX_LINES} 行。`,
    );
  }
  if (lines.some((line) => line.length > MARKDOWN_DIAGRAM_MAX_LINE_LENGTH)) {
    throw new MarkdownDiagramError(
      `Mermaid 图表的单行长度不能超过 ${MARKDOWN_DIAGRAM_MAX_LINE_LENGTH} 个字符。`,
    );
  }
  if (/%%\s*\{/iu.test(source)) {
    throw new MarkdownDiagramError("不允许 Mermaid 初始化指令；主题由博客统一管理。");
  }
  if (/^\s*click\b/imu.test(source)) {
    throw new MarkdownDiagramError("不允许 Mermaid 点击交互或外部链接。");
  }
  if (/^\s*(?:classDef|linkStyle|style)\b/imu.test(source) || /:::/u.test(source)) {
    throw new MarkdownDiagramError("不允许 Mermaid 作者样式；颜色由博客主题统一管理。");
  }
  if (/<\/?[a-z][^>]*>/iu.test(source)) {
    throw new MarkdownDiagramError("Mermaid 图表中不允许嵌入 HTML。");
  }
  if (/\b(?:javascript|vbscript|data)\s*:|@import|url\s*\(/iu.test(source)) {
    throw new MarkdownDiagramError("Mermaid 图表包含不允许的 URL 或样式表达式。");
  }
  if (!diagramType(source)) {
    throw new MarkdownDiagramError(
      "仅支持流程图、状态图、时序图、类图、ER 图和 XY 图表。",
    );
  }
}

function walkElements(node: Root | Element, visit: (element: Element) => void) {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    visit(child);
    walkElements(child, visit);
  }
}

function namespaceSvgIds(svg: Element, prefix: string) {
  const ids = new Map<string, string>();
  walkElements({ children: [svg], type: "root" }, (child) => {
    const id = child.properties.id;
    if (typeof id === "string") ids.set(id, `${prefix}-${id}`);
  });
  walkElements({ children: [svg], type: "root" }, (child) => {
    const id = child.properties.id;
    if (typeof id === "string") child.properties.id = ids.get(id) ?? id;
    for (const [name, value] of Object.entries(child.properties)) {
      if (typeof value !== "string") continue;
      child.properties[name] = value.replace(/url\(#([^)]+)\)/gu, (match, reference) => {
        const namespaced = ids.get(reference);
        return namespaced ? `url(#${namespaced})` : match;
      });
    }
  });
}

function assertViewBox(svg: Element) {
  const viewBox = svg.properties.viewBox;
  const values = typeof viewBox === "string"
    ? viewBox.trim().split(/\s+/u).map(Number)
    : [];
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new MarkdownDiagramError("Mermaid 渲染器返回了无效的 SVG 视窗。");
  }
  const [, , width, height] = values;
  if (
    width <= 0 ||
    height <= 0 ||
    width > 12_000 ||
    height > 12_000 ||
    width * height > 36_000_000
  ) {
    throw new MarkdownDiagramError("Mermaid 图表画布超出安全尺寸限制。");
  }
}

function renderSafeSvg(source: string, index: number): RenderedDiagram {
  validateSource(source);
  const type = diagramType(source);
  if (!type) throw new MarkdownDiagramError("无法识别 Mermaid 图表类型。");

  let rendered: string;
  try {
    rendered = renderMermaidSVG(source, {
      accent: "var(--diagram-accent)",
      bg: "var(--diagram-bg)",
      border: "var(--diagram-border)",
      fg: "var(--diagram-fg)",
      font: "Arial",
      interactive: false,
      line: "var(--diagram-line)",
      muted: "var(--diagram-muted)",
      surface: "var(--diagram-surface)",
      transparent: true,
    });
  } catch (error) {
    throw new MarkdownDiagramError(`Mermaid 语法无法解析：${compactError(error)}`);
  }

  const svgBytes = byteLength(rendered);
  if (svgBytes > MARKDOWN_DIAGRAM_MAX_SVG_BYTES) {
    throw new MarkdownDiagramError("Mermaid 图表渲染结果过大，请拆分为多张较小图表。");
  }
  const parsed = fromHtml(rendered, { fragment: true });
  const safeTree = sanitize(parsed, SVG_SCHEMA) as Root;
  const svg = safeTree.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "svg",
  );
  if (!svg) throw new MarkdownDiagramError("Mermaid 渲染器没有返回可用的 SVG。");

  assertViewBox(svg);
  let elementCount = 1;
  walkElements(svg, () => {
    elementCount += 1;
  });
  if (elementCount > MARKDOWN_DIAGRAM_MAX_ELEMENTS) {
    throw new MarkdownDiagramError("Mermaid 图表元素过多，请拆分图表。");
  }

  namespaceSvgIds(svg, `diagram-${index + 1}`);
  delete svg.properties.xmlns;
  svg.properties = {
    ...svg.properties,
    ariaLabel: `${DIAGRAM_TYPE_LABELS[type]} Mermaid 图表，完整源码可在图表下方展开`,
    className: ["markdown-diagram-svg"],
    preserveAspectRatio: "xMinYMin meet",
    role: "img",
  };

  return { elementCount, node: svg, svgBytes, type };
}

function diagramFigure(source: string, rendered: RenderedDiagram, index: number) {
  const typeLabel = DIAGRAM_TYPE_LABELS[rendered.type];
  return element(
    "figure",
    {
      className: ["markdown-diagram"],
      dataDiagram: rendered.type,
      dataRenderer: "server-svg",
    },
    [
      element("figcaption", { className: ["markdown-diagram-rail"] }, [
        element("span", { className: ["markdown-diagram-kind"] }, [
          text(`DIAGRAM / ${typeLabel}`),
        ]),
        element("span", { className: ["markdown-diagram-renderer"] }, [text("SERVER SVG")]),
      ]),
      element(
        "div",
        {
          ariaLabel: `${typeLabel} 图表，可横向滚动`,
          className: ["markdown-diagram-canvas"],
          role: "region",
          tabIndex: 0,
        },
        [rendered.node],
      ),
      element("details", { className: ["markdown-diagram-source"] }, [
        element("summary", {}, [
          element("span", {}, [text("MERMAID SOURCE / 查看源码")]),
          element("span", { ariaHidden: "true" }, [text(`${String(index + 1).padStart(2, "0")} /`)]),
        ]),
        element("pre", {}, [
          element("code", { className: ["language-mermaid"] }, [text(source)]),
        ]),
      ]),
    ],
  );
}

function codeSource(node: Element) {
  if (node.tagName !== "pre") return undefined;
  const code = node.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "code",
  );
  if (!code) return undefined;
  const classes = Array.isArray(code.properties.className)
    ? code.properties.className
    : [];
  if (!classes.some((className) => String(className).toLowerCase() === "language-mermaid")) {
    return undefined;
  }
  return code.children
    .filter((child): child is Extract<ElementContent, { type: "text" }> => child.type === "text")
    .map((child) => child.value)
    .join("")
    .replace(/\r?\n$/u, "");
}

export function extractMarkdownDiagrams(markdown: string) {
  const diagrams: MarkdownDiagramSource[] = [];
  walkMarkdown(parseMarkdown(markdown), (node) => {
    if (node.type !== "code" || node.lang?.toLowerCase() !== "mermaid") return;
    diagrams.push({
      ...(node.position?.start?.line ? { line: node.position.start.line } : {}),
      value: node.value ?? "",
    });
  });
  return diagrams;
}

export function getMarkdownDiagramIssue(markdown: string): MarkdownDiagramIssue | undefined {
  const diagrams = extractMarkdownDiagrams(markdown);
  if (diagrams.length > MARKDOWN_DIAGRAM_MAX_COUNT) {
    return {
      kind: "diagram",
      message: `每篇内容最多允许 ${MARKDOWN_DIAGRAM_MAX_COUNT} 张 Mermaid 图表。`,
    };
  }

  let totalSvgBytes = 0;
  for (const [index, diagram] of diagrams.entries()) {
    try {
      const rendered = renderSafeSvg(diagram.value, index);
      totalSvgBytes += rendered.svgBytes;
      if (totalSvgBytes > MARKDOWN_DIAGRAM_MAX_TOTAL_SVG_BYTES) {
        throw new MarkdownDiagramError("本文 Mermaid SVG 总大小超出限制，请拆分内容。");
      }
    } catch (error) {
      return {
        kind: "diagram",
        ...(diagram.line ? { line: diagram.line } : {}),
        message: compactError(error) || "Mermaid 图表无法解析。",
      };
    }
  }
  return undefined;
}

export function rehypeMarkdownDiagrams() {
  return function transform(tree: Root) {
    let diagramCount = 0;
    let totalSvgBytes = 0;

    function walk(parent: Root | Element) {
      for (let index = 0; index < parent.children.length; index += 1) {
        const child = parent.children[index];
        if (child.type !== "element") continue;
        const source = codeSource(child);
        if (source === undefined) {
          walk(child);
          continue;
        }
        if (diagramCount >= MARKDOWN_DIAGRAM_MAX_COUNT) {
          throw new MarkdownDiagramError(
            `每篇内容最多允许 ${MARKDOWN_DIAGRAM_MAX_COUNT} 张 Mermaid 图表。`,
          );
        }
        const rendered = renderSafeSvg(source, diagramCount);
        totalSvgBytes += rendered.svgBytes;
        if (totalSvgBytes > MARKDOWN_DIAGRAM_MAX_TOTAL_SVG_BYTES) {
          throw new MarkdownDiagramError("本文 Mermaid SVG 总大小超出限制，请拆分内容。");
        }
        parent.children[index] = diagramFigure(source, rendered, diagramCount) as RootContent;
        diagramCount += 1;
      }
    }

    walk(tree);
  };
}
