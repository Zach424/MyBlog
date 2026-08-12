import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { parseMarkdown, type MarkdownNode, walkMarkdown } from "./content/markdown.ts";

export const MARKDOWN_AUDIO_MAX_COUNT = 3;
export const MARKDOWN_AUDIO_MAX_TITLE_LENGTH = 120;
export const MARKDOWN_AUDIO_MAX_DESCRIPTION_LENGTH = 320;
export const MARKDOWN_AUDIO_MAX_TRANSCRIPT_LENGTH = 12_000;

export interface MarkdownAudioSource {
  description: string;
  line?: number;
  src: string;
  title: string;
  transcript: string;
}

export interface MarkdownAudioIssue {
  kind: "audio";
  line?: number;
  message: string;
}

type MarkdownAudioOptions = {
  allowStagingPaths?: boolean;
};

class MarkdownAudioError extends Error {
  readonly line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const AUDIO_MARKER = /^\[!audio\](?:[ \t]+([^\r\n]*?))?[ \t]*$/iu;
const POTENTIAL_AUDIO_MARKER = /^\[!audio\](?=[+\-\s]|$)/iu;

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 320);
}

function visibleText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  if (node.type === "break") return "\n";
  if (node.type === "html" || node.type === "image" || node.type === "imageReference") {
    return "";
  }
  return (node.children ?? []).map(visibleText).join("");
}

function audioMarkerNode(blockquote: MarkdownNode) {
  const paragraph = blockquote.children?.[0];
  const first = paragraph?.type === "paragraph" ? paragraph.children?.[0] : undefined;
  return first?.type === "text" && POTENTIAL_AUDIO_MARKER.test(first.value ?? "")
    ? first
    : undefined;
}

function potentialAudioMarkerNode(blockquote: MarkdownNode) {
  const paragraph = blockquote.children?.[0];
  const first = paragraph?.type === "paragraph" ? paragraph.children?.[0] : undefined;
  return first?.type === "text" && POTENTIAL_AUDIO_MARKER.test(first.value ?? "")
    ? first
    : undefined;
}

