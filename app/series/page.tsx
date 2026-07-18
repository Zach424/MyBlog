import type { Metadata } from "next";
import Link from "next/link";
import { CollectionIntro } from "@/components/ContentViews";
import { getSeriesIndex } from "@/lib/content";

export const metadata: Metadata = {
  title: "专题",
  description: "按学习目标组织的连续技术文章。",
  alternates: { canonical: "/series" },
  openGraph: {
    title: "专题 — Zach424",
    description: "按学习目标组织的连续技术文章。",
    url: "/series",
  },
};

export default function SeriesPage() {
  const series = getSeriesIndex();

  return (
    <main className="collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">专题</span>
      </nav>
      <CollectionIntro
        eyebrow="Learning paths"
        title="连续专题"
        description="专题把同一学习目标下的文章按真实顺序连接起来，适合从问题背景开始连续阅读。"
        meta={`${series.length} SERIES`}
      />
      <div className="directory-list">
        {series.map((entry) => (
          <Link className="directory-row" href={`/series/${entry.slug}`} key={entry.slug}>
            <span className="directory-count">{String(entry.posts.length).padStart(2, "0")}</span>
            <span>
              <strong>{entry.title}</strong>
              <small>{entry.posts.map((post) => post.title).join(" / ")}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
