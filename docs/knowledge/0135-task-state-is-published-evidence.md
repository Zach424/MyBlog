---
title: 任务状态是发布证据，不是读者端临时状态
date: 2026-08-12
iteration: "0135"
tags:
  - MyBlog
  - Markdown
  - Task Lists
  - Accessibility
  - Architecture
---

# 任务状态是发布证据，不是读者端临时状态

关联：[[STATUS|当前项目状态]] · [[0135-read-only-task-ledgers|Iteration 0135]] · [[0134-table-is-a-data-integrity-contract|表格首先是数据完整性契约]]

## checkbox 的外形不等于交互授权

GFM 任务列表天然呈现复选框，但博客正文中的 `[x]` / `[ ]` 是作者发布时留下的项目状态。读者点击后若不能保存、同步或解释所有权，只会制造一个刷新即丢失的假任务系统。

正确边界是：

```text
作者在 Studio / Obsidian 编辑状态
  → 开放 GFM Markdown
  → AST 校验标题、预算、顺序与 checked
  → 服务端生成只读 Task Ledger
  → 搜索 / 屏幕阅读 / 窄屏 / 打印
  → Git 与 Vercel 交付
```

读者端不产生新状态，Git 中的 Markdown 始终是唯一事实。

## GFM checked 状态比正则更可靠

`remark-gfm` 会把合法任务项解析为 `listItem.checked: true | false`。这比扫描 `[x]` 文本更可靠，因为解析器已经处理列表、引用、大小写和行内 Markdown边界。

发布契约仍要收紧 GFM 的宽松部分：只允许顶层静态 `[!tasks]`、紧凑无序列表、每项单段、无嵌套。这样 mdast 校验与最终 HAST 结构保持一致，不会因为空行使 checkbox 被包进另一层段落而破坏视觉或无障碍处理。

## 状态要有三种投影

一个可信任务状态至少需要：

- 机器投影：checked/disabled input 与有名称的 progress；
- 可见投影：方框、DONE/OPEN、完成计数与百分比；
- 纸面投影：打印仍能区分完成和待完成。

只用颜色不够，只用删除线也不够。原生 disabled checkbox 提供语义，自定义方框用 `aria-hidden` 服务视觉，状态文字提供非颜色证据。

## 预算要限制整篇任务密度

只限制“每组最多 20 项”仍允许作者堆出很多组。当前契约同时限制：每组 2–20 项、每篇最多 4 组、合计最多 40 项、标题 120 字符、单项 240 字符。

这不是任务管理容量，而是阅读容量。超过它时，应拆成多篇阶段复盘或改用真正的项目管理工具。

## 作者端结构化，事实源仍应开放

Studio 用 boolean widget、可排序 list 降低手写错误，Obsidian 用命令插入模板；两者最后都只生成：

```markdown
> [!tasks] 标题
> - [x] 已完成
> - [ ] 待完成
```

没有专有 JSON、云端任务 ID 或本地存储。作者工具可以替换，内容仍可迁移、可审查、可 diff。

## 可复用判断

1. 控件外形不能自动推导读者交互权限；
2. 博客任务状态属于作者发布证据，读者端默认只读；
3. 优先消费解析器提供的 checked AST，不用正则重复解释 Markdown；
4. 发布契约要关闭会改变 HAST 结构的松散与嵌套写法；
5. 状态需要机器、视觉和打印三种一致投影；
6. disabled checkbox 保留语义，自定义标记只负责外观；
7. 预算应约束单组和整篇密度；
8. 搜索保留标题与任务内容，不索引作者 marker 和视觉状态噪声；
9. 作者端可以结构化编辑，最终仍应输出开放 Markdown；
10. 需要负责人、提醒、截止日期、评论或持久交互时，应使用独立任务系统，不扩张博客语法。
