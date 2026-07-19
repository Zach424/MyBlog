import { studioCmsScriptResponse } from "@/lib/studio-assets";

export const dynamic = "force-static";

export function GET() {
  return studioCmsScriptResponse();
}
