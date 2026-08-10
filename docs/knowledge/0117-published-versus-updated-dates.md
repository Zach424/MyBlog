---
title: 区分内容的首发时间与维护时间
date: 2026-08-11
iteration: "0117"
tags:
  - MyBlog
  - 内容建模
  - 设计系统
  - 可访问性
---

# 区分内容的首发时间与维护时间

关联：[[STATUS|当前项目状态]] · [[0117-content-list-update-dates|Iteration 0117]]

## 问题

一条记录有两个常见时间：首次公开的 `publishedAt` 和事实最后变化的 `updatedAt`。列表若永远显示 publishedAt，会把持续维护的内容看成旧内容；若直接把日期换成 updatedAt 又不标注，会把维护日误认成首发日。

## 日期 presenter

```text
updatedAt > publishedAt
  → UPDATED / updatedAt

updatedAt 缺失或同日
  → PUBLISHED / publishedAt
```

presenter 同时输出 mode 和 date。组件只负责语义化渲染，不再独立比较日期或选择标签。

## 为什么同日仍是 PUBLISHED

内容可能在发布当天修正排版、补充链接或由工具统一写入 `updatedAt`。对读者而言，这不足以证明一次“发布后的维护”。只有严格更晚的日期才显示 UPDATED，避免放大没有时间差的更新事实。

## 两种列表语义

通用内容列表回答：当前可读版本最近何时形成？

```text
TYPE
UPDATED
2026-08-06
```

时间档案回答：这条记录何时首次进入工程轨迹？

```text
发布日期 2026-07-18
```

因此 archive 不复用通用日期 presenter。复用代码不是最高目标，保持问题语义才是。

## 排序与展示分离

本轮只改变可见日期，不改变 `ContentIndexList` 的输入顺序。文章、项目、专题和标签仍遵守各自既有排序；archive 仍按 publishedAt 分组。展示最近维护不等于按更新日重排，这两个决策必须分开评审。

## 验证层次

1. 纯函数覆盖晚更新、无更新、同日和输入不变；
2. SSR 覆盖 posts/projects/series/tags/reference ledger 五类消费者；
3. SSR 反向证明 archive 没有共享日期组件；
4. 390×844 深色验证三层元数据不挤压标题；
5. DOM 检查真实 `datetime`、单一 H1 与根宽；
6. 稳定生产等待所有边缘页面收敛后，再跑整站 smoke 与预算。

## 可复用经验

时间字段不是只有一个“最新日期”。同一记录在归档、搜索、订阅和维护界面里可能回答不同问题。正确做法是先命名语义，再选择字段；如果只传一个裸日期给组件，组件最终会把“首发”“更新”“复核”混成同一个概念。

共享 presenter 适合解决相同问题的重复实现；不同问题则应保持独立边界。这样既能减少漂移，也不会为了代码复用牺牲产品含义。
