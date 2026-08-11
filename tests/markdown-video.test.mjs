import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  extractMarkdownVideos,
  getMarkdownVideoIssue,
  MARKDOWN_VIDEO_MAX_COUNT,
  rehypeMarkdownVideos,
} from "../lib/markdown-video.ts";

const video =
  '![画面依次展示新建草稿、预览、提交和上线；全程无音频。](/uploads/demo/publish-flow.mp4 "从草稿到上线")';

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeMarkdownVideos)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("renders one local silent MP4 as a bounded native-video evidence block", () => {
  const html = render(video);

  assert.match(html, /class="markdown-video"/u);
  assert.match(html, /data-video="silent-mp4"/u);
  assert.match(html, /<video[^>]*controls[^>]*preload="none"[^>]*playsinline/u);
  assert.match(html, /<source src="\/uploads\/demo\/publish-flow\.mp4" type="video\/mp4">/u);
  assert.match(html, /VIDEO \/ SILENT MP4/u);
  assert.match(html, /LOCAL · NO TRACKING/u);
  assert.match(html, /从草稿到上线/u);
  assert.match(html, /画面依次展示新建草稿/u);
  assert.match(html, /下载视频文件/u);
  assert.doesNotMatch(html, /iframe|autoplay|loop|<script/iu);
});

test("extracts searchable video title, description, path, and source line", () => {
  const videos = extractMarkdownVideos(`正文。\n\n${video}`);

  assert.deepEqual(videos, [
    {
      description: "画面依次展示新建草稿、预览、提交和上线；全程无音频。",
      line: 3,
      src: "/uploads/demo/publish-flow.mp4",
      title: "从草稿到上线",
    },
  ]);
});

test("rejects remote, unscoped, untitled, undescribed, queried, and over-count videos", () => {
  const invalid = [
    ['![说明](https://video.example/demo.mp4 "外部视频")', /仓库内|本地/u],
    ['![说明](/uploads/demo.mp4 "未归档")', /归档|slug/u],
    ["![](/uploads/demo/video.mp4 \"缺少说明\")", /文字说明/u],
    ["![过短](/uploads/demo/video.mp4)", /标题/u],
    ['![说明足够完整](/uploads/demo/video.mp4?token=secret "查询参数")', /查询参数|锚点/u],
  ];

  for (const [source, expected] of invalid) {
    const issue = getMarkdownVideoIssue(source);
    assert.equal(issue?.kind, "video");
    assert.match(issue?.message ?? "", expected);
  }

  const tooMany = Array.from(
    { length: MARKDOWN_VIDEO_MAX_COUNT + 1 },
    (_, index) =>
      `![第 ${index + 1} 段屏幕录制的完整文字说明](/uploads/demo/video-${index + 1}.mp4 "演示 ${index + 1}")`,
  ).join("\n\n");
  assert.match(getMarkdownVideoIssue(tooMany)?.message ?? "", /最多/u);
});

test("wires the same video contract into public Markdown, Studio, mobile, and print", async () => {
  const [pipeline, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);

  assert.match(pipeline, /rehypeMarkdownVideos/u);
  assert.match(previewRuntime, /videoCount/u);
  assert.match(previewRuntime, /hasPotentialStudioVideo/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-video\s*\{/u);
    assert.match(styles, /\.markdown-video-player/u);
  }
  assert.match(
    richStyles,
    /@media print[\s\S]*?\.markdown-video-player[\s\S]*?display:\s*none/u,
  );
});
