# 当前项目状态

> 更新时间：2026-08-11 · 每轮迭代更新 · 本文件位于仓库根 Obsidian Vault 中

## 产品目标

MyBlog 是 Zach424 的个人技术知识库与公开工程日志。它把学习记录、技术判断和项目复盘保存为可检索、可链接、可版本控制的 Markdown；作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，`main` 自动交付到 Vercel。

## 当前结构

| 模块 | 状态 | 当前责任与证据 |
| --- | --- | --- |
| 内容契约 | done | YAML + Zod 校验文章、TIL、项目、标签、专题、日期、URL、内容语境、复核日期与本地封面替代文本 |
| 公开阅读 | done | 首页、文章、项目、专题、标签、统一时间档案、首发/更新内容活动、首页最近三次变化摘要、订阅与开放接口目录、搜索、关于、品牌化 404 恢复路口、响应式、深色模式与详情页封面；共享列表、搜索和知识图谱统一区分首发/更新日，搜索结果提供 Unicode 安全命中证据，文章/项目详情提供最多 3 条带可见理由的继续阅读 |
| 读者分享 | done | 文章/项目服务端规范链接、Web Share、URL/Markdown 引用 Clipboard、全 ASCII 标点转义、取消静默、共享 single-flight、`aria-live` 回执、无 JavaScript 恢复路径与 print 隔离 |
| Markdown | done | GFM、代码高亮、语言标签、渐进增强的一键复制、与实际渲染一致的 H1–H6 heading id、H2/H3 目录与原生永久链接、Obsidian 兼容脚注/尾注与行内/块级数学公式、A4 打印/PDF 版式、阅读时间、相邻文章与响应式正文图片 |
| 内容发现 | done | SEO、内容级 OG/Twitter 封面、首页唯一 `WebSite`、文章/项目纯生成器维护的稳定身份与站点引用、文章 `wordCount`/`timeRequired`、四类详情可见路径与 `BreadcrumbList` JSON-LD、统一年月时间档案、可见订阅目录、首页/Sitemap 共享公开路由事实、OpenSearch 1.1、version 1 公开内容清单及 Draft 2020-12 JSON Schema、JSON Feed 1.1、RSS、文章/项目可移植 Markdown 源文、Sitemap、robots、NFKC/AND 本地全文搜索；七个结构化端点与源文均有 SHA-256 ETag/条件读取 |
| 网页写作 | done | `/studio`、GitHub OAuth、Decap workflow、PR、按 slug 归档媒体、稳定 slug 锁定、双层 SHA-256 冲突预检、快速重选 latest-wins、生产规则公式预览与全字段只读发布清单 |
| Obsidian 写作 | done | Vault、三类受信模板、桌面插件 1.41.0、文件名唯一草稿身份、原子新建/改名/旧身份清理、source-scoped 作者意图与来源行导航、发布/复核 single-flight、三方版本联锁、bundle SHA-256 完整性、四路径 Git HEAD/index/worktree provenance、sealed Git 交付恢复、维护台账、全库生产同步、手动单篇收敛与正常/恢复交付自动接力 |
| Inbox 发布就绪 | done | version 6/read-only 全草稿 ready/scheduled/blocked、每个可读来源的原始字节 SHA-256、Article/TIL/Project、精确站内目标/源码行/重复次数、媒体 COVER/BODY 用途/出现次数/源码行/最终替代文本及来源、空文本与文件名回退阻塞、真实媒体候选、目标/共享附件诊断、CLI 全库或 `--source` 聚焦 JSON 与 Obsidian 当前草稿原生摘要 |
| 附件发布 | done | Wiki/Markdown 图片转换、按内容隔离、稳定命名、越界保护、失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟；checkout/setup-node v6 Node 24 action runtime 的六处引用固定到官方完整 SHA，应用 Node 22 与 workflow 语义由共享结构/发布门禁保护 |
| 生产内容同步 | done | `content:production` 输出全库 deployed/pending/missing/unexpected；`content:production:wait` 冻结单篇来源 SHA-256/ETag，以条件 GET 有界等待 deployed；Obsidian 1.41.0 提供手动入口，并从正常或 recovery publication/review 的可信 Git 成功结果在写事务释放、Vault reconcile 后自动接力同一 latest-wins 等待器 |
| HTML 传输预算 | done | 十三条关键路由的稳定生产 raw/Node gzip 基线、160 KiB 紧急上限、20%/2 KiB gzip 余量公式、本地稳定 host 与部署后实际 origin 双验证、逐路由余量报告与覆盖失败关闭；0120 基线来自 `c54535e` 稳定生产响应并覆盖首页摘要、活动页与固定 404 |
| 结构化发现传输预算 | done | 清单、Schema、JSON Feed、RSS、Sitemap、robots、OpenSearch 的稳定生产 raw/gzip 基线、50% + raw 4 KiB/gzip 1 KiB 余量、逐端点报告与恰好一次覆盖门 |
| 恢复能力 | done | Vercel 显式目标回滚、当前版本恢复、再次冒烟 |
| 内容知识网络 | done | GFM 行内/引用式/自引用链接、页面与标题锚点构建门、文章/项目双向引用账本，以及复用专题、标签和已验证图边的可解释推荐 |
| 公开知识地图 | done | `/knowledge` 服务端 SVG 信号场、HTML 关系账本、带首发/更新日期的节点与孤立记录、主导航与 Sitemap，Markdown 链接为唯一事实源 |
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
- 时间档案：`createContentArchive()` 从同一公开 `ContentRecord` 复制后按发布日期倒序、`zh-CN` 标题和 `en` URL 稳定决胜，再按年/月生成计数账本；`/archive` 以纯 Server Component 输出原生日期、类型、标题和摘要，主导航、Sitemap、320px、深浅色、打印与生产 smoke 共用该事实；
- 订阅入口：`createSubscriptionCatalog()` 把既有 RSS、JSON Feed、OpenSearch、内容清单/Schema 与单篇 Markdown 投影为五条只读通道，并从同一公开集合稳定选择最新 Markdown 示例；`/subscribe` 用纯 Server Component 输出 MIME、Freshness、真实端点动作与只读边界，不复制协议数据、不增加客户端请求；
- 错误恢复：根级 `not-found` 保持真实 404、`no-store`、显式 `noindex` 与单一 H1，以 KEYWORD/TIME/NOTES/BUILDS 四路账本连接搜索、档案、文章和项目；CSS Module、390px、深浅色、打印、SSR、生产 smoke 和固定路由预算共同锁定，无客户端请求或软 404；
- 公开路由事实：`createPublicRouteInventory()` 把 11 条静态页面与公开文章、项目、专题、标签组合为唯一有序清单；Sitemap 序列化 routes，首页 Evidence Rail 使用同一 total，`LATEST` 使用与根 `lastmod` 相同的最新公开内容日期；重复 path 失败关闭，空库不伪造日期，无 Git/API/客户端读取；
- 首页内容证据：`createHomepageEvidence()` 只接收精选项目与最新文章的标题、状态/类型、日期、stack/tags，派生 Building、Learned 和 Current focus；前 N 项 + `+N` 控制元数据密度，长标题保留原文，空项目/文章诚实降级，无第二份运行状态或客户端读取；
- About 系统档案：`createAboutProfile()` 从公开 posts/projects/series/tags、共享路由 total/latestModified 与精选项目派生集合计数、记录/路由 meta、最近更新、中文状态和完整 stack；`content-presentation.ts` 与首页共享状态翻译，空集合明确降级，无 Git/API/客户端读取；
- 项目状态展示：`getProjectStatusPresentation()` 为 planning/building/maintained/archived 输出唯一中文 label、大写 code 与 `label · CODE` meta；首页项目卡、项目集合和项目详情使用 meta，About/Evidence 自然句使用 label，机器内容仍保留原始 enum；
- 内容日期展示：`getContentDatePresentation()` 仅在 `updatedAt > publishedAt` 时输出 UPDATED/更新日，否则输出 PUBLISHED/首发日；`ContentIndexList`、搜索结果、知识图 SVG 节点与孤立记录共同消费，搜索/图谱仍按首发日排序，archive 继续使用独立首发时间线；
- 内容活动：`createContentActivity()` 为每条公开记录派生一次 PUBLISHED，仅在更新日晚于首发日时再派生 UPDATED；`/activity` 以纯 Server Component 按日输出 diff rail，明确排除 `reviewedAt`，archive 只提供入口且继续保留首次发布日期职责；
- 首页最近活动：`app/page.tsx` 直接展平同一 `createContentActivity()` 结果并取前三项，以纯 Server Component 输出 `CHANGE SET / 03 LATEST`、模式、日期、类型、标题和完整账本链接；摘要没有第二份更新判断或排序，活动页与首页专属样式进入独立 CSS Module，全局 CSS 降至 95,383 B；
- 运行时：Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- 内容：仓库内 Markdown、YAML、Zod，GitHub 是唯一事实源；
- 发现：`/content.json` 从公开 getter 稳定生成 4 条机器清单，逐项提供同 origin HTML/Markdown URL 与最终源文 SHA-256；`/content.schema.json` 使用 Draft 2020-12 固定 version 1 结构，并以 describedby/describes Link 与清单双向关联。清单、Schema、JSON Feed、RSS、Sitemap、robots、OpenSearch 都以最终正文生成 SHA-256 ETag 并支持空 304；清单另有 Last-Modified，Feed/RSS/Sitemap/OpenSearch 保留一小时 fresh/一天 SWR，robots 保留一天 fresh；
- 结构化身份：`SITE_TITLE`、`SITE_DESCRIPTION`、`SITE_LANGUAGE` 与可信请求 origin 生成仅首页存在的唯一 `WebSite`，根 URL 与 `#website` 身份稳定；文章 `BlogPosting` 和项目 `SoftwareSourceCode` 使用同 origin canonical 加 `#content` 的稳定身份，并以最小 `isPartOf` 引用站点节点；两个类型收窄纯生成器集中完整文档、作者、数组/URL 复制与可选字段省略，详情页不再内联映射；文章另复用内容契约的整数 `wordCount` 和正整数 `readingMinutes` 输出 `wordCount`/`PT<n>M`，项目不扩散 Article 字段；四类详情面包屑继续由可见路径单一来源生成。全部使用原生服务端 JSON-LD script，不增加客户端代码、数据库、虚构别名、SearchAction 或未经确认的人物档案；
- 搜索：服务端 Markdown AST 生成纯文本索引，客户端使用 NFKC、`zh-CN` 小写和多词 AND 排名；规范化命中通过 grapheme 边界映射回作者原文，只以 React 文本节点和原生 `<mark>` 渲染。摘要/正文选择覆盖查询词更多的证据，字段原因与来源标签、浅深色 AA 对比和显式 `:focus-visible` 共同提供可解释反馈；
- 推荐：服务端纯函数从公开记录和 outgoing/backlink 索引派生，按双向引用 120、当前引用 80、反向引用 70、同专题 60、每个共同标签 15 排序；最多 3 条、同分稳定决胜、逐条显示实际理由，无客户端请求、数据库或新增内容字段；
- 阅读：react-markdown、remark-gfm、remark-math、rehype-slug、rehype-highlight、rehype-katex 与 KaTeX；服务端 Markdown、中文脚注语义与回链、HTML + MathML 数学公式、MarkdownHeading 永久链接、PrintSource 可信来源与字段受限的可移植 `source.md`，最终 UTF-8 SHA-256 ETag、公开日期 Last-Modified 与 `If-None-Match` 弱比较，最小 CodeBlock/ShareTrace 客户端岛、Web Share/Clipboard API、CommonMark 全 ASCII 标点引用转义、共享 single-flight 与 aria-live；GFM + math 共享 mdast 继续复现标题、链接、媒体、搜索和源文 URL 改写语义，生产阅读与 Studio 共享 remark/rehype/KaTeX/安全 URL 规则，构建期公式使用 `trust: false`/严格资源上限；A4 `@page` 与 scoped print CSS 只重排既有语义 DOM；
- 发布：Decap CMS 3.14.1、GitHub OAuth、stable slug/媒体/公式/条目预检，Obsidian Publisher 1.41.0 的受信模板、文件名身份、source-scoped 作者意图、媒体/链接来源行、四事务联锁、所有 Git writer 三方版本、bundle 摘要与 Git provenance 握手、sealed Git 交付恢复、全库生产同步、单篇收敛等待与正常/恢复 version 1 post-delivery handoff；`content:production`/`content:production:wait` 复用公开清单生成器，使用受限流式 GET、严格 version 1 协议、来源字节冻结、条件请求与零写入报告；
- 媒体：Sharp 0.35.3、浏览器 magic/帧结构解析、`createImageBitmap` 与 Web Crypto、构建期确定性摘要清单、mdast-util-from-markdown 2.0.3、`next/image`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：内容新鲜度、根暂存媒体、正文/结构化端点外链、生产内容同步与收敛等待 CLI；Studio/Obsidian 提供只读队列，实时网络检查都只显式运行且不进入默认离线发布门；
- 路由：严格 YAML + Zod 永久重定向注册表、Next `redirects()` 308、构建期现行路由与静态文件交叉校验；
- 知识图：纯函数派生有向节点/边、语义 SVG + HTML 账本、零客户端布局依赖与 320px 明确降级；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、YAML workflow 契约、官方 action 完整 SHA 共享门禁、十三路 HTML 与七端点结构化发现的 `Buffer.byteLength`/Node zlib raw-gzip 双层预算、源站/边缘 ETag 等价验证与线上实际 origin 冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮功能提交：`c54535e`（首页最近活动与活动样式隔离）与 `67a127a`（十三路生产 HTML 重定基线），已推送 `main` 并由 Vercel 部署；
- 自动交付：稳定生产首页显示三个最新 UPDATED 事件并链接 `/activity`；完整活动页仍是 8 个事件、5 个日期组、4 个 PUBLISHED 与 4 个 UPDATED，零 REVIEWED 事件；完整 smoke 为 27 routes、OAuth 302，十三条 HTML 与七个结构化发现端点全部 PASS；
- 最新完成迭代：0120 首页最近活动摘要；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md`、`docs/iterations/*.md` 与 `docs/knowledge/*.md` 是同一份本地文件，可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

首页新增纯服务端“最近活动”摘要。页面直接复用 `createContentActivity([...posts, ...projects])`，在全局事件排序完成后展平日期组并取前三项；当前依次显示 MyBlog `2026-08-06`、维护博客文章 `2026-08-05`、项目章程文章 `2026-08-04`，三项均为 UPDATED，并提供完整 `/activity` 原生链接。失败优先 SSR 测试先证明旧首页没有该区块，再锁定数量、模式、顺序、日期与零 reviewed。活动页的 263 行专属规则迁入 `app/activity/activity.module.css`，首页新轨道使用 `app/home-activity.module.css`，全局 CSS 从 99,995 B 降至 95,383 B。完整验证为 524/524 单元测试、52 个构建页面、30/30 应用测试；真实 Chromium 覆盖 390×844 纵向轨道、1280×900 横向轨道及活动页，根宽均等于视口且 0 console errors。稳定生产 smoke 为 27 routes、OAuth 302；首页为 38722/7641 B、活动页为 41778/6507 B（raw/gzip），十三条 HTML 与七端点预算全部 PASS。Building/Learned/Current focus、archive、搜索、知识图、frontmatter 与机器接口既有语义未改变。本轮中文状态、迭代归档和知识笔记都位于同一 Obsidian Vault。

## 风险与下一步

1. Studio 已完成真实格式/预算、生产/会话摘要、快速重选竞态、数学公式作者预览和全字段只读 Author Proof，但有意不自动缩放/转 WebP，也不在第一版阻断保存；跨文章 slug/专题连续性、媒体引用和站内关系仍由完整仓库门验证；
2. 首次保存后的 slug 已在 Studio 控件层锁定；真正迁移仍只能通过 Git 同步修改内容文件、正文引用、附件目录和 `content/redirects.yml`。注册表不自动推断迁移且有意只支持精确单跳路径；该控件依赖固定 Decap 3.14.1 bundle 的 `entry/newRecord` 契约，升级时必须重审；
3. inbox readiness 已覆盖全部本地草稿，但有意不进入 Actions：未跟踪草稿和附件天然不在 CI 检出中；当前真实 inbox 为空，正向/阻塞路径由临时 Git/媒体夹具验证，首次实际多草稿使用时仍应按 Modal 逐项复核；
4. Obsidian 1.41.0 已闭合草稿身份、source-scoped 作者意图、媒体/链接源码行、发布/复核事务、sealed Git 交付恢复、内容维护、全库生产同步和活动正式笔记收敛等待；正常与恢复 publication/review 成功后均自动接力。三方版本、bundle 完整性、Git provenance、未来 patch/minor、伪造/局部/staged/unstaged 失败关闭、receipt/handoff、事务先释放、reconcile 后启动、latest-wins、卸载取消和零重复 Git 动作均由宿主/真实临时仓库覆盖，但仍需首次真实 Obsidian 主题下观察 reload/bundle/provenance interlock、两个连续 Modal、长 ETag、commit 和持续 Notice 的视觉密度；
5. Obsidian 块引用是专有语法，当前明确拒绝；知识地图已公开，但当前 SVG 双列布局为小型内容库优化，内容增长后需要在不牺牲 HTML 语义的前提下增加过滤或分组；
6. 正文与结构化 HTTPS 端点已有统一离线库存、显式健康检查、生产四态核对和单篇条件轮询，但 DNS、代理、限流与网络仍只是观察证据；传输/协议错误独立失败，实时检查不进 Actions，Obsidian 子进程能否访问 Vercel 取决于本机 Node 网络环境；Node 24 使用代理环境变量时需同时启用 `NODE_USE_ENV_PROXY=1` 并完整重启 Obsidian；
7. 标题锚点采用严格的实际渲染 id；改名或调整重复标题顺序时必须同步正文深链，Obsidian 块引用和模糊匹配仍明确不支持；
8. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
9. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
10. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。
11. checkout/setup-node v6 的六处移动 tag 风险已关闭：执行 ref 全部固定到从官方仓库核对的完整 SHA，测试与发布前检查共享唯一事实源。不可变 pin 不会自动接收上游修复，自动更新机器人继续暂缓；后续必须主动核对官方 refs，不能把 `# v6` 注释当作执行引用。
12. 替代主机 raw 100KB 假绿已由双层预算关闭。Node gzip 是确定性传输模拟，不包含 Vercel CDN Brotli、响应头、TLS 或真实用户 Web Vitals；稳定域名变化时必须同步更新 origin 与带来源的生产基线，基线增长也必须经过产品价值复核，不能为单路由临时抬线。
13. JSON Feed 当前为 4 条、20697/9876 B raw/gzip，全文 `content_text` 会随公开内容线性增长并丢失 Markdown 格式结构；七端点预算已把当前规模、推导上限和本地/生产覆盖闭环，OpenSearch 当前为 700/462 B。基线不会自动追随当前输出；只有有价值的内容/协议变化、真实生产重测和归档齐全时才能更新。达到阈值后再评估最近 N 条、分页或派生缓存，不能先抬线。Vercel 会消费 SWR、可为压缩表示弱化 ETag 并精简 304 representation metadata，生产验证必须比较 opaque SHA-256、等价缓存和零正文，而不是只比较源站字符串。
14. 单篇 Markdown 源文有意不是仓库作者文件的无损 round-trip，raw HTML 属性也不在 URL 改写契约内；确定性 ETag、Last-Modified、条件 GET、version 1 批量清单与独立 Draft 2020-12 Schema 已闭环。Schema 能拒绝未知字段、坏 token、origin 路由形状和 kind/type 错配，但不单独证明跨字段相等、跨条目唯一/排序或真实日历日期；生产清单解析器继续负责这些关系语义。Vercel 可对压缩表示弱化 ETag 并精简边缘 304 元数据，生产门以相同 opaque digest 和安全缓存验证等价语义。
15. Git/Obsidian sealed receipt、version 1 handoff、生产收敛、三方版本、磁盘 bundle 摘要和四路径 Git provenance 已覆盖正常与恢复交付；v3 绑定冻结 localHead tree，工作区/index 漂移不能再把本地 `--write` 伪装成可信 release。剩余证据缺口不是自动化逻辑，而是首次真实 Obsidian 主题与本机代理环境下的人机验收。
16. 搜索首屏仍向客户端序列化 4 条完整纯文本文档和每条可选更新日。当前生产 `/search?q=cloudflare` 为 41251/14704 B raw/gzip，体积在冻结预算内；内容规模增长时应先由 HTML raw/gzip 门报警，再评估索引分片或按需加载。当前实现依赖 Next.js/目标浏览器已支持的 `Intl.Segmenter`，且坚持以数据分段和 React 转义渲染，不能为兼容或高亮改回 raw HTML。
17. 推荐排序在当前小型内容库里可解释且稳定，但内容与标签增长后，泛化共同标签可能逐步压过稀有关系。先保留可见理由和 HTML 预算证据，积累真实内容分布后再评估标签稀有度或多样性约束；不接入点击追踪或黑盒模型。
18. 结构化面包屑会增加四类详情 HTML，且只有与可见路径一致时才可信；0105 的九路基线已用 `ccd494e` 稳定生产重新冻结，后续不能用本地输出或未部署提交自我放行。当前自动门证明语法、路径、同源与 404 边界，不保证搜索引擎一定展示富媒体结果；后续变更仍应使用官方 Rich Results Test 或 Schema Markup Validator 做必要的发布前抽查。
19. 首页站点名称会被 Google 与页面标题、`og:site_name`、首页可见文字等多信号共同判断；当前 `WebSite` 只能表达偏好，不能保证采用或展示。站点名称不支持 Rich Results Test，应使用 Schema Markup Validator 做语法抽查。0107 九路 HTML 基线已绑定 `668d26fb` 稳定生产；自定义域名启用时必须同步验证根 URL、内容/站点 `@id`、canonical、Open Graph、Feed/清单和全部生产门，不能沿用 Vercel 域名证据。
20. 当前内容身份生成器有意要求 canonical 与站点同 origin，避免把外部页面错误声明为本博客内部节点；内容契约仍允许 HTTPS canonical，因此未来若要转载或迁移到外部 canonical，必须先明确“本地页面身份、原始作品身份与 `isPartOf`”的语义，再调整契约和生成器，不能绕过同源门。文章/项目完整 JSON-LD 已收口为纯生成器；作者 `Person` 仍只有现有姓名和 GitHub URL，在所有者确认更多人物事实前不增加独立 `@id` 或 ProfilePage。
21. `wordCount`/`timeRequired` 是内容契约的确定性启发式，不是每位读者的精确承诺：中文按 CJK 字符、拉丁文按 token，分别以 300/200 每分钟估算并至少为 1。代码块、公式和语言分布会影响结果；算法变更时必须同步页面 Read Time、JSON-LD、测试与生产基线。
22. `/archive` 当前只有一个年份和月份，但跨年、跨月、同日决胜、空集合和输入不变已经由夹具固定。内容增长前不提前增加客户端筛选、分页或年份锚点；若分组或 DOM 规模开始触及十三路预算，再依据真实数据选择增强方式。
23. `/subscribe` 已把五类现有开放接口集中为可见目录，但它有意保持只读：不会收集邮箱、创建账户、保存订阅状态或代理第三方阅读器。未来若需要邮件订阅，必须由所有者单独选择供应商、隐私告知与数据保留策略，不能把当前目录误解为邮件服务。
24. 404 恢复语境已经闭环，但本地 Next 自动 noindex 与 Vercel 最终 HTML 不一致；组件显式 meta 后本地有两个相同指令、生产一个。相同指令不改变语义，升级 Next/Vercel 时仍必须用最终生产 HTML 验证。错误页继承根首页 canonical，本轮没有为非索引页面启用实验性 global-not-found。
25. `/activity` 已提供按事件查看“何时发布、何时真正更新”的统一活动流，archive 继续只保留首次发布日期。首页摘要已直接复用同一模型并限制三项，没有复制排序或日期规则；活动数仍按每条记录最多两个事件线性增长，当前无需筛选或分页。RSS item 仍只有首发 `pubDate`，下一步若表达更新必须先验证 Atom 扩展与阅读器兼容性，不能把首发时间替换成更新日。
26. 本机浏览器使用系统代理时，Git for Windows 与 Node `fetch` 不一定自动继承代理配置，可能出现网页可达而 Git/生产 smoke 直连超时。0115 通过单次命令注入系统代理完成 push 和 smoke，没有写入仓库或全局 Git 配置；以后仍先区分站点失败与本地网络分流，不能把传输失败误判为部署失败。

下一轮唯一主任务：让 RSS 订阅读者获得可验证的内容更新语义。先以 RSS 2.0 与 Atom 官方规范为依据，验证逐 item 修改时间的合法扩展方式和常见阅读器兼容边界；若证据成立，只为 `updatedAt > publishedAt` 的条目增加修改时间，保持现有 `guid`、`pubDate`、首发排序、频道 `lastBuildDate` 与 JSON Feed `date_modified` 不变，并同步发现端点测试、生产 smoke、预算与中文归档。不新增数据库、账户、追踪、第三方服务或云配置。
