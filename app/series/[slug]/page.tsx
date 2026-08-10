import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BreadcrumbTrail } from "@/components/BreadcrumbTrail";
import { CollectionIntro, ContentIndexList } from "@/components/ContentViews";
import { getSeriesBySlug, getSeriesIndex } from "@/lib/content";
import { resolveSiteUrl } from "@/lib/site";

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
  const feedPath = `/series/${series.slug}/rss.xml`;

  return {
    title: series.title,
    description,
    alternates: {
      canonical: `/series/${series.slug}`,
      types: { "application/rss+xml": feedPath },
    },
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
  const siteUrl = resolveSiteUrl(await headers());

  return (
    <main className="collection-page page-shell" id="main-content">
      <BreadcrumbTrail
        items={[
          { href: "/", name: "首页" },
          { href: "/series", name: "专题" },
          { href: `/series/${series.slug}`, name: series.title },
        ]}
        siteUrl={siteUrl}
      />
      <CollectionIntro
        eyebrow="Series trace"
        title={series.title}
        description="按专题顺序阅读，从最初约束到具体实现和验证结果。"
        meta={`${series.posts.length} PARTS / ORDERED`}
      />
      <nav className="collection-links" aria-label={`${series.title} 订阅`}>
        <a href={`/series/${series.slug}/rss.xml`} type="application/rss+xml">
          订阅此专题 RSS <span aria-hidden="true">→</span>
        </a>
      </nav>
      <ContentIndexList items={series.posts} />
    </main>
  );
}
