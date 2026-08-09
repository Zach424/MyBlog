import { createHash } from "node:crypto";

export const PUBLIC_CONDITIONAL_CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

const ENTITY_TAG = /^(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/u;

function parseEntityTagList(value: string) {
  const tags: string[] = [];
  let start = 0;
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      tags.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (quoted) return undefined;
  tags.push(value.slice(start).trim());
  return tags.length > 0 && tags.every((tag) => ENTITY_TAG.test(tag))
    ? tags
    : undefined;
}

export function createSha256Etag(body: string) {
  return `"sha256-${createHash("sha256").update(body, "utf8").digest("hex")}"`;
}

export function matchesIfNoneMatch(value: string | null, etag: string) {
  if (value === null) return false;
  const normalized = value.trim();
  if (normalized === "*") return true;
  const tags = parseEntityTagList(normalized);
  const expected = etag.replace(/^W\//u, "");
  return tags?.some((tag) => tag.replace(/^W\//u, "") === expected) ?? false;
}
