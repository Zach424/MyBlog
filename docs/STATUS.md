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
| Inbox 发布就绪 | done | 全草稿 ready/scheduled/blocked、真实媒体候选、目标/共享附件诊断、CLI 与 Obsidian 只读弹窗 |
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
- 发布：Decap CMS 3.14.1、GitHub OAuth、stable slug 自定义控件、Obsidian 自有插件 1.1.0、inbox readiness CLI 与 Node 发布脚本；
- 媒体：Sharp 0.35.3、浏览器 magic/帧结构解析与 `createImageBitmap`、mdast-util-from-markdown 2.0.3、`next/image`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：内容新鲜度与根暂存媒体的确定日期报告 CLI、GitHub Actions 注解与每周一自动复核；
- 路由：严格 YAML + Zod 永久重定向注册表、Next `redirects()` 308、构建期现行路由与静态文件交叉校验；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、线上冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮实现提交：`2f4eae9`（Obsidian inbox readiness 聚合、真实媒体候选、只读 CLI/Modal 与冲突诊断）；
- 自动交付：Quality Gate `30940715456`、Production verification `30940756901` 均成功；GitHub Production deployment `5749705914` 精确对应实现 SHA `2f4eae92f8912c3147d19b0cb40e6ba0856622a4` 且状态为 success，稳定生产域名保持公开；
- 最新完成迭代：0034 Obsidian inbox 发布就绪报告；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

`npm run content:inbox` 现在会一次读取全部 Obsidian inbox Markdown，并逐篇隔离为 `ready`、`scheduled` 或 `blocked`。它复用真实发布器的类型、slug、frontmatter、站内链接和附件目标转换，在系统临时目录真实生成媒体候选，再检查正式内容目标、附件目标、Git 跟踪状态和跨草稿共享源；一个坏草稿不会抹掉其他草稿证据。文本/JSON 可直接使用，Obsidian Publisher 1.1.0 新增“查看全部草稿发布就绪状态”，以纯文本 Modal 展示同一报告。所有临时文件在成功/失败路径删除，报告不移动、改写、提交或推送作者文件；`ready` 只代表单篇事务就绪，正式发布仍跑完整质量门。当前真实 inbox 为 0，完整门禁为 95/95 单元测试、35 个构建页面和 16/16 HTTP 测试，稳定域名 23 路由、OAuth 302。

## 风险与下一步

1. Studio 已在浏览器内完成真实格式/预算预检，但有意不自动缩放或转 WebP；同 slug 下重复文件名仍由 Decap 的确认界面与作者处理，选择前必须区分名称；
2. 首次保存后的 slug 已在 Studio 控件层锁定；真正迁移仍只能通过 Git 同步修改内容文件、正文引用、附件目录和 `content/redirects.yml`。注册表不自动推断迁移且有意只支持精确单跳路径；该控件依赖固定 Decap 3.14.1 bundle 的 `entry/newRecord` 契约，升级时必须重审；
3. inbox readiness 已覆盖全部本地草稿，但有意不进入 Actions：未跟踪草稿和附件天然不在 CI 检出中；当前真实 inbox 为空，正向/阻塞路径由临时 Git/媒体夹具验证，首次实际多草稿使用时仍应按 Modal 逐项复核；
4. Current record 已有每周分级报告，但提醒只存在于本地输出和 GitHub Actions 摘要/注解，不发送外部消息；这是当前有意的无服务边界；
5. Obsidian 块引用是专有语法，当前明确拒绝；双向关系只在详情页按正文链接展示，尚无公开全站知识地图；
6. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
7. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
8. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。

下一轮唯一主任务：建立公开、可访问的全站知识地图。复用现有公开内容与 `outgoing/backlinks` 派生关系，在 `/knowledge` 服务端输出文章/项目节点、方向明确的链接边和无 JavaScript 也可阅读的关系清单；加入主导航、SEO/Sitemap、响应式与深色设计、空/孤立节点语义和真实 HTTP/内部链接测试。不得另存图数据、引入数据库或第三方图服务，正文 Markdown 链接继续是唯一事实源。
