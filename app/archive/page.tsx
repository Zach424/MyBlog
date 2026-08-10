import type { Metadata } from "next";
import Link from "next/link";

import { CollectionIntro } from "@/components/ContentViews";
import {
  createContentArchive,
  getAllContent,
  type ContentRecord,
} from "@/lib/content";

export const metadata: Metadata = {
  title: "时间档案",
  description: "按年份与月份浏览 Zach424 已公开的技术文章、TIL 和项目记录。",
  alternates: { canonical: "/archive" },
  openGraph: {
    title: "时间档案 — Zach424",
    description: "把文章、TIL 与项目放回同一条可追溯的工程时间线。",
    url: "/archive",
  },
};

function recordType(record: ContentRecord) {
  if (record.kind === "project") return "Project";
  return record.type === "til" ? "TIL" : "Article";
}

function compactDate(publishedAt: string) {
  return publishedAt.slice(5).replace("-", ".");
}

export default function ArchivePage() {
  const records = getAllContent();
  const archive = createContentArchive(records);

  return (
    <main className="archive-page collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">档案</span>
      </nav>
      <CollectionIntro
        eyebrow="Chronological ledger"
        title="时间档案"
        description="把文章、TIL 与项目放回同一条时间轴：先看何时形成记录，再继续追溯当时的判断、实践与复盘。"
        meta={`${records.length} ENTRIES / ${archive.length} YEAR${archive.length === 1 ? "" : "S"} / NEWEST FIRST`}
      />

      {archive.length === 0 ? (
        <p className="empty-state">
          还没有公开记录。发布第一篇文章或项目后，时间档案会在这里按年月生成。
        </p>
      ) : (
        <ol className="archive-ledger" aria-label="公开内容时间档案">
          {archive.map((year) => (
            <li className="archive-year" key={year.year}>
              <header className="archive-year-marker">
                <span>Year</span>
                <h2>{year.year}</h2>
                <small>{year.entryCount} entries</small>
              </header>
              <div className="archive-year-body">
                {year.months.map((month) => (
                  <section
                    className="archive-month"
                    aria-labelledby={`archive-${month.key}`}
                    key={month.key}
                  >
                    <header className="archive-month-marker">
                      <h3 id={`archive-${month.key}`}>
                        <span className="visually-hidden">{year.year} 年</span>
                        {month.month} 月
                      </h3>
                      <small>{month.entries.length} records</small>
                    </header>
                    <ol aria-label={`${year.year} 年 ${month.month} 月记录`}>
                      {month.entries.map((record) => (
                        <li key={record.url}>
                          <Link className="archive-entry" href={record.url}>
                            <time
                              aria-label={`发布日期 ${record.publishedAt}`}
                              dateTime={record.publishedAt}
                            >
                              {compactDate(record.publishedAt)}
                            </time>
                            <span className="archive-entry-type">
                              {recordType(record)}
                            </span>
                            <span className="archive-entry-copy">
                              <strong>{record.title}</strong>
                              <span>{record.description}</span>
                            </span>
                            <span className="archive-entry-arrow" aria-hidden="true">
                              →
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      <nav className="collection-links" aria-label="继续发现">
        <Link href="/posts">按文章类型浏览 <span aria-hidden="true">→</span></Link>
        <Link href="/projects">查看项目复盘 <span aria-hidden="true">→</span></Link>
        <Link href="/knowledge">沿引用关系阅读 <span aria-hidden="true">→</span></Link>
      </nav>
    </main>
  );
}
