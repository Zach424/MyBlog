import ProjectPage, {
  generateMetadata as generateProjectMetadata,
} from "../[slug]/page";

const params = Promise.resolve({ slug: "myblog" });

export function generateMetadata() {
  return generateProjectMetadata({ params });
}

export default function StaticProjectPage() {
  return ProjectPage({ params });
}
