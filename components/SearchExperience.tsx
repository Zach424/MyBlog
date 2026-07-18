"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  searchDocuments,
  type SearchDocument,
} from "@/lib/search";

const kindLabels: Record<SearchDocument["kind"], string> = {
  article: "Article",
  til: "TIL",
  project: "Project",
};

export function SearchExperience({
  documents,
  initialQuery,
}: {
  documents: SearchDocument[];
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => searchDocuments(documents, deferredQuery),
    [deferredQuery, documents],
  );
  const suggestions = useMemo(
    () => [...new Set(documents.flatMap((document) => document.tags))].slice(0, 5),
    [documents],
  );
  const hasQuery = deferredQuery.trim().length > 0;

  useEffect(() => {
    const url = new URL(window.location.href);
    const normalizedQuery = query.trim();
    if (normalizedQuery) url.searchParams.set("q", normalizedQuery);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [query]);

  return (
    <section className="search-workbench" aria-labelledby="search-workbench-title">
      <div className="search-command">
        <div className="search-command-label" aria-hidden="true">
          QUERY / 001
        </div>
        <form
          className="search-form"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="site-search" id="search-workbench-title">
            搜索标题、摘要、标签和正文
          </label>
          <div className="search-input-row">
            <span aria-hidden="true">/</span>
            <input
              id="site-search"
              name="q"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：Cloudflare、内容契约、Windows"
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")}>
                清除
              </button>
            ) : null}
          </div>
        </form>
        <dl className="search-stats">
          <div>
            <dt>Indexed</dt>
            <dd>{documents.length}</dd>
          </div>
          <div>
            <dt>Matched</dt>
            <dd>{results.length}</dd>
          </div>
        </dl>
      </div>

      <div className="search-suggestions" aria-label="搜索建议">
        <span>Try</span>
        {suggestions.map((suggestion) => (
          <button type="button" onClick={() => setQuery(suggestion)} key={suggestion}>
            {suggestion}
          </button>
        ))}
      </div>

      <div className="search-result-heading" aria-live="polite" aria-atomic="true">
        <p className="section-label">Search trace</p>
        <p>
          {hasQuery
            ? `“${deferredQuery.trim()}” 找到 ${results.length} 条记录`
            : `按最新顺序显示全部 ${results.length} 条公开记录`}
        </p>
      </div>

      {results.length ? (
        <div className="search-results">
          {results.map((match, index) => (
            <Link
              className="search-result-row"
              href={match.document.url}
              key={`${match.document.kind}-${match.document.url}`}
            >
              <span className="search-result-seq">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="search-result-meta">
                <strong>{kindLabels[match.document.kind]}</strong>
                <time dateTime={match.document.publishedAt}>
                  {match.document.publishedAt}
                </time>
              </span>
              <span className="search-result-copy">
                <strong>{match.document.title}</strong>
                <span>{hasQuery ? match.excerpt : match.document.description}</span>
                <small>{match.document.tags.join(" · ")}</small>
              </span>
              <span className="search-result-reason">
                {match.reason} <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="search-empty">
          <strong>没有找到对应的工程记录。</strong>
          <p>缩短关键词、检查拼写，或从上方技术标签重新开始。</p>
        </div>
      )}
    </section>
  );
}
