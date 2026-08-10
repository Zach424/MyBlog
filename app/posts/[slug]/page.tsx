import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ContentHeader,
  ContentNeighbors,
  ContentRecommendations,
  ContentReferenceLedger,
  PrintSource,
  TableOfContents,
} from "@/components/ContentViews";
import { ContentCover } from "@/components/ContentCover";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ShareTrace } from "@/components/ShareTrace";
import { StructuredData } from "@/components/StructuredData";
import {
  getAllPosts,
  getBacklinksFor,
  getContentRecommendationsFor,
  getOutgoingReferencesFor,
  getPostBySlug,
  getSeriesBySlug,
  getTagSlug,
} from "@/lib/content";
import { extractTableOfContents } from "@/lib/content/markdown";
import { getContentCover } from "@/lib/content/media";
import { getPublicMarkdownPath } from "@/lib/public-markdown";
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
  const cover = await getContentCover(post);
  const socialImage = cover
    ? {
        url: cover.src,
        width: cover.width,
        height: cover.height,
        alt: cover.alt,
      }
    : undefined;

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: post.canonical ?? post.url,
      types: { "text/markdown": getPublicMarkdownPath(post) },
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: post.url,
      publishedTime: post.publishedAt,
      modifiedTime: post.reviewedAt,
      tags: post.tags,
      images: socialImage ? [socialImage] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : undefined,
      title: post.title,
      description: post.description,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  const cover = await getContentCover(post);

  const posts = getAllPosts();
  const index = posts.findIndex((candidate) => candidate.slug === post.slug);
  const previous = posts[index + 1];
  const next = index > 0 ? posts[index - 1] : undefined;
  const series = post.series ? getSeriesBySlug(post.series.slug) : undefined;
  const toc = extractTableOfContents(post.body);
  const backlinks = getBacklinksFor(post);
  const outgoing = getOutgoingReferencesFor(post);
  const recommendations = getContentRecommendationsFor(post);
  const siteUrl = resolveSiteUrl(await headers());
  const canonicalUrl = post.canonical ?? absoluteSiteUrl(siteUrl, post.url);
  const sourceUrl = absoluteSiteUrl(siteUrl, getPublicMarkdownPath(post));
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
          dateModified: post.reviewedAt,
          inLanguage: "zh-CN",
          keywords: post.tags,
          mainEntityOfPage: canonicalUrl,
          url: canonicalUrl,
          image: cover ? absoluteSiteUrl(siteUrl, cover.src) : undefined,
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
        freshness={post.freshness}
        reviewedAt={post.reviewedAt}
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
      <ShareTrace
        text={post.description}
        sourceUrl={sourceUrl}
        title={post.title}
        url={canonicalUrl}
      />
      <PrintSource url={canonicalUrl} />
      {cover ? (
        <ContentCover
          cover={cover}
          kind={post.type === "til" ? "TIL" : "Article"}
        />
      ) : null}
      <div className="reading-layout">
        <article className="reading-article">
          <MarkdownContent source={post.body} sourcePath={post.sourcePath} />
        </article>
        <TableOfContents items={toc} />
      </div>
      <ContentRecommendations items={recommendations} />
      <ContentReferenceLedger outgoing={outgoing} backlinks={backlinks} />
      <ContentNeighbors previous={previous} next={next} />
    </main>
  );
}
