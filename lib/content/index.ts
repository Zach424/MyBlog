import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  deriveContentIndexes,
  isPublished,
  parsePostFile,
  parseProjectFile,
  sortPosts,
  sortProjects,
} from "./contract";

function readMarkdownDirectory(kind: "posts" | "projects") {
  const directory = path.join(process.cwd(), "content", kind);
  return Object.fromEntries(
    readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .sort((left, right) => left.name.localeCompare(right.name, "en"))
      .map((entry) => {
        const sourcePath = `content/${kind}/${entry.name}`;
        return [sourcePath, readFileSync(path.join(directory, entry.name), "utf8")];
      }),
  );
}

const postSources = readMarkdownDirectory("posts");
const projectSources = readMarkdownDirectory("projects");

const allPosts = Object.entries(postSources).map(([sourcePath, raw]) =>
  parsePostFile(sourcePath, raw),
);
const allProjects = Object.entries(projectSources).map(([sourcePath, raw]) =>
  parseProjectFile(sourcePath, raw),
);

if (!process.env.CONTENT_BUILD_DATE) {
  throw new Error("CONTENT_BUILD_DATE was not injected by next.config.ts");
}

const contentBuildDate = new Date(`${process.env.CONTENT_BUILD_DATE}T00:00:00.000Z`);
const publishedPosts = sortPosts(
  allPosts.filter((post) => isPublished(post, contentBuildDate)),
);
const publishedProjects = sortProjects(
  allProjects.filter((project) => isPublished(project, contentBuildDate)),
);
const indexes = deriveContentIndexes(publishedPosts, publishedProjects);

export function getAllPosts() {
  return publishedPosts;
}

export function getAllProjects() {
  return publishedProjects;
}

export function getAllContent() {
  return [...publishedPosts, ...publishedProjects].sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      left.title.localeCompare(right.title, "zh-CN"),
  );
}

export function getPostBySlug(slug: string) {
  return publishedPosts.find((post) => post.slug === slug);
}

export function getProjectBySlug(slug: string) {
  return publishedProjects.find((project) => project.slug === slug);
}

export function getFeaturedProject() {
  return publishedProjects.find((project) => project.featured) ?? publishedProjects[0];
}

export function getSeriesIndex() {
  return indexes.series;
}

export function getSeriesBySlug(slug: string) {
  return indexes.series.find((series) => series.slug === slug);
}

export function getTagIndex() {
  return indexes.tags;
}

export function getTagBySlug(slug: string) {
  return indexes.tags.find((tag) => tag.slug === slug);
}

export function getTagSlug(name: string) {
  return indexes.tags.find((tag) => tag.name === name)?.slug;
}

export type {
  ContentRecord,
  PostRecord,
  ProjectRecord,
  SeriesIndexEntry,
  TagIndexEntry,
} from "./contract";
