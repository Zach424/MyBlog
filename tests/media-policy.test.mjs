import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { validateMediaRepository } from "../build/validate-media.ts";
import {
  MEDIA_BUDGET,
  formatMediaInspection,
  inspectMediaFile,
} from "../lib/media-policy.ts";

async function temporaryDirectory() {
  return mkdtemp(join(tmpdir(), "myblog-media-"));
}

test("accepts a decodable image and reports its publishing budget", async () => {
  const directory = await temporaryDirectory();
  try {
    const imagePath = join(directory, "evidence.webp");
    const image = await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 3,
        background: "#486f78",
      },
    }).webp().toBuffer();
    await writeFile(imagePath, image);

    const inspection = await inspectMediaFile(imagePath, "public/uploads/evidence.webp");
    assert.equal(inspection.format, "webp");
    assert.equal(inspection.width, 1200);
    assert.equal(inspection.height, 630);
    assert.equal(inspection.pages, 1);
    assert.match(
      formatMediaInspection(inspection),
      /^WEBP · 1200×630 px · \d+\.\d{2} MiB$/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects extension spoofing, corrupt images, oversized files, and dimensions", async () => {
  const directory = await temporaryDirectory();
  try {
    const spoofedPath = join(directory, "spoofed.jpg");
    const spoofed = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "white" },
    }).png().toBuffer();
    await writeFile(spoofedPath, spoofed);
    await assert.rejects(
      inspectMediaFile(spoofedPath, "spoofed.jpg"),
      /扩展名 \.jpg 与实际格式 png 不一致/u,
    );

    const corruptPath = join(directory, "corrupt.png");
    await writeFile(corruptPath, "not an image");
    await assert.rejects(inspectMediaFile(corruptPath, "corrupt.png"), /无法解码/u);

    const oversizedPath = join(directory, "oversized.png");
    await writeFile(oversizedPath, Buffer.alloc(MEDIA_BUDGET.maxBytes + 1));
    await assert.rejects(
      inspectMediaFile(oversizedPath, "oversized.png"),
      /超过 3\.00 MiB 上限/u,
    );

    const widePath = join(directory, "wide.png");
    const wide = await sharp({
      create: {
        width: MEDIA_BUDGET.maxWidth + 1,
        height: 1,
        channels: 3,
        background: "white",
      },
    }).png().toBuffer();
    await writeFile(widePath, wide);
    await assert.rejects(
      inspectMediaFile(widePath, "wide.png"),
      /尺寸 2561×1 px 超过/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("validates every nested upload and rejects non-image repository files", async () => {
  const projectRoot = await temporaryDirectory();
  try {
    const uploadsDirectory = join(projectRoot, "public", "uploads", "post-slug");
    await mkdir(uploadsDirectory, { recursive: true });
    const cover = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#b9431f" },
    }).avif().toBuffer();
    await writeFile(join(uploadsDirectory, "cover.avif"), cover);

    const result = await validateMediaRepository(projectRoot);
    assert.equal(result.images, 1);
    assert.ok(result.totalBytes > 0);

    await writeFile(join(uploadsDirectory, "notes.txt"), "not public media");
    await assert.rejects(
      validateMediaRepository(projectRoot),
      /public\/uploads 只允许 .*图片/u,
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
