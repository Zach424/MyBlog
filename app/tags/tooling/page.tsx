import TagPage, { generateMetadata as generateTagMetadata } from "../[slug]/page";

const params = Promise.resolve({ slug: "tooling" });

export function generateMetadata() {
  return generateTagMetadata({ params });
}

export default function StaticTagPage() {
  return TagPage({ params });
}
