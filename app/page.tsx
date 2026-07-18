import Link from "next/link";
import {
  getAllPosts,
  getFeaturedProject,
  getTagIndex,
} from "@/lib/content";

const evidenceItems = [
  {
    state: "Verified",
    mark: "verified",
    value: "Markdown 正文与核心路由",
    meta: "Routes · TOC · Tests",
  },
  {
    state: "Building",
    mark: "building",
    value: "发布能力与站内检索",
    meta: "Search · RSS · Sitemap",
  },
  {
    state: "Learned",
    mark: "learned",
    value: "标题锚点必须同源生成",
    meta: "GitHub Slugger · rehype",
  },
] as const;

export default function Home() {
  const journalEntries = getAllPosts().slice(0, 3);
  const featuredProject = getFeaturedProject();
  const topicTags = getTagIndex().slice(0, 4);
  const latestDate = journalEntries[0]?.publishedAt ?? "2026-07-18";

  return (
    <>
      <main id="main-content">
        <section className="hero page-shell" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span>Independent engineering log</span>
              <span>REV. 005 · {latestDate}</span>
            </p>
            <h1 id="hero-title">
              把写过的代码，
              <br />
              变成可复用的<span>判断。</span>
            </h1>
            <p className="hero-support">
              记录学习路径、技术取舍和项目复盘。不是答案仓库，而是一份持续更新的工程日志。
            </p>
            <div className="hero-actions">
              <a className="primary-link" href="#recent">
                <span>阅读最新记录</span>
                <span aria-hidden="true">↘</span>
              </a>
              <a
                className="source-link"
                href="https://github.com/Zach424/MyBlog"
                target="_blank"
                rel="noreferrer"
              >
                查看 GitHub 源码 <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <aside className="evidence-rail" aria-labelledby="evidence-title">
            <div className="rail-head">
              <h2 id="evidence-title">Evidence rail</h2>
              <span className="rail-current">CURRENT</span>
            </div>
            <div className="evidence-list">
              {evidenceItems.map((item) => (
                <div className="evidence-item" key={item.state}>
                  <span
                    className={`evidence-mark ${item.mark}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="evidence-state">{item.state}</p>
                    <p className="evidence-value">{item.value}</p>
                    <p className="evidence-meta">{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="focus-strip page-shell" id="focus" aria-label="当前关注">
          <span className="focus-label">Current focus</span>
          <strong>核心阅读路径 / 站内检索 / Cloudflare</strong>
          <span className="focus-index">
            TRACE {String(journalEntries.length).padStart(2, "0")} / ACTIVE
          </span>
        </section>

        <section className="journal page-shell" id="recent" aria-labelledby="recent-title">
          <div className="journal-heading">
            <p className="section-label">Commit trace</p>
            <h2 id="recent-title">最近记录</h2>
            <p className="legend">Newest first</p>
          </div>

          <div className="trace" role="list" aria-label="最近工程记录">
            {journalEntries.map((entry, index) => (
              <article
                className={`trace-row${index === 0 ? " branch-row" : ""}`}
                id={`trace-${entry.slug}`}
                key={entry.slug}
                role="listitem"
              >
                <time className="trace-date" dateTime={entry.publishedAt}>
                  {entry.publishedAt}
                  <span>{entry.type === "til" ? "TIL" : "NOTE"}</span>
                </time>
                <span className="trace-node" aria-hidden="true" />
                <Link className="entry" href={entry.url}>
                  <div className="entry-topline">
                    <span className="entry-type">
                      {entry.type === "til" ? "TIL" : "Article"}
                    </span>
                    <span>
                      TRACE {String(journalEntries.length - index).padStart(3, "0")}
                    </span>
                  </div>
                  <h3>{entry.title}</h3>
                  <p>{entry.description}</p>
                </Link>

                {index === 0 && featuredProject ? (
                  <Link
                    className="project"
                    id="project"
                    href={featuredProject.url}
                    aria-label="查看 MyBlog 项目复盘"
                  >
                    <div className="project-topline">
                      <span className="project-kicker">Featured project</span>
                      <span className="project-state">
                        {featuredProject.status.charAt(0).toUpperCase() +
                          featuredProject.status.slice(1)}
                      </span>
                    </div>
                    <h3>{featuredProject.title}</h3>
                    <p>{featuredProject.description}</p>
                    <div className="project-footer">
                      <span>{featuredProject.stack.join(" · ")}</span>
                      <span aria-hidden="true">↗</span>
                    </div>
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="topics page-shell" aria-labelledby="topics-title">
          <div>
            <p className="section-label">Working index</p>
            <h2 id="topics-title">正在积累的主题</h2>
          </div>
          <ul aria-label="技术主题">
            {topicTags.map((tag) => (
              <li key={tag.slug}>
                <Link href={`/tags/${tag.slug}`}>
                  {tag.name} · {tag.count}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