function validateAudioPath(
  src: string,
  line?: number,
  { allowStagingPaths = false }: MarkdownAudioOptions = {},
) {
  const source = src.trim();
  if (/^https?:\/\//iu.test(source) || source.startsWith("//")) {
    throw new MarkdownAudioError(
      "音频必须使用 /uploads/<内容 slug>/<文件>.mp3 仓库内本地路径；暂不接受外部托管或第三方播放器。",
      line,
    );
  }
  if (/[?#]/u.test(source)) {
    throw new MarkdownAudioError("本地音频路径不能包含查询参数或锚点。", line);
  }
  const pattern = allowStagingPaths
    ? /^\/uploads\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?[^/]+\.mp3$/u
    : /^\/uploads\/[a-z0-9]+(?:-[a-z0-9]+)*\/[^/]+\.mp3$/u;
  if (!pattern.test(source)) {
    throw new MarkdownAudioError(
      "音频必须归档到 /uploads/<内容 slug>/ 目录，并使用 .mp3 扩展名。",
      line,
    );
  }
  if (/%(?:2f|5c)/iu.test(source) || /[\\<>:"|*\u0000-\u001f]/u.test(source)) {
    throw new MarkdownAudioError("本地音频路径包含不安全字符。", line);
  }
  try {
    const decoded = decodeURIComponent(source);
    if (decoded.split("/").some((segment) => segment === "." || segment === "..")) {
      throw new MarkdownAudioError("本地音频路径不安全。", line);
    }
  } catch (error) {
    if (error instanceof MarkdownAudioError) throw error;
    throw new MarkdownAudioError("本地音频路径包含无效的 URL 编码。", line);
  }
  return source;
}

function audioFromMarkdownNode(
  blockquote: MarkdownNode,
  options: MarkdownAudioOptions = {},
) {
  const markerNode = potentialAudioMarkerNode(blockquote);
  if (!markerNode) return undefined;
  const line = blockquote.position?.start?.line;
  const markerValue = markerNode.value ?? "";
  const newline = markerValue.indexOf("\n");
  const markerLine = newline < 0 ? markerValue : markerValue.slice(0, newline);
  const marker = AUDIO_MARKER.exec(markerLine);
  if (!marker) {
    throw new MarkdownAudioError(
      "音频标记必须写成静态的 > [!audio] 标题，不能折叠或添加其他标记。",
      line,
    );
  }
  const title = marker[1]?.trim() ?? "";
  if (!title) throw new MarkdownAudioError("音频必须填写标题。", line);
  if (title.length > MARKDOWN_AUDIO_MAX_TITLE_LENGTH) {
    throw new MarkdownAudioError(
      `音频标题不能超过 ${MARKDOWN_AUDIO_MAX_TITLE_LENGTH} 个字符。`,
      line,
    );
  }

  const firstParagraph = blockquote.children?.[0];
  const firstChildren = firstParagraph?.children ?? [];
  const link = firstChildren.find((child) => child.type === "link");
  if (!link || link.type !== "link" || !link.url || !/\.mp3(?:[?#]|$)/iu.test(link.url)) {
    throw new MarkdownAudioError(
      '音频标题后必须紧跟 [下载 MP3](/uploads/<slug>/<file>.mp3 "同一标题")。',
      line,
    );
  }
  const src = validateAudioPath(link.url, link.position?.start?.line ?? line, options);
  if ((link.title ?? "").trim() !== title) {
    throw new MarkdownAudioError("音频链接 title 必须与音频标题完全一致。", line);
  }
  if (visibleText(link).trim() !== "下载 MP3") {
    throw new MarkdownAudioError("音频链接文字必须固定为“下载 MP3”。", line);
  }

  const markerRemainder = newline < 0 ? "" : markerValue.slice(newline + 1);
  const afterLink = firstChildren
    .slice(firstChildren.indexOf(link) + 1)
    .map(visibleText)
    .join("")
    .trim();
  const description = [markerRemainder, afterLink].filter(Boolean).join(" ").trim();
  if (!description) throw new MarkdownAudioError("音频必须填写一行内容简述。", line);
  if (description.length > MARKDOWN_AUDIO_MAX_DESCRIPTION_LENGTH) {
    throw new MarkdownAudioError(
      `音频简述不能超过 ${MARKDOWN_AUDIO_MAX_DESCRIPTION_LENGTH} 个字符。`,
      line,
    );
  }

  const transcriptParagraph = blockquote.children?.[1];
  const transcriptChildren = transcriptParagraph?.type === "paragraph"
    ? transcriptParagraph.children ?? []
    : [];
  const label = transcriptChildren[0];
  const transcriptLabel = label?.type === "strong" ? visibleText(label).trim() : "";
  if (transcriptLabel !== "文字稿") {
    throw new MarkdownAudioError("音频必须紧跟 **文字稿** 和等价文本内容。", line);
  }
  const transcript = transcriptChildren
    .slice(1)
    .map(visibleText)
    .join("")
    .trim();
  if (!transcript) throw new MarkdownAudioError("音频文字稿不能为空。", line);
  if (transcript.length > MARKDOWN_AUDIO_MAX_TRANSCRIPT_LENGTH) {
    throw new MarkdownAudioError(
      `音频文字稿不能超过 ${MARKDOWN_AUDIO_MAX_TRANSCRIPT_LENGTH} 个字符。`,
      line,
    );
  }
  if ((blockquote.children?.length ?? 0) !== 2) {
    throw new MarkdownAudioError("音频块只能包含链接、简述和一段文字稿。", line);
  }

  return { description, ...(line ? { line } : {}), src, title, transcript };
}

function parseMarkdownAudioNotes(
  markdown: string,
  options: MarkdownAudioOptions = {},
) {
  const notes: MarkdownAudioSource[] = [];
  walkMarkdown(parseMarkdown(markdown), (node) => {
    if (node.type !== "blockquote" || !potentialAudioMarkerNode(node)) return;
    if (notes.length >= MARKDOWN_AUDIO_MAX_COUNT) {
      throw new MarkdownAudioError(
        `每篇内容最多允许 ${MARKDOWN_AUDIO_MAX_COUNT} 段本地音频。`,
        node.position?.start?.line,
      );
    }
    const note = audioFromMarkdownNode(node, options);
    if (note) notes.push(note);
  });
  return notes;
}

export function extractMarkdownAudioNotes(
  markdown: string,
  options: MarkdownAudioOptions = {},
) {
  return parseMarkdownAudioNotes(markdown, options);
}

export function getMarkdownAudioIssue(markdown: string): MarkdownAudioIssue | undefined {
  try {
    parseMarkdownAudioNotes(markdown);
    return undefined;
  } catch (error) {
    return {
      kind: "audio",
      ...(error instanceof MarkdownAudioError && error.line ? { line: error.line } : {}),
      message: compactError(error) || "音频声明无法解析。",
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

function element(
  tagName: string,
  properties: Element["properties"],
  children: ElementContent[],
): Element {
  return { children, properties, tagName, type: "element" };
}

function hastText(node: ElementContent): string {
  if (isText(node)) return node.value;
  if (!isElement(node)) return "";
  return node.children.map(hastText).join("");
}

function visibleHastChildren(node: Element) {
  return node.children.filter(
    (child) => !isText(child) || child.value.trim() !== "",
  );
}

function audioFromHastBlockquote(blockquote: Element) {
  const children = visibleHastChildren(blockquote);
  const first = children[0];
  const second = children[1];
  if (!first || !isElement(first) || first.tagName !== "p") return undefined;
  const firstChildren = visibleHastChildren(first);
  const markerText = firstChildren[0];
  if (!markerText || !isText(markerText) || !POTENTIAL_AUDIO_MARKER.test(markerText.value)) {
    return undefined;
  }
  if (!second || !isElement(second) || second.tagName !== "p" || children.length !== 2) {
    throw new MarkdownAudioError("音频块只能包含链接、简述和一段文字稿。");
  }

  const newline = markerText.value.indexOf("\n");
  const markerLine = newline < 0 ? markerText.value : markerText.value.slice(0, newline);
  const marker = AUDIO_MARKER.exec(markerLine);
  const title = marker?.[1]?.trim() ?? "";
  if (!marker || !title) throw new MarkdownAudioError("音频必须填写标题。");
  const link = firstChildren.find(
    (child): child is Element => isElement(child) && child.tagName === "a",
  );
  const href = typeof link?.properties.href === "string" ? link.properties.href : "";
  const src = validateAudioPath(href);
  if (!link || link.properties.title !== title || hastText(link).trim() !== "下载 MP3") {
    throw new MarkdownAudioError("音频下载链接、title 或标题不一致。");
  }
  const markerRemainder = newline < 0 ? "" : markerText.value.slice(newline + 1);
  const afterLink = firstChildren
    .slice(firstChildren.indexOf(link) + 1)
    .map(hastText)
    .join("")
    .trim();
  const description = [markerRemainder, afterLink].filter(Boolean).join(" ").trim();
  if (!description) throw new MarkdownAudioError("音频必须填写一行内容简述。");

  const secondChildren = visibleHastChildren(second);
  const label = secondChildren[0];
  if (!label || !isElement(label) || label.tagName !== "strong" || hastText(label).trim() !== "文字稿") {
    throw new MarkdownAudioError("音频必须紧跟 **文字稿** 和等价文本内容。");
  }
  const transcript = secondChildren
    .slice(1)
    .map(hastText)
    .join("")
    .trim();
  if (!transcript) throw new MarkdownAudioError("音频文字稿不能为空。");

  return element(
    "figure",
    { className: ["markdown-audio"], dataAudio: "local-mp3" },
    [
      element("figcaption", { className: ["markdown-audio-header"] }, [
        element("span", { className: ["markdown-audio-rail"] }, [
          element("span", { className: ["markdown-audio-kind"] }, [text("AUDIO NOTE / MP3")]),
          element("span", { className: ["markdown-audio-origin"] }, [text("LOCAL · TRANSCRIPT INCLUDED")]),
        ]),
        element("strong", { className: ["markdown-audio-title"] }, [text(title)]),
        element("span", { className: ["markdown-audio-description"] }, [text(description)]),
      ]),
      element("div", { className: ["markdown-audio-stage"] }, [
        element(
          "audio",
          {
            ariaLabel: `${title}。${description}`,
            className: ["markdown-audio-player"],
            controls: true,
            preload: "metadata",
          },
          [
            element("source", { src, type: "audio/mpeg" }, []),
            text("浏览器无法播放该音频。"),
          ],
        ),
      ]),
      element("div", { className: ["markdown-audio-transcript"] }, [
        element("span", { className: ["markdown-audio-transcript-label"] }, [text("TRANSCRIPT")]),
        element("p", {}, [text(transcript)]),
      ]),
      element("a", { className: ["markdown-audio-download"], download: true, href: src }, [
        text("下载 MP3"),
      ]),
      element("p", { className: ["markdown-audio-print"] }, [text(`音频文件：${src}`)]),
    ],
  );
}

export function rehypeMarkdownAudioNotes() {
  return function transform(tree: Root) {
    let audioCount = 0;
    function walk(parent: Root | Element) {
      for (let index = 0; index < parent.children.length; index += 1) {
        const child = parent.children[index];
        if (!isElement(child)) continue;
        if (child.tagName === "blockquote") {
          const audio = audioFromHastBlockquote(child);
          if (audio) {
            audioCount += 1;
            if (audioCount > MARKDOWN_AUDIO_MAX_COUNT) {
              throw new MarkdownAudioError(
                `每篇内容最多允许 ${MARKDOWN_AUDIO_MAX_COUNT} 段本地音频。`,
              );
            }
            parent.children[index] = audio as RootContent;
            continue;
          }
        }
        walk(child);
      }
    }
    walk(tree);
  };
}

export function normalizeMarkdownAudioNotesForPlainText(tree: MarkdownNode) {
  function walk(node: MarkdownNode) {
    if (node.type === "blockquote" && audioMarkerNode(node)) {
      const audio = audioFromMarkdownNode(node);
      if (!audio) return;
      node.children = [{
        children: [{
          type: "text",
          value: `${audio.title}\n${audio.description}\n文字稿\n${audio.transcript}`,
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
