import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  extractMarkdownAudioNotes,
  getMarkdownAudioIssue,
  MARKDOWN_AUDIO_MAX_COUNT,
  rehypeMarkdownAudioNotes,
} from "../lib/markdown-audio.ts";

const audio = [
  "> [!audio] 发布复盘口述",
  '> [下载 MP3](/uploads/demo/release-retro.mp3 "发布复盘口述")',
  "> 这一段录音总结了发布前检查、上线确认与复盘结论。",
  ">",
  "> **文字稿**",
  "> 先运行完整检查，再确认生产冒烟全部通过；最后记录失败原因与下一步。",
].join("\n");

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeMarkdownAudioNotes)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("renders one local MP3 as a transcript-first native audio note", () => {
  const html = render(audio);

  assert.match(html, /class="markdown-audio"/u);
  assert.match(html, /data-audio="local-mp3"/u);
  assert.match(html, /AUDIO NOTE \/ MP3/u);
  assert.match(html, /LOCAL · TRANSCRIPT INCLUDED/u);
  assert.match(html, /<audio[^>]*controls[^>]*preload="metadata"/u);
  assert.match(html, /<source src="\/uploads\/demo\/release-retro\.mp3" type="audio\/mpeg">/u);
  assert.match(html, /发布复盘口述/u);
  assert.match(html, /这一段录音总结了发布前检查/u);
  assert.match(html, /TRANSCRIPT/u);
  assert.match(html, /先运行完整检查/u);
  assert.match(html, /下载 MP3/u);
  assert.doesNotMatch(html, /iframe|autoplay|loop|<script/iu);
});

test("extracts searchable audio metadata, transcript, path, and source line", () => {
  const notes = extractMarkdownAudioNotes(`正文。\n\n${audio}`);

  assert.deepEqual(notes, [
    {
      description: "这一段录音总结了发布前检查、上线确认与复盘结论。",
      line: 3,
      src: "/uploads/demo/release-retro.mp3",
      title: "发布复盘口述",
      transcript: "先运行完整检查，再确认生产冒烟全部通过；最后记录失败原因与下一步。",
    },
  ]);
});

test("rejects remote, unscoped, untitled, undescribed, transcriptless, queried, and over-count audio", () => {
  const invalid = [
    [audio.replace("/uploads/demo/release-retro.mp3", "https://audio.example/demo.mp3"), /仓库内|本地/u],
    [audio.replace("/uploads/demo/release-retro.mp3", "/uploads/release-retro.mp3"), /归档|slug/u],
    [audio.replace("[!audio] 发布复盘口述", "[!audio]"), /标题/u],
    [audio.replace("> 这一段录音总结了发布前检查、上线确认与复盘结论。\n", ""), /简述/u],
    [audio.replace("> **文字稿**\n> 先运行完整检查，再确认生产冒烟全部通过；最后记录失败原因与下一步。", ""), /文字稿/u],
    [audio.replace("release-retro.mp3", "release-retro.mp3?token=secret"), /查询参数|锚点/u],
  ];

  for (const [source, expected] of invalid) {
    const issue = getMarkdownAudioIssue(source);
    assert.equal(issue?.kind, "audio");
    assert.match(issue?.message ?? "", expected);
  }

  const tooMany = Array.from(
    { length: MARKDOWN_AUDIO_MAX_COUNT + 1 },
    (_, index) => audio.replaceAll("release-retro", `release-retro-${index + 1}`),
  ).join("\n\n");
  assert.match(getMarkdownAudioIssue(tooMany)?.message ?? "", /最多/u);
});

test("wires the same audio contract into public Markdown, Studio, search, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles, search] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/search-index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pipeline, /rehypeMarkdownAudioNotes/u);
  assert.match(previewRuntime, /audioCount/u);
  assert.match(previewRuntime, /hasPotentialStudioAudio/u);
  assert.match(search, /normalizeMarkdownAudioNotesForPlainText/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-audio\s*\{/u);
    assert.match(styles, /\.markdown-audio-player/u);
  }
  assert.match(
    richStyles,
    /@media print[\s\S]*?\.markdown-audio-player[\s\S]*?display:\s*none/u,
  );
});
