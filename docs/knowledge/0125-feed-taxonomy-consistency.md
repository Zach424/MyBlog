---
title: Feed 分类应来自同一标签事实源
date: 2026-08-11
iteration: "0125"
tags:
  - MyBlog
  - RSS
  - JSON Feed
  - Taxonomy
---

# Feed 分类应来自同一标签事实源

关联：[[STATUS|当前项目状态]] · [[0125-rss-category-alignment|Iteration 0125]] · [[0121-rss-extension-and-feed-time-semantics|RSS 时间语义]]

## 字段同名或同形，不代表语义相同

RSS item 的 `<category>` 能装任意文本，内容记录的 `type` 和 `tags` 也都是字符串。但“文章类型”回答它是什么，“主题标签”回答它谈什么。把二者都塞进 category 会让订阅器看到与站内标签页、JSON Feed 不同的分类体系。

```text
type: article       → 内容形态
tags: TypeScript    → 主题分类
RSS category       → 本站选择映射主题分类
```

格式的宽松不能替代产品语义决策。

## 跨格式一致性应验证业务值

本站的事实源是 `ContentRecord.tags`。JSON Feed 直接输出字符串数组，RSS 必须先 XML 转义。测试若只比较最终字节，会把 `Data &amp; XML` 和 `Data & XML` 误认为不同值；生产验证应先安全解析或解码 XML 文本，再逐 item 比较数量、顺序和值。

```text
author tag  → Data & <XML>
JSON Feed   → "Data & <XML>"
RSS bytes   → <category>Data &amp; &lt;XML&gt;</category>
reader fact → Data & <XML>
```

单元测试负责转义合法性，跨格式测试负责语义一致性，两者不能互相替代。

## 不要发明 category domain

[RSS 2.0](https://www.rssboard.org/rss-specification)允许 category 带可选 `domain`，用于指出分类体系。可选不等于应该填写。若项目没有公开、稳定、可解释的 taxonomy URI，随意放站点首页或标签页前缀只会制造看似正式的虚假协议。

无 domain 的 category 足以表达自由标签。未来若真正定义受控分类体系，应把它当作公开协议迁移：明确 URI、旧客户端行为、验证器和生产证据。

## 表示身份必须随正文契约变化

移除错误类型 category 会改变 RSS 正文，即使 URL、GUID 和时间事实都不变。最终正文 SHA-256 ETag 会自然变化，但 Last-Modified 若只看内容日期就无法表达“序列化规则变了”。因此 Feed 需要独立的表示修订时间，并与最新内容日期取最大值。

这个时间不是构建时间，也不是任意文件 mtime；它是维护者明确批准新公开正文契约的事实。只有响应头、测试或文档变化时不应推进，正文格式变化时则必须推进。

## 可复用经验

先审计现状，再把路线图改写成真实问题。为多个公开格式建立一个事实源，让每种格式只负责合法编码；测试同时覆盖编码层和业务层。删除冗余字段也要按公开表示迁移处理：推进验证器、等待真实部署、重测稳定生产基线，并把来源提交写入归档。
