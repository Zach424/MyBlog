import {
  getAllPosts,
  getAllProjects,
  getSeriesIndex,
  getTagIndex,
} from "@/lib/content";
import { createSitemapXml } from "@/lib/discovery";
import { resolveSiteUrl } from "@/lib/site";

export function GET(request: Request) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const xml = createSitemapXml(siteUrl, {
    posts: getAllPosts(),
    projects: getAllProjects(),
    series: getSeriesIndex(),
    tags: getTagIndex(),
  });

  return new Response(xml, {
    headers: {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "content-type": "application/xml; charset=utf-8",
    },
  });
}
