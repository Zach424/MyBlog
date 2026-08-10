import { getAllContent } from "@/lib/content";
import { createRssResponse } from "@/lib/rss";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  return createRssResponse(
    request,
    resolveSiteUrl(request.headers, request.url),
    getAllContent(),
  );
}
