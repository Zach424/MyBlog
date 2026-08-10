import type {
  ContentRecord,
  PostRecord,
  ProjectRecord,
  SeriesIndexEntry,
  TagIndexEntry,
} from "./content";
import { markdownToPlainText } from "./search-index.ts";
import { absoluteSiteUrl, SITE_DESCRIPTION, SITE_TITLE } from "./site.ts";

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

function newestDate(records: ContentRecord[]) {
  return records.map(contentDate).sort((left, right) => right.localeCompare(left))[0];
}

function rssDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toUTCString();
}

function jsonFeedDate(date: string) {
  return `${date}T00:00:00Z`;
}

function sortContentRecords(records: ContentRecord[]) {
  return records.slice().sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      left.title.localeCompare(right.title, "zh-CN"),
  );
}

export function createOpenSearchDescription(siteUrl: URL) {
  const searchTemplate = `${absoluteSiteUrl(siteUrl, "/search")}?q={searchTerms}`;
  const selfUrl = absoluteSiteUrl(siteUrl, "/opensearch.xml");

  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Zach424 Notes</ShortName>
  <Description>${escapeXml(SITE_DESCRIPTION)}</Description>
  <Url type="text/html" rel="results" template="${escapeXml(searchTemplate)}" />
  <Url type="application/opensearchdescription+xml" rel="self" template="${escapeXml(selfUrl)}" />
  <Query role="example" searchTerms="typescript" />
  <Language>zh-CN</Language>
  <InputEncoding>UTF-8</InputEncoding>
  <OutputEncoding>UTF-8</OutputEncoding>
</OpenSearchDescription>
`;
}

export function createJsonFeed(siteUrl: URL, records: ContentRecord[]) {
  const items = sortContentRecords(records).map((record) => {
    const url = absoluteSiteUrl(siteUrl, record.url);
    const contentText = markdownToPlainText(record.body) || record.description;

    return {
      id: url,
      url,
      title: record.title,
      summary: record.description,
      content_text: contentText,
      date_published: jsonFeedDate(record.publishedAt),
      ...(record.updatedAt
        ? { date_modified: jsonFeedDate(record.updatedAt) }
        : {}),
      tags: record.tags,
      ...(record.cover
        ? { banner_image: absoluteSiteUrl(siteUrl, record.cover) }
        : {}),
    };
  });

  return `${JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: SITE_TITLE,
      home_page_url: absoluteSiteUrl(siteUrl, "/"),
      feed_url: absoluteSiteUrl(siteUrl, "/feed.json"),
      description: SITE_DESCRIPTION,
      language: "zh-CN",
      authors: [{ name: "Zach424", url: "https://github.com/Zach424" }],
      icon: absoluteSiteUrl(siteUrl, "/icon.png"),
      items,
    },
    null,
    2,
  )}\n`;
}

export function createRssXml(siteUrl: URL, records: ContentRecord[]) {
  const feedUrl = absoluteSiteUrl(siteUrl, "/rss.xml");
  const homeUrl = absoluteSiteUrl(siteUrl, "/");
  const lastBuildDate = newestDate(records) ?? "2026-07-18";
  const items = sortContentRecords(records)
    .map((record) => {
      const url = absoluteSiteUrl(siteUrl, record.url);
      const categories = [record.kind === "project" ? "Project" : record.type, ...record.tags]
        .map((category) => `      <category>${escapeXml(category)}</category>`)
        .join("\n");

      return `    <item>
      <title>${escapeXml(record.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${rssDate(record.publishedAt)}</pubDate>
      <description>${escapeXml(record.description)}</description>
${categories}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(homeUrl)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${rssDate(lastBuildDate)}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

interface SitemapInput {
  posts: PostRecord[];
  projects: ProjectRecord[];
  series: SeriesIndexEntry[];
  tags: TagIndexEntry[];
}

interface SitemapEntry {
  path: string;
  lastModified?: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
}

export function createSitemapXml(siteUrl: URL, input: SitemapInput) {
  const records: ContentRecord[] = [...input.posts, ...input.projects];
  const siteDate = newestDate(records);
  const entries: SitemapEntry[] = [
    { path: "/", lastModified: siteDate, changeFrequency: "weekly", priority: 1 },
    { path: "/posts", lastModified: newestDate(input.posts), changeFrequency: "weekly", priority: 0.9 },
    { path: "/projects", lastModified: newestDate(input.projects), changeFrequency: "monthly", priority: 0.8 },
    { path: "/archive", lastModified: siteDate, changeFrequency: "weekly", priority: 0.7 },
    { path: "/series", lastModified: newestDate(input.posts), changeFrequency: "monthly", priority: 0.7 },
    { path: "/tags", lastModified: siteDate, changeFrequency: "monthly", priority: 0.6 },
    { path: "/knowledge", lastModified: siteDate, changeFrequency: "monthly", priority: 0.7 },
    { path: "/search", lastModified: siteDate, changeFrequency: "weekly", priority: 0.7 },
    { path: "/about", lastModified: siteDate, changeFrequency: "monthly", priority: 0.5 },
    ...input.posts.map((post) => ({
      path: post.url,
      lastModified: contentDate(post),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...input.projects.map((project) => ({
      path: project.url,
      lastModified: contentDate(project),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...input.series.map((entry) => ({
      path: `/series/${entry.slug}`,
      lastModified: newestDate(entry.posts),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...input.tags.map((tag) => ({
      path: `/tags/${tag.slug}`,
      lastModified: newestDate(tag.items),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(absoluteSiteUrl(siteUrl, entry.path))}</loc>${
      entry.lastModified ? `\n    <lastmod>${entry.lastModified}</lastmod>` : ""
    }
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function createRobotsText(siteUrl: URL) {
  return `User-agent: *
Allow: /
Disallow: /studio
Disallow: /api/cms/

Host: ${siteUrl.host}
Sitemap: ${absoluteSiteUrl(siteUrl, "/sitemap.xml")}
`;
}
