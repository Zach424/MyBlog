import PostPage, { generateMetadata as generatePostMetadata } from "../[slug]/page";

const params = Promise.resolve({ slug: "project-charter-before-homepage" });

export function generateMetadata() {
  return generatePostMetadata({ params });
}

export default function StaticPostPage() {
  return PostPage({ params });
}
