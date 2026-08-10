---
title: HEAD 无正文是 HTTP 契约，也是框架发送边界
date: 2026-08-11
iteration: "0124"
tags:
  - MyBlog
  - HTTP
  - HEAD
  - Next.js
---

# HEAD 无正文是 HTTP 契约，也是框架发送边界

关联：[[STATUS|当前项目状态]] · [[0124-conditional-head-semantics|Iteration 0124]] · [[0123-reuse-conditional-response-boundary|条件响应边界]]

## HEAD 不是“少下载一点的 GET”这么简单

[RFC 9110 §9.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.2)要求 HEAD 使用与 GET 相同的语义，但服务器不得发送响应内容。它常用于检查链接、缓存身份和最近修改时间。

可靠契约至少包含：

```text
相同资源选择
相同状态与条件优先级
等价的表示元数据
始终没有响应内容
```

只断言 `status === 200` 无法发现服务器错误发送正文，也无法证明 ETag、日期和缓存仍属于同一表示。

## 业务 Response 与最终网络响应不是同一层

MyBlog 的 GET handler 会构造带正文的 Web `Response`。对 HEAD 请求，条件助手仍可能生成这个正文；Next 的最终发送层看到 `req.method === 'HEAD'` 后不把 body 写到网络。

```text
业务生成器 → Response(body, headers)
Next 发送层 → HEAD 时只发送 status + headers
客户端      → body length = 0
```

因此直接单元测试 Response 对象不能证明最终 HEAD 语义。必须启动真实 `next start`，再用网络请求验证；稳定 Vercel 还要证明边缘层没有破坏它。

## 文档、源码和实测的证据层级

[Next.js Route Handler 文档](https://nextjs.org/docs/app/api-reference/file-conventions/route#http-methods)明确列出 HEAD 支持，但当前文档只对 OPTIONS 明说自动实现。安装包 `send-response.js` 解释了本地版本为何没有正文，稳定生产实测则证明这条实现确实穿过构建、适配器和 CDN。

三层证据各有职责：

```text
规范：应该满足什么
安装包源码：当前版本如何做到
真实 HTTP：整个部署链是否真的做到
```

任何一层都不能独自替代另外两层。

## 条件 HEAD 必须复用 GET 的反例矩阵

HEAD 不只需要普通 200。已有条件读取的资源还要覆盖：

- 匹配 ETag → 304 / 零正文；
- 匹配 Last-Modified → 304 / 零正文；
- 旧日期或非法日期 → 200 / 零正文；
- 陈旧 ETag + 命中日期 → 200 / 零正文，证明 ETag 优先；
- 未知资源 → 404 / 零正文 / `no-store` / 无验证器。

状态为 200 不代表有正文，这是 HEAD 与 GET 测试最容易写错的地方。

## 不要为隐式正确行为复制九套实现

审计发现 Next 当前已经正确处理九个端点。如果此时每条路由显式导出 HEAD，会复制参数解析、内容 getter 和响应头生成，并制造新的漂移面。更小而更可靠的实现是保留单一 GET 业务路径，把框架行为纳入版本绑定的真实应用和生产门。

这种决策有一个重要前提：文档必须明确依赖 Next 发送层，升级框架必须重跑门禁。测试不是为“不改代码”找理由，而是把隐式依赖变成会在变化时明确失败的维护资产。

## 可复用经验

验证 HEAD 时要从网络边界观察，不要停在业务 Response。用 GET 生成期望元数据，用 HEAD 证明零正文和头等价，再复用 ETag、日期和错误反例。若框架已经正确，优先增加跨版本回归门而不是复制 handler；同时把实现依赖写入架构与运维文档，让未来升级失败成为有解释的信号。
