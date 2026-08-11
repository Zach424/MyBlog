import { createHash } from "node:crypto";

import { parsePostFile, parseProjectFile } from "./content/contract.ts";
import {
  decodeMarkdownHeadingFragment,
  extractInternalContentReferenceEvidence,
  extractMarkdownHeadingAnchors,
  markdownHeadingAnchor,
  transformMarkdownProse,
} from "./content/markdown.ts";

export type ObsidianContentKind = "post" | "project";

const INBOX_PREFIX = "content/inbox/";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ATTACHMENT_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|mp4|png|webp)$/iu;
const VIDEO_EXTENSION_PATTERN = /\.mp4$/iu;

export interface PreparedAttachment {
  sourcePath: string;
  targetPath: string;
  publicUrl: string;
  usages: PreparedAttachmentUsage[];
}

export interface PreparedAttachmentUsage {
  altSources: PreparedAttachmentAltSource[];
  altTexts: string[];
  occurrences: number;
  role: "body" | "cover" | "video";
  sourceLines: number[];
}

export type PreparedAttachmentAltSource = "authored" | "filename-fallback";

export interface ObsidianLinkTarget {
  body?: string;
  kind: ObsidianContentKind;
  slug: string;
}

export interface PreparedInternalLink {
  kind: "post" | "project" | "self";
  occurrences: number;
  sourceLines: number[];
  target: string;
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
    throw new Error(`本地媒体附件必须位于 public/uploads：${decoded}`);
  }

  const segments = decoded.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    segments.slice(2).some((segment) => /[<>:"|?*\u0000-\u001f]/u.test(segment))
  ) {
    throw new Error(`附件路径不安全：${decoded}`);
  }

  if (!ATTACHMENT_EXTENSION_PATTERN.test(segments.at(-1) ?? "")) {
    throw new Error(`仅支持常见图片和 MP4 视频附件：${decoded}`);
  }
  return decoded;
}

function stableAttachmentName(sourcePath: string) {
  const fileName = sourcePath.split("/").at(-1) ?? "";
  const extensionMatch = ATTACHMENT_EXTENSION_PATTERN.exec(fileName);
  if (!extensionMatch) throw new Error(`附件缺少受支持的媒体扩展名：${sourcePath}`);

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
  const publishedExtension = /^(?:jpe?g|png|webp)$/u.test(extension)
    ? "webp"
    : extension;
  if (alreadyStable && normalizedBase) return `${normalizedBase}.${publishedExtension}`;

  const digest = createHash("sha256").update(sourcePath).digest("hex").slice(0, 8);
  return `${normalizedBase || "asset"}-${digest}.${publishedExtension}`;
}

function sourceLineResolver(markdown: string) {
  const lineStarts = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\n") lineStarts.push(index + 1);
  }
  return (offset: number) => {
    let low = 0;
    let high = lineStarts.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (lineStarts[middle] <= offset) low = middle + 1;
      else high = middle;
    }
    return Math.max(1, low);
  };
}

