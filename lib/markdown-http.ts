import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_HTTP_MAX_COUNT = 2;
export const MARKDOWN_HTTP_MAX_REQUEST_HEADERS = 10;
export const MARKDOWN_HTTP_MAX_RESPONSE_HEADERS = 12;
export const MARKDOWN_HTTP_MAX_TOTAL_HEADERS = 30;
export const MARKDOWN_HTTP_MAX_BODY_LINES = 80;
export const MARKDOWN_HTTP_MAX_TOTAL_BODY_LINES = 160;
export const MARKDOWN_HTTP_MAX_BODY_LENGTH = 8_000;
export const MARKDOWN_HTTP_MAX_BODY_LINE_LENGTH = 240;
export const MARKDOWN_HTTP_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_HTTP_MAX_PURPOSE_LENGTH = 800;
export const MARKDOWN_HTTP_MAX_TARGET_LENGTH = 400;
export const MARKDOWN_HTTP_MAX_HEADER_VALUE_LENGTH = 240;
export const MARKDOWN_HTTP_MAX_VERIFICATIONS = 6;
export const MARKDOWN_HTTP_METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;
export const MARKDOWN_HTTP_BODY_LANGUAGES = [
  "NONE",
  "json",
  "text",
  "html",
  "xml",
  "graphql",
  "form",
] as const;

export type MarkdownHttpMethod = (typeof MARKDOWN_HTTP_METHODS)[number];
export type MarkdownHttpBodyLanguage = (typeof MARKDOWN_HTTP_BODY_LANGUAGES)[number];

export interface MarkdownHttpHeader {
  name: string;
  value: string;
}

export interface MarkdownHttpBody {
  language: MarkdownHttpBodyLanguage;
  value: string;
}

export interface MarkdownHttpVerification {
  description: string;
  label: string;
  value: string;
}

export interface MarkdownHttpExchange {
  date: string;
  line?: number;
  method: MarkdownHttpMethod;
  purpose: string;
  requestBody: MarkdownHttpBody;
  requestHeaders: MarkdownHttpHeader[];
  responseBody: MarkdownHttpBody;
  responseHeaders: MarkdownHttpHeader[];
  status: number;
  target: string;
  title: string;
  verifications: MarkdownHttpVerification[];
}

export interface MarkdownHttpIssue {
  kind: "http";
  line?: number;
  message: string;
}

export interface MarkdownHttpOptions {
  maximumDate?: string;
}

class MarkdownHttpError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const HTTP_MARKER = /^\[!http\](?:[ \t]+([^\r\n]*?))?[ \t]*\r?\n$/iu;
const POTENTIAL_HTTP_MARKER = /^\[!http\](?:[+\-]|[ \t]|$)/iu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
const METHODS = new Set<string>(MARKDOWN_HTTP_METHODS);
const BODY_LANGUAGES = new Set<string>(MARKDOWN_HTTP_BODY_LANGUAGES);
const BODYLESS_REQUEST_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SENSITIVE_HEADER_NAME = /^(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|authentication-info|proxy-authentication-info)$|(?:^|[-_])(?:auth|token|secret|password|signature|private-key|access-key)(?:$|[-_])/iu;
const SENSITIVE_QUERY_NAME = /(?:auth|token|key|secret|password|session|signature|credential|code)/iu;
const SENSITIVE_VALUE = [
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/iu,
  /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}\b/iu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u,
  /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*[^\s,;]{6,}/iu,
];

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\u0000-\u001f\u007f]+/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 320);
}

function visibleMarkdownChildren(node: MarkdownNode) {
  return (node.children ?? []).filter(
    (child) => child.type !== "text" || (child.value ?? "").trim() !== "",
  );
}

function inlineText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode" || node.type === "inlineMath") {
    return node.value ?? "";
  }
  return (node.children ?? []).map(inlineText).join("");
}

function httpMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const marker = first.children?.[0];
  return marker?.type === "text" && POTENTIAL_HTTP_MARKER.test(marker.value ?? "")
    ? marker
    : undefined;
}

function isRealIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateInline(node: MarkdownNode, line?: number) {
  if (node.type === "text" || node.type === "inlineCode") return;
  if (
    node.type === "emphasis" ||
    node.type === "strong" ||
    node.type === "delete" ||
    node.type === "link" ||
    node.type === "linkReference"
  ) {
    for (const child of node.children ?? []) validateInline(child, line);
    return;
  }
  throw new MarkdownHttpError(
    "HTTP 交换说明只接受文本、行内代码、简单强调与链接；图片、HTML、脚注和嵌套内容请移到记录外。",
    line,
  );
}

function isLabel(node: MarkdownNode, label: string) {
  const children = visibleMarkdownChildren(node);
  return node.type === "paragraph" &&
    children.length === 1 &&
    children[0]?.type === "strong" &&
    inlineText(children[0]) === label;
}

function parseCopy(node: MarkdownNode, label: string, maximum: number) {
  const line = node.position?.start?.line;
  if (node.type !== "paragraph") throw new MarkdownHttpError(`${label} 必须是独立段落。`, line);
  for (const child of node.children ?? []) validateInline(child, line);
  const value = inlineText(node).replace(/\s+/gu, " ").trim();
  if (!value || value.length > maximum) {
    throw new MarkdownHttpError(`${label} 必须为 1–${maximum} 个字符。`, line);
  }
  if (SENSITIVE_VALUE.some((pattern) => pattern.test(value))) {
    throw new MarkdownHttpError(`${label} 疑似包含凭据或访问令牌，不能发布。`, line);
  }
  return value;
}

