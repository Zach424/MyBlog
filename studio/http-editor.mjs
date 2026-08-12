export const STUDIO_HTTP_EDITOR_ID = "myblog-http";
export const STUDIO_HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
export const STUDIO_HTTP_BODY_LANGUAGES = ["NONE", "json", "text", "html", "xml", "graphql", "form"];
export const STUDIO_HTTP_PATTERN = new RegExp(
  String.raw`^> \[!http\] [^\[\]\r\n]{1,120}\r?\n> \*\*METHOD:\*\* \x60(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\x60 · \*\*STATUS:\*\* \x60[1-5]\d{2}\x60 · \*\*DATE:\*\* \x60\d{4}-\d{2}-\d{2}\x60\r?\n(?:>[^\r\n]*(?:\r?\n|$)){14,240}?> \*\*VERIFICATION\*\*\r?\n>\r?\n(?:> - \*\*[^*\r\n]{1,120}\*\* \x60[^\x60\r\n]{1,80}\x60 — [^\r\n]{1,400}(?:\r?\n|$)){1,6}(?!> - \*\*)`,
  "imu",
);

const REGISTRATION_KEY = "__MYBLOG_HTTP_EDITOR_COMPONENT__";
const METHODS = new Set(STUDIO_HTTP_METHODS);
const BODY_LANGUAGES = new Set(STUDIO_HTTP_BODY_LANGUAGES);
const BODYLESS_REQUEST_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
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

function plainValue(value) {
  return value && typeof value.toJS === "function" ? value.toJS() : value;
}

function normalizeList(value, fields) {
  const raw = plainValue(value);
  if (!Array.isArray(raw)) return [];
  return raw.map((candidate) => {
    const item = plainValue(candidate) ?? {};
    return Object.fromEntries(fields.map((field) => [field, typeof item[field] === "string" ? item[field].trim() : ""]));
  });
}

function normalizedData(data) {
  const value = plainValue(data) ?? {};
  const normalizeBody = (body) => typeof body === "string" ? body.replace(/\r\n?/gu, "\n").trim() : "";
  return {
    date: typeof value.date === "string" ? value.date.trim() : "",
    method: typeof value.method === "string" ? value.method.trim().toLocaleUpperCase("en-US") : "",
    purpose: typeof value.purpose === "string" ? value.purpose.trim() : "",
    requestBody: normalizeBody(value.requestBody),
    requestBodyLanguage: typeof value.requestBodyLanguage === "string" ? value.requestBodyLanguage.trim() : "NONE",
    requestHeaders: normalizeList(value.requestHeaders, ["name", "value"]),
    responseBody: normalizeBody(value.responseBody),
    responseBodyLanguage: typeof value.responseBodyLanguage === "string" ? value.responseBodyLanguage.trim() : "NONE",
    responseHeaders: normalizeList(value.responseHeaders, ["name", "value"]),
    status: typeof value.status === "number" ? String(value.status) : typeof value.status === "string" ? value.status.trim() : "",
    target: typeof value.target === "string" ? value.target.trim() : "",
    title: typeof value.title === "string" ? value.title.trim() : "",
    verifications: normalizeList(value.verifications, ["label", "value", "description"]),
  };
}

function isRealIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateCopy(value, label, maximum) {
  if (!value || value.length > maximum || /[\r\n]/u.test(value)) throw new Error(`${label}必须是 1–${maximum} 字符的单行内容。`);
  if (/!\[|<[^>]+>|\[\^/u.test(value)) throw new Error(`${label}不能包含图片、HTML 或脚注。`);
  if (SENSITIVE_VALUE.some((pattern) => pattern.test(value))) throw new Error(`${label}疑似包含凭据或访问令牌。`);
}

function validateTarget(target) {
  if (!target || target.length > 400 || /[`\r\n]/u.test(target)) throw new Error("目标 URL 必须为 1–400 字符且不能包含反引号或换行。");
  let url;
  try { url = new URL(target); } catch { throw new Error("目标必须是完整 URL。"); }
  const local = /^(?:localhost|127\.0\.0\.1|\[::1\])$/iu.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) throw new Error("目标只允许 HTTPS；本机开发可使用 localhost 或 127.0.0.1 的 HTTP。");
  if (url.username || url.password || url.hash) throw new Error("目标不能包含用户名、密码或 URL 片段。");
  for (const name of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_NAME.test(name.normalize("NFKC"))) throw new Error(`查询参数 ${name} 疑似承载凭据，请先脱敏。`);
  }
  if (SENSITIVE_VALUE.some((pattern) => pattern.test(target))) throw new Error("目标疑似包含凭据或访问令牌。");
}

function validateHeaders(headers, label, maximum) {
  if (headers.length > maximum) throw new Error(`${label}最多允许 ${maximum} 个字段。`);
  headers.forEach((header, index) => {
    if (!HEADER_NAME.test(header.name)) throw new Error(`${label}第 ${index + 1} 个字段名无效。`);
    if (!header.value || header.value.length > 240 || /[\r\n\u0000-\u001f\u007f`]/u.test(header.value)) throw new Error(`${label}第 ${index + 1} 个值必须为不超过 240 字符的单行内容。`);
    if (SENSITIVE_HEADER_NAME.test(header.name)) throw new Error(`${label}${header.name} 属于鉴权、Cookie 或密钥类字段，不能发布。`);
    if (SENSITIVE_VALUE.some((pattern) => pattern.test(header.value))) throw new Error(`${label}第 ${index + 1} 个值疑似包含凭据或访问令牌。`);
  });
  const keys = headers.map((header) => header.name.normalize("NFKC").toLocaleLowerCase("en-US"));
  if (new Set(keys).size !== keys.length) throw new Error(`${label}不能包含名称重复的字段。`);
}

