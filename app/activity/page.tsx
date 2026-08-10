import type { Metadata } from "next";
import Link from "next/link";

import { CollectionIntro } from "@/components/ContentViews";
import {
  createContentActivity,
  getAllContent,
  type ContentActivityMode,
  type ContentActivityType,
} from "@/lib/content";
import styles from "./activity.module.css";

export const metadata: Metadata = {
  title: "内容活动",
  description: "按真实发布与更新事件追踪 Zach424 的技术文章、TIL 和项目变化。",
  alternates: { canonical: "/activity" },
  openGraph: {
    title: "内容活动 — Zach424",
    description: "查看每条公开记录何时首次发布，以及何时发生真实内容更新。",
    url: "/activity",
  },
};

const modeLabels: Record<ContentActivityMode, string> = {
  published: "首次发布",
  updated: "内容更新",
};

const typeLabels: Record<ContentActivityType, string> = {
  article: "Article",
  til: "TIL",
  project: "Project",
};

function compactDate(date: string) {
  return date.slice(5).replace("-", ".");
}

export default function ActivityPage() {
  const activity = createContentActivity(getAllContent());

  return (
    <main className="activity-page collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">内容活动</span>
      </nav>
      <CollectionIntro
        eyebrow="Change ledger"
        title="内容活动"
        description="发布是记录进入知识库的起点；后续事实发生变化时，这里再留下一个更新事件。复核但未改写内容，不制造新的活动。"
        meta={`${activity.counts.events} EVENTS / ${activity.counts.published} PUBLISHED / ${activity.counts.updated} UPDATED`}
      />

      <section className={styles.key} aria-label="活动事件说明">
        <div className={styles.keyItem}>
          <span className={`${styles.keyNode} ${styles.publishedNode}`} aria-hidden="true" />
          <div>
            <strong>PUBLISHED</strong>
            <span>内容首次公开</span>
          </div>
        </div>
        <div className={styles.keyItem}>
          <span className={`${styles.keyNode} ${styles.updatedNode}`} aria-hidden="true" />
          <div>
            <strong>UPDATED</strong>
            <span>事实发生后续变化</span>
          </div>
        </div>
        <p>
          <strong>REVIEWED</strong> 只表示内容经过复核，不等同于内容发生变化，因此不进入这条时间线。
        </p>
      </section>

      {activity.days.length === 0 ? (
        <p className="empty-state">
          还没有公开活动。发布第一篇文章或项目后，这里会生成第一条 PUBLISHED 事件。
        </p>
      ) : (
        <ol className={styles.ledger} aria-label="公开内容活动时间线">
          {activity.days.map((day) => (
            <li className={styles.day} data-activity-day="true" key={day.date}>
              <header className={styles.dayMarker}>
                <time dateTime={day.date}>
                  <span>{day.date.slice(0, 4)}</span>
                  <strong>{compactDate(day.date)}</strong>
                  <small>{day.events.length} events</small>
                </time>
              </header>
              <ol className={styles.dayEvents} aria-label={`${day.date} 的内容活动`}>
                {day.events.map((event) => (
                  <li
                    className={styles.event}
                    data-activity-event="true"
                    data-activity-mode={event.mode}
                    key={event.id}
                  >
                    <Link className={styles.eventLink} href={event.url}>
                      <span className={styles.eventSignal} aria-hidden="true">
                        <span
                          className={`${styles.eventNode} ${event.mode === "updated" ? styles.updatedNode : styles.publishedNode}`}
                        />
                      </span>
                      <span className={styles.eventMeta}>
                        <strong>{event.mode.toUpperCase()}</strong>
                        <span>{modeLabels[event.mode]} · {typeLabels[event.contentType]}</span>
                      </span>
                      <span className={styles.eventCopy}>
                        <strong>{event.title}</strong>
                        <span>{event.description}</span>
                      </span>
                      <span className={styles.eventArrow} aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}

      <nav className="collection-links" aria-label="继续发现">
        <Link href="/archive">回到首次发布时间线 <span aria-hidden="true">→</span></Link>
        <Link href="/knowledge">沿引用关系阅读 <span aria-hidden="true">→</span></Link>
        <Link href="/search">搜索全部内容 <span aria-hidden="true">→</span></Link>
      </nav>
    </main>
  );
}
