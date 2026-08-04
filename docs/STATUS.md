# 当前项目状态

> 更新时间：2026-08-04 · 每轮迭代更新 · 本文件位于仓库根 Obsidian Vault 中

## 产品目标

MyBlog 是 Zach424 的个人技术知识库与公开工程日志。它把学习记录、技术判断和项目复盘保存为可检索、可链接、可版本控制的 Markdown；作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，`main` 自动交付到 Vercel。

## 当前结构

| 模块 | 状态 | 当前责任与证据 |
| --- | --- | --- |
| 内容契约 | done | YAML + Zod 校验文章、TIL、项目、标签、专题、日期、URL、内容语境、复核日期与本地封面替代文本 |
| 公开阅读 | done | 首页、文章、项目、专题、标签、搜索、关于、响应式、深色模式与详情页封面 |
| Markdown | done | GFM、代码高亮、H2/H3 目录、阅读时间、相邻文章 |
| 内容发现 | done | SEO、内容级 OG/Twitter 封面、JSON-LD、RSS、Sitemap、robots、本地全文搜索 |
| 网页写作 | done | `/studio`、GitHub OAuth、Decap editorial workflow、PR |
| Obsidian 写作 | done | Vault、模板、桌面发布插件、`--check-only`、`--push` |
| 附件发布 | done | Wiki/Markdown 图片转换、按内容隔离、稳定命名、越界保护、失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟 |
| 恢复能力 | done | Vercel 显式目标回滚、当前版本恢复、再次冒烟 |
| 内容知识网络 | done | Obsidian/Markdown 站内链接转换、构建期完整性校验、文章与项目双向引用账本 |
| 内容新鲜度 | done | Current/Historical 可见语境、复核日期、当前记录 180 天构建门、现行 Demo |
| 内容维护报告 | done | 本地文本/JSON、60/30 天分级、Actions 摘要与每周自动复核 |
| 媒体门禁 | done | 真实格式解码、3 MiB/2560 px/像素预算、Obsidian 诊断、Studio 限额与构建扫描 |
| 媒体引用完整性 | done | Markdown AST 图片抽取、精确路径存在性、slug 所有权与已归档孤儿附件门禁 |
| 媒体展示 | partial | 封面已读取固有尺寸并由 `next/image` 响应式输出；Markdown 正文图片仍待同等处理 |

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
- 本轮实现提交：`13164f7`（封面契约、固有尺寸、详情组件、分享元数据、Obsidian 归档与测试）；
- 自动交付：Quality Gate `30923477705`、Production smoke `30923525707` 均成功；Vercel Production `dpl_CFPV5qHnEQJsWEy798eU6xqsYKe4` 为 Ready，精确克隆 `13164f7`，不可变 URL 为 `https://blog-o7yo3phzh-czq1.vercel.app`；
- 最新完成迭代：0027 响应式详情页封面；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

文章与项目现在共享服务端 `ContentCover`：`lib/content/cover.ts` 只从 `public/uploads` 读取已验证文件的真实宽高，`next/image` 据此输出有固有比例的响应式 `srcset`，没有 cover 的内容不增加任何占位。`cover` 收紧为仓库内 `/uploads/...`，设置时必须同时提供 `coverAlt`；Studio 与三份 Obsidian 模板都暴露该字段。Obsidian 发布器会把 frontmatter 封面和正文附件放入同一个压缩、同 slug 归档、失败回滚事务。内容级封面同时进入 Open Graph、Twitter 和 JSON-LD。MyBlog 项目使用 1672×941、129054 字节的 WebP 工程档案封面作为首个真实样本。

## 风险与下一步

1. 封面已经形成从发布到渲染/分享的闭环，但 Markdown 正文图片仍由默认 `<img>` 渲染，没有构建期固有尺寸、`next/image` 候选或统一外图边界；
2. Current record 已有每周分级报告，但提醒只存在于本地输出和 GitHub Actions 摘要/注解，不发送外部消息；这是当前有意的无服务边界；
3. Obsidian 块引用是专有语法，当前明确拒绝；双向关系只在详情页按正文链接展示，尚无全站图谱；
4. Studio OAuth origin、GitHub 凭据和 Vercel Hobby 回滚范围仍需按运行手册维护；
5. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
6. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。

下一轮唯一主任务：把已验证的本地 Markdown 正文图片接入与封面相同的尺寸/响应式链路。渲染前按正文 URL 找到仓库图片，输出带固有宽高、正确 `sizes` 和现有 alt 的 `next/image`，保持外部 HTTPS 图片的明确降级边界，并补齐多图、引用式图片、320px 与生产 HTML 测试。
