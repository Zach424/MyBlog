import Link from "next/link";

import styles from "./not-found.module.css";

const recoveryRoutes = [
  {
    href: "/search",
    mode: "KEYWORD",
    title: "搜索知识库",
    description: "用标题、标签或正文关键词重新定位。",
  },
  {
    href: "/archive",
    mode: "TIME",
    title: "按时间回溯",
    description: "沿发布日期查看文章、TIL 与项目。",
  },
  {
    href: "/posts",
    mode: "NOTES",
    title: "浏览文章",
    description: "从学习记录和技术判断继续阅读。",
  },
  {
    href: "/projects",
    mode: "BUILDS",
    title: "浏览项目",
    description: "从真实实现、取舍与复盘重新进入。",
  },
] as const;

export default function NotFound() {
  return (
    <>
      <meta name="robots" content="noindex" />
      <main className={`not-found page-shell ${styles.page}`} id="main-content">
        <section className={styles.hero} aria-labelledby="not-found-title">
          <div className={styles.code} aria-hidden="true">
            <span>404</span>
          </div>
          <div className={styles.copy}>
            <p className="section-label">Broken trace / Recovery index</p>
            <h1 id="not-found-title">这条轨迹在这里中断。</h1>
            <p>
              服务器没有找到这个地址。内容可能尚未发布、地址有误，或已经通过永久链接迁移。
            </p>
            <dl className={styles.status}>
              <div>
                <dt>HTTP status</dt>
                <dd>404 / Not Found</dd>
              </div>
              <div>
                <dt>Response</dt>
                <dd>No redirect</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.recovery} aria-labelledby="recovery-title">
          <header>
            <p className="section-label">Recovery routes / 4</p>
            <h2 id="recovery-title">从已知入口继续。</h2>
            <p>选择最接近原目标的路径；本站不会把未知地址自动跳转成首页。</p>
          </header>
          <nav
            className={`not-found-routes ${styles.routes}`}
            aria-label="404 恢复路径"
          >
            <ul>
              {recoveryRoutes.map((route) => (
                <li key={route.href}>
                  <Link
                    className={`not-found-route ${styles.route}`}
                    href={route.href}
                  >
                    <span className={styles.routeMode}>{route.mode}</span>
                    <span className={styles.routeCopy}>
                      <strong>{route.title}</strong>
                      <span>{route.description}</span>
                    </span>
                    <span className={styles.routeArrow} aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>

        <div className={styles.footer}>
          <p>如果这是旧书签，请先从档案或搜索确认内容是否已经迁移。</p>
          <Link href="/">返回首页</Link>
        </div>
      </main>
    </>
  );
}