function normalizeAttachmentLinks(
  markdown: string,
  slug: string,
  onIssue?: (message: string) => void,
) {
  const attachments = new Map<string, PreparedAttachment>();
  const targetSources = new Map<string, string>();

  function register(
    reference: string,
    allowBareName: boolean,
    role: PreparedAttachmentUsage["role"],
    sourceLine: number,
    altText?: string,
    altSource?: PreparedAttachmentAltSource,
  ) {
    if ((altText === undefined) !== (altSource === undefined)) {
      throw new Error("附件替代文本与来源证据必须同时登记");
    }
    let sourcePath: string | undefined;
    try {
      sourcePath = sourceAttachmentPath(reference, allowBareName);
    } catch (error) {
      if (!onIssue) throw error;
      onIssue(error instanceof Error ? error.message : String(error));
      return undefined;
    }
    if (!sourcePath) return undefined;
    const isVideo = VIDEO_EXTENSION_PATTERN.test(sourcePath);
    if (role === "cover" && isVideo) {
      const message = `封面必须是图片，不能使用 MP4：${sourcePath}`;
      if (!onIssue) throw new Error(message);
      onIssue(message);
      return undefined;
    }

    const targetPath = `public/uploads/${slug}/${stableAttachmentName(sourcePath)}`;
    const existingSource = targetSources.get(targetPath);
    if (existingSource && existingSource !== sourcePath) {
      const message = `多个附件会生成同一目标文件：${existingSource}、${sourcePath}`;
      if (!onIssue) throw new Error(message);
      onIssue(message);
    }
    if (!existingSource) targetSources.set(targetPath, sourcePath);
    let attachment = attachments.get(sourcePath);
    if (!attachment) {
      attachment = {
        sourcePath,
        targetPath,
        publicUrl: targetPath.replace(/^public/u, ""),
        usages: [],
      };
      attachments.set(sourcePath, attachment);
    }
    const usage = attachment.usages.find((candidate) => candidate.role === role);
    if (usage) {
      if (altSource !== undefined) usage.altSources.push(altSource);
      if (altText !== undefined) usage.altTexts.push(altText);
      usage.occurrences += 1;
      usage.sourceLines.push(sourceLine);
    } else {
      attachment.usages.push({
        altSources: altSource === undefined ? [] : [altSource],
        altTexts: altText === undefined ? [] : [altText],
        occurrences: 1,
        role,
        sourceLines: [sourceLine],
      });
    }
    return attachment;
  }

  const originalSourceLine = sourceLineResolver(markdown);
  const withNormalizedCover = markdown.replace(
    /(^|\r?\n)cover:\s*(["']?)([^"'\r\n]+)\2\s*(?=\r?\n)/u,
    (match, prefix: string, _quote: string, reference: string, offset: number) => {
      const attachment = register(
        reference,
        false,
        "cover",
        originalSourceLine(offset + prefix.length),
      );
      return attachment ? `${prefix}cover: "${attachment.publicUrl}"` : match;
    },
  );

  const normalizedSourceLine = sourceLineResolver(withNormalizedCover);
  const content = transformMarkdownProse(
    withNormalizedCover,
    (segment, segmentOffset) => segment.replace(
      /!\[([^\]]*)\]\(([^\s)]+)(?:\s+(?:"([^"]*)"|'([^']*)'))?\)|!\[\[([^|\]]+?)(?:\|([^\]]+))?\]\]/gu,
      (
        match,
        markdownAlt: string | undefined,
        markdownReference: string | undefined,
        markdownDoubleTitle: string | undefined,
        markdownSingleTitle: string | undefined,
        wikiReference: string | undefined,
        wikiDisplay: string | undefined,
        matchOffset: number,
      ) => {
        const reference = markdownReference ?? wikiReference;
        if (!reference) return match;
        const requestedDisplay = wikiDisplay?.trim();
        const isDimensions = /^\d+(?:x\d+)?$/u.test(requestedDisplay ?? "");
        const fallbackAlt = reference.split("/").at(-1) ?? "image";
        const altText = markdownReference !== undefined
          ? markdownAlt ?? ""
          : requestedDisplay && !isDimensions
            ? requestedDisplay
            : fallbackAlt;
        const altSource: PreparedAttachmentAltSource =
          markdownReference !== undefined || (requestedDisplay && !isDimensions)
            ? "authored"
            : "filename-fallback";
        const attachment = register(
          reference,
          wikiReference !== undefined,
          VIDEO_EXTENSION_PATTERN.test(reference) ? "video" : "body",
          normalizedSourceLine(segmentOffset + matchOffset),
          altText,
          altSource,
        );
        if (!attachment) return match;
        if (markdownReference !== undefined) {
          const markdownTitle = markdownDoubleTitle ?? markdownSingleTitle;
          return `![${altText}](${attachment.publicUrl}${markdownTitle === undefined ? "" : ` "${markdownTitle}"`})`;
        }
        return `![${altText}](${attachment.publicUrl})`;
      },
    ),
  );

  return {
    content,
    attachments: [...attachments.values()].sort((left, right) =>
      left.targetPath.localeCompare(right.targetPath, "en"),
    ),
  };
}

export function extractObsidianAttachmentPaths(markdown: string) {
  return normalizeAttachmentLinks(markdown, "staging-audit").attachments.map(
    (attachment) => attachment.sourcePath,
  );
}

export function inspectObsidianAttachmentPaths(markdown: string) {
  const issues: string[] = [];
  const normalized = normalizeAttachmentLinks(
    markdown,
    "staging-audit",
    (message) => issues.push(message),
  );
  return {
    issues,
    paths: normalized.attachments.map((attachment) => attachment.sourcePath),
  };
}

function normalizeObsidianContentLinks(
  markdown: string,
  targets: ObsidianLinkTarget[],
) {
  const targetsByPath = new Map<string, ObsidianLinkTarget>();
  const targetsBySlug = new Map<string, ObsidianLinkTarget[]>();

  for (const target of targets) {
    const collection = target.kind === "post" ? "posts" : "projects";
    targetsByPath.set(`${collection}/${target.slug}`, target);
    const sameSlug = targetsBySlug.get(target.slug) ?? [];
    sameSlug.push(target);
    targetsBySlug.set(target.slug, sameSlug);
  }

  function fragmentHref(rawFragment?: string) {
    if (!rawFragment) return "";
    const heading = rawFragment.split("#").at(-1)?.trim() ?? "";
    if (!heading || heading.startsWith("^")) {
      throw new Error("暂不支持 Obsidian 块引用，请改为标题链接");
    }
    const anchor = markdownHeadingAnchor(heading);
    if (!anchor) throw new Error(`无法生成标题锚点：${rawFragment}`);
    return `#${anchor}`;
  }

  function resolveReference(reference: string, strict: boolean) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(reference).replaceAll("\\", "/").trim();
    } catch {
      throw new Error(`站内链接路径无法解码：${reference}`);
    }

    if (!decoded || decoded.includes("\0")) throw new Error("站内链接不能为空");
    if (/^[a-z][a-z0-9+.-]*:/iu.test(decoded) || decoded.startsWith("//")) {
      return undefined;
    }

    const [rawPath, ...fragmentParts] = decoded.split("#");
    const fragment = fragmentHref(fragmentParts.length > 0 ? fragmentParts.join("#") : undefined);
    if (!rawPath) {
      return {
        href: fragment,
        fallbackLabel: fragmentParts.at(-1)?.trim() || "当前章节",
      };
    }

    const hadMarkdownExtension = /\.md$/iu.test(rawPath);
    const normalizedPath = rawPath
      .replace(/^(?:\.\.\/|\.\/)+/u, "")
      .replace(/^\//u, "")
      .replace(/^content\//u, "")
      .replace(/\.md$/iu, "");

    let target = targetsByPath.get(normalizedPath);
    if (!target && !normalizedPath.includes("/") && SLUG_PATTERN.test(normalizedPath)) {
      const matches = targetsBySlug.get(normalizedPath) ?? [];
      if (matches.length > 1) {
        throw new Error(`站内链接目标不明确，请写明 posts 或 projects：${reference}`);
      }
      target = matches[0];
    }

    const looksLikeContentPath = /^(?:posts|projects)\//u.test(normalizedPath);
    if (!target) {
      if (strict || hadMarkdownExtension || looksLikeContentPath) {
        throw new Error(`找不到站内内容链接目标：${reference}`);
      }
      return undefined;
    }

    const collection = target.kind === "post" ? "posts" : "projects";
    return {
      href: `/${collection}/${target.slug}${fragment}`,
      fallbackLabel: fragmentParts.at(-1)?.trim() || target.slug,
    };
  }

  return transformMarkdownProse(markdown, (segment) => {
    const withMarkdownLinks = segment.replace(
      /(?<!!)\[([^\]]+)\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/gu,
      (match, label: string, reference: string) => {
        const resolved = resolveReference(reference, false);
        return resolved ? `[${label}](${resolved.href})` : match;
      },
    );

    return withMarkdownLinks.replace(
      /(?<!!)\[\[([^|\]]+?)(?:\|([^\]]+))?\]\]/gu,
      (_match, reference: string, display?: string) => {
        const resolved = resolveReference(reference, true);
        if (!resolved) throw new Error(`找不到站内内容链接目标：${reference}`);
        return `[${display?.trim() || resolved.fallbackLabel}](${resolved.href})`;
      },
    );
  });
}

