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
| 媒体门禁 | done | 真实格式解码、3 MiB/2560 px/像素与动图预算、Studio 上传前诊断、Obsidian 优化与构建扫描 |
| 媒体引用完整性 | done | Markdown AST 图片抽取、精确路径存在性、根暂存拒绝、slug 所有权与已归档孤儿附件门禁 |
| 媒体展示 | done | 封面与本地 Markdown 正文图共享固有尺寸/`next/image` 链路；HTTPS 外图有明确降级边界 |

## 设计与技术

- 视觉方向：Commit Trace / Evidence Rail，中文优先、工程档案感、浅深色响应式；
- 运行时：Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- 内容：仓库内 Markdown、YAML、Zod，GitHub 是唯一事实源；
- 阅读：react-markdown、remark-gfm、rehype-slug、rehype-highlight；
- 发布：Decap CMS 3.14.1、GitHub OAuth、Obsidian 自有插件与 Node 发布脚本；
- 媒体：Sharp 0.35.3、浏览器 magic/帧结构解析与 `createImageBitmap`、mdast-util-from-markdown 2.0.3、`next/image`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：确定日期报告 CLI、GitHub Actions 注解与每周一自动状态复核；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、线上冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮实现提交：`e23cfdf`（Studio 媒体上传前真实格式/预算预检、Evidence Rail、显式资源路由与测试）；
- 自动交付：Quality Gate `30932928894`、Production verification `30932976003` 均成功；GitHub Production deployment `5748268012` 精确对应实现 SHA `e23cfdfa94f42d9149fcb4936661d324e95fe2d9` 且状态为 success，稳定生产域名保持公开；
- 最新完成迭代：0030 Studio 媒体上传前预检；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

Studio 现在会在 Decap 接收本地图片前读取真实 magic bytes、PNG/GIF/WebP 动画结构，并通过浏览器解码获得宽高。扩展名伪装、损坏文件、超过 3 MiB/2560 px/800 万单帧像素或 8000 万动图总像素的选择会被清空；通过时右下 Evidence Rail 显示格式、尺寸、帧数和体积，再把同一个原始 `File` 交回 Decap，因而原有 editorial workflow、Git 草稿、按 slug 归档、重名确认和回滚链路不变。动画 AVIF 因浏览器无法可靠计帧而 fail closed；JPEG/PNG 需要自动转 WebP 时继续使用 Obsidian。线上 `/studio/media-preflight.mjs` 为 200、JavaScript、`no-store`、`noindex`，稳定域名 23 路由冒烟通过。

## 风险与下一步

1. Studio 已在浏览器内完成真实格式/预算预检，但有意不自动缩放或转 WebP；同 slug 下重复文件名仍由 Decap 的确认界面与作者处理，选择前必须区分名称；
2. 动态媒体目录依赖先填写 slug；首次保存后修改 slug 会导致内容文件、URL 与附件目录分叉，目前仍靠作者提示和构建门禁止，尚未在编辑器控件层锁定；根暂存区不会自动清理，长期使用需定期人工审计；
3. Current record 已有每周分级报告，但提醒只存在于本地输出和 GitHub Actions 摘要/注解，不发送外部消息；这是当前有意的无服务边界；
4. Obsidian 块引用是专有语法，当前明确拒绝；双向关系只在详情页按正文链接展示，尚无全站图谱；
5. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
6. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
7. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。

下一轮唯一主任务：收紧 Studio 的 slug 生命周期。优先验证 Decap 3.14.1 的自定义控件和 entry 状态能否在条目首次获得稳定文件路径后把 slug 变为只读，同时保留新建、复制、editorial workflow 与历史条目编辑；不得依赖易碎的生成类名或分叉内容事实源。若编辑器无法安全锁定，则先交付明确的变更检测、迁移诊断和回归门，避免内容 URL 与 `public/uploads/<slug>/` 所有权静默分叉。
