import katex, { type KatexOptions } from "katex";
import { extractMarkdownMathExpressions } from "./content/markdown.ts";

export const MARKDOWN_MATH_KATEX_OPTIONS = {
  maxExpand: 1_000,
  maxSize: 20,
  output: "htmlAndMathml",
  strict: "error",
  throwOnError: true,
  trust: false,
} as const satisfies KatexOptions;

export interface MarkdownMathIssue {
  line?: number;
  message: string;
}

function compactKatexError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/^KaTeX parse error:\s*/u, "")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 240);
}

export function getMarkdownMathIssue(markdown: string): MarkdownMathIssue | undefined {
  for (const expression of extractMarkdownMathExpressions(markdown)) {
    try {
      katex.renderToString(expression.value, {
        ...MARKDOWN_MATH_KATEX_OPTIONS,
        displayMode: expression.display,
      });
    } catch (error) {
      return {
        ...(expression.line ? { line: expression.line } : {}),
        message: compactKatexError(error) || "未知 KaTeX 解析错误",
      };
    }
  }
  return undefined;
}
