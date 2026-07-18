const journalEntries = [
  {
    type: "Article",
    date: "2026-07-18",
    sequence: "TRACE 003",
    title: "从零搭建可维护的个人技术博客",
    summary: "从目标、内容契约到部署边界，记录这个博客如何一步步成为长期可维护的工程资产。",
  },
  {
    type: "TIL",
    date: "2026-07-18",
    sequence: "TRACE 002",
    title: "Windows 下的跨平台 npm scripts",
    summary: "让开发、构建与启动命令不依赖特定 shell，是把本地经验变成可复用流程的第一步。",
  },
  {
    type: "Article",
    date: "2026-07-17",
    sequence: "TRACE 001",
    title: "为什么先写项目章程，再写首页",
    summary: "先固定目标、边界与验收标准，再让技术和视觉选择围绕真实任务收敛。",
  },
] as const;

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
    value: "MyBlog 首页与内容系统",
    meta: "TypeScript · Cloudflare",
  },
  {
    state: "Learned",
    mark: "learned",
    value: "跨平台 npm scripts",
    meta: "TIL · Windows",
  },
] as const;

export default function Home() {
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
              <span>REV. 003 · 2026-07-18</span>
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
          <strong>个人技术博客 / 构建期内容系统 / Cloudflare</strong>
          <span className="focus-index">TRACE 03 / ACTIVE</span>
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
                id={`trace-${journalEntries.length - index}`}
                key={entry.sequence}
                role="listitem"
              >
                <time className="trace-date" dateTime={entry.date}>
                  {entry.date}
                  <span>{index === 1 ? "TIL" : "NOTE"}</span>
                </time>
                <span className="trace-node" aria-hidden="true" />
                <div className="entry">
                  <div className="entry-topline">
                    <span className="entry-type">{entry.type}</span>
                    <span>{entry.sequence}</span>
                  </div>
                  <h3>{entry.title}</h3>
                  <p>{entry.summary}</p>
                </div>

                {index === 0 ? (
                  <a
                    className="project"
                    id="project"
                    href="https://github.com/Zach424/MyBlog"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="在 GitHub 查看 MyBlog 项目"
                  >
                    <div className="project-topline">
                      <span className="project-kicker">Featured project</span>
                      <span className="project-state">Building</span>
                    </div>
                    <h3>MyBlog — 把学习记录做成工程资产</h3>
                    <p>
                      从内容契约、视觉系统到 Cloudflare 发布，全程保留可验证的工程记录。
                    </p>
                    <div className="project-footer">
                      <span>TypeScript · React · Cloudflare</span>
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
            <li>Next.js</li>
            <li>TypeScript</li>
            <li>Cloudflare</li>
            <li>Design Systems</li>
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
