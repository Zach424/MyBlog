import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  deriveContentIndexes,
  isPublished,
  type PostRecord,
  type ProjectRecord,
} from "../lib/content/contract.ts";
import {
  parseRedirectRegistry,
  toNextRedirects,
  validateRedirectRegistry,
} from "../lib/redirects.ts";
import { loadContentRepository } from "./validate-content.ts";

const STATIC_HTML_ROUTES = [
  "/",
  "/about",
  "/posts",
  "/projects",
  "/search",
  "/series",
  "/tags",
] as const;

const OPERATIONAL_ROUTES = [
  "/api/cms/auth",
  "/api/cms/callback",
  "/icon.png",
  "/robots.txt",
  "/rss.xml",
  "/sitemap.xml",
  "/studio",
  "/studio/config.mjs",
  "/studio/editor-runtime-3.14.1.js",
  "/studio/media-preflight.mjs",
  "/studio/preview.css",
  "/studio/stable-slug-widget.mjs",
] as const;

function canonicalRoutes(
  posts: PostRecord[],
  projects: ProjectRecord[],
  contentBuildDate: string,
) {
  const buildTime = new Date(`${contentBuildDate}T12:00:00Z`);
  const publishedPosts = posts.filter((post) => isPublished(post, buildTime));
  const publishedProjects = projects.filter((project) => isPublished(project, buildTime));
  const indexes = deriveContentIndexes(publishedPosts, publishedProjects);
  return new Set<string>([
    ...STATIC_HTML_ROUTES,
    ...publishedPosts.map((post) => post.url),
    ...publishedProjects.map((project) => project.url),
    ...indexes.series.map((series) => `/series/${series.slug}`),
    ...indexes.tags.map((tag) => `/tags/${tag.slug}`),
  ]);
}

async function publicFileRoutes(directory: string, publicRoot = directory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const routes: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      routes.push(...(await publicFileRoutes(absolutePath, publicRoot)));
    } else if (entry.isFile()) {
      routes.push(`/${path.relative(publicRoot, absolutePath).replaceAll("\\", "/")}`);
    }
  }
  return routes;
}

export async function loadValidatedRedirects(
  projectRoot: string,
  contentBuildDate: string,
) {
  const registryPath = path.join(projectRoot, "content", "redirects.yml");
  const [{ posts, projects }, raw, staticFiles] = await Promise.all([
    loadContentRepository(projectRoot),
    readFile(registryPath, "utf8"),
    publicFileRoutes(path.join(projectRoot, "public")),
  ]);
  const canonical = canonicalRoutes(posts, projects, contentBuildDate);
  const registry = parseRedirectRegistry("content/redirects.yml", raw);
  const rules = validateRedirectRegistry(
    registry,
    {
      canonicalRoutes: canonical,
      currentRoutes: new Set([...canonical, ...OPERATIONAL_ROUTES, ...staticFiles]),
      reportDate: contentBuildDate,
    },
  );
  return rules;
}

export async function createNextRedirects(projectRoot: string, contentBuildDate: string) {
  return toNextRedirects(await loadValidatedRedirects(projectRoot, contentBuildDate));
}
