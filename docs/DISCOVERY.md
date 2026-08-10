# 搜索与发布发现

- 状态：RSS/Sitemap/robots implemented in iteration 0006；JSON Feed 1.1 implemented in iteration 0088；公开内容清单 implemented in iteration 0091；清单 JSON Schema implemented in iteration 0099；既有结构化端点条件读取 completed in iteration 0101；OpenSearch 1.1 discovery completed in iteration 0102；可解释搜索命中证据 completed in iteration 0103；可解释继续阅读 completed in iteration 0104；详情页结构化面包屑 completed in iteration 0105；首页站点身份 completed in iteration 0106；文章/项目内容身份图 completed in iteration 0107；完整内容结构化数据纯生成边界 completed in iteration 0108
- 目标：让公开内容可搜索、可订阅、可被搜索引擎发现，同时保持 Git 内容源和无数据库架构。

## 站内搜索

`lib/search-index.ts` 在服务端把所有公开文章、TIL 与项目转换为可序列化文档。Markdown 标题、链接、强调和 fenced code 标记会被清理，但可搜索的文字、代码、公式源码和图片替代文本保留；Markdown 解析器不会进入客户端 bundle。

查询先经过 Unicode NFKC 与 `zh-CN` 小写规范化，空格分隔的多个词使用 AND 语义。排序权重依次偏向标题、标签、摘要和正文；同分时按发布日期与标题稳定排序。空查询返回全部公开内容，未知查询返回明确的空状态，排名契约没有因高亮而改变。

搜索页通过 `?q=` 接收初始查询并服务端输出首屏结果。后续输入在浏览器本地匹配，同时用 `history.replaceState` 更新可分享 URL，不产生网络搜索请求，也不使用分析服务。

每条查询结果同时给出字段原因、摘要/正文来源与真实命中片段。摘要和正文比较覆盖的不同查询词数量，覆盖更多者成为上下文；正文片段围绕首个规范化命中截取。高亮先在规范化文本定位，再映射回 grapheme 边界，因而全角大小写、组合重音和兼容字符仍显示作者原文。重叠范围合并后由 React 文本节点与原生 `<mark>` 渲染，不使用 `dangerouslySetInnerHTML`。trace 背景、signal 底线、字段文字和来源标签共同表达证据；深浅色命中文字对比达到 AA，搜索输入保留明确 `:focus-visible`。

## 详情页继续阅读

文章与项目详情在服务端从同一公开内容集合、专题、标签及经过目标/fragment 校验的正文关系派生最多 3 条建议。排序权重为双向引用 120、当前记录引用 80、引用当前记录 70、同专题 60、每个共同标签 15；同分按发布日期、中文标题和规范 URL 稳定决胜，自身与没有任何信号的记录排除。

页面不公开难以解释的总分，而是逐条显示实际命中的关系、专题和共同标签理由。推荐映射在内容索引加载时缓存，详情页以 Server Component 输出，既不把全库索引再发给浏览器，也不增加数据库、分析服务、客户端请求或新的 frontmatter 字段。原始 Reference ledger 与推荐承担不同职责：前者完整列出可审计图边，后者综合已有事实给出有限的下一跳。

## 详情页结构化面包屑

文章、项目、专题和标签详情统一输出“首页 → 对应集合 → 当前真实标题”。同一 `{ name, href }` 数组既渲染可见 `<nav aria-label="面包屑">`，也生成 Schema.org `BreadcrumbList`；每个 `ListItem` 都有从 1 开始的稳定 `position`、可见同名 `name` 与当前请求 origin 下的绝对 `item` URL。

生成器拒绝少于两级、空名称、外部或协议相对地址、查询、fragment 和重复 URL。页面先完成公开记录查找，未知 slug 直接进入 `notFound()`，所以 404 不会携带一份看似有效的机器路径。实现使用原生服务端 `<script type="application/ld+json">` 并复用既有 `<` 转义边界，不增加客户端代码、数据库、分析服务或内容字段。

## 首页站点身份

域名根首页输出唯一 Schema.org `WebSite`，字段固定为 `@id`、`name`、`url`、`description` 与 `inLanguage`。名称、描述和语言分别复用 `SITE_TITLE`、`SITE_DESCRIPTION`、`SITE_LANGUAGE`；`url` 使用当前可信请求 origin 的规范根地址，`@id` 稳定为 `<root>#website`。页面继续使用 Next Server Component 和原生 JSON-LD script，不增加客户端 JavaScript。

