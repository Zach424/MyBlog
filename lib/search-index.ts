import type { ContentRecord } from "./content";
import {
  parseMarkdown,
  type MarkdownNode,
} from "./content/markdown.ts";
import type { SearchDocument } from "./search.ts";
import { normalizeMarkdownAudioNotesForPlainText } from "./markdown-audio.ts";
import { normalizeMarkdownCalloutsForPlainText } from "./markdown-callout.ts";
import { normalizeMarkdownFaqsForPlainText } from "./markdown-faq.ts";
import { normalizeMarkdownGalleriesForPlainText } from "./markdown-gallery.ts";
import { normalizeMarkdownGlossariesForPlainText } from "./markdown-glossary.ts";
import { normalizeMarkdownReferenceListsForPlainText } from "./markdown-references.ts";
import { normalizeMarkdownStepsForPlainText } from "./markdown-steps.ts";
import { normalizeMarkdownTablesForPlainText } from "./markdown-table.ts";
import { normalizeMarkdownTaskListsForPlainText } from "./markdown-task-list.ts";

const BLOCK_TYPES = new Set([
  "blockquote",
  "code",
  "definition",
  "footnoteDefinition",
  "heading",
  "list",
  "listItem",
  "math",
  "paragraph",
  "root",
  "table",
  "tableCell",
  "tableRow",
  "thematicBreak",
]);

function markdownNodeText(node: MarkdownNode): string {
  if (node.type === "footnoteReference" || node.type === "html") return "";
  if (node.type === "image" || node.type === "imageReference") {
    return node.alt ?? "";
  }
  if (
    node.type === "text" ||
    node.type === "inlineCode" ||
    node.type === "code" ||
    node.type === "inlineMath" ||
    node.type === "math"
  ) {
    return node.value ?? "";
  }
  if (node.type === "break") return " ";

  const text = (node.children ?? []).map(markdownNodeText).join("");
  return BLOCK_TYPES.has(node.type) ? ` ${text} ` : text;
}

export function markdownToPlainText(markdown: string) {
  const source = markdown.replace(/^---[\s\S]*?---\s*/mu, "");
  const tree = normalizeMarkdownCalloutsForPlainText(
    normalizeMarkdownFaqsForPlainText(
      normalizeMarkdownGalleriesForPlainText(
        normalizeMarkdownGlossariesForPlainText(
        normalizeMarkdownTablesForPlainText(
          normalizeMarkdownStepsForPlainText(
            normalizeMarkdownReferenceListsForPlainText(
              normalizeMarkdownTaskListsForPlainText(
                normalizeMarkdownAudioNotesForPlainText(parseMarkdown(source)),
              ),
            ),
          ),
          ),
        ),
      ),
    ),
  );
  return markdownNodeText(tree).replace(/\s+/gu, " ").trim();
}

function kindFor(record: ContentRecord): SearchDocument["kind"] {
  if (record.kind === "project") return "project";
  return record.type === "til" ? "til" : "article";
}

export function createSearchDocuments(records: ContentRecord[]) {
  return records
    .map<SearchDocument>((record) => ({
      kind: kindFor(record),
      title: record.title,
      description: record.description,
      publishedAt: record.publishedAt,
      updatedAt: record.updatedAt,
      tags: record.tags,
      url: record.url,
      body: markdownToPlainText(record.body),
    }))
    .sort(
      (left, right) =>
        right.publishedAt.localeCompare(left.publishedAt) ||
        left.title.localeCompare(right.title, "zh-CN"),
    );
}
