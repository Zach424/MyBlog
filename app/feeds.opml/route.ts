import { getSeriesIndex, getTagIndex } from "@/lib/content";
import { createOpmlResponse } from "@/lib/opml";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  return createOpmlResponse(
    request,
    resolveSiteUrl(request.headers, request.url),
    {
      series: getSeriesIndex().map(({ posts, slug, title }) => ({
        count: posts.length,
        slug,
        title,
      })),
      tags: getTagIndex().map(({ count, name, slug }) => ({
        count,
        name,
        slug,
      })),
    },
  );
}
