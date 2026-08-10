---
title: Last-Modified 只有参与往返验证才是完整能力
date: 2026-08-11
iteration: "0123"
tags:
  - MyBlog
  - HTTP 缓存
  - Last-Modified
  - 架构边界
---

# Last-Modified 只有参与往返验证才是完整能力

关联：[[STATUS|当前项目状态]] · [[0123-dated-content-conditional-reads|Iteration 0123]] · [[0122-http-date-validator-precedence|HTTP 日期验证优先级]]

## “响应里有字段”不是完整功能

资源返回 `Last-Modified` 只完成了一半。客户端真正的使用路径是：读取日期、缓存正文、下次把日期放进 `If-Modified-Since`，服务端再决定 304 或 200。如果最后一步不存在，字段只是说明信息，不是可操作验证器。

最小往返契约是：

```text
GET → 200 + Last-Modified + body
GET + same If-Modified-Since → 304 + empty body
GET + stale/bad date → 200 + same body
```

还必须加入 `If-None-Match` 反例，证明日期没有覆盖更精确的 ETag。

## 业务事实与协议控制流应分层

内容清单知道自己的 JSON、Link 和最新公开日期；单篇 Markdown 知道 canonical、文件名和 published/updated/reviewed。它们不需要分别实现实体标签列表解析和条件优先级。

更稳的边界是：

```text
业务模块：body + business headers + lastModified fact
通用助手：SHA-256 ETag + date validation + precedence + 200/304
```

这样协议修复只发生一次，调用方仍保留各自真实日期语义。

## 最有价值的反例是“陈旧 ETag + 命中日期”

只测试单独 IMS 很容易得到错误实现：

```js
if (etagMatches || dateMatches) return 304;
```

正确规则不是 OR。请求同时包含陈旧 ETag 和足够新的日期时必须返回 200，因为 `If-None-Match` 的存在会屏蔽 IMS。这个反例可以快速区分“碰巧能返回 304”和“真正遵守条件优先级”。

## 三层测试各自证明什么

- 纯响应函数：日期解析、旧/坏日期和优先级；
- 真实 Next 生产构建：Route Handler 接线和框架行为；
- 稳定 Vercel：CDN 弱化 ETag、精简 304 元数据后的等价语义。

测试真实应用前必须重建 `.next`。旧构建继续返回 200 并不代表新源码失败；生产式测试的价值正是拒绝把源码状态与运行产物混为一谈。

## 响应决策变化与正文预算分开

Iteration 0123 没有改变清单或 Markdown 的任何正文，因此 ETag 与 raw/gzip 实测保持不变。新增的是“相同客户端状态能否得到 304”。正确归档应记录条件行为的新增证据，并明确不重写相同正文基线。

## 可复用经验

审计缓存能力时不要只列响应头，要按客户端往返验证。把日期事实留在业务层，把 ETag、日期解析、优先级和响应状态集中在公共边界；用陈旧 ETag 反例防止粗粒度日期越权。最后分别验证纯逻辑、框架产物与边缘平台，并把正文预算和响应决策视为两条独立证据链。
