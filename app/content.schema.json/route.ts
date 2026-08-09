import { createContentManifestSchemaResponse } from "@/lib/content-manifest-schema";

export function GET(request: Request) {
  return createContentManifestSchemaResponse(request);
}
