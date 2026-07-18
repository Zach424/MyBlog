import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionIntro, ContentIndexList } from "@/components/ContentViews";
import { getTagBySlug, getTagIndex } from "@/lib/content";

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

  return {
    title: tag.name,
    description,
    alternates: { canonical: `/tags/${tag.slug}` },
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

  return (
    <main className="collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <Link href="/tags">标签</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{tag.name}</span>
      </nav>
      <CollectionIntro
        eyebrow="Tag index"
        title={tag.name}
        description="这里同时收录学习记录和项目复盘，便于比较同一技术在不同上下文中的使用方式。"
        meta={`${tag.count} MATCH${tag.count === 1 ? "" : "ES"}`}
      />
      <ContentIndexList items={tag.items} />
    </main>
  );
}
