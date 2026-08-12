import { studioAssetResponse } from "@/lib/studio-assets";

export const dynamic = "force-static";

export async function GET() {
  return studioAssetResponse("faq-editor.mjs");
}