function validatePreparedContentLinks(
  markdown: string,
  kind: ObsidianContentKind,
  slug: string,
  targets: ObsidianLinkTarget[],
) {
  const ownUrl = `/${kind === "post" ? "posts" : "projects"}/${slug}`;
  const targetsByUrl = new Map(
    targets.map((target) => [
      `/${target.kind === "post" ? "posts" : "projects"}/${target.slug}`,
      target,
    ]),
  );
  const ownHeadingIds = new Set(
    extractMarkdownHeadingAnchors(markdown).map((heading) => heading.id),
  );

  const references = extractInternalContentReferenceEvidence(markdown);
  const internalLinks: PreparedInternalLink[] = [];
  for (const reference of references) {
    const targetUrl = reference.kind === "self" ? ownUrl : reference.url;
    const target = reference.kind === "self" ? undefined : targetsByUrl.get(targetUrl);
    if (reference.kind !== "self" && !target) {
      throw new Error(`找不到站内内容链接目标：${targetUrl}`);
    }
    if (reference.fragment) {
      let fragment: string;
      try {
        fragment = decodeMarkdownHeadingFragment(reference.fragment);
      } catch {
        throw new Error(`站内链接标题锚点包含无效 URL 编码：${targetUrl}#${reference.fragment}`);
      }
      const headingIds = reference.kind === "self"
        ? ownHeadingIds
        : target?.body === undefined
          ? undefined
          : new Set(extractMarkdownHeadingAnchors(target.body).map((heading) => heading.id));
      if (headingIds && !headingIds.has(fragment)) {
        throw new Error(`站内链接标题锚点不存在：${targetUrl}#${reference.fragment}`);
      }
    }
    internalLinks.push({
      kind: reference.kind,
      occurrences: reference.occurrences,
      sourceLines: reference.sourceLines,
      target: `${targetUrl}${reference.fragment ? `#${reference.fragment}` : ""}`,
    });
  }
  return internalLinks;
}

