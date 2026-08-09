import type {
  ContentManifestDocument,
  ContentManifestItem,
} from "../content-manifest.ts";
import { createContentManifestDocument } from "../content-manifest.ts";
import type { ContentRecord } from "./contract.ts";

export const PRODUCTION_CONTENT_SYNC_VERSION = 1;
export const PRODUCTION_CONTENT_SYNC_DEFAULTS = Object.freeze({
  maxBytes: 1_048_576,
  timeoutMs: 10_000,
});

const SHA256_ETAG_PATTERN = /^"sha256-[a-f0-9]{64}"$/u;
const RESPONSE_ETAG_PATTERN = /^(?:W\/)?"sha256-[a-f0-9]{64}"$/u;
const CONTENT_ROUTE_PATTERN = /^\/(posts|projects)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const PRODUCTION_STATES = ["deployed", "pending", "missing", "unexpected"] as const;

export type ProductionContentState = (typeof PRODUCTION_STATES)[number];
export type ProductionContentDifference =
  | "manifest-metadata"
  | "markdown-etag"
  | "missing-production"
  | "unexpected-production";

export interface ProductionContentSyncRecord {
  state: ProductionContentState;
  id: string;
  kind: "post" | "project";
  type: "article" | "project" | "til";
  title: string;
  sourcePath: string | null;
  markdownUrl: string;
  localEtag: string | null;
  productionEtag: string | null;
  differences: ProductionContentDifference[];
}

export interface ProductionContentSyncReport {
  version: typeof PRODUCTION_CONTENT_SYNC_VERSION;
  mode: "read-only";
  status: "attention" | "synchronized";
  checkedAt: string;
  origin: string;
  manifestUrl: string;
  localBuildDate: string;
  productionEtag: string;
  productionLastModified: string;
  counts: Record<ProductionContentState, number>;
  records: ProductionContentSyncRecord[];
  safety: {
    networkChecked: true;
    authorFilesChanged: false;
    commitCreated: false;
    pushExecuted: false;
  };
}

interface FetchProductionContentManifestOptions {
  fetchImpl?: typeof fetch;
  ifNoneMatch?: string;
  maxBytes?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type ProductionContentManifestFetchResult =
  | {
      status: "modified";
      etag: string;
      lastModified: string;
      manifest: ContentManifestDocument;
    }
  | {
      status: "not-modified";
      etag: string;
      lastModified: string;
      manifest: null;
    };

interface CompareProductionContentOptions {
  checkedAt: string;
  localBuildDate: string;
  localRecords: ContentRecord[];
  origin: URL;
  production: ContentManifestDocument;
  productionEtag: string;
  productionLastModified: string;
}

function valueError(label: string, expectation: string): never {
  throw new Error(`${label} ${expectation}`);
}

function assertPlainObject(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    valueError(label, "必须是对象");
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: string[],
  label: string,
) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    valueError(label, `字段必须严格为 ${expected.join(", ")}`);
  }
}

function assertNonEmptyString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    valueError(label, "必须是无首尾空白的非空字符串");
  }
}

function assertIsoDate(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    valueError(label, "必须是 YYYY-MM-DD 日期");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    valueError(label, "必须是有效日期");
  }
}

function normalizeOrigin(value: string | URL) {
  let candidate: URL;
  try {
    candidate = new URL(value instanceof URL ? value.href : value);
  } catch {
    throw new Error(`生产站点 origin 不是有效 URL：${String(value)}`);
  }
  const loopbackHosts = new Set(["127.0.0.1", "[::1]", "localhost"]);
  const loopback = loopbackHosts.has(candidate.hostname.toLowerCase());
  if (candidate.protocol !== "https:" && !(candidate.protocol === "http:" && loopback)) {
    throw new Error("生产站点 origin 必须使用 HTTPS；仅测试时允许 HTTP loopback");
  }
  if (
    candidate.username ||
    candidate.password ||
    candidate.pathname !== "/" ||
    candidate.search ||
    candidate.hash
  ) {
    throw new Error("生产站点 origin 只能包含协议、主机和可选端口");
  }
  return new URL(`${candidate.origin}/`);
}

export function resolveProductionOrigin(value: string | URL) {
  return normalizeOrigin(value);
}

