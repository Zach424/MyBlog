import { parsePostFile, parseProjectFile } from "./content/contract.ts";

export type ObsidianContentKind = "post" | "project";

const INBOX_PREFIX = "content/inbox/";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function normalizePath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\.\//u, "");
}

export function gitPathsForPublishedNote(
  sourcePath: string,
  targetPath: string,
  attachments: string[],
  sourceWasTracked: boolean,
) {
  const paths = [
    ...(sourceWasTracked ? [sourcePath] : []),
    targetPath,
    ...attachments,
  ].map(normalizePath);
  return [...new Set(paths)];
}

function inferKind(raw: string): ObsidianContentKind {
  const hasPostType = /^type:\s*(?:article|til)\s*$/mu.test(raw);
  const hasProjectStatus = /^status:\s*(?:planning|building|maintained|archived)\s*$/mu.test(raw);
  if (hasPostType === hasProjectStatus) {
    throw new Error("无法判断内容类型：文章需要 type，项目需要 status，且二者不能同时存在");
  }
  return hasPostType ? "post" : "project";
}

function normalizeAttachmentLinks(markdown: string) {
  return markdown
    .replace(
      /!\[\[([a-zA-Z0-9][a-zA-Z0-9._-]*)(?:\|([^\]]+))?\]\]/gu,
      (_match, fileName: string, altText?: string) =>
        `![${altText ?? fileName}](/uploads/${fileName})`,
    )
    .replace(
      /(\]\()(?:\.\.\/)*\/?public\/uploads\/([a-zA-Z0-9][a-zA-Z0-9._-]*)(\))/gu,
      "$1/uploads/$2$3",
    );
}

function referencedUploads(markdown: string) {
  const uploads = new Set<string>();
  for (const match of markdown.matchAll(/(?:\(|src=["'])(\/uploads\/[^\s)"']+)/giu)) {
    const encodedPath = match[1];
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(encodedPath);
    } catch {
      throw new Error(`附件路径无法解码：${encodedPath}`);
    }
    if (decodedPath.includes("..") || !/^\/uploads\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(decodedPath)) {
      throw new Error(`附件路径不安全或文件名不规范：${decodedPath}`);
    }
    uploads.add(`public${decodedPath}`);
  }
  return [...uploads].sort();
}

export function prepareObsidianNote(
  sourcePath: string,
  raw: string,
  requestedKind?: ObsidianContentKind,
) {
  const normalizedSource = normalizePath(sourcePath);
  if (!normalizedSource.startsWith(INBOX_PREFIX) || !normalizedSource.endsWith(".md")) {
    throw new Error("只允许发布 content/inbox 中的 Markdown 草稿");
  }

  const fileName = normalizedSource.split("/").at(-1) ?? "";
  const slug = fileName.slice(0, -3);
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("草稿文件名只能使用小写 ASCII 字母、数字和连字符");
  }

  const normalizedAttachments = normalizeAttachmentLinks(raw);
  const kind = requestedKind ?? inferKind(normalizedAttachments);
  const targetPath = `content/${kind === "post" ? "posts" : "projects"}/${slug}.md`;
  const prepared = normalizedAttachments.replace(
    /(^|\r?\n)draft:\s*true\s*(?=\r?\n)/u,
    "$1draft: false",
  );
  if (/^draft:\s*true\s*$/mu.test(prepared)) {
    throw new Error("无法关闭草稿状态，请检查 frontmatter 中的 draft 字段");
  }

  if (kind === "post") parsePostFile(targetPath, prepared);
  else parseProjectFile(targetPath, prepared);

  return {
    kind,
    slug,
    sourcePath: normalizedSource,
    targetPath,
    content: prepared.endsWith("\n") ? prepared : `${prepared}\n`,
    attachments: referencedUploads(prepared),
  };
}
