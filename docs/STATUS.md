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
| 网页写作 | done | `/studio`、GitHub OAuth、Decap editorial workflow、PR、按内容 slug 归档媒体 |
| Obsidian 写作 | done | Vault、模板、桌面发布插件、`--check-only`、`--push` |
| 附件发布 | done | Wiki/Markdown 图片转换、按内容隔离、稳定命名、越界保护、失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟 |
| 恢复能力 | done | Vercel 显式目标回滚、当前版本恢复、再次冒烟 |
| 内容知识网络 | done | Obsidian/Markdown 站内链接转换、构建期完整性校验、文章与项目双向引用账本 |
| 内容新鲜度 | done | Current/Historical 可见语境、复核日期、当前记录 180 天构建门、现行 Demo |
| 内容维护报告 | done | 本地文本/JSON、60/30 天分级、Actions 摘要与每周自动复核 |
| 媒体门禁 | done | 真实格式解码、3 MiB/2560 px/像素预算、Obsidian 诊断、Studio 限额与构建扫描 |
| 媒体引用完整性 | done | Markdown AST 图片抽取、精确路径存在性、根暂存拒绝、slug 所有权与已归档孤儿附件门禁 |
| 媒体展示 | done | 封面与本地 Markdown 正文图共享固有尺寸/`next/image` 链路；HTTPS 外图有明确降级边界 |

## 设计与技术

- 视觉方向：Commit Trace / Evidence Rail，中文优先、工程档案感、浅深色响应式；
- 运行时：Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- 内容：仓库内 Markdown、YAML、Zod，GitHub 是唯一事实源；
- 阅读：react-markdown、remark-gfm、rehype-slug、rehype-highlight；
- 发布：Decap CMS 3.14.1、GitHub OAuth、Obsidian 自有插件与 Node 发布脚本；
- 媒体：Sharp 0.35.3、mdast-util-from-markdown 2.0.3、`next/image`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：确定日期报告 CLI、GitHub Actions 注解与每周一自动状态复核；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、线上冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮实现提交：`7682346`（Studio per-slug 媒体目录、正式根暂存拒绝、作者提示与测试）；
- 自动交付：Quality Gate `30929720702`、Production verification `30929766554` 均成功；GitHub Production deployment `5747675572` 对应实现 SHA 且状态为 success，目标 URL `https://blog-aqyeokyth-czq1.vercel.app` 受 Vercel 登录保护，稳定生产域名保持公开；
- 最新完成迭代：0029 Studio 按 slug 归档媒体；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

Studio 的 posts/projects 集合现在分别把 `media_folder` 与 `public_folder` 覆盖为基于 `{{fields.slug}}` 的绝对模板。作者先填写稳定 slug 后，cover 与 Markdown 正文图会直接写入 `public/uploads/<slug>/`，内容引用同步为 `/uploads/<slug>/...`；全局根目录仍为 Obsidian inbox 与媒体库暂存区。构建关系门同时收紧：正式 post/project 无论公开、草稿或未来日期，都不能引用根暂存图片；错误会指出目标 slug 目录与 Studio/Obsidian 修复方式。现有两条正式图片引用已合规，无需迁移。线上配置为 200、`no-store`、`noindex`，两个集合各有完整覆盖，稳定域名 23 路由冒烟通过。

## 风险与下一步

1. Studio 已直接归档正式媒体，但浏览器入口仍不自动缩放/转 WebP；同 slug 下重复文件名由 Decap/作者处理，选择前必须区分名称；
2. 动态媒体目录依赖先填写 slug；首次保存后修改 slug 会导致内容文件、URL 与附件目录分叉，因此继续明确禁止；根暂存区不会自动清理，长期使用需定期人工审计；
3. Current record 已有每周分级报告，但提醒只存在于本地输出和 GitHub Actions 摘要/注解，不发送外部消息；这是当前有意的无服务边界；
4. Obsidian 块引用是专有语法，当前明确拒绝；双向关系只在详情页按正文链接展示，尚无全站图谱；
5. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
6. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
7. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。

下一轮唯一主任务：为 Studio 媒体建立上传前质量反馈。优先验证在不分叉内容事实源、不引入外部媒体服务的前提下，能否在选择阶段读取真实格式、尺寸与体积，给出可理解诊断，并对静态 PNG/JPEG/WebP 安全复用现有 WebP 优化契约；若 Decap 3.14.1 的扩展边界不适合自动变换，则先实现可靠预检与作者修复路径。
