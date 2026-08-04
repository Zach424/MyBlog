import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ContentHeader,
  ContentReferenceLedger,
  PrintSource,
  TableOfContents,
} from "@/components/ContentViews";
import { ContentCover } from "@/components/ContentCover";
import { MarkdownContent } from "@/components/MarkdownContent";
import { StructuredData } from "@/components/StructuredData";
import {
  getAllProjects,
  getBacklinksFor,
  getOutgoingReferencesFor,
  getProjectBySlug,
  getTagSlug,
} from "@/lib/content";
import { extractTableOfContents } from "@/lib/content/markdown";
import { getContentCover } from "@/lib/content/media";
import { absoluteSiteUrl, resolveSiteUrl } from "@/lib/site";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return { title: "项目不存在" };
  const cover = await getContentCover(project);
  const socialImage = cover
    ? {
        url: cover.src,
        width: cover.width,
        height: cover.height,
        alt: cover.alt,
      }
    : undefined;

  return {
    title: project.title,
    description: project.description,
    alternates: { canonical: project.url },
    openGraph: {
      type: "website",
      title: project.title,
      description: project.description,
      url: project.url,
      images: socialImage ? [socialImage] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : undefined,
      title: project.title,
      description: project.description,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  const cover = await getContentCover(project);

  const toc = extractTableOfContents(project.body);
  const backlinks = getBacklinksFor(project);
  const outgoing = getOutgoingReferencesFor(project);
  const siteUrl = resolveSiteUrl(await headers());
  const projectUrl = absoluteSiteUrl(siteUrl, project.url);
  const tags = project.tags.map((name) => ({
    name,
    href: `/tags/${getTagSlug(name) ?? ""}`,
  }));

  return (
    <main className="content-page page-shell" id="main-content">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareSourceCode",
          name: project.title,
          description: project.description,
          dateCreated: project.publishedAt,
          dateModified: project.reviewedAt,
          inLanguage: "zh-CN",
          keywords: project.tags,
          url: projectUrl,
          image: cover ? absoluteSiteUrl(siteUrl, cover.src) : undefined,
          codeRepository: project.repository,
          programmingLanguage: project.stack,
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
        <Link href="/projects">项目</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{project.status}</span>
      </nav>
      <ContentHeader
        eyebrow={`Project / ${project.status}`}
        title={project.title}
        description={project.description}
        publishedAt={project.publishedAt}
        updatedAt={project.updatedAt}
        freshness={project.freshness}
        reviewedAt={project.reviewedAt}
        readingMinutes={project.readingMinutes}
        tags={tags}
        aside={
          <div className="project-resources">
            <span>{project.stack.join(" · ")}</span>
            {project.repository ? (
              <a href={project.repository} target="_blank" rel="noreferrer">
                GitHub repository <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            {project.demo ? (
              <a href={project.demo} target="_blank" rel="noreferrer">
                Live demo <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </div>
        }
      />
      <PrintSource url={projectUrl} />
      {cover ? <ContentCover cover={cover} kind="Project" /> : null}
      <div className="reading-layout">
        <article className="reading-article">
          <MarkdownContent source={project.body} sourcePath={project.sourcePath} />
        </article>
        <TableOfContents items={toc} />
      </div>
      <ContentReferenceLedger outgoing={outgoing} backlinks={backlinks} />
    </main>
  );
}
