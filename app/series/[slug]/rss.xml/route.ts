import { getSeriesBySlug, getSeriesIndex } from "@/lib/content";
import { createRssNotFoundResponse, createRssResponse } from "@/lib/rss";
import { absoluteSiteUrl, resolveSiteUrl, SITE_TITLE } from "@/lib/site";

type SeriesRssContext = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getSeriesIndex().map((series) => ({ slug: series.slug }));
}

export async function GET(request: Request, { params }: SeriesRssContext) {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);

  if (!series) {
    return createRssNotFoundResponse("Series");
  }

  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const homePath = `/series/${series.slug}`;
  const feedPath = `${homePath}/rss.xml`;

  return createRssResponse(request, siteUrl, series.posts, {
    description: `专题“${series.title}”，按最新发布顺序订阅，共 ${series.posts.length} 篇文章。`,
    feedPath,
    homePath,
    title: `${series.title} — ${SITE_TITLE}`,
    headers: {
      "content-disposition": `inline; filename="${series.slug}.rss.xml"`,
      link: `<${absoluteSiteUrl(siteUrl, feedPath)}>; rel="self"; type="application/rss+xml", <${absoluteSiteUrl(siteUrl, homePath)}>; rel="up"; type="text/html"`,
      "x-robots-tag": "noindex",
    },
  });
}
