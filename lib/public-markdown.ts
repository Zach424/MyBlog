import { stringify as stringifyYaml } from "yaml";
import type { ContentRecord } from "./content";
import { parseMarkdown, walkMarkdown } from "./content/markdown.ts";
import {
  createSha256Etag,
  matchesIfNoneMatch,
  PUBLIC_CONDITIONAL_CACHE_CONTROL,
} from "./http-validators.ts";
import { absoluteSiteUrl, resolveSiteUrl } from "./site.ts";

type MarkdownUrlReplacement = {
  end: number;
  start: number;
  value: string;
};

function canonicalRecordUrl(siteUrl: URL, record: ContentRecord) {
  return record.kind === "post" && record.canonical
    ? record.canonical
    : absoluteSiteUrl(siteUrl, record.url);
}

function portableUrl(value: string, recordUrl: string) {
  if (value.startsWith("#")) return new URL(value, recordUrl).href;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return new URL(value, recordUrl).href;
  }
  return undefined;
}

function urlOffsetInNode(source: string, type: string, value: string) {
  if (type === "definition") {
    const colon = source.indexOf(":");
    return source.indexOf(value, colon >= 0 ? colon + 1 : 0);
  }

  if (type === "link" || type === "image") {
    const destination = source.lastIndexOf("](");
    return source.indexOf(value, destination >= 0 ? destination + 2 : 0);
  }

  return -1;
}

function absolutizeMarkdownUrls(markdown: string, recordUrl: string) {
  const replacements: MarkdownUrlReplacement[] = [];

  walkMarkdown(parseMarkdown(markdown), (node) => {
    if (!node.url || !["definition", "image", "link"].includes(node.type)) return;
    const value = portableUrl(node.url, recordUrl);
    if (!value) return;

    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (start === undefined || end === undefined) {
      throw new Error(`Markdown ${node.type} 缺少可验证的源码位置`);
    }

    const nodeSource = markdown.slice(start, end);
    const relativeOffset = urlOffsetInNode(nodeSource, node.type, node.url);
    if (relativeOffset < 0) {
      throw new Error(`无法在 Markdown ${node.type} 中定位公开 URL：${node.url}`);
    }
    replacements.push({
      end: start + relativeOffset + node.url.length,
      start: start + relativeOffset,
      value,
    });
  });

  let output = markdown;
  let lastStart = markdown.length;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    if (replacement.end > lastStart) {
      throw new Error("Markdown URL 替换范围发生重叠");
    }
    output =
      output.slice(0, replacement.start) +
      replacement.value +
      output.slice(replacement.end);
    lastStart = replacement.start;
  }
  return output;
}

function publicFrontmatter(siteUrl: URL, record: ContentRecord) {
  const common = {
    title: record.title,
    description: record.description,
  };
  const dates = {
    publishedAt: record.publishedAt,
    ...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
    freshness: record.freshness,
    reviewedAt: record.reviewedAt,
    tags: record.tags,
  };
  const canonical = canonicalRecordUrl(siteUrl, record);
  const media = {
    ...(record.cover
      ? { cover: absoluteSiteUrl(siteUrl, record.cover), coverAlt: record.coverAlt }
      : {}),
  };

  if (record.kind === "post") {
    return {
      ...common,
      type: record.type,
      ...dates,
      ...(record.series ? { series: record.series } : {}),
      canonical,
      ...media,
    };
  }

  return {
    ...common,
    type: "project",
    ...dates,
    status: record.status,
    stack: record.stack,
    ...(record.repository ? { repository: record.repository } : {}),
    ...(record.demo ? { demo: record.demo } : {}),
    canonical,
    ...media,
  };
}

function publicMarkdownLastModified(record: ContentRecord) {
  const dates = [record.publishedAt, record.reviewedAt];
  if (record.updatedAt) dates.push(record.updatedAt);
  const latest = dates.reduce((left, right) => (left > right ? left : right));
  return new Date(`${latest}T00:00:00.000Z`).toUTCString();
}

function publicMarkdownHeaders(
  canonical: string,
  record: ContentRecord,
  etag: string,
) {
  return new Headers({
    "cache-control": PUBLIC_CONDITIONAL_CACHE_CONTROL,
    "content-disposition": `inline; filename="${record.slug}.md"`,
    "content-type": "text/markdown; charset=utf-8",
    etag,
    "last-modified": publicMarkdownLastModified(record),
    link: `<${canonical}>; rel="canonical"; type="text/html"`,
    "x-robots-tag": "noindex",
  });
}

export function getPublicMarkdownPath(record: ContentRecord) {
  return `${record.url}/source.md`;
}

export function createPublicMarkdown(siteUrl: URL, record: ContentRecord) {
  const recordUrl = absoluteSiteUrl(siteUrl, record.url);
  const frontmatter = stringifyYaml(publicFrontmatter(siteUrl, record), {
    lineWidth: 0,
  }).trimEnd();
  const body = absolutizeMarkdownUrls(record.body, recordUrl).trimEnd();
  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

export function createPublicMarkdownResponse(request: Request, record: ContentRecord) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const canonical = canonicalRecordUrl(siteUrl, record);
  const body = createPublicMarkdown(siteUrl, record);
  const etag = createSha256Etag(body);
  const headers = publicMarkdownHeaders(canonical, record, etag);

  return matchesIfNoneMatch(request.headers.get("if-none-match"), etag)
    ? new Response(null, { status: 304, headers })
    : new Response(body, { headers });
}

export function createPublicMarkdownNotFoundResponse() {
  return new Response("Markdown source not found.\n", {
    status: 404,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
    },
  });
}