function validateManifestItem(
  value: unknown,
  index: number,
  origin: URL,
): ContentManifestItem {
  const label = `生产清单 items[${index}]`;
  assertPlainObject(value, label);
  const hasUpdatedAt = Object.prototype.hasOwnProperty.call(value, "updated_at");
  assertExactKeys(
    value,
    [
      "html_url",
      "id",
      "kind",
      "markdown_etag",
      "markdown_url",
      "published_at",
      "reviewed_at",
      "tags",
      "title",
      "type",
      ...(hasUpdatedAt ? ["updated_at"] : []),
    ],
    label,
  );
  assertNonEmptyString(value.id, `${label}.id`);
  assertNonEmptyString(value.html_url, `${label}.html_url`);
  assertNonEmptyString(value.markdown_url, `${label}.markdown_url`);
  assertNonEmptyString(value.markdown_etag, `${label}.markdown_etag`);
  assertNonEmptyString(value.title, `${label}.title`);
  if (value.id !== value.html_url) {
    valueError(`${label}.id`, "必须与 html_url 完全一致");
  }

  let htmlUrl: URL;
  try {
    htmlUrl = new URL(value.html_url);
  } catch {
    throw new Error(`${label}.html_url 不是有效 URL`);
  }
  if (htmlUrl.origin !== origin.origin || htmlUrl.search || htmlUrl.hash) {
    valueError(`${label}.html_url`, `必须属于 ${origin.origin} 且不含查询或片段`);
  }
  const route = CONTENT_ROUTE_PATTERN.exec(htmlUrl.pathname);
  if (!route) {
    valueError(`${label}.html_url`, "必须是稳定的文章或项目路由");
  }
  const expectedKind = route[1] === "posts" ? "post" : "project";
  if (value.kind !== expectedKind) {
    valueError(`${label}.kind`, `必须是 ${expectedKind}`);
  }
  const supportedType = expectedKind === "post"
    ? value.type === "article" || value.type === "til"
    : value.type === "project";
  if (!supportedType) {
    valueError(`${label}.type`, "必须与 kind 一致");
  }
  if (value.markdown_url !== `${value.html_url}/source.md`) {
    valueError(`${label}.markdown_url`, "必须由 html_url 加 /source.md 得到");
  }
  if (!SHA256_ETAG_PATTERN.test(value.markdown_etag)) {
    valueError(`${label}.markdown_etag`, "必须是公开 Markdown 的强 SHA-256 ETag");
  }
  assertIsoDate(value.published_at, `${label}.published_at`);
  assertIsoDate(value.reviewed_at, `${label}.reviewed_at`);
  if (hasUpdatedAt) assertIsoDate(value.updated_at, `${label}.updated_at`);
  if (!Array.isArray(value.tags)) valueError(`${label}.tags`, "必须是数组");
  const tags = new Set<string>();
  for (const [tagIndex, tag] of value.tags.entries()) {
    assertNonEmptyString(tag, `${label}.tags[${tagIndex}]`);
    if (tags.has(tag)) valueError(`${label}.tags`, "不能包含重复标签");
    tags.add(tag);
  }

  return value as unknown as ContentManifestItem;
}

function validateProductionManifest(
  value: unknown,
  origin: URL,
): ContentManifestDocument {
  const label = "生产清单";
  assertPlainObject(value, label);
  assertExactKeys(
    value,
    ["home_url", "items", "language", "manifest_url", "version"],
    label,
  );
  if (value.version !== 1) valueError(`${label}.version`, "必须是 1");
  if (value.home_url !== origin.href) {
    valueError(`${label}.home_url`, `必须是 ${origin.href}`);
  }
  const manifestUrl = new URL("content.json", origin).href;
  if (value.manifest_url !== manifestUrl) {
    valueError(`${label}.manifest_url`, `必须是 ${manifestUrl}`);
  }
  if (value.language !== "zh-CN") valueError(`${label}.language`, "必须是 zh-CN");
  if (!Array.isArray(value.items)) valueError(`${label}.items`, "必须是数组");

  const items = value.items.map((item, index) =>
    validateManifestItem(item, index, origin),
  );
  const ids = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (ids.has(item.id)) valueError(`${label}.items[${index}].id`, "不能重复");
    ids.add(item.id);
  }
  const expectedOrder = items.slice().sort(
    (left, right) =>
      right.published_at.localeCompare(left.published_at) ||
      left.title.localeCompare(right.title, "zh-CN"),
  );
  if (expectedOrder.some((item, index) => item.id !== items[index].id)) {
    valueError(`${label}.items`, "必须按发布日期倒序及标题稳定排序");
  }

  return {
    version: 1,
    home_url: origin.href,
    manifest_url: manifestUrl,
    language: "zh-CN",
    items,
  };
}

