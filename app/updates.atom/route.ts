import { getAllContent } from "@/lib/content";
import { createAtomResponse } from "@/lib/atom";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  return createAtomResponse(
    request,
    resolveSiteUrl(request.headers, request.url),
    getAllContent(),
  );
}
