import { handleCmsOAuth } from "@/lib/cms-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return handleCmsOAuth(request, {
    GITHUB_OAUTH_ID: process.env.GITHUB_OAUTH_ID,
    GITHUB_OAUTH_SECRET: process.env.GITHUB_OAUTH_SECRET,
  });
}
