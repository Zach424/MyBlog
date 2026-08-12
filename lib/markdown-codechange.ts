import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode } from "./content/markdown.ts";

export const MARKDOWN_CODE_CHANGE_MAX_COUNT = 2;
export const MARKDOWN_CODE_CHANGE_MIN_FILES = 1;
export const MARKDOWN_CODE_CHANGE_MAX_FILES = 4;
export const MARKDOWN_CODE_CHANGE_MAX_TOTAL_FILES = 6;
export const MARKDOWN_CODE_CHANGE_MIN_ITEMS = 1;
export const MARKDOWN_CODE_CHANGE_MAX_ITEMS = 6;
export const MARKDOWN_CODE_CHANGE_MAX_TOTAL_LINES = 240;
export const MARKDOWN_CODE_CHANGE_MAX_LINES = 160;
export const MARKDOWN_CODE_CHANGE_MAX_CODE_LENGTH = 16_000;
export const MARKDOWN_CODE_CHANGE_MAX_CODE_LINE_LENGTH = 240;
export const MARKDOWN_CODE_CHANGE_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_CODE_CHANGE_MAX_COPY_LENGTH = 800;
export const MARKDOWN_CODE_CHANGE_MAX_ITEM_TITLE_LENGTH = 120;
export const MARKDOWN_CODE_CHANGE_MAX_ITEM_VALUE_LENGTH = 80;
export const MARKDOWN_CODE_CHANGE_MAX_ITEM_DESCRIPTION_LENGTH = 400;
export const MARKDOWN_CODE_CHANGE_MODES = ["UNIFIED", "BEFORE_AFTER"] as const;
export const MARKDOWN_CODE_CHANGE_FILE_STATUSES = [
  "ADDED",
  "MODIFIED",
  "DELETED",
  "RENAMED",
] as const;
export const MARKDOWN_CODE_CHANGE_LANGUAGES = [
  "bash",
  "css",
  "html",
  "javascript",
  "js",
  "json",
  "jsx",
  "markdown",
  "md",
  "powershell",
  "shell",
  "sh",
  "text",
  "ts",
  "tsx",
  "typescript",
  "yaml",
  "yml",
] as const;

export type MarkdownCodeChangeMode = (typeof MARKDOWN_CODE_CHANGE_MODES)[number];
export type MarkdownCodeChangeFileStatus =
  (typeof MARKDOWN_CODE_CHANGE_FILE_STATUSES)[number];

export interface MarkdownCodeChangeFile {
  description: string;
  line?: number;
  path: string;
  status: MarkdownCodeChangeFileStatus;
}

export interface MarkdownCodeChangeVerification {
  description: string;
  label: string;
  line?: number;
  value: string;
}

export interface MarkdownCodeChangeRisk {
  description: string;
  line?: number;
  title: string;
}

export type MarkdownCodeChangeSource = {
  date: string;
  files: MarkdownCodeChangeFile[];
  line?: number;
  mode: MarkdownCodeChangeMode;
  purpose: string;
  risks: MarkdownCodeChangeRisk[];
  title: string;
  verifications: MarkdownCodeChangeVerification[];
} & (
  | { after: string; before: string; language: string; mode: "BEFORE_AFTER" }
  | { diff: string; mode: "UNIFIED" }
);

export interface MarkdownCodeChangeIssue {
  kind: "codechange";
  line?: number;
  message: string;
}

export interface MarkdownCodeChangeOptions {
  maximumDate?: string;
}

class MarkdownCodeChangeError extends Error {
  line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const CODE_CHANGE_MARKER = /^\[!codechange\](?:[ \t]+([^\r\n]*?))?[ \t]*\r?\n$/iu;
const POTENTIAL_CODE_CHANGE_MARKER = /^\[!codechange\](?:[+\-]|[ \t]|$)/iu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const MODE = new Set<string>(MARKDOWN_CODE_CHANGE_MODES);
const FILE_STATUS = new Set<string>(MARKDOWN_CODE_CHANGE_FILE_STATUSES);
const LANGUAGE = new Set<string>(MARKDOWN_CODE_CHANGE_LANGUAGES);
const SENSITIVE_CODE = [
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/iu,
  /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
];

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 320);
}

function visibleMarkdownChildren(node: MarkdownNode) {
  return (node.children ?? []).filter(
    (child) => child.type !== "text" || (child.value ?? "").trim() !== "",
  );
}

function codeChangeMarkerNode(blockquote: MarkdownNode) {
  if (blockquote.type !== "blockquote") return undefined;
  const first = visibleMarkdownChildren(blockquote)[0];
  if (first?.type !== "paragraph") return undefined;
  const marker = first.children?.[0];
  return marker?.type === "text" && POTENTIAL_CODE_CHANGE_MARKER.test(marker.value ?? "")
    ? marker
    : undefined;
}

function inlineText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode" || node.type === "inlineMath") {
    return node.value ?? "";
  }
  return (node.children ?? []).map(inlineText).join("");
}

function isRealIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateInline(node: MarkdownNode, line?: number) {
  if (node.type === "text" || node.type === "inlineCode" || node.type === "inlineMath") return;
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
  throw new MarkdownCodeChangeError(
    "代码变更证据只接受文本、行内代码、简单强调、链接和行内公式；图片、HTML、脚注、硬换行与嵌套内容请移到记录外。",
    line,
  );
}

function isLabel(node: MarkdownNode, label: string) {
  const children = visibleMarkdownChildren(node);
  const strong = children[0];
  return node.type === "paragraph" &&
    children.length === 1 &&
    strong?.type === "strong" &&
    inlineText(strong) === label;
}