function assertResponseMetadata(response: Response, maxBytes: number) {
  if (response.status !== 200) {
    throw new Error(`生产清单必须返回 HTTP 200，收到 ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    throw new Error(`生产清单 Content-Type 必须是 application/json，收到 ${contentType || "missing"}`);
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    if (!/^\d+$/u.test(contentLength)) {
      throw new Error("生产清单 Content-Length 不是有效非负整数");
    }
    if (Number(contentLength) > maxBytes) {
      throw new Error(`生产清单超过 ${maxBytes} 字节上限`);
    }
  }
  const etag = response.headers.get("etag");
  if (!etag || !RESPONSE_ETAG_PATTERN.test(etag)) {
    throw new Error("生产清单响应缺少受支持的 SHA-256 ETag");
  }
  const lastModified = response.headers.get("last-modified");
  if (!lastModified || Number.isNaN(Date.parse(lastModified))) {
    throw new Error("生产清单响应缺少有效 Last-Modified");
  }
  return { etag, lastModified };
}

function opaqueEtag(value: string) {
  return value.startsWith("W/") ? value.slice(2) : value;
}

function assertNotModifiedResponseMetadata(
  response: Response,
  ifNoneMatch: string,
) {
  if (response.status !== 304) {
    throw new Error(`生产清单必须返回 HTTP 200 或条件命中的 304，收到 ${response.status}`);
  }
  const etag = response.headers.get("etag");
  if (!etag || !RESPONSE_ETAG_PATTERN.test(etag)) {
    throw new Error("生产清单 304 响应缺少受支持的 SHA-256 ETag");
  }
  if (opaqueEtag(etag) !== opaqueEtag(ifNoneMatch)) {
    throw new Error("生产清单 304 响应 ETag 与条件请求不一致");
  }
  const lastModified = response.headers.get("last-modified");
  if (!lastModified || Number.isNaN(Date.parse(lastModified))) {
    throw new Error("生产清单 304 响应缺少有效 Last-Modified");
  }
  return { etag, lastModified };
}

async function readBoundedResponseBody(response: Response, maxBytes: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel("production manifest byte ceiling crossed");
        throw new Error(`生产清单超过 ${maxBytes} 字节上限`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("生产清单正文不是有效 UTF-8");
  }
}

export async function fetchProductionContentManifestConditional(
  originValue: string | URL,
  options: FetchProductionContentManifestOptions = {},
): Promise<ProductionContentManifestFetchResult> {
  const origin = normalizeOrigin(originValue);
  const timeoutMs = options.timeoutMs ?? PRODUCTION_CONTENT_SYNC_DEFAULTS.timeoutMs;
  const maxBytes = options.maxBytes ?? PRODUCTION_CONTENT_SYNC_DEFAULTS.maxBytes;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new Error("生产清单 timeoutMs 必须是 1–30000 的整数");
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 10_485_760) {
    throw new Error("生产清单 maxBytes 必须是 1–10485760 的整数");
  }
  if (
    options.ifNoneMatch !== undefined &&
    !RESPONSE_ETAG_PATTERN.test(options.ifNoneMatch)
  ) {
    throw new Error("生产清单 ifNoneMatch 必须是受支持的 SHA-256 ETag");
  }
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) {
    abortFromCaller();
  } else {
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(new URL("content.json", origin), {
      headers: {
        accept: "application/json",
        ...(options.ifNoneMatch ? { "if-none-match": options.ifNoneMatch } : {}),
        "user-agent": `MyBlog-Production-Sync/${PRODUCTION_CONTENT_SYNC_VERSION}`,
      },
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status === 304 && options.ifNoneMatch) {
      const { etag, lastModified } = assertNotModifiedResponseMetadata(
        response,
        options.ifNoneMatch,
      );
      return {
        status: "not-modified",
        etag,
        lastModified,
        manifest: null,
      };
    }
    const { etag, lastModified } = assertResponseMetadata(response, maxBytes);
    const body = await readBoundedResponseBody(response, maxBytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error("生产清单不是有效 JSON");
    }
    return {
      status: "modified",
      etag,
      lastModified,
      manifest: validateProductionManifest(parsed, origin),
    };
  } catch (error) {
    if (timedOut) {
      throw new Error(`生产清单请求在 ${timeoutMs}ms 后超时`);
    }
    if (options.signal?.aborted) throw new Error("生产清单请求已取消");
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function fetchProductionContentManifest(
  originValue: string | URL,
  options: Omit<FetchProductionContentManifestOptions, "ifNoneMatch"> = {},
) {
  const result = await fetchProductionContentManifestConditional(originValue, options);
  if (result.status !== "modified") {
    throw new Error("无条件生产清单请求不得返回 304");
  }
  return {
    etag: result.etag,
    lastModified: result.lastModified,
    manifest: result.manifest,
  };
}

function metadataWithoutEtag(item: ContentManifestItem) {
  return {
    id: item.id,
    kind: item.kind,
    type: item.type,
    title: item.title,
    html_url: item.html_url,
    markdown_url: item.markdown_url,
    published_at: item.published_at,
    ...(item.updated_at ? { updated_at: item.updated_at } : {}),
    reviewed_at: item.reviewed_at,
    tags: item.tags,
  };
}

export function compareProductionContent(
  options: CompareProductionContentOptions,
): ProductionContentSyncReport {
  const origin = normalizeOrigin(options.origin);
  assertIsoDate(options.localBuildDate, "本地构建日期");
  const checkedAt = new Date(options.checkedAt);
  if (Number.isNaN(checkedAt.getTime()) || checkedAt.toISOString() !== options.checkedAt) {
    throw new Error("检查时间必须是规范 ISO 时间戳");
  }
  if (!RESPONSE_ETAG_PATTERN.test(options.productionEtag)) {
    throw new Error("生产清单响应 ETag 不受支持");
  }
  if (Number.isNaN(Date.parse(options.productionLastModified))) {
    throw new Error("生产清单 Last-Modified 无效");
  }

  const local = createContentManifestDocument(origin, options.localRecords);
  const productionById = new Map(options.production.items.map((item) => [item.id, item]));
  const sourceById = new Map(
    options.localRecords.map((record) => [new URL(record.url, origin).href, record.sourcePath]),
  );
  const records: ProductionContentSyncRecord[] = [];

  for (const item of local.items) {
    const remote = productionById.get(item.id);
    if (!remote) {
      records.push({
        state: "missing",
        id: item.id,
        kind: item.kind,
        type: item.type,
        title: item.title,
        sourcePath: sourceById.get(item.id) ?? null,
        markdownUrl: item.markdown_url,
        localEtag: item.markdown_etag,
        productionEtag: null,
        differences: ["missing-production"],
      });
      continue;
    }
    productionById.delete(item.id);
    const differences: ProductionContentDifference[] = [];
    if (item.markdown_etag !== remote.markdown_etag) {
      differences.push("markdown-etag");
    }
    if (
      JSON.stringify(metadataWithoutEtag(item)) !==
      JSON.stringify(metadataWithoutEtag(remote))
    ) {
      differences.push("manifest-metadata");
    }
    records.push({
      state: differences.length === 0 ? "deployed" : "pending",
      id: item.id,
      kind: item.kind,
      type: item.type,
      title: item.title,
      sourcePath: sourceById.get(item.id) ?? null,
      markdownUrl: item.markdown_url,
      localEtag: item.markdown_etag,
      productionEtag: remote.markdown_etag,
      differences,
    });
  }

  for (const item of [...productionById.values()].sort((left, right) =>
    left.id.localeCompare(right.id, "en"),
  )) {
    records.push({
      state: "unexpected",
      id: item.id,
      kind: item.kind,
      type: item.type,
      title: item.title,
      sourcePath: null,
      markdownUrl: item.markdown_url,
      localEtag: null,
      productionEtag: item.markdown_etag,
      differences: ["unexpected-production"],
    });
  }

  const counts = Object.fromEntries(
    PRODUCTION_STATES.map((state) => [
      state,
      records.filter((record) => record.state === state).length,
    ]),
  ) as Record<ProductionContentState, number>;
  const status = counts.pending + counts.missing + counts.unexpected === 0
    ? "synchronized"
    : "attention";

  return {
    version: PRODUCTION_CONTENT_SYNC_VERSION,
    mode: "read-only",
    status,
    checkedAt: options.checkedAt,
    origin: origin.origin,
    manifestUrl: new URL("content.json", origin).href,
    localBuildDate: options.localBuildDate,
    productionEtag: options.productionEtag,
    productionLastModified: options.productionLastModified,
    counts,
    records,
    safety: {
      networkChecked: true,
      authorFilesChanged: false,
      commitCreated: false,
      pushExecuted: false,
    },
  };
}

const STATE_LABELS: Record<ProductionContentState, string> = {
  deployed: "已上线",
  pending: "待部署",
  missing: "生产缺失",
  unexpected: "生产多出",
};

export function formatProductionContentSyncText(report: ProductionContentSyncReport) {
  const lines = [
    `生产内容同步 · ${report.status === "synchronized" ? "SYNCHRONIZED" : "ATTENTION"}`,
    `检查时间：${report.checkedAt}`,
    `生产清单：${report.manifestUrl}`,
    `本地内容日期：${report.localBuildDate}`,
    `生产快照：${report.productionEtag} · ${report.productionLastModified}`,
    `汇总：${report.counts.deployed} 已上线 · ${report.counts.pending} 待部署 · ${report.counts.missing} 生产缺失 · ${report.counts.unexpected} 生产多出`,
    "边界：只读取本地正式内容并请求生产 content.json；不会改写文章、提交或推送。",
  ];
  for (const record of report.records) {
    lines.push(
      "",
      `[${STATE_LABELS[record.state]}] ${record.title}`,
      `  ${record.sourcePath ?? record.id}`,
      `  local=${record.localEtag ?? "none"}`,
      `  production=${record.productionEtag ?? "none"}`,
      ...(record.differences.length > 0
        ? [`  differences=${record.differences.join(",")}`]
        : []),
    );
  }
  return lines.join("\n");
}
