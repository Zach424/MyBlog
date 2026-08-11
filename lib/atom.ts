import type { ContentRecord } from "./content";
import { createFeedLastModified, createFeedUpdatedAt } from "./feed-http.ts";
import { createSha256ConditionalResponse } from "./http-validators.ts";
import { markdownToPlainText } from "./search-index.ts";
import {
  absoluteSiteUrl,
  SITE_DESCRIPTION,
  SITE_LANGUAGE,
  SITE_TITLE,
} from "./site.ts";

export const ATOM_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=86400";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function contentDate(record: ContentRecord) {
  return record.updatedAt ?? record.publishedAt;
}

function atomDate(date: string) {
  return `${date}T00:00:00+08:00`;
}

function sortBySignificantChange(records: readonly ContentRecord[]) {
  return records.slice().sort(
    (left, right) =>
      contentDate(right).localeCompare(contentDate(left)) ||
      right.publishedAt.localeCompare(left.publishedAt) ||
      left.title.localeCompare(right.title, "zh-CN") ||
      left.url.localeCompare(right.url, "en"),
  );
}

export function createAtomXml(siteUrl: URL, records: readonly ContentRecord[]) {
  const feedUrl = absoluteSiteUrl(siteUrl, "/updates.atom");
  const homeUrl = absoluteSiteUrl(siteUrl, "/");
  const entries = sortBySignificantChange(records)
    .map((record) => {
      const url = absoluteSiteUrl(siteUrl, record.url);
      const content = markdownToPlainText(record.body) || record.description;
      const categories = record.tags
        .map((tag) => `    <category term="${escapeXml(tag)}" />`)
        .join("\n");

      return `  <entry>
    <title>${escapeXml(record.title)}</title>
    <id>${escapeXml(url)}</id>
    <link href="${escapeXml(url)}" rel="alternate" type="text/html" />
    <published>${atomDate(record.publishedAt)}</published>
    <updated>${atomDate(contentDate(record))}</updated>
    <summary type="text">${escapeXml(record.description)}</summary>
    <content type="text">${escapeXml(content)}</content>
${categories}
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${SITE_LANGUAGE}">
  <title>${escapeXml(`${SITE_TITLE} — 更新订阅`)}</title>
  <subtitle>${escapeXml(`${SITE_DESCRIPTION} 按真实内容变更时间排序。`)}</subtitle>
  <id>${escapeXml(feedUrl)}</id>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml" />
  <link href="${escapeXml(homeUrl)}" rel="alternate" type="text/html" />
  <updated>${createFeedUpdatedAt("atom", records)}</updated>
  <author>
    <name>Zach424</name>
    <uri>https://github.com/Zach424</uri>
  </author>
  <icon>${escapeXml(absoluteSiteUrl(siteUrl, "/icon.png"))}</icon>
${entries}
</feed>
`;
}

export function createAtomResponse(
  request: Request,
  siteUrl: URL,
  records: readonly ContentRecord[],
) {
  const feedUrl = absoluteSiteUrl(siteUrl, "/updates.atom");
  const homeUrl = absoluteSiteUrl(siteUrl, "/");

  return createSha256ConditionalResponse(
    request,
    createAtomXml(siteUrl, records),
    {
      "cache-control": ATOM_CACHE_CONTROL,
      "content-disposition": 'inline; filename="updates.atom"',
      "content-type": "application/atom+xml; charset=utf-8",
      link: `<${feedUrl}>; rel="self"; type="application/atom+xml", <${homeUrl}>; rel="alternate"; type="text/html"`,
      "x-robots-tag": "noindex",
    },
    { lastModified: createFeedLastModified("atom", records) },
  );
}
