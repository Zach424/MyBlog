import { access, readdir } from "node:fs/promises";
import path from "node:path";
import {
  inspectMediaFile,
  isSupportedImageExtension,
  SUPPORTED_IMAGE_EXTENSIONS,
} from "../lib/media-policy.ts";
import {
  inspectVideoFile,
  isSupportedVideoExtension,
} from "../lib/video-policy.ts";

async function mediaPaths(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  )) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`[media] ${absolutePath}: public/uploads 不允许符号链接`);
    }
    if (entry.isDirectory()) {
      paths.push(...(await mediaPaths(absolutePath)));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`[media] ${absolutePath}: public/uploads 只允许目录和普通媒体文件`);
    }
    if (
      !isSupportedImageExtension(path.extname(entry.name)) &&
      !isSupportedVideoExtension(path.extname(entry.name))
    ) {
      throw new Error(
        `[media] ${absolutePath}: public/uploads 只允许 ${SUPPORTED_IMAGE_EXTENSIONS.join(", ")} 图片和 .mp4 视频`,
      );
    }
    paths.push(absolutePath);
  }

  return paths;
}

export async function listMediaRepositoryFiles(projectRoot: string) {
  const uploadsDirectory = path.join(projectRoot, "public", "uploads");
  try {
    await access(uploadsDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  return (await mediaPaths(uploadsDirectory)).map((absolutePath) =>
    path.relative(projectRoot, absolutePath).replaceAll("\\", "/"),
  );
}

export async function validateMediaRepository(projectRoot: string) {
  const paths = await listMediaRepositoryFiles(projectRoot);
  const inspections = await Promise.all(
    paths.map((sourcePath) => {
      const absolutePath = path.join(projectRoot, ...sourcePath.split("/"));
      return isSupportedVideoExtension(path.extname(sourcePath))
        ? inspectVideoFile(absolutePath, sourcePath)
        : inspectMediaFile(absolutePath, sourcePath);
    }),
  );

  return {
    images: paths.filter((sourcePath) => isSupportedImageExtension(path.extname(sourcePath))).length,
    totalBytes: inspections.reduce((total, inspection) => total + inspection.bytes, 0),
    videos: paths.filter((sourcePath) => isSupportedVideoExtension(path.extname(sourcePath))).length,
  };
}
