import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ContentHeader,
  ContentNeighbors,
  TableOfContents,
} from "@/components/ContentViews";
import { MarkdownContent } from "@/components/MarkdownContent";
import { StructuredData } from "@/components/StructuredData";
import {
  getAllPosts,
  getPostBySlug,
  getSeriesBySlug,
  getTagSlug,
} from "@/lib/content";
import { extractTableOfContents } from "@/lib/content/markdown";
import { absoluteSiteUrl, resolveSiteUrl } from "@/lib/site";

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) return { title: "文章不存在" };

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: post.canonical ?? post.url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: post.url,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      tags: post.tags,
    },
    twitter: {
      title: post.title,
      description: post.description,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const posts = getAllPosts();
  const index = posts.findIndex((candidate) => candidate.slug === post.slug);
  const previous = posts[index + 1];
  const next = index > 0 ? posts[index - 1] : undefined;
  const series = post.series ? getSeriesBySlug(post.series.slug) : undefined;
  const toc = extractTableOfContents(post.body);
  const siteUrl = resolveSiteUrl(await headers());
  const canonicalUrl = post.canonical ?? absoluteSiteUrl(siteUrl, post.url);
  const tags = post.tags.map((name) => ({
    name,
    href: `/tags/${getTagSlug(name) ?? ""}`,
  }));

  return (
    <main className="content-page page-shell" id="main-content">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.description,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt ?? post.publishedAt,
          inLanguage: "zh-CN",
          keywords: post.tags,
          mainEntityOfPage: canonicalUrl,
          url: canonicalUrl,
          author: {
            "@type": "Person",
            name: "Zach424",
            url: "https://github.com/Zach424",
          },
        }}
      />
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <Link href="/posts">文章</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{post.type === "til" ? "TIL" : "Article"}</span>
      </nav>
      <ContentHeader
        eyebrow={post.type === "til" ? "Today I learned" : "Engineering note"}
        title={post.title}
        description={post.description}
        publishedAt={post.publishedAt}
        updatedAt={post.updatedAt}
        readingMinutes={post.readingMinutes}
        tags={tags}
        aside={
          series ? (
            <Link className="content-series-link" href={`/series/${series.slug}`}>
              <span>Series {post.series?.order}/{series.posts.length}</span>
              <strong>{series.title}</strong>
            </Link>
          ) : null
        }
      />
      <div className="reading-layout">
        <article className="reading-article">
          <MarkdownContent source={post.body} />
        </article>
        <TableOfContents items={toc} />
      </div>
      <ContentNeighbors previous={previous} next={next} />
    </main>
  );
}
