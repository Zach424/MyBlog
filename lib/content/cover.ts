import path from "node:path";
import { cache } from "react";
import { inspectMediaFile } from "../media-policy";
import type { ContentRecord } from "./contract";
import { resolveContentMediaPath } from "./media-references";

export type ContentCoverDescriptor = {
  alt: string;
  height: number;
  src: string;
  width: number;
};

const inspectContentCover = cache(async (repositoryPath: string) => {
  const uploadPath = repositoryPath.slice("public/uploads/".length);
  const absolutePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    ...uploadPath.split("/"),
  );
  return inspectMediaFile(absolutePath, repositoryPath);
});

export async function getContentCover(
  record: ContentRecord,
): Promise<ContentCoverDescriptor | undefined> {
  if (!record.cover || !record.coverAlt) return undefined;

  const repositoryPath = resolveContentMediaPath(record.cover, record.sourcePath);
  if (!repositoryPath) return undefined;

  const inspection = await inspectContentCover(repositoryPath);
  return {
    alt: record.coverAlt,
    height: inspection.height,
    src: record.cover,
    width: inspection.width,
  };
}
