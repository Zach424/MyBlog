import { getTagBySlug, getTagIndex } from "@/lib/content";
import { createRssResponse } from "@/lib/rss";
import { absoluteSiteUrl, resolveSiteUrl, SITE_TITLE } from "@/lib/site";

type TagRssContext = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getTagIndex().map((tag) => ({ slug: tag.slug }));
}

export async function GET(request: Request, { params }: TagRssContext) {
  const { slug } = await params;
  const tag = getTagBySlug(slug);

  if (!tag) {
    return new Response("Tag RSS not found.\n", {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex",
      },
    });
  }

  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const homePath = `/tags/${tag.slug}`;
  const feedPath = `${homePath}/rss.xml`;

  return createRssResponse(request, siteUrl, tag.items, {
    description: `与 ${tag.name} 相关的文章和项目，共 ${tag.count} 条。`,
    feedPath,
    homePath,
    title: `${tag.name} — ${SITE_TITLE}`,
    headers: {
      "content-disposition": `inline; filename="${tag.slug}.rss.xml"`,
      link: `<${absoluteSiteUrl(siteUrl, feedPath)}>; rel="self"; type="application/rss+xml", <${absoluteSiteUrl(siteUrl, homePath)}>; rel="up"; type="text/html"`,
      "x-robots-tag": "noindex",
    },
  });
}
