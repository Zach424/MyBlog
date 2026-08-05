import { lookup as lookupDns } from "node:dns/promises";
import { request as requestHttps } from "node:https";
import { BlockList, isIP } from "node:net";
import type { ContentRecord } from "./contract.ts";
import {
  parseMarkdown,
  walkMarkdown,
  type MarkdownNode,
} from "./markdown.ts";

export const EXTERNAL_LINK_CHECK_DEFAULTS = {
  concurrency: 4,
  maxRedirects: 5,
  retries: 1,
  timeoutMs: 5_000,
} as const;

export const EXTERNAL_LINK_HEALTH_STATUSES = [
  "healthy",
  "restricted",
  "method-unsupported",
  "missing",
  "client-error",
  "server-error",
  "timeout",
  "network-error",
  "unsafe",
  "redirect-error",
] as const;

export type ExternalLinkHealthStatus =
  (typeof EXTERNAL_LINK_HEALTH_STATUSES)[number];

export type ExternalLinkIssueCode =
  | "credentials"
  | "insecure-http"
  | "invalid-https"
  | "protocol-relative";

export type ExternalLinkSourceField =
  | "body"
  | "canonical"
  | "demo"
  | "repository";

export type ExternalLinkOccurrence = {
  bodyLine?: number;
  label: string;
  sourceField: ExternalLinkSourceField;
  sourcePath: string;
  sourceTitle: string;
  sourceUrl: ContentRecord["url"];
};

export type ExternalLinkIssue = ExternalLinkOccurrence & {
  code: ExternalLinkIssueCode;
  url: string;
};

export type ExternalLinkHealth = {
  attempts: number;
  checkedUrl: string;
  detail: string;
  durationMs: number;
  finalUrl: string;
  redirects: string[];
  status: ExternalLinkHealthStatus;
  statusCode?: number;
};

export type ExternalLinkEntry = {
  health?: ExternalLinkHealth;
  occurrenceCount: number;
  occurrences: ExternalLinkOccurrence[];
  sourceCount: number;
  url: string;
};

export type ExternalLinkReport = {
  checked: boolean;
  checkOptions?: ExternalLinkCheckSettings;
  counts: {
    attention: number;
    broken: number;
    checked: number;
    healthy: number;
    issues: number;
    occurrences: number;
    records: number;
    sourceRecords: number;
    uniqueUrls: number;
  };
  issues: ExternalLinkIssue[];
  links: ExternalLinkEntry[];
};

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type ExternalLinkProbeResponse = {
  location?: string;
  statusCode: number;
};

export type ExternalLinkCheckDependencies = {
  guardTarget?: (target: URL, addressIndex: number) => Promise<ResolvedAddress>;
  probeHead?: (
    target: URL,
    address: ResolvedAddress,
    timeoutMs: number,
  ) => Promise<ExternalLinkProbeResponse>;
  wait?: (milliseconds: number) => Promise<void>;
};

export type ExternalLinkCheckSettings = {
  concurrency: number;
  maxRedirects: number;
  retries: number;
  timeoutMs: number;
};

export type ExternalLinkCheckOptions = Partial<ExternalLinkCheckSettings> &
  ExternalLinkCheckDependencies;

class UnsafeExternalTargetError extends Error {}
class ExternalLinkTimeoutError extends Error {}