function parseCopy(node: MarkdownNode, label: string) {
  const line = node.position?.start?.line;
  if (node.type !== "paragraph") {
    throw new MarkdownCodeChangeError(`${label} 必须是一个独立段落。`, line);
  }
  for (const child of node.children ?? []) validateInline(child, line);
  const value = inlineText(node).replace(/\s+/gu, " ").trim();
  if (!value || value.length > MARKDOWN_CODE_CHANGE_MAX_COPY_LENGTH) {
    throw new MarkdownCodeChangeError(
      `${label} 必须为 1–${MARKDOWN_CODE_CHANGE_MAX_COPY_LENGTH} 个字符。`,
      line,
    );
  }
  return value;
}

function parseMetadata(paragraph: MarkdownNode) {
  const line = paragraph.position?.start?.line;
  const children = paragraph.children ?? [];
  const [marker, modeLabel, modeSpace, modeNode, separator, dateLabel, dateSpace, dateNode] = children;
  const markerMatch = marker?.type === "text"
    ? CODE_CHANGE_MARKER.exec(marker.value ?? "")
    : undefined;
  if (!markerMatch) {
    throw new MarkdownCodeChangeError(
      "代码变更标记必须写成静态的 > [!codechange] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = markerMatch[1]?.trim() ?? "";
  if (!title || title.length > MARKDOWN_CODE_CHANGE_MAX_TITLE_LENGTH) {
    throw new MarkdownCodeChangeError(
      `代码变更标题必须为 1–${MARKDOWN_CODE_CHANGE_MAX_TITLE_LENGTH} 个字符。`,
      line,
    );
  }
  if (
    children.length !== 8 ||
    modeLabel?.type !== "strong" ||
    inlineText(modeLabel) !== "MODE:" ||
    modeSpace?.type !== "text" ||
    modeSpace.value !== " " ||
    modeNode?.type !== "inlineCode" ||
    separator?.type !== "text" ||
    separator.value !== " · " ||
    dateLabel?.type !== "strong" ||
    inlineText(dateLabel) !== "DATE:" ||
    dateSpace?.type !== "text" ||
    dateSpace.value !== " " ||
    dateNode?.type !== "inlineCode"
  ) {
    throw new MarkdownCodeChangeError(
      "代码变更元数据必须写成 **MODE:** `UNIFIED` · **DATE:** `YYYY-MM-DD`。",
      line,
    );
  }
  const mode = (modeNode.value ?? "").trim();
  if (!MODE.has(mode)) {
    throw new MarkdownCodeChangeError(
      `代码变更模式只允许 ${MARKDOWN_CODE_CHANGE_MODES.join(" / ")}。`,
      line,
    );
  }
  const date = (dateNode.value ?? "").trim();
  if (!isRealIsoDate(date)) {
    throw new MarkdownCodeChangeError("代码变更日期必须是真实的 YYYY-MM-DD。", line);
  }
  return { date, mode: mode as MarkdownCodeChangeMode, title };
}

function validateRepositoryPath(path: string, label: string, line?: number) {
  if (
    !path ||
    path.length > 180 ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    /[\\\s\u0000-\u001f\u007f<>:"|?*`]/u.test(path)
  ) {
    throw new MarkdownCodeChangeError(`${label}必须是 1–180 字符、无空格的仓库相对文件路径。`, line);
  }
  const segments = path.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    segments[0]?.toLocaleLowerCase("en-US") === ".git"
  ) {
    throw new MarkdownCodeChangeError(`${label}不能越界、指向目录或进入 .git。`, line);
  }
  return path;
}

function fileEndpoints(file: MarkdownCodeChangeFile) {
  if (file.status !== "RENAMED") {
    return { after: file.path, before: file.path };
  }
  const parts = file.path.split(" -> ");
  if (parts.length !== 2) {
    throw new MarkdownCodeChangeError(
      "RENAMED 文件路径必须写成 `旧路径 -> 新路径`。",
      file.line,
    );
  }
  return {
    before: validateRepositoryPath(parts[0], "重命名前路径", file.line),
    after: validateRepositoryPath(parts[1], "重命名后路径", file.line),
  };
}

function parseFile(item: MarkdownNode, index: number) {
  const line = item.position?.start?.line;
  const children = visibleMarkdownChildren(item);
  const paragraph = children[0];
  const inline = paragraph?.children ?? [];
  const [statusNode, pathSpace, pathNode, separator, ...descriptionNodes] = inline;
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    children.length !== 1 ||
    paragraph?.type !== "paragraph" ||
    statusNode?.type !== "inlineCode" ||
    pathSpace?.type !== "text" ||
    pathSpace.value !== " " ||
    pathNode?.type !== "inlineCode" ||
    separator?.type !== "text" ||
    !(separator.value ?? "").startsWith(" — ")
  ) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 个文件必须写成 - \`MODIFIED\` \`path/to/file\` — 说明。`,
      line,
    );
  }
  const status = (statusNode.value ?? "").trim();
  if (!FILE_STATUS.has(status)) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 个文件状态只允许 ${MARKDOWN_CODE_CHANGE_FILE_STATUSES.join(" / ")}。`,
      line,
    );
  }
  const path = (pathNode.value ?? "").trim();
  const file = { path, status: status as MarkdownCodeChangeFileStatus, ...(line ? { line } : {}) };
  if (file.status === "RENAMED") fileEndpoints({ ...file, description: "" });
  else validateRepositoryPath(path, `第 ${index + 1} 个文件路径`, line);
  const descriptionPrefix = { ...separator, value: (separator.value ?? "").slice(3) };
  const copyNodes = [descriptionPrefix, ...descriptionNodes];
  for (const child of copyNodes) validateInline(child, line);
  const description = copyNodes.map(inlineText).join("").replace(/\s+/gu, " ").trim();
  if (!description || description.length > MARKDOWN_CODE_CHANGE_MAX_ITEM_DESCRIPTION_LENGTH) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 个文件说明必须为 1–${MARKDOWN_CODE_CHANGE_MAX_ITEM_DESCRIPTION_LENGTH} 个字符。`,
      line,
    );
  }
  return { ...file, description } satisfies MarkdownCodeChangeFile;
}

