import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { createFile, MP4BoxBuffer } from "mp4box";

export const VIDEO_BUDGET = {
  maxBytes: 12 * 1024 * 1024,
  maxDurationSeconds: 90,
  maxHeight: 1080,
  maxPixels: 1920 * 1080,
  maxWidth: 1920,
} as const;

type Mp4TrackLike = {
  audio?: unknown;
  codec?: unknown;
  type?: unknown;
  video?: {
    height?: unknown;
    width?: unknown;
  };
};

export type Mp4InfoLike = {
  audioTracks?: unknown[];
  duration?: unknown;
  isFragmented?: unknown;
  isProgressive?: unknown;
  timescale?: unknown;
  tracks?: Mp4TrackLike[];
  videoTracks?: Mp4TrackLike[];
};

export type VideoInspection = {
  bytes: number;
  codec: string;
  durationSeconds: number;
  hasAudio: false;
  height: number;
  progressive: true;
  sourcePath: string;
  width: number;
};

function videoError(sourcePath: string, message: string, cause?: unknown) {
  return new Error(
    `[video] ${sourcePath}: ${message}`,
    cause ? { cause } : undefined,
  );
}

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function finitePositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export function isSupportedVideoExtension(value: string) {
  return value.toLowerCase() === ".mp4";
}

export function inspectMp4Info(
  info: Mp4InfoLike,
  envelope: { bytes: number; sourcePath: string },
): VideoInspection {
  const { bytes, sourcePath } = envelope;
  if (!Number.isSafeInteger(bytes) || bytes < 1) {
    throw videoError(sourcePath, "视频文件为空或大小无效");
  }
  if (bytes > VIDEO_BUDGET.maxBytes) {
    throw videoError(
      sourcePath,
      `文件大小 ${formatMegabytes(bytes)} 超过 ${formatMegabytes(VIDEO_BUDGET.maxBytes)} 上限`,
    );
  }
  if (info.isFragmented === true) {
    throw videoError(sourcePath, "暂不接受分片 MP4；请导出为普通单文件 MP4");
  }
  if (info.isProgressive !== true) {
    throw videoError(
      sourcePath,
      "MP4 缺少 fast start（快速开始）布局；请把 moov 元数据移到文件开头后再发布",
    );
  }

  const timescale = finitePositive(info.timescale);
  const duration = finitePositive(info.duration);
  if (!timescale || !duration) {
    throw videoError(sourcePath, "视频缺少可验证的时长信息");
  }
  const durationSeconds = duration / timescale;
  if (durationSeconds > VIDEO_BUDGET.maxDurationSeconds) {
    throw videoError(
      sourcePath,
      `视频时长 ${durationSeconds.toFixed(1)} 秒超过 ${VIDEO_BUDGET.maxDurationSeconds} 秒上限`,
    );
  }

  const tracks = Array.isArray(info.tracks) ? info.tracks : [];
  const videoTracks = Array.isArray(info.videoTracks) && info.videoTracks.length > 0
    ? info.videoTracks
    : tracks.filter((track) => track?.video || track?.type === "video");
  if (videoTracks.length !== 1) {
    throw videoError(sourcePath, "视频必须且只能包含一个画面轨道");
  }
  const audioTracks = Array.isArray(info.audioTracks)
    ? info.audioTracks
    : tracks.filter((track) => track?.audio || track?.type === "audio");
  if (audioTracks.length > 0) {
    throw videoError(
      sourcePath,
      "视频 v1 只接受无音轨的静音屏幕录制；有声内容需要字幕与文字稿契约后再发布",
    );
  }
  if (tracks.length > 0 && tracks.length !== 1) {
    throw videoError(sourcePath, "视频 v1 只接受单一画面轨道，不接受字幕、元数据或其他附加轨道");
  }

  const track = videoTracks[0];
  const codec = typeof track.codec === "string" ? track.codec : "";
  if (!/^(?:avc1|avc3)\./iu.test(codec)) {
    throw videoError(sourcePath, "视频编码必须是浏览器兼容的 H.264/AVC（avc1 或 avc3）");
  }
  const width = finitePositive(track.video?.width);
  const height = finitePositive(track.video?.height);
  if (!width || !height || !Number.isInteger(width) || !Number.isInteger(height)) {
    throw videoError(sourcePath, "视频缺少可验证的整数宽高");
  }
  if (width > VIDEO_BUDGET.maxWidth || height > VIDEO_BUDGET.maxHeight) {
    throw videoError(
      sourcePath,
      `视频尺寸 ${width}×${height} px 超过 ${VIDEO_BUDGET.maxWidth}×${VIDEO_BUDGET.maxHeight} px 上限`,
    );
  }
  if (width * height > VIDEO_BUDGET.maxPixels) {
    throw videoError(
      sourcePath,
      `视频单帧 ${(width * height).toLocaleString("en-US")} 像素超过 ${VIDEO_BUDGET.maxPixels.toLocaleString("en-US")} 上限`,
    );
  }

  return {
    bytes,
    codec,
    durationSeconds,
    hasAudio: false,
    height,
    progressive: true,
    sourcePath,
    width,
  };
}

function parseMp4(bytes: Buffer, sourcePath: string): Promise<Mp4InfoLike> {
  return new Promise((resolve, reject) => {
    const parser = createFile();
    let settled = false;
    parser.onError = (module, message) => {
      if (settled) return;
      settled = true;
      reject(videoError(sourcePath, `MP4 无法解析：${module}: ${message}`));
    };
    parser.onReady = (info) => {
      if (settled) return;
      settled = true;
      resolve(info);
    };

    try {
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      parser.appendBuffer(MP4BoxBuffer.fromArrayBuffer(arrayBuffer, 0), true);
      parser.flush();
      if (!settled) {
        settled = true;
        reject(videoError(sourcePath, "不是有效的可解析 MP4 视频"));
      }
    } catch (error) {
      if (settled) return;
      settled = true;
      reject(videoError(sourcePath, "MP4 无法解析，文件可能损坏或格式伪装", error));
    }
  });
}

export async function inspectVideoFile(
  absolutePath: string,
  sourcePath = absolutePath,
): Promise<VideoInspection> {
  if (!isSupportedVideoExtension(extname(absolutePath))) {
    throw videoError(sourcePath, "当前只允许 .mp4 视频");
  }

  let fileStats;
  try {
    fileStats = await stat(absolutePath);
  } catch (error) {
    throw videoError(sourcePath, "无法读取视频文件信息", error);
  }
  if (!fileStats.isFile()) {
    throw videoError(sourcePath, "视频路径必须指向普通文件");
  }
  if (fileStats.size > VIDEO_BUDGET.maxBytes) {
    throw videoError(
      sourcePath,
      `文件大小 ${formatMegabytes(fileStats.size)} 超过 ${formatMegabytes(VIDEO_BUDGET.maxBytes)} 上限`,
    );
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(absolutePath);
  } catch (error) {
    throw videoError(sourcePath, "无法读取视频字节", error);
  }
  const info = await parseMp4(bytes, sourcePath);
  return inspectMp4Info(info, { bytes: bytes.byteLength, sourcePath });
}

export function formatVideoInspection(inspection: VideoInspection) {
  return [
    "MP4/H.264",
    `${inspection.width}×${inspection.height} px`,
    `${inspection.durationSeconds.toFixed(1)} 秒`,
    formatMegabytes(inspection.bytes),
    "FAST START",
    "SILENT",
  ].join(" · ");
}
