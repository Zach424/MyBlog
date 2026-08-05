# 当前项目状态

> 更新时间：2026-08-05 · 每轮迭代更新 · 本文件位于仓库根 Obsidian Vault 中

## 产品目标

MyBlog 是 Zach424 的个人技术知识库与公开工程日志。它把学习记录、技术判断和项目复盘保存为可检索、可链接、可版本控制的 Markdown；作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，`main` 自动交付到 Vercel。

## 当前结构

| 模块 | 状态 | 当前责任与证据 |
| --- | --- | --- |
| 内容契约 | done | YAML + Zod 校验文章、TIL、项目、标签、专题、日期、URL、内容语境、复核日期与本地封面替代文本 |
| 公开阅读 | done | 首页、文章、项目、专题、标签、搜索、关于、响应式、深色模式与详情页封面 |
| Markdown | done | GFM、代码高亮、语言标签、渐进增强的一键复制、与实际渲染一致的 H1–H6 heading id、H2/H3 目录与原生永久链接、Obsidian 兼容脚注/尾注与行内/块级数学公式、A4 打印/PDF 版式、阅读时间、相邻文章与响应式正文图片 |
| 内容发现 | done | SEO、内容级 OG/Twitter 封面、JSON-LD、RSS、Sitemap、robots、本地全文搜索 |
| 网页写作 | done | `/studio`、GitHub OAuth、Decap workflow、PR、按 slug 归档媒体、稳定 slug 锁定、双层 SHA-256 冲突预检、快速重选 latest-wins、生产规则公式预览与全字段只读发布清单 |
| Obsidian 写作 | done | Vault、模板、桌面插件 1.6.0、版本化维护台账与 Author Proof v2、deferred 并行草稿、正式内容精确同步和新稿 `--check-only`/`--push` |
| Inbox 发布就绪 | done | 全草稿 ready/scheduled/blocked、真实媒体候选、目标/共享附件诊断、CLI 与 Obsidian 只读弹窗 |
| 附件发布 | done | Wiki/Markdown 图片转换、按内容隔离、稳定命名、越界保护、失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟；checkout/setup-node v6 Node 24 action runtime，应用 Node 22 与 workflow 语义有结构测试 |
| 恢复能力 | done | Vercel 显式目标回滚、当前版本恢复、再次冒烟 |
| 内容知识网络 | done | GFM 行内/引用式/自引用链接、页面与标题锚点构建门、文章与项目双向引用账本 |
| 公开知识地图 | done | `/knowledge` 服务端 SVG 信号场、HTML 关系账本、孤立记录、主导航与 Sitemap，Markdown 链接为唯一事实源 |
| 永久链接迁移 | done | Git 版本化 redirect 注册表、当前路由/静态文件冲突门、公开目标校验、单跳 308 与生产冒烟 |
| 内容新鲜度 | done | Current/Historical 可见语境、复核日期、当前记录 180 天构建门、现行 Demo |
| 内容维护报告 | done | 本地文本/JSON、60/30 天分级、Actions 摘要与每周自动复核 |
| Studio 复核队列 | done | `/studio/maintenance`、动态报告日、Review Horizon、四级优先级、稳定编辑/公开入口与可恢复只读失败态 |
| 外部链接库存 | done | 公开正文与 canonical/repository/demo 的统一 HTTPS 来源/次数离线报告，显式公网 HEAD 检查与非硬门状态分类 |
| 根暂存媒体审计 | done | inbox 引用账本、Git/文件系统年龄证据、共享/未引用/陈旧/缺失报告与 Actions warning，零自动删除 |
| 媒体门禁 | done | 真实格式解码、3 MiB/2560 px/像素与动图预算、Studio 上传前诊断、Obsidian 优化与构建扫描 |
| 媒体引用完整性 | done | Markdown AST 图片抽取、精确路径存在性、根暂存拒绝、slug 所有权与已归档孤儿附件门禁 |
| 媒体展示 | done | 封面与本地 Markdown 正文图共享固有尺寸/`next/image` 链路；HTTPS 外图有明确降级边界 |

## 设计与技术

