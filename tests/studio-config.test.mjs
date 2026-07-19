import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TAG_OPTIONS, createStudioConfig } from "../public/studio/config.mjs";
import { TAG_REGISTRY } from "../lib/content/contract.ts";

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

  const config = createStudioConfig("https://blog.example.test");
  for (const collection of config.collections) {
    const names = collection.fields.map((field) => field.name);
    for (const required of ["title", "slug", "description", "publishedAt", "tags", "draft", "featured", "body"]) {
      assert.ok(names.includes(required), `${collection.name}: ${required}`);
    }
  }
});

test("pins the CMS asset and provides a useful loading failure", async () => {
  const html = await readFile(new URL("../public/studio/index.html", import.meta.url), "utf8");
  assert.match(html, /decap-cms-app@3\.14\.1/);
  assert.match(html, /integrity="sha384-[^"]+"/);
  assert.match(html, /编辑器资源加载失败/);
  assert.match(html, /noindex, nofollow/);
});
