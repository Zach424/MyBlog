import { getAllContent } from "@/lib/content";
import { createJsonFeed } from "@/lib/discovery";
import { createSha256ConditionalResponse } from "@/lib/http-validators";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const json = createJsonFeed(siteUrl, getAllContent());

  return createSha256ConditionalResponse(request, json, {
    "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    "content-type": "application/feed+json; charset=utf-8",
  });
}