- 视觉方向：Commit Trace / Evidence Rail，中文优先、工程档案感、浅深色响应式；
- 运行时：Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- 内容：仓库内 Markdown、YAML、Zod，GitHub 是唯一事实源；
- 阅读：react-markdown、remark-gfm、remark-math、rehype-slug、rehype-highlight、rehype-katex 与 KaTeX；服务端 Markdown、中文脚注语义与回链、HTML + MathML 数学公式、MarkdownHeading 永久链接与 PrintSource 可信来源，最小 CodeBlock 客户端岛、Clipboard API 与 aria-live；GFM + math 共享 mdast 继续复现标题、链接、媒体和搜索语义，生产阅读与 Studio 共享 remark/rehype/KaTeX/安全 URL 规则，构建期公式使用 `trust: false`/严格资源上限；A4 `@page` 与 scoped print CSS 只重排既有语义 DOM；
- 发布：Decap CMS 3.14.1、GitHub OAuth、stable slug 自定义控件、同源媒体清单、内存会话账本、per-input generation 与 SHA-256 冲突确认、官方 preview template、同源只读公式/全字段预检端点、public-only 内容维护快照与严格浏览器契约、内容字段 allowlist、Obsidian 自有插件 1.6.0、版本化维护 deadline ledger/复核 Author Proof v2/inbox 只读 Modal、共享 worktree impact classifier、deferred 路径证据、review-note 领域/Git 双门、两条纯文本降级、统一子进程生命周期与 Node 发布脚本；
- 媒体：Sharp 0.35.3、浏览器 magic/帧结构解析、`createImageBitmap` 与 Web Crypto、构建期确定性摘要清单、mdast-util-from-markdown 2.0.3、`next/image`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：内容新鲜度、根暂存媒体与正文/结构化端点外链的 CLI；Studio 与 Obsidian 都可显示公开 Current 队列，确定性库存进入本地发布候选，时间/DNS 敏感的外链 HEAD 只显式运行；
- 路由：严格 YAML + Zod 永久重定向注册表、Next `redirects()` 308、构建期现行路由与静态文件交叉校验；
- 知识图：纯函数派生有向节点/边、语义 SVG + HTML 账本、零客户端布局依赖与 320px 明确降级；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、YAML workflow 契约与线上冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮实现提交：`54c69b64a64b7567319fde61dd863519375ac78b`（共享 worktree impact classifier、Proof v2、deferred 证据与严格状态边界）；
- 自动交付：本轮实现 Quality Gate `30990818494`（#97）与 Vercel Production 验证 `30990859525`（#90）均 completed/success；
- 最新完成迭代：0055 正式复核并行作者工作隔离；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

MyBlog Publisher 1.6.0 允许正式复核与安全的并行作者工作共存。共享 classifier 只把已修改/未跟踪的稳定 `content/inbox/<slug>.md` 和未跟踪的根图片判为 deferred；已跟踪根附件、嵌套媒体、正式内容、代码、未知路径以及任何 staged（含 intent-to-add）均阻断。完整 `npm run check` 前后各重算一次。Proof 升为 v2，git 段新增确定排序的 `deferredPaths`；生成器从 changed/staged/untracked 重新分类，插件再验证 changed 差集与 untracked 并集必须精确等于 deferred，Modal 用 `DEFERRED / NOT IN COMMIT` 路径清单展示 `MODIFIED`/`UNTRACKED`。真实临时仓库与裸远端证明 push 只提交目标且保留三种并行工作。最终门为 182/182 单元、45 条构建页面、19/19 生产应用测试与 audit 0；`.next/static` 为 1,818,709 B，插件 main/manifest/styles 合计 48,469 B且不进入公开客户端。

## 风险与下一步

1. Studio 已完成真实格式/预算、生产/会话摘要、快速重选竞态、数学公式作者预览和全字段只读 Author Proof，但有意不自动缩放/转 WebP，也不在第一版阻断保存；跨文章 slug/专题连续性、媒体引用和站内关系仍由完整仓库门验证；
2. 首次保存后的 slug 已在 Studio 控件层锁定；真正迁移仍只能通过 Git 同步修改内容文件、正文引用、附件目录和 `content/redirects.yml`。注册表不自动推断迁移且有意只支持精确单跳路径；该控件依赖固定 Decap 3.14.1 bundle 的 `entry/newRecord` 契约，升级时必须重审；
3. inbox readiness 已覆盖全部本地草稿，但有意不进入 Actions：未跟踪草稿和附件天然不在 CI 检出中；当前真实 inbox 为空，正向/阻塞路径由临时 Git/媒体夹具验证，首次实际多草稿使用时仍应按 Modal 逐项复核；
4. Current record 已有 Studio、Obsidian 与每周 Actions 三个只读视图；Obsidian 1.6.0 已显示严格 Author Proof v2，并安全隔离并行 inbox/根新附件。同日仍不能重复声明复核，push 失败会保留合法本地提交；当前门前 inspection 尚未用内容摘要绑定门后目标、index 和提交 tree，长检查期间再次编辑同一正式笔记仍是下一轮要关闭的 TOCTOU 风险。真实主题组合与大路径清单仍由 DOM/CSS 契约而非宿主像素验收覆盖；
5. Obsidian 块引用是专有语法，当前明确拒绝；知识地图已公开，但当前 SVG 双列布局为小型内容库优化，内容增长后需要在不牺牲 HTML 语义的前提下增加过滤或分组；
6. 正文与结构化 HTTPS 端点已有统一离线库存和显式健康检查，但 DNS/限流/网络仍只是观察证据；本机直连 Vercel 域名继续出现 timeout 假阴性，因此实时检查不进 Actions；
7. 标题锚点采用严格的实际渲染 id；改名或调整重复标题顺序时必须同步正文深链，Obsidian 块引用和模糊匹配仍明确不支持；
8. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
9. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
10. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。
11. checkout/setup-node v6 的官方 major tag 会移动；当前策略延续既有 major 更新方式并记录本轮 tag 指针，若以后提高供应链固定强度，应单独设计 immutable SHA 与自动更新流程，而不是在功能轮静默切换。

下一轮唯一主任务：把正式复核绑定到确切候选内容。门前对目标原始字节计算 SHA-256；完整门后必须保持相同，push 暂存后 index blob、commit 后 tree blob 也必须对应同一摘要。Proof 升版并显示可人工比对的短指纹，插件严格验证 64 位摘要与显示值；长检查期间再次编辑目标要 fail closed，取消暂存且不提交。deferred classifier、单文件 `commit --only`、纯文本降级和零外部服务保持不变。