function parseVerification(item: MarkdownNode, index: number) {
  const line = item.position?.start?.line;
  const children = visibleMarkdownChildren(item);
  const paragraph = children[0];
  const inline = paragraph?.children ?? [];
  const [labelNode, valueSpace, valueNode, separator, ...descriptionNodes] = inline;
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    children.length !== 1 ||
    paragraph?.type !== "paragraph" ||
    labelNode?.type !== "strong" ||
    valueSpace?.type !== "text" ||
    valueSpace.value !== " " ||
    valueNode?.type !== "inlineCode" ||
    separator?.type !== "text" ||
    !(separator.value ?? "").startsWith(" — ")
  ) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 项验证必须写成 - **检查名** \`结果\` — 说明。`,
      line,
    );
  }
  const label = inlineText(labelNode).replace(/\s+/gu, " ").trim();
  const value = (valueNode.value ?? "").replace(/\s+/gu, " ").trim();
  if (!label || label.length > MARKDOWN_CODE_CHANGE_MAX_ITEM_TITLE_LENGTH) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 项验证名称必须为 1–${MARKDOWN_CODE_CHANGE_MAX_ITEM_TITLE_LENGTH} 个字符。`,
      line,
    );
  }
  if (!value || value.length > MARKDOWN_CODE_CHANGE_MAX_ITEM_VALUE_LENGTH) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 项验证结果必须为 1–${MARKDOWN_CODE_CHANGE_MAX_ITEM_VALUE_LENGTH} 个字符。`,
      line,
    );
  }
  const descriptionPrefix = { ...separator, value: (separator.value ?? "").slice(3) };
  const copyNodes = [descriptionPrefix, ...descriptionNodes];
  for (const child of copyNodes) validateInline(child, line);
  const description = copyNodes.map(inlineText).join("").replace(/\s+/gu, " ").trim();
  if (!description || description.length > MARKDOWN_CODE_CHANGE_MAX_ITEM_DESCRIPTION_LENGTH) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 项验证说明必须为 1–${MARKDOWN_CODE_CHANGE_MAX_ITEM_DESCRIPTION_LENGTH} 个字符。`,
      line,
    );
  }
  return { description, label, ...(line ? { line } : {}), value };
}

function parseRisk(item: MarkdownNode, index: number) {
  const line = item.position?.start?.line;
  const children = visibleMarkdownChildren(item);
  const paragraph = children[0];
  const inline = paragraph?.children ?? [];
  const [titleNode, separator, ...descriptionNodes] = inline;
  if (
    item.type !== "listItem" ||
    typeof item.checked === "boolean" ||
    children.length !== 1 ||
    paragraph?.type !== "paragraph" ||
    titleNode?.type !== "strong" ||
    separator?.type !== "text" ||
    !(separator.value ?? "").startsWith(" — ")
  ) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 项风险必须写成 - **风险名** — 说明。`,
      line,
    );
  }
  const title = inlineText(titleNode).replace(/\s+/gu, " ").trim();
  if (!title || title.length > MARKDOWN_CODE_CHANGE_MAX_ITEM_TITLE_LENGTH) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 项风险名称必须为 1–${MARKDOWN_CODE_CHANGE_MAX_ITEM_TITLE_LENGTH} 个字符。`,
      line,
    );
  }
  const descriptionPrefix = { ...separator, value: (separator.value ?? "").slice(3) };
  const copyNodes = [descriptionPrefix, ...descriptionNodes];
  for (const child of copyNodes) validateInline(child, line);
  const description = copyNodes.map(inlineText).join("").replace(/\s+/gu, " ").trim();
  if (!description || description.length > MARKDOWN_CODE_CHANGE_MAX_ITEM_DESCRIPTION_LENGTH) {
    throw new MarkdownCodeChangeError(
      `第 ${index + 1} 项风险说明必须为 1–${MARKDOWN_CODE_CHANGE_MAX_ITEM_DESCRIPTION_LENGTH} 个字符。`,
      line,
    );
  }
  return { description, ...(line ? { line } : {}), title };
}

function parseList<T>(
  node: MarkdownNode,
  label: string,
  minimum: number,
  maximum: number,
  parseItem: (item: MarkdownNode, index: number) => T,
) {
  const line = node.position?.start?.line;
  if (node.type !== "list" || node.ordered !== false) {
    throw new MarkdownCodeChangeError(`${label} 必须使用无序列表。`, line);
  }
  const items = visibleMarkdownChildren(node);
  if (items.length < minimum || items.length > maximum) {
    throw new MarkdownCodeChangeError(`${label} 必须包含 ${minimum}–${maximum} 项。`, line);
  }
  return items.map(parseItem);
}

function unique(items: string[], message: string, line?: number) {
  const keys = items.map((item) => item.normalize("NFKC").toLocaleLowerCase("en-US"));
  if (new Set(keys).size !== keys.length) throw new MarkdownCodeChangeError(message, line);
}

function validateCode(value: string, label: string, line?: number) {
  const normalized = value.replace(/\r\n?/gu, "\n");
  const lines = normalized.split("\n");
  if (
    !normalized ||
    normalized.length > MARKDOWN_CODE_CHANGE_MAX_CODE_LENGTH ||
    lines.length > MARKDOWN_CODE_CHANGE_MAX_LINES
  ) {
    throw new MarkdownCodeChangeError(
      `${label}必须为 1–${MARKDOWN_CODE_CHANGE_MAX_LINES} 行且不超过 ${MARKDOWN_CODE_CHANGE_MAX_CODE_LENGTH} 字符。`,
      line,
    );
  }
  if (lines.some((sourceLine) => sourceLine.length > MARKDOWN_CODE_CHANGE_MAX_CODE_LINE_LENGTH)) {
    throw new MarkdownCodeChangeError(
      `${label}单行不能超过 ${MARKDOWN_CODE_CHANGE_MAX_CODE_LINE_LENGTH} 字符。`,
      line,
    );
  }
  if (/[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) {
    throw new MarkdownCodeChangeError(`${label}不能包含控制字符。`, line);
  }
  if (SENSITIVE_CODE.some((pattern) => pattern.test(normalized))) {
    throw new MarkdownCodeChangeError(`${label}疑似包含私钥或访问令牌，不能发布。`, line);
  }
  if (lines.some((sourceLine) => sourceLine.trim() === "~~~")) {
    throw new MarkdownCodeChangeError(`${label}不能包含独立的 ~~~ 围栏结束行。`, line);
  }
  return { lines: lines.length, value: normalized };
}

function unifiedSections(diff: string, line?: number) {
  const headers = [...diff.matchAll(/^diff --git a\/([^\r\n]+) b\/([^\r\n]+)$/gmu)];
  if (headers.length < MARKDOWN_CODE_CHANGE_MIN_FILES || headers.length > MARKDOWN_CODE_CHANGE_MAX_FILES) {
    throw new MarkdownCodeChangeError(
      `UNIFIED diff 必须包含 ${MARKDOWN_CODE_CHANGE_MIN_FILES}–${MARKDOWN_CODE_CHANGE_MAX_FILES} 个完整 diff --git 文件段。`,
      line,
    );
  }
  if (!diff.startsWith("diff --git ")) {
    throw new MarkdownCodeChangeError("UNIFIED diff 必须从 diff --git 文件头开始。", line);
  }
  return headers.map((header, index) => ({
    after: validateRepositoryPath(header[2], "diff after 路径", line),
    before: validateRepositoryPath(header[1], "diff before 路径", line),
    body: diff.slice(header.index!, headers[index + 1]?.index ?? diff.length),
  }));
}

function validateUnifiedDiff(diff: string, files: MarkdownCodeChangeFile[], line?: number) {
  const validated = validateCode(diff, "UNIFIED diff ", line);
  if (/^(?:diff --cc|diff --combined|GIT binary patch|Binary files )/mu.test(validated.value)) {
    throw new MarkdownCodeChangeError("UNIFIED diff 不接受 combined diff、二进制补丁或二进制文件摘要。", line);
  }
  const sections = unifiedSections(validated.value, line);
  if (sections.length !== files.length) {
    throw new MarkdownCodeChangeError("FILES 清单数量必须与 UNIFIED diff 文件段数量一致。", line);
  }
  sections.forEach((section, index) => {
    const declared = files[index];
    const endpoint = fileEndpoints(declared);
    if (endpoint.before !== section.before || endpoint.after !== section.after) {
      throw new MarkdownCodeChangeError(
        `第 ${index + 1} 个 FILES 路径必须与同位置 diff --git 文件头一致。`,
        declared.line ?? line,
      );
    }
    const hasNew = /^new file mode \d+$/mu.test(section.body);
    const hasDeleted = /^deleted file mode \d+$/mu.test(section.body);
    const renameFrom = /^rename from ([^\r\n]+)$/mu.exec(section.body)?.[1];
    const renameTo = /^rename to ([^\r\n]+)$/mu.exec(section.body)?.[1];
    const hasHunk = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/mu.test(section.body);
    const hasPayload = /^(?:\+(?!\+\+)|-(?!--))[\s\S]*$/mu.test(section.body);
    const actualStatus: MarkdownCodeChangeFileStatus = hasNew
      ? "ADDED"
      : hasDeleted
      ? "DELETED"
      : renameFrom || renameTo
      ? "RENAMED"
      : "MODIFIED";
    if (declared.status !== actualStatus) {
      throw new MarkdownCodeChangeError(
        `第 ${index + 1} 个文件声明为 ${declared.status}，但 diff 结构表示 ${actualStatus}。`,
        declared.line ?? line,
      );
    }
    if (actualStatus === "ADDED") {
      if (!section.body.includes("--- /dev/null") || !section.body.includes(`+++ b/${section.after}`) || !hasHunk || !hasPayload) {
        throw new MarkdownCodeChangeError("ADDED diff 必须包含 new file mode、/dev/null、目标头与有效 hunk。", line);
      }
    } else if (actualStatus === "DELETED") {
      if (!section.body.includes(`--- a/${section.before}`) || !section.body.includes("+++ /dev/null") || !hasHunk || !hasPayload) {
        throw new MarkdownCodeChangeError("DELETED diff 必须包含 deleted file mode、源文件头、/dev/null 与有效 hunk。", line);
      }
    } else if (actualStatus === "RENAMED") {
      if (
        renameFrom !== section.before ||
        renameTo !== section.after ||
        !/^similarity index \d+%$/mu.test(section.body)
      ) {
        throw new MarkdownCodeChangeError("RENAMED diff 必须包含匹配的 similarity index、rename from 与 rename to。", line);
      }
    } else if (
      !section.body.includes(`--- a/${section.before}`) ||
      !section.body.includes(`+++ b/${section.after}`) ||
      !hasHunk ||
      !hasPayload
    ) {
      throw new MarkdownCodeChangeError("MODIFIED diff 必须包含源/目标文件头和有效 hunk。", line);
    }
  });
  return validated;
}

function parseCodeLabel(node: MarkdownNode, label: "BEFORE:" | "AFTER:") {
  const line = node.position?.start?.line;
  const children = node.children ?? [];
  const [strong, space, languageNode] = children;
  if (
    node.type !== "paragraph" ||
    children.length !== 3 ||
    strong?.type !== "strong" ||
    inlineText(strong) !== label ||
    space?.type !== "text" ||
    space.value !== " " ||
    languageNode?.type !== "inlineCode"
  ) {
    throw new MarkdownCodeChangeError(`${label} 必须跟随一个行内代码语言名称。`, line);
  }
  const language = (languageNode.value ?? "").trim().toLocaleLowerCase("en-US");
  if (!LANGUAGE.has(language)) {
    throw new MarkdownCodeChangeError(
      `${label} 语言只允许 ${MARKDOWN_CODE_CHANGE_LANGUAGES.join(" / ")}。`,
      line,
    );
  }
  return language;
}

function parseCodeNode(node: MarkdownNode, expectedLanguage: string, label: string) {
  const line = node.position?.start?.line;
  if (node.type !== "code" || (node.lang ?? "").toLocaleLowerCase("en-US") !== expectedLanguage) {
    throw new MarkdownCodeChangeError(`${label}围栏语言必须与标签中的 ${expectedLanguage} 一致。`, line);
  }
  return { ...validateCode(node.value ?? "", `${label}代码 `, line), line };
}

function codeChangeFromMarkdownNode(blockquote: MarkdownNode) {
  const marker = codeChangeMarkerNode(blockquote);
  if (!marker) return undefined;
  const line = blockquote.position?.start?.line;
  const children = visibleMarkdownChildren(blockquote);
  if (children[0]?.type !== "paragraph") {
    throw new MarkdownCodeChangeError("代码变更记录缺少元数据。", line);
  }
  const metadata = parseMetadata(children[0]);
  const expectedCount = metadata.mode === "UNIFIED" ? 12 : 14;
  if (children.length !== expectedCount) {
    throw new MarkdownCodeChangeError(
      "代码变更记录必须依次包含 PURPOSE、FILES、CHANGE、VERIFICATION 和 RISKS，并使用与 MODE 对应的代码区。",
      line,
    );
  }
  const fixedLabels = metadata.mode === "UNIFIED"
    ? [[1, "PURPOSE"], [3, "FILES"], [5, "CHANGE"], [8, "VERIFICATION"], [10, "RISKS"]]
    : [[1, "PURPOSE"], [3, "FILES"], [5, "CHANGE"], [10, "VERIFICATION"], [12, "RISKS"]];
  for (const [childIndex, label] of fixedLabels) {
    if (!isLabel(children[childIndex as number], label as string)) {
      throw new MarkdownCodeChangeError(`代码变更记录缺少固定区段 **${label}** 或顺序错误。`, line);
    }
  }
  const purpose = parseCopy(children[2], "PURPOSE");
  const files = parseList(
    children[4],
    "FILES",
    MARKDOWN_CODE_CHANGE_MIN_FILES,
    MARKDOWN_CODE_CHANGE_MAX_FILES,
    parseFile,
  );
  unique(
    files.map((file) => fileEndpoints(file).after),
    "同一代码变更不能包含重复的目标文件路径。",
    line,
  );
  let change:
    | { diff: string; lineCount: number; mode: "UNIFIED" }
    | { after: string; before: string; language: string; lineCount: number; mode: "BEFORE_AFTER" };
  if (metadata.mode === "UNIFIED") {
    if (!isLabel(children[6], "DIFF") || children[7]?.type !== "code") {
      throw new MarkdownCodeChangeError("UNIFIED 模式必须在 CHANGE 中包含 **DIFF** 与 diff 围栏。", line);
    }
    const code = parseCodeNode(children[7], "diff", "DIFF ");
    const validated = validateUnifiedDiff(code.value, files, code.line);
    change = { diff: validated.value, lineCount: validated.lines, mode: "UNIFIED" };
  } else {
    if (files.length !== 1 || files[0].status !== "MODIFIED") {
      throw new MarkdownCodeChangeError("BEFORE_AFTER 模式只允许一个 MODIFIED 文件。", files[0]?.line ?? line);
    }
    const beforeLanguage = parseCodeLabel(children[6], "BEFORE:");
    const before = parseCodeNode(children[7], beforeLanguage, "BEFORE ");
    const afterLanguage = parseCodeLabel(children[8], "AFTER:");
    const after = parseCodeNode(children[9], afterLanguage, "AFTER ");
    if (beforeLanguage !== afterLanguage) {
      throw new MarkdownCodeChangeError("BEFORE 与 AFTER 必须使用同一种语言。", line);
    }
    if (before.value === after.value) {
      throw new MarkdownCodeChangeError("BEFORE 与 AFTER 代码不能完全相同。", line);
    }
    change = {
      after: after.value,
      before: before.value,
      language: beforeLanguage,
      lineCount: before.lines + after.lines,
      mode: "BEFORE_AFTER",
    };
  }
  const verificationIndex = metadata.mode === "UNIFIED" ? 9 : 11;
  const risksIndex = metadata.mode === "UNIFIED" ? 11 : 13;
  const verifications = parseList(
    children[verificationIndex],
    "VERIFICATION",
    MARKDOWN_CODE_CHANGE_MIN_ITEMS,
    MARKDOWN_CODE_CHANGE_MAX_ITEMS,
    parseVerification,
  );
  const risks = parseList(
    children[risksIndex],
    "RISKS",
    MARKDOWN_CODE_CHANGE_MIN_ITEMS,
    MARKDOWN_CODE_CHANGE_MAX_ITEMS,
    parseRisk,
  );
  unique(verifications.map((item) => item.label), "同一代码变更不能包含名称重复的验证项。", line);
  unique(risks.map((item) => item.title), "同一代码变更不能包含名称重复的风险项。", line);
  return {
    date: metadata.date,
    files,
    ...(line ? { line } : {}),
    purpose,
    risks,
    title: metadata.title,
    verifications,
    ...change,
  } satisfies MarkdownCodeChangeSource & { lineCount: number };
}

function parseMarkdownCodeChanges(markdown: string, options: MarkdownCodeChangeOptions = {}) {
  const changes: Array<MarkdownCodeChangeSource & { lineCount: number }> = [];
  const tree = parseMarkdown(markdown);
  function walk(node: MarkdownNode, parent?: MarkdownNode) {
    if (node.type === "blockquote" && codeChangeMarkerNode(node)) {
      if (parent?.type !== "root") {
        throw new MarkdownCodeChangeError(
          "代码变更记录必须作为正文顶层区块，不能嵌套在列表或其他引用块中。",
          node.position?.start?.line,
        );
      }
      const change = codeChangeFromMarkdownNode(node);
      if (change) changes.push(change);
      return;
    }
    for (const child of node.children ?? []) walk(child, node);
  }
  walk(tree);
  if (changes.length > MARKDOWN_CODE_CHANGE_MAX_COUNT) {
    throw new MarkdownCodeChangeError(`每篇内容最多允许 ${MARKDOWN_CODE_CHANGE_MAX_COUNT} 个代码变更记录。`);
  }
  const totalFiles = changes.reduce((total, change) => total + change.files.length, 0);
  if (totalFiles > MARKDOWN_CODE_CHANGE_MAX_TOTAL_FILES) {
    throw new MarkdownCodeChangeError(`每篇内容的代码变更文件合计最多允许 ${MARKDOWN_CODE_CHANGE_MAX_TOTAL_FILES} 个。`);
  }
  const totalLines = changes.reduce((total, change) => total + change.lineCount, 0);
  if (totalLines > MARKDOWN_CODE_CHANGE_MAX_TOTAL_LINES) {
    throw new MarkdownCodeChangeError(`每篇内容的代码变更代码合计最多允许 ${MARKDOWN_CODE_CHANGE_MAX_TOTAL_LINES} 行。`);
  }
  if (options.maximumDate) {
    if (!isRealIsoDate(options.maximumDate)) {
      throw new MarkdownCodeChangeError("代码变更记录的最大日期边界无效。");
    }
    const future = changes.find((change) => change.date > options.maximumDate!);
    if (future) {
      throw new MarkdownCodeChangeError(
        `代码变更只记录已经完成的修改；${future.date} 晚于当前内容日期 ${options.maximumDate}。`,
        future.line,
      );
    }
  }
  return changes.map((change) => {
    const { lineCount, ...publicChange } = change;
    if (!Number.isInteger(lineCount) || lineCount < 1) {
      throw new MarkdownCodeChangeError("代码变更记录的内部代码行数无效。", change.line);
    }
    return publicChange;
  });
}

export function extractMarkdownCodeChanges(
  markdown: string,
  options: MarkdownCodeChangeOptions = {},
) {
  return parseMarkdownCodeChanges(markdown, options);
}

export function getMarkdownCodeChangeIssue(
  markdown: string,
  options: MarkdownCodeChangeOptions = {},
): MarkdownCodeChangeIssue | undefined {
  try {
    parseMarkdownCodeChanges(markdown, options);
    return undefined;
  } catch (error) {
    return {
      kind: "codechange",
      ...(error instanceof MarkdownCodeChangeError && error.line ? { line: error.line } : {}),
      message: compactError(error) || "代码变更记录无法解析。",
    };
  }
}

function isElement(node: ElementContent | RootContent): node is Element {
  return node.type === "element";
}

function isText(node: ElementContent | RootContent): node is Text {
  return node.type === "text";
}

function visibleHastChildren(node: Element) {
  return node.children.filter((child) => !isText(child) || child.value.trim() !== "");
}

function text(value: string): Text {
  return { type: "text", value };
}

function element(tagName: string, properties: Element["properties"], children: ElementContent[]): Element {
  return { children, properties, tagName, type: "element" };
}

function hastText(node: ElementContent): string {
  if (isText(node)) return node.value;
  if (!isElement(node)) return "";
  return node.children.map(hastText).join("");
}

function hastLabel(node: ElementContent, label: string) {
  if (!isElement(node) || node.tagName !== "p") return false;
  const children = visibleHastChildren(node);
  return children.length === 1 &&
    isElement(children[0]) &&
    children[0].tagName === "strong" &&
    hastText(children[0]) === label;
}

function renderedFile(item: Element) {
  const first = visibleHastChildren(item)[0];
  const inline = isElement(first) && first.tagName === "p" ? first.children : item.children;
  const [status, pathSpace, path, separator, ...rest] = inline;
  if (
    !isElement(status) || status.tagName !== "code" ||
    !isText(pathSpace) || pathSpace.value !== " " ||
    !isElement(path) || path.tagName !== "code" ||
    !isText(separator) || !separator.value.startsWith(" — ")
  ) {
    throw new MarkdownCodeChangeError("代码变更文件缺少状态、路径或说明。");
  }
  const statusValue = hastText(status).toLocaleLowerCase("en-US");
  return element("li", {
    className: ["markdown-codechange-file"],
    dataFileStatus: statusValue,
  }, [
    element("span", { className: ["markdown-codechange-file-status"] }, status.children),
    element("code", { className: ["markdown-codechange-file-path"] }, path.children),
    element("span", { className: ["markdown-codechange-file-copy"] }, [
      text(separator.value.slice(3)),
      ...rest,
    ]),
  ]);
}

function renderedVerification(item: Element) {
  const first = visibleHastChildren(item)[0];
  const inline = isElement(first) && first.tagName === "p" ? first.children : item.children;
  const [label, valueSpace, value, separator, ...rest] = inline;
  if (
    !isElement(label) || label.tagName !== "strong" ||
    !isText(valueSpace) || valueSpace.value !== " " ||
    !isElement(value) || value.tagName !== "code" ||
    !isText(separator) || !separator.value.startsWith(" — ")
  ) {
    throw new MarkdownCodeChangeError("代码变更验证缺少名称、结果或说明。");
  }
  return element("li", { className: ["markdown-codechange-verification"] }, [
    element("strong", { className: ["markdown-codechange-verification-label"] }, label.children),
    element("code", { className: ["markdown-codechange-verification-value"] }, value.children),
    element("span", { className: ["markdown-codechange-verification-copy"] }, [
      text(separator.value.slice(3)),
      ...rest,
    ]),
  ]);
}

function renderedRisk(item: Element) {
  const first = visibleHastChildren(item)[0];
  const inline = isElement(first) && first.tagName === "p" ? first.children : item.children;
  const [title, separator, ...rest] = inline;
  if (!isElement(title) || title.tagName !== "strong" || !isText(separator) || !separator.value.startsWith(" — ")) {
    throw new MarkdownCodeChangeError("代码变更风险缺少名称或说明。");
  }
  return element("li", { className: ["markdown-codechange-risk"] }, [
    element("strong", { className: ["markdown-codechange-risk-title"] }, title.children),
    element("span", { className: ["markdown-codechange-risk-copy"] }, [
      text(separator.value.slice(3)),
      ...rest,
    ]),
  ]);
}

function renderedListItems(list: Element, renderer: (item: Element) => Element) {
  if (list.tagName !== "ul") throw new MarkdownCodeChangeError("代码变更台账必须使用无序列表。");
  return visibleHastChildren(list)
    .filter((child): child is Element => isElement(child) && child.tagName === "li")
    .map(renderer);
}

function addClass(elementNode: Element, className: string) {
  const current = Array.isArray(elementNode.properties.className)
    ? elementNode.properties.className
    : [];
  elementNode.properties.className = [...current, className];
  return elementNode;
}

function renderedCodeStage(label: string, pre: Element, className: string) {
  addClass(pre, "markdown-codechange-pre");
  const code = pre.children.find((child): child is Element => isElement(child) && child.tagName === "code");
  if (!code) throw new MarkdownCodeChangeError("代码变更围栏缺少 code 元素。");
  addClass(code, "markdown-codechange-code");
  return element("div", {
    className: ["markdown-codechange-code-stage", className],
    dataCodeLineCount: hastText(pre).replace(/\n$/u, "").split("\n").length,
  }, [
    element("div", { className: ["markdown-codechange-code-label"] }, [text(label)]),
    pre,
  ]);
}

function renderedLedger(label: string, items: Element[], className: string) {
  return element("div", { className: ["markdown-codechange-ledger", className] }, [
    element("header", { className: ["markdown-codechange-ledger-header"] }, [
      element("span", { className: ["markdown-codechange-ledger-label"] }, [text(label)]),
      element("span", { className: ["markdown-codechange-ledger-count"] }, [text(String(items.length).padStart(2, "0"))]),
    ]),
    element("ul", { className: ["markdown-codechange-ledger-list"] }, items),
  ]);
}

function codeChangeFromHastBlockquote(blockquote: Element, index: number) {
  const children = visibleHastChildren(blockquote);
  const metadata = children[0];
  if (!isElement(metadata) || metadata.tagName !== "p") return undefined;
  const metadataChildren = metadata.children;
  const markerNode = metadataChildren[0];
  if (!isText(markerNode) || !POTENTIAL_CODE_CHANGE_MARKER.test(markerNode.value)) return undefined;
  const marker = CODE_CHANGE_MARKER.exec(markerNode.value);
  const modeNode = metadataChildren[3];
  const dateNode = metadataChildren[7];
  const mode = isElement(modeNode) ? hastText(modeNode).trim() : "";
  const date = isElement(dateNode) ? hastText(dateNode).trim() : "";
  const expectedCount = mode === "UNIFIED" ? 12 : mode === "BEFORE_AFTER" ? 14 : 0;
  const fixedLabels = mode === "UNIFIED"
    ? [[1, "PURPOSE"], [3, "FILES"], [5, "CHANGE"], [8, "VERIFICATION"], [10, "RISKS"]]
    : [[1, "PURPOSE"], [3, "FILES"], [5, "CHANGE"], [10, "VERIFICATION"], [12, "RISKS"]];
  if (
    children.length !== expectedCount ||
    !marker?.[1]?.trim() ||
    !MODE.has(mode) ||
    !isRealIsoDate(date) ||
    !fixedLabels.every(([childIndex, label]) => hastLabel(children[childIndex as number], label as string))
  ) {
    throw new MarkdownCodeChangeError("代码变更记录的渲染结构无效。");
  }
  const purpose = children[2];
  const files = children[4];
  const verificationIndex = mode === "UNIFIED" ? 9 : 11;
  const risksIndex = mode === "UNIFIED" ? 11 : 13;
  const verifications = children[verificationIndex];
  const risks = children[risksIndex];
  if (
    !isElement(purpose) || purpose.tagName !== "p" ||
    !isElement(files) || !isElement(verifications) || !isElement(risks)
  ) {
    throw new MarkdownCodeChangeError("代码变更记录缺少目的、文件、验证或风险内容。");
  }
  const fileItems = renderedListItems(files, renderedFile);
  const verificationItems = renderedListItems(verifications, renderedVerification);
  const riskItems = renderedListItems(risks, renderedRisk);
  const changeStages: Element[] = [];
  if (mode === "UNIFIED") {
    const diff = children[7];
    if (!hastLabel(children[6], "DIFF") || !isElement(diff) || diff.tagName !== "pre") {
      throw new MarkdownCodeChangeError("UNIFIED 代码变更缺少 DIFF 围栏。");
    }
    changeStages.push(renderedCodeStage("UNIFIED DIFF", diff, "markdown-codechange-unified"));
  } else {
    const beforeLabel = children[6];
    const before = children[7];
    const afterLabel = children[8];
    const after = children[9];
    if (
      !isElement(beforeLabel) || !isElement(afterLabel) ||
      !isElement(before) || before.tagName !== "pre" ||
      !isElement(after) || after.tagName !== "pre"
    ) {
      throw new MarkdownCodeChangeError("BEFORE_AFTER 代码变更缺少前后代码围栏。");
    }
    changeStages.push(
      renderedCodeStage("BEFORE", before, "markdown-codechange-before"),
      renderedCodeStage("AFTER", after, "markdown-codechange-after"),
    );
  }
  const titleId = `markdown-codechange-${index}-title`;
  return element("section", {
    ariaLabelledBy: [titleId],
    className: ["markdown-codechange"],
    dataCodeChange: "review-docket",
    dataCodeLineCount: changeStages.reduce(
      (total, stage) => total + Number(stage.properties.dataCodeLineCount ?? 0),
      0,
    ),
    dataFileCount: fileItems.length,
    dataMode: mode.toLocaleLowerCase("en-US").replace("_", "-"),
  }, [
    element("header", { className: ["markdown-codechange-header"] }, [
      element("span", { ariaHidden: "true", className: ["markdown-codechange-spine"] }, [text("CHANGE / REVIEW")]),
      element("span", { className: ["markdown-codechange-heading"] }, [
        element("span", { className: ["markdown-codechange-meta"] }, [
          element("span", { className: ["markdown-codechange-mode"] }, [text(mode)]),
          element("span", { className: ["markdown-codechange-file-count"] }, [text(`${String(fileItems.length).padStart(2, "0")} FILES`)]),
          element("time", { className: ["markdown-codechange-date"], dateTime: date }, [text(date)]),
        ]),
        element("strong", { className: ["markdown-codechange-title"], id: titleId }, [text(marker[1].trim())]),
      ]),
    ]),
    element("div", { className: ["markdown-codechange-purpose"] }, [
      element("span", { className: ["markdown-codechange-purpose-label"] }, [text("PURPOSE")]),
      element("div", { className: ["markdown-codechange-purpose-copy"] }, purpose.children),
    ]),
    element("div", { className: ["markdown-codechange-files"] }, [
      element("header", { className: ["markdown-codechange-ledger-header"] }, [
        element("span", { className: ["markdown-codechange-ledger-label"] }, [text("FILES / REVIEW INDEX")]),
        element("span", { className: ["markdown-codechange-ledger-count"] }, [text(String(fileItems.length).padStart(2, "0"))]),
      ]),
      element("ul", { className: ["markdown-codechange-file-list"] }, fileItems),
    ]),
    element("div", { className: ["markdown-codechange-change", ...(mode === "BEFORE_AFTER" ? ["markdown-codechange-split"] : [])] }, changeStages),
    element("div", { className: ["markdown-codechange-evidence"] }, [
      renderedLedger("VERIFICATION", verificationItems, "markdown-codechange-verifications"),
      renderedLedger("KNOWN RISKS", riskItems, "markdown-codechange-risks"),
    ]),
  ]);
}

export function rehypeMarkdownCodeChanges() {
  return function transform(tree: Root) {
    let count = 0;
    let totalFiles = 0;
    let totalLines = 0;
    for (let index = 0; index < tree.children.length; index += 1) {
      const child = tree.children[index];
      if (!isElement(child) || child.tagName !== "blockquote") continue;
      const change = codeChangeFromHastBlockquote(child, count + 1);
      if (!change) continue;
      count += 1;
      totalFiles += Number(change.properties.dataFileCount);
      totalLines += Number(change.properties.dataCodeLineCount);
      if (count > MARKDOWN_CODE_CHANGE_MAX_COUNT) {
        throw new MarkdownCodeChangeError(`每篇内容最多允许 ${MARKDOWN_CODE_CHANGE_MAX_COUNT} 个代码变更记录。`);
      }
      if (totalFiles > MARKDOWN_CODE_CHANGE_MAX_TOTAL_FILES) {
        throw new MarkdownCodeChangeError(`每篇内容的代码变更文件合计最多允许 ${MARKDOWN_CODE_CHANGE_MAX_TOTAL_FILES} 个。`);
      }
      if (totalLines > MARKDOWN_CODE_CHANGE_MAX_TOTAL_LINES) {
        throw new MarkdownCodeChangeError(`每篇内容的代码变更代码合计最多允许 ${MARKDOWN_CODE_CHANGE_MAX_TOTAL_LINES} 行。`);
      }
      tree.children[index] = change as RootContent;
    }
  };
}

export function normalizeMarkdownCodeChangesForPlainText(tree: MarkdownNode) {
  function cleanList(list: MarkdownNode, separatorIndex: number, removeLeading: number) {
    for (const item of visibleMarkdownChildren(list)) {
      const paragraph = visibleMarkdownChildren(item)[0];
      const children = paragraph?.children ?? [];
      children.splice(0, removeLeading);
      const separator = children[separatorIndex - removeLeading];
      if (separator?.type === "text" && separator.value?.startsWith(" — ")) {
        separator.value = ` ${separator.value.slice(3)}`;
      }
    }
  }
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && codeChangeMarkerNode(node)) {
      const parsed = codeChangeFromMarkdownNode(node);
      if (!parsed) return;
      const children = visibleMarkdownChildren(node);
      children[0].children = [{ type: "text", value: `${parsed.title} ${parsed.date}` }];
      const sectionIndexes = parsed.mode === "UNIFIED" ? [1, 3, 5, 6, 8, 10] : [1, 3, 5, 6, 8, 10, 12];
      for (const index of sectionIndexes) children[index].children = [];
      cleanList(children[4], 3, 2);
      const verificationIndex = parsed.mode === "UNIFIED" ? 9 : 11;
      const riskIndex = parsed.mode === "UNIFIED" ? 11 : 13;
      cleanList(children[verificationIndex], 3, 0);
      cleanList(children[riskIndex], 1, 0);
      if (parsed.mode === "UNIFIED") {
        const code = children[7];
        if (code.type === "code") {
          code.value = (code.value ?? "")
            .split("\n")
            .filter((line) => !/^(?:diff --git|index |--- |\+\+\+ |@@ |new file mode |deleted file mode |similarity index |rename from |rename to )/u.test(line))
            .map((line) => line.replace(/^[+-]/u, ""))
            .join("\n");
        }
      }
      return;
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return tree;
}
