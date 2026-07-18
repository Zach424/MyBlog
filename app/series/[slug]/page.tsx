import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionIntro, ContentIndexList } from "@/components/ContentViews";
import { getSeriesBySlug, getSeriesIndex } from "@/lib/content";

type SeriesDetailProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getSeriesIndex().map((series) => ({ slug: series.slug }));
}

export async function generateMetadata({ params }: SeriesDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);
  if (!series) return { title: "专题不存在" };
  const description = `专题“${series.title}”，共 ${series.posts.length} 篇文章。`;

  return {
    title: series.title,
    description,
    alternates: { canonical: `/series/${series.slug}` },
    openGraph: {
      title: `${series.title} — Zach424`,
      description,
      url: `/series/${series.slug}`,
    },
  };
}

export default async function SeriesDetailPage({ params }: SeriesDetailProps) {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);
  if (!series) notFound();

  return (
    <main className="collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <Link href="/series">专题</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{series.title}</span>
      </nav>
      <CollectionIntro
        eyebrow="Series trace"
        title={series.title}
        description="按专题顺序阅读，从最初约束到具体实现和验证结果。"
        meta={`${series.posts.length} PARTS / ORDERED`}
      />
      <ContentIndexList items={series.posts} />
    </main>
  );
}
