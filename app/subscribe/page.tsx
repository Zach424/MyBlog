import type { Metadata } from "next";
import Link from "next/link";

import { CollectionIntro } from "@/components/ContentViews";
import { getAllContent } from "@/lib/content";
import { createSubscriptionCatalog } from "@/lib/subscriptions";

export const metadata: Metadata = {
  title: "订阅与开放接口",
  description: "选择 RSS、JSON Feed、OpenSearch、内容清单或单篇 Markdown 读取 Zach424 的公开技术记录。",
  alternates: { canonical: "/subscribe" },
  openGraph: {
    title: "订阅与开放接口 — Zach424",
    description: "一份 Markdown / Git 内容源，连接阅读器、搜索工具、同步器与个人知识库。",
    url: "/subscribe",
  },
};

export default function SubscribePage() {
  const channels = createSubscriptionCatalog(getAllContent());

  return (
    <main className="subscribe-page collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">订阅</span>
      </nav>
      <CollectionIntro
        eyebrow="Open access routes"
        title="订阅与开放接口"
        description="不必依赖某个社交平台：选择适合阅读器、搜索工具、自动化脚本或 Obsidian 的公开读取方式。"
        meta={`${channels.length} READ-ONLY ROUTES / NO ACCOUNT / ONE SOURCE`}
      />

      <section className="subscribe-switchboard" aria-labelledby="subscribe-source-title">
        <header className="subscribe-origin">
          <p>Source 00</p>
          <h2 id="subscribe-source-title">Markdown / Git</h2>
          <span>Single source</span>
          <p>
            同一份已发布内容在构建时生成全部读取接口，标题、时间和公开范围保持一致。
          </p>
          <small>PUBLIC BUILD OUTPUT</small>
        </header>

        <ol className="subscription-routes" aria-label="公开订阅与读取通道">
          {channels.map((channel, index) => (
            <li className="subscription-route" key={channel.id}>
              <div className="subscription-port" aria-hidden="true">
                <span>Port</span>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
              </div>
              <article aria-labelledby={`subscription-${channel.id}`}>
                <p className="subscription-audience">{channel.audience}</p>
                <h3 id={`subscription-${channel.id}`}>{channel.title}</h3>
                <p className="subscription-description">{channel.description}</p>
                <dl className="subscription-contract">
                  <div>
                    <dt>Format</dt>
                    <dd><code>{channel.format}</code></dd>
                  </div>
                  <div>
                    <dt>Endpoint</dt>
                    <dd><code>{channel.pathLabel}</code></dd>
                  </div>
                  <div>
                    <dt>Freshness</dt>
                    <dd>{channel.freshness}</dd>
                  </div>
                </dl>
                {channel.statusNote ? (
                  <p className="subscription-status">{channel.statusNote}</p>
                ) : null}
              </article>
              <nav className="subscription-actions" aria-label={`${channel.title} 操作`}>
                {channel.links.map((link) => (
                  <a href={link.href} key={link.href}>
                    <span>{link.label}</span>
                    <span aria-hidden="true">→</span>
                  </a>
                ))}
              </nav>
            </li>
          ))}
        </ol>
      </section>

      <aside className="subscription-boundary" aria-labelledby="subscription-boundary-title">
        <p className="section-label">Read boundary</p>
        <div>
          <h2 id="subscription-boundary-title">这些接口只负责读取</h2>
          <p>
            它们公开、只读、不要求账号，也不会修改仓库。发布仍从写作后台或 Obsidian 发起，经过校验与 Git 记录后上线。
          </p>
          <nav aria-label="继续操作">
            <a href="/studio" rel="nofollow">进入写作后台 <span aria-hidden="true">→</span></a>
            <Link href="/about">了解本站 <span aria-hidden="true">→</span></Link>
          </nav>
        </div>
      </aside>
    </main>
  );
}
