---
title: 协议子路由必须拥有自己的缓存边界
date: 2026-08-11
iteration: "0126"
tags:
  - MyBlog
  - Next.js
  - RSS
  - HTTP Cache
---

# 协议子路由必须拥有自己的缓存边界

关联：[[STATUS|当前项目状态]] · [[0126-tag-scoped-rss|Iteration 0126]] · [[0124-head-is-a-framework-boundary|HEAD 框架边界]]

## 路径前缀相同，不代表缓存语义相同

`/tags/typescript` 是 HTML 页面，适合浏览器零 fresh、CDN 一小时缓存；`/tags/typescript/rss.xml` 是订阅协议，适合浏览器与共享缓存都 fresh 一小时；未知 Feed 则必须 `no-store`。三者共享 `/tags` 前缀，却是三种资源语义。

```text
/tags                    HTML index   → CDN cache
/tags/typescript         HTML detail  → CDN cache
/tags/typescript/rss.xml RSS 200      → public fresh
/tags/unknown/rss.xml    error 404    → no-store
```

用 `/tags/:path*` 给“标签页面”加缓存，实际是在给整个命名空间加缓存。未来新增 XML、JSON、下载或动作路由时都会被意外吞入。

## 配置层响应头会覆盖业务分支

Next 16.3 的 next.config headers 在文件系统路由前匹配；同一路径有多个同名 header 时，后一个匹配值覆盖前一个。Route Handler 即使明确返回 `Cache-Control: no-store`，配置层的匹配仍可能改写最终响应。

为已知 RSS 再加一个更具体的缓存规则只能修复 200，同时会继续覆盖未知 RSS 的 404。真正的边界应是：配置只匹配它确实拥有的 HTML 页面，协议路由由业务响应自己决定成功和错误缓存。

```text
不安全：/tags/:path*              → 未来所有子路由
安全：  /tags + /tags/:slug       → 当前两类 HTML 页面
协议：  Route Handler response    → RSS 200 / 304 / 404
```

## 成功测试不足以证明缓存安全

只检查已知 Feed 的 200 会漏掉最危险的负缓存：不存在资源一旦被公共缓存，内容稍后发布后仍可能继续返回陈旧 404。缓存测试至少要配对：

- 已知 GET 200 的 MIME、freshness、ETag、Last-Modified；
- 已知 HEAD 200 与 GET 表示头等价；
- ETag/日期 GET 与 HEAD 的 304 零正文；
- 未知 GET/HEAD 404 的 `no-store`；
- 未知响应不存在 ETag 和 Last-Modified。

错误状态不是附属分支，而是公开协议的一部分。

## 共享生成器不能共享错误身份

标签 Feed 可以复用根 RSS 的 item 序列化、排序、categories 和验证器，但它必须拥有自己的 channel title、home/self URL 与正文 SHA-256。条目 GUID 仍指向规范文章/项目 URL，因为标签 Feed 只是内容投影，不是新内容身份。

复用应发生在稳定语义边界：

```text
shared item serializer + shared conditional response
                     ↑
root records / tag-filtered records
                     ↓
distinct channel metadata + distinct body digest
```

## 可复用经验

路由配置应描述精确资源形状，不要用当前方便的通配符预占整个命名空间。新增协议子路由时，先审计所有父级 headers、rewrites 与 middleware；用已知和未知 GET/HEAD 一起验证最终发送边界。若框架配置覆盖业务响应，优先缩小配置所有权，而不是不断叠加更具体的例外。
