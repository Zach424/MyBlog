export const STUDIO_CODE_CHANGE_EDITOR_ID = "myblog-codechange";
export const STUDIO_CODE_CHANGE_MODES = ["UNIFIED", "BEFORE_AFTER"];
export const STUDIO_CODE_CHANGE_FILE_STATUSES = ["ADDED", "MODIFIED", "DELETED", "RENAMED"];
export const STUDIO_CODE_CHANGE_LANGUAGES = [
  "bash", "css", "html", "javascript", "js", "json", "jsx", "markdown", "md",
  "powershell", "shell", "sh", "text", "ts", "tsx", "typescript", "yaml", "yml",
];

export const STUDIO_CODE_CHANGE_PATTERN = new RegExp(
  String.raw`^> \[!codechange\] [^\[\]\r\n]{1,120}\r?\n> \*\*MODE:\*\* \x60(?:UNIFIED|BEFORE_AFTER)\x60 · \*\*DATE:\*\* \x60\d{4}-\d{2}-\d{2}\x60\r?\n(?:>[^\r\n]*(?:\r?\n|$)){10,400}?> \*\*RISKS\*\*\r?\n>\r?\n(?:> - \*\*[^*\r\n]{1,120}\*\* — [^\r\n]{1,400}(?:\r?\n|$)){1,6}(?!> - \*\*)`,
  "imu",
);

const REGISTRATION_KEY = "__MYBLOG_CODE_CHANGE_EDITOR_COMPONENT__";
const MODES = new Set(STUDIO_CODE_CHANGE_MODES);
const STATUSES = new Set(STUDIO_CODE_CHANGE_FILE_STATUSES);
const LANGUAGES = new Set(STUDIO_CODE_CHANGE_LANGUAGES);
const SENSITIVE_CODE = [
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/iu,
  /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
];

function plainValue(value) {
  return value && typeof value.toJS === "function" ? value.toJS() : value;
}

function normalizeList(value, fields) {
  const raw = plainValue(value);
  if (!Array.isArray(raw)) return [];
  return raw.map((candidate) => {
    const item = plainValue(candidate) ?? {};
    return Object.fromEntries(
      fields.map((field) => [field, typeof item[field] === "string" ? item[field].trim() : ""]),
    );
  });
}

function normalizedData(data) {
  const value = plainValue(data) ?? {};
  return {
    after: typeof value.after === "string" ? value.after.replace(/\r\n?/gu, "\n").trim() : "",
    before: typeof value.before === "string" ? value.before.replace(/\r\n?/gu, "\n").trim() : "",
    date: typeof value.date === "string" ? value.date.trim() : "",
    diff: typeof value.diff === "string" ? value.diff.replace(/\r\n?/gu, "\n").trim() : "",
    files: normalizeList(value.files, ["status", "path", "description"]),
    language: typeof value.language === "string" ? value.language.trim().toLocaleLowerCase("en-US") : "",
    mode: typeof value.mode === "string" ? value.mode.trim() : "",
    purpose: typeof value.purpose === "string" ? value.purpose.trim() : "",
    risks: normalizeList(value.risks, ["title", "description"]),
    title: typeof value.title === "string" ? value.title.trim() : "",
    verifications: normalizeList(value.verifications, ["label", "value", "description"]),
  };
}

function isRealIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateCopy(value, label, maximum = 800) {
  if (!value || value.length > maximum || /[\r\n]/u.test(value)) {
    throw new Error(`${label}必须是 1–${maximum} 字符的单行内容。`);
  }
  if (/!\[|<[^>]+>|\[\^/u.test(value)) {
    throw new Error(`${label}不能包含图片、HTML 或脚注。`);
  }
}

function validateRepositoryPath(path, label) {
  if (!path || path.length > 180 || path.startsWith("/") || path.endsWith("/") || /[\\\s\u0000-\u001f\u007f<>:"|?*`]/u.test(path)) {
    throw new Error(`${label}必须是 1–180 字符、无空格的仓库相对文件路径。`);
  }
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..") || segments[0]?.toLocaleLowerCase("en-US") === ".git") {
    throw new Error(`${label}不能越界、指向目录或进入 .git。`);
  }
  return path;
}

function fileEndpoints(file, index) {
  if (file.status !== "RENAMED") {
    validateRepositoryPath(file.path, `第 ${index + 1} 个文件路径`);
    return { before: file.path, after: file.path };
  }
  const parts = file.path.split(" -> ");
  if (parts.length !== 2) throw new Error("RENAMED 文件路径必须写成 `旧路径 -> 新路径`。");
  return {
    before: validateRepositoryPath(parts[0], "重命名前路径"),
    after: validateRepositoryPath(parts[1], "重命名后路径"),
  };
}

function uniqueKeys(items, field, label) {
  const keys = items.map((item) => item[field].normalize("NFKC").toLocaleLowerCase("en-US"));
  if (new Set(keys).size !== keys.length) throw new Error(`同一代码变更不能包含重复的${label}。`);
}

function validateCode(value, label) {
  const lines = value.split("\n");
  if (!value || value.length > 16_000 || lines.length > 160) {
    throw new Error(`${label}必须为 1–160 行且不超过 16000 字符。`);
  }
  if (lines.some((line) => line.length > 240)) throw new Error(`${label}单行不能超过 240 字符。`);
  if (lines.some((line) => line.trim() === "~~~")) throw new Error(`${label}不能包含独立的 ~~~ 围栏结束行。`);
  if (SENSITIVE_CODE.some((pattern) => pattern.test(value))) throw new Error(`${label}疑似包含私钥或访问令牌，不能发布。`);
  return lines.length;
}

function validateUnifiedDiff(value, files) {
  validateCode(value, "UNIFIED diff ");
  if (!value.startsWith("diff --git ")) throw new Error("UNIFIED diff 必须从 diff --git 文件头开始。");
  if (/^(?:diff --cc|diff --combined|GIT binary patch|Binary files )/mu.test(value)) {
    throw new Error("UNIFIED diff 不接受 combined diff 或二进制数据。");
  }
  const sections = [...value.matchAll(/^diff --git a\/([^\r\n]+) b\/([^\r\n]+)$/gmu)];
  if (sections.length !== files.length) throw new Error("FILES 清单数量必须与 UNIFIED diff 文件段数量一致。");
  sections.forEach((match, index) => {
    const endpoints = fileEndpoints(files[index], index);
    if (match[1] !== endpoints.before || match[2] !== endpoints.after) {
      throw new Error(`第 ${index + 1} 个 FILES 路径必须与同位置 diff --git 文件头一致。`);
    }
  });
}

function validateCodeChange(data) {
  const value = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(value.title)) throw new Error("代码变更标题必须是 1–120 字符的单行纯文本。");
  if (!MODES.has(value.mode)) throw new Error(`代码变更模式只允许 ${STUDIO_CODE_CHANGE_MODES.join(" / ")}。`);
  if (!isRealIsoDate(value.date)) throw new Error("代码变更日期必须是真实的 YYYY-MM-DD。");
  validateCopy(value.purpose, "变更目的");
  if (value.files.length < 1 || value.files.length > 4) throw new Error("文件清单必须包含 1–4 项。");
  value.files.forEach((file, index) => {
    if (!STATUSES.has(file.status)) throw new Error(`第 ${index + 1} 个文件状态无效。`);
    fileEndpoints(file, index);
    validateCopy(file.description, `第 ${index + 1} 个文件说明`, 400);
  });
  uniqueKeys(value.files.map((file, index) => ({ key: fileEndpoints(file, index).after })), "key", "目标路径");
  if (value.mode === "UNIFIED") {
    validateUnifiedDiff(value.diff, value.files);
  } else {
    if (value.files.length !== 1 || value.files[0].status !== "MODIFIED") throw new Error("BEFORE_AFTER 模式只允许一个 MODIFIED 文件。");
    if (!LANGUAGES.has(value.language)) throw new Error(`代码语言只允许 ${STUDIO_CODE_CHANGE_LANGUAGES.join(" / ")}。`);
    const beforeLines = validateCode(value.before, "BEFORE 代码 ");
    const afterLines = validateCode(value.after, "AFTER 代码 ");
    if (value.before === value.after) throw new Error("BEFORE 与 AFTER 代码不能完全相同。");
    if (beforeLines + afterLines > 240) throw new Error("BEFORE 与 AFTER 代码合计不能超过 240 行。");
  }
  for (const [label, items] of [["验证", value.verifications], ["风险", value.risks]]) {
    if (items.length < 1 || items.length > 6) throw new Error(`${label}必须包含 1–6 项。`);
  }
  value.verifications.forEach((item, index) => {
    if (!item.label || item.label.length > 120 || /[*\r\n]/u.test(item.label)) throw new Error(`第 ${index + 1} 项验证名称无效。`);
    if (!item.value || item.value.length > 80 || /[`\r\n]/u.test(item.value)) throw new Error(`第 ${index + 1} 项验证结果无效。`);
    validateCopy(item.description, `第 ${index + 1} 项验证说明`, 400);
  });
  value.risks.forEach((item, index) => {
    if (!item.title || item.title.length > 120 || /[*\r\n]/u.test(item.title)) throw new Error(`第 ${index + 1} 项风险名称无效。`);
    validateCopy(item.description, `第 ${index + 1} 项风险说明`, 400);
  });
  uniqueKeys(value.verifications, "label", "验证项");
  uniqueKeys(value.risks, "title", "风险项");
  return value;
}

function quotedCode(value) {
  return value.split("\n").map((line) => `> ${line}`);
}

function serializeCodeChange(data) {
  const value = validateCodeChange(data);
  const lines = [
    `> [!codechange] ${value.title}`,
    `> **MODE:** \`${value.mode}\` · **DATE:** \`${value.date}\``,
    ">", "> **PURPOSE**", ">", `> ${value.purpose}`,
    ">", "> **FILES**", ">",
    ...value.files.map((file) => `> - \`${file.status}\` \`${file.path}\` — ${file.description}`),
    ">", "> **CHANGE**", ">",
  ];
  if (value.mode === "UNIFIED") {
    lines.push("> **DIFF**", ">", "> ~~~diff", ...quotedCode(value.diff), "> ~~~", ">");
  } else {
    lines.push(
      `> **BEFORE:** \`${value.language}\``, ">", `> ~~~${value.language}`, ...quotedCode(value.before), "> ~~~", ">",
      `> **AFTER:** \`${value.language}\``, ">", `> ~~~${value.language}`, ...quotedCode(value.after), "> ~~~", ">",
    );
  }
  lines.push(
    "> **VERIFICATION**", ">",
    ...value.verifications.map((item) => `> - **${item.label}** \`${item.value}\` — ${item.description}`),
    ">", "> **RISKS**", ">",
    ...value.risks.map((item) => `> - **${item.title}** — ${item.description}`),
  );
  return lines.join("\n");
}

function parseCodeChangeMatch(match) {
  if (!match?.[0]) throw new Error("无法解析 Studio 代码变更证据。");
  const lines = match[0].replace(/\r\n?/gu, "\n").split("\n").map((line) => {
    if (line === ">") return "";
    if (line.startsWith("> ")) return line.slice(2);
    throw new Error("代码变更引用结构无效。");
  });
  let cursor = 0;
  const next = () => lines[cursor++];
  const expect = (expected) => {
    const actual = next();
    if (actual !== expected) throw new Error(`代码变更缺少固定区段 ${expected || "空行"}。`);
  };
  const marker = /^\[!codechange\] (.+)$/u.exec(next());
  const metadata = /^\*\*MODE:\*\* `(UNIFIED|BEFORE_AFTER)` · \*\*DATE:\*\* `(\d{4}-\d{2}-\d{2})`$/u.exec(next());
  if (!marker || !metadata) throw new Error("代码变更标题或元数据无效。");
  expect(""); expect("**PURPOSE**"); expect("");
  const purpose = next();
  expect(""); expect("**FILES**"); expect("");
  const files = [];
  while (lines[cursor]?.startsWith("- `")) {
    const file = /^- `(ADDED|MODIFIED|DELETED|RENAMED)` `([^`]+)` — (.+)$/u.exec(next());
    if (!file) throw new Error("代码变更文件清单无效。");
    files.push({ status: file[1], path: file[2], description: file[3] });
  }
  expect(""); expect("**CHANGE**"); expect("");
  const parsed = { title: marker[1], mode: metadata[1], date: metadata[2], purpose, files };
  const readFence = (language) => {
    expect(`~~~${language}`);
    const content = [];
    while (cursor < lines.length && lines[cursor] !== "~~~") content.push(next());
    expect("~~~");
    return content.join("\n");
  };
  if (parsed.mode === "UNIFIED") {
    expect("**DIFF**"); expect("");
    parsed.diff = readFence("diff");
    expect("");
  } else {
    const beforeLabel = /^\*\*BEFORE:\*\* `([^`]+)`$/u.exec(next());
    if (!beforeLabel) throw new Error("BEFORE 标签无效。");
    expect(""); parsed.language = beforeLabel[1]; parsed.before = readFence(parsed.language); expect("");
    expect(`**AFTER:** \`${parsed.language}\``); expect(""); parsed.after = readFence(parsed.language); expect("");
  }
  expect("**VERIFICATION**"); expect("");
  parsed.verifications = [];
  while (lines[cursor]?.startsWith("- **")) {
    const item = /^- \*\*([^*]+)\*\* `([^`]+)` — (.+)$/u.exec(lines[cursor]);
    if (!item) break;
    next(); parsed.verifications.push({ label: item[1], value: item[2], description: item[3] });
  }
  expect(""); expect("**RISKS**"); expect("");
  parsed.risks = [];
  while (cursor < lines.length) {
    const item = /^- \*\*([^*]+)\*\* — (.+)$/u.exec(next());
    if (!item) throw new Error("代码变更风险清单无效。");
    parsed.risks.push({ title: item[1], description: item[2] });
  }
  return validateCodeChange(parsed);
}

function ledger(h, label, items, className, renderer) {
  return h("div", { className: `markdown-codechange-ledger ${className}` },
    h("header", { className: "markdown-codechange-ledger-header" },
      h("span", { className: "markdown-codechange-ledger-label" }, label),
      h("span", { className: "markdown-codechange-ledger-count" }, String(items.length).padStart(2, "0")),
    ),
    h("ul", { className: "markdown-codechange-ledger-list" }, ...items.map(renderer)),
  );
}

export function createStudioCodeChangeEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") throw new Error("Studio 代码变更组件缺少 React 运行时。");
  return {
    collapsed: false,
    id: STUDIO_CODE_CHANGE_EDITOR_ID,
    label: "代码变更证据",
    fields: [
      { label: "变更标题", name: "title", widget: "string", pattern: ["^[^\\[\\]\\r\\n]{1,120}$", "填写 1–120 字符的单行标题"] },
      { label: "呈现模式", name: "mode", widget: "select", options: [{ label: "完整 unified diff", value: "UNIFIED" }, { label: "修改前 / 修改后", value: "BEFORE_AFTER" }], default: "UNIFIED", hint: "跨文件或需要完整上下文时使用 unified diff；单文件小改动可用 before/after。" },
      { label: "完成日期", name: "date", widget: "datetime", format: "YYYY-MM-DD", time_format: false, picker_utc: false, hint: "只记录已经完成的修改；完整发布预检会拒绝未来日期。" },
      { label: "变更目的 / Purpose", name: "purpose", widget: "text", pattern: ["^[^\\r\\n]{1,800}$", "填写 1–800 字符的单段目的"] },
      {
        label: "文件审阅清单", label_singular: "文件", name: "files", widget: "list", min: 1, max: 4,
        allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false, summary: "{{fields.status}} · {{fields.path}}",
        default: [{ status: "MODIFIED", path: "lib/example.ts", description: "说明这个文件承担的变更。" }],
        fields: [
          { label: "状态", name: "status", widget: "select", options: STUDIO_CODE_CHANGE_FILE_STATUSES, default: "MODIFIED" },
          { label: "仓库相对路径", name: "path", widget: "string", hint: "RENAMED 使用 old/path.ts -> new/path.ts；其余状态只填一个路径。" },
          { label: "文件说明", name: "description", widget: "text", pattern: ["^[^\\r\\n]{1,400}$", "填写 1–400 字符的单行说明"] },
        ],
      },
      { label: "Unified diff", name: "diff", widget: "code", default_language: "diff", allow_language_selection: false, output_code_only: true, condition: { field: "mode", value: "UNIFIED" }, hint: "粘贴完整 git diff：需包含 diff --git、文件头、hunk 与变更行；不会执行或写回补丁。" },
      { label: "代码语言", name: "language", widget: "select", options: STUDIO_CODE_CHANGE_LANGUAGES, default: "ts", condition: { field: "mode", value: "BEFORE_AFTER" } },
      { label: "修改前 / Before", name: "before", widget: "code", output_code_only: true, condition: { field: "mode", value: "BEFORE_AFTER" } },
      { label: "修改后 / After", name: "after", widget: "code", output_code_only: true, condition: { field: "mode", value: "BEFORE_AFTER" } },
      {
        label: "验证结果", label_singular: "验证", name: "verifications", widget: "list", min: 1, max: 6,
        allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false, summary: "{{fields.label}} · {{fields.value}}",
        default: [{ label: "Unit tests", value: "8/8", description: "记录与这次改动直接相关的验证结果。" }],
        fields: [
          { label: "检查名称", name: "label", widget: "string" },
          { label: "结果", name: "value", widget: "string" },
          { label: "验证说明", name: "description", widget: "text" },
        ],
      },
      {
        label: "已知风险", label_singular: "风险", name: "risks", widget: "list", min: 1, max: 6,
        allow_add: true, allow_remove: true, allow_reorder: true, collapsed: false, summary: "{{fields.title}}",
        default: [{ title: "回归范围", description: "说明尚未覆盖或需要持续观察的边界。" }],
        fields: [
          { label: "风险名称", name: "title", widget: "string" },
          { label: "风险说明", name: "description", widget: "text" },
        ],
      },
    ],
    pattern: STUDIO_CODE_CHANGE_PATTERN,
    fromBlock: parseCodeChangeMatch,
    toBlock: serializeCodeChange,
    toPreview(data) {
      const value = validateCodeChange(data);
      const codeStages = value.mode === "UNIFIED"
        ? [h("div", { className: "markdown-codechange-code-stage markdown-codechange-unified" }, h("div", { className: "markdown-codechange-code-label" }, "UNIFIED DIFF"), h("pre", { className: "markdown-codechange-pre" }, h("code", { className: "language-diff markdown-codechange-code" }, value.diff)))]
        : [
            h("div", { className: "markdown-codechange-code-stage markdown-codechange-before" }, h("div", { className: "markdown-codechange-code-label" }, "BEFORE"), h("pre", { className: "markdown-codechange-pre" }, h("code", { className: `language-${value.language} markdown-codechange-code` }, value.before))),
            h("div", { className: "markdown-codechange-code-stage markdown-codechange-after" }, h("div", { className: "markdown-codechange-code-label" }, "AFTER"), h("pre", { className: "markdown-codechange-pre" }, h("code", { className: `language-${value.language} markdown-codechange-code` }, value.after))),
          ];
      return h("section", { className: "markdown-codechange", "data-code-change": "review-docket", "data-mode": value.mode.toLocaleLowerCase("en-US").replace("_", "-") },
        h("header", { className: "markdown-codechange-header" },
          h("span", { className: "markdown-codechange-spine", "aria-hidden": "true" }, "CHANGE / REVIEW"),
          h("span", { className: "markdown-codechange-heading" },
            h("span", { className: "markdown-codechange-meta" }, h("span", { className: "markdown-codechange-mode" }, value.mode), h("span", { className: "markdown-codechange-file-count" }, `${String(value.files.length).padStart(2, "0")} FILES`), h("time", { className: "markdown-codechange-date", dateTime: value.date }, value.date)),
            h("strong", { className: "markdown-codechange-title" }, value.title),
          ),
        ),
        h("div", { className: "markdown-codechange-purpose" }, h("span", { className: "markdown-codechange-purpose-label" }, "PURPOSE"), h("div", { className: "markdown-codechange-purpose-copy" }, value.purpose)),
        h("div", { className: "markdown-codechange-files" },
          h("header", { className: "markdown-codechange-ledger-header" }, h("span", { className: "markdown-codechange-ledger-label" }, "FILES / REVIEW INDEX"), h("span", { className: "markdown-codechange-ledger-count" }, String(value.files.length).padStart(2, "0"))),
          h("ul", { className: "markdown-codechange-file-list" }, ...value.files.map((file, index) => h("li", { className: "markdown-codechange-file", "data-file-status": file.status.toLocaleLowerCase("en-US"), key: `${file.path}-${index}` }, h("span", { className: "markdown-codechange-file-status" }, file.status), h("code", { className: "markdown-codechange-file-path" }, file.path), h("span", { className: "markdown-codechange-file-copy" }, file.description)))),
        ),
        h("div", { className: `markdown-codechange-change${value.mode === "BEFORE_AFTER" ? " markdown-codechange-split" : ""}` }, ...codeStages),
        h("div", { className: "markdown-codechange-evidence" },
          ledger(h, "VERIFICATION", value.verifications, "markdown-codechange-verifications", (item, index) => h("li", { className: "markdown-codechange-verification", key: `${item.label}-${index}` }, h("strong", { className: "markdown-codechange-verification-label" }, item.label), h("code", { className: "markdown-codechange-verification-value" }, item.value), h("span", { className: "markdown-codechange-verification-copy" }, item.description))),
          ledger(h, "KNOWN RISKS", value.risks, "markdown-codechange-risks", (item, index) => h("li", { className: "markdown-codechange-risk", key: `${item.title}-${index}` }, h("strong", { className: "markdown-codechange-risk-title" }, item.title), h("span", { className: "markdown-codechange-risk-copy" }, item.description))),
        ),
      );
    },
  };
}

export function registerStudioCodeChangeEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") throw new Error("Studio 代码变更组件无法访问 Decap 注册表。");
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioCodeChangeEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.codeChangeEditor = "registered";
  return definition;
}
