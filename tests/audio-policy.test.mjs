import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  AUDIO_BUDGET,
  formatAudioInspection,
  inspectAudioMetadata,
  inspectAudioFile,
  isSupportedAudioExtension,
} from "../lib/audio-policy.ts";

const validMetadata = {
  format: {
    bitrate: 128_000,
    codec: "MPEG 1 Layer 3",
    container: "MPEG",
    duration: 42.5,
    numberOfChannels: 1,
    sampleRate: 44_100,
  },
};

test("accepts one bounded browser-compatible MP3 metadata envelope", () => {
  const inspection = inspectAudioMetadata(validMetadata, {
    bytes: 640_000,
    sourcePath: "public/uploads/demo/note.mp3",
  });

  assert.deepEqual(inspection, {
    bitrate: 128_000,
    bytes: 640_000,
    channels: 1,
    codec: "MPEG 1 Layer 3",
    durationSeconds: 42.5,
    sampleRate: 44_100,
    sourcePath: "public/uploads/demo/note.mp3",
  });
  assert.match(formatAudioInspection(inspection), /MP3.*42\.5 秒.*128 kbps.*MONO/u);
  assert.equal(isSupportedAudioExtension(".MP3"), true);
  assert.equal(isSupportedAudioExtension(".wav"), false);
});

test("rejects oversized, long, wrong-codec, invalid-rate, and multi-channel audio", () => {
  const cases = [
    [{ bytes: AUDIO_BUDGET.maxBytes + 1 }, /文件大小/u],
    [{ metadata: { format: { ...validMetadata.format, duration: AUDIO_BUDGET.maxDurationSeconds + 1 } } }, /时长/u],
    [{ metadata: { format: { ...validMetadata.format, codec: "AAC" } } }, /MP3/u],
    [{ metadata: { format: { ...validMetadata.format, sampleRate: 8_000 } } }, /采样率/u],
    [{ metadata: { format: { ...validMetadata.format, numberOfChannels: 3 } } }, /声道/u],
  ];

  for (const [{ bytes = 640_000, metadata = validMetadata }, expected] of cases) {
    assert.throws(
      () => inspectAudioMetadata(metadata, { bytes, sourcePath: "note.mp3" }),
      expected,
    );
  }
});

test("rejects a spoofed .mp3 file through the real parser", async () => {
  const root = await mkdtemp(join(tmpdir(), "myblog-audio-policy-"));
  try {
    const filePath = join(root, "spoofed.mp3");
    await writeFile(filePath, Buffer.from("not an mp3"));
    await assert.rejects(
      inspectAudioFile(filePath, "public/uploads/demo/spoofed.mp3"),
      /无法解析|真实.*MP3/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
