import { createRobotsText } from "@/lib/discovery";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);

  return new Response(createRobotsText(siteUrl), {
    headers: {
      "cache-control": "public, max-age=86400",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
