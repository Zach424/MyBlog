import type { ContentRecord } from "./contract.ts";
import { ContentValidationError } from "./contract.ts";
import {
  decodeMarkdownHeadingFragment,
  extractInternalContentReferences,
  extractMarkdownHeadingAnchors,
} from "./markdown.ts";

export interface ContentRelations {
  backlinksByUrl: Map<string, ContentRecord[]>;
  outgoingByUrl: Map<string, ContentRecord[]>;
}

function sortRelatedContent(records: ContentRecord[]) {
  return [...records].sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      left.title.localeCompare(right.title, "zh-CN"),
  );
}

export function deriveContentRelations(records: ContentRecord[]): ContentRelations {
  const recordsByUrl = new Map(records.map((record) => [record.url, record]));
  const headingIdsByUrl = new Map(
    records.map((record) => [
      record.url,
      new Set(extractMarkdownHeadingAnchors(record.body).map((heading) => heading.id)),
    ]),
  );
  const outgoingSets = new Map<string, Set<ContentRecord>>();
  const backlinkSets = new Map<string, Set<ContentRecord>>();

  for (const source of records) {
    for (const reference of extractInternalContentReferences(source.body)) {
      const targetUrl = reference.kind === "self" ? source.url : reference.url;
      const target = recordsByUrl.get(targetUrl);
      if (!target) {
        throw new ContentValidationError(
          source.sourcePath,
          `站内链接目标不存在或尚未公开：${targetUrl}`,
        );
      }
      if (reference.fragment) {
        let fragment: string;
        try {
          fragment = decodeMarkdownHeadingFragment(reference.fragment);
        } catch {
          throw new ContentValidationError(
            source.sourcePath,
            `站内链接标题锚点包含无效 URL 编码：${targetUrl}#${reference.fragment}`,
          );
        }
        if (!headingIdsByUrl.get(targetUrl)?.has(fragment)) {
          throw new ContentValidationError(
            source.sourcePath,
            `站内链接标题锚点不存在：${targetUrl}#${reference.fragment}`,
          );
        }
      }
      if (targetUrl === source.url) continue;

      const outgoing = outgoingSets.get(source.url) ?? new Set<ContentRecord>();
      outgoing.add(target);
      outgoingSets.set(source.url, outgoing);

      const backlinks = backlinkSets.get(target.url) ?? new Set<ContentRecord>();
      backlinks.add(source);
      backlinkSets.set(target.url, backlinks);
    }
  }

  return {
    backlinksByUrl: new Map(
      [...backlinkSets].map(([url, sources]) => [url, sortRelatedContent([...sources])]),
    ),
    outgoingByUrl: new Map(
      [...outgoingSets].map(([url, targets]) => [url, sortRelatedContent([...targets])]),
    ),
  };
}
