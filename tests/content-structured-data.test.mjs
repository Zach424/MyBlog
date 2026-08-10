import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createBlogPostingStructuredData,
  createSoftwareSourceCodeStructuredData,
} from "../lib/content/structured-data.ts";

const author = {
  "@type": "Person",
  name: "Zach424",
  url: "https://github.com/Zach424",
};

test("creates one exact BlogPosting document without retaining caller arrays", () => {
  const siteUrl = new URL("https://blog.example.test/preview");
  const canonicalUrl = new URL("https://blog.example.test/posts/typed-schema");
  const imageUrl = new URL("https://blog.example.test/uploads/typed-schema/cover.webp");
  const post = {
    title: "Typed schema",
    description: "Freeze the full article document.",
    publishedAt: "2026-08-01",
    readingMinutes: 8,
    reviewedAt: "2026-08-08",
    tags: ["Next.js", "TypeScript"],
    wordCount: 1542,
  };
  const originalUrls = [siteUrl.href, canonicalUrl.href, imageUrl.href];

  const document = createBlogPostingStructuredData({
    canonicalUrl,
    imageUrl,
    post,
    siteUrl,
  });
  const expected = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": "https://blog.example.test/posts/typed-schema#content",
    isPartOf: { "@id": "https://blog.example.test/#website" },
    headline: "Typed schema",
    description: "Freeze the full article document.",
    datePublished: "2026-08-01",
    dateModified: "2026-08-08",
    inLanguage: "zh-CN",
    keywords: ["Next.js", "TypeScript"],
    wordCount: 1542,
    timeRequired: "PT8M",
    mainEntityOfPage: "https://blog.example.test/posts/typed-schema",
    url: "https://blog.example.test/posts/typed-schema",
    image: "https://blog.example.test/uploads/typed-schema/cover.webp",
    author,
  };

  assert.deepEqual(document, expected);
  assert.equal(JSON.stringify(document), JSON.stringify(expected));
  assert.notEqual(document.keywords, post.tags);
  document.keywords.push("Tooling");
  assert.deepEqual(post.tags, ["Next.js", "TypeScript"]);
  assert.deepEqual(
    [siteUrl.href, canonicalUrl.href, imageUrl.href],
    originalUrls,
  );
});

test("creates one exact SoftwareSourceCode document without retaining caller arrays", () => {
  const siteUrl = new URL("https://blog.example.test");
  const canonicalUrl = new URL("https://blog.example.test/projects/schema-tools");
  const imageUrl = new URL("https://blog.example.test/uploads/schema-tools/cover.webp");
  const project = {
    title: "Schema tools",
    description: "Keep project schema deterministic.",
    publishedAt: "2026-07-01",
    reviewedAt: "2026-08-09",
    tags: ["TypeScript", "Tooling"],
    repository: "https://github.com/Zach424/schema-tools",
    stack: ["TypeScript", "Next.js"],
  };

  const document = createSoftwareSourceCodeStructuredData({
    canonicalUrl,
    imageUrl,
    project,
    siteUrl,
  });
  const expected = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    "@id": "https://blog.example.test/projects/schema-tools#content",
    isPartOf: { "@id": "https://blog.example.test/#website" },
    name: "Schema tools",
    description: "Keep project schema deterministic.",
    dateCreated: "2026-07-01",
    dateModified: "2026-08-09",
    inLanguage: "zh-CN",
    keywords: ["TypeScript", "Tooling"],
    url: "https://blog.example.test/projects/schema-tools",
    image: "https://blog.example.test/uploads/schema-tools/cover.webp",
    codeRepository: "https://github.com/Zach424/schema-tools",
    programmingLanguage: ["TypeScript", "Next.js"],
    author,
  };

  assert.deepEqual(document, expected);
  assert.equal(JSON.stringify(document), JSON.stringify(expected));
  assert.notEqual(document.keywords, project.tags);
  assert.notEqual(document.programmingLanguage, project.stack);
  document.keywords.push("Git");
  document.programmingLanguage.push("React");
  assert.deepEqual(project.tags, ["TypeScript", "Tooling"]);
  assert.deepEqual(project.stack, ["TypeScript", "Next.js"]);
});

test("keeps optional image and repository keys explicit but omits them from JSON", () => {
  const siteUrl = new URL("https://blog.example.test");
  const postDocument = createBlogPostingStructuredData({
    canonicalUrl: new URL("https://blog.example.test/posts/no-cover"),
    post: {
      title: "No cover",
      description: "Optional article image.",
      publishedAt: "2026-08-01",
      readingMinutes: 1,
      reviewedAt: "2026-08-01",
      tags: ["Next.js"],
      wordCount: 1,
    },
    siteUrl,
  });
  const projectDocument = createSoftwareSourceCodeStructuredData({
    canonicalUrl: new URL("https://blog.example.test/projects/no-repository"),
    project: {
      title: "No repository",
      description: "Optional project facts.",
      publishedAt: "2026-08-01",
      reviewedAt: "2026-08-01",
      tags: ["Tooling"],
      stack: ["TypeScript"],
    },
    siteUrl,
  });

  assert.equal(Object.hasOwn(postDocument, "image"), true);
  assert.equal(postDocument.wordCount, 1);
  assert.equal(postDocument.timeRequired, "PT1M");
  assert.equal(postDocument.image, undefined);
  assert.equal(Object.hasOwn(projectDocument, "image"), true);
  assert.equal(Object.hasOwn(projectDocument, "codeRepository"), true);
  assert.equal(projectDocument.image, undefined);
  assert.equal(projectDocument.codeRepository, undefined);
  assert.doesNotMatch(JSON.stringify(postDocument), /"image"/u);
  assert.doesNotMatch(
    JSON.stringify(projectDocument),
    /"(?:image|codeRepository)"/u,
  );
});

test("keeps both detail pages on the pure structured-data boundary", async () => {
  const [postPage, projectPage] = await Promise.all([
    readFile(new URL("../app/posts/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/projects/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(postPage, /createBlogPostingStructuredData\(\{/u);
  assert.match(projectPage, /createSoftwareSourceCodeStructuredData\(\{/u);
  for (const source of [postPage, projectPage]) {
    assert.doesNotMatch(source, /"@context": "https:\/\/schema\.org"/u);
    assert.doesNotMatch(source, /createContentStructuredIdentity/u);
    assert.doesNotMatch(source, /inLanguage: SITE_LANGUAGE/u);
    assert.doesNotMatch(source, /author:\s*\{/u);
  }
});
