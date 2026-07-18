# 内容模型

- 状态：Frozen v1 in iteration 0002
- 目标：冻结一套无需数据库、可在构建期校验、可以稳定生成 URL 的 Markdown 契约。

## 目录与 URL

```text
content/
  posts/
    building-a-maintainable-blog.md
  projects/
    myblog.md
```

| 内容 | 文件 | URL |
| --- | --- | --- |
| 文章 / TIL | `content/posts/<slug>.md` | `/posts/<slug>` |
| 项目 | `content/projects/<slug>.md` | `/projects/<slug>` |
| 专题 | 从文章的 `series` 字段派生 | `/series/<series-slug>` |
| 标签 | 从内容的 `tags` 字段派生 | `/tags/<tag-slug>` |

Slug 默认取文件名；发布日期变化时 URL 不变。已经发布的 slug 禁止直接修改，需要显式重定向。

## 文章契约

```yaml
---
title: "从零搭建可维护的个人技术博客"
description: "如何先冻结内容、设计与交付边界，再开始写页面。"
type: article # article | til
publishedAt: 2026-07-18
updatedAt: 2026-07-18
tags: ["Next.js", "TypeScript", "Cloudflare"]
draft: false
featured: true
series:
  slug: build-my-blog
  title: 从零构建个人博客
  order: 1
---
```

### 必填字段

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `title` | string | 去除空白后非空，建议不超过 60 个中文字符 |
| `description` | string | 独立摘要，建议 60–160 个中文字符 |
| `type` | enum | `article` 或 `til` |
| `publishedAt` | ISO date | 公开发布日期 |
| `tags` | string[] | 1–5 个规范标签，去重 |
| `draft` | boolean | 生产构建排除草稿 |

### 可选字段

- `updatedAt`：必须不早于 `publishedAt`。
- `featured`：首页精选，默认 `false`。
- `series`：一旦存在，`slug`、`title`、`order` 必须同时存在，且同专题顺序唯一。
- `canonical`：内容在其他站点首发时使用完整 HTTPS URL。
- `cover`：仓库内相对资源路径；没有真实需要时不设置。

## 项目契约

```yaml
---
title: "MyBlog"
description: "把学习记录做成可维护、可检索、可复盘的工程资产。"
publishedAt: 2026-07-18
updatedAt: 2026-07-18
status: building # planning | building | maintained | archived
stack: ["TypeScript", "React", "Cloudflare"]
tags: ["Personal Knowledge", "Design Systems"]
draft: false
featured: true
repository: "https://github.com/Zach424/MyBlog"
demo: null
---
```

项目正文依次回答：背景与目标、约束、技术选择、关键实现、问题与解决、结果证据、复盘和下一步。没有证据的成果不写成确定结论。

## 跨内容校验

1. 文件名 slug 在对应集合中唯一，只使用小写 ASCII、数字和连字符。
2. 生产环境排除 `draft: true` 和未来日期内容。
3. 标签通过单一映射表规范化，避免 `TypeScript`、`typescript` 等重复概念。
4. `updatedAt` 不早于 `publishedAt`。
5. `repository`、`demo`、`canonical` 必须是完整 HTTPS URL。
6. 精选内容不能是草稿。
7. 专题顺序在同一 `series.slug` 内唯一且从 1 开始。

## 内容加载边界

- 使用 Vite `import.meta.glob` 将 Markdown 原文打包，避免 Cloudflare 运行时读取文件系统。
- frontmatter 解析、schema 校验和 Markdown 渲染统一放在 `lib/content`。
- 列表只暴露元数据，正文渲染按页面需要执行。
- 构建失败应指出具体文件和字段，不能静默跳过错误内容。

解析和渲染库在第 3 轮实现时确定；本轮只冻结输入输出契约，避免让库 API 反向定义内容模型。
