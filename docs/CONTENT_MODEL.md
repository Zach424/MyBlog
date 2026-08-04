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
freshness: historical # historical | current
reviewedAt: 2026-07-19
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
freshness: current # historical | current
reviewedAt: 2026-07-19
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

## 内容语境与复核

`freshness` 与 `reviewedAt` 是所有文章、TIL 和项目的必填字段：

- `historical`：按时间点保存问题、方案和证据；可以保留旧框架/平台，但正文应说明这是历史并链接当前记录；
- `current`：承诺架构、地址、状态和操作说明与当前系统一致；最多 180 天必须重新复核；
- `reviewedAt`：最近一次逐项确认事实的日期，不能早于 `updatedAt`（或 `publishedAt`），也不能晚于构建日期；
- 计划/未来内容在公开前不参与 180 天门，Historical snapshot 不因时间推移失效。

详情页事实栏显示 `Context` 与 `Reviewed`。`dateModified` 使用 `reviewedAt`，因此搜索引擎和读者看到同一复核证据。更新正文后必须同步更新 `updatedAt` 和 `reviewedAt`；只做事实复核也需要更新 `reviewedAt`。

## 构建实现

- `build/validate-content.ts`：Next.js 配置加载时读取全部内容并执行 schema、重复 slug、标签、专题、关系与 180 天新鲜度校验；
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

## 站内链接与引用关系

正式 Markdown 使用稳定站点 URL：

```markdown
[文章](/posts/building-a-maintainable-blog)
[项目章节](/projects/myblog#验证与质量门)
```

Obsidian 草稿可以使用更自然的输入，发布器会在进入正式内容目录前完成转换：

```markdown
[[building-a-maintainable-blog|文章]]
[[projects/myblog#验证与质量门|项目章节]]
[项目](../projects/myblog.md)
[[#本文章节]]
```

裸 slug 必须在文章与项目间唯一；同名时写明 `posts/` 或 `projects/`。不存在的目标、歧义目标和 `#^block-id` 块引用会被拒绝。外部链接不转换，行内代码与围栏代码中的示例不参与转换。

构建只从公开正文中的 `/posts/<slug>` 与 `/projects/<slug>` 提取关系，去重后生成反向引用。目标缺失或未公开会让构建失败；自引用不会进入反向引用列表。关系不另存一份 frontmatter，避免链接与人工索引漂移。
