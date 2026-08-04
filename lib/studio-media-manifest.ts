import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const STUDIO_MEDIA_MANIFEST_VERSION = 1 as const;
export const STUDIO_MEDIA_ROOT = "public/uploads";

export type StudioMediaManifestEntry = {
  bytes: number;
  path: string;
  sha256: string;
};

export type StudioMediaManifest = {
  entries: StudioMediaManifestEntry[];
  root: typeof STUDIO_MEDIA_ROOT;
  version: typeof STUDIO_MEDIA_MANIFEST_VERSION;
};

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }

  return files;
}

export async function createStudioMediaManifest(
  repositoryRoot = process.cwd(),
): Promise<StudioMediaManifest> {
  const mediaRoot = path.join(repositoryRoot, ...STUDIO_MEDIA_ROOT.split("/"));
  const files = await collectFiles(mediaRoot);
  const entries = await Promise.all(
    files.map(async (filePath) => {
      const bytes = await readFile(filePath);
      const relativePath = path.relative(repositoryRoot, filePath).split(path.sep).join("/");
      return {
        bytes: bytes.byteLength,
        path: relativePath,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );

  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    entries,
    root: STUDIO_MEDIA_ROOT,
    version: STUDIO_MEDIA_MANIFEST_VERSION,
  };
}
