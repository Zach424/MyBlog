import { getAllContent } from "@/lib/content";
import { createContentManifestResponse } from "@/lib/content-manifest";

export function GET(request: Request) {
  return createContentManifestResponse(request, getAllContent());
}
