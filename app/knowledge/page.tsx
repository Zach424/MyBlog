import type { Metadata } from "next";
import Link from "next/link";

import {
  KnowledgeIsolatedRecords,
  KnowledgeMapField,
  KnowledgeRelationLedger,
} from "@/components/KnowledgeMap";
import { getKnowledgeGraph } from "@/lib/content";

export const metadata: Metadata = {
  title: "知识地图",
  description: "从公开 Markdown 正文链接派生的文章与项目知识地图，显示引用方向和尚未连线的记录。",
  alternates: { canonical: "/knowledge" },
  openGraph: {
    title: "知识地图 — Zach424",
    description: "沿正文链接查看文章如何提供依据、项目如何回写实践。",
    url: "/knowledge",
  },
};

function countLabel(value: number) {
  return String(value).padStart(2, "0");
}

export default function KnowledgePage() {
  const graph = getKnowledgeGraph();

  return (
    <main className="knowledge-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">知识地图</span>
      </nav>
      <header className="knowledge-intro">
        <div>
          <p className="section-label">Knowledge topology</p>
          <h1>知识之间，应该看得见来路。</h1>
        </div>
        <div className="knowledge-intro-copy">
          <p>
            每一条连线都来自公开正文中的真实链接：向外追溯依据，向内查看哪些实践继续使用了这条判断。
          </p>
          <dl aria-label="知识地图统计">
            <div>
              <dt>Nodes</dt>
              <dd>{countLabel(graph.counts.nodes)}</dd>
            </div>
            <div>
              <dt>Directed edges</dt>
              <dd>{countLabel(graph.counts.edges)}</dd>
            </div>
            <div>
              <dt>Isolated</dt>
              <dd>{countLabel(graph.counts.isolated)}</dd>
            </div>
          </dl>
        </div>
      </header>
      <section className="knowledge-map-section" aria-labelledby="knowledge-map-title">
        <header className="knowledge-section-heading">
          <div>
            <p className="section-label">Signal field</p>
            <h2 id="knowledge-map-title">从记录到实践的双向总线</h2>
          </div>
          <p>
            左侧是文章，右侧是项目。线条箭头表示正文引用方向；虚线节点被保留为明确的未连线状态。
          </p>
        </header>
        <KnowledgeMapField graph={graph} />
        <p className="knowledge-mobile-note">
          窄屏设备使用下方逐条关系账本读取完整方向；图形信号场不会要求横向缩放。
        </p>
      </section>
      <KnowledgeRelationLedger graph={graph} />
      <KnowledgeIsolatedRecords graph={graph} />
      <nav className="collection-links" aria-label="继续发现">
        <Link href="/search">搜索全部内容 <span aria-hidden="true">→</span></Link>
        <Link href="/series">按专题连续阅读 <span aria-hidden="true">→</span></Link>
        <Link href="/tags">按技术标签浏览 <span aria-hidden="true">→</span></Link>
      </nav>
    </main>
  );
}
