import assert from "node:assert/strict";
import test from "node:test";
import { parse as parseYaml } from "yaml";
import {
  createPublicMarkdown,
  getPublicMarkdownPath,
} from "../lib/public-markdown.ts";

function splitSource(source) {
  const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/u.exec(source);
  assert.ok(match, "公开源文必须包含完整 YAML frontmatter 与正文");
  return { body: match[2], frontmatter: parseYaml(match[1]) };
}

const post = {
  body: [
    "## Source export",
    "",
    "[Project](/projects/myblog#evidence)",
    "![Evidence](/uploads/portable-source/evidence.webp)",
    "[This section](#source-export)",
    "[External](https://example.com/reference)",
    "`/posts/inside-code`",
    "",
    "[Project reference][project]",
    "",
    "[project]: /projects/myblog \"Project\"",
  ].join("\n"),
  canonical: "https://origin.example/portable-source",
  cover: "/uploads/portable-source/cover.webp",
  coverAlt: "Portable source evidence",
  description: "A portable public Markdown record.",
  draft: false,
  featured: true,
  freshness: "current",
  kind: "post",
  publishedAt: "2026-08-09",
  readingMinutes: 3,
  reviewedAt: "2026-08-09",
  series: { order: 1, slug: "portable-source", title: "Portable source" },
  slug: "portable-source",
  sourcePath: "content/posts/portable-source.md",
  tags: ["TypeScript", "Obsidian"],
  title: "Portable source",
  type: "article",
  updatedAt: "2026-08-10",
  url: "/posts/portable-source",
  wordCount: 420,
};

const project = {
  body: "## Project source\n\nSee [the article](/posts/portable-source).",
  demo: null,
  description: "A public project source.",
  draft: false,
  featured: true,
  freshness: "historical",
  kind: "project",
  publishedAt: "2026-08-01",
  readingMinutes: 2,
  repository: "https://github.com/example/project",
  reviewedAt: "2026-08-09",
  slug: "source-project",
  sourcePath: "content/projects/source-project.md",
  stack: ["TypeScript", "Next.js"],
  status: "maintained",
  tags: ["TypeScript"],
  title: "Source project",
  url: "/projects/source-project",
  wordCount: 240,
};

test("creates a portable post source from an explicit public allowlist", () => {
  const source = createPublicMarkdown(new URL("https://blog.example.test"), post);
  const { body, frontmatter } = splitSource(source);

  assert.equal(source.endsWith("\n"), true);
  assert.deepEqual(Object.keys(frontmatter), [
    "title",
    "description",
    "type",
    "publishedAt",
    "updatedAt",
    "freshness",
    "reviewedAt",
    "tags",
    "series",
    "canonical",
    "cover",
    "coverAlt",
  ]);
  assert.equal(frontmatter.canonical, post.canonical);
  assert.equal(
    frontmatter.cover,
    "https://blog.example.test/uploads/portable-source/cover.webp",
  );
  assert.deepEqual(frontmatter.series, post.series);
  for (const privateField of [
    "draft",
    "featured",
    "slug",
    "sourcePath",
    "body",
    "readingMinutes",
    "wordCount",
  ]) {
    assert.equal(privateField in frontmatter, false, privateField);
  }

  assert.match(
    body,
    /\[Project\]\(https:\/\/blog\.example\.test\/projects\/myblog#evidence\)/u,
  );
  assert.match(
    body,
    /!\[Evidence\]\(https:\/\/blog\.example\.test\/uploads\/portable-source\/evidence\.webp\)/u,
  );
  assert.match(
    body,
    /\[This section\]\(https:\/\/blog\.example\.test\/posts\/portable-source#source-export\)/u,
  );
  assert.match(body, /\[External\]\(https:\/\/example\.com\/reference\)/u);
  assert.match(body, /`\/posts\/inside-code`/u);
  assert.match(
    body,
    /\[project\]: https:\/\/blog\.example\.test\/projects\/myblog "Project"/u,
  );
});

test("creates a project source and stable endpoint without mutating the record", () => {
  const originalBody = project.body;
  const source = createPublicMarkdown(new URL("https://blog.example.test"), project);
  const { body, frontmatter } = splitSource(source);

  assert.deepEqual(Object.keys(frontmatter), [
    "title",
    "description",
    "type",
    "publishedAt",
    "freshness",
    "reviewedAt",
    "tags",
    "status",
    "stack",
    "repository",
    "canonical",
  ]);
  assert.equal(frontmatter.type, "project");
  assert.equal(frontmatter.demo, undefined);
  assert.equal(
    frontmatter.canonical,
    "https://blog.example.test/projects/source-project",
  );
  assert.match(
    body,
    /\[the article\]\(https:\/\/blog\.example\.test\/posts\/portable-source\)/u,
  );
  assert.equal(project.body, originalBody);
  assert.equal(getPublicMarkdownPath(project), "/projects/source-project/source.md");
  assert.equal(getPublicMarkdownPath(post), "/posts/portable-source/source.md");
});
