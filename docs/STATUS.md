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
| Obsidian 写作 | done | Vault、模板、桌面插件 1.9.0、版本化维护台账/Author Proof v3/交付状态与可信回执、候选指纹、deferred 并行草稿、正式内容精确同步和新稿 `--check-only`/`--push` |
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
- 发布：Decap CMS 3.14.1、GitHub OAuth、stable slug 自定义控件、同源媒体清单、内存会话账本、per-input generation 与 SHA-256 冲突确认、官方 preview template、同源只读公式/全字段预检端点、public-only 内容维护快照与严格浏览器契约、内容字段 allowlist、Obsidian 自有插件 1.9.0、版本化维护 deadline ledger/复核 Author Proof v3/本地交付 rail 与 sealed receipt/inbox 只读 Modal、候选 SHA-256 与 Git-clean blob 绑定、待交付提交识别和精确 OID refspec 重送、共享 worktree impact classifier、deferred 路径证据、review-note 领域/Git/交付门、三条纯文本降级、统一子进程生命周期与 Node 发布脚本；
- 媒体：Sharp 0.35.3、浏览器 magic/帧结构解析、`createImageBitmap` 与 Web Crypto、构建期确定性摘要清单、mdast-util-from-markdown 2.0.3、`next/image`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：内容新鲜度、根暂存媒体与正文/结构化端点外链的 CLI；Studio 与 Obsidian 都可显示公开 Current 队列，确定性库存进入本地发布候选，时间/DNS 敏感的外链 HEAD 只显式运行；
- 路由：严格 YAML + Zod 永久重定向注册表、Next `redirects()` 308、构建期现行路由与静态文件交叉校验；
- 知识图：纯函数派生有向节点/边、语义 SVG + HTML 账本、零客户端布局依赖与 320px 明确降级；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、YAML workflow 契约与线上冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮实现提交：`3c1a7bdff540205cfbbe75b8c28f8c2a46ed26ee`（待交付复核精确 OID 重送、后置不变量验证与 Obsidian sealed receipt）；
- 自动交付：本轮实现 Quality Gate `30997586204`（#103）与 Vercel Production 验证 `30997626809`（#96）均 completed/success；
- 最新完成迭代：0058 待交付正式复核安全重送与可信回执；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

MyBlog Publisher 1.9.0 把上一轮只读 pending-review 证据推进为独立执行事务。`content:review:deliver` 在 main 上重新读取同一个精确复核，保存 index/worktree，再以 `git push origin <verified-oid>:refs/heads/main` 执行普通非强制 push；状态漂移、错误分支、服务器拒绝和 unseen remote advance 都失败并保留本地提交。成功后必须证明 local/tracking 同为原 commit 且 HEAD/index/worktree 稳定，才生成 version 1 receipt。Obsidian 严格重算 receipt 后显示 `VERIFIED LOCAL COMMIT ─ SEALED PUSH ─ ORIGIN/MAIN · OBSERVED AFTER PUSH`，不提供重试按钮，也不把 Git 送达冒充 Vercel 上线。最终门为 199/199 单元、45 条构建页面、19/19 生产应用测试与 audit 0；`.next/static` 为 1,819,914 B，插件 main/manifest/styles 合计 78,904 B且不进入公开客户端。

## 风险与下一步

1. Studio 已完成真实格式/预算、生产/会话摘要、快速重选竞态、数学公式作者预览和全字段只读 Author Proof，但有意不自动缩放/转 WebP，也不在第一版阻断保存；跨文章 slug/专题连续性、媒体引用和站内关系仍由完整仓库门验证；
2. 首次保存后的 slug 已在 Studio 控件层锁定；真正迁移仍只能通过 Git 同步修改内容文件、正文引用、附件目录和 `content/redirects.yml`。注册表不自动推断迁移且有意只支持精确单跳路径；该控件依赖固定 Decap 3.14.1 bundle 的 `entry/newRecord` 契约，升级时必须重审；
3. inbox readiness 已覆盖全部本地草稿，但有意不进入 Actions：未跟踪草稿和附件天然不在 CI 检出中；当前真实 inbox 为空，正向/阻塞路径由临时 Git/媒体夹具验证，首次实际多草稿使用时仍应按 Modal 逐项复核；
4. Current record 已有 Studio、Obsidian 与每周 Actions 三个只读视图；Obsidian 1.9.0 已显示严格 Author Proof v3、本地交付状态与精确重送回执，并安全隔离并行 inbox/根新附件。复核目标字节、HEAD、index、tree、重复复核和待交付重送风险已关闭；tracking ref 仍明确只是最后本地观察。真实主题组合与大路径清单仍由 DOM/CSS 契约而非宿主像素验收覆盖；
5. Obsidian 块引用是专有语法，当前明确拒绝；知识地图已公开，但当前 SVG 双列布局为小型内容库优化，内容增长后需要在不牺牲 HTML 语义的前提下增加过滤或分组；
6. 正文与结构化 HTTPS 端点已有统一离线库存和显式健康检查，但 DNS/限流/网络仍只是观察证据；本机直连 Vercel 域名继续出现 timeout 假阴性，因此实时检查不进 Actions；
7. 标题锚点采用严格的实际渲染 id；改名或调整重复标题顺序时必须同步正文深链，Obsidian 块引用和模糊匹配仍明确不支持；
8. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
9. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
10. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。
11. checkout/setup-node v6 的官方 major tag 会移动；当前策略延续既有 major 更新方式并记录本轮 tag 指针，若以后提高供应链固定强度，应单独设计 immutable SHA 与自动更新流程，而不是在功能轮静默切换。

下一轮唯一主任务：把同样的交付可恢复性扩展到“新草稿发布”事务。当前 `content:publish -- --push` 在质量门后创建 `content: publish <slug>`，但 push 失败只保留本地提交和错误文本；应先定义多路径发布提交（正式 Markdown、已跟踪 inbox 删除、归档附件）的精确身份与只读状态，再提供与复核重送隔离的恢复动作。不得把普通 ahead 当作发布提交，不自动 fetch/rebase/reset，不复用复核 receipt 冒充新内容交付，也不引入外部 API。
