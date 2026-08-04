export type PermalinkHeadingLevel = 2 | 3;

export function getHeadingPermalink(id: string) {
  return `#${id}`;
}

export function getHeadingDepthMarker(level: PermalinkHeadingLevel) {
  return "#".repeat(level);
}
