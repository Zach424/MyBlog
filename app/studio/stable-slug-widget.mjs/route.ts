import { studioAssetResponse } from "@/lib/studio-assets";

export const dynamic = "force-static";

export function GET() {
  return studioAssetResponse("stable-slug-widget.mjs");
}
