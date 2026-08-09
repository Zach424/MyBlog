import { getProjectBySlug } from "@/lib/content";
import {
  createPublicMarkdownNotFoundResponse,
  createPublicMarkdownResponse,
} from "@/lib/public-markdown";

export async function GET(
  request: Request,
  { params }: RouteContext<"/projects/[slug]/source.md">,
) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  return project
    ? createPublicMarkdownResponse(request, project)
    : createPublicMarkdownNotFoundResponse();
}
