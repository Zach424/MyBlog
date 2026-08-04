import { createHash } from "node:crypto";

import { parsePostFile, parseProjectFile } from "./content/contract.ts";

export type ObsidianContentKind = "post" | "project";

const INBOX_PREFIX = "content/inbox/";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|png|webp)$/iu;

export interface PreparedAttachment {
  sourcePath: string;
  targetPath: string;
  publicUrl: string;
}

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

function decodeAttachmentPath(value: string) {
  try {
    return decodeURIComponent(value).replaceAll("\\", "/");
  } catch {
    throw new Error(`附件路径无法解码：${value}`);
  }
}

function sourceAttachmentPath(value: string, allowBareName: boolean) {
  let decoded = decodeAttachmentPath(value).trim();
  if (!decoded || decoded.includes("\0") || /^[a-z]+:/iu.test(decoded)) return undefined;
  if (decoded.includes("#") || decoded.includes("?")) {
    throw new Error(`附件路径不能包含查询参数或锚点：${decoded}`);
  }

  if (decoded.startsWith("/uploads/")) decoded = `public${decoded}`;
  decoded = decoded.replace(/^(?:\.\.\/|\.\/)+/u, "").replace(/^\//u, "");
  if (allowBareName && !decoded.includes("/")) decoded = `public/uploads/${decoded}`;
  if (!decoded.startsWith("public/uploads/")) {
    throw new Error(`本地图片附件必须位于 public/uploads：${decoded}`);
  }

  const segments = decoded.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    segments.slice(2).some((segment) => /[<>:"|?*\u0000-\u001f]/u.test(segment))
  ) {
    throw new Error(`附件路径不安全：${decoded}`);
  }

  if (!IMAGE_EXTENSION_PATTERN.test(segments.at(-1) ?? "")) {
    throw new Error(`仅支持常见图片附件：${decoded}`);
  }
  return decoded;
}

function stableAttachmentName(sourcePath: string) {
  const fileName = sourcePath.split("/").at(-1) ?? "";
  const extensionMatch = IMAGE_EXTENSION_PATTERN.exec(fileName);
  if (!extensionMatch) throw new Error(`附件缺少受支持的图片扩展名：${sourcePath}`);

  const extension = extensionMatch[1].toLocaleLowerCase("en-US");
  const originalBase = fileName.slice(0, -extensionMatch[0].length);
  const normalizedBase = originalBase
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64);
  const alreadyStable =
    normalizedBase === originalBase &&
    extension === extensionMatch[1];
  if (alreadyStable && normalizedBase) return `${normalizedBase}.${extension}`;

  const digest = createHash("sha256").update(sourcePath).digest("hex").slice(0, 8);
  return `${normalizedBase || "asset"}-${digest}.${extension}`;
}

function transformOutsideCodeFences(
  markdown: string,
  transform: (segment: string) => string,
) {
  let output = "";
  let prose = "";
  let fenceCharacter = "";
  let fenceLength = 0;

  for (const line of markdown.match(/.*(?:\r?\n|$)/gu) ?? []) {
    if (!line) continue;
    const fence = /^\s*(`{3,}|~{3,})/u.exec(line);

    if (!fenceCharacter && fence) {
      output += transform(prose) + line;
      prose = "";
      fenceCharacter = fence[1][0];
      fenceLength = fence[1].length;
      continue;
    }

    if (fenceCharacter) {
      output += line;
      if (
        fence &&
        fence[1][0] === fenceCharacter &&
        fence[1].length >= fenceLength &&
        new RegExp(`^\\s*${fenceCharacter}{${fenceLength},}\\s*$`, "u").test(
          line.trimEnd(),
        )
      ) {
        fenceCharacter = "";
        fenceLength = 0;
      }
      continue;
    }

    prose += line;
  }

  return output + transform(prose);
}

function normalizeAttachmentLinks(markdown: string, slug: string) {
  const attachments = new Map<string, PreparedAttachment>();
  const targetSources = new Map<string, string>();

  function register(reference: string, allowBareName: boolean) {
    const sourcePath = sourceAttachmentPath(reference, allowBareName);
    if (!sourcePath) return undefined;

    const targetPath = `public/uploads/${slug}/${stableAttachmentName(sourcePath)}`;
    const existingSource = targetSources.get(targetPath);
    if (existingSource && existingSource !== sourcePath) {
      throw new Error(`多个附件会生成同一目标文件：${existingSource}、${sourcePath}`);
    }
    targetSources.set(targetPath, sourcePath);
    attachments.set(sourcePath, {
      sourcePath,
      targetPath,
      publicUrl: targetPath.replace(/^public/u, ""),
    });
    return attachments.get(sourcePath);
  }

  const content = transformOutsideCodeFences(markdown, (segment) => {
    const withMarkdownEmbeds = segment.replace(
      /!\[([^\]]*)\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/gu,
      (match, altText: string, reference: string) => {
        const attachment = register(reference, false);
        return attachment ? `![${altText}](${attachment.publicUrl})` : match;
      },
    );

    return withMarkdownEmbeds.replace(
      /!\[\[([^|\]]+?)(?:\|([^\]]+))?\]\]/gu,
      (match, reference: string, display?: string) => {
        const attachment = register(reference, true);
        if (!attachment) return match;
        const requestedDisplay = display?.trim();
        const isDimensions = /^\d+(?:x\d+)?$/u.test(requestedDisplay ?? "");
        const fallbackAlt = reference.split("/").at(-1) ?? "image";
        const altText = requestedDisplay && !isDimensions ? requestedDisplay : fallbackAlt;
        return `![${altText}](${attachment.publicUrl})`;
      },
    );
  });

  return {
    content,
    attachments: [...attachments.values()].sort((left, right) =>
      left.targetPath.localeCompare(right.targetPath, "en"),
    ),
  };
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

  const normalizedAttachments = normalizeAttachmentLinks(raw, slug);
  const kind = requestedKind ?? inferKind(normalizedAttachments.content);
  const targetPath = `content/${kind === "post" ? "posts" : "projects"}/${slug}.md`;
  const prepared = normalizedAttachments.content.replace(
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
    attachments: normalizedAttachments.attachments,
  };
}