function validateBody(body, language, label) {
  if (!BODY_LANGUAGES.has(language)) throw new Error(`${label}类型只允许 ${STUDIO_HTTP_BODY_LANGUAGES.join(" / ")}。`);
  if (language === "NONE") {
    if (body) throw new Error(`${label}类型为 NONE 时正文必须留空。`);
    return 0;
  }
  const lines = body.split("\n");
  if (!body || body.length > 8_000 || lines.length > 80) throw new Error(`${label}必须为 1–80 行且不超过 8000 字符。`);
  if (lines.some((line) => line.length > 240)) throw new Error(`${label}单行不能超过 240 字符。`);
  if (/[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(body)) throw new Error(`${label}不能包含控制字符。`);
  if (SENSITIVE_VALUE.some((pattern) => pattern.test(body))) throw new Error(`${label}疑似包含凭据或访问令牌。`);
  if (lines.some((line) => line.trim() === "~~~")) throw new Error(`${label}不能包含独立的 ~~~ 行。`);
  return lines.length;
}

function contentType(headers) {
  return headers.find((header) => header.name.toLocaleLowerCase("en-US") === "content-type")?.value.split(";", 1)[0].trim().toLocaleLowerCase("en-US");
}

function expectedContentType(language, value) {
  if (!value || language === "NONE") return false;
  if (language === "json") return value === "application/json" || value.endsWith("+json");
  if (language === "html") return value === "text/html";
  if (language === "xml") return value === "application/xml" || value === "text/xml" || value.endsWith("+xml");
  if (language === "graphql") return value === "application/graphql";
  if (language === "form") return value === "application/x-www-form-urlencoded";
  return value.startsWith("text/");
}

function validateHttpExchange(data) {
  const value = normalizedData(data);
  validateCopy(value.title, "交换标题", 120);
  if (!METHODS.has(value.method)) throw new Error(`方法只允许 ${STUDIO_HTTP_METHODS.join(" / ")}。`);
  if (!/^[1-5]\d{2}$/u.test(value.status)) throw new Error("响应状态必须是 100–599 的三位整数。");
  if (!isRealIsoDate(value.date)) throw new Error("交换日期必须是真实的 YYYY-MM-DD。");
  validateCopy(value.purpose, "记录目的", 800);
  validateTarget(value.target);
  validateHeaders(value.requestHeaders, "请求头", 10);
  validateHeaders(value.responseHeaders, "响应头", 12);
  const requestLines = validateBody(value.requestBody, value.requestBodyLanguage, "请求正文");
  const responseLines = validateBody(value.responseBody, value.responseBodyLanguage, "响应正文");
  if (requestLines + responseLines > 160) throw new Error("请求与响应正文合计不能超过 160 行。");
  if (BODYLESS_REQUEST_METHODS.has(value.method) && value.requestBodyLanguage !== "NONE") throw new Error(`${value.method} 在静态证据契约中不能包含请求正文。`);
  if ((value.method === "HEAD" || value.status === "204" || value.status === "304") && value.responseBodyLanguage !== "NONE") throw new Error(`${value.method === "HEAD" ? "HEAD" : value.status} 响应不能包含正文。`);
  for (const [side, language, headers] of [["请求", value.requestBodyLanguage, value.requestHeaders], ["响应", value.responseBodyLanguage, value.responseHeaders]]) {
    if (language === "NONE") continue;
    const type = contentType(headers);
    if (!type) throw new Error(`${side}存在正文时必须声明 Content-Type。`);
    if (!expectedContentType(language, type)) throw new Error(`${side} Content-Type ${type} 与 ${language} 正文不一致。`);
  }
  if (value.verifications.length < 1 || value.verifications.length > 6) throw new Error("验证必须包含 1–6 项。");
  value.verifications.forEach((item, index) => {
    if (!item.label || item.label.length > 120 || /[*\r\n]/u.test(item.label)) throw new Error(`第 ${index + 1} 项验证名称无效。`);
    if (!item.value || item.value.length > 80 || /[`\r\n]/u.test(item.value)) throw new Error(`第 ${index + 1} 项验证结果无效。`);
    validateCopy(item.description, `第 ${index + 1} 项验证说明`, 400);
  });
  const keys = value.verifications.map((item) => item.label.normalize("NFKC").toLocaleLowerCase("en-US"));
  if (new Set(keys).size !== keys.length) throw new Error("同一 HTTP 交换不能包含名称重复的验证项。");
  return value;
}

function quotedCode(value) {
  return value.split("\n").map((line) => `> ${line}`);
}

function headerLines(headers) {
  return headers.length > 0
    ? headers.map((header) => `> - \`${header.name}: ${header.value}\``)
    : ["> - `NONE`"];
}

function bodyLines(language, body, label) {
  const lines = [`> **${label}:** \`${language}\``];
  if (language !== "NONE") lines.push(">", `> ~~~${language}`, ...quotedCode(body), "> ~~~");
  return lines;
}

function serializeHttpExchange(data) {
  const value = validateHttpExchange(data);
  return [
    `> [!http] ${value.title}`,
    `> **METHOD:** \`${value.method}\` · **STATUS:** \`${value.status}\` · **DATE:** \`${value.date}\``,
    ">", "> **PURPOSE**", ">", `> ${value.purpose}`,
    ">", "> **TARGET**", ">", `> \`${value.target}\``,
    ">", "> **REQUEST HEADERS**", ">", ...headerLines(value.requestHeaders),
    ">", ...bodyLines(value.requestBodyLanguage, value.requestBody, "REQUEST BODY"),
    ">", "> **RESPONSE HEADERS**", ">", ...headerLines(value.responseHeaders),
    ">", ...bodyLines(value.responseBodyLanguage, value.responseBody, "RESPONSE BODY"),
    ">", "> **VERIFICATION**", ">",
    ...value.verifications.map((item) => `> - **${item.label}** \`${item.value}\` — ${item.description}`),
  ].join("\n");
}

function parseHttpExchangeMatch(match) {
  if (!match?.[0]) throw new Error("无法解析 Studio HTTP 交换证据。");
  const lines = match[0].replace(/\r\n?/gu, "\n").split("\n").map((line) => {
    if (line === ">") return "";
    if (line.startsWith("> ")) return line.slice(2);
    throw new Error("HTTP 交换引用结构无效。");
  });
  let cursor = 0;
  const next = () => lines[cursor++];
  const expect = (expected) => {
    const actual = next();
    if (actual !== expected) throw new Error(`HTTP 交换缺少固定区段 ${expected || "空行"}。`);
  };
  const marker = /^\[!http\] (.+)$/u.exec(next());
  const metadata = /^\*\*METHOD:\*\* `(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)` · \*\*STATUS:\*\* `([1-5]\d{2})` · \*\*DATE:\*\* `(\d{4}-\d{2}-\d{2})`$/u.exec(next());
  if (!marker || !metadata) throw new Error("HTTP 交换标题或元数据无效。");
  expect(""); expect("**PURPOSE**"); expect("");
  const purpose = next();
  expect(""); expect("**TARGET**"); expect("");
  const targetMatch = /^`([^`]+)`$/u.exec(next());
  if (!targetMatch) throw new Error("TARGET 无效。");
  const readHeaders = (label) => {
    expect(""); expect(`**${label}**`); expect("");
    const headers = [];
    while (lines[cursor]?.startsWith("- `")) {
      const raw = /^- `([^`]+)`$/u.exec(next())?.[1];
      if (!raw) throw new Error(`${label} 行无效。`);
      if (raw.toLocaleUpperCase("en-US") === "NONE") {
        if (headers.length > 0) throw new Error(`${label} 的 NONE 不能与真实字段混用。`);
        return [];
      }
      const separator = raw.indexOf(":");
      if (separator < 1) throw new Error(`${label} 行缺少冒号。`);
      headers.push({ name: raw.slice(0, separator).trim(), value: raw.slice(separator + 1).trim() });
    }
    return headers;
  };
  const readBody = (label) => {
    expect("");
    const bodyLabel = new RegExp(`^\\*\\*${label}:\\*\\* \\x60(NONE|json|text|html|xml|graphql|form)\\x60$`, "u").exec(next());
    if (!bodyLabel) throw new Error(`${label} 标签无效。`);
    if (bodyLabel[1] === "NONE") return { language: "NONE", body: "" };
    expect(""); expect(`~~~${bodyLabel[1]}`);
    const content = [];
    while (cursor < lines.length && lines[cursor] !== "~~~") content.push(next());
    expect("~~~");
    return { language: bodyLabel[1], body: content.join("\n") };
  };
  const requestHeaders = readHeaders("REQUEST HEADERS");
  const request = readBody("REQUEST BODY");
  const responseHeaders = readHeaders("RESPONSE HEADERS");
  const response = readBody("RESPONSE BODY");
  expect(""); expect("**VERIFICATION**"); expect("");
  const verifications = [];
  while (cursor < lines.length) {
    const item = /^- \*\*([^*]+)\*\* `([^`]+)` — (.+)$/u.exec(next());
    if (!item) throw new Error("HTTP 验证清单无效。");
    verifications.push({ label: item[1], value: item[2], description: item[3] });
  }
  return validateHttpExchange({
    title: marker[1], method: metadata[1], status: metadata[2], date: metadata[3], purpose,
    target: targetMatch[1], requestHeaders, requestBodyLanguage: request.language,
    requestBody: request.body, responseHeaders, responseBodyLanguage: response.language,
    responseBody: response.body, verifications,
  });
}

function previewHeaders(h, headers, side) {
  return h("div", { className: `markdown-http-headers markdown-http-${side}-headers` },
    h("header", { className: "markdown-http-ledger-header" },
      h("span", { className: "markdown-http-ledger-label" }, `${side.toLocaleUpperCase("en-US")} HEADERS`),
      h("span", { className: "markdown-http-ledger-count" }, String(headers.length).padStart(2, "0")),
    ),
    headers.length === 0
      ? h("p", { className: "markdown-http-empty" }, "NONE / NO PUBLISHED HEADERS")
      : h("dl", { className: "markdown-http-header-list" }, ...headers.flatMap((header) => [
          h("dt", { className: "markdown-http-header-name" }, header.name),
          h("dd", { className: "markdown-http-header-value" }, header.value),
        ])),
  );
}

function previewBody(h, language, body, side) {
  return h("div", { className: `markdown-http-body markdown-http-${side}-body` },
    h("header", { className: "markdown-http-ledger-header" },
      h("span", { className: "markdown-http-ledger-label" }, `${side.toLocaleUpperCase("en-US")} BODY`),
      h("span", { className: "markdown-http-body-language" }, language.toLocaleUpperCase("en-US")),
    ),
    language === "NONE"
      ? h("p", { className: "markdown-http-empty" }, "NONE / NO PUBLISHED BODY")
      : h("pre", { className: "markdown-http-pre" }, h("code", { className: `language-${language} markdown-http-code` }, body)),
  );
}

export function createStudioHttpEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") throw new Error("Studio HTTP 交换组件缺少 React 运行时。");
  const headerFields = [
    { label: "字段名", name: "name", widget: "string", hint: "禁止 Authorization、Cookie、API key、token、secret 等敏感字段。" },
    { label: "脱敏值", name: "value", widget: "string" },
  ];
  return {
    collapsed: false,
    id: STUDIO_HTTP_EDITOR_ID,
    label: "HTTP 请求 / 响应证据",
    fields: [
      { label: "交换标题", name: "title", widget: "string", pattern: ["^[^\\[\\]\\r\\n]{1,120}$", "填写 1–120 字符的单行标题"] },
      { label: "请求方法", name: "method", widget: "select", options: STUDIO_HTTP_METHODS, default: "GET" },
      { label: "响应状态", name: "status", widget: "number", value_type: "int", min: 100, max: 599, default: 200 },
      { label: "观察日期", name: "date", widget: "datetime", format: "YYYY-MM-DD", time_format: false, picker_utc: false, hint: "只记录已发生的交换；完整发布预检会拒绝未来日期。" },
      { label: "记录目的 / Purpose", name: "purpose", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单段目的"] },
      { label: "目标 URL / 已脱敏", name: "target", widget: "string", hint: "只允许 HTTPS；不要填写 token、key、session 等敏感查询参数。" },
      { label: "安全请求头", label_singular: "请求头", name: "requestHeaders", widget: "list", required: false, max: 10, allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false, summary: "{{fields.name}}", fields: headerFields },
      { label: "请求正文类型", name: "requestBodyLanguage", widget: "select", options: STUDIO_HTTP_BODY_LANGUAGES, default: "NONE", hint: "GET、HEAD、OPTIONS 必须选 NONE；有正文时需添加匹配的 Content-Type。" },
      { label: "请求正文 / 脱敏文本", name: "requestBody", widget: "code", output_code_only: true, required: false, hint: "类型为 NONE 时留空；这里只保存静态文本，不会发送请求。" },
      { label: "安全响应头", label_singular: "响应头", name: "responseHeaders", widget: "list", required: false, max: 12, allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false, summary: "{{fields.name}}", fields: headerFields },
      { label: "响应正文类型", name: "responseBodyLanguage", widget: "select", options: STUDIO_HTTP_BODY_LANGUAGES, default: "NONE", hint: "HEAD、204、304 响应必须选 NONE；有正文时需添加匹配的 Content-Type。" },
      { label: "响应正文 / 脱敏文本", name: "responseBody", widget: "code", output_code_only: true, required: false, hint: "类型为 NONE 时留空；禁止真实凭据、访问令牌与私钥。" },
      { label: "验证结果", label_singular: "验证", name: "verifications", widget: "list", min: 1, max: 6, allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false, summary: "{{fields.label}} · {{fields.value}}", default: [{ label: "Status and schema", value: "PASS", description: "状态码和脱敏响应结构与预期一致。" }], fields: [
        { label: "检查名称", name: "label", widget: "string" },
        { label: "结果", name: "value", widget: "string" },
        { label: "验证说明", name: "description", widget: "text" },
      ] },
    ],
    pattern: STUDIO_HTTP_PATTERN,
    fromBlock: parseHttpExchangeMatch,
    toBlock: serializeHttpExchange,
    toPreview(data) {
      const value = validateHttpExchange(data);
      const phase = (side, headers, language, body, note, index) => h("section", { className: `markdown-http-phase markdown-http-${side}` },
        h("header", { className: "markdown-http-phase-header" }, h("span", { className: "markdown-http-phase-index" }, index), h("strong", {}, side.toLocaleUpperCase("en-US")), h("span", { className: "markdown-http-phase-note" }, note)),
        previewHeaders(h, headers, side), previewBody(h, language, body, side),
      );
      return h("section", { className: "markdown-http", "data-http-exchange": "exchange-ledger", "data-method": value.method.toLocaleLowerCase("en-US"), "data-status": value.status },
        h("header", { className: "markdown-http-header" },
          h("span", { className: "markdown-http-spine", "aria-hidden": "true" }, "REQUEST → RESPONSE"),
          h("span", { className: "markdown-http-heading" },
            h("span", { className: "markdown-http-meta" }, h("span", { className: "markdown-http-method" }, value.method), h("span", { className: "markdown-http-status" }, value.status), h("time", { className: "markdown-http-date", dateTime: value.date }, value.date)),
            h("strong", { className: "markdown-http-title" }, value.title),
          ),
        ),
        h("div", { className: "markdown-http-context" },
          h("div", { className: "markdown-http-purpose" }, h("span", { className: "markdown-http-kicker" }, "PURPOSE"), h("div", { className: "markdown-http-purpose-copy" }, value.purpose)),
          h("div", { className: "markdown-http-target" }, h("span", { className: "markdown-http-kicker" }, "TARGET / REDACTED"), h("code", { className: "markdown-http-target-value" }, value.target)),
        ),
        h("div", { className: "markdown-http-flow" },
          phase("request", value.requestHeaders, value.requestBodyLanguage, value.requestBody, "STATIC / REDACTED", "01"),
          h("span", { className: "markdown-http-transit", "aria-hidden": "true" }, "↓"),
          phase("response", value.responseHeaders, value.responseBodyLanguage, value.responseBody, `${value.status} / OBSERVED`, "02"),
        ),
        h("div", { className: "markdown-http-verifications" },
          h("header", { className: "markdown-http-ledger-header" }, h("span", { className: "markdown-http-ledger-label" }, "VERIFICATION"), h("span", { className: "markdown-http-ledger-count" }, String(value.verifications.length).padStart(2, "0"))),
          h("ul", { className: "markdown-http-verification-list" }, ...value.verifications.map((item, index) => h("li", { className: "markdown-http-verification", key: `${item.label}-${index}` }, h("strong", { className: "markdown-http-verification-label" }, item.label), h("code", { className: "markdown-http-verification-value" }, item.value), h("span", { className: "markdown-http-verification-copy" }, item.description)))),
        ),
      );
    },
  };
}

export function registerStudioHttpEditor({ CMS = globalThis.CMS, documentRef = globalThis.document, h = globalThis.h } = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") throw new Error("Studio HTTP 交换组件无法访问 Decap 注册表。");
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioHttpEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.httpEditor = "registered";
  return definition;
}
