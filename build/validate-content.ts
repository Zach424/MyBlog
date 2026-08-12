import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  deriveContentIndexes,
  isPublished,
  parsePostFile,
  parseProjectFile,
  validateContentFreshness,
  validateContentDecisions,
  validateContentTimelines,
} from "../lib/content/contract.ts";
import { deriveContentRelations } from "../lib/content/relations.ts";

async function readMarkdownDirectory(directory: string, projectRoot: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const unexpected = entries.filter(
    (entry) => !entry.isFile() || !entry.name.endsWith(".md"),
  );

  if (unexpected.length > 0) {
    throw new Error(
      `[content] ${directory}: 只允许 Markdown 文件，发现 ${unexpected
        .map((entry) => entry.name)
        .join(", ")}`,
    );
  }

  return Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name, "en"))
      .map(async (entry) => {
        const absolutePath = path.join(directory, entry.name);
        return {
          sourcePath: path.relative(projectRoot, absolutePath).replaceAll("\\", "/"),
          raw: await readFile(absolutePath, "utf8"),
        };
      }),
  );
}

export async function validateContentRepository(
  projectRoot: string,
  contentBuildDate: string,
) {
  const { posts, projects } = await loadContentRepository(projectRoot);

  deriveContentIndexes(posts, projects);
  deriveContentRelations([...posts, ...projects]);
  validateContentTimelines([...posts, ...projects], contentBuildDate);
  validateContentDecisions([...posts, ...projects], contentBuildDate);
  const buildTime = new Date(`${contentBuildDate}T12:00:00Z`);
  validateContentFreshness(
    [...posts, ...projects].filter((record) => isPublished(record, buildTime)),
    contentBuildDate,
  );

  return { posts: posts.length, projects: projects.length };
}

export async function loadContentRepository(projectRoot: string) {
  const [postSources, projectSources] = await Promise.all([
    readMarkdownDirectory(path.join(projectRoot, "content", "posts"), projectRoot),
    readMarkdownDirectory(path.join(projectRoot, "content", "projects"), projectRoot),
  ]);

  const posts = postSources.map(({ sourcePath, raw }) => parsePostFile(sourcePath, raw));
  const projects = projectSources.map(({ sourcePath, raw }) =>
    parseProjectFile(sourcePath, raw),
  );

  return { posts, projects };
}
