import type { ProjectRecord } from "./content/contract.ts";

const projectStatusLabels: Record<ProjectRecord["status"], string> = {
  planning: "规划中",
  building: "构建中",
  maintained: "持续维护",
  archived: "已归档",
};

export function getProjectStatusLabel(status: ProjectRecord["status"]) {
  return projectStatusLabels[status];
}
