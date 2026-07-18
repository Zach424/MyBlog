import type { Metadata } from "next";
import Link from "next/link";
import { CollectionIntro, ContentIndexList } from "@/components/ContentViews";
import { getAllPosts } from "@/lib/content";

export const metadata: Metadata = {
  title: "文章",
  description: "Zach424 的技术文章、当天学习记录和项目过程笔记。",
  alternates: { canonical: "/posts" },
  openGraph: {
    title: "文章 — Zach424",
    description: "技术文章、当天学习记录和项目过程笔记。",
    url: "/posts",
  },
};

export default function PostsPage() {
  const posts = getAllPosts();

  return (
    <main className="collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">文章</span>
      </nav>
      <CollectionIntro
        eyebrow="Writing archive"
        title="文章与 TIL"
        description="完整文章负责沉淀经过验证的判断，TIL 负责降低记录当天学习的摩擦。两者都保留来源、日期和后续修订。"
        meta={`${posts.length} ENTRIES / NEWEST FIRST`}
      />
      <ContentIndexList items={posts} />
      <div className="collection-links">
        <Link href="/series">按专题连续阅读 <span aria-hidden="true">→</span></Link>
        <Link href="/tags">查看全部技术标签 <span aria-hidden="true">→</span></Link>
      </div>
    </main>
  );
}
