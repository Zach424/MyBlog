import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { validateMediaRepository } from "../build/validate-media.ts";
import {
  MEDIA_BUDGET,
  MEDIA_OPTIMIZATION,
  formatMediaInspection,
  formatMediaPreparation,
  inspectMediaFile,
  prepareMediaForPublishing,
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

test("creates a deterministic budgeted WebP from an oversized static source", async () => {
  const directory = await temporaryDirectory();
  try {
    const sourcePath = join(directory, "evidence.png");
    const firstTarget = join(directory, "first.webp");
    const secondTarget = join(directory, "second.webp");
    const source = await sharp({
      create: {
        width: 3000,
        height: 1800,
        channels: 3,
        background: "#486f78",
      },
    }).png({ compressionLevel: 0 }).toBuffer();
    assert.ok(source.byteLength > MEDIA_BUDGET.maxBytes);
    assert.ok(source.byteLength < MEDIA_OPTIMIZATION.maxSourceBytes);
    await writeFile(sourcePath, source);

    await assert.rejects(
      inspectMediaFile(sourcePath, "public/uploads/evidence.png"),
      /超过 3\.00 MiB 上限/u,
    );
    const first = await prepareMediaForPublishing(
      sourcePath,
      firstTarget,
      "public/uploads/evidence.png",
      "public/uploads/post/evidence.webp",
    );
    await prepareMediaForPublishing(
      sourcePath,
      secondTarget,
      "public/uploads/evidence.png",
      "public/uploads/post/evidence.webp",
    );

    assert.equal(first.optimized, true);
    assert.equal(first.output.format, "webp");
    assert.equal(first.output.width, MEDIA_BUDGET.maxWidth);
    assert.ok(first.output.height <= MEDIA_BUDGET.maxHeight);
    assert.ok(first.output.bytes <= MEDIA_BUDGET.maxBytes);
    assert.ok(first.bytesSaved > 0);
    assert.match(formatMediaPreparation(first), /PNG .* → WEBP .* · 减少/u);
    assert.deepEqual(await readFile(firstTarget), await readFile(secondTarget));
    assert.deepEqual(await readFile(sourcePath), source);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("applies source orientation before fitting the public dimensions", async () => {
  const directory = await temporaryDirectory();
  try {
    const sourcePath = join(directory, "portrait.jpg");
    const targetPath = join(directory, "portrait.webp");
    await sharp({
      create: {
        width: 1600,
        height: 3200,
        channels: 3,
        background: "#486f78",
      },
    })
      .jpeg({ quality: 90 })
      .withMetadata({ orientation: 6 })
      .toFile(sourcePath);

    const preparation = await prepareMediaForPublishing(
      sourcePath,
      targetPath,
      "public/uploads/portrait.jpg",
      "public/uploads/post/portrait.webp",
    );

    assert.equal(preparation.output.width, MEDIA_BUDGET.maxWidth);
    assert.equal(preparation.output.height, 1280);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preserves efficient WebP, AVIF, and animated GIF inputs without changing bytes", async () => {
  const directory = await temporaryDirectory();
  try {
    const webpSource = join(directory, "source.webp");
    const webpTarget = join(directory, "target.webp");
    const webp = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#b9431f" },
    }).webp({
      alphaQuality: MEDIA_OPTIMIZATION.webpAlphaQuality,
      effort: MEDIA_OPTIMIZATION.webpEffort,
      quality: MEDIA_OPTIMIZATION.webpQuality,
      smartSubsample: true,
    }).toBuffer();
    await writeFile(webpSource, webp);
    const webpPreparation = await prepareMediaForPublishing(
      webpSource,
      webpTarget,
      "public/uploads/source.webp",
      "public/uploads/post/source.webp",
    );
    assert.equal(webpPreparation.optimized, false);
    assert.deepEqual(await readFile(webpTarget), webp);

    const avifSource = join(directory, "source.avif");
    const avifTarget = join(directory, "target.avif");
    const avif = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#486f78" },
    }).avif().toBuffer();
    await writeFile(avifSource, avif);
    const avifPreparation = await prepareMediaForPublishing(
      avifSource,
      avifTarget,
      "public/uploads/source.avif",
      "public/uploads/post/source.avif",
    );
    assert.equal(avifPreparation.optimized, false);
    assert.deepEqual(await readFile(avifTarget), avif);
    assert.match(formatMediaPreparation(avifPreparation), /^保留原文件 · AVIF/u);

    const gifSource = join(directory, "source.gif");
    const gifTarget = join(directory, "target.gif");
    const gifFrames = Buffer.alloc(32 * 64 * 3, 48);
    gifFrames.fill(192, 32 * 32 * 3);
    const gif = await sharp(gifFrames, {
      raw: {
        width: 32,
        height: 64,
        pageHeight: 32,
        channels: 3,
      },
    }).gif({ delay: [80, 120], loop: 0 }).toBuffer();
    await writeFile(gifSource, gif);
    const gifPreparation = await prepareMediaForPublishing(
      gifSource,
      gifTarget,
      "public/uploads/source.gif",
      "public/uploads/post/source.gif",
    );
    assert.equal(gifPreparation.source.pages, 2);
    assert.equal(gifPreparation.optimized, false);
    assert.deepEqual(await readFile(gifTarget), gif);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects media beyond the automatic optimization source envelope", async () => {
  const directory = await temporaryDirectory();
  try {
    const sourcePath = join(directory, "too-large.png");
    const targetPath = join(directory, "target.webp");
    await writeFile(sourcePath, Buffer.alloc(MEDIA_OPTIMIZATION.maxSourceBytes + 1));
    await assert.rejects(
      prepareMediaForPublishing(
        sourcePath,
        targetPath,
        "public/uploads/too-large.png",
        "public/uploads/post/too-large.webp",
      ),
      /自动优化原图文件大小 .*超过 25\.00 MiB 安全上限/u,
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
    assert.deepEqual(await validateMediaRepository(projectRoot), {
      images: 0,
      totalBytes: 0,
      videos: 0,
    });

    const uploadsDirectory = join(projectRoot, "public", "uploads", "post-slug");
    await mkdir(uploadsDirectory, { recursive: true });
    const cover = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#b9431f" },
    }).avif().toBuffer();
    await writeFile(join(uploadsDirectory, "cover.avif"), cover);

    const result = await validateMediaRepository(projectRoot);
    assert.equal(result.images, 1);
    assert.equal(result.videos, 0);
    assert.ok(result.totalBytes > 0);

    await writeFile(join(uploadsDirectory, "notes.txt"), "not public media");
    await assert.rejects(
      validateMediaRepository(projectRoot),
      /public\/uploads 只允许 .*图片和 \.mp4 视频/u,
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
