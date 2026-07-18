import type { Metadata } from "next";
import Link from "next/link";
import { CollectionIntro } from "@/components/ContentViews";
import { SearchExperience } from "@/components/SearchExperience";
import { getAllContent } from "@/lib/content";
import { createSearchDocuments } from "@/lib/search";

export const metadata: Metadata = {
  title: "搜索",
  description: "搜索 Zach424 的技术文章、学习记录和项目复盘。",
  alternates: { canonical: "/search" },
  openGraph: {
    title: "搜索 — Zach424",
    description: "搜索技术文章、学习记录和项目复盘。",
    url: "/search",
  },
};

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const parameters = await searchParams;
  const requestedQuery = Array.isArray(parameters.q) ? parameters.q[0] : parameters.q;
  const initialQuery = requestedQuery?.slice(0, 120) ?? "";
  const documents = createSearchDocuments(getAllContent());

  return (
    <main className="collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">搜索</span>
      </nav>
      <CollectionIntro
        eyebrow="Local discovery"
        title="检索工程轨迹"
        description="搜索只使用已经公开的仓库内容，在浏览器本地完成匹配。输入标题、技术、问题或正文中的判断即可开始。"
        meta={`${documents.length} DOCUMENTS / NO TRACKING`}
      />
      <SearchExperience documents={documents} initialQuery={initialQuery} />
    </main>
  );
}
