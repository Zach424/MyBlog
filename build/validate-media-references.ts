import { listMediaRepositoryFiles } from "./validate-media.ts";
import { loadContentRepository } from "./validate-content.ts";
import {
  extractMarkdownImageReferences,
  resolveContentAudioPath,
  resolveContentMediaPath,
  resolveContentVideoPath,
} from "../lib/content/media-references.ts";
import { extractMarkdownVideos } from "../lib/markdown-video.ts";
import { extractMarkdownAudioNotes } from "../lib/markdown-audio.ts";
import { isSupportedAudioExtension } from "../lib/audio-policy.ts";
import { isSupportedVideoExtension } from "../lib/video-policy.ts";
import path from "node:path";
import {
  ContentValidationError,
  type ContentRecord,
} from "../lib/content/contract.ts";

type RecordMediaReference = {
  alt?: string;
  kind: "audio" | "image" | "video";
  label: string;
  url: string;
};

function recordMediaReferences(record: ContentRecord): RecordMediaReference[] {
  const bodyReferences = extractMarkdownImageReferences(record.body).map(
    (reference) => ({
      alt: reference.alt,
      kind: "image" as const,
      label: reference.line ? `正文第 ${reference.line} 行` : "正文",
      url: reference.url,
    }),
  );
  const videoReferences = extractMarkdownVideos(record.body).map((reference) => ({
    alt: reference.description,
    kind: "video" as const,
    label: reference.line ? `正文第 ${reference.line} 行` : "正文",
    url: reference.src,
  }));
  const audioReferences = extractMarkdownAudioNotes(record.body).map((reference) => ({
    alt: `${reference.title}。${reference.description}`,
    kind: "audio" as const,
    label: reference.line ? `正文第 ${reference.line} 行` : "正文",
    url: reference.src,
  }));
  return record.cover
    ? [{ kind: "image" as const, label: "cover", url: record.cover }, ...bodyReferences, ...audioReferences, ...videoReferences]
    : [...bodyReferences, ...audioReferences, ...videoReferences];
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
  let imageReferences = 0;
  let audioReferences = 0;
  let videoReferences = 0;

  for (const record of [...posts, ...projects]) {
    for (const reference of recordMediaReferences(record)) {
      if (reference.kind === "image" && reference.alt !== undefined && !reference.alt.trim()) {
        throw new ContentValidationError(
          record.sourcePath,
          `${reference.label}图片替代文本不能为空；请在 Markdown 的 ![替代文本](图片地址) 中描述图片内容`,
        );
      }
      const targetPath = reference.kind === "video"
        ? resolveContentVideoPath(reference.url, record.sourcePath)
        : reference.kind === "audio"
          ? resolveContentAudioPath(reference.url, record.sourcePath)
          : resolveContentMediaPath(reference.url, record.sourcePath);
      if (!targetPath) continue;
      references += 1;
      if (reference.kind === "video") videoReferences += 1;
      else if (reference.kind === "audio") audioReferences += 1;
      else imageReferences += 1;
      assertArchivedOwnership(record, targetPath, reference.label);
      if (!mediaFileSet.has(targetPath)) {
        throw new ContentValidationError(
          record.sourcePath,
          `${reference.label}引用的本地${reference.kind === "video" ? "视频" : reference.kind === "audio" ? "音频" : "图片"}不存在或大小写不一致：/${targetPath.slice("public/".length)}`,
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
    archivedAudios: archivedFiles.filter((mediaPath) => isSupportedAudioExtension(path.extname(mediaPath))).length,
    archivedImages: archivedFiles.filter((mediaPath) => !isSupportedVideoExtension(path.extname(mediaPath)) && !isSupportedAudioExtension(path.extname(mediaPath))).length,
    archivedVideos: archivedFiles.filter((mediaPath) => isSupportedVideoExtension(path.extname(mediaPath))).length,
    audioReferences,
    imageReferences,
    referencedAudios: [...ownersByPath.keys()].filter((mediaPath) => isSupportedAudioExtension(path.extname(mediaPath))).length,
    referencedImages: [...ownersByPath.keys()].filter((mediaPath) => !isSupportedVideoExtension(path.extname(mediaPath)) && !isSupportedAudioExtension(path.extname(mediaPath))).length,
    referencedVideos: [...ownersByPath.keys()].filter((mediaPath) => isSupportedVideoExtension(path.extname(mediaPath))).length,
    references,
    stagingAudios: mediaFiles.filter((mediaPath) => mediaPath.slice("public/uploads/".length).split("/").length < 2 && isSupportedAudioExtension(path.extname(mediaPath))).length,
    stagingImages: mediaFiles.filter((mediaPath) => mediaPath.slice("public/uploads/".length).split("/").length < 2 && !isSupportedVideoExtension(path.extname(mediaPath)) && !isSupportedAudioExtension(path.extname(mediaPath))).length,
    stagingVideos: mediaFiles.filter((mediaPath) => mediaPath.slice("public/uploads/".length).split("/").length < 2 && isSupportedVideoExtension(path.extname(mediaPath))).length,
    videoReferences,
  };
}