const BLOCKED_IPV4_NETWORKS = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED_IPV4_NETWORKS.addSubnet(network, prefix, "ipv4");
}
const BLOCKED_IPV6_NETWORKS = new BlockList();
for (const [network, prefix] of [
  ["::", 96],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED_IPV6_NETWORKS.addSubnet(network, prefix, "ipv6");
}

function markdownText(node: MarkdownNode): string {
  if (node.value) return node.value;
  return (node.children ?? []).map(markdownText).join("");
}

function compactText(value: string, maxLength = 180) {
  const compact = value.replace(/[\u0000-\u001f\u007f]+/gu, " ").replace(/\s+/gu, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function safeDisplayUrl(value: string) {
  const compact = compactText(value, 320);
  try {
    const url = new URL(compact);
    if (url.username || url.password) {
      url.username = "";
      url.password = "";
    }
    return url.href;
  } catch {
    return compact;
  }
}

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("//")) {
    return { issue: "protocol-relative" as const, url: safeDisplayUrl(trimmed) };
  }
  if (/^http:\/\//iu.test(trimmed)) {
    return { issue: "insecure-http" as const, url: safeDisplayUrl(trimmed) };
  }
  if (!/^https:/iu.test(trimmed)) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { issue: "invalid-https" as const, url: safeDisplayUrl(trimmed) };
  }
  if (url.username || url.password) {
    return { issue: "credentials" as const, url: safeDisplayUrl(trimmed) };
  }
  return { url: url.href };
}

function occurrenceFor(
  record: ContentRecord,
  sourceField: ExternalLinkSourceField,
  label: string,
  bodyLine?: number,
): ExternalLinkOccurrence {
  return {
    ...(bodyLine ? { bodyLine } : {}),
    label,
    sourceField,
    sourcePath: record.sourcePath,
    sourceTitle: record.title,
    sourceUrl: record.url,
  };
}

function extractRecordExternalLinks(record: ContentRecord) {
  const tree = parseMarkdown(record.body);
  const definitions = new Map<string, string>();
  walkMarkdown(tree, (node) => {
    if (node.type === "definition" && node.identifier && node.url) {
      definitions.set(node.identifier, node.url);
    }
  });

  const links: Array<{ occurrence: ExternalLinkOccurrence; url: string }> = [];
  const issues: ExternalLinkIssue[] = [];
  walkMarkdown(tree, (node) => {
    const value = node.type === "link"
      ? node.url
      : node.type === "linkReference" && node.identifier
        ? definitions.get(node.identifier)
        : undefined;
    if (!value) return;
    const normalized = normalizeExternalUrl(value);
    if (!normalized) return;
    const occurrence = occurrenceFor(
      record,
      "body",
      compactText(markdownText(node)) || "未命名链接",
      node.position?.start?.line,
    );
    if (normalized.issue) {
      issues.push({ ...occurrence, code: normalized.issue, url: normalized.url });
      return;
    }
    links.push({ occurrence, url: normalized.url });
  });

  const structuredFields: Array<
    [Exclude<ExternalLinkSourceField, "body">, string | null | undefined]
  > = record.kind === "post"
    ? [["canonical", record.canonical]]
    : [
        ["repository", record.repository],
        ["demo", record.demo],
      ];
  for (const [sourceField, value] of structuredFields) {
    if (!value) continue;
    const normalized = normalizeExternalUrl(value);
    if (!normalized) continue;
    const occurrence = occurrenceFor(record, sourceField, sourceField);
    if (normalized.issue) {
      issues.push({ ...occurrence, code: normalized.issue, url: normalized.url });
      continue;
    }
    links.push({ occurrence, url: normalized.url });
  }
  return { issues, links };
}

const SOURCE_FIELD_ORDER: Record<ExternalLinkSourceField, number> = {
  body: 0,
  canonical: 1,
  repository: 2,
  demo: 3,
};

function sortOccurrences(occurrences: ExternalLinkOccurrence[]) {
  return [...occurrences].sort(
    (left, right) =>
      left.sourcePath.localeCompare(right.sourcePath, "en") ||
      SOURCE_FIELD_ORDER[left.sourceField] - SOURCE_FIELD_ORDER[right.sourceField] ||
      (left.bodyLine ?? Number.MAX_SAFE_INTEGER) -
        (right.bodyLine ?? Number.MAX_SAFE_INTEGER) ||
      left.label.localeCompare(right.label, "zh-CN"),
  );
}

