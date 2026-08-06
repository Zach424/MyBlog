import { getAllContent } from "@/lib/content";
import { createJsonFeed } from "@/lib/discovery";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const json = createJsonFeed(siteUrl, getAllContent());

  return new Response(json, {
    headers: {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "content-type": "application/feed+json; charset=utf-8",
    },
  });
}
