import PostPage, { generateMetadata as generatePostMetadata } from "../[slug]/page";

const params = Promise.resolve({ slug: "cross-platform-npm-scripts" });

export function generateMetadata() {
  return generatePostMetadata({ params });
}

export default function StaticPostPage() {
  return PostPage({ params });
}
