import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  STUDIO_MEDIA_MANIFEST_VERSION,
  STUDIO_MEDIA_ROOT,
  createStudioMediaManifest,
} from "../lib/studio-media-manifest.ts";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("builds a deterministic byte-and-digest inventory for published media", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "myblog-studio-media-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const alpha = Buffer.from("alpha");
  const zulu = Buffer.from("zulu-image");
  await mkdir(path.join(root, "public", "uploads", "zulu"), { recursive: true });
  await mkdir(path.join(root, "public", "uploads", "alpha"), { recursive: true });
  await writeFile(path.join(root, "public", "uploads", "zulu", "cover.webp"), zulu);
  await writeFile(path.join(root, "public", "uploads", "alpha", "diagram.png"), alpha);

  assert.deepEqual(await createStudioMediaManifest(root), {
    entries: [
      {
        bytes: alpha.byteLength,
        path: "public/uploads/alpha/diagram.png",
        sha256: sha256(alpha),
      },
      {
        bytes: zulu.byteLength,
        path: "public/uploads/zulu/cover.webp",
        sha256: sha256(zulu),
      },
    ],
    root: STUDIO_MEDIA_ROOT,
    version: STUDIO_MEDIA_MANIFEST_VERSION,
  });
});

test("inventories the repository's current published media without exposing bytes", async () => {
  const manifest = await createStudioMediaManifest();
  assert.equal(manifest.version, 1);
  assert.equal(manifest.root, "public/uploads");
  assert.deepEqual(
    manifest.entries.map((entry) => entry.path),
    [
      "public/uploads/building-a-maintainable-blog/content-delivery-pipeline.webp",
      "public/uploads/myblog/cover.webp",
    ],
  );
  for (const entry of manifest.entries) {
    const bytes = await readFile(new URL(`../${entry.path}`, import.meta.url));
    assert.equal(entry.bytes, bytes.byteLength);
    assert.equal(entry.sha256, sha256(bytes));
    assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
  }
});
