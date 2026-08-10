import assert from "node:assert/strict";
import test from "node:test";
import { createAboutProfile } from "../lib/about-profile.ts";

const featuredProject = {
  title: "MyBlog — 把学习记录做成工程资产",
  url: "/projects/myblog",
  status: "maintained",
  stack: ["TypeScript", "React", "Next.js", "Vercel", "GitHub"],
};

test("projects an about system profile from public content facts", () => {
  const profile = createAboutProfile({
    postCount: 3,
    projectCount: 1,
    seriesCount: 1,
    tagCount: 11,
    publicRouteCount: 26,
    latestModified: "2026-08-06",
    featuredProject,
  });

  assert.deepEqual(profile, {
    meta: "4 RECORDS / 26 ROUTES / UPDATED 2026-08-06",
    facts: [
      { label: "文章与 TIL", value: 3, href: "/posts" },
      { label: "项目", value: 1, href: "/projects" },
      { label: "专题", value: 1, href: "/series" },
      { label: "标签", value: 11, href: "/tags" },
      { label: "公开 URL", value: 26 },
      { label: "最近更新", value: "2026-08-06" },
    ],
    featuredProject: {
      empty: false,
      title: "MyBlog — 把学习记录做成工程资产",
      href: "/projects/myblog",
      status: "持续维护",
      stack: ["TypeScript", "React", "Next.js", "Vercel", "GitHub"],
    },
  });
});

test("keeps an empty about profile explicit", () => {
  const profile = createAboutProfile({
    postCount: 0,
    projectCount: 0,
    seriesCount: 0,
    tagCount: 0,
    publicRouteCount: 10,
  });

  assert.equal(profile.meta, "0 RECORDS / 10 ROUTES / NO PUBLIC CONTENT");
  assert.equal(profile.facts[5]?.value, "暂无公开内容");
  assert.deepEqual(profile.featuredProject, {
    empty: true,
    title: "等待首个公开项目",
    href: "/projects",
    status: "NO PUBLIC RECORD",
    stack: [],
  });
});

test("rejects invalid collection counts at the about view-model boundary", () => {
  const validInput = {
    postCount: 3,
    projectCount: 1,
    seriesCount: 1,
    tagCount: 11,
    publicRouteCount: 26,
  };

  assert.throws(
    () => createAboutProfile({ ...validInput, postCount: 1.5 }),
    /内容统计必须是非负整数/u,
  );
  assert.throws(
    () => createAboutProfile({ ...validInput, publicRouteCount: -1 }),
    /内容统计必须是非负整数/u,
  );
});
