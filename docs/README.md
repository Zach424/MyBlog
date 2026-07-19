# 项目档案

此目录是博客的长期项目记忆。代码说明“现在如何运行”，这里说明“为什么这样设计、每轮改变了什么、验证证据是什么”。

## 稳定文档

| 文档 | 作用 | 更新时机 |
| --- | --- | --- |
| [PROJECT.md](./PROJECT.md) | 目标、用户、范围、内容结构和成功标准 | 产品方向变化时 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 技术栈、模块边界、数据流和目录结构 | 架构变化时 |
| [CONTENT_MODEL.md](./CONTENT_MODEL.md) | 内容类型、字段契约、URL 和校验规则 | 内容契约变化时 |
| [DESIGN.md](./DESIGN.md) | 视觉概念、Token、排版和交互原则 | 设计系统变化时 |
| [DISCOVERY.md](./DISCOVERY.md) | 搜索、RSS、Sitemap、robots 与绝对 URL | 发布发现能力变化时 |
| [QUALITY.md](./QUALITY.md) | 发布质量门、安全、缓存、体积预算与依赖审计 | 质量或部署基线变化时 |
| [OPERATIONS.md](./OPERATIONS.md) | 内容发布、生产验收、监控、故障处理和回滚 | 运维流程或平台变化时 |
| [MIGRATION.md](./MIGRATION.md) | 所有者账号配置、双入口验收、生产切换和回滚清单 | 迁移或生产 origin 变化时 |
| [ROADMAP.md](./ROADMAP.md) | 阶段、门槛和全局状态 | 每轮结束时 |
| [decisions/](./decisions/) | 重要技术决策及其取舍 | 做出难以逆转的决策时 |
| [iterations/](./iterations/) | 每轮范围、实现、验证和经验 | 每轮提交前 |

## 归档规则

- 每轮只聚焦一个主要目标。
- 归档必须包含：结构状态、设计内容、技术、功能、方法、验证证据、经验、风险和下一步。
- 代码、稳定文档、轮次归档必须在同一个提交中保持一致。
- 未通过验证的功能只能标记为 `partial`，不能标记为 `done`。
- 密钥、Token、个人隐私和线上凭证禁止写入档案。