export function prepareObsidianNote(
  sourcePath: string,
  raw: string,
  requestedKind?: ObsidianContentKind,
  linkTargets: ObsidianLinkTarget[] = [],
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
  const normalizedLinks = normalizeObsidianContentLinks(
    normalizedAttachments.content,
    linkTargets,
  );
  const kind = requestedKind ?? inferKind(normalizedLinks);
  const targetPath = `content/${kind === "post" ? "posts" : "projects"}/${slug}.md`;
  const prepared = normalizedLinks.replace(
    /(^|\r?\n)draft:\s*true\s*(?=\r?\n)/u,
    "$1draft: false",
  );
  if (/^draft:\s*true\s*$/mu.test(prepared)) {
    throw new Error("无法关闭草稿状态，请检查 frontmatter 中的 draft 字段");
  }

  const internalLinks = validatePreparedContentLinks(prepared, kind, slug, linkTargets);
  const record = kind === "post"
    ? parsePostFile(targetPath, prepared)
    : parseProjectFile(targetPath, prepared);
  const attachments = normalizedAttachments.attachments.map((attachment) => ({
    ...attachment,
    usages: attachment.usages.map((usage) => {
      const altSources = usage.role === "cover" ? ["authored" as const] : usage.altSources;
      const altTexts = usage.role === "cover"
        ? record.coverAlt === undefined
          ? []
          : [record.coverAlt]
        : usage.altTexts;
      if (altTexts.length !== usage.occurrences) {
        throw new Error(`附件替代文本证据不完整：${attachment.sourcePath} [${usage.role}]`);
      }
      if (altSources.length !== usage.occurrences) {
        throw new Error(`附件替代文本来源证据不完整：${attachment.sourcePath} [${usage.role}]`);
      }
      return { ...usage, altSources, altTexts };
    }),
  }));

  return {
    kind,
    slug,
    sourcePath: normalizedSource,
    targetPath,
    content: prepared.endsWith("\n") ? prepared : `${prepared}\n`,
    attachments,
    internalLinkCount: internalLinks.length,
    internalLinks,
  };
}
