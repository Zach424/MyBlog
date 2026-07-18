import type { Metadata } from "next";
import Link from "next/link";
import { CollectionIntro } from "@/components/ContentViews";
import { getTagIndex } from "@/lib/content";

export const metadata: Metadata = {
  title: "标签",
  description: "跨文章与项目的技术主题索引。",
  alternates: { canonical: "/tags" },
  openGraph: {
    title: "标签 — Zach424",
    description: "跨文章与项目的技术主题索引。",
    url: "/tags",
  },
};

export default function TagsPage() {
  const tags = getTagIndex();

  return (
    <main className="collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">标签</span>
      </nav>
      <CollectionIntro
        eyebrow="Cross index"
        title="技术标签"
        description="标签跨越文章和项目，用于找回同一技术在不同场景中的判断与证据。"
        meta={`${tags.length} NORMALIZED TAGS`}
      />
      <div className="tag-directory">
        {tags.map((tag) => (
          <Link href={`/tags/${tag.slug}`} key={tag.slug}>
            <strong>{tag.name}</strong>
            <span>{tag.count}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
