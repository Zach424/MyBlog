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
      <p>用项目验证学习，用记录沉淀判断。</p>
    </footer>
  );
}
