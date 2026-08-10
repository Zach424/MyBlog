import type { Metadata } from "next";
import Link from "next/link";
import { CollectionIntro } from "@/components/ContentViews";
import { createAboutProfile } from "@/lib/about-profile";
import {
  getAllPosts,
  getAllProjects,
  getFeaturedProject,
  getSeriesIndex,
  getTagIndex,
} from "@/lib/content";
import { createPublicRouteInventory } from "@/lib/public-routes";

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
  const posts = getAllPosts();
  const projects = getAllProjects();
  const series = getSeriesIndex();
  const tags = getTagIndex();
  const publicRoutes = createPublicRouteInventory({ posts, projects, series, tags });
  const profile = createAboutProfile({
    postCount: posts.length,
    projectCount: projects.length,
    seriesCount: series.length,
    tagCount: tags.length,
    publicRouteCount: publicRoutes.total,
    latestModified: publicRoutes.latestModified,
    featuredProject: getFeaturedProject(),
  });

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
        meta={profile.meta}
      />
      <div className="about-grid">
        <section>
          <span>01 / INVENTORY</span>
          <h2>公开系统档案</h2>
          <dl className="about-facts">
            {profile.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>
                  {fact.href ? <Link href={fact.href}>{fact.value}</Link> : fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <span>02 / METHOD</span>
          <h2>如何判断内容完成</h2>
          <p>每条结论尽量对应真实代码、测试、构建结果或失败记录。没有证据的成果不会写成确定事实。</p>
        </section>
        <section>
          <span>03 / STACK</span>
          <h2>当前项目基线</h2>
          <Link className="about-project-link" href={profile.featuredProject.href}>
            {profile.featuredProject.title} <span aria-hidden="true">→</span>
          </Link>
          <p className="about-project-status">
            {profile.featuredProject.status} · 内容保存在 Git 中，通过构建期校验生成页面。
          </p>
          {profile.featuredProject.stack.length > 0 ? (
            <ul className="about-stack" aria-label="当前项目技术栈">
              {profile.featuredProject.stack.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
        <section>
          <span>04 / CONTACT</span>
          <h2>项目与联系入口</h2>
          <p>博客与源码均已公开，项目讨论与联系继续通过 GitHub；邮箱暂不发布。</p>
          <a href="https://github.com/Zach424" target="_blank" rel="noreferrer">
            github.com/Zach424 <span aria-hidden="true">↗</span>
          </a>
        </section>
      </div>
    </main>
  );
}
