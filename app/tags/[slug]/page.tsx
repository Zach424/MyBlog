import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BreadcrumbTrail } from "@/components/BreadcrumbTrail";
import { CollectionIntro, ContentIndexList } from "@/components/ContentViews";
import { getTagBySlug, getTagIndex } from "@/lib/content";
import { resolveSiteUrl } from "@/lib/site";

type TagDetailProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getTagIndex().map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({ params }: TagDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = getTagBySlug(slug);
  if (!tag) return { title: "标签不存在" };
  const description = `与 ${tag.name} 相关的文章和项目，共 ${tag.count} 条。`;
  const feedPath = `/tags/${tag.slug}/rss.xml`;

  return {
    title: tag.name,
    description,
    alternates: {
      canonical: `/tags/${tag.slug}`,
      types: { "application/rss+xml": feedPath },
    },
    openGraph: {
      title: `${tag.name} — Zach424`,
      description,
      url: `/tags/${tag.slug}`,
    },
  };
}

export default async function TagDetailPage({ params }: TagDetailProps) {
  const { slug } = await params;
  const tag = getTagBySlug(slug);
  if (!tag) notFound();
  const siteUrl = resolveSiteUrl(await headers());

  return (
    <main className="collection-page page-shell" id="main-content">
      <BreadcrumbTrail
        items={[
          { href: "/", name: "首页" },
          { href: "/tags", name: "标签" },
          { href: `/tags/${tag.slug}`, name: tag.name },
        ]}
        siteUrl={siteUrl}
      />
      <CollectionIntro
        eyebrow="Tag index"
        title={tag.name}
        description="这里同时收录学习记录和项目复盘，便于比较同一技术在不同上下文中的使用方式。"
        meta={`${tag.count} MATCH${tag.count === 1 ? "" : "ES"}`}
      />
      <nav className="collection-links" aria-label={`${tag.name} 订阅`}>
        <a href={`/tags/${tag.slug}/rss.xml`} type="application/rss+xml">
          订阅此标签 RSS <span aria-hidden="true">→</span>
        </a>
      </nav>
      <ContentIndexList items={tag.items} />
    </main>
  );
}
