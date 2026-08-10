---
title: 让机器状态与人类状态只有一个展示边界
date: 2026-08-11
iteration: "0116"
tags:
  - MyBlog
  - TypeScript
  - 设计系统
  - 架构
---

# 让机器状态与人类状态只有一个展示边界

关联：[[STATUS|当前项目状态]] · [[0116-unified-project-status-presentation|Iteration 0116]]

## 问题

同一个 `maintained` 在三个组件里分别经过首字母大写、全大写和原样拼接，就会得到：

```text
Maintained
MAINTAINED
Project / maintained
```

三者都忠于原始 enum，却让读者无法判断这是不是不同状态。问题不是数据源重复，而是展示规则重复。

## Presenter 结构

```text
maintained
    ↓
getProjectStatusPresentation()
    ├─ label: 持续维护
    ├─ code: MAINTAINED
    └─ meta: 持续维护 · MAINTAINED
```

label 服务完整中文句，code 服务机器识别，meta 服务紧凑状态位。页面不再自行翻译、改大小写或拼分隔符。

## 为什么不修改原始 enum

`planning/building/maintained/archived` 是内容 contract、Markdown、Studio、公开清单和其他机器消费者的稳定协议。中文属于展示层。如果为了 UI 一致性把 enum 改成中文，会把翻译责任扩散到写作、验证和协议；正确边界是在公开组件前建立 presenter。

## 穷举与复制

```ts
const presentations: Record<ProjectStatus, Presentation> = {
  planning: { ... },
  building: { ... },
  maintained: { ... },
  archived: { ... },
};
```

`Record` 让 TypeScript 在 enum 新增时要求同步展示，不把未知状态静默转换成看似合理的字符串。函数返回对象副本，消费者无法修改共享表。

## 语境规则

- 首页项目卡、项目集合尾注、详情 eyebrow：使用完整 meta；
- About 的说明句、Current focus：只用 label；
- Markdown、JSON、CMS：保留原始 enum；
- 页面自己的上下文如 `Featured project`、`Project /`、箭头继续存在，但不改变状态核心。

这不是要求所有 UI 完全相同，而是让同一概念在不同结构里保持同一语言。

## 验证层次

1. 穷举四种状态的 label/code/meta；
2. About 和首页旧测试证明 label 行为未变；
3. SSR 并行验证三个公开表面的统一 meta；
4. SSR 明确拒绝三种旧格式；
5. 390×844 深色逐页验证双语换行、一个 H1 和零横向溢出；
6. Markdown/清单/Studio 既有测试证明机器 enum 未改变；
7. 稳定生产三页抽查加整站 smoke 证明交付闭环。

## 可复用经验

枚举的 `.toUpperCase()` 只是一种字符操作，不是产品语义。只要一个状态需要翻译、无障碍解释、颜色、排序或多个展示形态，就应该先形成独立 presenter，再让组件选择适合语境的字段。

一致性也不等于强制单行。窄屏允许 `label · CODE` 在自然边界换行，比截断、缩小字号或只保留机器码更诚实。真正需要统一的是概念与文本，而不是每个容器的几何形态。
