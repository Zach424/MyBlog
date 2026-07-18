import { getAllContent } from "@/lib/content";
import { createRssXml } from "@/lib/discovery";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const xml = createRssXml(siteUrl, getAllContent());

  return new Response(xml, {
    headers: {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "content-type": "application/rss+xml; charset=utf-8",
    },
  });
}
