import { createOpenSearchDescription } from "@/lib/discovery";
import { createSha256ConditionalResponse } from "@/lib/http-validators";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const xml = createOpenSearchDescription(siteUrl);

  return createSha256ConditionalResponse(request, xml, {
    "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    "content-disposition": 'inline; filename="opensearch.xml"',
    "content-type": "application/opensearchdescription+xml; charset=utf-8",
    "x-robots-tag": "noindex",
  });
}
