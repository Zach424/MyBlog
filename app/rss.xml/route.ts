import { getAllContent } from "@/lib/content";
import { createRssXml } from "@/lib/discovery";
import { createFeedLastModified } from "@/lib/feed-http";
import { createSha256ConditionalResponse } from "@/lib/http-validators";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const content = getAllContent();
  const xml = createRssXml(siteUrl, content);

  return createSha256ConditionalResponse(
    request,
    xml,
    {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "content-type": "application/rss+xml; charset=utf-8",
    },
    { lastModified: createFeedLastModified("rss", content) },
  );
}
