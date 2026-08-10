import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  type ContentRecord,
  deriveContentIndexes,
  isPublished,
  parsePostFile,
  parseProjectFile,
  sortPosts,
  sortProjects,
} from "./contract";
import { deriveContentRelations } from "./relations";
import { deriveKnowledgeGraph } from "./knowledge-graph";
import { deriveContentRecommendations } from "./recommendations";

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
const publishedContent = [...publishedPosts, ...publishedProjects];
const relations = deriveContentRelations(publishedContent);
const recommendationsByUrl = new Map(
  publishedContent.map((record) => [
    record.url,
    deriveContentRecommendations(record, publishedContent, relations),
  ]),
);
const knowledgeGraph = deriveKnowledgeGraph(
  publishedContent,
  relations,
);

export function getAllPosts() {
  return publishedPosts;
}

export function getAllProjects() {
  return publishedProjects;
}

export function getAllContent() {
  return [...publishedContent].sort(
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

export function getBacklinksFor(record: ContentRecord) {
  return relations.backlinksByUrl.get(record.url) ?? [];
}

export function getOutgoingReferencesFor(record: ContentRecord) {
  return relations.outgoingByUrl.get(record.url) ?? [];
}

export function getContentRecommendationsFor(record: ContentRecord) {
  return recommendationsByUrl.get(record.url) ?? [];
}

export function getKnowledgeGraph() {
  return knowledgeGraph;
}

export type {
  ContentRecord,
  PostRecord,
  ProjectRecord,
  SeriesIndexEntry,
  TagIndexEntry,
} from "./contract";
export type {
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "./knowledge-graph";
export type {
  ContentRecommendation,
  ContentRecommendationReason,
} from "./recommendations";
export { createContentArchive } from "./archive";
export type { ContentArchiveMonth, ContentArchiveYear } from "./archive";
export { createContentActivity } from "./activity";
export type {
  ContentActivity,
  ContentActivityDay,
  ContentActivityEvent,
  ContentActivityMode,
  ContentActivityType,
} from "./activity";
