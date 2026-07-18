---
title: "MyBlog — 把学习记录做成工程资产"
description: "从内容契约、工程轨迹设计到 Cloudflare 发布，构建一个可维护、可检索、可复盘的个人技术博客。"
publishedAt: 2026-07-18
updatedAt: 2026-07-18
status: building
stack: ["TypeScript", "React", "Vinext", "Vite", "Cloudflare"]
tags: ["TypeScript", "React", "Cloudflare", "Personal Knowledge", "Design Systems"]
draft: false
featured: true
repository: "https://github.com/Zach424/MyBlog"
demo: null
---

## 背景与目标

学习记录原本分散在代码、聊天和临时笔记中，很难在几个月后重新找到当时的约束与判断。MyBlog 的目标不是建设一个内容展示页，而是把学习过程和项目经历变成能够版本管理、检索和复盘的工程资产。

首页需要让访问者在一分钟内理解最近在学什么、当前在做什么，以及这些内容如何互相验证。

## 约束

- 中文内容优先，同时保留技术术语的准确性；
- 新文章应在五分钟内完成本地预览和发布提交；
- 生产环境运行在 Cloudflare，不依赖运行时文件系统；
- 第一版不建设数据库、管理后台和用户系统；
- 所有开发轮次必须归档结构、设计、技术、功能、方法、验证和经验。

## 技术选择

界面使用 React 19 与 Next.js 兼容 App Router，Vinext 和 Vite 负责生成 Cloudflare Worker-compatible ESM。内容以 Markdown 和 frontmatter 保存在 Git 中，构建期通过 Vite glob 打包，并在进入页面前完成 schema 与跨内容校验。

样式使用 CSS 自定义属性表达设计 Token。Tailwind 只保留为构建入口，不用大量工具类掩盖页面的排版关系。

## 关键实现

内容契约把文件名定义为稳定 slug，日期变化不会改变 URL。标签通过单一注册表规范化，专题从文章字段派生，并校验顺序必须从 1 连续递增。

视觉系统以 Commit Trace 为唯一主要识别元素，把日期、文章类型和项目里程碑连成一条工程轨迹。Evidence Rail 只显示可验证状态，不展示虚构的完成率。

## 问题与解决

初始模板的 npm scripts 隐含了特定 shell，导致 Windows 开发失败。命令被收敛为跨平台的 Vinext 入口，并用实际构建验证。

社交元数据需要部署域名对应的绝对 URL，但本地与 Cloudflare 主机不同。根布局优先读取显式站点地址，否则从代理请求头推导，并保留本地开发回退。

## 结果证据

目前工程基线、内容契约、正式首页、响应式设计、深色偏好、Open Graph 卡片和内容校验管线已经完成。每一轮都有独立提交、测试结果和 `docs/iterations` 归档。线上部署尚未完成，因此项目状态仍然是 `building`，不会提前写成已上线。

## 复盘

先固定内容语义再写页面，减少了数据结构反向迁就视觉组件的风险。把设计状态绑定到真实工程证据，也让首页可以随着项目推进自然更新，而不需要维护一套营销文案。

## 下一步

继续实现文章、项目、专题和标签路由；随后完成搜索、RSS、Sitemap、浏览器验收和 Cloudflare 部署。上线后再根据真实发布体验评估评论与其他持久化能力。