function parseMetadata(paragraph: MarkdownNode) {
  const line = paragraph.position?.start?.line;
  const children = paragraph.children ?? [];
  const [marker, methodLabel, methodSpace, methodNode, separatorOne, statusLabel, statusSpace, statusNode, separatorTwo, dateLabel, dateSpace, dateNode] = children;
  const markerMatch = marker?.type === "text" ? HTTP_MARKER.exec(marker.value ?? "") : undefined;
  if (!markerMatch) {
    throw new MarkdownHttpError("HTTP 交换标记必须写成静态的 > [!http] 标题，不能折叠或追加其他标记。", line);
  }
  const title = markerMatch[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_HTTP_MAX_TITLE_LENGTH) {
    throw new MarkdownHttpError(`HTTP 交换标题必须为 1–${MARKDOWN_HTTP_MAX_TITLE_LENGTH} 个字符。`, line);
  }
  if (
    children.length !== 12 ||
    methodLabel?.type !== "strong" || inlineText(methodLabel) !== "METHOD:" ||
    methodSpace?.type !== "text" || methodSpace.value !== " " ||
    methodNode?.type !== "inlineCode" ||
    separatorOne?.type !== "text" || separatorOne.value !== " · " ||
    statusLabel?.type !== "strong" || inlineText(statusLabel) !== "STATUS:" ||
    statusSpace?.type !== "text" || statusSpace.value !== " " ||
    statusNode?.type !== "inlineCode" ||
    separatorTwo?.type !== "text" || separatorTwo.value !== " · " ||
    dateLabel?.type !== "strong" || inlineText(dateLabel) !== "DATE:" ||
    dateSpace?.type !== "text" || dateSpace.value !== " " ||
    dateNode?.type !== "inlineCode"
  ) {
    throw new MarkdownHttpError(
      "HTTP 元数据必须写成 **METHOD:** `POST` · **STATUS:** `201` · **DATE:** `YYYY-MM-DD`。",
      line,
    );
  }
  const method = (methodNode.value ?? "").trim().toLocaleUpperCase("en-US");
  if (!METHODS.has(method)) {
    throw new MarkdownHttpError(`HTTP 方法只允许 ${MARKDOWN_HTTP_METHODS.join(" / ")}。`, line);
  }
  const statusText = (statusNode.value ?? "").trim();
  if (!/^[1-5]\d{2}$/u.test(statusText)) {
    throw new MarkdownHttpError("HTTP 响应状态必须是 100–599 的三位整数。", line);
  }
  const date = (dateNode.value ?? "").trim();
  if (!isRealIsoDate(date)) throw new MarkdownHttpError("HTTP 交换日期必须是真实的 YYYY-MM-DD。", line);
  return { date, method: method as MarkdownHttpMethod, status: Number(statusText), title };
}

function parseTarget(node: MarkdownNode) {
  const line = node.position?.start?.line;
  const children = visibleMarkdownChildren(node);
  if (node.type !== "paragraph" || children.length !== 1 || children[0]?.type !== "inlineCode") {
    throw new MarkdownHttpError("TARGET 必须是一个行内代码 URL。", line);
  }
  const target = (children[0].value ?? "").trim();
  if (!target || target.length > MARKDOWN_HTTP_MAX_TARGET_LENGTH) {
    throw new MarkdownHttpError(`TARGET 必须为 1–${MARKDOWN_HTTP_MAX_TARGET_LENGTH} 个字符。`, line);
  }
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new MarkdownHttpError("TARGET 必须是完整 URL。", line);
  }
  const local = /^(?:localhost|127\.0\.0\.1|\[::1\])$/iu.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new MarkdownHttpError("TARGET 只允许 HTTPS；本机开发证据可使用 localhost 或 127.0.0.1 的 HTTP。", line);
  }
  if (url.username || url.password || url.hash) {
    throw new MarkdownHttpError("TARGET 不能包含用户名、密码或 URL 片段。", line);
  }
  for (const name of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_NAME.test(name.normalize("NFKC"))) {
      throw new MarkdownHttpError(`TARGET 查询参数 ${name} 疑似承载凭据，必须先脱敏或移除。`, line);
    }
  }
  if (SENSITIVE_VALUE.some((pattern) => pattern.test(target))) {
    throw new MarkdownHttpError("TARGET 疑似包含凭据或访问令牌，不能发布。", line);
  }
  return target;
}

