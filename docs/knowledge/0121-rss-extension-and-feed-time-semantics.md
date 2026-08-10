---
title: 在 RSS 中保留首发身份，并用标准扩展表达修改时间
date: 2026-08-11
iteration: "0121"
tags:
  - MyBlog
  - RSS
  - Dublin Core
  - HTTP 缓存
---

# 在 RSS 中保留首发身份，并用标准扩展表达修改时间

关联：[[STATUS|当前项目状态]] · [[0121-rss-modification-semantics|Iteration 0121]] · [[0119-event-ledger-semantics|事件账本语义]]

## 一个时间字段不应承担两个事实

RSS 2.0 的 `pubDate` 是条目首次发布事实。文章后来更新时，如果直接把它改成更新时间，会产生三个问题：

- 首发历史被覆盖；
- 阅读器可能把旧内容重新当作新条目；
- RSS、archive、JSON Feed 与可见活动流开始互相矛盾。

更稳的模型是保留两个正交字段：

```text
publishedAt ─→ pubDate             首发身份
updatedAt   ─→ dcterms:modified    后续变化，仅严格更晚时存在
```

频道 `lastBuildDate` 回答“这份 Feed 当前反映到什么时候”，也不应替代逐条时间。

## RSS 扩展的关键是命名空间

[RSS 2.0 规范](https://www.rssboard.org/rss-specification)允许使用在 XML namespace 中定义的模块扩展。扩展不是随意增加 `<modified>`，而是同时声明语义所有者：

```xml
<rss xmlns:dcterms="http://purl.org/dc/terms/">
  <item>
    <dcterms:modified>2026-08-05T00:00:00Z</dcterms:modified>
  </item>
</rss>
```

[DCMI `modified` 定义](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/terms/modified/)正是“资源发生变化的日期”；[DCMI Terms 规范](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/)也明确 `/terms/` namespace 可用于非 RDF XML。这样字段的名字、命名空间和定义来自同一标准，而不是站点私有约定。

## 不要因为 Atom 有 updated 就混用内容模型

[RFC 4287](https://www.rfc-editor.org/rfc/rfc4287)把 `atom:updated` 定义在 Atom feed/entry 内容模型中。RSS 根使用 `atom:link` 声明 self link 是成熟的 RSS Atom 扩展实践，但这不意味着任意 Atom entry 子元素都可以直接放进 RSS item。

选择扩展时应同时检查：

1. 宿主格式是否允许 namespace 扩展；
2. 元素自身的标准定义是否符合所需事实；
3. 元素是否依赖另一个内容模型的父子结构；
4. 不理解扩展的消费者能否安全忽略。

这比只凭元素名称“看起来合适”可靠得多。

## 兼容性证据要分级

规范证明“可以这样表达”，解析器实现证明“至少有真实消费者能识别”，但两者都不能证明所有阅读器 UI 会展示或触发通知。[Python feedparser 的 Dublin Core 实现](https://github.com/kurtmckee/feedparser/blob/develop/feedparser/namespaces/dc.py)会把 `dcterms:modified` 映射到更新时间解析路径，这是具体兼容性证据。

可用以下层级描述承诺：

```text
规范合法       已证明
XML 可解析      本地与生产已证明
代表解析器识别  有源码证据
所有阅读器展示  未证明，也不承诺
```

公开文档应保留最后一条边界，避免把开放协议误写成对第三方 UI 的控制权。

## 跨格式关系测试比子串测试更强

只检查 RSS 中出现四次 `dcterms:modified`，无法证明它们属于正确条目。更可靠的测试以稳定身份逐项关联：

```text
RSS guid             = JSON Feed id
RSS pubDate          = JSON Feed date_published 转 UTC 字符串
RSS modified[0]      = 严格更晚的 JSON Feed date_modified
RSS modified.length  = 0 或 1
```

还要反向断言 `atom:updated` 不存在、输入数组未变、GUID 顺序未变。负向契约很重要：它证明新增能力没有偷偷改写既有协议。

## 协议变化也需要生产预算

新增 namespace 与四个时间元素后，生产 RSS 从 3238/1241 B 增至 3536/1298 B（raw/gzip）。增长很小，但仍应遵循：

```text
失败优先测试
  → 实现
  → 完整本地门
  → 功能提交部署
  → 真实生产测量
  → 统一更新带来源基线
```

ETag 由最终响应字节生成，因此 XML 改变后标签自然更新；条件 304、缓存和 gzip 预算必须一起验证。不能只因为字段“只是元数据”就绕过生产证据。

## 可复用经验

为成熟格式补充语义时，先拆清事实，再寻找有命名空间、定义准确、可被旧消费者忽略的扩展。保留原身份字段，用新字段表达新事实；用跨格式逐项关系验证正确性，用真实解析器和生产响应补足字符串测试。兼容性声明只到证据能支持的层级，不把标准合法性夸大成所有客户端行为一致。
