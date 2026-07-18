import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header page-shell">
      <Link className="brand" href="/" aria-label="Zach424 Engineering Notes 首页">
        <strong>Zach424</strong>
        <span>Engineering Notes</span>
      </Link>
      <nav className="site-nav" aria-label="主导航">
        <Link href="/posts">文章</Link>
        <Link href="/series">专题</Link>
        <Link href="/projects">项目</Link>
        <Link href="/search">搜索</Link>
        <Link href="/about">关于</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer page-shell">
      <p>
        <strong>ZACH424</strong> / LEARN · BUILD · REVIEW
      </p>
      <nav className="footer-links" aria-label="订阅与源码">
        <Link href="/search">搜索</Link>
        <a href="/rss.xml">RSS</a>
        <a href="https://github.com/Zach424/MyBlog" target="_blank" rel="noreferrer">
          源码 <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </footer>
  );
}