function parseHeaderValue(value: string, label: string, line?: number): MarkdownHttpHeader {
  const separator = value.indexOf(":");
  const name = separator >= 0 ? value.slice(0, separator).trim() : "";
  const headerValue = separator >= 0 ? value.slice(separator + 1).trim() : "";
  if (!HEADER_NAME.test(name) || !headerValue) {
    throw new MarkdownHttpError(`${label}必须写成 \`Name: value\`。`, line);
  }
  if (headerValue.length > MARKDOWN_HTTP_MAX_HEADER_VALUE_LENGTH || /[\r\n\u0000-\u001f\u007f]/u.test(headerValue)) {
    throw new MarkdownHttpError(`${label}值必须是单行且不超过 ${MARKDOWN_HTTP_MAX_HEADER_VALUE_LENGTH} 个字符。`, line);
  }
  if (SENSITIVE_HEADER_NAME.test(name)) {
    throw new MarkdownHttpError(`${label}${name} 属于鉴权、Cookie 或密钥类字段，不能发布。`, line);
  }
  if (SENSITIVE_VALUE.some((pattern) => pattern.test(headerValue))) {
    throw new MarkdownHttpError(`${label}疑似包含凭据或访问令牌，不能发布。`, line);
  }
  return { name, value: headerValue };
}

function parseHeaders(node: MarkdownNode, label: string, maximum: number) {
  const line = node.position?.start?.line;
  if (node.type !== "list" || node.ordered !== false) {
    throw new MarkdownHttpError(`${label} 必须使用无序列表；无内容时写 - \`NONE\`。`, line);
  }
  const items = visibleMarkdownChildren(node);
  if (items.length < 1 || items.length > maximum) {
    throw new MarkdownHttpError(`${label} 必须包含 1–${maximum} 行（NONE 也占一行）。`, line);
  }
  const values = items.map((item, index) => {
    const paragraph = visibleMarkdownChildren(item)[0];
    const children = paragraph ? visibleMarkdownChildren(paragraph) : [];
    if (item.type !== "listItem" || !paragraph || paragraph.type !== "paragraph" || children.length !== 1 || children[0]?.type !== "inlineCode") {
      throw new MarkdownHttpError(`${label}第 ${index + 1} 行必须只包含一个行内代码头字段。`, item.position?.start?.line ?? line);
    }
    return (children[0].value ?? "").trim();
  });
  if (values.length === 1 && values[0].toLocaleUpperCase("en-US") === "NONE") return [];
  if (values.some((value) => value.toLocaleUpperCase("en-US") === "NONE")) {
    throw new MarkdownHttpError(`${label}的 NONE 不能与真实头字段混用。`, line);
  }
  const headers = values.map((value, index) => parseHeaderValue(value, `${label}第 ${index + 1} 行`, items[index].position?.start?.line ?? line));
  const keys = headers.map((header) => header.name.normalize("NFKC").toLocaleLowerCase("en-US"));
  if (new Set(keys).size !== keys.length) throw new MarkdownHttpError(`${label}不能包含名称重复的字段。`, line);
  return headers;
}

function parseBodyLabel(node: MarkdownNode, label: string) {
  const line = node.position?.start?.line;
  const children = node.children ?? [];
  const [strong, space, languageNode] = children;
  if (
    node.type !== "paragraph" || children.length !== 3 ||
    strong?.type !== "strong" || inlineText(strong) !== `${label}:` ||
    space?.type !== "text" || space.value !== " " ||
    languageNode?.type !== "inlineCode"
  ) {
    throw new MarkdownHttpError(`${label} 必须写成 **${label}:** \`json\` 或 \`NONE\`。`, line);
  }
  const raw = (languageNode.value ?? "").trim();
  const language = raw.toLocaleUpperCase("en-US") === "NONE"
    ? "NONE"
    : raw.toLocaleLowerCase("en-US");
  if (!BODY_LANGUAGES.has(language)) {
    throw new MarkdownHttpError(`${label} 只允许 ${MARKDOWN_HTTP_BODY_LANGUAGES.join(" / ")}。`, line);
  }
  return language as MarkdownHttpBodyLanguage;
}

