import { getPostBySlug } from "@/lib/content";
import {
  createPublicMarkdownNotFoundResponse,
  createPublicMarkdownResponse,
} from "@/lib/public-markdown";

export async function GET(
  request: Request,
  { params }: RouteContext<"/posts/[slug]/source.md">,
) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  return post
    ? createPublicMarkdownResponse(request, post)
    : createPublicMarkdownNotFoundResponse();
}
