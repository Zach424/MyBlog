# 当前项目状态

> 更新时间：2026-08-05 · 每轮迭代更新 · 本文件位于仓库根 Obsidian Vault 中

## 产品目标

MyBlog 是 Zach424 的个人技术知识库与公开工程日志。它把学习记录、技术判断和项目复盘保存为可检索、可链接、可版本控制的 Markdown；作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，`main` 自动交付到 Vercel。

## 当前结构

| 模块 | 状态 | 当前责任与证据 |
| --- | --- | --- |
| 内容契约 | done | YAML + Zod 校验文章、TIL、项目、标签、专题、日期、URL、内容语境、复核日期与本地封面替代文本 |
| 公开阅读 | done | 首页、文章、项目、专题、标签、搜索、关于、响应式、深色模式与详情页封面 |
| Markdown | done | GFM、代码高亮、H2/H3 目录、阅读时间、相邻文章与响应式正文图片 |
| 内容发现 | done | SEO、内容级 OG/Twitter 封面、JSON-LD、RSS、Sitemap、robots、本地全文搜索 |
| 网页写作 | done | `/studio`、GitHub OAuth、Decap editorial workflow、PR、按内容 slug 归档媒体、首次保存后稳定 slug 锁定 |
| Obsidian 写作 | done | Vault、模板、桌面发布插件、`--check-only`、`--push` |
| 附件发布 | done | Wiki/Markdown 图片转换、按内容隔离、稳定命名、越界保护、失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟 |
| 恢复能力 | done | Vercel 显式目标回滚、当前版本恢复、再次冒烟 |
| 内容知识网络 | done | Obsidian/Markdown 站内链接转换、构建期完整性校验、文章与项目双向引用账本 |
| 永久链接迁移 | done | Git 版本化 redirect 注册表、当前路由/静态文件冲突门、公开目标校验、单跳 308 与生产冒烟 |
| 内容新鲜度 | done | Current/Historical 可见语境、复核日期、当前记录 180 天构建门、现行 Demo |
| 内容维护报告 | done | 本地文本/JSON、60/30 天分级、Actions 摘要与每周自动复核 |
| 根暂存媒体审计 | done | inbox 引用账本、Git/文件系统年龄证据、共享/未引用/陈旧/缺失报告与 Actions warning，零自动删除 |
| 媒体门禁 | done | 真实格式解码、3 MiB/2560 px/像素与动图预算、Studio 上传前诊断、Obsidian 优化与构建扫描 |
| 媒体引用完整性 | done | Markdown AST 图片抽取、精确路径存在性、根暂存拒绝、slug 所有权与已归档孤儿附件门禁 |
| 媒体展示 | done | 封面与本地 Markdown 正文图共享固有尺寸/`next/image` 链路；HTTPS 外图有明确降级边界 |

## 设计与技术

- 视觉方向：Commit Trace / Evidence Rail，中文优先、工程档案感、浅深色响应式；
- 运行时：Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- 内容：仓库内 Markdown、YAML、Zod，GitHub 是唯一事实源；
- 阅读：react-markdown、remark-gfm、rehype-slug、rehype-highlight；
- 发布：Decap CMS 3.14.1、GitHub OAuth、stable slug 自定义控件、Obsidian 自有插件与 Node 发布脚本；
- 媒体：Sharp 0.35.3、浏览器 magic/帧结构解析与 `createImageBitmap`、mdast-util-from-markdown 2.0.3、`next/image`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：内容新鲜度与根暂存媒体的确定日期报告 CLI、GitHub Actions 注解与每周一自动复核；
- 路由：严格 YAML + Zod 永久重定向注册表、Next `redirects()` 308、构建期现行路由与静态文件交叉校验；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、线上冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮实现提交：`628fc9f`（版本化永久重定向注册表、构建冲突/目标/单跳门禁、真实 HTTP 与生产冒烟）；
- 自动交付：Quality Gate `30938734018`、Production verification `30938771248` 均成功；GitHub Production deployment `5749330934` 精确对应实现 SHA `628fc9f94f7a035c74a3cc693e1cd3be5b0fc75e` 且状态为 success，稳定生产域名保持公开；
- 最新完成迭代：0033 永久重定向注册表；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

`content/redirects.yml` 现在是 URL 迁移的版本化事实源。构建会把公开内容、集合、专题、标签、运维路由和 `public` 文件交叉成路径清单，拒绝来源遮蔽、目标缺失、草稿/未来目标、保留命名空间、重复、自跳转、链与环路；每条规则还必须有不晚于构建日的 `addedAt` 和明确 `reason`。通过的规则由 Next 原生输出永久 308，查询参数保持透传。首条 `/blog -> /posts` 已在本地真实进程与 Vercel 稳定生产域名验证为同源单跳；完整门禁为 90/90 单元测试、35 个构建页面和 16/16 HTTP 测试，当前生产冒烟仍为 23 routes、OAuth 302。

## 风险与下一步

1. Studio 已在浏览器内完成真实格式/预算预检，但有意不自动缩放或转 WebP；同 slug 下重复文件名仍由 Decap 的确认界面与作者处理，选择前必须区分名称；
2. 首次保存后的 slug 已在 Studio 控件层锁定；真正迁移仍只能通过 Git 同步修改内容文件、正文引用、附件目录和 `content/redirects.yml`。注册表不自动推断迁移且有意只支持精确单跳路径；该控件依赖固定 Decap 3.14.1 bundle 的 `entry/newRecord` 契约，升级时必须重审；
3. 根暂存区已有本地/Actions 库存但有意不自动清理；未跟踪的本地附件不会出现在 GitHub Actions，作者需要在 Obsidian 工作区运行 `npm run media:staging` 后人工确认；
4. Current record 已有每周分级报告，但提醒只存在于本地输出和 GitHub Actions 摘要/注解，不发送外部消息；这是当前有意的无服务边界；
5. Obsidian 块引用是专有语法，当前明确拒绝；双向关系只在详情页按正文链接展示，尚无全站图谱；
6. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
7. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
8. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。

下一轮唯一主任务：建立 Obsidian inbox 发布就绪报告。用只读 CLI 一次扫描全部 `content/inbox/*.md`，逐篇给出内容类型、目标路径、草稿/日期状态、附件派生结果、目标冲突与可发布/阻塞原因；复用真实发布器契约但不得移动附件、改写 Markdown、提交或推送。先服务本地作者工作区，不引入云端 API，也不把未跟踪草稿错误承诺为 CI 可见。
