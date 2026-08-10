---
title: 让 ETag 优先，并为 Feed 建立可信的 HTTP 日期验证
date: 2026-08-11
iteration: "0122"
tags:
  - MyBlog
  - HTTP 缓存
  - ETag
  - Last-Modified
---

# 让 ETag 优先，并为 Feed 建立可信的 HTTP 日期验证

关联：[[STATUS|当前项目状态]] · [[0122-feed-http-date-validators|Iteration 0122]] · [[0121-rss-extension-and-feed-time-semantics|RSS 修改时间语义]]

## ETag 与 Last-Modified 解决不同精度的问题

ETag 可以由最终响应字节生成，适合回答“客户端缓存的是否就是当前这份表示”。Last-Modified 只有秒级时间，适合不持有 ETag 的客户端做兼容回退。两者不是二选一：

```text
ETag          精确表示身份，正文任一字节变化就改变
Last-Modified 可解释时间事实，兼容日期条件请求
```

因此组合策略应是 ETag 优先、日期回退，而不是两个条件任意一个命中就返回 304。

## 条件优先级是协议契约

[RFC 9110 §13.1.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3)要求：请求存在 `If-None-Match` 时，接收方必须忽略 `If-Modified-Since`。[RFC 9110 §13.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.2)与 [RFC 9111 §4.3.2](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.2)给出相同优先顺序。

典型反例是：

```http
If-None-Match: "old-etag"
If-Modified-Since: Tue, 11 Aug 2026 00:00:00 GMT
```

即使日期看起来足够新，只要 ETag 不匹配，就必须返回 200。否则粗粒度日期会覆盖更精确的字节身份，客户端可能错误沿用旧正文。即使 `If-None-Match` 自身格式无效，它的存在仍会屏蔽 IMS；不能因为更容易返回 304 就偷偷改写优先级。

## HTTP-date 的发送与接收规则不对称

[RFC 9110 §5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7)规定发送方使用 IMF-fixdate，但接收方必须兼容三种格式：

```text
Sun, 06 Nov 1994 08:49:37 GMT       IMF-fixdate
Sunday, 06-Nov-94 08:49:37 GMT      obsolete RFC 850
Sun Nov  6 08:49:37 1994            ANSI C asctime
```

实现时不宜直接把任意字符串交给 `Date.parse()`。宽松解析可能接受 ISO 日期、自动把不存在的日期滚入下个月，或忽略星期错误。可靠验证器应先匹配语法，再检查闰年、月份天数、时分秒和星期一致性，最后才生成 UTC 时间戳。

## Feed 的修改时间不能只取内容最大值

假设所有文章日期都没有变化，但 RSS 新增一个标准字段。最终 XML 已经改变，旧缓存需要重新验证；如果 Last-Modified 只取最新文章日期，它就无法表达这次表示修订。

更完整的公式是：

```text
representation last modified
  = max(serialization revision, latest public content date)
```

序列化修订必须按表示独立维护：JSON Feed 与 RSS 可能在不同提交改变。修订值应绑定确切来源提交，只在正文契约变化时更新；不能使用每次都会变化的构建时间、部署时间或模糊文件 mtime。

[RFC 9110 §8.8.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2)还要求 Last-Modified 不得在未来。对于只有 `YYYY-MM-DD` 的作者日期，本项目以作者所在地 `T00:00:00+08:00` 解释，再转换为 GMT。直接补 `T00:00:00Z` 会把上海当天推迟八小时，在本地凌晨发布时生成未来响应头。

## 正文预算与响应头行为应分开判断

Iteration 0122 的 JSON Feed 与 RSS 正文一个字节都没有变化，因此 SHA-256 ETag、raw/gzip 实测和冻结预算也没有变化。变化只发生在响应头与条件求值路径。

正确的证据链是：

```text
精确 Last-Modified 响应头
  + 三种日期解析
  + 日期命中 304
  + 旧/坏日期 200
  + ETag 优先
  + 304 零正文
  + 原正文/ETag/预算不变
```

不应为了让每轮都有预算提交而重写相同数字。基线只在正文发生有价值的实际增长、部署后重新测量并完成归档时更新。

## 可复用经验

为已有 ETag 的资源补日期验证时，先定义资源真实修改事实，再实现严格的协议优先级。发送端生成唯一规范格式，接收端兼容规范要求的历史格式；用日历与星期校验拒绝宽松解析；把表示修订与内容更新分别建模。最后把响应头行为和正文预算分开验证，避免把“协议更完整”误写成“正文发生变化”。
