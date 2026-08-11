import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import type { Options as ReactMarkdownOptions } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { rehypeMarkdownCallouts } from "@/lib/markdown-callout";
import { rehypeMarkdownDiagrams } from "@/lib/markdown-diagram";
import { rehypeMarkdownVideos } from "@/lib/markdown-video";
import {
  getMarkdownFootnoteBackLabel,
  MARKDOWN_FOOTNOTE_CLOBBER_PREFIX,
  MARKDOWN_FOOTNOTE_HEADING_CLASS,
  MARKDOWN_FOOTNOTE_LABEL,
} from "@/lib/markdown-footnote";
import { MARKDOWN_MATH_KATEX_OPTIONS } from "@/lib/markdown-math";

export const MARKDOWN_REHYPE_OPTIONS = {
  clobberPrefix: MARKDOWN_FOOTNOTE_CLOBBER_PREFIX,
  footnoteBackLabel: getMarkdownFootnoteBackLabel,
  footnoteLabel: MARKDOWN_FOOTNOTE_LABEL,
  footnoteLabelProperties: {
    className: [MARKDOWN_FOOTNOTE_HEADING_CLASS],
  },
  footnoteLabelTagName: "h2",
} satisfies NonNullable<ReactMarkdownOptions["remarkRehypeOptions"]>;

export const MARKDOWN_REHYPE_PLUGINS = [
  rehypeMarkdownCallouts,
  rehypeMarkdownVideos,
  rehypeMarkdownDiagrams,
  rehypeSlug,
  [rehypeKatex, MARKDOWN_MATH_KATEX_OPTIONS],
  [rehypeHighlight, { detect: false, ignoreMissing: true }],
] satisfies NonNullable<ReactMarkdownOptions["rehypePlugins"]>;

export const MARKDOWN_REMARK_PLUGINS = [
  remarkGfm,
  [remarkMath, { singleDollarTextMath: true }],
] satisfies NonNullable<ReactMarkdownOptions["remarkPlugins"]>;

const SAFE_MARKDOWN_PROTOCOL = /^(https?|ircs?|mailto|xmpp)$/iu;

// Mirrors react-markdown's default URL policy so every renderer keeps unsafe
// author-controlled protocols inert, including the Studio HTML preview.
export function transformMarkdownUrl(value: string) {
  const colon = value.indexOf(":");
  const questionMark = value.indexOf("?");
  const numberSign = value.indexOf("#");
  const slash = value.indexOf("/");

  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign) ||
    SAFE_MARKDOWN_PROTOCOL.test(value.slice(0, colon))
  ) {
    return value;
  }

  return "";
}
