import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { parseFile, type IAudioMetadata } from "music-metadata";

export const AUDIO_BUDGET = {
  maxBitrate: 320_000,
  maxBytes: 8 * 1024 * 1024,
  maxChannels: 2,
  maxDurationSeconds: 15 * 60,
  maxSampleRate: 48_000,
  minBitrate: 32_000,
  minSampleRate: 16_000,
} as const;

export type AudioMetadataLike = Pick<IAudioMetadata, "format">;

export type AudioInspection = {
  bitrate: number;
  bytes: number;
  channels: number;
  codec: string;
  durationSeconds: number;
  sampleRate: number;
  sourcePath: string;
};

function audioError(sourcePath: string, message: string, cause?: unknown) {
  return new Error(
    `[audio] ${sourcePath}: ${message}`,
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

export function isSupportedAudioExtension(value: string) {
  return value.toLowerCase() === ".mp3";
}

export function inspectAudioMetadata(
  metadata: AudioMetadataLike,
  envelope: { bytes: number; sourcePath: string },
): AudioInspection {
  const { bytes, sourcePath } = envelope;
  if (!Number.isSafeInteger(bytes) || bytes < 1) {
    throw audioError(sourcePath, "音频文件为空或大小无效");
  }
  if (bytes > AUDIO_BUDGET.maxBytes) {
    throw audioError(
      sourcePath,
      `文件大小 ${formatMegabytes(bytes)} 超过 ${formatMegabytes(AUDIO_BUDGET.maxBytes)} 上限`,
    );
  }

  const format = metadata?.format ?? {};
  const container = typeof format.container === "string" ? format.container : "";
  const codec = typeof format.codec === "string" ? format.codec : "";
  if (!/MPEG/iu.test(container) || !/(?:Layer\s*3|MP3)/iu.test(codec)) {
    throw audioError(sourcePath, "音频必须是真实 MPEG Layer III（MP3）文件");
  }

  const durationSeconds = finitePositive(format.duration);
  if (!durationSeconds) throw audioError(sourcePath, "音频缺少可验证的时长信息");
  if (durationSeconds > AUDIO_BUDGET.maxDurationSeconds) {
    throw audioError(
      sourcePath,
      `音频时长 ${durationSeconds.toFixed(1)} 秒超过 ${AUDIO_BUDGET.maxDurationSeconds} 秒上限`,
    );
  }

  const bitrate = finitePositive(format.bitrate);
  if (
    !bitrate ||
    bitrate < AUDIO_BUDGET.minBitrate ||
    bitrate > AUDIO_BUDGET.maxBitrate
  ) {
    throw audioError(
      sourcePath,
      `音频码率必须在 ${AUDIO_BUDGET.minBitrate / 1000}–${AUDIO_BUDGET.maxBitrate / 1000} kbps 之间`,
    );
  }

  const sampleRate = finitePositive(format.sampleRate);
  if (
    !sampleRate ||
    !Number.isInteger(sampleRate) ||
    sampleRate < AUDIO_BUDGET.minSampleRate ||
    sampleRate > AUDIO_BUDGET.maxSampleRate
  ) {
    throw audioError(
      sourcePath,
      `音频采样率必须在 ${AUDIO_BUDGET.minSampleRate / 1000}–${AUDIO_BUDGET.maxSampleRate / 1000} kHz 之间`,
    );
  }

  const channels = finitePositive(format.numberOfChannels);
  if (
    !channels ||
    !Number.isInteger(channels) ||
    channels > AUDIO_BUDGET.maxChannels
  ) {
    throw audioError(sourcePath, "音频声道必须是单声道或双声道");
  }

  return {
    bitrate,
    bytes,
    channels,
    codec,
    durationSeconds,
    sampleRate,
    sourcePath,
  };
}

export async function inspectAudioFile(
  absolutePath: string,
  sourcePath = absolutePath,
): Promise<AudioInspection> {
  if (!isSupportedAudioExtension(extname(absolutePath))) {
    throw audioError(sourcePath, "当前只允许 .mp3 音频");
  }

  let fileStats;
  try {
    fileStats = await stat(absolutePath);
  } catch (error) {
    throw audioError(sourcePath, "无法读取音频文件信息", error);
  }
  if (!fileStats.isFile()) throw audioError(sourcePath, "音频路径必须指向普通文件");
  if (fileStats.size > AUDIO_BUDGET.maxBytes) {
    throw audioError(
      sourcePath,
      `文件大小 ${formatMegabytes(fileStats.size)} 超过 ${formatMegabytes(AUDIO_BUDGET.maxBytes)} 上限`,
    );
  }

  let metadata: IAudioMetadata;
  try {
    metadata = await parseFile(absolutePath, { duration: true, skipCovers: true });
  } catch (error) {
    throw audioError(sourcePath, "音频无法解析，文件可能损坏或并非真实 MP3", error);
  }
  return inspectAudioMetadata(metadata, {
    bytes: fileStats.size,
    sourcePath,
  });
}

export function formatAudioInspection(inspection: AudioInspection) {
  return [
    "MP3",
    `${inspection.durationSeconds.toFixed(1)} 秒`,
    `${Math.round(inspection.bitrate / 1000)} kbps`,
    `${inspection.sampleRate / 1000} kHz`,
    inspection.channels === 1 ? "MONO" : "STEREO",
    formatMegabytes(inspection.bytes),
  ].join(" · ");
}
