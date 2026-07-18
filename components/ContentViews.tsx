import type { ReactNode } from "react";
import Link from "next/link";
import type {
  ContentRecord,
  PostRecord,
  ProjectRecord,
} from "@/lib/content";
import type { TableOfContentsItem } from "@/lib/content/markdown";

function recordType(record: ContentRecord) {
  if (record.kind === "project") return "Project";
  return record.type === "til" ? "TIL" : "Article";
}

function recordMeta(record: ContentRecord) {
  if (record.kind === "project") return record.status.toUpperCase();
  return `${record.readingMinutes} MIN READ`;
}

export function ContentIndexList({
  items,
  emptyMessage = "这里还没有公开内容。",
}: {
  items: ContentRecord[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="content-index-list">
      {items.map((item, index) => (
        <Link className="content-index-row" href={item.url} key={`${item.kind}-${item.slug}`}>
          <span className="content-index-seq">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="content-index-meta">
            <strong>{recordType(item)}</strong>
            <time dateTime={item.publishedAt}>{item.publishedAt}</time>
          </span>
          <span className="content-index-copy">
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </span>
          <span className="content-index-end">
            {recordMeta(item)} <span aria-hidden="true">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function CollectionIntro({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <header className="collection-intro">
      <div>
        <p className="section-label">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="collection-intro-copy">
        <p>{description}</p>
        <span>{meta}</span>
      </div>
    </header>
  );
}

export function ContentHeader({
  eyebrow,
  title,
  description,
  publishedAt,
  updatedAt,
  readingMinutes,
  tags,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  tags: Array<{ href: string; name: string }>;
  aside?: ReactNode;
}) {
  return (
    <header className="content-header">
      <div className="content-header-main">
        <p className="section-label">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="content-deck">{description}</p>
        <div className="content-tags" aria-label="内容标签">
          {tags.map((tag) => (
            <Link href={tag.href} key={tag.href}>
              {tag.name}
            </Link>
          ))}
        </div>
      </div>
      <aside className="content-facts" aria-label="内容信息">
        <dl>
          <div>
            <dt>Published</dt>
            <dd>
              <time dateTime={publishedAt}>{publishedAt}</time>
            </dd>
          </div>
          {updatedAt ? (
            <div>
              <dt>Updated</dt>
              <dd>
                <time dateTime={updatedAt}>{updatedAt}</time>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Reading</dt>
            <dd>{readingMinutes} min</dd>
          </div>
        </dl>
        {aside}
      </aside>
    </header>
  );
}

export function TableOfContents({ items }: { items: TableOfContentsItem[] }) {
  if (items.length === 0) return null;

  return (
    <aside className="content-toc">
      <p>On this page</p>
      <nav aria-label="本文目录">
        <ol>
          {items.map((item) => (
            <li className={item.depth === 3 ? "toc-level-3" : undefined} key={item.id}>
              <a href={`#${item.id}`}>{item.text}</a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}

export function ContentNeighbors({
  previous,
  next,
}: {
  previous?: PostRecord | ProjectRecord;
  next?: PostRecord | ProjectRecord;
}) {
  if (!previous && !next) return null;

  return (
    <nav className="content-neighbors" aria-label="相邻内容">
      {previous ? (
        <Link href={previous.url}>
          <span>← Previous</span>
          <strong>{previous.title}</strong>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.url}>
          <span>Next →</span>
          <strong>{next.title}</strong>
        </Link>
      ) : null}
    </nav>
  );
}
