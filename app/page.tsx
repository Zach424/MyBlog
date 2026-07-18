import {
  getAllPosts,
  getFeaturedProject,
  getTagIndex,
} from "@/lib/content";

const evidenceItems = [
  {
    state: "Verified",
    mark: "verified",
    value: "内容契约与构建基线",
    meta: "Docs · Build · Tests",
  },
  {
    state: "Building",
    mark: "building",
    value: "Markdown 内容管线",
    meta: "Schema · Glob · Indexes",
  },
  {
    state: "Learned",
    mark: "learned",
    value: "构建期 schema 校验",
    meta: "Vite · Cloudflare",
  },
] as const;

export default function Home() {
  const journalEntries = getAllPosts().slice(0, 3);
  const featuredProject = getFeaturedProject();
  const topicTags = getTagIndex().slice(0, 4);
  const latestDate = journalEntries[0]?.publishedAt ?? "2026-07-18";

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <div className="top-rule" aria-hidden="true" />

      <header className="site-header page-shell">
        <a className="brand" href="#top" aria-label="Zach424 Engineering Notes 首页">
          <strong>Zach424</strong>
          <span>Engineering Notes</span>
        </a>
        <nav className="site-nav" aria-label="主导航">
          <a href="#recent">文章</a>
          <a href="#focus">专题</a>
          <a href="#project">项目</a>
          <a href="#about">关于</a>
        </nav>
      </header>

      <main id="main-content">
        <section className="hero page-shell" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span>Independent engineering log</span>
              <span>REV. 004 · {latestDate}</span>
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
          <strong>个人技术博客 / Markdown 内容管线 / Cloudflare</strong>
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
                <div className="entry">
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
                </div>

                {index === 0 && featuredProject ? (
                  <a
                    className="project"
                    id="project"
                    href={featuredProject.repository ?? featuredProject.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="在 GitHub 查看 MyBlog 项目"
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
                  </a>
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
                {tag.name} · {tag.count}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="site-footer page-shell" id="about">
        <p>
          <strong>ZACH424</strong> / LEARN · BUILD · REVIEW
        </p>
        <p>用项目验证学习，用记录沉淀判断。</p>
      </footer>
    </>
  );
}