export function createExternalLinkInventory(records: ContentRecord[]): ExternalLinkReport {
  const linksByUrl = new Map<string, ExternalLinkOccurrence[]>();
  const issues: ExternalLinkIssue[] = [];
  for (const record of records) {
    const extracted = extractRecordExternalLinks(record);
    issues.push(...extracted.issues);
    for (const link of extracted.links) {
      const occurrences = linksByUrl.get(link.url) ?? [];
      occurrences.push(link.occurrence);
      linksByUrl.set(link.url, occurrences);
    }
  }

  const links = [...linksByUrl]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map<ExternalLinkEntry>(([url, unsortedOccurrences]) => {
      const occurrences = sortOccurrences(unsortedOccurrences);
      return {
        occurrenceCount: occurrences.length,
        occurrences,
        sourceCount: new Set(occurrences.map((entry) => entry.sourcePath)).size,
        url,
      };
    });
  issues.sort(
    (left, right) =>
      left.sourcePath.localeCompare(right.sourcePath, "en") ||
      SOURCE_FIELD_ORDER[left.sourceField] - SOURCE_FIELD_ORDER[right.sourceField] ||
      (left.bodyLine ?? Number.MAX_SAFE_INTEGER) -
        (right.bodyLine ?? Number.MAX_SAFE_INTEGER) ||
      left.url.localeCompare(right.url, "en"),
  );
  const sourceRecords = new Set(
    links.flatMap((link) => link.occurrences.map((entry) => entry.sourcePath)),
  );

  return {
    checked: false,
    counts: {
      attention: 0,
      broken: 0,
      checked: 0,
      healthy: 0,
      issues: issues.length,
      occurrences: links.reduce((total, link) => total + link.occurrenceCount, 0),
      records: records.length,
      sourceRecords: sourceRecords.size,
      uniqueUrls: links.length,
    },
    issues,
    links,
  };
}

export function isPublicNetworkAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !BLOCKED_IPV4_NETWORKS.check(address, "ipv4");
  if (family === 6) return !BLOCKED_IPV6_NETWORKS.check(address, "ipv6");
  return false;
}

function targetHostname(target: URL) {
  return target.hostname.startsWith("[") && target.hostname.endsWith("]")
    ? target.hostname.slice(1, -1)
    : target.hostname;
}

export async function guardExternalLinkTarget(
  target: URL,
  lookup: typeof lookupDns = lookupDns,
  addressIndex = 0,
): Promise<ResolvedAddress> {
  if (target.protocol !== "https:") {
    throw new UnsafeExternalTargetError("目标必须保持 HTTPS，拒绝协议降级");
  }
  if (target.username || target.password) {
    throw new UnsafeExternalTargetError("目标不能包含用户名或密码");
  }
  if (target.port && target.port !== "443") {
    throw new UnsafeExternalTargetError("目标只能使用默认 HTTPS 端口 443");
  }
  const hostname = targetHostname(target);
  const lowered = hostname.toLowerCase();
  if (
    lowered === "localhost" ||
    lowered.endsWith(".localhost") ||
    lowered.endsWith(".local") ||
    lowered.endsWith(".internal") ||
    lowered.endsWith(".home.arpa")
  ) {
    throw new UnsafeExternalTargetError("目标主机属于本地或内部命名空间");
  }

  const directFamily = isIP(hostname);
  const addresses = directFamily
    ? [{ address: hostname, family: directFamily as 4 | 6 }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("DNS 没有返回地址");
  if (addresses.some((entry) => !isPublicNetworkAddress(entry.address))) {
    throw new UnsafeExternalTargetError("DNS 结果包含私网、回环、链路本地或保留地址");
  }
  const orderedAddresses = [...addresses].sort(
    (left, right) =>
      left.family - right.family || left.address.localeCompare(right.address, "en"),
  ) as ResolvedAddress[];
  return orderedAddresses[addressIndex % orderedAddresses.length];
}

function probeHead(
  target: URL,
  address: ResolvedAddress,
  timeoutMs: number,
): Promise<ExternalLinkProbeResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = requestHttps(
      {
        headers: {
          accept: "*/*",
          host: target.host,
          "user-agent": "Zach424-Link-Inventory/1.0 (+https://github.com/Zach424/MyBlog)",
        },
        hostname: address.address,
        method: "HEAD",
        path: `${target.pathname}${target.search}`,
        port: 443,
        protocol: "https:",
        servername: targetHostname(target),
      },
      (response) => {
        if (settled) return;
        settled = true;
        const location = Array.isArray(response.headers.location)
          ? response.headers.location[0]
          : response.headers.location;
        const statusCode = response.statusCode ?? 0;
        response.destroy();
        resolve({ ...(location ? { location } : {}), statusCode });
      },
    );
    request.setTimeout(timeoutMs, () => {
      request.destroy(new ExternalLinkTimeoutError(`HEAD 超过 ${timeoutMs}ms`));
    });
    request.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    request.end();
  });
}

