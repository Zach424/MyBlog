import SeriesPage, {
  generateMetadata as generateSeriesMetadata,
} from "../[slug]/page";

const params = Promise.resolve({ slug: "build-my-blog" });

export function generateMetadata() {
  return generateSeriesMetadata({ params });
}

export default function StaticSeriesPage() {
  return SeriesPage({ params });
}
