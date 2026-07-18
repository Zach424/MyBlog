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

正文使用 `react-markdown` 生成语义化 HTML，GFM 扩展负责表格与任务列表，rehype 统一生成标题锚点和代码高亮。文章、项目、专题和标签都从同一内容仓库查询，详情页不存在时返回真正的 404。

站内搜索在构建时把公开正文转换成轻量索引，在浏览器本地按标题、标签、摘要和正文加权匹配，不上传查询词。RSS、Sitemap 和 robots 与页面共用同一个公开内容索引，并根据请求主机生成绝对 URL。

文章与项目详情分别输出 `BlogPosting` 和 `SoftwareSourceCode` JSON-LD；根布局声明作者、规范 URL、RSS、Open Graph 和站点图标。生产 Worker 统一补充 CSP、HSTS、点击劫持防护、权限策略与 HTML 边缘缓存，避免把平台默认值误当成已经完成的发布策略。

视觉系统以 Commit Trace 为唯一主要识别元素，把日期、文章类型和项目里程碑连成一条工程轨迹。Evidence Rail 只显示可验证状态，不展示虚构的完成率。

## 问题与解决

初始模板的 npm scripts 隐含了特定 shell，导致 Windows 开发失败。命令被收敛为跨平台的 Vinext 入口，并用实际构建验证。

社交元数据需要部署域名对应的绝对 URL，但本地与 Cloudflare 主机不同。根布局优先读取显式站点地址，否则从代理请求头推导，并保留本地开发回退。

框架默认给 HTML 返回 `no-store`，第一次缓存审计因此失败。Worker 现在对 HTML 显式使用 `max-age=0, s-maxage=3600, stale-while-revalidate=86400`，让浏览器每次复核、Cloudflare 边缘短期复用。Wrangler 干跑目录也曾被 ESLint 扫描并产生大量生成代码噪声，现已把 `.wrangler` 作为部署产物排除。

生产依赖审计发现 Next.js 内部 PostCSS 版本存在中等级别公告；没有执行会降级框架的 `npm audit fix --force`，而是升级 Next.js 补丁版并将内部 PostCSS 最小覆盖到修复版本，再通过完整构建和 Worker 测试验证兼容性。

Sites 首次生产发布后，首页、集合页、搜索和发现端点返回 200，但文章、项目、专题和标签详情统一返回 404；相同构建在 Node 与本地 Wrangler Workerd 中正常。当前为每个 Sitemap 详情 URL 增加固定 slug 的显式静态包装，复用原动态页的元数据与正文实现，并用发布审计阻止新增内容遗漏包装。

## 结果证据

目前工程基线、内容契约、正式首页、响应式设计、深色偏好、分享卡与站点图标、结构化数据、内容校验管线、完整核心阅读路径、站内搜索与发布发现端点已经完成。完整质量门通过 12 项单元测试、7 项 Worker 集成测试和 6 项发布审计；所有可见内部链接健康，文本 Token 达到 WCAG AA，生产依赖审计为 0 个已知漏洞。Cloudflare 干跑上传包 gzip 后为 `625.60 KiB`。每一轮都有独立提交、测试结果和 `docs/iterations` 归档。首个生产版本已经发布但详情路由修复仍待重新上线，因此项目状态保持 `building`，不会提前写成完整上线。

## 复盘

先固定内容语义再写页面，减少了数据结构反向迁就视觉组件的风险。把设计状态绑定到真实工程证据，也让首页可以随着项目推进自然更新，而不需要维护一套营销文案。

## 下一步

重新发布显式路由修复，在线验证 Sitemap 中全部 23 个 URL、搜索、RSS、robots、真实 404、缓存与安全响应头，并补齐监控、回滚和维护手册。真实浏览器与窄屏视觉复核随在线验收完成；上线后再根据真实发布体验评估评论与其他持久化能力。