function healthForStatus(statusCode: number): Pick<ExternalLinkHealth, "detail" | "status"> {
  if (statusCode >= 200 && statusCode < 300) {
    return { detail: `HEAD ${statusCode}`, status: "healthy" };
  }
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
    return { detail: `HEAD ${statusCode}，目标存在但限制自动检查`, status: "restricted" };
  }
  if (statusCode === 405 || statusCode === 501) {
    return { detail: `HEAD ${statusCode}，目标不支持无正文检查`, status: "method-unsupported" };
  }
  if (statusCode === 404 || statusCode === 410) {
    return { detail: `HEAD ${statusCode}，目标不存在`, status: "missing" };
  }
  if (statusCode >= 400 && statusCode < 500) {
    return { detail: `HEAD ${statusCode}，客户端错误`, status: "client-error" };
  }
  if (statusCode >= 500) {
    return { detail: `HEAD ${statusCode}，服务端错误`, status: "server-error" };
  }
  return { detail: `HEAD ${statusCode}，重定向缺少有效 Location`, status: "redirect-error" };
}

function isRedirect(statusCode: number) {
  return [300, 301, 302, 303, 307, 308].includes(statusCode);
}

async function probeExternalLink(
  authoredUrl: string,
  settings: ExternalLinkCheckSettings,
  dependencies: Required<ExternalLinkCheckDependencies>,
  addressIndex: number,
) {
  let current = new URL(authoredUrl);
  const redirects: string[] = [];
  for (let redirectCount = 0; ; redirectCount += 1) {
    const address = await dependencies.guardTarget(current, addressIndex);
    const response = await dependencies.probeHead(
      current,
      address,
      settings.timeoutMs,
    );
    if (!isRedirect(response.statusCode)) {
      return {
        ...healthForStatus(response.statusCode),
        finalUrl: current.href,
        redirects,
        statusCode: response.statusCode,
      };
    }
    if (!response.location) {
      return {
        detail: `HEAD ${response.statusCode}，重定向缺少 Location`,
        finalUrl: current.href,
        redirects,
        status: "redirect-error" as const,
        statusCode: response.statusCode,
      };
    }
    if (redirectCount >= settings.maxRedirects) {
      return {
        detail: `重定向超过 ${settings.maxRedirects} 次上限`,
        finalUrl: current.href,
        redirects,
        status: "redirect-error" as const,
        statusCode: response.statusCode,
      };
    }
    let next: URL;
    try {
      next = new URL(response.location, current);
    } catch {
      return {
        detail: "重定向 Location 不是有效 URL",
        finalUrl: current.href,
        redirects,
        status: "redirect-error" as const,
        statusCode: response.statusCode,
      };
    }
    redirects.push(next.href);
    current = next;
  }
}

function shouldRetry(status: ExternalLinkHealthStatus, statusCode?: number) {
  return (
    status === "timeout" ||
    status === "network-error" ||
    status === "server-error" ||
    statusCode === 408 ||
    statusCode === 429
  );
}