function validateBody(value: string, label: string, line?: number) {
  const normalized = value.replace(/\r\n?/gu, "\n");
  const lines = normalized.split("\n");
  if (!normalized || normalized.length > MARKDOWN_HTTP_MAX_BODY_LENGTH || lines.length > MARKDOWN_HTTP_MAX_BODY_LINES) {
    throw new MarkdownHttpError(`${label}必须为 1–${MARKDOWN_HTTP_MAX_BODY_LINES} 行且不超过 ${MARKDOWN_HTTP_MAX_BODY_LENGTH} 个字符。`, line);
  }
  if (lines.some((sourceLine) => sourceLine.length > MARKDOWN_HTTP_MAX_BODY_LINE_LENGTH)) {
    throw new MarkdownHttpError(`${label}单行不能超过 ${MARKDOWN_HTTP_MAX_BODY_LINE_LENGTH} 个字符。`, line);
  }
  if (/[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) {
    throw new MarkdownHttpError(`${label}不能包含控制字符。`, line);
  }
  if (SENSITIVE_VALUE.some((pattern) => pattern.test(normalized))) {
    throw new MarkdownHttpError(`${label}疑似包含凭据或访问令牌，不能发布。`, line);
  }
  if (lines.some((sourceLine) => sourceLine.trim() === "~~~")) {
    throw new MarkdownHttpError(`${label}不能包含独立的 ~~~ 围栏结束行。`, line);
  }
  return normalized;
}

function parseBody(children: MarkdownNode[], cursor: number, label: string) {
  const language = parseBodyLabel(children[cursor], label);
  if (language === "NONE") {
    if (children[cursor + 1]?.type === "code") {
      throw new MarkdownHttpError(`${label} 为 NONE 时不能跟随代码围栏。`, children[cursor + 1].position?.start?.line);
    }
    return { body: { language, value: "" } satisfies MarkdownHttpBody, cursor: cursor + 1, lineCount: 0 };
  }
  const code = children[cursor + 1];
  if (code?.type !== "code" || (code.lang ?? "").toLocaleLowerCase("en-US") !== language) {
    throw new MarkdownHttpError(`${label} 必须跟随一个语言为 ${language} 的代码围栏。`, code?.position?.start?.line ?? children[cursor].position?.start?.line);
  }
  const value = validateBody(code.value ?? "", `${label} `, code.position?.start?.line);
  return {
    body: { language, value } satisfies MarkdownHttpBody,
    cursor: cursor + 2,
    lineCount: value.split("\n").length,
  };
}

function contentType(headers: MarkdownHttpHeader[]) {
  return headers.find((header) => header.name.toLocaleLowerCase("en-US") === "content-type")?.value
    .split(";", 1)[0]
    .trim()
    .toLocaleLowerCase("en-US");
}

function expectedContentType(language: MarkdownHttpBodyLanguage, value: string | undefined) {
  if (!value || language === "NONE") return false;
  if (language === "json") return value === "application/json" || value.endsWith("+json");
  if (language === "html") return value === "text/html";
  if (language === "xml") return value === "application/xml" || value === "text/xml" || value.endsWith("+xml");
  if (language === "graphql") return value === "application/graphql";
  if (language === "form") return value === "application/x-www-form-urlencoded";
  return value.startsWith("text/");
}

function validateBodyHeaders(body: MarkdownHttpBody, headers: MarkdownHttpHeader[], label: string, line?: number) {
  if (body.language === "NONE") return;
  const value = contentType(headers);
  if (!value) throw new MarkdownHttpError(`${label}存在正文时必须声明 Content-Type。`, line);
  if (!expectedContentType(body.language, value)) {
    throw new MarkdownHttpError(`${label}的 Content-Type ${value} 与 ${body.language} 正文不一致。`, line);
  }
}

function parseVerification(item: MarkdownNode, index: number): MarkdownHttpVerification {
  const line = item.position?.start?.line;
  const paragraph = visibleMarkdownChildren(item)[0];
  const children = paragraph?.children ?? [];
  const [labelNode, valueSpace, valueNode, separator, ...rest] = children;
  if (
    item.type !== "listItem" || paragraph?.type !== "paragraph" ||
    labelNode?.type !== "strong" || valueSpace?.type !== "text" || valueSpace.value !== " " ||
    valueNode?.type !== "inlineCode" || separator?.type !== "text" || !(separator.value ?? "").startsWith(" — ")
  ) {
    throw new MarkdownHttpError(`第 ${index + 1} 项验证必须写成 - **检查名** \`结果\` — 说明。`, line);
  }
  const separatorValue = separator.value ?? "";
  const label = inlineText(labelNode).replace(/\s+/gu, " ").trim();
  const value = (valueNode.value ?? "").replace(/\s+/gu, " ").trim();
  const descriptionNodes = [{ ...separator, value: separatorValue.slice(3) }, ...rest];
  for (const child of descriptionNodes) validateInline(child, line);
  const description = descriptionNodes.map(inlineText).join("").replace(/\s+/gu, " ").trim();
  if (!label || label.length > 120 || !value || value.length > 80 || !description || description.length > 400) {
    throw new MarkdownHttpError(`第 ${index + 1} 项验证的名称、结果或说明为空或超长。`, line);
  }
  if (SENSITIVE_VALUE.some((pattern) => pattern.test(`${value} ${description}`))) {
    throw new MarkdownHttpError(`第 ${index + 1} 项验证疑似包含凭据或访问令牌，不能发布。`, line);
  }
  return { description, label, value };
}

function parseVerifications(node: MarkdownNode) {
  const line = node.position?.start?.line;
  if (node.type !== "list" || node.ordered !== false) throw new MarkdownHttpError("VERIFICATION 必须使用无序列表。", line);
  const items = visibleMarkdownChildren(node);
  if (items.length < 1 || items.length > MARKDOWN_HTTP_MAX_VERIFICATIONS) {
    throw new MarkdownHttpError(`VERIFICATION 必须包含 1–${MARKDOWN_HTTP_MAX_VERIFICATIONS} 项。`, line);
  }
  const verifications = items.map(parseVerification);
  const keys = verifications.map((item) => item.label.normalize("NFKC").toLocaleLowerCase("en-US"));
  if (new Set(keys).size !== keys.length) throw new MarkdownHttpError("同一 HTTP 交换不能包含名称重复的验证项。", line);
  return verifications;
}

function httpExchangeFromMarkdownNode(blockquote: MarkdownNode) {
  if (!httpMarkerNode(blockquote)) return undefined;
  const line = blockquote.position?.start?.line;
  const children = visibleMarkdownChildren(blockquote);
  const metadata = parseMetadata(children[0]);
  let cursor = 1;
  if (!isLabel(children[cursor++], "PURPOSE")) throw new MarkdownHttpError("HTTP 交换缺少固定区段 **PURPOSE** 或顺序错误。", line);
  const purpose = parseCopy(children[cursor++], "PURPOSE", MARKDOWN_HTTP_MAX_PURPOSE_LENGTH);
  if (!isLabel(children[cursor++], "TARGET")) throw new MarkdownHttpError("HTTP 交换缺少固定区段 **TARGET** 或顺序错误。", line);
  const target = parseTarget(children[cursor++]);
  if (!isLabel(children[cursor++], "REQUEST HEADERS")) throw new MarkdownHttpError("HTTP 交换缺少固定区段 **REQUEST HEADERS** 或顺序错误。", line);
  const requestHeaders = parseHeaders(children[cursor++], "REQUEST HEADERS", MARKDOWN_HTTP_MAX_REQUEST_HEADERS);
  const request = parseBody(children, cursor, "REQUEST BODY");
  cursor = request.cursor;
  if (!isLabel(children[cursor++], "RESPONSE HEADERS")) throw new MarkdownHttpError("HTTP 交换缺少固定区段 **RESPONSE HEADERS** 或顺序错误。", line);
  const responseHeaders = parseHeaders(children[cursor++], "RESPONSE HEADERS", MARKDOWN_HTTP_MAX_RESPONSE_HEADERS);
  const response = parseBody(children, cursor, "RESPONSE BODY");
  cursor = response.cursor;
  if (!isLabel(children[cursor++], "VERIFICATION")) throw new MarkdownHttpError("HTTP 交换缺少固定区段 **VERIFICATION** 或顺序错误。", line);
  const verifications = parseVerifications(children[cursor++]);
  if (cursor !== children.length) throw new MarkdownHttpError("HTTP 交换包含未知区段或多余内容。", children[cursor]?.position?.start?.line ?? line);
  if (BODYLESS_REQUEST_METHODS.has(metadata.method) && request.body.language !== "NONE") {
    throw new MarkdownHttpError(`${metadata.method} 请求在本博客的静态证据契约中不能包含正文。`, line);
  }
  if ((metadata.method === "HEAD" || metadata.status === 204 || metadata.status === 304) && response.body.language !== "NONE") {
    throw new MarkdownHttpError(`${metadata.method === "HEAD" ? "HEAD" : metadata.status} 响应不能包含正文。`, line);
  }
  validateBodyHeaders(request.body, requestHeaders, "REQUEST", line);
  validateBodyHeaders(response.body, responseHeaders, "RESPONSE", line);
  return {
    ...metadata,
    ...(line ? { line } : {}),
    purpose,
    requestBody: request.body,
    requestHeaders,
    responseBody: response.body,
    responseHeaders,
    target,
    verifications,
    bodyLineCount: request.lineCount + response.lineCount,
  } satisfies MarkdownHttpExchange & { bodyLineCount: number };
}

function parseMarkdownHttpExchanges(markdown: string, options: MarkdownHttpOptions = {}) {
  const exchanges: Array<MarkdownHttpExchange & { bodyLineCount: number }> = [];
  const tree = parseMarkdown(markdown);
  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && httpMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownHttpError("HTTP 交换必须作为正文顶层区块，不能嵌套在列表或其他引用块中。", node.position?.start?.line);
      }
      const exchange = httpExchangeFromMarkdownNode(node);
      if (exchange) exchanges.push(exchange);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }
  walk(tree);
  if (exchanges.length > MARKDOWN_HTTP_MAX_COUNT) {
    throw new MarkdownHttpError(`每篇内容最多允许 ${MARKDOWN_HTTP_MAX_COUNT} 个 HTTP 交换。`);
  }
  const totalHeaders = exchanges.reduce((total, exchange) => total + exchange.requestHeaders.length + exchange.responseHeaders.length, 0);
  if (totalHeaders > MARKDOWN_HTTP_MAX_TOTAL_HEADERS) {
    throw new MarkdownHttpError(`每篇内容的 HTTP 头字段合计最多允许 ${MARKDOWN_HTTP_MAX_TOTAL_HEADERS} 个。`);
  }
  const totalBodyLines = exchanges.reduce((total, exchange) => total + exchange.bodyLineCount, 0);
  if (totalBodyLines > MARKDOWN_HTTP_MAX_TOTAL_BODY_LINES) {
    throw new MarkdownHttpError(`每篇内容的 HTTP 正文合计最多允许 ${MARKDOWN_HTTP_MAX_TOTAL_BODY_LINES} 行。`);
  }
  if (options.maximumDate) {
    if (!isRealIsoDate(options.maximumDate)) throw new MarkdownHttpError("HTTP 交换的最大日期边界无效。");
    const future = exchanges.find((exchange) => exchange.date > options.maximumDate!);
    if (future) {
      throw new MarkdownHttpError(`HTTP 交换只记录已经完成的观察；${future.date} 晚于当前内容日期 ${options.maximumDate}。`, future.line);
    }
  }
  return exchanges.map((exchange) => {
    const { bodyLineCount, ...publicExchange } = exchange;
    void bodyLineCount;
    return publicExchange;
  });
}

