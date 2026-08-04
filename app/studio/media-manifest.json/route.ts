import { createStudioMediaManifest } from "@/lib/studio-media-manifest";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(await createStudioMediaManifest(), {
    headers: { "cache-control": "no-store" },
  });
}
