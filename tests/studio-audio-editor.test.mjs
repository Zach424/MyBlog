import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STUDIO_AUDIO_EDITOR_ID,
  createStudioAudioEditorDefinition,
  registerStudioAudioEditor,
} from "../studio/audio-editor.mjs";
import { AUDIO_BUDGET } from "../lib/audio-policy.ts";

function h(type, props, ...children) {
  return { props: { ...props, children }, type };
}

test("serializes a discoverable Studio audio block to the portable Markdown contract", () => {
  const definition = createStudioAudioEditorDefinition({ h });
  assert.equal(definition.id, STUDIO_AUDIO_EDITOR_ID);
  assert.equal(definition.label, "本地音频笔记");
  assert.deepEqual(definition.fields.map(({ name }) => name), [
    "source",
    "title",
    "description",
    "transcript",
  ]);
  const sourceField = definition.fields[0];
  assert.equal(sourceField.widget, "file");
  assert.equal(sourceField.choose_url, false);
  assert.equal(sourceField.media_library.config.max_file_size, AUDIO_BUDGET.maxBytes);

  const markdown = definition.toBlock({
    description: "总结发布检查、上线确认与复盘结论。",
    source: "/uploads/demo/release-retro.mp3",
    title: "发布复盘口述",
    transcript: "先运行完整检查，再确认生产冒烟通过。\n最后记录失败原因与下一步。",
  });
  assert.match(markdown, /^> \[!audio\] 发布复盘口述$/mu);
  assert.match(markdown, /> \[下载 MP3\]\(\/uploads\/demo\/release-retro\.mp3 "发布复盘口述"\)/u);
  assert.match(markdown, /> \*\*文字稿\*\*/u);
  assert.match(markdown, /> 先运行完整检查/u);
  const parsed = definition.fromBlock(definition.pattern.exec(markdown));
  assert.deepEqual(parsed, {
    description: "总结发布检查、上线确认与复盘结论。",
    source: "/uploads/demo/release-retro.mp3",
    title: "发布复盘口述",
    transcript: "先运行完整检查，再确认生产冒烟通过。\n最后记录失败原因与下一步。",
  });
  const preview = definition.toPreview(parsed);
  assert.equal(preview.type, "figure");
  assert.match(JSON.stringify(preview), /audio.*controls.*metadata.*TRANSCRIPT/u);
});

test("registers one idempotent Studio audio editor component", () => {
  const registrations = [];
  const CMS = {
    registerEditorComponent(definition) {
      registrations.push(definition);
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const first = registerStudioAudioEditor({ CMS, documentRef, h });
  const second = registerStudioAudioEditor({ CMS, documentRef, h });

  assert.equal(first, second);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, STUDIO_AUDIO_EDITOR_ID);
  assert.equal(documentRef.documentElement.dataset.audioEditor, "registered");
});

test("serves and enables the editor component in both Studio collections", async () => {
  const [configSource, html, assets] = await Promise.all([
    readFile(new URL("../studio/config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio-assets.ts", import.meta.url), "utf8"),
  ]);
  assert.match(configSource, /myblog-audio/u);
  assert.match(html, /from "\/studio\/audio-editor\.mjs"/u);
  assert.match(html, /registerStudioAudioEditor\(\)/u);
  assert.match(assets, /audio-editor\.mjs/u);
});
