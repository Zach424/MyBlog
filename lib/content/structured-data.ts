import { SITE_LANGUAGE } from "../site.ts";
import { createContentStructuredIdentity } from "../website.ts";
import type { PostRecord, ProjectRecord } from "./contract.ts";

type BlogPostingRecord = Pick<
  PostRecord,
  | "description"
  | "publishedAt"
  | "readingMinutes"
  | "reviewedAt"
  | "tags"
  | "title"
  | "wordCount"
>;

type SoftwareSourceCodeRecord = Pick<
  ProjectRecord,
  | "description"
  | "publishedAt"
  | "repository"
  | "reviewedAt"
  | "stack"
  | "tags"
  | "title"
>;

type ContentStructuredDataInput = {
  canonicalUrl: URL;
  imageUrl?: URL;
  siteUrl: URL;
};

type BlogPostingStructuredDataInput = ContentStructuredDataInput & {
  post: BlogPostingRecord;
};

type SoftwareSourceCodeStructuredDataInput = ContentStructuredDataInput & {
  project: SoftwareSourceCodeRecord;
};

function createAuthorStructuredData() {
  return {
    "@type": "Person" as const,
    name: "Zach424",
    url: "https://github.com/Zach424",
  };
}

function optionalUrl(url: URL | undefined) {
  return url ? new URL(url).href : undefined;
}

export function createBlogPostingStructuredData({
  canonicalUrl,
  imageUrl,
  post,
  siteUrl,
}: BlogPostingStructuredDataInput) {
  const canonicalHref = new URL(canonicalUrl).href;

  return {
    "@context": "https://schema.org" as const,
    "@type": "BlogPosting" as const,
    ...createContentStructuredIdentity(siteUrl, canonicalUrl),
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.reviewedAt,
    inLanguage: SITE_LANGUAGE,
    keywords: [...post.tags],
    wordCount: post.wordCount,
    timeRequired: `PT${post.readingMinutes}M`,
    mainEntityOfPage: canonicalHref,
    url: canonicalHref,
    image: optionalUrl(imageUrl),
    author: createAuthorStructuredData(),
  };
}

export function createSoftwareSourceCodeStructuredData({
  canonicalUrl,
  imageUrl,
  project,
  siteUrl,
}: SoftwareSourceCodeStructuredDataInput) {
  const canonicalHref = new URL(canonicalUrl).href;

  return {
    "@context": "https://schema.org" as const,
    "@type": "SoftwareSourceCode" as const,
    ...createContentStructuredIdentity(siteUrl, canonicalUrl),
    name: project.title,
    description: project.description,
    dateCreated: project.publishedAt,
    dateModified: project.reviewedAt,
    inLanguage: SITE_LANGUAGE,
    keywords: [...project.tags],
    url: canonicalHref,
    image: optionalUrl(imageUrl),
    codeRepository: project.repository,
    programmingLanguage: [...project.stack],
    author: createAuthorStructuredData(),
  };
}