Google 站点名称契约要求 `WebSite` 只位于域名或子域名首页，内部集合、详情、搜索、地图和关于页因此都必须为零。当前没有经过确认的简称，也没有需要远程执行的搜索 API，所以不输出 `alternateName` 或 `SearchAction`。站点名称不受 Google Rich Results Test 支持；自动门验证 Schema 与真实 HTML，人工抽查应使用 Schema Markup Validator，最终搜索展示仍由搜索引擎决定。

文章 `BlogPosting` 与项目 `SoftwareSourceCode` 使用各自同 origin canonical 加 `#content` 作为稳定 `@id`，并通过只含 `@id` 的 `isPartOf` 节点引用 `<root>#website`。W3C JSON-LD 1.1 允许只含 `@id` 的 node reference；Schema.org 将 `isPartOf` 定义在 `CreativeWork` 上，适用于这两类内容。完整文档由 `lib/content/structured-data.ts` 的两个类型收窄纯函数生成：身份、语言和作者只有一个复用边界，tags/stack 与 URL 不保留调用方可变引用，可选图片/仓库在 JSON 序列化时省略。详情页不再内联字段映射；内部页不复制完整 `WebSite`，404 不输出内容节点，已有标题、日期、URL、图片、作者、代码仓库和语言字段保持不变。

## OpenSearch 1.1

- URL：`/opensearch.xml`
- MIME：`application/opensearchdescription+xml; charset=utf-8`
- 查询模板：同一生产 origin 下的 `/search?q={searchTerms}`
- 描述：唯一 `ShortName`、唯一 `Description`、HTML results URL、同源 self URL、示例查询、`zh-CN` 与 UTF-8 输入/输出编码
- 发现：根布局在首页和搜索结果等页面输出绝对地址的 `rel="search"`；原有 favicon 同时显式保留
- 响应：安全内联文件名、`X-Robots-Tag: noindex`；描述端点不进入 Sitemap
- 缓存：1 小时 fresh、24 小时 stale-while-revalidate；最终 XML 的 SHA-256 ETag；`If-None-Match` 命中返回空 304

OpenSearch 只描述现有无数据库搜索能力，不建立新的搜索后端或公开内部索引。查询仍在 `/search` 服务端输出首屏、浏览器本地继续筛选；描述中的 `{searchTerms}` 是标准占位符，origin 由站点公开 URL 解析，不能指向第三方。测试同时锁定 XML namespace、唯一必填元素、同源 template/self、HTML 自动发现、MIME、缓存、验证器与 Sitemap 排除。

## RSS

- URL：`/rss.xml`
- 格式：RSS 2.0 + Atom self link
- 内容：全部公开文章、TIL 与项目
- GUID：内容稳定绝对 URL
- 日期：`publishedAt`，频道更新时间取最新 `updatedAt` 或 `publishedAt`
- 缓存：源响应声明 1 小时 fresh、24 小时 stale-while-revalidate；Vercel CDN 会消费 SWR 指令，客户端线上响应因此只保留等价的 `public, max-age=3600`

RSS 对 XML 特殊字符统一转义，并从公开内容字段生成标题、摘要、分类和链接。根布局同时输出 RSS autodiscovery `<link>`。

## JSON Feed 1.1

- URL：`/feed.json`
- MIME：`application/feed+json; charset=utf-8`
- 内容：与 RSS 相同顺序的全部公开文章、TIL 与项目
- `id` / `url`：内容稳定绝对 URL
- 正文：复用搜索使用的 Markdown AST 纯文本管线，移除语法和 raw HTML 标签，保留可见文字、代码、公式源码与图片替代文本
- 日期：`publishedAt` / 可选 `updatedAt` 确定性映射到 UTC 零点 RFC 3339
- 媒体：站点 256×256 icon；有本地 cover 的 item 输出绝对 `banner_image`
- 缓存：1 小时 fresh，24 小时 stale-while-revalidate

Feed 顶层声明 JSON Feed 1.1 `version`、站点标题/说明、`home_page_url`、`feed_url`、`language: zh-CN` 和作者。item 只暴露公开阅读字段，不包含 `draft`、源文件路径或原始 Markdown body；若 Markdown 没有可见纯文本，使用公开摘要兜底。生成器、HTTP 和生产冒烟都要求 JSON Feed 与 RSS 的稳定内容 URL 顺序完全一致。根布局使用独立 `application/feed+json` alternate link 供订阅器发现，RSS 链接保持兼容。

