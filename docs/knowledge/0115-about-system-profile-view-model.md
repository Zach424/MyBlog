---
title: 用系统档案表达内容型 About
date: 2026-08-11
iteration: "0115"
tags:
  - MyBlog
  - Next.js
  - 架构
  - 内容建模
---

# 用系统档案表达内容型 About

关联：[[STATUS|当前项目状态]] · [[0115-content-derived-about-profile|Iteration 0115]]

## 问题

个人博客的 About 常把技术栈和内容范围写成一段自述。原则性文字通常稳定，但“有多少内容、最后何时更新、当前项目用什么技术”会随着仓库变化。一旦这些事实也保存在 JSX 句子里，About 就成为站点的第二份过期状态。

## 投影边界

```text
公开 posts/projects/series/tags ──→ 集合计数
共享 public route inventory ─────→ URL 总数 / 最新日期
精选 ProjectRecord ──────────────→ 标题 / 链接 / 状态 / stack
                                      ↓
                           createAboutProfile()
                                      ↓
                       Intro meta / facts / project
```

投影只接收五个非负整数、可选日期和 `Pick` 后的项目字段。正文、描述、源路径、draft、repository 和其他作者数据不会进入 About 模型。

## 稳定文案与可变事实

适合保留为文案：

- 为什么记录；
- 什么算完成；
- 只通过 GitHub 联系的边界。

必须由数据生成：

- 文章、项目、专题、标签数量；
- 公开 URL 数量；
- 最近更新日期；
- 当前项目名称、状态和技术栈。

判断方法仍是：内容或部署事实变化后，这句话是否应该自动变化？如果是，就不应只有 JSX 副本。

## 展示层职责

内容 contract 保存稳定机器 enum：`planning/building/maintained/archived`。公开中文页面需要人类标签，但翻译不属于 About，也不属于首页。`content-presentation.ts` 因此成为共享展示边界：机器接口继续输出原值，页面消费中文语义。

系统档案使用 `dl`，因为它表达“名称—值”而不是无语义卡片。可解释的集合数量链接到对应页面；总 URL 和日期只是系统属性，不伪装成交互。stack 是作者有序事实，完整输出并由 flex wrap 解决密度。

## 空集合规则

```text
0 条记录 → 0 RECORDS / NO PUBLIC CONTENT
无日期    → 最近更新：暂无公开内容
无项目    → 等待首个公开项目 / NO PUBLIC RECORD / 空 stack
非法计数  → 抛错，不渲染似真的统计
```

空状态由同一纯函数生成；React 页面不补写另一套兜底。

## 验证层次

1. 纯函数精确比较正常投影；
2. 空集合证明没有虚构日期、项目或 stack；
3. 非负整数门拒绝小数和负数；
4. 首页回归测试证明共享 status 提取没有改变旧行为；
5. SSR 要求真实数字、日期、项目和完整 stack，并拒绝旧手写句；
6. 390×844 深色检查一个 H1、零横向溢出和标签换行；
7. raw/gzip 预算约束系统档案的 HTML 成本；
8. 稳定生产必须在 Git push 和 Vercel 收敛后单独证明，本地绿灯不能替代。

## 可复用经验

内容型 About 的价值不是列出更多自我描述，而是把“是谁、怎样工作”与“当前系统有什么”分开：前者是长期承诺，后者是可验证投影。这样新增文章、专题或技术栈时，About 会跟随事实变化，而作者只维护内容源。

view-model 也形成清晰的隐私边界：只把公开展示需要的最小字段交给组件。即使数据源未来从文件迁移，只要保持输入契约，About 的语义、空状态和测试都无需重写。
