import assert from "node:assert/strict";
import test from "node:test";
import { createHomepageEvidence } from "../lib/homepage-evidence.ts";

const latestPost = {
  title: "从零搭建可维护的个人技术博客",
  type: "article",
  publishedAt: "2026-07-18",
  updatedAt: "2026-08-05",
  tags: ["Next.js", "TypeScript", "Cloudflare", "Design Systems"],
};

const featuredProject = {
  title: "MyBlog — 把学习记录做成工程资产",
  publishedAt: "2026-07-18",
  updatedAt: "2026-08-06",
  status: "maintained",
  stack: ["TypeScript", "React", "Next.js", "Vercel", "GitHub"],
};

test("projects current homepage evidence from public content facts", () => {
  const evidence = createHomepageEvidence({
    publicRouteCount: 26,
    latestModified: "2026-08-06",
    featuredProject,
    latestPost,
  });

  assert.deepEqual(evidence, {
    evidenceItems: [
      {
        state: "Verified",
        mark: "verified",
        value: "公开生产上线",
        meta: "Guest · 26 public URLs · Sitemap synced",
      },
      {
        state: "Building",
        mark: "building",
        value: "MyBlog — 把学习记录做成工程资产",
        meta: "持续维护 · TypeScript · React · +3",
      },
      {
        state: "Learned",
        mark: "learned",
        value: "从零搭建可维护的个人技术博客",
        meta: "ARTICLE · 2026-07-18 · Next.js · +3",
      },
    ],
    currentFocus: "持续维护项目 / 最新文章 / 2026-08-06",
  });
});

test("keeps an empty public content set honest without inventing status", () => {
  const evidence = createHomepageEvidence({ publicRouteCount: 10 });

  assert.equal(evidence.evidenceItems[0]?.meta, "Guest · 10 public URLs · Sitemap synced");
  assert.equal(evidence.evidenceItems[1]?.value, "等待首个公开项目");
  assert.equal(evidence.evidenceItems[1]?.meta, "PROJECT · NO PUBLIC RECORD");
  assert.equal(evidence.evidenceItems[2]?.value, "等待首篇学习记录");
  assert.equal(evidence.evidenceItems[2]?.meta, "POST · NO PUBLIC RECORD");
  assert.equal(evidence.currentFocus, "等待第一条公开记录");
});

test("rejects an invalid public route count at the view-model boundary", () => {
  assert.throws(
    () => createHomepageEvidence({ publicRouteCount: -1 }),
    /公开路由数量必须是非负整数/u,
  );
  assert.throws(
    () => createHomepageEvidence({ publicRouteCount: 1.5 }),
    /公开路由数量必须是非负整数/u,
  );
});
