import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  inspectMediaFile,
  isSupportedImageExtension,
  SUPPORTED_IMAGE_EXTENSIONS,
} from "../lib/media-policy.ts";

async function imagePaths(directory: string): Promise<string[]> {
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
      paths.push(...(await imagePaths(absolutePath)));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`[media] ${absolutePath}: public/uploads 只允许目录和普通图片文件`);
    }
    if (!isSupportedImageExtension(path.extname(entry.name))) {
      throw new Error(
        `[media] ${absolutePath}: public/uploads 只允许 ${SUPPORTED_IMAGE_EXTENSIONS.join(", ")} 图片`,
      );
    }
    paths.push(absolutePath);
  }

  return paths;
}

export async function validateMediaRepository(projectRoot: string) {
  const uploadsDirectory = path.join(projectRoot, "public", "uploads");
  const paths = await imagePaths(uploadsDirectory);
  const inspections = await Promise.all(
    paths.map((absolutePath) =>
      inspectMediaFile(
        absolutePath,
        path.relative(projectRoot, absolutePath).replaceAll("\\", "/"),
      ),
    ),
  );

  return {
    images: inspections.length,
    totalBytes: inspections.reduce((total, inspection) => total + inspection.bytes, 0),
  };
}
