import { stat } from "node:fs/promises";
import { extname } from "node:path";
import sharp from "sharp";

// The publisher validates and then immediately moves attachments. Disabling the
// libvips operation cache prevents Windows from retaining an input file handle.
sharp.cache(false);

export const MEDIA_BUDGET = {
  maxBytes: 3 * 1024 * 1024,
  maxWidth: 2560,
  maxHeight: 2560,
  maxPixels: 8_000_000,
  maxAnimationPixels: 80_000_000,
} as const;

export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
] as const;

type SupportedImageExtension = (typeof SUPPORTED_IMAGE_EXTENSIONS)[number];

const FORMAT_BY_EXTENSION: Record<SupportedImageExtension, string> = {
  ".avif": "heif",
  ".gif": "gif",
  ".jpeg": "jpeg",
  ".jpg": "jpeg",
  ".png": "png",
  ".webp": "webp",
};

export type MediaInspection = {
  bytes: number;
  format: string;
  height: number;
  pages: number;
  sourcePath: string;
  width: number;
};

function mediaError(sourcePath: string, message: string, cause?: unknown) {
  return new Error(`[media] ${sourcePath}: ${message}`, cause ? { cause } : undefined);
}

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function isSupportedImageExtension(value: string) {
  return SUPPORTED_IMAGE_EXTENSIONS.includes(
    value.toLowerCase() as SupportedImageExtension,
  );
}

export async function inspectMediaFile(
  absolutePath: string,
  sourcePath = absolutePath,
): Promise<MediaInspection> {
  const extension = extname(absolutePath).toLowerCase();
  if (!isSupportedImageExtension(extension)) {
    throw mediaError(
      sourcePath,
      `只允许 ${SUPPORTED_IMAGE_EXTENSIONS.join(", ")} 图片，当前扩展名为 ${extension || "无"}`,
    );
  }

  let fileStats;
  try {
    fileStats = await stat(absolutePath);
  } catch (error) {
    throw mediaError(sourcePath, "无法读取文件信息", error);
  }

  if (!fileStats.isFile()) {
    throw mediaError(sourcePath, "媒体路径必须指向普通文件");
  }
  if (fileStats.size > MEDIA_BUDGET.maxBytes) {
    throw mediaError(
      sourcePath,
      `文件大小 ${formatMegabytes(fileStats.size)} 超过 ${formatMegabytes(MEDIA_BUDGET.maxBytes)} 上限；请先压缩或转换为 AVIF/WebP`,
    );
  }

  let metadata;
  const image = sharp(absolutePath, { failOn: "error" });
  try {
    metadata = await image.metadata();
  } catch (error) {
    throw mediaError(sourcePath, "图片无法解码，文件可能损坏或并非真实图片", error);
  } finally {
    image.destroy();
  }

  const expectedFormat = FORMAT_BY_EXTENSION[extension as SupportedImageExtension];
  const isExpectedAvif = extension !== ".avif" || metadata.compression === "av1";
  if (metadata.format !== expectedFormat || !isExpectedAvif) {
    const actualFormat = [metadata.format, metadata.compression]
      .filter(Boolean)
      .join("/");
    throw mediaError(
      sourcePath,
      `扩展名 ${extension} 与实际格式 ${actualFormat || "未知"} 不一致`,
    );
  }

  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.pageHeight ?? metadata.autoOrient?.height ?? metadata.height;
  if (!width || !height) {
    throw mediaError(sourcePath, "图片缺少可验证的宽高信息");
  }

  const pages = metadata.pages ?? 1;
  if (width > MEDIA_BUDGET.maxWidth || height > MEDIA_BUDGET.maxHeight) {
    throw mediaError(
      sourcePath,
      `尺寸 ${width}×${height} px 超过 ${MEDIA_BUDGET.maxWidth}×${MEDIA_BUDGET.maxHeight} px 上限`,
    );
  }

  const pixels = width * height;
  if (pixels > MEDIA_BUDGET.maxPixels) {
    throw mediaError(
      sourcePath,
      `单帧 ${pixels.toLocaleString("en-US")} 像素超过 ${MEDIA_BUDGET.maxPixels.toLocaleString("en-US")} 上限`,
    );
  }
  if (pixels * pages > MEDIA_BUDGET.maxAnimationPixels) {
    throw mediaError(
      sourcePath,
      `共 ${pages} 帧、${(pixels * pages).toLocaleString("en-US")} 像素，超过动图 ${MEDIA_BUDGET.maxAnimationPixels.toLocaleString("en-US")} 总像素上限`,
    );
  }

  return {
    bytes: fileStats.size,
    format: extension === ".avif" ? "avif" : metadata.format,
    height,
    pages,
    sourcePath,
    width,
  };
}

export function formatMediaInspection(inspection: MediaInspection) {
  const frames = inspection.pages > 1 ? ` · ${inspection.pages} 帧` : "";
  return `${inspection.format.toUpperCase()} · ${inspection.width}×${inspection.height} px${frames} · ${formatMegabytes(inspection.bytes)}`;
}
