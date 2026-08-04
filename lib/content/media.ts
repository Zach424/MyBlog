import path from "node:path";
import { cache } from "react";
import { inspectMediaFile } from "../media-policy.ts";
import type { ContentRecord } from "./contract.ts";
import {
  extractMarkdownImageReferences,
  resolveContentMediaPath,
} from "./media-references.ts";

export type ContentImageDescriptor = {
  height: number;
  src: string;
  width: number;
};

export type ContentCoverDescriptor = ContentImageDescriptor & {
  alt: string;
};

const inspectContentImage = cache(async (repositoryPath: string) => {
  const uploadPath = repositoryPath.slice("public/uploads/".length);
  const absolutePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    ...uploadPath.split("/"),
  );
  return inspectMediaFile(absolutePath, repositoryPath);
});

async function getLocalContentImage(
  reference: string,
  sourcePath: string,
): Promise<ContentImageDescriptor | undefined> {
  const repositoryPath = resolveContentMediaPath(reference, sourcePath);
  if (!repositoryPath) return undefined;

  const inspection = await inspectContentImage(repositoryPath);
  return {
    height: inspection.height,
    src: `/${repositoryPath.slice("public/".length)}`,
    width: inspection.width,
  };
}

export async function getContentCover(
  record: ContentRecord,
): Promise<ContentCoverDescriptor | undefined> {
  if (!record.cover || !record.coverAlt) return undefined;

  const image = await getLocalContentImage(record.cover, record.sourcePath);
  return image ? { ...image, alt: record.coverAlt } : undefined;
}

export async function getMarkdownContentImages(
  markdown: string,
  sourcePath: string,
): Promise<Record<string, ContentImageDescriptor>> {
  const references = [
    ...new Set(
      extractMarkdownImageReferences(markdown).map((reference) => reference.url),
    ),
  ];
  const entries = await Promise.all(
    references.map(async (reference) => {
      const image = await getLocalContentImage(reference, sourcePath);
      return image ? ([reference, image] as const) : undefined;
    }),
  );

  return Object.fromEntries(entries.filter((entry) => entry !== undefined));
}
