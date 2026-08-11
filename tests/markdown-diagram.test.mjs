import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  extractMarkdownDiagrams,
  getMarkdownDiagramIssue,
  MARKDOWN_DIAGRAM_MAX_COUNT,
  MARKDOWN_DIAGRAM_MAX_SOURCE_BYTES,
  rehypeMarkdownDiagrams,
} from "../lib/markdown-diagram.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeMarkdownDiagrams)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

const fixtures = {
  flowchart: "flowchart LR\n  A[Draft] --> B[Publish]",
  state: "stateDiagram-v2\n  [*] --> Draft\n  Draft --> Published",
  sequence: "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Done",
  class: "classDiagram\n  class Article\n  Article : +publish()",
  er: "erDiagram\n  AUTHOR ||--o{ POST : writes",
  xychart:
    'xychart-beta\n  title "Build duration"\n  x-axis [Jan, Feb, Mar]\n  y-axis "Seconds" 0 --> 100\n  line [90, 60, 30]',
};

test("server-renders the six bounded Mermaid families as sanitized evidence diagrams", () => {
  for (const [type, source] of Object.entries(fixtures)) {
    const html = render(`\`\`\`mermaid\n${source}\n\`\`\``);
    assert.match(html, new RegExp(`data-diagram="${type}"`, "u"), type);
    assert.match(html, /data-renderer="server-svg"/u, type);
    assert.match(html, /<svg[^>]*role="img"/u, type);
    assert.match(html, /MERMAID SOURCE \/ 查看源码/u, type);
    assert.match(html, /<code class="language-mermaid">/u, type);
    assert.doesNotMatch(html, /@import|https?:|<script|<foreignObject|on\w+=|href=/iu, type);
  }
});

test("extracts fenced Mermaid sources with source lines and leaves ordinary code alone", () => {
  const markdown = `before

\`\`\`ts
const mermaid = true;
\`\`\`

\`\`\`Mermaid
flowchart TD
  Source --> Publish
\`\`\``;
  const diagrams = extractMarkdownDiagrams(markdown);

  assert.equal(diagrams.length, 1);
  assert.equal(diagrams[0].line, 7);
  assert.match(diagrams[0].value, /^flowchart TD/u);
  assert.match(render(markdown), /<pre><code class="language-ts">/u);
  assert.match(markdownToPlainText(markdown), /Source[\s\S]*Publish/u);
});

test("namespaces SVG marker identifiers across diagrams", () => {
  const html = render(`\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

\`\`\`mermaid
flowchart LR
  C --> D
\`\`\``);

  assert.match(html, /id="diagram-1-arrowhead"/u);
  assert.match(html, /marker-end="url\(#diagram-1-arrowhead\)"/u);
  assert.match(html, /id="diagram-2-arrowhead"/u);
  assert.match(html, /marker-end="url\(#diagram-2-arrowhead\)"/u);
  assert.equal((html.match(/id="diagram-1-arrowhead"/gu) ?? []).length, 1);
});

test("rejects unsupported, styled, interactive, HTML, and over-budget Mermaid", () => {
  const invalidSources = [
    ["mindmap\n  root((Blog))", /仅支持|不支持/u],
    ["flowchart LR\n  A --> B\n  style A fill:#f00", /样式/u],
    ["flowchart LR\n  A --> B\n  click A https://example.com", /交互|链接/u],
    ["%%{init: { 'theme': 'dark' }}%%\nflowchart LR\n  A --> B", /初始化|指令/u],
    ["flowchart LR\n  A[<script>alert(1)</script>] --> B", /HTML/u],
    [`flowchart LR\n  A[${"x".repeat(MARKDOWN_DIAGRAM_MAX_SOURCE_BYTES)}]`, /字节|大小/u],
  ];

  for (const [source, expected] of invalidSources) {
    const issue = getMarkdownDiagramIssue(`\`\`\`mermaid\n${source}\n\`\`\``);
    assert.equal(issue?.kind, "diagram");
    assert.match(issue?.message ?? "", expected);
  }

  const tooMany = Array.from(
    { length: MARKDOWN_DIAGRAM_MAX_COUNT + 1 },
    (_, index) => `\`\`\`mermaid\nflowchart LR\n  A${index} --> B${index}\n\`\`\``,
  ).join("\n\n");
  assert.match(getMarkdownDiagramIssue(tooMany)?.message ?? "", /最多/u);
});

test("wires one server pipeline into public pages, Studio, theme, and print", async () => {
  const [component, pipeline, layout, richStyles, previewRuntime, previewStyles] =
    await Promise.all([
      readFile(new URL("../components/MarkdownContent.tsx", import.meta.url), "utf8"),
      readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
      readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
      readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
    ]);

  assert.doesNotMatch(component, /["']use client["']/u);
  assert.match(pipeline, /rehypeMarkdownDiagrams/u);
  assert.match(layout, /markdown-rich-content\.css/u);
  assert.match(previewRuntime, /diagramCount/u);
  assert.match(previewRuntime, /hasPotentialStudioDiagram/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-diagram\s*\{/u);
    assert.match(styles, /--_node-fill/u);
    assert.match(styles, /--bg:\s*var\(--diagram-bg\)/u);
    assert.match(styles, /\.markdown-diagram-canvas:focus-visible/u);
    assert.match(styles, /\.markdown-diagram-source/u);
  }
  assert.match(
    richStyles,
    /@media print[\s\S]*?\.markdown-diagram-svg[\s\S]*?max-width:\s*100%/u,
  );
});
