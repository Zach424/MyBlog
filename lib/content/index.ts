/// <reference types="vite/client" />

import {
  deriveContentIndexes,
  isPublished,
  parsePostFile,
  parseProjectFile,
  sortPosts,
  sortProjects,
} from "./contract";

const postSources = import.meta.glob("../../content/posts/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const projectSources = import.meta.glob("../../content/projects/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const allPosts = Object.entries(postSources).map(([sourcePath, raw]) =>
  parsePostFile(sourcePath, raw),
);
const allProjects = Object.entries(projectSources).map(([sourcePath, raw]) =>
  parseProjectFile(sourcePath, raw),
);

const publishedPosts = sortPosts(allPosts.filter((post) => isPublished(post)));
const publishedProjects = sortProjects(
  allProjects.filter((project) => isPublished(project)),
);
const indexes = deriveContentIndexes(publishedPosts, publishedProjects);

export function getAllPosts() {
  return publishedPosts;
}

export function getAllProjects() {
  return publishedProjects;
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

export function getTagIndex() {
  return indexes.tags;
}

export type {
  ContentRecord,
  PostRecord,
  ProjectRecord,
  SeriesIndexEntry,
  TagIndexEntry,
} from "./contract";
