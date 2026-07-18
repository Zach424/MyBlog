import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentHeader, TableOfContents } from "@/components/ContentViews";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  getAllProjects,
  getProjectBySlug,
  getTagSlug,
} from "@/lib/content";
import { extractTableOfContents } from "@/lib/content/markdown";

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

  return {
    title: project.title,
    description: project.description,
    alternates: { canonical: project.url },
    openGraph: {
      type: "website",
      title: project.title,
      description: project.description,
      url: project.url,
    },
    twitter: {
      title: project.title,
      description: project.description,
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const toc = extractTableOfContents(project.body);
  const tags = project.tags.map((name) => ({
    name,
    href: `/tags/${getTagSlug(name) ?? ""}`,
  }));

  return (
    <main className="content-page page-shell" id="main-content">
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
      <div className="reading-layout">
        <article className="reading-article">
          <MarkdownContent source={project.body} />
        </article>
        <TableOfContents items={toc} />
      </div>
    </main>
  );
}
