import { createSha256ConditionalResponse } from "./http-validators.ts";
import {
  absoluteSiteUrl,
  SITE_DESCRIPTION,
  SITE_LANGUAGE,
  SITE_TITLE,
} from "./site.ts";

export const OPML_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=86400";

interface OpmlTagEntry {
  count: number;
  name: string;
  slug: string;
}

interface OpmlSeriesEntry {
  count: number;
  slug: string;
  title: string;
}

export interface SubscriptionOpmlInput {
  series: readonly OpmlSeriesEntry[];
  tags: readonly OpmlTagEntry[];
}

interface OpmlFeed {
  description: string;
  feedPath: string;
  homePath: string;
  title: string;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function compareTitle(
  left: { slug: string; title: string },
  right: { slug: string; title: string },
) {
  return (
    left.title.localeCompare(right.title, "zh-CN") ||
    left.slug.localeCompare(right.slug, "en")
  );
}

function createFeedOutline(siteUrl: URL, feed: OpmlFeed) {
  const title = escapeXml(feed.title);
  return `      <outline type="rss" text="${title}" title="${title}" xmlUrl="${escapeXml(absoluteSiteUrl(siteUrl, feed.feedPath))}" htmlUrl="${escapeXml(absoluteSiteUrl(siteUrl, feed.homePath))}" description="${escapeXml(feed.description)}" language="${SITE_LANGUAGE}" version="RSS" />`;
}

function createGroup(siteUrl: URL, title: string, feeds: readonly OpmlFeed[]) {
  if (feeds.length === 0) return undefined;
  return `    <outline text="${escapeXml(title)}">
${feeds.map((feed) => createFeedOutline(siteUrl, feed)).join("\n")}
    </outline>`;
}

export function createSubscriptionOpml(
  siteUrl: URL,
  { series, tags }: SubscriptionOpmlInput,
) {
  const tagFeeds = tags
    .map((tag) => ({
      description: `与 ${tag.name} 相关的文章和项目，共 ${tag.count} 条。`,
      feedPath: `/tags/${tag.slug}/rss.xml`,
      homePath: `/tags/${tag.slug}`,
      slug: tag.slug,
      title: `${tag.name} — ${SITE_TITLE}`,
    }))
    .sort(compareTitle);
  const seriesFeeds = series
    .map((entry) => ({
      description: `专题“${entry.title}”，按最新发布顺序订阅，共 ${entry.count} 篇文章。`,
      feedPath: `/series/${entry.slug}/rss.xml`,
      homePath: `/series/${entry.slug}`,
      slug: entry.slug,
      title: `${entry.title} — ${SITE_TITLE}`,
    }))
    .sort(compareTitle);
  const groups = [
    createGroup(siteUrl, "全部更新", [
      {
        description: SITE_DESCRIPTION,
        feedPath: "/rss.xml",
        homePath: "/",
        title: SITE_TITLE,
      },
    ]),
    createGroup(siteUrl, "按标签", tagFeeds),
    createGroup(siteUrl, "按专题", seriesFeeds),
  ].filter((group): group is string => Boolean(group));

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(`${SITE_TITLE} — 全部订阅`)}</title>
    <ownerName>Zach424</ownerName>
    <ownerId>https://github.com/Zach424</ownerId>
    <docs>https://opml.org/spec2.opml</docs>
  </head>
  <body>
${groups.join("\n")}
  </body>
</opml>
`;
}

export function createOpmlResponse(
  request: Request,
  siteUrl: URL,
  input: SubscriptionOpmlInput,
) {
  const feedPath = "/feeds.opml";
  const homePath = "/subscribe";

  return createSha256ConditionalResponse(
    request,
    createSubscriptionOpml(siteUrl, input),
    {
      "cache-control": OPML_CACHE_CONTROL,
      "content-disposition":
        'attachment; filename="zach424-subscriptions.opml"',
      "content-type": "text/x-opml; charset=utf-8",
      link: `<${absoluteSiteUrl(siteUrl, feedPath)}>; rel="self"; type="text/x-opml", <${absoluteSiteUrl(siteUrl, homePath)}>; rel="up"; type="text/html"`,
      "x-robots-tag": "noindex",
    },
  );
}