### Feed、Sitemap 与 robots 条件读取

`/feed.json`、`/rss.xml`、`/sitemap.xml` 与 `/robots.txt` 都以最终发送的 UTF-8 正文计算强 SHA-256 ETag。共享响应助手按 GET 弱比较语义处理精确标签、`W/`、逗号列表与 `*`；命中时返回正文为空的 304，并保留 ETag、原 MIME 与原 Cache-Control。错值或畸形条件头继续返回完整 200。该能力不改变正文、公开内容集合和已有 TTL，也不为 robots 人工制造日期事实；Vercel 若因压缩表示把标签弱化，生产验证只要求 opaque SHA-256 身份保持一致。

## 公开内容清单

- URL：`/content.json`
- MIME：`application/json; charset=utf-8`
- 版本：整数 `1`
- 内容：与 JSON Feed/RSS 同序的全部公开文章、TIL 与项目，不含正文
- 地址：同一请求 origin 下的 `html_url` 与相邻 `markdown_url`
- 验证器：每项 `markdown_etag` 等于对应最终 Markdown 的源站强 SHA-256；清单自身也有最终 JSON 字节 ETag
- 日期：每项发布日、可选更新日、复核日；响应 Last-Modified 取全部公开日期事实的最新日
- 缓存：浏览器立即复核、CDN 一小时 fresh/一天 SWR；`If-None-Match` 命中返回空 304
- 隐私：不输出正文、摘要、canonical、草稿、featured、slug、源文件路径或派生统计
- 发现：根 HTML 声明 `application/json` alternate；清单端点自身不进入 Sitemap
- Schema：清单响应以 `rel="describedby"` 指向同源 `/content.schema.json`

清单不是第三个正文 Feed。JSON Feed 面向订阅读者并携带纯文本，`content.json` 面向同步器并携带地址与摘要验证器，单篇 `source.md` 才携带 Markdown 结构。三者从同一公开 getter 和稳定顺序派生；应用测试与生产冒烟逐项请求清单中的源文，要求响应 ETag 与 `markdown_etag` 在强/弱形式归一化后具有相同 opaque digest。

本地 `content:production` 检查器把这个清单作为唯一生产事实：为相同 origin 从正式 Git 内容生成期望文档，在严格验证响应协议后按 id、`markdown_etag` 与其余公开字段输出 deployed/pending/missing/unexpected。传输失败与 schema 漂移不会生成内容状态；命令只读且有意不进入默认构建或 Actions。

### 清单 JSON Schema

- URL：`/content.schema.json`
- Dialect：JSON Schema Draft 2020-12
- MIME：`application/schema+json; charset=utf-8`
- 标识：`$id` 使用当前请求 origin；Schema 响应以 `rel="describes"` 指回同源 `/content.json`
- 验证范围：顶层与 item 字段白名单、version/language/origin 常量、路由和 token 形状、标签唯一性、post/project kind-type 组合
- 缓存：与清单相同的分层缓存和 SHA-256 ETag；`If-None-Match` 命中为空 304；`noindex`

Schema 让 Obsidian 插件、脚本与其他客户端无需导入本站 TypeScript 就能先做结构验证。本地契约测试用 Ajv 2020 校验真实清单并覆盖未知字段、必填缺失、kind/type 错配、跨 origin URL、坏 ETag/日期和重复标签等反例。`id === html_url`、Markdown URL 派生、条目 id 唯一、稳定排序和真实日历日期属于关系语义，继续由生产清单解析器失败关闭，不能因为通过通用 Schema 就放宽。

`content:production:wait -- --source <正式 Markdown>` 在同一协议上增加单篇有界收敛。它冻结来源 SHA-256 与目标 `markdown_etag`，首次读取完整清单，随后携带已验证响应 ETag 进行条件 GET；严格 304 复用上一快照，修改响应则重新验证全部清单后再比较目标。只有该 id 与冻结公开记录完全一致才结束为 deployed；pending/missing 继续到总时限，生产多出、来源漂移或协议错误立即失败。作者可以手动运行；Obsidian 1.41.0 也能在可信正常交付或 sealed recovery delivery 的 Git handoff、可能存在的作者事务释放和 Vault reconcile 后自动启动同一只读等待器。它仍不是部署器、Webhook 或默认 CI 门，失败不得反向触发 Git。

## 结构化发现传输预算

