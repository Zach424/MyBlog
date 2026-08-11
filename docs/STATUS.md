# 当前项目状态

> 更新时间：2026-08-12 · 每轮迭代更新 · 本文件位于仓库根 Obsidian Vault 中

## 产品目标

MyBlog 是 Zach424 的个人技术知识库与公开工程日志。它把学习记录、技术判断和项目复盘保存为可检索、可链接、可版本控制的 Markdown；作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，`main` 自动交付到 Vercel。

## 当前结构

| 模块 | 状态 | 当前责任与证据 |
| --- | --- | --- |
| 内容契约 | done | YAML + Zod 校验文章、TIL、项目、标签、专题、日期、URL、内容语境、复核日期与本地封面替代文本 |
| 公开阅读 | done | 首页、文章、项目、专题、标签、统一时间档案、首发/更新内容活动、首页最近三次变化摘要、订阅与开放接口目录、搜索、关于、品牌化 404 恢复路口、响应式、深色模式与详情页封面；共享列表、搜索和知识图谱统一区分首发/更新日，搜索结果提供 Unicode 安全命中证据，文章/项目详情提供最多 3 条带可见理由的继续阅读 |
| 读者分享 | done | 文章/项目服务端规范链接、Web Share、URL/Markdown 引用 Clipboard、全 ASCII 标点转义、取消静默、共享 single-flight、`aria-live` 回执、无 JavaScript 恢复路径与 print 隔离 |
| Markdown | done | GFM、代码高亮、语言标签、渐进增强的一键复制、与实际渲染一致的 H1–H6 heading id、H2/H3 目录与原生永久链接、Obsidian 兼容脚注/尾注、行内/块级数学公式、Callout、受限 Mermaid 服务端 SVG、受限本地静音 MP4、受限多图画廊与受限技术表格、A4 打印/PDF 版式、阅读时间、相邻文章与响应式媒体 |
| 内容发现 | done | SEO、内容级 OG/Twitter 封面、首页唯一 `WebSite`、文章/项目纯生成器维护的稳定身份与站点引用、文章 `wordCount`/`timeRequired`、四类详情可见路径与 `BreadcrumbList` JSON-LD、统一年月时间档案、可见订阅目录、标签/专题级 RSS 与页面自动发现、一次导入全部公开 RSS 的分组 OPML 2.0、按真实内容变化排序的 Atom 1.0、首页/Sitemap 共享公开路由事实、OpenSearch 1.1、version 1 公开内容清单及 Draft 2020-12 JSON Schema、JSON Feed 1.1、保留首发 `pubDate` 且以 `dcterms:modified` 表达更新的 RSS、Feed/清单/单篇 Markdown 的 Last-Modified 与日期条件验证、十三端点 HEAD 等价门禁、Sitemap、robots、NFKC/AND 本地全文搜索；十一个结构化端点与源文均有 SHA-256 ETag/条件读取 |
| 网页写作 | done | `/studio`、GitHub OAuth、Decap workflow、PR、按 slug 归档媒体、稳定 slug 锁定、双层 SHA-256 冲突预检、快速重选 latest-wins、共享生产管线的公式/Callout/Mermaid/视频/画廊/技术表格预览、自定义本地静音视频组件、可排序画廊、结构化技术表格组件与全字段只读发布清单 |
| Obsidian 写作 | done | Vault、三类受信模板、桌面插件 1.44.0、文件名唯一草稿身份、图片/画廊/MP4 原子归档、画廊/技术表格模板插入、source-scoped 作者意图与来源行导航、发布/复核 single-flight、三方版本联锁、bundle SHA-256 完整性、四路径 Git HEAD/index/worktree provenance、sealed Git 交付恢复、维护台账、全库生产同步、手动单篇收敛与正常/恢复交付自动接力 |
| Inbox 发布就绪 | done | version 8/read-only 全草稿 ready/scheduled/blocked、每个可读来源的原始字节 SHA-256、Article/TIL/Project、精确站内目标/源码行/重复次数、媒体 COVER/BODY/GALLERY/VIDEO 用途/出现次数/源码行/最终说明及来源、空文本与文件名回退阻塞、真实媒体候选、目标/共享附件诊断、CLI 全库或 `--source` 聚焦 JSON 与 Obsidian 当前草稿原生摘要 |
| 附件发布 | done | Wiki/Markdown 图片、受限画廊列表与 Markdown MP4 转换，按内容隔离、稳定命名、越界保护、真实媒体校验与失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟；checkout/setup-node v6 Node 24 action runtime 的六处引用固定到官方完整 SHA，应用 Node 22 与 workflow 语义由共享结构/发布门禁保护 |
| 生产内容同步 | done | `content:production` 输出全库 deployed/pending/missing/unexpected；`content:production:wait` 冻结单篇来源 SHA-256/ETag，以条件 GET 有界等待 deployed；Obsidian 1.44.0 提供手动入口，并从正常或 recovery publication/review 的可信 Git 成功结果在写事务释放、Vault reconcile 后自动接力同一 latest-wins 等待器 |
| HTML 传输预算 | done | 十三条关键路由的稳定生产 raw/Node gzip 基线、160 KiB 紧急上限、20%/2 KiB gzip 余量公式、本地稳定 host 与部署后实际 origin 双验证、逐路由余量报告与覆盖失败关闭；0120 基线来自 `c54535e` 稳定生产响应并覆盖首页摘要、活动页与固定 404 |
| 结构化发现传输预算 | done | 清单、Schema、JSON Feed、根 RSS、代表标签 RSS、代表专题 RSS、Atom 更新订阅、聚合 OPML、Sitemap、robots、OpenSearch 的稳定生产 raw/gzip 基线、50% + raw 4 KiB/gzip 1 KiB 余量、逐端点报告与恰好一次覆盖门 |
| 恢复能力 | done | Vercel 显式目标回滚、当前版本恢复、再次冒烟 |
| 内容知识网络 | done | GFM 行内/引用式/自引用链接、页面与标题锚点构建门、文章/项目双向引用账本，以及复用专题、标签和已验证图边的可解释推荐 |
| 公开知识地图 | done | `/knowledge` 服务端 SVG 信号场、HTML 关系账本、带首发/更新日期的节点与孤立记录、主导航与 Sitemap，Markdown 链接为唯一事实源 |
| 永久链接迁移 | done | Git 版本化 redirect 注册表、当前路由/静态文件冲突门、公开目标校验、单跳 308 与生产冒烟 |
| 内容新鲜度 | done | Current/Historical 可见语境、复核日期、当前记录 180 天构建门、现行 Demo |
| 内容维护报告 | done | 本地文本/JSON、60/30 天分级、Actions 摘要与每周自动复核 |
| Studio 复核队列 | done | `/studio/maintenance`、动态报告日、Review Horizon、四级优先级、稳定编辑/公开入口与可恢复只读失败态 |
| 外部链接库存 | done | 公开正文与 canonical/repository/demo 的统一 HTTPS 来源/次数离线报告，显式公网 HEAD 检查与非硬门状态分类 |
| 根暂存媒体审计 | done | inbox 引用账本、Git/文件系统年龄证据、共享/未引用/陈旧/缺失报告与 Actions warning，零自动删除 |
| 媒体门禁 | done | 图片真实格式解码、3 MiB/2560 px/像素与动图预算；MP4 真实轨道/编码/fast-start、12 MiB/90 秒/1080p 预算；Studio 上传前诊断、Obsidian 处理与构建扫描 |
| 媒体引用完整性 | done | Markdown AST 图片/画廊/视频抽取、精确路径存在性、根暂存拒绝、slug 所有权与已归档孤儿附件门禁 |
| 媒体展示 | done | 封面、正文图和画廊共享固有尺寸/`next/image` 链路；画廊使用无脚本有序接触表、桌面双栏/窄屏单栏与打印布局；HTTPS 外图有明确降级边界；本地静音 MP4 使用无 autoplay/iframe/追踪的原生播放器和打印链接降级 |

