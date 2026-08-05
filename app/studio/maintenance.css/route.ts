import { studioAssetResponse } from "@/lib/studio-assets";

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  return studioAssetResponse("maintenance.css");
}
