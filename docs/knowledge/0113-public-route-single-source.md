---
title: 公开路由单一事实源
date: 2026-08-11
iteration: "0113"
tags:
  - MyBlog
  - Next.js
  - 架构
  - Sitemap
---

# 公开路由单一事实源

关联：[[STATUS|当前项目状态]] · [[0113-public-route-facts|Iteration 0113]]

## 问题

同一个“公开 URL 数量”同时出现在首页和 Sitemap 时，如果两边各自维护数组或数字，新增页面后很容易只更新其中一处。把 `25` 手改成 `26` 只能修复一次展示，不能消除漂移机制。

## 本轮结论

公开路由应该先生成一份带语义的事实清单，再由消费者投影：

```text
Markdown 公开记录
    + 静态公开页面
    ↓
createPublicRouteInventory()
    ├─ routes → Sitemap XML
    ├─ total → 首页 Evidence Rail
    └─ latestModified → 首页 LATEST / Sitemap 根 lastmod
```

当前计数是：

```text
10 个静态页面
+ 3 篇文章
+ 1 个项目
+ 1 个专题
+ 11 个标签
= 26 条 Sitemap URL
```

这里的“公开 URL”严格指可索引 Sitemap 集合。Feed、Schema、Studio、OAuth、404 和 `source.md` 虽然可访问，但不属于这个指标。

## 实现原则

1. 静态事实只声明 path、日期来源、更新频率和优先级；
2. 动态事实只从已验证的公开内容和派生索引产生；
3. `latestModified` 使用 `updatedAt ?? publishedAt`，不读取 Git、构建时间或云部署时间；
4. 总数永远取最终数组长度，不再单独维护；
5. 最终数组检查 path 唯一性，静态/动态跨集合冲突立即失败；
6. 空内容集合允许日期为空，界面显示诚实降级文本；
7. 首页和 Sitemap 都保持服务端计算，不为同步状态增加客户端 fetch。

## 测试方法

纯函数测试锁定输入到路由顺序、总数、最新日期和重复路径失败。真实 HTTP 测试同时请求首页与 Sitemap：

- 从 Sitemap 解析实际 `<loc>` 数量；
- 要求首页显示完全相同的数量；
- 从 Sitemap 根 URL 读取 `lastmod`；
- 要求首页 `LATEST` 完全相同；
- 拒绝遗留的手写 `REV. <数字>`。

关系断言比“首页等于 26、Sitemap 也等于 26”更稳，因为新增内容后不需要修改测试常量。

## 适用边界

- 新增可索引静态页面：加入 `STATIC_PUBLIC_ROUTE_FACTS`；
- 新增文章、项目、专题或标签：内容索引会自动进入清单；
- 新增 API、Studio 资源或非索引错误页：不要加入清单；
- 路由迁移：仍通过 `content/redirects.yml` 和构建门处理；
- 缓存策略：不是路由事实的一部分，必须按 Next/Vercel 最终响应单独验证。

## 可复用经验

单一事实源的重点不是文件数量，而是“同一语义只能有一个派生入口”。表现层可以有多个，但不能各自重新解释集合、总数和日期。对于博客之外的仪表盘、价格页、权限页或发布状态页，也应优先测试消费者之间的精确关系，而不是复制相同常量。
