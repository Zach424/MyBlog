import { resolveContentBuildDate } from "@/build/content-build-date";
import { getAllContent } from "@/lib/content";
import { createStudioMaintenanceSnapshot } from "@/lib/studio-maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    createStudioMaintenanceSnapshot(getAllContent(), resolveContentBuildDate()),
    {
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    },
  );
}