export function extractMarkdownHttpExchanges(markdown: string, options: MarkdownHttpOptions = {}) {
  return parseMarkdownHttpExchanges(markdown, options);
}

export function getMarkdownHttpIssue(markdown: string, options: MarkdownHttpOptions = {}): MarkdownHttpIssue | undefined {
  try {
    parseMarkdownHttpExchanges(markdown, options);
    return undefined;
  } catch (error) {
    return {
      kind: "http",
      ...(error instanceof MarkdownHttpError && error.line ? { line: error.line } : {}),
      message: compactError(error) || "HTTP 交换无法解析。",
    };
  }
}

function isElement(node: ElementContent | RootContent): node is Element {
  return node.type === "element";
}

function isText(node: ElementContent | RootContent): node is Text {
  return node.type === "text";
}

function text(value: string): Text {
  return { type: "text", value };
}

function element(tagName: string, properties: Element["properties"], children: ElementContent[]): Element {
  return { children, properties, tagName, type: "element" };
}

function visibleHastChildren(node: Element) {
  return node.children.filter((child) => !isText(child) || child.value.trim() !== "");
}

function hastText(node: ElementContent): string {
  if (isText(node)) return node.value;
  if (!isElement(node)) return "";
  return node.children.map(hastText).join("");
}

function hastLabel(node: ElementContent | undefined, label: string) {
  if (!node || !isElement(node) || node.tagName !== "p") return false;
  const children = visibleHastChildren(node);
  return children.length === 1 && isElement(children[0]) && children[0].tagName === "strong" && hastText(children[0]) === label;
}

