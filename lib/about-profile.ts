import type { ProjectRecord } from "./content/contract.ts";
import { getProjectStatusLabel } from "./content-presentation.ts";

type AboutProject = Pick<ProjectRecord, "title" | "url" | "status" | "stack">;

export interface AboutProfileInput {
  postCount: number;
  projectCount: number;
  seriesCount: number;
  tagCount: number;
  publicRouteCount: number;
  latestModified?: string;
  featuredProject?: AboutProject;
}

export interface AboutProfileFact {
  label: string;
  value: number | string;
  href?: string;
}

export interface AboutFeaturedProject {
  empty: boolean;
  title: string;
  href: string;
  status: string;
  stack: string[];
}

export interface AboutProfile {
  meta: string;
  facts: AboutProfileFact[];
  featuredProject: AboutFeaturedProject;
}

function assertCounts(counts: readonly number[]) {
  if (counts.some((count) => !Number.isInteger(count) || count < 0)) {
    throw new Error("内容统计必须是非负整数");
  }
}

export function createAboutProfile(input: AboutProfileInput): AboutProfile {
  const counts = [
    input.postCount,
    input.projectCount,
    input.seriesCount,
    input.tagCount,
    input.publicRouteCount,
  ];
  assertCounts(counts);

  const recordCount = input.postCount + input.projectCount;
  const freshness = input.latestModified
    ? `UPDATED ${input.latestModified}`
    : "NO PUBLIC CONTENT";

  return {
    meta: `${recordCount} RECORDS / ${input.publicRouteCount} ROUTES / ${freshness}`,
    facts: [
      { label: "文章与 TIL", value: input.postCount, href: "/posts" },
      { label: "项目", value: input.projectCount, href: "/projects" },
      { label: "专题", value: input.seriesCount, href: "/series" },
      { label: "标签", value: input.tagCount, href: "/tags" },
      { label: "公开 URL", value: input.publicRouteCount },
      { label: "最近更新", value: input.latestModified ?? "暂无公开内容" },
    ],
    featuredProject: input.featuredProject
      ? {
          empty: false,
          title: input.featuredProject.title,
          href: input.featuredProject.url,
          status: getProjectStatusLabel(input.featuredProject.status),
          stack: [...input.featuredProject.stack],
        }
      : {
          empty: true,
          title: "等待首个公开项目",
          href: "/projects",
          status: "NO PUBLIC RECORD",
          stack: [],
        },
  };
}
