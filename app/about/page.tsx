import type { Metadata } from "next";
import Link from "next/link";
import { CollectionIntro } from "@/components/ContentViews";

export const metadata: Metadata = {
  title: "关于",
  description: "关于 Zach424、这个博客的记录原则和当前技术基线。",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "关于 — Zach424",
    description: "关于 Zach424、这个博客的记录原则和当前技术基线。",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <main className="collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">关于</span>
      </nav>
      <CollectionIntro
        eyebrow="About this log"
        title="学习不是收藏答案，而是更新判断。"
        description="我是 Zach424。这里记录我如何理解技术、做出取舍、把想法变成项目，并在结果出现后重新检查最初的判断。"
        meta="LEARN / BUILD / REVIEW"
      />
      <div className="about-grid">
        <section>
          <span>01 / CONTENT</span>
          <h2>这里记录什么</h2>
          <p>短小的 TIL、经过验证的完整文章，以及包含背景、约束、实现、证据和复盘的项目档案。</p>
        </section>
        <section>
          <span>02 / METHOD</span>
          <h2>如何判断内容完成</h2>
          <p>每条结论尽量对应真实代码、测试、构建结果或失败记录。没有证据的成果不会写成确定事实。</p>
        </section>
        <section>
          <span>03 / STACK</span>
          <h2>当前技术基线</h2>
          <p>TypeScript、React、Vinext、Vite 与 Cloudflare。内容保存在 Git 中，通过构建期校验生成页面。</p>
        </section>
        <section>
          <span>04 / CONTACT</span>
          <h2>项目与联系入口</h2>
          <p>当前公开入口是 GitHub。邮箱和其他联系方式只会在确认公开范围后加入。</p>
          <a href="https://github.com/Zach424" target="_blank" rel="noreferrer">
            github.com/Zach424 <span aria-hidden="true">↗</span>
          </a>
        </section>
      </div>
    </main>
  );
}