## 设计与技术

- 视觉方向：Commit Trace / Evidence Rail，中文优先、工程档案感、浅深色响应式；
- 时间档案：`createContentArchive()` 从同一公开 `ContentRecord` 复制后按发布日期倒序、`zh-CN` 标题和 `en` URL 稳定决胜，再按年/月生成计数账本；`/archive` 以纯 Server Component 输出原生日期、类型、标题和摘要，主导航、Sitemap、320px、深浅色、打印与生产 smoke 共用该事实；
- 订阅入口：`createSubscriptionCatalog()` 把既有 RSS、Atom、OPML、JSON Feed、OpenSearch、内容清单/Schema 与单篇 Markdown 投影为七条只读通道，并从同一公开集合稳定选择最新 Markdown 示例；`/subscribe` 用纯 Server Component 输出 MIME、Freshness、真实端点动作与只读边界，不复制协议数据、不增加客户端请求；
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
- 发现：`/content.json` 从公开 getter 稳定生成 4 条机器清单，逐项提供同 origin HTML/Markdown URL 与最终源文 SHA-256；`/content.schema.json` 使用 Draft 2020-12 固定 version 1 结构，并以 describedby/describes Link 与清单双向关联。根 RSS、`/tags/[slug]/rss.xml` 与 `/series/[slug]/rss.xml` 共用 item 序列化和 HTTP 响应边界：标签 Feed 投影 `getTagBySlug()` 的公开 items；专题 Feed 接收章节序列但由共享订阅生成器按首发时间倒序输出，专题 HTML 仍保持 `series.order` 升序。两个 scoped Feed 都拥有独立 channel title/home/self、正文 SHA-256 与页面可见/alternate 发现，未知标签/专题返回共享的无验证器 `no-store` 404。`/updates.atom` 从同一公开记录生成 Atom 1.0：entry 的 `published` 保留首次发布，`updated` 使用 `updatedAt ?? publishedAt`，整个订阅按真实内容变化倒序，并以发布日期、中文标题和 URL 稳定决胜；summary、纯文本 content 与 category 分别复用 description、Markdown 纯文本和 tags。首页 head 与 `/subscribe` 提供发现，OPML 有意不包含该全站重叠频道，避免一次导入后收到 RSS/Atom 双份提醒。`/feeds.opml` 从同一标签/专题公开索引生成 OPML 2.0：根组包含全站 RSS，按标签与按专题两组分别按中文标题和 slug 稳定排序，当前共 13 个绝对订阅 URL；每个 leaf 都有规范 `text`、`type`、`xmlUrl`，并补充 `title`、`description`、`htmlUrl`、`language` 与 `version`。Atom 与 OPML 都不进入 Sitemap；OPML 不伪造无法证明的时间，只用正文摘要，而 Atom 用显式格式修订与最新内容日期派生 `updated`/Last-Modified。RSS 只在 `updatedAt > publishedAt` 时输出 `dcterms:modified`，同时保留原 `guid`、`pubDate`、首发排序与频道更新时间，并拒绝 item 级 `atom:updated`；逐 item 的 `<category>` 只序列化同一 `record.tags`，与 JSON Feed/Atom category 保持数量、顺序和值一致。清单、Schema、JSON Feed、根/标签/专题 RSS、Atom、OPML、Sitemap、robots、OpenSearch 都以最终正文生成 SHA-256 ETag 并支持空 304。`lib/feed-http.ts` 把各格式修订时间与上海日界线下的最新内容日期合成为 Feed 更新时间和 Last-Modified；JSON Feed、RSS、Atom、清单与单篇 Markdown 均复用三种标准 HTTP-date、`If-Modified-Since` 与 `If-None-Match` 强制优先，Feed/RSS/Atom/OPML/Sitemap/OpenSearch 保留一小时 fresh/一天 SWR，robots 保留一天 fresh；
- 结构化身份：`SITE_TITLE`、`SITE_DESCRIPTION`、`SITE_LANGUAGE` 与可信请求 origin 生成仅首页存在的唯一 `WebSite`，根 URL 与 `#website` 身份稳定；文章 `BlogPosting` 和项目 `SoftwareSourceCode` 使用同 origin canonical 加 `#content` 的稳定身份，并以最小 `isPartOf` 引用站点节点；两个类型收窄纯生成器集中完整文档、作者、数组/URL 复制与可选字段省略，详情页不再内联映射；文章另复用内容契约的整数 `wordCount` 和正整数 `readingMinutes` 输出 `wordCount`/`PT<n>M`，项目不扩散 Article 字段；四类详情面包屑继续由可见路径单一来源生成。全部使用原生服务端 JSON-LD script，不增加客户端代码、数据库、虚构别名、SearchAction 或未经确认的人物档案；
- 搜索：服务端 Markdown AST 生成纯文本索引，客户端使用 NFKC、`zh-CN` 小写和多词 AND 排名；规范化命中通过 grapheme 边界映射回作者原文，只以 React 文本节点和原生 `<mark>` 渲染。摘要/正文选择覆盖查询词更多的证据，字段原因与来源标签、浅深色 AA 对比和显式 `:focus-visible` 共同提供可解释反馈；
- 推荐：服务端纯函数从公开记录和 outgoing/backlink 索引派生，按双向引用 120、当前引用 80、反向引用 70、同专题 60、每个共同标签 15 排序；最多 3 条、同分稳定决胜、逐条显示实际理由，无客户端请求、数据库或新增内容字段；
- 阅读：react-markdown、remark-gfm、remark-math、rehype-slug、rehype-highlight、rehype-katex 与 KaTeX；服务端 Markdown、中文脚注语义与回链、HTML + MathML 数学公式、MarkdownHeading 永久链接、PrintSource 可信来源与字段受限的可移植 `source.md`，最终 UTF-8 SHA-256 ETag、公开日期 Last-Modified、ETag 优先与日期条件回退，最小 CodeBlock/ShareTrace 客户端岛、Web Share/Clipboard API、CommonMark 全 ASCII 标点引用转义、共享 single-flight 与 aria-live；GFM + math 共享 mdast 继续复现标题、链接、媒体、搜索和源文 URL 改写语义，生产阅读与 Studio 共享 remark/rehype/KaTeX/安全 URL 规则，构建期公式使用 `trust: false`/严格资源上限；A4 `@page` 与 scoped print CSS 只重排既有语义 DOM；
- 发布：Decap CMS 3.14.1、GitHub OAuth、stable slug/媒体/公式/条目预检、本地静音视频、可排序画廊与结构化技术表格组件，Obsidian Publisher 1.44.0 的受信模板、画廊/技术表格插入、文件名身份、source-scoped 作者意图、媒体/链接来源行、四事务联锁、所有 Git writer 三方版本、bundle 摘要与 Git provenance 握手、sealed Git 交付恢复、全库生产同步、单篇收敛等待与正常/恢复 version 1 post-delivery handoff；`content:production`/`content:production:wait` 复用公开清单生成器，使用受限流式 GET、严格 version 1 协议、来源字节冻结、条件请求与零写入报告；
- 媒体：Sharp 0.35.3、MP4Box 2.4.1、浏览器图片/视频元数据解析、`createImageBitmap`/`HTMLVideoElement` 与 Web Crypto、构建期确定性摘要清单、mdast-util-from-markdown 2.0.3、`next/image`、原生 `<video>`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：内容新鲜度、根暂存媒体、正文/结构化端点外链、生产内容同步与收敛等待 CLI；Studio/Obsidian 提供只读队列，实时网络检查都只显式运行且不进入默认离线发布门；
- 路由：严格 YAML + Zod 永久重定向注册表、Next `redirects()` 308、构建期现行路由与静态文件交叉校验；
- 知识图：纯函数派生有向节点/边、语义 SVG + HTML 账本、零客户端布局依赖与 320px 明确降级；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、YAML workflow 契约、官方 action 完整 SHA 共享门禁、十三路 HTML 与十一端点结构化发现的 `Buffer.byteLength`/Node zlib raw-gzip 双层预算、源站/边缘 ETag 与 GET/HEAD 等价验证、线上实际 origin 冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮功能提交：`ff90626`（受约束技术表格），归档提交 `3806c1d`，生产 smoke 扩展提交 `ab3c9c0`；功能与首份归档已推送 `main` 并进入 Vercel 稳定生产；
- 自动交付：生产 `/studio/table-editor.mjs` 为 200 且包含 `registerStudioTableEditor`；`/studio/math-preview` 已同时证明 `tableCount: 1`、`tableDataCellCount: 4`、具名静态表格 HAST 和既有公式/Callout/Mermaid/视频/画廊能力；完整 smoke 为 27 routes、OAuth 302，十三条 HTML 与十一个结构化发现端点全部 PASS。本轮没有改变公开内容集合或结构化端点正文，因此不重置既有生产预算基线；
- 最新完成迭代：0134 受约束技术表格、Studio/Obsidian 作者入口与 Data Ledger 阅读展示；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md`、`docs/iterations/*.md` 与 `docs/knowledge/*.md` 是同一份本地文件，可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

作者现在可以在 Studio 或 Obsidian 使用 `[!table]` 加标准 GFM 表格发布有标题的技术数据。每表 2–6 列、1–20 条数据行、最多 120 个数据单元格；每篇最多 4 表、合计最多 240 个数据单元格。表头非空且唯一，每行列数必须完全一致，普通无标题表格失败关闭。Studio 提供可增删/重排的列定义、显式对齐和数据行，Obsidian 1.44.0 提供三列模板。读者页使用无脚本 Data Ledger：首列固定、数字对齐、320 px 局部滚动、键盘焦点与打印解冻。完整证据为 575/575 单测、5/5 图表测试、69 个生成页面/资源、35/35 应用测试、生产依赖审计 0 漏洞、插件 3/3 SHA-256、真实浏览器 0 error，以及稳定生产 27 routes/OAuth 302 全部 PASS。

## 风险与下一步

1. Studio 已完成真实格式/预算、生产/会话摘要、快速重选竞态、数学公式作者预览和全字段只读 Author Proof，但有意不自动缩放/转 WebP，也不在第一版阻断保存；跨文章 slug/专题连续性、媒体引用和站内关系仍由完整仓库门验证；
2. 首次保存后的 slug 已在 Studio 控件层锁定；真正迁移仍只能通过 Git 同步修改内容文件、正文引用、附件目录和 `content/redirects.yml`。注册表不自动推断迁移且有意只支持精确单跳路径；该控件依赖固定 Decap 3.14.1 bundle 的 `entry/newRecord` 契约，升级时必须重审；
3. inbox readiness 已覆盖全部本地草稿，但有意不进入 Actions：未跟踪草稿和附件天然不在 CI 检出中；当前真实 inbox 为空，正向/阻塞路径由临时 Git/媒体夹具验证，首次实际多草稿使用时仍应按 Modal 逐项复核；
4. Obsidian 1.44.0 已闭合草稿身份、source-scoped 作者意图、图片/MP4 媒体与链接源码行、画廊/技术表格插入、发布/复核事务、sealed Git 交付恢复、内容维护、全库生产同步和活动正式笔记收敛等待；正常与恢复 publication/review 成功后均自动接力。三方版本、bundle 完整性、Git provenance、未来 patch/minor、伪造/局部/staged/unstaged 失败关闭、receipt/handoff、事务先释放、reconcile 后启动、latest-wins、卸载取消和零重复 Git 动作均由宿主/真实临时仓库覆盖，但仍需首次真实 Obsidian 主题下观察 reload/bundle/provenance interlock、两个连续 Modal、长 ETag、commit 和持续 Notice 的视觉密度；
5. Obsidian 块引用是专有语法，当前明确拒绝；知识地图已公开，但当前 SVG 双列布局为小型内容库优化，内容增长后需要在不牺牲 HTML 语义的前提下增加过滤或分组；
6. 正文与结构化 HTTPS 端点已有统一离线库存、显式健康检查、生产四态核对和单篇条件轮询，但 DNS、代理、限流与网络仍只是观察证据；传输/协议错误独立失败，实时检查不进 Actions，Obsidian 子进程能否访问 Vercel 取决于本机 Node 网络环境；Node 24 使用代理环境变量时需同时启用 `NODE_USE_ENV_PROXY=1` 并完整重启 Obsidian；
7. 标题锚点采用严格的实际渲染 id；改名或调整重复标题顺序时必须同步正文深链，Obsidian 块引用和模糊匹配仍明确不支持；
8. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
9. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
10. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。
11. checkout/setup-node v6 的六处移动 tag 风险已关闭：执行 ref 全部固定到从官方仓库核对的完整 SHA，测试与发布前检查共享唯一事实源。不可变 pin 不会自动接收上游修复，自动更新机器人继续暂缓；后续必须主动核对官方 refs，不能把 `# v6` 注释当作执行引用。
12. 替代主机 raw 100KB 假绿已由双层预算关闭。Node gzip 是确定性传输模拟，不包含 Vercel CDN Brotli、响应头、TLS 或真实用户 Web Vitals；稳定域名变化时必须同步更新 origin 与带来源的生产基线，基线增长也必须经过产品价值复核，不能为单路由临时抬线。
13. JSON Feed 当前为 4 条、20697/9876 B raw/gzip，根 RSS 为 3400/1284 B，代表标签 RSS 为 2059/923 B，代表专题 RSS 为 2065/983 B，Atom 为 4 条、21338/10063 B，OPML 为 13 个订阅、5193/962 B；全文 `content_text`、Atom content、各 scoped 命中集合和 OPML leaf 会随公开内容增长。十一端点预算已把当前规模、推导上限和本地/生产覆盖闭环，Atom 上限为 32768/15360 B，OPML 上限为 10240/2048 B，OpenSearch 当前为 700/462 B。0129 已在 Atom 上线后重测并把基线来源绑定 `7e5909f`；基线不会自动追随当前输出。达到阈值后再评估最近 N 条、摘要订阅或派生缓存，不能先抬线。Vercel 会消费 SWR、可为压缩表示弱化 ETag 并精简 304 representation metadata，生产验证必须比较 opaque SHA-256、等价缓存和零正文，而不是只比较源站字符串。
14. 单篇 Markdown 源文有意不是仓库作者文件的无损 round-trip，raw HTML 属性也不在 URL 改写契约内；确定性 ETag、Last-Modified、ETag/日期条件 GET、version 1 批量清单与独立 Draft 2020-12 Schema 已闭环。清单和源文现在共享同一条件响应边界，但 Last-Modified 仍沿用既有 UTC 零点语义；未来若统一作者时区，属于公开验证器迁移，必须单独评估缓存影响。Schema 能拒绝未知字段、坏 token、origin 路由形状和 kind/type 错配，但不单独证明跨字段相等、跨条目唯一/排序或真实日历日期；生产清单解析器继续负责这些关系语义。
15. Git/Obsidian sealed receipt、version 1 handoff、生产收敛、三方版本、磁盘 bundle 摘要和四路径 Git provenance 已覆盖正常与恢复交付；v3 绑定冻结 localHead tree，工作区/index 漂移不能再把本地 `--write` 伪装成可信 release。剩余证据缺口不是自动化逻辑，而是首次真实 Obsidian 主题与本机代理环境下的人机验收。
16. 搜索首屏仍向客户端序列化 4 条完整纯文本文档和每条可选更新日。当前生产 `/search?q=cloudflare` 为 41251/14704 B raw/gzip，体积在冻结预算内；内容规模增长时应先由 HTML raw/gzip 门报警，再评估索引分片或按需加载。当前实现依赖 Next.js/目标浏览器已支持的 `Intl.Segmenter`，且坚持以数据分段和 React 转义渲染，不能为兼容或高亮改回 raw HTML。
17. 推荐排序在当前小型内容库里可解释且稳定，但内容与标签增长后，泛化共同标签可能逐步压过稀有关系。先保留可见理由和 HTML 预算证据，积累真实内容分布后再评估标签稀有度或多样性约束；不接入点击追踪或黑盒模型。
18. 结构化面包屑会增加四类详情 HTML，且只有与可见路径一致时才可信；0105 的九路基线已用 `ccd494e` 稳定生产重新冻结，后续不能用本地输出或未部署提交自我放行。当前自动门证明语法、路径、同源与 404 边界，不保证搜索引擎一定展示富媒体结果；后续变更仍应使用官方 Rich Results Test 或 Schema Markup Validator 做必要的发布前抽查。
19. 首页站点名称会被 Google 与页面标题、`og:site_name`、首页可见文字等多信号共同判断；当前 `WebSite` 只能表达偏好，不能保证采用或展示。站点名称不支持 Rich Results Test，应使用 Schema Markup Validator 做语法抽查。0107 九路 HTML 基线已绑定 `668d26fb` 稳定生产；自定义域名启用时必须同步验证根 URL、内容/站点 `@id`、canonical、Open Graph、Feed/清单和全部生产门，不能沿用 Vercel 域名证据。
20. 当前内容身份生成器有意要求 canonical 与站点同 origin，避免把外部页面错误声明为本博客内部节点；内容契约仍允许 HTTPS canonical，因此未来若要转载或迁移到外部 canonical，必须先明确“本地页面身份、原始作品身份与 `isPartOf`”的语义，再调整契约和生成器，不能绕过同源门。文章/项目完整 JSON-LD 已收口为纯生成器；作者 `Person` 仍只有现有姓名和 GitHub URL，在所有者确认更多人物事实前不增加独立 `@id` 或 ProfilePage。
21. `wordCount`/`timeRequired` 是内容契约的确定性启发式，不是每位读者的精确承诺：中文按 CJK 字符、拉丁文按 token，分别以 300/200 每分钟估算并至少为 1。代码块、公式和语言分布会影响结果；算法变更时必须同步页面 Read Time、JSON-LD、测试与生产基线。
22. `/archive` 当前只有一个年份和月份，但跨年、跨月、同日决胜、空集合和输入不变已经由夹具固定。内容增长前不提前增加客户端筛选、分页或年份锚点；若分组或 DOM 规模开始触及十三路预算，再依据真实数据选择增强方式。
23. `/subscribe` 已把七类现有开放接口集中为可见目录，其中 RSS 服务首发顺序、Atom 服务真实变更顺序、OPML 负责一次导入全部 RSS，不负责替读者保存订阅；整个目录有意保持只读，不会收集邮箱、创建账户、保存订阅状态或代理第三方阅读器。未来若需要邮件订阅，必须由所有者单独选择供应商、隐私告知与数据保留策略，不能把当前目录误解为邮件服务。
24. 404 恢复语境已经闭环，但本地 Next 自动 noindex 与 Vercel 最终 HTML 不一致；组件显式 meta 后本地有两个相同指令、生产一个。相同指令不改变语义，升级 Next/Vercel 时仍必须用最终生产 HTML 验证。错误页继承根首页 canonical，本轮没有为非索引页面启用实验性 global-not-found。
25. `/activity` 已提供按事件查看“何时发布、何时真正更新”的统一活动流，archive 继续只保留首次发布日期。首页摘要已直接复用同一模型并限制三项，没有复制排序或日期规则；根/标签/专题 RSS 以 `dcterms:modified` 表达严格更新语义，以 category 表达与 JSON Feed 相同的作者标签，同时保留首发 `pubDate`。专题页面的章节顺序与专题 Feed 的变化顺序有意不同：前者服务连续学习，后者服务订阅提醒。JSON Feed/RSS 的 HTTP Last-Modified 另行表达整个表示何时发生变化，并同时考虑内容日期与格式修订。阅读器可以合法忽略扩展、分类或 HTML 自动发现，因此本站保证标准化 XML、解析器可读和跨格式对齐，不保证所有客户端一定展示或通知这些字段。
26. 本机浏览器使用系统代理时，Git for Windows 与 Node `fetch` 不一定自动继承代理配置，可能出现网页可达而 Git/生产 smoke 直连超时。0115 通过单次命令注入系统代理完成 push 和 smoke，没有写入仓库或全局 Git 配置；以后仍先区分站点失败与本地网络分流，不能把传输失败误判为部署失败。

27. scoped RSS 依赖精确路由缓存所有权。`next.config.ts` 只给 `/tags`、`/tags/:slug`、`/series` 与 `/series/:slug` HTML 页面设置 CDN 缓存，不能恢复成 `:path*`，否则会覆盖 RSS 成功响应和未知资源 `no-store` 404。新增集合子协议时必须同时验证已知/未知 GET 与 HEAD 的最终生产响应。

28. OPML 2.0 允许嵌套 outline，但具体阅读器可能把“按标签 / 按专题”折叠、展平或忽略；本站保证所有订阅 leaf、绝对 URL 和稳定顺序正确，不承诺第三方客户端保留分组外观。OPML 日期字段是可选项，无法证明精确表示修改时必须继续省略，不能用构建时间或部署时间伪造。

29. RSS 与 Atom 是同一内容集合的两种时间投影，不应互相替代：RSS 保留首次发布日期排序，Atom 提升真实更新；两者在 `/subscribe` 并列供读者主动选择，但 OPML 只导入 RSS，防止默认创建重叠的全站订阅。未来若增加 scoped Atom，必须先证明它解决新的读者任务，而不是机械复制全部 RSS 路由。

30. Callout 已覆盖官方类型、别名、折叠、嵌套、搜索、Studio、深浅色与打印，但有意不支持图标包、任意 CSS class、块引用 ID 或复杂 Markdown 标题。标题目前是纯文本；若未来扩展标题内联语法，必须先证明 HAST 与无障碍名称不会分叉。

31. Mermaid 已覆盖六类服务端 SVG、输入/输出预算、独立清理、Studio、搜索、源码、深浅色、窄屏与打印，但有意拒绝其余图表家族、初始化、click、作者 style/HTML 和客户端运行时。`beautiful-mermaid` 1.1.3 的固定包内 ESM 路径与当前输出标签集合是版本耦合；升级时必须同时重审 exports、ELK 规模、HAST 白名单、CSS 变量、双图 id、Vercel build 和真实浏览器 edge label。

32. 本地 MP4 当前适合少量短屏幕演示，不是通用视频平台。12 MiB/90 秒/每篇两段只约束单内容，不约束 Git 历史或全站传输；当前线上没有真实 MP4 文章，因此 production smoke 证明了模块与合成渲染，尚未证明真实文件的 Range、Content-Type 与 CDN 缓存。音频、字幕、poster、转码、多码率和外部托管继续关闭；开放任一项必须建立新契约。

33. 受限画廊已闭环可移植语法、Studio/Obsidian、附件事务、搜索、桌面/窄屏/打印和合成生产预览，但当前公开内容还没有真实画廊样本。现有证据证明共享渲染协议和两张真实仓库图片的浏览器布局，不证明一篇真实画廊文章的最终图片优化候选、CDN 缓存和所有者编辑体验。灯箱、轮播、手势、远程图库和 EXIF 继续关闭；单组/单篇上限也不替代全站媒体容量观察。

34. 受限技术表格已闭环可移植语法、严格行列一致、规模预算、Studio/Obsidian、搜索、桌面/窄屏/打印与共享生产预览，但当前公开内容还没有真实表格样本。现有证据证明 Data Ledger 结构、首列冻结、局部滚动和键盘焦点，不证明第一次在 Decap 嵌套 list 中编辑最大表格的效率，也不覆盖全部打印机驱动。排序、筛选、CSV、公式计算、合并单元格和远程数据源继续关闭；出现交互分析任务时应建立独立数据产品契约。

下一轮唯一主任务：建立受约束的只读任务清单。使用 Obsidian/GFM 兼容任务列表表达项目进度，冻结标题、完成/未完成状态、项目预算、Studio/Obsidian 作者入口、搜索、打印和无障碍语义；公开页只展示状态，不允许读者修改，也不引入客户端任务管理器。
