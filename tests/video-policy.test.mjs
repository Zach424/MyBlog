import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  VIDEO_BUDGET,
  formatVideoInspection,
  inspectMp4Info,
  inspectVideoFile,
} from "../lib/video-policy.ts";

const baseInfo = {
  audioTracks: [],
  duration: 45_000,
  isFragmented: false,
  isProgressive: true,
  timescale: 1_000,
  tracks: [
    {
      codec: "avc1.640028",
      video: { height: 1080, width: 1920 },
    },
  ],
};

test("accepts one fast-start silent H.264 MP4 inside the public envelope", () => {
  const inspection = inspectMp4Info(baseInfo, {
    bytes: 6 * 1024 * 1024,
    sourcePath: "public/uploads/demo/publish-flow.mp4",
  });

  assert.equal(inspection.codec, "avc1.640028");
  assert.equal(inspection.durationSeconds, 45);
  assert.equal(inspection.width, 1920);
  assert.equal(inspection.height, 1080);
  assert.equal(inspection.hasAudio, false);
  assert.equal(inspection.progressive, true);
  assert.match(formatVideoInspection(inspection), /MP4\/H\.264.*1920×1080.*45\.0 秒.*FAST START/u);
});

test("rejects audio, unsupported codec, long, oversized, fragmented, and slow-start MP4", () => {
  const cases = [
    [{ ...baseInfo, audioTracks: [{}] }, /无音轨|静音/u],
    [{ ...baseInfo, tracks: [{ codec: "hev1.1.6.L93", video: { width: 1920, height: 1080 } }] }, /H\.264/u],
    [{ ...baseInfo, duration: (VIDEO_BUDGET.maxDurationSeconds + 1) * 1_000 }, /时长/u],
    [{ ...baseInfo, isFragmented: true }, /分片/u],
    [{ ...baseInfo, isProgressive: false }, /fast start|快速开始/iu],
  ];

  for (const [info, expected] of cases) {
    assert.throws(
      () => inspectMp4Info(info, { bytes: 1024, sourcePath: "demo.mp4" }),
      expected,
    );
  }
  assert.throws(
    () => inspectMp4Info(baseInfo, {
      bytes: VIDEO_BUDGET.maxBytes + 1,
      sourcePath: "demo.mp4",
    }),
    /12\.00 MiB/u,
  );
});

test("fails closed when a .mp4 file is not a parseable ISO BMFF video", async () => {
  const directory = await mkdtemp(join(tmpdir(), "myblog-video-"));
  try {
    const filePath = join(directory, "spoofed.mp4");
    await writeFile(filePath, "not an mp4");
    await assert.rejects(
      inspectVideoFile(filePath, "public/uploads/demo/spoofed.mp4"),
      /无法解析|不是有效/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
