import GithubSlugger from "github-slugger";

export interface TableOfContentsItem {
  depth: 2 | 3;
  id: string;
  text: string;
}

function plainHeadingText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\\([\\`*{}\[\]()#+.!_-])/g, "$1")
    .trim();
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
