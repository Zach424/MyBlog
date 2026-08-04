import { copyFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import sharp from "sharp";

// Publishing stages and then atomically renames attachments. Disabling the
// libvips operation cache prevents Windows from retaining an input file handle.
sharp.cache(false);

export const MEDIA_BUDGET = {
  maxBytes: 3 * 1024 * 1024,
  maxWidth: 2560,
  maxHeight: 2560,
  maxPixels: 8_000_000,
  maxAnimationPixels: 80_000_000,
} as const;

export const MEDIA_OPTIMIZATION = {
  maxSourceBytes: 25 * 1024 * 1024,
  maxSourceWidth: 8192,
  maxSourceHeight: 8192,
  maxSourcePixels: 40_000_000,
  webpQuality: 82,
  webpAlphaQuality: 100,
  webpEffort: 6,
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

export type MediaPreparation = {
  bytesSaved: number;
  optimized: boolean;
  output: MediaInspection;
  source: MediaInspection;
};

type MediaLimits = {
  maxAnimationPixels: number;
  maxBytes: number;
  maxHeight: number;
  maxPixels: number;
  maxWidth: number;
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

function assertInspectionWithinLimits(
  inspection: MediaInspection,
  limits: MediaLimits,
  sourceEnvelope: boolean,
) {
  const prefix = sourceEnvelope ? "自动优化原图" : "";
  const suffix = sourceEnvelope ? "安全上限" : "上限";

  if (inspection.bytes > limits.maxBytes) {
    throw mediaError(
      inspection.sourcePath,
      `${prefix}文件大小 ${formatMegabytes(inspection.bytes)} 超过 ${formatMegabytes(limits.maxBytes)} ${suffix}${sourceEnvelope ? "" : "；请先压缩或转换为 AVIF/WebP"}`,
    );
  }
  if (inspection.width > limits.maxWidth || inspection.height > limits.maxHeight) {
    throw mediaError(
      inspection.sourcePath,
      `${prefix}尺寸 ${inspection.width}×${inspection.height} px 超过 ${limits.maxWidth}×${limits.maxHeight} px ${suffix}`,
    );
  }

  const pixels = inspection.width * inspection.height;
  if (pixels > limits.maxPixels) {
    throw mediaError(
      inspection.sourcePath,
      `${prefix}单帧 ${pixels.toLocaleString("en-US")} 像素超过 ${limits.maxPixels.toLocaleString("en-US")} ${suffix}`,
    );
  }
  if (pixels * inspection.pages > limits.maxAnimationPixels) {
    throw mediaError(
      inspection.sourcePath,
      `${prefix}共 ${inspection.pages} 帧、${(pixels * inspection.pages).toLocaleString("en-US")} 像素，超过动图 ${limits.maxAnimationPixels.toLocaleString("en-US")} 总像素${suffix}`,
    );
  }
}

async function inspectMediaWithLimits(
  absolutePath: string,
  sourcePath: string,
  limits: MediaLimits,
  sourceEnvelope: boolean,
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
  if (fileStats.size > limits.maxBytes) {
    const prefix = sourceEnvelope ? "自动优化原图" : "";
    const suffix = sourceEnvelope
      ? "安全上限"
      : "上限；请先压缩或转换为 AVIF/WebP";
    throw mediaError(
      sourcePath,
      `${prefix}文件大小 ${formatMegabytes(fileStats.size)} 超过 ${formatMegabytes(limits.maxBytes)} ${suffix}`,
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

  const inspection = {
    bytes: fileStats.size,
    format: extension === ".avif" ? "avif" : metadata.format,
    height,
    pages: metadata.pages ?? 1,
    sourcePath,
    width,
  };
  assertInspectionWithinLimits(inspection, limits, sourceEnvelope);
  return inspection;
}

const PUBLIC_MEDIA_LIMITS: MediaLimits = MEDIA_BUDGET;
const SOURCE_MEDIA_LIMITS: MediaLimits = {
  maxAnimationPixels: MEDIA_BUDGET.maxAnimationPixels,
  maxBytes: MEDIA_OPTIMIZATION.maxSourceBytes,
  maxHeight: MEDIA_OPTIMIZATION.maxSourceHeight,
  maxPixels: MEDIA_OPTIMIZATION.maxSourcePixels,
  maxWidth: MEDIA_OPTIMIZATION.maxSourceWidth,
};

export async function inspectMediaFile(
  absolutePath: string,
  sourcePath = absolutePath,
): Promise<MediaInspection> {
  return inspectMediaWithLimits(
    absolutePath,
    sourcePath,
    PUBLIC_MEDIA_LIMITS,
    false,
  );
}

function fitsPublicBudget(inspection: MediaInspection) {
  const pixels = inspection.width * inspection.height;
  return (
    inspection.bytes <= MEDIA_BUDGET.maxBytes &&
    inspection.width <= MEDIA_BUDGET.maxWidth &&
    inspection.height <= MEDIA_BUDGET.maxHeight &&
    pixels <= MEDIA_BUDGET.maxPixels &&
    pixels * inspection.pages <= MEDIA_BUDGET.maxAnimationPixels
  );
}

export async function prepareMediaForPublishing(
  absoluteSourcePath: string,
  absoluteStagedPath: string,
  sourcePath: string,
  targetPath: string,
): Promise<MediaPreparation> {
  const source = await inspectMediaWithLimits(
    absoluteSourcePath,
    sourcePath,
    SOURCE_MEDIA_LIMITS,
    true,
  );
  const targetExtension = extname(targetPath).toLowerCase();
  const optimizable =
    source.pages === 1 && ["jpeg", "png", "webp"].includes(source.format);

  if (!optimizable) {
    const publicSource = await inspectMediaFile(absoluteSourcePath, sourcePath);
    await copyFile(absoluteSourcePath, absoluteStagedPath);
    const output = await inspectMediaFile(absoluteStagedPath, targetPath);
    return {
      bytesSaved: publicSource.bytes - output.bytes,
      optimized: false,
      output,
      source,
    };
  }
  if (targetExtension !== ".webp") {
    throw mediaError(targetPath, "静态 PNG/JPEG/WebP 的发布目标必须使用 .webp 扩展名");
  }

  const pipeline = sharp(absoluteSourcePath, {
    failOn: "error",
    limitInputPixels: MEDIA_OPTIMIZATION.maxSourcePixels,
  })
    .autoOrient()
    .resize({
      fit: "inside",
      height: MEDIA_BUDGET.maxHeight,
      width: MEDIA_BUDGET.maxWidth,
      withoutEnlargement: true,
    });
  await pipeline
    .webp({
      alphaQuality: MEDIA_OPTIMIZATION.webpAlphaQuality,
      effort: MEDIA_OPTIMIZATION.webpEffort,
      quality: MEDIA_OPTIMIZATION.webpQuality,
      smartSubsample: true,
    })
    .toFile(absoluteStagedPath);

  let output = await inspectMediaWithLimits(
    absoluteStagedPath,
    targetPath,
    SOURCE_MEDIA_LIMITS,
    true,
  );
  const wasResized = output.width !== source.width || output.height !== source.height;
  const shouldKeepExistingWebp =
    source.format === "webp" &&
    fitsPublicBudget(source) &&
    !wasResized &&
    output.bytes >= source.bytes;

  if (shouldKeepExistingWebp) {
    await copyFile(absoluteSourcePath, absoluteStagedPath);
    output = await inspectMediaFile(absoluteStagedPath, targetPath);
    return {
      bytesSaved: 0,
      optimized: false,
      output,
      source,
    };
  }

  assertInspectionWithinLimits(output, PUBLIC_MEDIA_LIMITS, false);
  return {
    bytesSaved: source.bytes - output.bytes,
    optimized: true,
    output,
    source,
  };
}

export function formatMediaInspection(inspection: MediaInspection) {
  const frames = inspection.pages > 1 ? ` · ${inspection.pages} 帧` : "";
  return `${inspection.format.toUpperCase()} · ${inspection.width}×${inspection.height} px${frames} · ${formatMegabytes(inspection.bytes)}`;
}

export function formatMediaPreparation(preparation: MediaPreparation) {
  if (!preparation.optimized) {
    return `保留原文件 · ${formatMediaInspection(preparation.output)}`;
  }

  const percentage = preparation.source.bytes
    ? Math.abs((preparation.bytesSaved / preparation.source.bytes) * 100).toFixed(1)
    : "0.0";
  const change = preparation.bytesSaved >= 0
    ? `减少 ${percentage}%`
    : `增加 ${percentage}%`;
  return `${formatMediaInspection(preparation.source)} → ${formatMediaInspection(preparation.output)} · ${change}`;
}
