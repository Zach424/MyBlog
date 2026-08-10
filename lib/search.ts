export interface SearchDocument {
  kind: "article" | "til" | "project";
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
  url: string;
  body: string;
}

export interface SearchMatch {
  document: SearchDocument;
  score: number;
  reason: string;
  excerpt: string;
  excerptSource: "摘要" | "正文";
}

export interface SearchTextSegment {
  text: string;
  matched: boolean;
}

type SearchRange = {
  start: number;
  end: number;
};

const graphemeSegmenter = new Intl.Segmenter("zh-CN", {
  granularity: "grapheme",
});

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN");
}

function termsFor(query: string) {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) return [];
  return [...new Set(normalizedQuery.split(/\s+/u).filter(Boolean))];
}

function createOffsetMapper(value: string) {
  const boundaries = [0];
  for (const part of graphemeSegmenter.segment(value)) {
    boundaries.push(part.index + part.segment.length);
  }

  const normalizedLengths = new Map<number, number>([
    [0, 0],
    [value.length, normalize(value).length],
  ]);

  const normalizedLengthAt = (boundary: number) => {
    const cached = normalizedLengths.get(boundary);
    if (cached !== undefined) return cached;
    const length = normalize(value.slice(0, boundary)).length;
    normalizedLengths.set(boundary, length);
    return length;
  };

  const originalOffsetAt = (normalizedOffset: number) => {
    let low = 0;
    let high = boundaries.length - 1;
    let match = 0;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (normalizedLengthAt(boundaries[middle]) <= normalizedOffset) {
        match = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return boundaries[match];
  };

  return { originalOffsetAt };
}

function matchRanges(value: string, terms: string[]) {
  if (!value || terms.length === 0) return [];

  const normalizedValue = normalize(value);
  const { originalOffsetAt } = createOffsetMapper(value);
  const ranges: SearchRange[] = [];

  for (const term of terms) {
    let cursor = 0;
    while (cursor <= normalizedValue.length - term.length) {
      const index = normalizedValue.indexOf(term, cursor);
      if (index < 0) break;
      const start = originalOffsetAt(index);
      const end = originalOffsetAt(index + term.length);
      if (end > start) ranges.push({ start, end });
      cursor = index + term.length;
    }
  }

  return ranges
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .reduce<SearchRange[]>((merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        merged.push({ ...range });
      }
      return merged;
    }, []);
}

export function createSearchTextSegments(
  value: string,
  query: string,
): SearchTextSegment[] {
  if (!value) return [];
  const ranges = matchRanges(value, termsFor(query));
  if (ranges.length === 0) return [{ text: value, matched: false }];

  const segments: SearchTextSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: value.slice(cursor, range.start), matched: false });
    }
    segments.push({ text: value.slice(range.start, range.end), matched: true });
    cursor = range.end;
  }
  if (cursor < value.length) {
    segments.push({ text: value.slice(cursor), matched: false });
  }
  return segments;
}

function matchedTermCount(value: string, terms: string[]) {
  const normalizedValue = normalize(value);
  return terms.filter((term) => normalizedValue.includes(term)).length;
}

function bodyExcerpt(body: string, terms: string[]) {
  const normalizedBody = normalize(body);
  const firstMatch = terms
    .map((term) => normalizedBody.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (firstMatch === undefined) return body;

  const matchOffset = createOffsetMapper(body).originalOffsetAt(firstMatch);
  const before = Array.from(body.slice(0, matchOffset));
  const after = Array.from(body.slice(matchOffset));
  const prefix = before.slice(-42).join("");
  const suffix = after.slice(0, 118).join("");

  return `${before.length > 42 ? "…" : ""}${`${prefix}${suffix}`.trim()}${
    after.length > 118 ? "…" : ""
  }`;
}

function excerptFor(document: SearchDocument, terms: string[]) {
  const descriptionMatches = matchedTermCount(document.description, terms);
  const bodyMatches = matchedTermCount(document.body, terms);

  if (bodyMatches > descriptionMatches) {
    return {
      text: bodyExcerpt(document.body, terms),
      source: "正文" as const,
    };
  }

  return { text: document.description, source: "摘要" as const };
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
      reason: "首发顺序",
      excerpt: document.description,
      excerptSource: "摘要",
    }));
  }

  const terms = termsFor(query);

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

      const excerpt = excerptFor(document, terms);

      return {
        document,
        score,
        reason: `匹配${[...matchedFields].join("、")}`,
        excerpt: excerpt.text,
        excerptSource: excerpt.source,
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
