import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  extractMarkdownGalleries,
  getMarkdownGalleryIssue,
  MARKDOWN_GALLERY_MAX_COUNT,
  MARKDOWN_GALLERY_MAX_TOTAL_IMAGES,
  rehypeMarkdownGalleries,
} from "../lib/markdown-gallery.ts";
import { markdownToPlainText } from "../lib/search-index.ts";

const gallery = `> [!gallery] 发布流程的三个证据帧
> - ![编辑器中已经填写标题、摘要与正文。](/uploads/demo/editor.webp "编辑草稿")
> - ![作者预览显示公式、图表和媒体均已通过。](/uploads/demo/preview.webp "检查预览")
> - ![生产站点展示刚刚发布的文章页面。](/uploads/demo/live.webp "确认上线")`;

function render(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeMarkdownGalleries)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

test("renders a portable gallery callout as an ordered no-script evidence board", () => {
  const html = render(gallery);

  assert.match(html, /<figure class="markdown-gallery" data-gallery="ordered-images" data-gallery-count="3">/u);
  assert.match(html, /GALLERY \/ 03 FRAMES/u);
  assert.match(html, /ORDERED · LOCAL/u);
  assert.match(html, /<ol[^>]*class="markdown-gallery-grid"/u);
  assert.equal((html.match(/class="markdown-gallery-item"/gu) ?? []).length, 3);
  assert.match(html, /FRAME 01/u);
  assert.match(html, /FRAME 03/u);
  assert.match(html, /编辑草稿/u);
  assert.match(html, /编辑器中已经填写标题/u);
  assert.doesNotMatch(html, /<script|iframe|dialog|autoplay/iu);
});

test("extracts gallery order, captions, alt text, paths, and source lines", () => {
  assert.deepEqual(extractMarkdownGalleries(gallery), [
    {
      images: [
        {
          alt: "编辑器中已经填写标题、摘要与正文。",
          caption: "编辑草稿",
          line: 2,
          src: "/uploads/demo/editor.webp",
        },
        {
          alt: "作者预览显示公式、图表和媒体均已通过。",
          caption: "检查预览",
          line: 3,
          src: "/uploads/demo/preview.webp",
        },
        {
          alt: "生产站点展示刚刚发布的文章页面。",
          caption: "确认上线",
          line: 4,
          src: "/uploads/demo/live.webp",
        },
      ],
      line: 1,
      title: "发布流程的三个证据帧",
    },
  ]);
});

test("rejects malformed, remote, untitled, undescribed, duplicate, and over-budget galleries", () => {
  const invalid = [
    [
      '> [!gallery] 只有一张\n> - ![说明](/uploads/demo/one.webp "单图")',
      /2–6/u,
    ],
    [
      '> [!gallery]+ 折叠\n> - ![一](/uploads/demo/one.webp "一")\n> - ![二](/uploads/demo/two.webp "二")',
      /静态|不能折叠/u,
    ],
    [
      '> [!gallery] 外图\n> - ![一](https://img.example/one.webp "一")\n> - ![二](/uploads/demo/two.webp "二")',
      /本地|外链/u,
    ],
    [
      '> [!gallery] 暂存\n> - ![一](/uploads/one.webp "一")\n> - ![二](/uploads/two.webp "二")',
      /归档|slug/u,
    ],
    [
      '> [!gallery] 缺少短标题\n> - ![一](/uploads/demo/one.webp)\n> - ![二](/uploads/demo/two.webp "二")',
      /短标题/u,
    ],
    [
      '> [!gallery] 缺少说明\n> - ![](/uploads/demo/one.webp "一")\n> - ![二](/uploads/demo/two.webp "二")',
      /替代文本/u,
    ],
    [
      '> [!gallery] 重复\n> - ![一](/uploads/demo/one.webp "一")\n> - ![还是一](/uploads/demo/one.webp "二")',
      /重复/u,
    ],
  ];

  for (const [source, expected] of invalid) {
    const issue = getMarkdownGalleryIssue(source);
    assert.equal(issue?.kind, "gallery");
    assert.match(issue?.message ?? "", expected);
  }

  const galleryOf = (galleryIndex, count) => [
    `> [!gallery] 画廊 ${galleryIndex}`,
    ...Array.from(
      { length: count },
      (_, imageIndex) =>
        `> - ![画廊 ${galleryIndex} 的第 ${imageIndex + 1} 张](/uploads/demo/g${galleryIndex}-${imageIndex + 1}.webp "帧 ${imageIndex + 1}")`,
    ),
  ].join("\n");
  const tooManyGalleries = Array.from(
    { length: MARKDOWN_GALLERY_MAX_COUNT + 1 },
    (_, index) => galleryOf(index + 1, 2),
  ).join("\n\n");
  assert.match(getMarkdownGalleryIssue(tooManyGalleries)?.message ?? "", /最多.*组/u);

  const tooManyImages = Array.from(
    { length: MARKDOWN_GALLERY_MAX_COUNT },
    (_, index) => galleryOf(index + 1, MARKDOWN_GALLERY_MAX_TOTAL_IMAGES / 3 + 1),
  ).join("\n\n");
  assert.match(getMarkdownGalleryIssue(tooManyImages)?.message ?? "", /合计最多/u);
});

test("keeps gallery titles, captions, and descriptions searchable without marker noise", () => {
  const plainText = markdownToPlainText(gallery);
  assert.match(plainText, /发布流程的三个证据帧/u);
  assert.match(plainText, /编辑草稿 编辑器中已经填写标题/u);
  assert.match(plainText, /确认上线 生产站点展示/u);
  assert.doesNotMatch(plainText, /\[!gallery\]|FRAME|ORDERED/u);
});

test("wires the same gallery contract into reading, Studio, mobile, print, and optimized image sizes", async () => {
  const [pipeline, component, richStyles, previewRuntime, previewStyles] = await Promise.all([
    readFile(new URL("../lib/markdown-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/MarkdownContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown-rich-content.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/math-preview.mjs", import.meta.url), "utf8"),
    readFile(new URL("../studio/preview.css", import.meta.url), "utf8"),
  ]);

  assert.match(pipeline, /rehypeMarkdownGalleries/u);
  assert.match(component, /GALLERY_IMAGE_SIZES/u);
  assert.match(previewRuntime, /galleryCount/u);
  assert.match(previewRuntime, /hasPotentialStudioGallery/u);
  for (const styles of [richStyles, previewStyles]) {
    assert.match(styles, /\.markdown-gallery\s*\{/u);
    assert.match(styles, /\.markdown-gallery-grid/u);
    assert.match(styles, /\.markdown-gallery-stage/u);
  }
  assert.match(richStyles, /@media print[\s\S]*?\.markdown-gallery/u);
  assert.match(
    richStyles,
    /@media \(max-width: 32rem\)[\s\S]*?\.markdown-gallery-grid[\s\S]*?grid-template-columns:\s*1fr/u,
  );
});
