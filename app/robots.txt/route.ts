import { createRobotsText } from "@/lib/discovery";
import { createSha256ConditionalResponse } from "@/lib/http-validators";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);

  return createSha256ConditionalResponse(request, createRobotsText(siteUrl), {
    "cache-control": "public, max-age=86400",
    "content-type": "text/plain; charset=utf-8",
  });
}