function addClass(node: Element, className: string) {
  const current = Array.isArray(node.properties.className) ? node.properties.className : [];
  node.properties.className = [...current, className];
  return node;
}

function renderedHeaders(list: Element, side: "request" | "response") {
  if (list.tagName !== "ul") throw new MarkdownHttpError("HTTP 头台账必须使用无序列表。");
  const items = visibleHastChildren(list).filter((child): child is Element => isElement(child) && child.tagName === "li");
  const values = items.map((item) => {
    const first = visibleHastChildren(item)[0];
    const inline = isElement(first) && first.tagName === "p" ? visibleHastChildren(first) : visibleHastChildren(item);
    if (inline.length !== 1 || !isElement(inline[0]) || inline[0].tagName !== "code") throw new MarkdownHttpError("HTTP 头台账行无效。");
    return hastText(inline[0]).trim();
  });
  const empty = values.length === 1 && values[0].toLocaleUpperCase("en-US") === "NONE";
  const headers = empty ? [] : values.map((value) => {
    const separator = value.indexOf(":");
    if (separator < 1) throw new MarkdownHttpError("HTTP 头台账行缺少冒号。");
    return { name: value.slice(0, separator).trim(), value: value.slice(separator + 1).trim() };
  });
  return element("div", {
    className: ["markdown-http-headers", `markdown-http-${side}-headers`],
    dataHeaderCount: headers.length,
  }, [
    element("header", { className: ["markdown-http-ledger-header"] }, [
      element("span", { className: ["markdown-http-ledger-label"] }, [text(`${side.toLocaleUpperCase("en-US")} HEADERS`)]),
      element("span", { className: ["markdown-http-ledger-count"] }, [text(String(headers.length).padStart(2, "0"))]),
    ]),
    headers.length === 0
      ? element("p", { className: ["markdown-http-empty"] }, [text("NONE / NO PUBLISHED HEADERS")])
      : element("dl", { className: ["markdown-http-header-list"] }, headers.flatMap((header) => [
          element("dt", { className: ["markdown-http-header-name"] }, [text(header.name)]),
          element("dd", { className: ["markdown-http-header-value"] }, [text(header.value)]),
        ])),
  ]);
}

function renderedBody(children: ElementContent[], cursor: number, label: string, side: "request" | "response") {
  const labelNode = children[cursor];
  if (!isElement(labelNode) || labelNode.tagName !== "p") throw new MarkdownHttpError(`${label} 渲染标签无效。`);
  const inline = labelNode.children;
  const languageNode = inline[2];
  const language = isElement(languageNode) ? hastText(languageNode).trim() : "";
  if (!BODY_LANGUAGES.has(language.toLocaleUpperCase("en-US") === "NONE" ? "NONE" : language.toLocaleLowerCase("en-US"))) {
    throw new MarkdownHttpError(`${label} 渲染语言无效。`);
  }
  if (language.toLocaleUpperCase("en-US") === "NONE") {
    return {
      cursor: cursor + 1,
      lineCount: 0,
      node: element("div", { className: ["markdown-http-body", `markdown-http-${side}-body`] }, [
        element("header", { className: ["markdown-http-ledger-header"] }, [
          element("span", { className: ["markdown-http-ledger-label"] }, [text(`${side.toLocaleUpperCase("en-US")} BODY`)]),
          element("span", { className: ["markdown-http-body-language"] }, [text("NONE")]),
        ]),
        element("p", { className: ["markdown-http-empty"] }, [text("NONE / NO PUBLISHED BODY")]),
      ]),
    };
  }
  const pre = children[cursor + 1];
  if (!isElement(pre) || pre.tagName !== "pre") throw new MarkdownHttpError(`${label} 渲染围栏缺失。`);
  addClass(pre, "markdown-http-pre");
  const code = pre.children.find((child): child is Element => isElement(child) && child.tagName === "code");
  if (!code) throw new MarkdownHttpError(`${label} 渲染 code 元素缺失。`);
  addClass(code, "markdown-http-code");
  const lineCount = hastText(pre).replace(/\n$/u, "").split("\n").length;
  return {
    cursor: cursor + 2,
    lineCount,
    node: element("div", { className: ["markdown-http-body", `markdown-http-${side}-body`] }, [
      element("header", { className: ["markdown-http-ledger-header"] }, [
        element("span", { className: ["markdown-http-ledger-label"] }, [text(`${side.toLocaleUpperCase("en-US")} BODY`)]),
        element("span", { className: ["markdown-http-body-language"] }, [text(language.toLocaleUpperCase("en-US"))]),
      ]),
      pre,
    ]),
  };
}

