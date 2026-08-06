# 当前项目状态

> 更新时间：2026-08-06 · 每轮迭代更新 · 本文件位于仓库根 Obsidian Vault 中

## 产品目标

MyBlog 是 Zach424 的个人技术知识库与公开工程日志。它把学习记录、技术判断和项目复盘保存为可检索、可链接、可版本控制的 Markdown；作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，`main` 自动交付到 Vercel。

## 当前结构

| 模块 | 状态 | 当前责任与证据 |
| --- | --- | --- |
| 内容契约 | done | YAML + Zod 校验文章、TIL、项目、标签、专题、日期、URL、内容语境、复核日期与本地封面替代文本 |
| 公开阅读 | done | 首页、文章、项目、专题、标签、搜索、关于、响应式、深色模式与详情页封面 |
| 读者分享 | done | 文章/项目服务端规范链接、Web Share、URL/Markdown 引用 Clipboard、全 ASCII 标点转义、取消静默、共享 single-flight、`aria-live` 回执、无 JavaScript 恢复路径与 print 隔离 |
| Markdown | done | GFM、代码高亮、语言标签、渐进增强的一键复制、与实际渲染一致的 H1–H6 heading id、H2/H3 目录与原生永久链接、Obsidian 兼容脚注/尾注与行内/块级数学公式、A4 打印/PDF 版式、阅读时间、相邻文章与响应式正文图片 |
| 内容发现 | done | SEO、内容级 OG/Twitter 封面、JSON-LD、RSS、Sitemap、robots、本地全文搜索 |
| 网页写作 | done | `/studio`、GitHub OAuth、Decap workflow、PR、按 slug 归档媒体、稳定 slug 锁定、双层 SHA-256 冲突预检、快速重选 latest-wins、生产规则公式预览与全字段只读发布清单 |
| Obsidian 写作 | done | Vault、三类受信模板、桌面插件 1.34.0、文件名唯一草稿身份、本地原子新建/安全改名/旧身份取证与严格清理、source-scoped 当前草稿作者意图、原始来源字节 SHA-256 摘要/导航双重绑定、作者意图与身份读取各自独立的 latest-wins generation/卸载失效、作者意图旧活动进程的专属 scope 接管与跨平台终止、媒体 COVER/BODY 来源/逐次替代文本/作者或文件名回退取证/精确变换、ALT 与 LINK occurrence 精确源码行导航、四个新发布/复核事务的 single-flight lease、阶段/输出活动脉冲、会话内最近终态回执与自动 doctor 联锁、13 项本机前置电路、统一只读 Git 交付分诊、版本化维护台账/Author Proof v3、两类安全重送/可信回执、deferred 并行草稿和新稿 `--check-only`/`--push` |
| Inbox 发布就绪 | done | version 6/read-only 全草稿 ready/scheduled/blocked、每个可读来源的原始字节 SHA-256、Article/TIL/Project、精确站内目标/源码行/重复次数、媒体 COVER/BODY 用途/出现次数/源码行/最终替代文本及来源、空文本与文件名回退阻塞、真实媒体候选、目标/共享附件诊断、CLI 全库或 `--source` 聚焦 JSON 与 Obsidian 当前草稿原生摘要 |
| 附件发布 | done | Wiki/Markdown 图片转换、按内容隔离、稳定命名、越界保护、失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟；checkout/setup-node v6 Node 24 action runtime 的六处引用固定到官方完整 SHA，应用 Node 22 与 workflow 语义由共享结构/发布门禁保护 |
| HTML 传输预算 | done | 九条关键路由的稳定生产 raw/Node gzip 基线、160 KiB 紧急上限、20%/2 KiB gzip 余量公式、本地稳定 host 与部署后实际 origin 双验证、逐路由余量报告与覆盖失败关闭 |
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
- 阅读：react-markdown、remark-gfm、remark-math、rehype-slug、rehype-highlight、rehype-katex 与 KaTeX；服务端 Markdown、中文脚注语义与回链、HTML + MathML 数学公式、MarkdownHeading 永久链接与 PrintSource 可信来源，最小 CodeBlock/ShareTrace 客户端岛、Web Share/Clipboard API、CommonMark 全 ASCII 标点引用转义、共享 single-flight 与 aria-live；GFM + math 共享 mdast 继续复现标题、链接、媒体和搜索语义，生产阅读与 Studio 共享 remark/rehype/KaTeX/安全 URL 规则，构建期公式使用 `trust: false`/严格资源上限；A4 `@page` 与 scoped print CSS 只重排既有语义 DOM；
- 发布：Decap CMS 3.14.1、GitHub OAuth、stable slug 自定义控件、同源媒体清单、内存会话账本、per-input generation 与 SHA-256 冲突确认、官方 preview template、同源只读公式/全字段预检端点、public-only 内容维护快照与严格浏览器契约、内容字段 allowlist、Obsidian 自有插件 1.34.0、Article/TIL/Project 受信模板、文件名唯一草稿身份、Vault 原子创建/旧身份清理与 FileManager 安全改名、身份读取独立 latest-wins/unload owner、version 6 inbox evidence、原始来源字节 `sourceSha256`、`--source` 聚焦模式与 `DRAFT → PUBLIC`/`MEDIA TRACE`/`LINK TRACE` 当前草稿摘要、摘要打开和 ALT/REF 导航前的全文摘要复核、当前草稿意图命令/报告/异步读取的 latest-wins generation、卸载失效和专属进程 scope 接管、媒体用途/次数/行号/替代文本/来源账本与精确行导航、空文本与文件名回退 blocker 双向核对、四事务 single-flight lease/active 阶段与 stdout/stderr 活动快照/会话内最近终态回执/自动 author-doctor interlock/version 1 的 13 项 preflight circuit、单快照 Git 交付 switchyard、版本化维护 deadline ledger/复核 Author Proof v3/两类本地交付 rail 与 sealed receipt/发布 Commit Envelope/inbox 只读 Modal、候选 SHA-256 与 Git-clean blob 绑定、两类待交付提交识别和独立安全重送、精确 OID refspec、防重复发布、manifest 稳定性、共享 worktree impact classifier、deferred 路径证据、review-note/publish-note 领域与 Git 交付门、六条纯文本降级、统一子进程生命周期与 Node 发布脚本；
- 媒体：Sharp 0.35.3、浏览器 magic/帧结构解析、`createImageBitmap` 与 Web Crypto、构建期确定性摘要清单、mdast-util-from-markdown 2.0.3、`next/image`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：内容新鲜度、根暂存媒体与正文/结构化端点外链的 CLI；Studio 与 Obsidian 都可显示公开 Current 队列，确定性库存进入本地发布候选，时间/DNS 敏感的外链 HEAD 只显式运行；
- 路由：严格 YAML + Zod 永久重定向注册表、Next `redirects()` 308、构建期现行路由与静态文件交叉校验；
- 知识图：纯函数派生有向节点/边、语义 SVG + HTML 账本、零客户端布局依赖与 320px 明确降级；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、YAML workflow 契约、官方 action 完整 SHA 共享门禁、`Buffer.byteLength`/Node zlib raw-gzip 双层预算与线上实际 origin 冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮实现提交：`ab5e088e8a6398947daf60f6f63c2d9bb5d88d1a`（可解释的 raw/gzip HTML 双层预算）；
- 自动交付：实现提交已推送；[Quality Gate #158](https://github.com/Zach424/MyBlog/actions/runs/31089835689) 与 [Verify Vercel production #151](https://github.com/Zach424/MyBlog/actions/runs/31089875181) 均成功，归档提交继续按同一链路独立验证；
- 最新完成迭代：0087 可解释的 HTML 双层预算；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

旧的统一 raw HTML `<100,000` 门已升级为共享双层模型：九条关键路由保留带日期、来源提交和稳定 origin 的生产 raw/Node gzip 基线；raw 只由 160 KiB 紧急上限保护，gzip 上限由基线加 `max(20%, 2 KiB)` 后向上取整到 1 KiB。本地生产测试使用稳定 Vercel host，部署后冒烟再测实际输入 origin；每条报告包含实测、阈值、基线和正负余量，漏测、重复、意外路由和超限都失败关闭。失败优先 0/1，最终预算/部署定向 9/9、完整 398/398、45 页、19/19 与生产审计 0。稳定生产 24 路由/OAuth 302；最大项目页 raw `100,493/163,840`、gzip `23,385/28,672`，余量 `63,347` 与 `5,287` 字节。

## 风险与下一步

1. Studio 已完成真实格式/预算、生产/会话摘要、快速重选竞态、数学公式作者预览和全字段只读 Author Proof，但有意不自动缩放/转 WebP，也不在第一版阻断保存；跨文章 slug/专题连续性、媒体引用和站内关系仍由完整仓库门验证；
2. 首次保存后的 slug 已在 Studio 控件层锁定；真正迁移仍只能通过 Git 同步修改内容文件、正文引用、附件目录和 `content/redirects.yml`。注册表不自动推断迁移且有意只支持精确单跳路径；该控件依赖固定 Decap 3.14.1 bundle 的 `entry/newRecord` 契约，升级时必须重审；
3. inbox readiness 已覆盖全部本地草稿，但有意不进入 Actions：未跟踪草稿和附件天然不在 CI 检出中；当前真实 inbox 为空，正向/阻塞路径由临时 Git/媒体夹具验证，首次实际多草稿使用时仍应按 Modal 逐项复核；
4. Current record 已有 Studio、Obsidian 与每周 Actions 三个只读视图；Obsidian 1.34.0 已闭合本地草稿创建、旧身份取证/严格清理、文件名改名、source-scoped 当前草稿作者意图、媒体用途/逐次 alt/来源/变换、ALT/LINK occurrence 源码行导航、两阶段来源 SHA-256 绑定、作者意图和身份读取各自独立的 latest-wins/unload 生命周期，以及旧作者意图活动进程的专属 scope 回收，并继续保留四事务 owner-checked lease、活动脉冲、会话内终态回执、Author Proof v3、统一 Git 交付 switchyard、两类独立交付状态、精确重送与可信回执。作者意图页已有 DOM/CSS、键盘焦点、跨 ALT/REF 的重复点击单航班、ready/scheduled/blocked、媒体与链接证据，以及 stale success/failure/error、路径、`TFile`、摘要、异步读取、卸载、磁盘/Editor 行界、视图、打开失败、POSIX/Windows 终止、fallback、相邻命令隔离和 replacement 启动失败测试；身份读取也覆盖旧成功/失败、当前失败、活动文件漂移、卸载和清理 lease 独立性，但没有真实 Obsidian 宿主像素/交互快照。摘要只是本地新鲜度证据而非签名；已进入 Vault read 的旧 Promise 无法取消但会静默失效。聚焦模式轻量解析全部草稿并读取全部已发布内容作为链接目标，是保留共享附件和正式链接正确性的明确成本；带注释、引号、anchor/tag、缩进、重复键或不匹配值的旧 slug 故意保持只读；
5. Obsidian 块引用是专有语法，当前明确拒绝；知识地图已公开，但当前 SVG 双列布局为小型内容库优化，内容增长后需要在不牺牲 HTML 语义的前提下增加过滤或分组；
6. 正文与结构化 HTTPS 端点已有统一离线库存和显式健康检查，但 DNS/限流/网络仍只是观察证据；本机直连 Vercel 域名继续出现 timeout 假阴性，因此实时检查不进 Actions；
7. 标题锚点采用严格的实际渲染 id；改名或调整重复标题顺序时必须同步正文深链，Obsidian 块引用和模糊匹配仍明确不支持；
8. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
9. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
10. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。
11. checkout/setup-node v6 的六处移动 tag 风险已关闭：执行 ref 全部固定到从官方仓库核对的完整 SHA，测试与发布前检查共享唯一事实源。不可变 pin 不会自动接收上游修复，自动更新机器人继续暂缓；后续必须主动核对官方 refs，不能把 `# v6` 注释当作执行引用。
12. 替代主机 raw 100KB 假绿已由双层预算关闭。Node gzip 是确定性传输模拟，不包含 Vercel CDN Brotli、响应头、TLS 或真实用户 Web Vitals；稳定域名变化时必须同步更新 origin 与带来源的生产基线，基线增长也必须经过产品价值复核，不能为单路由临时抬线。

下一轮唯一主任务：实现 JSON Feed 1.1 的 `/feed.json` 与根页面发现链接。复用现有公开内容索引、请求时 origin、稳定排序与 Markdown 纯文本管线，提供规范 feed/item URL、摘要、`content_text`、发布/修改日期和 tags；响应使用 `application/feed+json` 与现有发现端点缓存语义。先写格式、转义、排序、日期、公开过滤、响应头、metadata 和生产冒烟失败测试，再让现有九路 raw/gzip 门证明新增 `<link>` 在预算内。RSS 保持兼容，不接入外部服务。
