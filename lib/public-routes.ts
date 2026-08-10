import type {
  ContentRecord,
  PostRecord,
  ProjectRecord,
  SeriesIndexEntry,
  TagIndexEntry,
} from "./content/contract.ts";

export type PublicRouteChangeFrequency = "weekly" | "monthly";

export interface PublicRouteFact {
  path: string;
  lastModified?: string;
  changeFrequency: PublicRouteChangeFrequency;
  priority: number;
}

export interface PublicRouteInventoryInput {
  posts: readonly PostRecord[];
  projects: readonly ProjectRecord[];
  series: readonly SeriesIndexEntry[];
  tags: readonly TagIndexEntry[];
}

export interface PublicRouteInventory {
  routes: PublicRouteFact[];
  total: number;
  latestModified?: string;
}

type PublicRouteDateSource = "site" | "posts" | "projects";

interface StaticPublicRouteFact {
  path: string;
  dateSource: PublicRouteDateSource;
  changeFrequency: PublicRouteChangeFrequency;
  priority: number;
}

export const STATIC_PUBLIC_ROUTE_FACTS = [
  { path: "/", dateSource: "site", changeFrequency: "weekly", priority: 1 },
  { path: "/posts", dateSource: "posts", changeFrequency: "weekly", priority: 0.9 },
  {
    path: "/projects",
    dateSource: "projects",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  { path: "/archive", dateSource: "site", changeFrequency: "weekly", priority: 0.7 },
  {
    path: "/subscribe",
    dateSource: "site",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/series",
    dateSource: "posts",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  { path: "/tags", dateSource: "site", changeFrequency: "monthly", priority: 0.6 },
  {
    path: "/knowledge",
    dateSource: "site",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  { path: "/search", dateSource: "site", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about", dateSource: "site", changeFrequency: "monthly", priority: 0.5 },
] as const satisfies readonly StaticPublicRouteFact[];

function contentDate(record: ContentRecord) {
  return record.updatedAt ?? record.publishedAt;
}

function newestDate(records: readonly ContentRecord[]) {
  return records.map(contentDate).sort((left, right) => right.localeCompare(left))[0];
}

function assertUniquePaths(routes: readonly PublicRouteFact[]) {
  const seen = new Set<string>();

  for (const route of routes) {
    if (seen.has(route.path)) {
      throw new Error(`公开路由事实清单存在重复路径：${route.path}`);
    }
    seen.add(route.path);
  }
}

export function createPublicRouteInventory(
  input: PublicRouteInventoryInput,
): PublicRouteInventory {
  const records: ContentRecord[] = [...input.posts, ...input.projects];
  const dates: Record<PublicRouteDateSource, string | undefined> = {
    site: newestDate(records),
    posts: newestDate(input.posts),
    projects: newestDate(input.projects),
  };
  const routes: PublicRouteFact[] = [
    ...STATIC_PUBLIC_ROUTE_FACTS.map((route) => ({
      path: route.path,
      lastModified: dates[route.dateSource],
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...input.posts.map((post) => ({
      path: post.url,
      lastModified: contentDate(post),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...input.projects.map((project) => ({
      path: project.url,
      lastModified: contentDate(project),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...input.series.map((entry) => ({
      path: `/series/${entry.slug}`,
      lastModified: newestDate(entry.posts),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...input.tags.map((tag) => ({
      path: `/tags/${tag.slug}`,
      lastModified: newestDate(tag.items),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  assertUniquePaths(routes);

  return {
    routes,
    total: routes.length,
    latestModified: dates.site,
  };
}