`/content.json`、`/content.schema.json`、`/feed.json`、`/rss.xml`、`/sitemap.xml`、`/robots.txt` 与 `/opensearch.xml` 共用独立的确定性传输预算。Iteration 0102 以稳定生产提交 `e5bb2a8` 在 2026-08-10 的完整响应为基线；按固定顺序记录 raw UTF-8 与 Node zlib gzip 字节。raw 上限为 `baseline + max(50%, 4096 B)` 后按 1 KiB 取整，gzip 上限为 `baseline + max(50%, 1024 B)` 后按 512 B 取整。

预算检查不依赖 CDN 是否实际协商 gzip/Brotli；它用同一响应正文生成可复现的传输代理。本地真实 Next 测试使用较短的固定测试 origin，生产冒烟使用实际传入 origin，因此两者共享上限但各自报告真实字节。七个端点必须恰好覆盖一次，漏测、重复、意外端点、raw 超限或 gzip 超限都会失败。稳定生产基线依次为 3009/921、3278/755、20697/9876、3238/1241、4527/504、155/127、700/462 B（raw/gzip）。基线只能在确认增长属于有价值的内容/协议变化、重新测量真实生产并记录来源提交后更新；不能为了让门变绿自动读取当前输出重置自己。

## 单篇 Markdown 源文

- URL：文章 `/posts/<slug>/source.md`，项目 `/projects/<slug>/source.md`
- MIME：`text/markdown; charset=utf-8`
- 发现：每个详情页 metadata 输出 `text/markdown` alternate，并在 Share Trace 中保留无需 JavaScript 的 `Portable source / VIEW .MD →` 链接
- 内容：公开字段 allowlist 的 YAML frontmatter + 保留结构的 Markdown 正文
- 可移植性：canonical、站内页面、当前页 fragment 与本地媒体使用当前请求 origin 的绝对 URL；外链和代码保持原样
- 响应：安全 ASCII 文件名、指向 HTML 页的 canonical `Link`、`X-Robots-Tag: noindex`
- 缓存：浏览器立即复核，CDN 一小时 fresh、24 小时 stale-while-revalidate；Vercel 消费 CDN 指令后，客户端可只看到 `public, max-age=0`
- 验证器：最终 UTF-8 表示的 SHA-256 源站强 ETag；Last-Modified 为最新公开日期事实的 UTC 零点；Vercel 可为 Brotli 表示增加 `W/` 而不改变 opaque digest
- 条件读取：`If-None-Match` 支持精确/弱标签、列表与 `*`，命中返回空 304；源站保留共享头，边缘可按 HTTP 语义只转发 ETag、Cache-Control 等缓存更新元数据

源文是公开阅读投影，不是 Git 作者原稿下载。它不包含 `draft`、`featured`、slug/sourcePath、统计派生字段或未公开记录；未知、草稿和未来内容统一返回 plain-text 404、`no-store` 与 `noindex`。公开内容清单负责批量发现和变更判断，JSON Feed 提供聚合纯文本，单篇源文提供 Markdown 结构，三者用途不同。

## Sitemap

- URL：`/sitemap.xml`
- 包含：首页、文章、项目、专题、标签、搜索、关于、全部详情与派生索引页
- `lastmod`：内容使用 `updatedAt` 或 `publishedAt`；集合使用其最新公开内容日期
- 缓存：1 小时 fresh，24 小时 stale-while-revalidate
- 验证器：最终 XML 字节的 SHA-256 ETag；条件命中返回空 304

当前公开内容生成 24 个 URL。Sitemap 不包含草稿、未来日期、查询参数或 JSON Feed/RSS/robots 端点本身。

## Robots

`/robots.txt` 允许抓取公开内容，声明当前请求主机和绝对 Sitemap URL，缓存 24 小时，并以最终文本字节生成 SHA-256 ETag；条件命中返回空 304。`/studio` 与 `/api/cms/` 是作者发布工具而不是阅读内容，显式 `Disallow` 且不进入 Sitemap；访问控制仍由 GitHub OAuth 和仓库权限负责，robots 不被当作安全边界。

## 绝对 URL

页面元数据与四个发布端点共用 `lib/site.ts`。解析优先级为：

1. 托管环境显式设置的 `NEXT_PUBLIC_SITE_URL`；
2. Vercel/反向代理提供的首个 `x-forwarded-host` 与 `x-forwarded-proto`；
3. 请求 URL 或本地 `http://localhost:3000` 回退。

因此本地、预览域名和正式域名不需要维护多份 Feed 或 Sitemap 配置。
