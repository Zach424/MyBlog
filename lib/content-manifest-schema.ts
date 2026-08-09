import {
  createSha256Etag,
  matchesIfNoneMatch,
  PUBLIC_CONDITIONAL_CACHE_CONTROL,
} from "./http-validators.ts";
import { absoluteSiteUrl, resolveSiteUrl } from "./site.ts";

export const CONTENT_MANIFEST_SCHEMA_DIALECT =
  "https://json-schema.org/draft/2020-12/schema" as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function createContentManifestSchemaDocument(siteUrl: URL) {
  const homeUrl = absoluteSiteUrl(siteUrl, "/");
  const manifestUrl = absoluteSiteUrl(siteUrl, "/content.json");
  const schemaUrl = absoluteSiteUrl(siteUrl, "/content.schema.json");
  const origin = escapeRegExp(new URL(homeUrl).origin);
  const slug = "[a-z0-9]+(?:-[a-z0-9]+)*";
  const htmlUrlPattern = `^${origin}/(?:posts|projects)/${slug}$`;
  const markdownUrlPattern = `^${origin}/(?:posts|projects)/${slug}/source\\.md$`;
  const datePattern = "^\\d{4}-\\d{2}-\\d{2}$";

  return {
    $schema: CONTENT_MANIFEST_SCHEMA_DIALECT,
    $id: schemaUrl,
    title: "MyBlog public content manifest",
    description:
      "Machine-verifiable structure for the MyBlog version 1 public content manifest.",
    type: "object",
    additionalProperties: false,
    required: ["version", "home_url", "manifest_url", "language", "items"],
    properties: {
      version: { const: 1 },
      home_url: { const: homeUrl },
      manifest_url: { const: manifestUrl },
      language: { const: "zh-CN" },
      items: {
        items: { $ref: "#/$defs/item" },
        type: "array",
        uniqueItems: true,
      },
    },
    $defs: {
      item: {
        type: "object",
        additionalProperties: false,
        required: [
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
        ],
        properties: {
          id: { pattern: htmlUrlPattern, type: "string" },
          kind: { enum: ["post", "project"] },
          type: { enum: ["article", "til", "project"] },
          title: { minLength: 1, type: "string" },
          html_url: { pattern: htmlUrlPattern, type: "string" },
          markdown_url: { pattern: markdownUrlPattern, type: "string" },
          markdown_etag: {
            pattern: '^"sha256-[0-9a-f]{64}"$',
            type: "string",
          },
          published_at: { pattern: datePattern, type: "string" },
          updated_at: { pattern: datePattern, type: "string" },
          reviewed_at: { pattern: datePattern, type: "string" },
          tags: {
            items: { minLength: 1, type: "string" },
            type: "array",
            uniqueItems: true,
          },
        },
        oneOf: [
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
        ],
      },
    },
  };
}

export function createContentManifestSchema(siteUrl: URL) {
  return `${JSON.stringify(createContentManifestSchemaDocument(siteUrl), null, 2)}\n`;
}

function contentManifestSchemaHeaders(siteUrl: URL, etag: string) {
  const homeUrl = absoluteSiteUrl(siteUrl, "/");
  const manifestUrl = absoluteSiteUrl(siteUrl, "/content.json");
  const schemaUrl = absoluteSiteUrl(siteUrl, "/content.schema.json");
  return new Headers({
    "cache-control": PUBLIC_CONDITIONAL_CACHE_CONTROL,
    "content-disposition": 'inline; filename="content.schema.json"',
    "content-type": "application/schema+json; charset=utf-8",
    etag,
    link: `<${schemaUrl}>; rel="self"; type="application/schema+json", <${manifestUrl}>; rel="describes"; type="application/json", <${homeUrl}>; rel="up"; type="text/html"`,
    "x-robots-tag": "noindex",
  });
}

export function createContentManifestSchemaResponse(request: Request) {
  const siteUrl = resolveSiteUrl(request.headers, request.url);
  const body = createContentManifestSchema(siteUrl);
  const etag = createSha256Etag(body);
  const headers = contentManifestSchemaHeaders(siteUrl, etag);

  return matchesIfNoneMatch(request.headers.get("if-none-match"), etag)
    ? new Response(null, { status: 304, headers })
    : new Response(body, { headers });
}
