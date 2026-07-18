import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  deriveContentIndexes,
  parsePostFile,
  parseProjectFile,
} from "../lib/content/contract";

async function readMarkdownDirectory(directory: string) {
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
          sourcePath: path.relative(process.cwd(), absolutePath).replaceAll("\\", "/"),
          raw: await readFile(absolutePath, "utf8"),
        };
      }),
  );
}

export async function validateContentRepository(projectRoot: string) {
  const [postSources, projectSources] = await Promise.all([
    readMarkdownDirectory(path.join(projectRoot, "content", "posts")),
    readMarkdownDirectory(path.join(projectRoot, "content", "projects")),
  ]);

  const posts = postSources.map(({ sourcePath, raw }) => parsePostFile(sourcePath, raw));
  const projects = projectSources.map(({ sourcePath, raw }) =>
    parseProjectFile(sourcePath, raw),
  );

  deriveContentIndexes(posts, projects);

  return { posts: posts.length, projects: projects.length };
}
