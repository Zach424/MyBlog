import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found page-shell" id="main-content">
      <p className="section-label">Trace not found / 404</p>
      <h1>这条工程轨迹不存在。</h1>
      <p>内容可能尚未发布、slug 已输入错误，或这个入口已经被移除。</p>
      <Link className="primary-link" href="/">
        <span>返回首页</span>
        <span aria-hidden="true">↖</span>
      </Link>
    </main>
  );
}
