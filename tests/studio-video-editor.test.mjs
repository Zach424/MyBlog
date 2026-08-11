import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STUDIO_VIDEO_EDITOR_ID,
  createStudioVideoEditorDefinition,
  registerStudioVideoEditor,
} from "../studio/video-editor.mjs";
import { VIDEO_BUDGET } from "../lib/video-policy.ts";

function h(type, props, ...children) {
  return { props: { ...props, children }, type };
}

test("serializes a discoverable Studio video block to the portable Markdown contract", () => {
  const definition = createStudioVideoEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_VIDEO_EDITOR_ID);
  assert.equal(definition.label, "本地静音视频");
  assert.deepEqual(definition.fields.map(({ name }) => name), [
    "source",
    "title",
    "description",
  ]);
  const sourceField = definition.fields[0];
  assert.equal(sourceField.widget, "file");
  assert.equal(sourceField.choose_url, false);
  assert.equal(sourceField.media_library.config.max_file_size, VIDEO_BUDGET.maxBytes);

  const markdown = definition.toBlock({
    description: "画面依次展示新建草稿、预览、提交和上线；全程无音频。",
    source: "/uploads/demo/publish-flow.mp4",
    title: "从草稿到上线",
  });
  assert.equal(
    markdown,
    '![画面依次展示新建草稿、预览、提交和上线；全程无音频。](/uploads/demo/publish-flow.mp4 "从草稿到上线")',
  );
  const parsed = definition.fromBlock(definition.pattern.exec(markdown));
  assert.deepEqual(parsed, {
    description: "画面依次展示新建草稿、预览、提交和上线；全程无音频。",
    source: "/uploads/demo/publish-flow.mp4",
    title: "从草稿到上线",
  });
  const preview = definition.toPreview(parsed);
  assert.equal(preview.type, "figure");
  assert.match(JSON.stringify(preview), /video.*controls.*preload/u);
});

test("registers one idempotent Studio video editor component", () => {
  const registrations = [];
  const CMS = {
    registerEditorComponent(definition) {
      registrations.push(definition);
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioVideoEditor({ CMS, documentRef, h });
  const second = registerStudioVideoEditor({ CMS, documentRef, h });

  assert.equal(first, second);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, STUDIO_VIDEO_EDITOR_ID);
  assert.equal(documentRef.documentElement.dataset.videoEditor, "registered");
});

test("serves and enables the editor component in both Studio collections", async () => {
  const [configSource, html, assets] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
  ]);
  assert.match(configSource, /myblog-video/u);
  assert.match(html, /from "\/studio\/video-editor\.mjs"/u);
  assert.match(html, /registerStudioVideoEditor\(\)/u);
  assert.match(assets, /video-editor\.mjs/u);
});
