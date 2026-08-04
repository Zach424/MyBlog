import assert from "node:assert/strict";
import test from "node:test";

import { deriveKnowledgeGraph } from "../lib/content/knowledge-graph.ts";

function post(slug, body = "", publishedAt = "2026-08-05") {
  return {
    body,
    description: `${slug} article`,
    kind: "post",
    publishedAt,
    slug,
    title: `${slug} article`,
    url: `/posts/${slug}`,
  };
}

function project(slug, body = "", publishedAt = "2026-08-04") {
  return {
    body,
    description: `${slug} project`,
    kind: "project",
    publishedAt,
    slug,
    title: `${slug} project`,
    url: `/projects/${slug}`,
  };
}

test("derives directed edges, reciprocal references, and isolated nodes", () => {
  const records = [
    post("source", "[project](/projects/build)\n\n[duplicate](/projects/build)"),
    project("build", "[source](/posts/source)"),
    post("isolated", "没有站内引用。", "2026-08-03"),
  ];
  const graph = deriveKnowledgeGraph(records);
  const byUrl = Object.fromEntries(graph.nodes.map((node) => [node.url, node]));

  assert.deepEqual(graph.counts, {
    connected: 2,
    edges: 2,
    isolated: 1,
    nodes: 3,
    posts: 2,
    projects: 1,
  });
  assert.deepEqual(graph.edges, [
    { source: "/posts/source", target: "/projects/build" },
    { source: "/projects/build", target: "/posts/source" },
  ]);
  assert.deepEqual(byUrl["/posts/source"].outgoing, ["/projects/build"]);
  assert.deepEqual(byUrl["/posts/source"].backlinks, ["/projects/build"]);
  assert.equal(byUrl["/posts/source"].neighborCount, 1);
  assert.equal(byUrl["/posts/isolated"].isolated, true);
});

test("keeps graph order deterministic across repository input order", () => {
  const records = [
    project("zeta"),
    post("older", "", "2026-07-01"),
    post("newer", "", "2026-08-01"),
  ];
  const first = deriveKnowledgeGraph(records);
  const second = deriveKnowledgeGraph([...records].reverse());

  assert.deepEqual(first, second);
  assert.deepEqual(first.nodes.map((node) => node.url), [
    "/posts/newer",
    "/posts/older",
    "/projects/zeta",
  ]);
});

test("returns an explicit empty graph without inventing relationships", () => {
  assert.deepEqual(deriveKnowledgeGraph([]), {
    counts: {
      connected: 0,
      edges: 0,
      isolated: 0,
      nodes: 0,
      posts: 0,
      projects: 0,
    },
    edges: [],
    nodes: [],
  });
});
