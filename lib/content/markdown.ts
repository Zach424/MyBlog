import GithubSlugger from "github-slugger";

export interface TableOfContentsItem {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface InternalContentReference {
  kind: "post" | "project";
  slug: string;
  url: `/posts/${string}` | `/projects/${string}`;
  fragment?: string;
}

function plainHeadingText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\\([\\`*{}\[\]()#+.!_-])/g, "$1")
    .trim();
}

function transformOutsideInlineCode(
  markdown: string,
  transform: (segment: string) => string,
) {
  let output = "";
  let cursor = 0;

  while (cursor < markdown.length) {
    const openingIndex = markdown.indexOf("`", cursor);
    if (openingIndex < 0) return output + transform(markdown.slice(cursor));

    let markerLength = 1;
    while (markdown[openingIndex + markerLength] === "`") markerLength += 1;
    const marker = "`".repeat(markerLength);
    const closingIndex = markdown.indexOf(marker, openingIndex + markerLength);
    if (closingIndex < 0) return output + transform(markdown.slice(cursor));

    output += transform(markdown.slice(cursor, openingIndex));
    output += markdown.slice(openingIndex, closingIndex + markerLength);
    cursor = closingIndex + markerLength;
  }

  return output;
}

export function transformMarkdownProse(
  markdown: string,
  transform: (segment: string) => string,
) {
  let output = "";
  let prose = "";
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const line of markdown.match(/.*(?:\r?\n|$)/gu) ?? []) {
    if (!line) continue;
    const fence = /^\s*(`{3,}|~{3,})/u.exec(line);

    if (!fenceCharacter && fence) {
      output += transformOutsideInlineCode(prose, transform) + line;
      prose = "";
      fenceCharacter = fence[1][0];
      fenceLength = fence[1].length;
      continue;
    }

    if (fenceCharacter) {
      output += line;
      const closingFence = /^\s*(`{3,}|~{3,})\s*$/u.exec(line.trimEnd());
      if (
        closingFence &&
        closingFence[1][0] === fenceCharacter &&
        closingFence[1].length >= fenceLength
      ) {
        fenceCharacter = "";
        fenceLength = 0;
      }
      continue;
    }

    prose += line;
  }

  return output + transformOutsideInlineCode(prose, transform);
}

export function markdownHeadingAnchor(value: string) {
  return new GithubSlugger().slug(plainHeadingText(value));
}

export function extractInternalContentReferences(markdown: string) {
  const references = new Map<string, InternalContentReference>();

  transformMarkdownProse(markdown, (segment) => {
    for (const match of segment.matchAll(
      /(?<!!)\[[^\]]+\]\((\/(posts|projects)\/([^/#)\s]+))(?:#([^\s)]+))?\)/gu,
    )) {
      const kind = match[2] === "posts" ? "post" : "project";
      const url = match[1] as `/posts/${string}` | `/projects/${string}`;
      if (!references.has(url)) {
        references.set(url, {
          kind,
          slug: match[3],
          url,
          ...(match[4] ? { fragment: match[4] } : {}),
        });
      }
    }
    return segment;
  });

  return [...references.values()];
}

export function extractTableOfContents(markdown: string) {
  const slugger = new GithubSlugger();
  const items: TableOfContentsItem[] = [];
  let fencedCode = false;
  let fenceMarker = "";

  for (const line of markdown.split(/\r?\n/)) {
    const fence = /^\s*(```+|~~~+)/.exec(line);
    if (fence) {
      if (!fencedCode) {
        fencedCode = true;
        fenceMarker = fence[1][0];
      } else if (fence[1][0] === fenceMarker) {
        fencedCode = false;
        fenceMarker = "";
      }
      continue;
    }

    if (fencedCode) continue;

    const heading = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!heading) continue;

    const text = plainHeadingText(heading[2]);
    if (!text) continue;

    items.push({
      depth: heading[1].length as 2 | 3,
      id: slugger.slug(text),
      text,
    });
  }

  return items;
}
