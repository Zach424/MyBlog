import type { ContentRecord } from "./content";

export interface SearchDocument {
  kind: "article" | "til" | "project";
  title: string;
  description: string;
  publishedAt: string;
  tags: string[];
  url: string;
  body: string;
}

export interface SearchMatch {
  document: SearchDocument;
  score: number;
  reason: string;
  excerpt: string;
}

export function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/~~~[^\n]*\n([\s\S]*?)~~~/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
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

function excerptFor(document: SearchDocument, terms: string[]) {
  const normalizedBody = normalize(document.body);
  const firstMatch = terms
    .map((term) => normalizedBody.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (firstMatch === undefined) return document.description;

  const start = Math.max(0, firstMatch - 42);
  const end = Math.min(document.body.length, firstMatch + 118);
  return `${start > 0 ? "…" : ""}${document.body.slice(start, end).trim()}${
    end < document.body.length ? "…" : ""
  }`;
}

export function searchDocuments(
  documents: SearchDocument[],
  query: string,
): SearchMatch[] {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) {
    return documents.map((document) => ({
      document,
      score: 0,
      reason: "最新记录",
      excerpt: document.description,
    }));
  }

  const terms = [...new Set(normalizedQuery.split(/\s+/).filter(Boolean))];

  return documents
    .map<SearchMatch | null>((document) => {
      const title = normalize(document.title);
      const description = normalize(document.description);
      const tags = normalize(document.tags.join(" "));
      const body = normalize(document.body);
      const combined = `${title}\n${description}\n${tags}\n${body}`;

      if (!terms.every((term) => combined.includes(term))) return null;

      let score = 0;
      const matchedFields = new Set<string>();

      if (title.includes(normalizedQuery)) score += 40;
      if (tags.includes(normalizedQuery)) score += 28;
      if (description.includes(normalizedQuery)) score += 20;
      if (body.includes(normalizedQuery)) score += 6;

      for (const term of terms) {
        if (title.includes(term)) {
          score += 14;
          matchedFields.add("标题");
        }
        if (tags.includes(term)) {
          score += 10;
          matchedFields.add("标签");
        }
        if (description.includes(term)) {
          score += 7;
          matchedFields.add("摘要");
        }
        if (body.includes(term)) {
          score += 2;
          matchedFields.add("正文");
        }
      }

      return {
        document,
        score,
        reason: `匹配${[...matchedFields].join("、")}`,
        excerpt: excerptFor(document, terms),
      };
    })
    .filter((match): match is SearchMatch => match !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.document.publishedAt.localeCompare(left.document.publishedAt) ||
        left.document.title.localeCompare(right.document.title, "zh-CN"),
    );
}