function renderedVerifications(list: Element) {
  if (list.tagName !== "ul") throw new MarkdownHttpError("HTTP 验证台账必须使用无序列表。");
  const items = visibleHastChildren(list).filter((child): child is Element => isElement(child) && child.tagName === "li").map((item) => {
    const first = visibleHastChildren(item)[0];
    const inline = isElement(first) && first.tagName === "p" ? first.children : item.children;
    const [label, valueSpace, value, separator, ...rest] = inline;
    if (!isElement(label) || label.tagName !== "strong" || !isText(valueSpace) || valueSpace.value !== " " || !isElement(value) || value.tagName !== "code" || !isText(separator) || !separator.value.startsWith(" — ")) {
      throw new MarkdownHttpError("HTTP 验证项渲染结构无效。");
    }
    return element("li", { className: ["markdown-http-verification"] }, [
      element("strong", { className: ["markdown-http-verification-label"] }, label.children),
      element("code", { className: ["markdown-http-verification-value"] }, value.children),
      element("span", { className: ["markdown-http-verification-copy"] }, [text(separator.value.slice(3)), ...rest]),
    ]);
  });
  return element("div", { className: ["markdown-http-verifications"] }, [
    element("header", { className: ["markdown-http-ledger-header"] }, [
      element("span", { className: ["markdown-http-ledger-label"] }, [text("VERIFICATION")]),
      element("span", { className: ["markdown-http-ledger-count"] }, [text(String(items.length).padStart(2, "0"))]),
    ]),
    element("ul", { className: ["markdown-http-verification-list"] }, items),
  ]);
}

