import type { ReactNode } from "react";
import Link from "next/link";
import type {
  ContentRecommendation,
  ContentRecord,
  PostRecord,
  ProjectRecord,
} from "@/lib/content";
import type { TableOfContentsItem } from "@/lib/content/markdown";
import {
  getContentDatePresentation,
  getProjectStatusPresentation,
} from "@/lib/content-presentation";

function recordType(record: ContentRecord) {
  if (record.kind === "project") return "Project";
  return record.type === "til" ? "TIL" : "Article";
}

function recordMeta(record: ContentRecord) {
  if (record.kind === "project") {
    return getProjectStatusPresentation(record.status).meta;
  }
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
      {items.map((item, index) => {
        const contentDate = getContentDatePresentation(item);

        return (
          <Link
            className="content-index-row"
            href={item.url}
            key={`${item.kind}-${item.slug}`}
          >
            <span className="content-index-seq">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="content-index-meta">
              <strong>{recordType(item)}</strong>
              <time className="content-index-date" dateTime={contentDate.date}>
                <span className="content-index-date-label">{contentDate.label}</span>
                {contentDate.date}
              </time>
            </span>
            <span className="content-index-copy">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </span>
            <span className="content-index-end">
              {recordMeta(item)} <span aria-hidden="true">→</span>
            </span>
          </Link>
        );
      })}
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
  freshness,
  reviewedAt,
  readingMinutes,
  tags,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  freshness: ContentRecord["freshness"];
  reviewedAt: string;
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
            <dt>Context</dt>
            <dd>{freshness === "current" ? "Current record" : "Historical snapshot"}</dd>
          </div>
          <div>
            <dt>Reviewed</dt>
            <dd>
              <time dateTime={reviewedAt}>{reviewedAt}</time>
            </dd>
          </div>
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

export function PrintSource({ url }: { url: string }) {
  return (
    <p className="print-source">
      Source / <a href={url}>{url}</a>
    </p>
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

export function ContentRecommendations({
  items,
}: {
  items: ContentRecommendation[];
}) {
  if (items.length === 0) return null;

  return (
    <section
      className="content-recommendations"
      aria-labelledby="related-content-title"
    >
      <header className="content-recommendations-intro">
        <div>
          <p className="section-label">Continue trace</p>
          <h2 id="related-content-title">继续阅读</h2>
        </div>
        <p>
          按专题、共同标签和正文引用综合排序；每条建议都保留可复核的推荐依据。
        </p>
      </header>
      <ol className="content-recommendation-list">
        {items.map(({ reasons, record }, index) => (
          <li key={record.url}>
            <Link className="content-recommendation" href={record.url}>
              <span className="content-recommendation-trace" aria-hidden="true">
                Trace {String(index + 1).padStart(2, "0")}
              </span>
              <span className="content-recommendation-copy">
                <strong className="content-recommendation-title">
                  {record.title}
                </strong>
                <span className="content-recommendation-evidence">
                  {recordType(record)} · {reasons.map((reason) => reason.label).join(" · ")}
                </span>
              </span>
              <span className="content-recommendation-end" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ContentRelationGroup({
  direction,
  items,
}: {
  direction: "outgoing" | "incoming";
  items: ContentRecord[];
}) {
  if (items.length === 0) return null;

  const isOutgoing = direction === "outgoing";
  const titleId = `${direction}-references-title`;

  return (
    <section className="content-relation-group" aria-labelledby={titleId}>
      <header className="content-relation-group-intro">
        <span className="content-relation-arrow" aria-hidden="true">
          {isOutgoing ? "→" : "←"}
        </span>
        <div>
          <p className="section-label">{isOutgoing ? "Outgoing" : "Incoming"}</p>
          <h3 id={titleId}>{isOutgoing ? "这条记录引用" : "引用这条记录"}</h3>
          <p>
            {isOutgoing
              ? `${items.length} 条公开内容提供了这里继续展开的背景或依据。`
              : `${items.length} 条公开内容把这里的判断用于后续学习或项目实践。`}
          </p>
        </div>
      </header>
      <ContentIndexList items={items} />
    </section>
  );
}

export function ContentReferenceLedger({
  outgoing,
  backlinks,
}: {
  outgoing: ContentRecord[];
  backlinks: ContentRecord[];
}) {
  if (outgoing.length === 0 && backlinks.length === 0) return null;

  return (
    <section className="content-relations" aria-labelledby="reference-ledger-title">
      <header className="content-relations-intro">
        <div>
          <p className="section-label">Reference ledger</p>
          <h2 id="reference-ledger-title">站内引用</h2>
        </div>
        <p>
          正文链接形成的双向账本：向外追溯依据，也从这里继续阅读后续实践。
        </p>
      </header>
      <div className="content-relation-groups">
        <ContentRelationGroup direction="outgoing" items={outgoing} />
        <ContentRelationGroup direction="incoming" items={backlinks} />
      </div>
    </section>
  );
}
