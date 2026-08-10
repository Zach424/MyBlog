import type { ProjectRecord } from "./content/contract.ts";

export interface ProjectStatusPresentation {
  label: string;
  code: string;
  meta: string;
}

const projectStatusPresentations: Record<
  ProjectRecord["status"],
  ProjectStatusPresentation
> = {
  planning: { label: "规划中", code: "PLANNING", meta: "规划中 · PLANNING" },
  building: { label: "构建中", code: "BUILDING", meta: "构建中 · BUILDING" },
  maintained: {
    label: "持续维护",
    code: "MAINTAINED",
    meta: "持续维护 · MAINTAINED",
  },
  archived: { label: "已归档", code: "ARCHIVED", meta: "已归档 · ARCHIVED" },
};

export function getProjectStatusPresentation(status: ProjectRecord["status"]) {
  return { ...projectStatusPresentations[status] };
}

export function getProjectStatusLabel(status: ProjectRecord["status"]) {
  return getProjectStatusPresentation(status).label;
}
