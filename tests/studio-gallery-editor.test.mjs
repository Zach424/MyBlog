import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STUDIO_GALLERY_EDITOR_ID,
  STUDIO_GALLERY_MAX_FILE_SIZE,
  createStudioGalleryEditorDefinition,
  registerStudioGalleryEditor,
} from "../studio/gallery-editor.mjs";
import { MEDIA_BUDGET } from "../lib/media-policy.ts";

function h(type, props, ...children) {
  return { props: { ...props, children }, type };
}

const data = {
  images: [
    {
      alt: "编辑器中已经填写正文。",
      caption: "编辑草稿",
      source: "/uploads/demo/editor.webp",
    },
    {
      alt: "生产页面显示发布结果。",
      caption: "确认上线",
      source: "/uploads/demo/live.webp",
    },
  ],
  title: "发布前后的证据",
};

test("serializes a reorderable Studio list to the portable gallery contract", () => {
  const definition = createStudioGalleryEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_GALLERY_EDITOR_ID);
  assert.equal(definition.label, "多图证据画廊");
  assert.deepEqual(definition.fields.map(({ name }) => name), ["title", "images"]);
  const images = definition.fields[1];
  assert.equal(images.widget, "list");
  assert.equal(images.min, 2);
  assert.equal(images.max, 6);
  assert.equal(images.allow_reorder, true);
  assert.equal(images.fields[0].widget, "image");
  assert.equal(images.fields[0].choose_url, false);
  assert.equal(
    images.fields[0].media_library.config.max_file_size,
    MEDIA_BUDGET.maxBytes,
  );
  assert.equal(STUDIO_GALLERY_MAX_FILE_SIZE, MEDIA_BUDGET.maxBytes);

  const markdown = definition.toBlock(data);
  assert.equal(
    markdown,
    '> [!gallery] 发布前后的证据\n> - ![编辑器中已经填写正文。](/uploads/demo/editor.webp "编辑草稿")\n> - ![生产页面显示发布结果。](/uploads/demo/live.webp "确认上线")',
  );
  assert.deepEqual(definition.fromBlock(definition.pattern.exec(markdown)), data);
  const preview = definition.toPreview(data);
  assert.equal(preview.type, "figure");
  assert.match(JSON.stringify(preview), /markdown-gallery.*FRAME 01.*确认上线/u);
});

test("rejects incomplete, duplicated, and unscoped Studio gallery data", () => {
  const definition = createStudioGalleryEditorDefinition({ h });
  assert.throws(
    () => definition.toBlock({ ...data, images: data.images.slice(0, 1) }),
    /2–6/u,
  );
  assert.throws(
    () => definition.toBlock({ ...data, images: [data.images[0], data.images[0]] }),
    /重复/u,
  );
  assert.throws(
    () =>
      definition.toBlock({
        ...data,
        images: [
          { ...data.images[0], source: "/uploads/editor.webp" },
          data.images[1],
        ],
      }),
    /第 1 张图片无效/u,
  );
});

test("registers one idempotent Studio gallery editor component", () => {
  const registrations = [];
  const CMS = {
    registerEditorComponent(definition) {
      registrations.push(definition);
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioGalleryEditor({ CMS, documentRef, h });
  const second = registerStudioGalleryEditor({ CMS, documentRef, h });

  assert.equal(first, second);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, STUDIO_GALLERY_EDITOR_ID);
  assert.equal(documentRef.documentElement.dataset.galleryEditor, "registered");
});

test("serves and enables the gallery editor in both Studio collections", async () => {
  const [configSource, html, assets] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
  ]);
  assert.match(configSource, /myblog-gallery/u);
  assert.match(html, /from "\/studio\/gallery-editor\.mjs"/u);
  assert.match(html, /registerStudioGalleryEditor\(\)/u);
  assert.match(assets, /gallery-editor\.mjs/u);
});
