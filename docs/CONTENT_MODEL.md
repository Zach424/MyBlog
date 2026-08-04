# 内容模型

## 原则

- GitHub 仓库是唯一事实源；
- 文件名决定稳定 URL；
- frontmatter 使用声明式 YAML，不执行 JavaScript；
- 同一契约服务网页后台、Obsidian、构建和测试；
- 草稿与未来内容在公开索引形成前过滤。

## 文章与 TIL

路径：`content/posts/<slug>.md`

```yaml
---
title: "标题"
description: "独立摘要"
type: article # article | til
publishedAt: 2026-07-19
updatedAt: 2026-07-19
tags: ["Next.js", "TypeScript", "Vercel"]
draft: true
featured: false
series:
  slug: build-my-blog
  title: "搭建个人博客"
  order: 4
canonical: "https://example.com/original"
cover: "/uploads/example/cover.png"
---
```

`series`、`canonical`、`cover`、`updatedAt` 可选。专题 order 必须从 1 连续增长。

## 项目复盘

路径：`content/projects/<slug>.md`

```yaml
---
title: "项目名称"
description: "项目摘要"
publishedAt: 2026-07-19
updatedAt: 2026-07-19
status: maintained # planning | building | maintained | archived
stack: ["TypeScript", "React", "Next.js", "Vercel"]
tags: ["TypeScript", "React", "Vercel"]
draft: false
featured: true
repository: "https://github.com/example/repo"
demo: "https://example.vercel.app"
---
```

`repository`、`demo`、`cover`、`updatedAt` 可选；外部 URL 必须为 HTTPS。

## Slug、标签与日期

Slug 只能使用小写英文字母、数字和连字符，并必须与文件名一致。首次公开后不可修改；若必须迁移，需要显式永久重定向。

标签来自 `lib/content/contract.ts` 的注册表，Studio 从同一注册表维护等价选项。别名只用于输入归一化，页面始终输出规范名称和 slug。

可见日期按作者时区 `Asia/Shanghai` 在构建时冻结。`draft: true`、发布日期晚于构建日期的记录不会出现在详情、集合、搜索、RSS 或 Sitemap。

## 构建实现

- `build/validate-content.ts`：Next.js 配置加载时读取全部内容并执行 schema、重复 slug、标签和专题连续性校验；
- `lib/content/index.ts`：使用 Node 文件系统读取 Markdown，并生成公开文章、项目、标签和专题索引；
- `next.config.ts`：注入构建日期，并通过 `outputFileTracingIncludes` 把 Markdown 纳入 Vercel Serverless 产物；
- `lib/content/markdown.ts`：生成与正文一致的目录锚点；
- `lib/search.ts`、`lib/discovery.ts`：从同一公开集合生成搜索文档、RSS 和 Sitemap。

选择 `yaml` 而不是允许可执行 frontmatter 的解析器，避免把动态执行带进生产包，并让字段约束可审计。

## 附件

公开附件位于 `public/uploads/<slug>/`。Obsidian 的默认附件目录是 `public/uploads`；作者可以直接粘贴图片，发布器会把当前笔记引用的 Wiki/Markdown 图片移动到文章或项目的专属子目录，并把正文改写为 `/uploads/<slug>/<稳定文件名>`。

- 允许格式：PNG、JPEG、WebP、GIF、AVIF；
- 原文件名已是小写 ASCII 安全名时保持不变；空格、中文或其他不稳定字符会转换为可读前缀加 8 位路径哈希；
- 本地图片必须来自 `public/uploads`，不允许 `..` 越界、查询参数、锚点或 Windows 非法字符；
- 已由 Git 跟踪且位于其他内容目录的附件不会被移动，避免破坏已有文章；
- 发布质量门失败时，草稿和本轮移动的附件都会恢复到原位置。

外部 HTTPS 图片不进入附件移动流程。网页后台继续写入同一公开目录和内容事实源。
