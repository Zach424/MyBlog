import type { Metadata } from "next";
import Link from "next/link";
import { CollectionIntro, ContentIndexList } from "@/components/ContentViews";
import { getAllProjects } from "@/lib/content";

export const metadata: Metadata = {
  title: "项目",
  description: "包含背景、约束、技术选择、结果证据与复盘的真实项目记录。",
  alternates: { canonical: "/projects" },
  openGraph: {
    title: "项目 — Zach424",
    description: "包含背景、约束、技术选择、结果证据与复盘的真实项目记录。",
    url: "/projects",
  },
};

export default function ProjectsPage() {
  const projects = getAllProjects();

  return (
    <main className="collection-page page-shell" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">项目</span>
      </nav>
      <CollectionIntro
        eyebrow="Project evidence"
        title="项目复盘"
        description="每个项目都回答同一组问题：为什么开始、受什么约束、做了哪些取舍、如何验证，以及下一次会改变什么。"
        meta={`${projects.length} PROJECT${projects.length === 1 ? "" : "S"}`}
      />
      <ContentIndexList items={projects} />
    </main>
  );
}
