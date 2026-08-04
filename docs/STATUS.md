# 当前项目状态

> 更新时间：2026-08-04 · 每轮迭代更新 · 本文件位于仓库根 Obsidian Vault 中

## 产品目标

MyBlog 是 Zach424 的个人技术知识库与公开工程日志。它把学习记录、技术判断和项目复盘保存为可检索、可链接、可版本控制的 Markdown；作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，`main` 自动交付到 Vercel。

## 当前结构

| 模块 | 状态 | 当前责任与证据 |
| --- | --- | --- |
| 内容契约 | done | YAML + Zod 校验文章、TIL、项目、标签、专题、日期、URL、内容语境与复核日期 |
| 公开阅读 | done | 首页、文章、项目、专题、标签、搜索、关于、响应式与深色模式 |
| Markdown | done | GFM、代码高亮、H2/H3 目录、阅读时间、相邻文章 |
| 内容发现 | done | SEO、OG、JSON-LD、RSS、Sitemap、robots、本地全文搜索 |
| 网页写作 | done | `/studio`、GitHub OAuth、Decap editorial workflow、PR |
| Obsidian 写作 | done | Vault、模板、桌面发布插件、`--check-only`、`--push` |
| 附件发布 | done | Wiki/Markdown 图片转换、按内容隔离、稳定命名、越界保护、失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟 |
| 恢复能力 | done | Vercel 显式目标回滚、当前版本恢复、再次冒烟 |
| 内容知识网络 | done | Obsidian/Markdown 站内链接转换、构建期完整性校验、文章与项目反向引用账本 |
| 内容新鲜度 | done | Current/Historical 可见语境、复核日期、当前记录 180 天构建门、现行 Demo |
| 媒体优化 | pending | 图片尺寸/体积预算、压缩和响应式派生尚未实现 |

## 设计与技术

- 视觉方向：Commit Trace / Evidence Rail，中文优先、工程档案感、浅深色响应式；
- 运行时：Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- 内容：仓库内 Markdown、YAML、Zod，GitHub 是唯一事实源；
- 阅读：react-markdown、remark-gfm、rehype-slug、rehype-highlight；
- 发布：Decap CMS 3.14.1、GitHub OAuth、Obsidian 自有插件与 Node 发布脚本；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、线上冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮实现提交：`4177647`（内容语境/复核契约、180 天时效门、现行 Vercel 内容校准）；
- 自动交付：Quality Gate `30888792915`、Production smoke `30888826725` 均成功；Vercel Production deployment `5739866714` 精确对应实现 SHA；
- 最新完成迭代：0021 内容新鲜度契约与公开现状校准；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

所有正式内容现在必须声明 `freshness: current | historical` 和 `reviewedAt`。详情页事实栏公开显示 Current record / Historical snapshot 与复核日期；历史文章正文明确说明 Cloudflare/Vinext 是首版记录，MyBlog 项目页新增 2026-08-04 当前状态并把 Live demo 切换到 Vercel。`reviewedAt` 不能早于发布/更新日期或晚于构建日期，公开 Current record 超过 180 天未复核会阻断构建；Historical snapshot 保留证据但不承诺持续更新。

## 风险与下一步

1. 图片仍以原始体积进入 Git，缺少大小/像素预算、压缩建议与响应式派生；
2. 当前维护内容最迟需要在 180 天窗口结束前复核；当前 MyBlog 记录的下一失效边界为 2027-01-31，尚未提供提前提醒；
3. Obsidian 块引用是专有语法，当前明确拒绝；知识网络也尚无全站图谱或正文“引用去向”视图；
4. Studio OAuth origin、GitHub 凭据和 Vercel Hobby 回滚范围仍需按运行手册维护；
5. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
6. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。

下一轮唯一主任务：为 Obsidian/Studio 图片建立体积、像素和格式预检预算，提供明确优化诊断，并把预算纳入发布与构建质量门。
