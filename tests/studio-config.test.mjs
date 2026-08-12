import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FRESHNESS_OPTIONS,
  AUDIO_MAX_FILE_SIZE,
  MEDIA_MAX_FILE_SIZE,
  STUDIO_ENTRY_MEDIA_FOLDER,
  STUDIO_ENTRY_PUBLIC_FOLDER,
  TAG_OPTIONS,
  createStudioConfig,
} from "../studio/config.mjs";
import {
  CONTENT_FRESHNESS_VALUES,
  TAG_REGISTRY,
} from "../lib/content/contract.ts";
import { MEDIA_BUDGET } from "../lib/media-policy.ts";
import { VIDEO_BUDGET } from "../lib/video-policy.ts";
import { AUDIO_BUDGET } from "../lib/audio-policy.ts";

test("maps the publishing studio to the single Git content source", () => {
  const config = createStudioConfig("https://blog.example.test/path");
  assert.equal(config.backend.repo, "Zach424/MyBlog");
  assert.equal(config.backend.branch, "main");
  assert.equal(config.backend.base_url, "https://blog.example.test");
  assert.equal(config.backend.auth_endpoint, "/api/cms/auth");
  assert.equal(config.publish_mode, "editorial_workflow");
  assert.equal(config.media_folder, "public/uploads");
  assert.equal(config.public_folder, "/uploads");
  assert.deepEqual(
    config.collections.map((collection) => collection.folder),
    ["content/posts", "content/projects"],
  );
  assert.ok(config.collections.every((collection) => collection.slug === "{{fields.slug}}"));
  assert.ok(
    config.collections.every(
      (collection) => collection.media_folder === STUDIO_ENTRY_MEDIA_FOLDER,
    ),
  );
  assert.ok(
    config.collections.every(
      (collection) => collection.public_folder === STUDIO_ENTRY_PUBLIC_FOLDER,
    ),
  );
  assert.equal(STUDIO_ENTRY_MEDIA_FOLDER, "/public/uploads/{{fields.slug}}");
  assert.equal(STUDIO_ENTRY_PUBLIC_FOLDER, "/uploads/{{fields.slug}}");
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
    assert.match(cover.hint, /同名同内容可复用.*同名不同内容必须明确确认替换/u);
    const coverAlt = collection.fields.find((field) => field.name === "coverAlt");
    assert.match(coverAlt.hint, /设置封面时必填/);
    const slug = collection.fields.find((field) => field.name === "slug");
    assert.equal(slug.widget, "stable-slug");
    assert.match(slug.hint, /先填写.*再上传/);
    assert.match(slug.hint, /首次保存后控件会锁定/);
    const body = collection.fields.find((field) => field.name === "body");
    assert.deepEqual(body.editor_components, [
      "image",
      "code-block",
      "myblog-gallery",
      "myblog-table",
      "myblog-task-list",
      "myblog-references",
      "myblog-steps",
      "myblog-glossary",
      "myblog-faq",
      "myblog-filetree",
      "myblog-timeline",
      "myblog-decision",
      "myblog-experiment",
      "myblog-codechange",
      "myblog-http",
      "myblog-audio",
      "myblog-video",
    ]);
    assert.equal(body.audio_max_file_size, AUDIO_BUDGET.maxBytes);
    assert.equal(body.video_max_file_size, VIDEO_BUDGET.maxBytes);
    assert.equal(AUDIO_MAX_FILE_SIZE, AUDIO_BUDGET.maxBytes);
    assert.match(body.hint, /新增、同内容复用和同名替换.*必须确认/u);
    assert.match(body.hint, /多图证据画廊/u);
    assert.match(body.hint, /技术数据表格/u);
    assert.match(body.hint, /项目里程碑时间线/u);
    assert.match(body.hint, /项目任务清单/u);
    assert.match(body.hint, /操作步骤流程/u);
    assert.match(body.hint, /术语定义表/u);
    assert.match(body.hint, /项目文件树/u);
    assert.match(body.hint, /本地音频笔记.*完整文字稿/u);
    assert.match(body.hint, /公式使用 \$\.\.\.\$ 或 \$\$\.\.\.\$\$.*原始 Markdown.*错误行/u);
  }
});

test("pins the CMS asset and provides a useful loading failure", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(packageJson.devDependencies["decap-cms"], "3.14.1");
  assert.match(html, /src="\/studio\/editor-runtime-3\.14\.1\.js"/);
  assert.match(html, /from "\/studio\/media-preflight\.mjs"/);
  assert.match(html, /from "\/studio\/stable-slug-widget\.mjs"/);
  assert.match(html, /from "\/studio\/math-preview\.mjs"/);
  assert.match(html, /from "\/studio\/gallery-editor\.mjs"/);
  assert.match(html, /from "\/studio\/table-editor\.mjs"/);
  assert.match(html, /from "\/studio\/audio-editor\.mjs"/);
  assert.match(html, /from "\/studio\/references-editor\.mjs"/);
  assert.match(html, /from "\/studio\/steps-editor\.mjs"/);
  assert.match(html, /from "\/studio\/glossary-editor\.mjs"/);
  assert.match(html, /from "\/studio\/filetree-editor\.mjs"/);
  assert.match(html, /installStudioMediaPreflight\(\)/);
  assert.match(html, /registerStableSlugWidget\(\)/);
  assert.match(html, /registerStudioMathPreview\(\)/);
  assert.match(html, /registerStudioGalleryEditor\(\)/);
  assert.match(html, /registerStudioTableEditor\(\)/);
  assert.match(html, /registerStudioAudioEditor\(\)/);
  assert.match(html, /registerStudioStepsEditor\(\)/);
  assert.match(html, /registerStudioGlossaryEditor\(\)/);
  assert.match(html, /registerStudioFileTreeEditor\(\)/);
  assert.match(html, /#studio-media-preflight/);
  assert.match(html, /data-state="error"/);
  assert.match(html, /data-stable-slug-state="locked"/);
  assert.match(html, /Studio 作者控件加载失败/u);
  assert.doesNotMatch(html, /unpkg\.com/);
  assert.match(html, /integrity="sha384-[^"]+"/);
  assert.match(html, /编辑器资源加载失败/);
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /<link rel="icon" href="\/icon\.png"/u);
});
