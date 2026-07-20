---
title: "Obsidian 发布链路验收草稿"
slug: "obsidian-delivery-validation"
description: "用于验证 Obsidian 发布器、Git 提交与 Vercel 自动部署链路的计划内容。"
type: til
publishedAt: 2099-12-31
updatedAt: 2099-12-31
tags:
  - Git
draft: false
featured: false
---

## 验收目的

这是一篇仅用于端到端发布验收的计划内容。Obsidian 发布器会在正式发布时把 `draft` 改为 `false`，因此使用未来发布日期保证验收期间不会进入公开文章列表、RSS 或 Sitemap。

## 验收范围

确认 Obsidian 发布器能够校验内容契约、生成目标 Markdown、创建 Git 提交并推送 `main`，随后由 Vercel Git Integration 自动部署同一提交。

## 清理策略

验收完成后删除该草稿；测试证据保留在迭代归档和 Git 历史中。
