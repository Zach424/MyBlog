import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CONTENT_MANIFEST_SCHEMA_DIALECT,
  createContentManifestSchema,
  createContentManifestSchemaDocument,
  createContentManifestSchemaResponse,
} from "../lib/content-manifest-schema.ts";
import { createContentManifestDocument } from "../lib/content-manifest.ts";

function sha256Etag(body) {
  return `"sha256-${createHash("sha256").update(body, "utf8").digest("hex")}"`;
}

const post = {
  body: "## Schema source\n\nPortable record.",
  description: "A manifest schema fixture.",
  draft: false,
  featured: true,
  freshness: "current",
  kind: "post",
  publishedAt: "2026-08-09",
  reviewedAt: "2026-08-10",
  slug: "schema-source",
  sourcePath: "content/posts/schema-source.md",
  tags: ["TypeScript", "Obsidian"],
  title: "Schema source",
  type: "article",
  updatedAt: "2026-08-10",
  url: "/posts/schema-source",
};

const project = {
  body: "## Project schema\n\nProject record.",
  description: "A project schema fixture.",
  draft: false,
  featured: false,
  freshness: "historical",
  kind: "project",
  publishedAt: "2026-08-01",
  reviewedAt: "2026-08-09",
  slug: "schema-project",
  sourcePath: "content/projects/schema-project.md",
  stack: ["TypeScript"],
  status: "maintained",
  tags: ["TypeScript"],
  title: "Schema project",
  url: "/projects/schema-project",
};

test("creates one deterministic Draft 2020-12 schema for the public manifest", () => {
  const schema = JSON.parse(
    createContentManifestSchema(new URL("https://blog.example.test")),
  );

  assert.deepEqual(Object.keys(schema), [
    "$schema",
    "$id",
    "title",
    "description",
    "type",
    "additionalProperties",
    "required",
    "properties",
    "$defs",
  ]);
  assert.equal(schema.$schema, CONTENT_MANIFEST_SCHEMA_DIALECT);
  assert.equal(
    schema.$id,
    "https://blog.example.test/content.schema.json",
  );
  assert.deepEqual(schema.required, [
    "version",
    "home_url",
    "manifest_url",
    "language",
    "items",
  ]);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.version, { const: 1 });
  assert.deepEqual(schema.properties.home_url, {
    const: "https://blog.example.test/",
  });
  assert.deepEqual(schema.properties.manifest_url, {
    const: "https://blog.example.test/content.json",
  });
  assert.deepEqual(schema.properties.language, { const: "zh-CN" });
  assert.deepEqual(schema.properties.items, {
    items: { $ref: "#/$defs/item" },
    type: "array",
    uniqueItems: true,
  });

  const item = schema.$defs.item;
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(item.required, [
    "id",
    "kind",
    "type",
    "title",
    "html_url",
    "markdown_url",
    "markdown_etag",
    "published_at",
    "reviewed_at",
    "tags",
  ]);
  assert.equal(item.properties.updated_at.pattern, "^\\d{4}-\\d{2}-\\d{2}$");
  assert.equal(
    item.properties.markdown_etag.pattern,
    '^"sha256-[0-9a-f]{64}"$',
  );
  assert.deepEqual(item.oneOf, [
    {
      properties: {
        kind: { const: "post" },
        type: { enum: ["article", "til"] },
      },
      required: ["kind", "type"],
    },
    {
      properties: {
        kind: { const: "project" },
        type: { const: "project" },
      },
      required: ["kind", "type"],
    },
  ]);
});

test("returns a conditional schema response linked to its manifest", async () => {
  const url = "https://blog.example.test/content.schema.json";
  const baseline = createContentManifestSchemaResponse(new Request(url));
  const body = await baseline.text();
  const etag = baseline.headers.get("etag");

  assert.equal(baseline.status, 200);
  assert.equal(etag, sha256Etag(body));
  assert.equal(
    baseline.headers.get("content-type"),
    "application/schema+json; charset=utf-8",
  );
  assert.equal(
    baseline.headers.get("content-disposition"),
    'inline; filename="content.schema.json"',
  );
  assert.equal(
    baseline.headers.get("cache-control"),
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );
  assert.equal(
    baseline.headers.get("link"),
    '<https://blog.example.test/content.schema.json>; rel="self"; type="application/schema+json", <https://blog.example.test/content.json>; rel="describes"; type="application/json", <https://blog.example.test/>; rel="up"; type="text/html"',
  );
  assert.equal(baseline.headers.get("x-robots-tag"), "noindex");

  const conditional = createContentManifestSchemaResponse(
    new Request(url, { headers: { "if-none-match": `W/${etag}` } }),
  );
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
  assert.equal(conditional.headers.get("etag"), etag);
  assert.equal(conditional.headers.get("link"), baseline.headers.get("link"));
});

test("validates the real manifest shape and rejects structural drift", () => {
  const siteUrl = new URL("https://blog.example.test");
  const schema = createContentManifestSchemaDocument(siteUrl);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const manifest = createContentManifestDocument(siteUrl, [project, post]);

  assert.equal(validate(manifest), true, JSON.stringify(validate.errors));

  const cases = [
    ["unknown top-level field", (value) => { value.unknown = true; }],
    ["missing reviewed date", (value) => { delete value.items[0].reviewed_at; }],
    ["wrong kind/type pair", (value) => { value.items[0].type = "project"; }],
    ["foreign content origin", (value) => { value.items[0].id = "https://other.example/posts/schema-source"; }],
    ["unsafe Markdown URL", (value) => { value.items[0].markdown_url = "http://blog.example.test/posts/schema-source/source.md"; }],
    ["malformed Markdown ETag", (value) => { value.items[0].markdown_etag = '"sha256-short"'; }],
    ["malformed calendar token", (value) => { value.items[0].published_at = "2026/08/09"; }],
    ["duplicate tag", (value) => { value.items[0].tags = ["TypeScript", "TypeScript"]; }],
    ["unknown item field", (value) => { value.items[0].body = "private"; }],
  ];

  for (const [label, mutate] of cases) {
    const candidate = structuredClone(manifest);
    mutate(candidate);
    assert.equal(validate(candidate), false, label);
  }
});
