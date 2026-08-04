import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FRESHNESS_OPTIONS,
  MEDIA_MAX_FILE_SIZE,
  TAG_OPTIONS,
  createStudioConfig,
} from "../studio/config.mjs";
import {
  CONTENT_FRESHNESS_VALUES,
  TAG_REGISTRY,
} from "../lib/content/contract.ts";
import { MEDIA_BUDGET } from "../lib/media-policy.ts";

test("maps the publishing studio to the single Git content source", () => {
  const config = createStudioConfig("https://blog.example.test/path");
  assert.equal(config.backend.repo, "Zach424/MyBlog");
  assert.equal(config.backend.branch, "main");
  assert.equal(config.backend.base_url, "https://blog.example.test");
  assert.equal(config.backend.auth_endpoint, "/api/cms/auth");
  assert.equal(config.publish_mode, "editorial_workflow");
  assert.equal(config.media_folder, "public/uploads");
  assert.deepEqual(
    config.collections.map((collection) => collection.folder),
    ["content/posts", "content/projects"],
  );
  assert.ok(config.collections.every((collection) => collection.slug === "{{fields.slug}}"));
});

test("keeps CMS tags and required content fields aligned with the contract", () => {
  assert.deepEqual(TAG_OPTIONS, TAG_REGISTRY.map((tag) => tag.name));
  assert.deepEqual(
    FRESHNESS_OPTIONS.map((option) => option.value),
    CONTENT_FRESHNESS_VALUES,
  );

  const config = createStudioConfig("https://blog.example.test");
  assert.equal(MEDIA_MAX_FILE_SIZE, MEDIA_BUDGET.maxBytes);
  for (const collection of config.collections) {
    const names = collection.fields.map((field) => field.name);
    for (const required of ["title", "slug", "description", "publishedAt", "freshness", "reviewedAt", "tags", "draft", "featured", "cover", "coverAlt", "body"]) {
      assert.ok(names.includes(required), `${collection.name}: ${required}`);
    }
    const cover = collection.fields.find((field) => field.name === "cover");
    assert.equal(cover.media_library.config.max_file_size, MEDIA_BUDGET.maxBytes);
    assert.equal(cover.choose_url, false);
    const coverAlt = collection.fields.find((field) => field.name === "coverAlt");
    assert.match(coverAlt.hint, /设置封面时必填/);
  }
});

test("pins the CMS asset and provides a useful loading failure", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(packageJson.devDependencies["decap-cms"], "3.14.1");
  assert.match(html, /src="\/studio\/editor-runtime-3\.14\.1\.js"/);
  assert.doesNotMatch(html, /unpkg\.com/);
  assert.match(html, /integrity="sha384-[^"]+"/);
  assert.match(html, /编辑器资源加载失败/);
  assert.match(html, /noindex, nofollow/);
});
