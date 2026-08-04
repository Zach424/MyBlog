import { listMediaRepositoryFiles } from "./validate-media.ts";
import { loadContentRepository } from "./validate-content.ts";
import {
  extractMarkdownImageReferences,
  resolveContentMediaPath,
} from "../lib/content/media-references.ts";
import {
  ContentValidationError,
  type ContentRecord,
} from "../lib/content/contract.ts";

type RecordMediaReference = {
  alt?: string;
  label: string;
  url: string;
};

function recordMediaReferences(record: ContentRecord): RecordMediaReference[] {
  const bodyReferences = extractMarkdownImageReferences(record.body).map(
    (reference) => ({
      alt: reference.alt,
      label: reference.line ? `正文第 ${reference.line} 行` : "正文",
      url: reference.url,
    }),
  );
  return record.cover
    ? [{ label: "cover", url: record.cover }, ...bodyReferences]
    : bodyReferences;
}

function assertArchivedOwnership(
  record: ContentRecord,
  targetPath: string,
  label: string,
) {
  const relativePath = targetPath.slice("public/uploads/".length);
  const segments = relativePath.split("/");
  if (segments.length < 2) {
    throw new ContentValidationError(
      record.sourcePath,
      `${label}引用“/${targetPath.slice("public/".length)}”，该文件仍在根暂存区；正式内容必须归档到 /uploads/${record.slug}/...。请先填写稳定 slug，再在 Studio 重新选择图片，或使用 Obsidian 发布器归档`,
    );
  }
  if (segments[0] === record.slug) return;

  throw new ContentValidationError(
    record.sourcePath,
    `${label}引用“/${targetPath.slice("public/".length)}”，但归档目录 ${segments[0]} 与内容 slug ${record.slug} 不一致`,
  );
}

export async function validateContentMediaReferences(projectRoot: string) {
  const [{ posts, projects }, mediaFiles] = await Promise.all([
    loadContentRepository(projectRoot),
    listMediaRepositoryFiles(projectRoot),
  ]);
  const mediaFileSet = new Set(mediaFiles);
  const ownersByPath = new Map<string, Set<string>>();
  let references = 0;

  for (const record of [...posts, ...projects]) {
    for (const reference of recordMediaReferences(record)) {
      if (reference.alt !== undefined && !reference.alt.trim()) {
        throw new ContentValidationError(
          record.sourcePath,
          `${reference.label}图片替代文本不能为空；请在 Markdown 的 ![替代文本](图片地址) 中描述图片内容`,
        );
      }
      const targetPath = resolveContentMediaPath(reference.url, record.sourcePath);
      if (!targetPath) continue;
      references += 1;
      assertArchivedOwnership(record, targetPath, reference.label);
      if (!mediaFileSet.has(targetPath)) {
        throw new ContentValidationError(
          record.sourcePath,
          `${reference.label}引用的本地图片不存在或大小写不一致：/${targetPath.slice("public/".length)}`,
        );
      }
      const owners = ownersByPath.get(targetPath) ?? new Set<string>();
      owners.add(record.sourcePath);
      ownersByPath.set(targetPath, owners);
    }
  }

  const archivedFiles = mediaFiles.filter(
    (mediaPath) => mediaPath.slice("public/uploads/".length).split("/").length >= 2,
  );
  for (const mediaPath of archivedFiles) {
    if (!ownersByPath.has(mediaPath)) {
      throw new Error(
        `[media] ${mediaPath}: 已归档附件未被同 slug 的正式文章或项目引用；请删除孤立文件或修复 Markdown/cover`,
      );
    }
  }

  return {
    archivedImages: archivedFiles.length,
    referencedImages: ownersByPath.size,
    references,
    stagingImages: mediaFiles.length - archivedFiles.length,
  };
}