function httpExchangeFromHastBlockquote(blockquote: Element, index: number) {
  const children = visibleHastChildren(blockquote);
  const metadata = children[0];
  if (!isElement(metadata) || metadata.tagName !== "p") return undefined;
  const markerNode = metadata.children[0];
  if (!isText(markerNode) || !POTENTIAL_HTTP_MARKER.test(markerNode.value)) return undefined;
  const marker = HTTP_MARKER.exec(markerNode.value);
  const method = isElement(metadata.children[3]) ? hastText(metadata.children[3]).trim() : "";
  const status = isElement(metadata.children[7]) ? hastText(metadata.children[7]).trim() : "";
  const date = isElement(metadata.children[11]) ? hastText(metadata.children[11]).trim() : "";
  if (!marker?.[1]?.trim() || !METHODS.has(method) || !/^[1-5]\d{2}$/u.test(status) || !isRealIsoDate(date)) {
    throw new MarkdownHttpError("HTTP 交换的渲染元数据无效。");
  }
  let cursor = 1;
  if (!hastLabel(children[cursor++], "PURPOSE")) throw new MarkdownHttpError("HTTP 交换渲染缺少 PURPOSE。");
  const purpose = children[cursor++];
  if (!hastLabel(children[cursor++], "TARGET")) throw new MarkdownHttpError("HTTP 交换渲染缺少 TARGET。");
  const targetNode = children[cursor++];
  if (!hastLabel(children[cursor++], "REQUEST HEADERS")) throw new MarkdownHttpError("HTTP 交换渲染缺少 REQUEST HEADERS。");
  const requestHeadersNode = children[cursor++];
  if (!isElement(purpose) || purpose.tagName !== "p" || !isElement(targetNode) || targetNode.tagName !== "p" || !isElement(requestHeadersNode)) {
    throw new MarkdownHttpError("HTTP 交换渲染缺少目的、目标或请求头内容。");
  }
  const requestHeaders = renderedHeaders(requestHeadersNode, "request");
  const requestBody = renderedBody(children, cursor, "REQUEST BODY", "request");
  cursor = requestBody.cursor;
  if (!hastLabel(children[cursor++], "RESPONSE HEADERS")) throw new MarkdownHttpError("HTTP 交换渲染缺少 RESPONSE HEADERS。");
  const responseHeadersNode = children[cursor++];
  if (!isElement(responseHeadersNode)) throw new MarkdownHttpError("HTTP 交换渲染缺少响应头内容。");
  const responseHeaders = renderedHeaders(responseHeadersNode, "response");
  const responseBody = renderedBody(children, cursor, "RESPONSE BODY", "response");
  cursor = responseBody.cursor;
  if (!hastLabel(children[cursor++], "VERIFICATION")) throw new MarkdownHttpError("HTTP 交换渲染缺少 VERIFICATION。");
  const verificationNode = children[cursor++];
  if (!isElement(verificationNode) || cursor !== children.length) throw new MarkdownHttpError("HTTP 交换渲染包含未知区段。");
  const verifications = renderedVerifications(verificationNode);
  const titleId = `markdown-http-${index}-title`;
  const headerCount = Number(requestHeaders.properties.dataHeaderCount ?? 0) +
    Number(responseHeaders.properties.dataHeaderCount ?? 0);
  return element("section", {
    ariaLabelledBy: [titleId],
    className: ["markdown-http"],
    dataHttpExchange: "exchange-ledger",
    dataHeaderCount: headerCount,
    dataBodyLineCount: requestBody.lineCount + responseBody.lineCount,
    dataMethod: method.toLocaleLowerCase("en-US"),
    dataStatus: status,
  }, [
    element("header", { className: ["markdown-http-header"] }, [
      element("span", { ariaHidden: "true", className: ["markdown-http-spine"] }, [text("REQUEST → RESPONSE")]),
      element("span", { className: ["markdown-http-heading"] }, [
        element("span", { className: ["markdown-http-meta"] }, [
          element("span", { className: ["markdown-http-method"] }, [text(method)]),
          element("span", { className: ["markdown-http-status"] }, [text(status)]),
          element("time", { className: ["markdown-http-date"], dateTime: date }, [text(date)]),
        ]),
        element("strong", { className: ["markdown-http-title"], id: titleId }, [text(marker[1].trim())]),
      ]),
    ]),
    element("div", { className: ["markdown-http-context"] }, [
      element("div", { className: ["markdown-http-purpose"] }, [
        element("span", { className: ["markdown-http-kicker"] }, [text("PURPOSE")]),
        element("div", { className: ["markdown-http-purpose-copy"] }, purpose.children),
      ]),
      element("div", { className: ["markdown-http-target"] }, [
        element("span", { className: ["markdown-http-kicker"] }, [text("TARGET / REDACTED")]),
        element("code", { className: ["markdown-http-target-value"] }, [text(hastText(targetNode).trim())]),
      ]),
    ]),
    element("div", { className: ["markdown-http-flow"] }, [
      element("section", { className: ["markdown-http-phase", "markdown-http-request"] }, [
        element("header", { className: ["markdown-http-phase-header"] }, [
          element("span", { className: ["markdown-http-phase-index"] }, [text("01")]),
          element("strong", {}, [text("REQUEST")]),
          element("span", { className: ["markdown-http-phase-note"] }, [text("STATIC / REDACTED")]),
        ]),
        requestHeaders,
        requestBody.node,
      ]),
      element("span", { ariaHidden: "true", className: ["markdown-http-transit"] }, [text("↓")]),
      element("section", { className: ["markdown-http-phase", "markdown-http-response"] }, [
        element("header", { className: ["markdown-http-phase-header"] }, [
          element("span", { className: ["markdown-http-phase-index"] }, [text("02")]),
          element("strong", {}, [text("RESPONSE")]),
          element("span", { className: ["markdown-http-phase-note"] }, [text(`${status} / OBSERVED`)]),
        ]),
        responseHeaders,
        responseBody.node,
      ]),
    ]),
    verifications,
  ]);
}

export function rehypeMarkdownHttpExchanges() {
  return function transform(tree: Root) {
    let count = 0;
    let totalHeaders = 0;
    let totalBodyLines = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const exchange = httpExchangeFromHastBlockquote(child, count + 1);
      if (!exchange) continue;
      count += 1;
      totalHeaders += Number(exchange.properties.dataHeaderCount ?? 0);
      totalBodyLines += Number(exchange.properties.dataBodyLineCount ?? 0);
      if (count > MARKDOWN_HTTP_MAX_COUNT) throw new MarkdownHttpError(`每篇内容最多允许 ${MARKDOWN_HTTP_MAX_COUNT} 个 HTTP 交换。`);
      if (totalHeaders > MARKDOWN_HTTP_MAX_TOTAL_HEADERS) throw new MarkdownHttpError(`每篇内容的 HTTP 头字段合计最多允许 ${MARKDOWN_HTTP_MAX_TOTAL_HEADERS} 个。`);
      if (totalBodyLines > MARKDOWN_HTTP_MAX_TOTAL_BODY_LINES) throw new MarkdownHttpError(`每篇内容的 HTTP 正文合计最多允许 ${MARKDOWN_HTTP_MAX_TOTAL_BODY_LINES} 行。`);
      tree.children[index] = exchange as RootContent;
    }
  };
}

export function normalizeMarkdownHttpExchangesForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && httpMarkerNode(node)) {
      const exchange = httpExchangeFromMarkdownNode(node);
      if (!exchange) return;
      const headers = [...exchange.requestHeaders, ...exchange.responseHeaders]
        .map((header) => `${header.name} ${header.value}`)
        .join(" ");
      const bodies = [exchange.requestBody.value, exchange.responseBody.value].filter(Boolean).join(" ");
      const verifications = exchange.verifications
        .map((item) => `${item.label} ${item.value} ${item.description}`)
        .join(" ");
      node.children = [{
        children: [{
          type: "text",
          value: `${exchange.title} ${exchange.method} ${exchange.status} ${exchange.date} ${exchange.purpose} ${exchange.target} ${headers} ${bodies} ${verifications}`,
        }],
        type: "paragraph",
      }];
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
