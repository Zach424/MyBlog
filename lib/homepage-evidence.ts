import type { PostRecord, ProjectRecord } from "./content/contract.ts";

type HomepagePost = Pick<
  PostRecord,
  "title" | "type" | "publishedAt" | "updatedAt" | "tags"
>;

type HomepageProject = Pick<
  ProjectRecord,
  "title" | "status" | "publishedAt" | "updatedAt" | "stack"
>;

export interface HomepageEvidenceInput {
  publicRouteCount: number;
  latestModified?: string;
  featuredProject?: HomepageProject;
  latestPost?: HomepagePost;
}

export interface HomepageEvidenceItem {
  state: "Verified" | "Building" | "Learned";
  mark: "verified" | "building" | "learned";
  value: string;
  meta: string;
}

export interface HomepageEvidence {
  evidenceItems: HomepageEvidenceItem[];
  currentFocus: string;
}

const projectStatusLabels: Record<ProjectRecord["status"], string> = {
  planning: "规划中",
  building: "构建中",
  maintained: "持续维护",
  archived: "已归档",
};

const postTypeLabels: Record<PostRecord["type"], string> = {
  article: "文章",
  til: "TIL",
};

function summarize(values: readonly string[], limit: number) {
  const visible = values.slice(0, limit);
  const hiddenCount = values.length - visible.length;

  return [...visible, ...(hiddenCount > 0 ? [`+${hiddenCount}`] : [])].join(" · ");
}

function recordDate(record: HomepagePost | HomepageProject) {
  return record.updatedAt ?? record.publishedAt;
}

function newestRecordDate(records: readonly (HomepagePost | HomepageProject)[]) {
  return records
    .map(recordDate)
    .sort((left, right) => right.localeCompare(left))[0];
}

export function createHomepageEvidence(
  input: HomepageEvidenceInput,
): HomepageEvidence {
  if (!Number.isInteger(input.publicRouteCount) || input.publicRouteCount < 0) {
    throw new Error("公开路由数量必须是非负整数");
  }

  const projectStatus = input.featuredProject
    ? projectStatusLabels[input.featuredProject.status]
    : undefined;
  const postType = input.latestPost
    ? postTypeLabels[input.latestPost.type]
    : undefined;
  const latestModified =
    input.latestModified ??
    newestRecordDate(
      [input.featuredProject, input.latestPost].filter(
        (record): record is HomepageProject | HomepagePost => Boolean(record),
      ),
    );
  const currentFocus = [
    ...(projectStatus ? [`${projectStatus}项目`] : []),
    ...(postType ? [`最新${postType}`] : []),
    ...(latestModified ? [latestModified] : []),
  ].join(" / ");

  return {
    evidenceItems: [
      {
        state: "Verified",
        mark: "verified",
        value: "公开生产上线",
        meta: `Guest · ${input.publicRouteCount} public URLs · Sitemap synced`,
      },
      input.featuredProject && projectStatus
        ? {
            state: "Building",
            mark: "building",
            value: input.featuredProject.title,
            meta: `${projectStatus} · ${summarize(input.featuredProject.stack, 2)}`,
          }
        : {
            state: "Building",
            mark: "building",
            value: "等待首个公开项目",
            meta: "PROJECT · NO PUBLIC RECORD",
          },
      input.latestPost && postType
        ? {
            state: "Learned",
            mark: "learned",
            value: input.latestPost.title,
            meta: `${input.latestPost.type.toUpperCase()} · ${input.latestPost.publishedAt} · ${summarize(input.latestPost.tags, 1)}`,
          }
        : {
            state: "Learned",
            mark: "learned",
            value: "等待首篇学习记录",
            meta: "POST · NO PUBLIC RECORD",
          },
    ],
    currentFocus: currentFocus || "等待第一条公开记录",
  };
}
