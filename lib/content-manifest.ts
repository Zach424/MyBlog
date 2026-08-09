import type { ContentRecord } from "./content";
import { createPublicMarkdown, getPublicMarkdownPath } from "./public-markdown.ts";
import {
  createSha256Etag,
  matchesIfNoneMatch,
  PUBLIC_CONDITIONAL_CACHE_CONTROL,
} from "./http-validators.ts";
import { absoluteSiteUrl, resolveSiteUrl } from "./site.ts";

export interface ContentManifestItem {
  id: string;
  kind: ContentRecord["kind"];
  type: "article" | "project" | "til";
  title: string;
  html_url: string;
  markdown_url: string;
  markdown_etag: string;
  published_at: string;
  updated_at?: string;
  reviewed_at: string;
  tags: string[];
}

export interface ContentManifestDocument {
  version: 1;
  home_url: string;
  manifest_url: string;
  language: "zh-CN";
  items: ContentManifestItem[];
}

function sortContentRecords(records: ContentRecord[]) {
  return records.slice().sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      left.title.localeCompare(right.title, "zh-CN"),
  );
}

function newestPublicDate(records: ContentRecord[]) {
  return records
    .flatMap((record) => [
      record.publishedAt,
      record.reviewedAt,
      ...(record.updatedAt ? [record.updatedAt] : []),
    ])
    .sort((left, right) => right.localeCompare(left))[0];
}

function manifestItem(siteUrl: URL, record: ContentRecord): ContentManifestItem {
  const htmlUrl = absoluteSiteUrl(siteUrl, record.url);
  const markdownUrl = absoluteSiteUrl(siteUrl, getPublicMarkdownPath(record));

  return {
    id: htmlUrl,
    kind: record.kind,
    type: record.kind === "post" ? record.type : "project",
    title: record.title,
    html_url: htmlUrl,
    markdown_url: markdownUrl,
    markdown_etag: createSha256Etag(createPublicMarkdown(siteUrl, record)),
    published_at: record.publishedAt,
    ...(record.updatedAt ? { updated_at: record.updatedAt } : {}),
    reviewed_at: record.reviewedAt,
    tags: record.tags,
  };
}

export function createContentManifestDocument(
  siteUrl: URL,
  records: ContentRecord[],
): ContentManifestDocument {
  return {
    version: 1,
    home_url: absoluteSiteUrl(siteUrl, "/"),
    manifest_url: absoluteSiteUrl(siteUrl, "/content.json"),
    language: "zh-CN",
    items: sortContentRecords(records).map((record) =>
      manifestItem(siteUrl, record),
    ),
  };
}

export function createContentManifest(siteUrl: URL, records: ContentRecord[]) {
  return `${JSON.stringify(createContentManifestDocument(siteUrl, records), null, 2)}\n`;
}

function contentManifestHeaders(
  siteUrl: URL,
  records: ContentRecord[],
  etag: string,
) {
  const manifestUrl = absoluteSiteUrl(siteUrl, "/content.json");
  const schemaUrl = absoluteSiteUrl(siteUrl, "/content.schema.json");
  const homeUrl = absoluteSiteUrl(siteUrl, "/");
  const headers = new Headers({
    "cache-control": PUBLIC_CONDITIONAL_CACHE_CONTROL,
    "content-disposition": 'inline; filename="content.json"',
    "content-type": "application/json; charset=utf-8",
    etag,
    link: `<${manifestUrl}>; rel="self"; type="application/json", <${schemaUrl}>; rel="describedby"; type="application/schema+json", <${homeUrl}>; rel="up"; type="text/html"`,
    "x-robots-tag": "noindex",
  });
  const newestDate = newestPublicDate(records);
  if (newestDate) {
    headers.set(
      "last-modified",
      new Date(`${newestDate}T00:00:00.000Z`).toUTCString(),
    );
  }
  return headers;
}

export function createContentManifestResponse(
  request: Request,
  records: ContentRecord[],
) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const body = createContentManifest(siteUrl, records);
  const etag = createSha256Etag(body);
  const headers = contentManifestHeaders(siteUrl, records, etag);

  return matchesIfNoneMatch(request.headers.get("if-none-match"), etag)
    ? new Response(null, { status: 304, headers })
    : new Response(body, { headers });
}
