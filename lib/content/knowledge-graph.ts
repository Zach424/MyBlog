import type { ContentRecord } from "./contract.ts";
import {
  deriveContentRelations,
  type ContentRelations,
} from "./relations.ts";

export type KnowledgeGraphNode = {
  backlinks: ContentRecord["url"][];
  description: string;
  isolated: boolean;
  kind: ContentRecord["kind"];
  neighborCount: number;
  outgoing: ContentRecord["url"][];
  publishedAt: string;
  slug: string;
  title: string;
  url: ContentRecord["url"];
};

export type KnowledgeGraphEdge = {
  source: ContentRecord["url"];
  target: ContentRecord["url"];
};

export type KnowledgeGraph = {
  counts: {
    connected: number;
    edges: number;
    isolated: number;
    nodes: number;
    posts: number;
    projects: number;
  };
  edges: KnowledgeGraphEdge[];
  nodes: KnowledgeGraphNode[];
};

function compareRecords(left: ContentRecord, right: ContentRecord) {
  return (
    Number(left.kind === "project") - Number(right.kind === "project") ||
    right.publishedAt.localeCompare(left.publishedAt) ||
    left.title.localeCompare(right.title, "zh-CN")
  );
}

export function deriveKnowledgeGraph(
  records: ContentRecord[],
  relations: ContentRelations = deriveContentRelations(records),
): KnowledgeGraph {
  const nodes = [...records].sort(compareRecords).map((record) => {
    const outgoing = (relations.outgoingByUrl.get(record.url) ?? []).map(
      (target) => target.url,
    );
    const backlinks = (relations.backlinksByUrl.get(record.url) ?? []).map(
      (source) => source.url,
    );
    const neighbors = new Set([...outgoing, ...backlinks]);
    return {
      backlinks,
      description: record.description,
      isolated: neighbors.size === 0,
      kind: record.kind,
      neighborCount: neighbors.size,
      outgoing,
      publishedAt: record.publishedAt,
      slug: record.slug,
      title: record.title,
      url: record.url,
    } satisfies KnowledgeGraphNode;
  });
  const edges = nodes
    .flatMap((node) =>
      node.outgoing.map((target) => ({ source: node.url, target })),
    )
    .sort(
      (left, right) =>
        left.source.localeCompare(right.source, "en") ||
        left.target.localeCompare(right.target, "en"),
    );
  const isolated = nodes.filter((node) => node.isolated).length;

  return {
    counts: {
      connected: nodes.length - isolated,
      edges: edges.length,
      isolated,
      nodes: nodes.length,
      posts: nodes.filter((node) => node.kind === "post").length,
      projects: nodes.filter((node) => node.kind === "project").length,
    },
    edges,
    nodes,
  };
}