function normalizeCheckSettings(options: ExternalLinkCheckOptions): ExternalLinkCheckSettings {
  const settings = {
    concurrency: options.concurrency ?? EXTERNAL_LINK_CHECK_DEFAULTS.concurrency,
    maxRedirects: options.maxRedirects ?? EXTERNAL_LINK_CHECK_DEFAULTS.maxRedirects,
    retries: options.retries ?? EXTERNAL_LINK_CHECK_DEFAULTS.retries,
    timeoutMs: options.timeoutMs ?? EXTERNAL_LINK_CHECK_DEFAULTS.timeoutMs,
  };
  if (!Number.isInteger(settings.concurrency) || settings.concurrency < 1 || settings.concurrency > 8) {
    throw new Error("外链检查 concurrency 必须是 1–8 的整数");
  }
  if (!Number.isInteger(settings.maxRedirects) || settings.maxRedirects < 0 || settings.maxRedirects > 10) {
    throw new Error("外链检查 maxRedirects 必须是 0–10 的整数");
  }
  if (!Number.isInteger(settings.retries) || settings.retries < 0 || settings.retries > 2) {
    throw new Error("外链检查 retries 必须是 0–2 的整数");
  }
  if (!Number.isInteger(settings.timeoutMs) || settings.timeoutMs < 500 || settings.timeoutMs > 30_000) {
    throw new Error("外链检查 timeoutMs 必须是 500–30000 的整数");
  }
  return settings;
}

function errorHealth(error: unknown, finalUrl: string) {
  if (error instanceof UnsafeExternalTargetError) {
    return { detail: error.message, finalUrl, redirects: [], status: "unsafe" as const };
  }
  const errorCode = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  if (
    error instanceof ExternalLinkTimeoutError ||
    ["ABORT_ERR", "ERR_HTTP_REQUEST_TIMEOUT", "ETIMEDOUT"].includes(errorCode)
  ) {
    return {
      detail: error instanceof Error ? error.message : "HEAD 请求超时",
      finalUrl,
      redirects: [],
      status: "timeout" as const,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    detail: compactText(message, 240) || "未知网络错误",
    finalUrl,
    redirects: [],
    status: "network-error" as const,
  };
}

async function checkOneLink(
  entry: ExternalLinkEntry,
  settings: ExternalLinkCheckSettings,
  dependencies: Required<ExternalLinkCheckDependencies>,
): Promise<ExternalLinkEntry> {
  const startedAt = performance.now();
  let attempts = 0;
  let result: Omit<ExternalLinkHealth, "attempts" | "checkedUrl" | "durationMs">;
  while (true) {
    attempts += 1;
    try {
      result = await probeExternalLink(
        entry.url,
        settings,
        dependencies,
        attempts - 1,
      );
    } catch (error) {
      result = errorHealth(error, entry.url);
    }
    if (attempts > settings.retries || !shouldRetry(result.status, result.statusCode)) break;
    await dependencies.wait(Math.min(250 * 2 ** (attempts - 1), 1_000));
  }
  return {
    ...entry,
    health: {
      ...result,
      attempts,
      checkedUrl: entry.url,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    },
  };
}

const BROKEN_HEALTH = new Set<ExternalLinkHealthStatus>([
  "missing",
  "client-error",
  "unsafe",
  "redirect-error",
]);

export async function checkExternalLinks(
  inventory: ExternalLinkReport,
  options: ExternalLinkCheckOptions = {},
): Promise<ExternalLinkReport> {
  const settings = normalizeCheckSettings(options);
  const dependencies: Required<ExternalLinkCheckDependencies> = {
    guardTarget:
      options.guardTarget ??
      ((target, addressIndex) =>
        guardExternalLinkTarget(target, lookupDns, addressIndex)),
    probeHead: options.probeHead ?? probeHead,
    wait: options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
  };
  const links = new Array<ExternalLinkEntry>(inventory.links.length);
  let cursor = 0;
  const workerCount = Math.min(settings.concurrency, inventory.links.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < inventory.links.length) {
        const index = cursor;
        cursor += 1;
        links[index] = await checkOneLink(inventory.links[index], settings, dependencies);
      }
    }),
  );
  const health = links.map((entry) => entry.health).filter((entry) => entry !== undefined);
  const broken = health.filter((entry) => BROKEN_HEALTH.has(entry.status)).length;
  const healthy = health.filter((entry) => entry.status === "healthy").length;

  return {
    ...inventory,
    checked: true,
    checkOptions: settings,
    counts: {
      ...inventory.counts,
      attention: health.length - healthy - broken,
      broken,
      checked: health.length,
      healthy,
    },
    links,
  };
}

const ISSUE_LABELS: Record<ExternalLinkIssueCode, string> = {
  credentials: "HTTPS URL 含凭据，已从报告隐藏",
  "insecure-http": "外链仍使用 HTTP",
  "invalid-https": "HTTPS URL 无法解析",
  "protocol-relative": "外链使用协议相对地址",
};

const HEALTH_LABELS: Record<ExternalLinkHealthStatus, string> = {
  "client-error": "CLIENT ERROR",
  healthy: "HEALTHY",
  "method-unsupported": "HEAD UNSUPPORTED",
  missing: "MISSING",
  "network-error": "NETWORK ERROR",
  "redirect-error": "REDIRECT ERROR",
  restricted: "RESTRICTED",
  "server-error": "SERVER ERROR",
  timeout: "TIMEOUT",
  unsafe: "UNSAFE",
};

export function formatExternalLinkReportText(report: ExternalLinkReport) {
  const lines = [
    `[links] 模式：${report.checked ? "显式 HEAD 健康检查" : "本地确定性库存"}`,
    `[links] 公开记录 ${report.counts.records} · 有外链记录 ${report.counts.sourceRecords} · HTTPS URL ${report.counts.uniqueUrls} · 出现 ${report.counts.occurrences} · 本地问题 ${report.counts.issues}`,
  ];
  if (report.checked) {
    lines.push(
      `[links] 已检查 ${report.counts.checked} · 健康 ${report.counts.healthy} · 暂不可确认 ${report.counts.attention} · 已确认异常 ${report.counts.broken}`,
    );
  }
  if (report.links.length === 0) lines.push("[links] 当前公开内容没有可盘点的 HTTPS 外链。");
  for (const link of report.links) {
    const status = link.health ? HEALTH_LABELS[link.health.status] : "INVENTORY";
    const result = link.health
      ? ` · ${link.health.detail} · ${link.health.durationMs}ms · attempts ${link.health.attempts}`
      : "";
    lines.push(
      `[links] ${status} · ${link.url} · ${link.occurrenceCount} 次 / ${link.sourceCount} 个来源${result}`,
    );
    if (link.health && link.health.finalUrl !== link.url) {
      lines.push(`[links]   final ${link.health.finalUrl}`);
    }
    for (const occurrence of link.occurrences) {
      const location = occurrence.sourceField === "body"
        ? `正文${occurrence.bodyLine ? `第 ${occurrence.bodyLine} 行` : ""} · ${occurrence.label}`
        : `frontmatter.${occurrence.sourceField}`;
      lines.push(
        `[links]   ${occurrence.sourcePath} · ${location}`,
      );
    }
  }
  for (const issue of report.issues) {
    const location = issue.sourceField === "body"
      ? `正文${issue.bodyLine ? `第 ${issue.bodyLine} 行` : ""}`
      : `frontmatter.${issue.sourceField}`;
    lines.push(
      `[links] ISSUE ${issue.code} · ${issue.sourcePath} · ${location} · ${issue.url} · ${ISSUE_LABELS[issue.code]}`,
    );
  }
  lines.push(
    report.checked
      ? "[links] 检查只发送 HEAD 并立即关闭响应；不下载或保存第三方正文。结果是当前网络证据，不会自动改写链接。"
      : "[links] 默认命令不访问网络；增加 --check 才会发送受限 HEAD 请求。报告不会改写内容。",
  );
  return lines.join("\n");
}

export function externalLinkReportHasBrokenEntries(report: ExternalLinkReport) {
  return report.counts.broken > 0 || report.counts.issues > 0;
}
