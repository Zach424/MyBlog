# 质量标准

## 完整质量门

```bash
npm run check
```

顺序为 ESLint → 524 项内容/时间档案/内容活动/订阅目录/维护/inbox/暂存媒体/关系/推荐/站点身份/公开路由事实/首页内容证据/About 系统档案/项目状态与内容日期展示/面包屑/标题锚点与永久链接/脚注/数学公式/打印版式/知识图/外链库存与检查/搜索/OpenSearch/公开清单/发现端点验证器与预算/公开 Markdown/OAuth/Studio/Obsidian/媒体/重定向/代码复制/交付单元测试 → Next 路由类型生成与 TypeScript → 原生 Next.js 生产构建（52 个页面，并包含动态 Route Handler）→ 30 项真实生产 HTTP 与质量审计。任何一步失败都阻止合并和生产部署。

公开路由事实质量门不把 `27` 复制成两个独立断言：纯函数夹具锁定静态/动态顺序、total、最新日期、输入不变和重复 path 失败关闭；真实 Next 测试并行请求首页与 Sitemap，从实际 `<loc>` 数量派生首页期望文字，并要求首页 `LATEST` 等于 Sitemap 根 URL 的 `lastmod`。测试同时拒绝遗留 `REV. <数字>`。这样内容增长会自动改变两端，任一消费者脱离共享事实才失败。

首页内容证据纯函数测试精确比较精选项目的标题、状态/技术栈摘要，最新文章的标题、类型/日期/标签摘要，以及 Current focus；空项目、空文章和全空集合不得产生虚构内容，公开路由数必须是非负整数。SSR 还要求最终 HTML 出现真实内容并拒绝三条旧手写状态；390×844 深色浏览器验证长中文标题完整换行、单一 H1 与零横向溢出，首页继续受 raw/gzip 预算约束。

About 系统档案纯函数测试精确比较四类集合计数、记录/路由 meta、最新日期、精选项目链接、共享中文状态和完整 stack；所有计数必须是非负整数，空集合必须显示零记录、静态公开路由和等待项目，不能发明日期或技术栈。SSR 锁定真实 `4 RECORDS / 27 ROUTES / UPDATED 2026-08-06`、五项 stack，并拒绝旧的手写技术基线句；390×844 深色浏览器验证单一 H1、零横向溢出、长标题和标签换行，`/about` 继续受既有 raw/gzip 预算约束。

项目 status presenter 测试枚举 planning/building/maintained/archived，逐项锁定中文 label、大写 code 和统一 meta。SSR 并行请求首页、`/projects` 和 `/projects/myblog`，三处都必须出现 `持续维护 · MAINTAINED`，并分别拒绝旧 `Maintained`、孤立 `MAINTAINED` 和 `Project / maintained`。390×844 深色浏览器逐页验证文本、一个 H1、零横向溢出和 console 0 errors；原始 enum 仍由公开 Markdown、清单、Schema 和 Studio 既有测试保护。

内容日期 presenter 测试覆盖晚于首发的更新、无 `updatedAt`、同日 `updatedAt` 和输入不变。SSR 要求 `/posts`、`/projects`、专题、标签和项目引用账本都输出带真实 `dateTime` 的 UPDATED 元数据；`/archive` 必须没有 `.content-index-date`，并继续输出“发布日期”与首发日。390×844 深色浏览器检查项目/文章三层元数据、一个 H1、零横向溢出；archive 浏览器断言共享日期组件为 0。所有受影响路由继续受既有 raw/gzip 预算约束。

搜索与知识图日期扩展还必须证明“携带更新日”和“保持首发排序”同时成立：纯函数夹具把首发较早但更新较晚的记录与首发较新的记录并置，要求派生对象保留 `updatedAt`，顺序仍由 `publishedAt` 决定；SSR 要求搜索结果、SVG 节点和孤立记录显示 UPDATED 与真实日期，空查询出现“按首发时间”和四个“首发顺序”，archive 继续隔离。Playwright 分别在 390×844 深色搜索/移动图谱和 1280px 深色 SVG 检查日期、单一 H1、断点行为、根宽与 console；搜索和知识图继续受十三路 HTML 预算约束。

内容活动纯函数测试必须覆盖发布加后续更新、同日更新不形成事件、同日 UPDATED 先于 PUBLISHED、标题/URL 决胜、输入不变和空集合。SSR 与生产 smoke 要求当前公开内容形成八个事件、五个日期组、四个发布、四个更新、零复核事件，并验证 canonical、真实 `<time>`、链接、archive 入口与 Sitemap。Playwright 在 390×844 和 1280×900 深色模式检查节点语义、首项日期、单一 H1、零横向溢出和 0 console errors；活动页必须进入第十三条 HTML raw/gzip 预算。

首页最近活动必须先以失败优先 SSR 断言证明旧首页不存在该区域，再要求最终 HTML 出现唯一 `data-home-activity="latest-three"`、恰好三个事件、当前三项全为 UPDATED，且标题与日期严格按活动模型顺序排列；“完整活动账本”必须是指向 `/activity` 的原生链接，reviewed 不得出现。生产 smoke 使用相同稳定语义属性而非 CSS Module 哈希类名复核可见片段。Playwright 在 390×844 与 1280×900 分别检查纵向/横向轨道、三项内容、根宽和 0 console errors；CSS preload warning 可记录但不能掩盖 MIME、404 或样式加载错误。活动页样式迁移后仍要保持五日、八事件和 4/4 模式不变。

发布候选额外执行：

```bash
npm run release:check
```

它会先输出 Current record 维护状态、当前作者工作区的 inbox 发布就绪状态、根暂存媒体库存和零网络外链库存，再校验 Vercel 冒烟/回滚配置并执行 production-only `npm audit`。不使用会强制改变主版本的 `npm audit fix --force`。

## 内容维护质量门

```bash
npm run content:status
npm run content:status -- --date 2027-01-01 --format json
```

- `healthy`：剩余 61 天以上；
- `review-soon`：剩余 31–60 天，Actions warning；
- `due-soon`：剩余 0–30 天，Actions warning；
- `overdue`：已越过第 180 天，命令返回 1，后续构建也会失败。

Quality Gate 在 PR、`main`、手动触发和每周一 01:00 UTC 自动运行。报告写入 `GITHUB_STEP_SUMMARY`，并把预警绑定到对应 Markdown 源文件。固定 `--date` 用于边界测试，正常维护不应伪造日期。

## 根暂存媒体报告

```bash
npm run media:staging
npm run media:staging -- --date 2026-08-05 --stale-days 30 --format json
```

报告只扫描 `public/uploads` 根文件，并以 Obsidian 发布器的同一解析规则读取 inbox 草稿中的 Wiki 图片、Markdown 图片和 cover。测试锁定单草稿引用、多草稿共享、未引用、缺失引用、代码示例忽略、无效草稿、Git/文件系统双年龄证据、固定 JSON、GitHub summary/annotation 和零删除行为。默认 30 天标为陈旧；warning 不阻断质量门，扫描错误才返回非零。Quality Gate 在内容维护报告之后运行它，因此每次 push/PR 和每周任务都有同一库存证据。

## Inbox 发布就绪报告

```bash
npm run content:inbox
npm run content:inbox -- --date 2026-08-05 --format json
```

测试覆盖 ready/scheduled 日期边界、文章/项目推断、真实 PNG→WebP 候选、无效草稿隔离、正式目标冲突、缺失/已跟踪/共享附件、结构化阻塞原因、空 inbox、无效日期、真实 CLI JSON，以及运行前后草稿/附件逐字节不变且没有正式目标或归档目录产生。Obsidian 插件契约还锁定桌面专用、参数数组、`shell: false`、纯文本 Modal 和版本 1.1.0。blocked 是作者诊断而非仓库失败；扫描或媒体处理基础设施错误才返回非零。该报告进入本地 `release:check`，不进入 Actions，因为 CI 无法看到作者未跟踪草稿。

## 外部 HTTPS 链接报告

```bash
npm run links:external
npm run links:external -- --format json
npm run links:external -- --check --timeout-ms 5000 --concurrency 4 --retries 1
```

默认命令从公开正文 GFM AST 与 canonical/repository/demo 生成统一确定性库存，不访问网络；每个 occurrence 标明 body 或具体 frontmatter 字段，相同规范 URL 跨来源聚合。它进入本地 `release:check` 但发现 issue 仍只报告。显式 `--check` 才按唯一 URL 发送 HEAD，支持 `--fail-on-broken` 作者硬判定。测试覆盖结构化字段、`demo: null`、跨正文聚合、行内/引用式/GFM 裸链接、重复与确定排序、图片/代码/站内忽略、HTTP/协议相对/无效/凭据隐藏、IPv4/IPv6 私网和保留地址、混合 DNS fail-closed、HTTPS/443/凭据边界、重定向/降级/跳数、401/403/404/405/5xx、超时、网络错误、重试、资源参数和真实零写入 CLI。

检查器在每个 URL 和重定向目标请求前解析全部 DNS；任一非公网结果即拒绝，并把实际 TLS 连接固定到已验证地址。响应头到达后立即关闭，不读取或保存第三方正文。`restricted`、`method-unsupported`、5xx、timeout 和 network-error 是暂不可确认，不冒充链接失效；broken 只包含确定缺失/客户端错误、不安全或坏重定向。本轮不把实时检查接入 Actions：CI 网络、限流和 DNS 路径不是内容正确性的稳定事实，后续只有积累足够误报数据后再评估定期软报告。

## 生产冒烟

```bash
npm run production:smoke -- https://example.vercel.app --expect-oauth
```

时间档案必须返回 200、具有 `/archive` canonical，并从同一公开集合渲染 Article、TIL 与 Project；Sitemap 必须包含该路由，主导航与继续发现链接必须可达。纯分组测试锁定年/月倒序、同日标题/URL 决胜、不改写输入和空集合；真实 SSR 与生产冒烟还要验证原生日期、类型和条目数量，不能用 RSC 序列化载荷冒充可见账本。

订阅目录必须返回 200、具有 `/subscribe` canonical，并在可见 HTML 中恰好渲染 RSS、JSON Feed、OpenSearch、清单/Schema 与 Markdown 五条只读通道；页脚、Sitemap 和全部原生端点链接必须可达。纯目录测试锁定通道顺序、MIME/路径、清单双链接、最新 Markdown 的日期/标题/URL 决胜、输入不变和空集合说明；真实 SSR、生产 smoke 与 390px 浏览器还要验证页内真实链接、只读边界、无横向溢出和零 console error。

检查代表内容、时间档案、内容活动、订阅目录、搜索、Studio HTML/配置/媒体清单/媒体预检/稳定 slug 控件/公式预览模块/版本化 KaTeX CSS/同源 CMS 运行时、OAuth、OpenSearch、公开内容清单及 Schema、JSON Feed、RSS、robots、全 Sitemap、永久重定向、安全头、缓存与固定 404。OpenSearch 必须具有 1.1 namespace、唯一 ShortName/Description、同源 results/self URL、安全 `{searchTerms}` 模板、示例查询、语言/编码、准确 MIME、`noindex`、最终正文 SHA-256 ETag 与空 304；首页和搜索结果页必须声明绝对 `rel="search"`，端点不能进入 Sitemap。公开内容清单必须由根 HTML 发现，使用 version 1、同 origin 绝对 HTML/Markdown URL、字段白名单、稳定顺序和与全部真实源文相同的 SHA-256 digest；清单自身 ETag、Last-Modified、空 304、`noindex` 与 Vercel 等价缓存必须成立，并与 JSON Feed/RSS 保持同一公开 id 顺序。Schema 必须使用 Draft 2020-12 和 `application/schema+json`，具有同源 `$id`、严格字段结构、与清单双向 registered Link relation、SHA-256 ETag、空 304、`noindex` 与等价缓存；Ajv 2020 还要验证真实清单并拒绝结构反例。JSON Feed 必须使用 1.1 version 和 `application/feed+json`，顶层 origin、作者、语言、icon 正确，item 必须有唯一同值 id/url、纯文本正文、RFC 3339 发布日期且不泄漏内部字段。JSON Feed、RSS、Sitemap、robots 和 OpenSearch 还必须证明 ETag 等于各自最终正文 SHA-256，并用源响应标签完成同 digest、同缓存策略、零正文的 304；两个 Feed 另需证明规范 Last-Modified、日期命中 304、旧/非法日期 200 和 ETag 优先级，本地接受三种 HTTP-date，生产允许边缘 304 省略可选表示元数据。缓存验证接受源响应的一小时 fresh/一天 SWR，以及 Vercel CDN 消费 SWR 后的等价一小时策略，robots 则必须保持明确的一天 public fresh。错误 TTL、`private` 或 `no-store` 仍失败关闭。十三条关键 HTML 路由和七个结构化发现端点还必须在实际传入的生产域名下逐条输出 raw/gzip 实测、阈值、基线和带正负号的余量；缺失、重复、意外端点或超限都失败关闭。线上公式 POST 必须返回两条公式、KaTeX、MathML 与生产管线标记，CSS 必须内联 WOFF2 且不残留 package 相对字体路径。媒体清单必须是 `version: 1`、根为 `public/uploads`，每项包含安全路径、正整数节数与 64 位 SHA-256，并保持 `no-store`。永久重定向检查要求 `/blog` 返回 308、同源 `Location` 直达 `/posts`，且目标只需一次请求即返回 200。`--expect-oauth` 只用于已配置 GitHub OAuth 的生产环境；本地和 Preview 允许 OAuth 以 503 安全关闭。

搜索质量必须覆盖全角/大小写 NFKC、组合重音、兼容字符、多词 AND、摘要/正文证据选择、重叠分段、原文重组和空查询。真实 Next 与生产 smoke 不能只在 RSC 序列化载荷中找到文档标题：Cloudflare 查询必须出现真实 `<mark>`、来源和字段原因，Wrangler 必须是 1 条“正文”证据，B_i 必须是 0 条且没有 mark。组件源码不得使用 `dangerouslySetInnerHTML`；浅深色 ink/trace 对比必须达到 4.5:1，320px 不得横向溢出，搜索输入必须有选择器优先级足够的 `:focus-visible` 轮廓。

继续阅读质量必须锁定 120/80/70/60/15 的引用、反向引用、专题与标签权重，拒绝自身和零信号记录，最多返回 3 条，并证明同分结果不受输入顺序影响。文章与项目详情只能在服务端输出推荐，不得增加客户端组件或全库数据请求；真实页面分别验证 2/3 条链接和实际可见理由，不能用 RSC 序列化字符串冒充链接。`≤55rem` 必须单列、320px 不得横向溢出，打印必须隐藏推荐区而保留正文与关系账本。

详情页面包屑质量必须覆盖文章、项目、专题和标签四类真实路由：每页恰有一个服务端 `BreadcrumbList`，至少两级，`position` 从 1 连续递增，`name` 与可见路径逐级相同，`item` 是当前 origin 下的绝对同源 URL。四类未知 slug 的 404 必须全部不含 `BreadcrumbList`；验证只读取真实 HTML 中的可见 `<nav>` 与 `application/ld+json` script，不能用 RSC 序列化载荷冒充页面语义。

首页站点身份质量必须证明域名根恰有一个服务端 `WebSite`，精确复用站点标题、描述、`zh-CN` 与当前 origin 的规范根 URL，并以 `<root>#website` 作为稳定 `@id`。集合、文章、项目、专题、标签、搜索、知识地图和关于页都必须为零；协议只允许 HTTP(S)、禁止凭据，且没有事实来源时不得生成 `alternateName`、`potentialAction` 或 `SearchAction`。测试只解析真实 HTML 的 JSON-LD script；站点名称不支持 Rich Results Test，语法抽查使用 Schema Markup Validator。

内容身份质量必须证明代表文章与项目各有且只有一个对应类型文档，`@id` 为精确 canonical 加 `#content`，`url`、文章 `mainEntityOfPage`、`inLanguage` 与既有字段不漂移，`isPartOf` 必须严格等于 `{ "@id": "<root>#website" }`。身份生成器还要拒绝跨 origin、首页路径、查询/fragment 与凭据，并保证输入 URL 不变；完整文档生成器必须精确比较全部对象和序列化属性顺序、复制 tags/stack、克隆 URL，并证明可选图片/仓库在对象中为 `undefined`、在 JSON 中被省略。文章还必须逐值复用正整数 `wordCount`，把同一 `readingMinutes` 映射为 `PT<n>M`；代表文章固定为 899/`PT4M`，项目必须无这两个字段。页面源码不得重新内联 `@context`、作者、语言或身份构造；文章/项目未知 slug 的 404 不得泄漏任一内容类型。相同语义断言分布于纯函数、源码边界、真实 Next SSR、浏览器 DOM 与生产烟测。

## 永久重定向质量门

构建从 `content/redirects.yml` 读取严格 YAML 与 Zod schema，未知字段、重复键、弱原因、未来加入日期都会失败。测试还覆盖路径编码/大小写/尾斜杠、当前路由或静态文件遮蔽、受保护命名空间、缺失/草稿/未来目标、重复、自跳转、链与环路。真实 Next 进程验证 308 和查询参数透传，生产冒烟验证同源单跳目标，防止只在纯函数层面正确而部署行为漂移。

## 内容质量

- frontmatter 必须通过严格 Zod schema，未知字段报错；
- 文件名/slug 为稳定小写 ASCII，不能与 URL 漂移；
- 标签来自注册表，专题顺序连续；
- 草稿和未来内容不会进入任何公开索引；
- 内容可见日期在 `Asia/Shanghai` 构建期冻结；
- 所有内容声明 Current/Historical 语境与复核日期；Current record 超过 180 天未复核时构建失败；
- 复核日期不早于发布/更新日期，公开内容不能使用未来复核日期；
- Markdown 标题锚点、目录、GFM 和代码高亮保持一致；H1–H6 共用全局 GitHubSlugger 序号；
- 公开站内页面链接必须存在；带 fragment 的行内、引用式、跨内容或自引用链接必须严格命中目标实际 heading id，无效百分号编码、拼写和重复标题序号会失败；

## HTML 与可访问性

- 每页一个 `<main>` 和 `<h1>`，`lang=zh-CN`；
- 页面具有 description、canonical、跳转主内容链接和唯一 id；
- 首页必须服务端输出唯一 `WebSite`，其 name/description/language 与现有站点常量和可见身份一致；内部页面不得继承该站点节点，结构化脚本不得改变视觉布局或引入客户端代码；
- 文章、项目、专题与标签详情必须从同一 `{ name, href }` 数组服务端输出可见面包屑与 `BreadcrumbList`；末级可见项使用真实标题及 `aria-current="page"`，窄屏上级路径保持可读、当前长标题自然换行且根页面不横向溢出；
- 文章/项目详情必须服务端输出无 JavaScript 可见的 canonical 与 Markdown 源文链接，并声明 `text/markdown` alternate；分享与复制控件只能渐进增强，不能成为唯一访问路径；
- 根 HTML 必须服务端声明 `/content.json` 的 `application/json` alternate；清单 version 1 的顶层和 item 字段顺序、公开 allowlist、同 Feed/RSS 顺序、同 origin URL 与逐项源文 ETag 必须稳定，内容/origin 变化要更新清单与对应标签；清单自身必须支持 SHA-256 ETag、Last-Modified、ETag/日期条件空 304、旧/坏日期 200、ETag 优先、分层缓存和 `noindex`，并以 `describedby` 指向 `/content.schema.json`；Schema 必须反向 `describes` 清单、使用当前 origin 的 `$id`、以 Ajv 2020 接受真实清单并拒绝代表性结构漂移，同时支持自身 SHA-256 ETag、空 304、分层缓存和 `noindex`；
- JSON Feed、RSS、Sitemap 与 robots 的强 ETag 必须等于最终响应正文 SHA-256；`If-None-Match` 的精确/弱值、列表与 `*` 命中必须返回保留原 ETag/MIME/缓存策略的空 304，错值与畸形列表返回完整 200；JSON Feed/RSS 的 Last-Modified 必须取各自表示修订时间和最新公开内容的最大值，发送端只用 IMF-fixdate，接收端兼容三种 HTTP-date，日期相等/更晚返回空 304，旧值、重复值、日历或星期错误返回完整 200，任何存在的 `If-None-Match` 都优先；RSS 还必须声明准确的 Dublin Core Terms 命名空间，逐项保持 `guid`、首发排序与 `pubDate`，仅对严格更晚的更新输出一个与 JSON Feed `date_modified` 相同的 `dcterms:modified`，并拒绝 item 级 `atom:updated`；前三者保留一小时 fresh/一天 SWR，robots 保留一天 public fresh；
- 公开 Markdown 源文必须验证字段 allowlist、正文结构、站内链接/媒体绝对化、外链/代码稳定、MIME、安全文件名、HTML canonical `Link`、`noindex` 和公开缓存；源站强 ETag 必须等于最终 UTF-8 字节的 SHA-256，内容/origin 变化必须换值，Last-Modified 使用最新公开日期的 UTC 零点；`If-None-Match` 精确/弱值、列表与 `*` 命中必须返回空 304，错值和畸形列表必须返回完整 200；不存在 ETag 条件时，同值日期返回空 304，旧/坏日期返回 200，陈旧 ETag 必须屏蔽日期命中。本地源站测试锁定完整 304 头，生产冒烟允许 Vercel 对 Brotli ETag 增加 `W/` 并省略 304 representation metadata，但必须保持相同 SHA-256 opaque tag、Cache-Control 和零正文，任何仍存在的 Last-Modified/canonical/noindex 不得漂移；草稿、未来内容与未知 slug 必须返回不缓存的 404；
- 七个结构化端点与文章/项目 `source.md` 必须在真实 Next 生产构建中证明 HEAD 200/304 零正文，并保持 GET 的 ETag、Last-Modified、MIME、缓存、文件名、Link/noindex；所有端点覆盖 ETag HEAD，带日期资源还覆盖 IMS 命中、旧/坏日期和 ETag 优先。稳定生产允许 304 精简可选表示元数据，但同一 opaque digest、缓存和零正文不可改变；未知源文 HEAD 必须是 `no-store` 404 且不得生成验证器；
- 所有可见内部导航目标返回成功；
- 有站内关系的文章/项目必须服务端渲染语义独立的 outgoing/backlinks 分组；两侧都为空时不渲染空账本；
- 文章/项目详情的继续阅读必须只使用公开记录与已验证关系，最多 3 条，逐条输出专题、标签或引用理由；自身、零信号记录与空推荐区不得渲染；
- `/knowledge` 必须从同一关系值服务端输出 SVG 节点/有向边、HTML 关系账本和孤立记录；节点为原生链接，不用 Canvas 或客户端脚本承担唯一语义；
- 文本设计 Token 达到 WCAG AA；
- 320px 不允许根布局强制最小宽度或横向溢出；知识地图在该宽度隐藏宽 SVG、显示完整关系账本；
- 焦点可见、Reduced Motion 和系统深色偏好保留。
- 未知 URL 必须返回真实 404、`no-store`、至少一个 `robots=noindex` 与单一 H1；可见页面恰有搜索、档案、文章、项目四条恢复路径，不得 meta refresh、客户端跳转、BreadcrumbList 或内容结构化身份。固定 `/definitely-missing` 同时进入 SSR、生产 smoke、响应式/打印和 HTML 预算。
- 本地 Markdown 正文图必须服务端输出 alt、真实宽高、正文栏 `sizes` 和 `srcSet`；Markdown 组件不能把 AST `node` 泄漏成 HTML 属性。
- Markdown H2/H3 必须服务端输出复用真实 id 的原生永久链接；中文与编码 fragment 命中同一 `:target`，H4 和页面结构标题不得获得控件；桌面 hover/focus/target、320px 与宽屏 `hover:none` 触控、无 JavaScript 和打印均需保持明确边界。
- 文章与项目详情必须服务端输出可信 canonical 打印来源；A4 print media 隐藏站点框架、目录、邻接和交互控件，保留标题、五列事实、正文、媒体、代码、表格和必要引用。测试锁定分页、代码换行、纸面 URL 与关系账本边界；发布候选还必须在真实 Chromium 中生成 PDF、渲染全部页面并目视复核，不以 DOM/CSS 断言代替纸面结果。
- Markdown 脚注必须服务端输出语义编号、中文脚注区标题和可返回每个引用位置的原生链接；中文 id、同一脚注多次引用、脚注内链接/代码、无 JavaScript、键盘名称、`:target`、深浅色、320px 和 A4 都要有契约。脚注标题不得进入目录或 permalink，作者标记不得进入搜索纯文本，脚注内真实站内链接仍须进入引用完整性与关系去重；打印必须隐藏回链但保留证据正文。
- Markdown 数学公式必须覆盖 Obsidian `$...$`/`$$...$$`、代码/货币边界、构建期无效公式行号、HTML + MathML + TeX annotation、标题 id、搜索源码、关系/图片伪引用排除和依赖安全选项。生产 HTML 不得增加公式客户端脚本；桌面、深色、320px、键盘横向滚动、无 JavaScript 与 A4 PDF 必须分别验收，根页面宽度不得被公式内容撑开。
- Studio 公式作者预览必须覆盖 posts/projects 幂等注册、普通正文零请求、240 ms 防抖、Abort/generation latest-wins、有效/无效/不可用状态、卸载清理与原 Markdown 回退。真实端点必须覆盖 200/422/400/403/413/415、100,000 B 上限、`no-store`/`noindex`、危险 URL 清空、KaTeX/MathML 与版本化内联字体；实际浏览器必须验证控件注册、console、深浅色、320px 根宽、公式独立滚动和键盘。

## 体积预算

| 资产 | 预算 |
| --- | --- |
| `.next/static` 客户端总量 | `< 3 MB` |
| 最大客户端 JavaScript | `< 300 KB` |
| 全局 CSS | `< 100 KB` |
| 单页服务端 HTML raw 紧急上限 | `≤ 160 KiB` |
| 十三条关键路由 gzip 传输模拟 | `生产基线 + max(20%, 2 KiB)`，再向上取整到 `1 KiB` |
| 七个结构化发现端点 raw | 各自 `生产基线 + max(50%, 4 KiB)`，再向上取整到 `1 KiB` |
| 七个结构化发现端点 gzip | 各自 `生产基线 + max(50%, 1 KiB)`，再向上取整到 `512 B` |

`scripts/html-budget.mjs` 保存稳定生产 origin、基线日期、来源提交及十三条路由的 raw/Node zlib gzip 基线。本地生产测试用该稳定 origin 作为 forwarded host，对完整响应执行 `Buffer.byteLength` 与 `gzipSync`；部署后的 `production:smoke` 再对实际输入域名执行同一模块，二者都输出实测、阈值、基线和余量。raw 160 KiB 只防止异常解压/文档膨胀；性能回归由按生产基线推导的 gzip 门判断，因此高度重复但可压缩的 100KB 以上页面不会被旧统一门误伤，高熵增长仍会失败。404 采用固定 `/definitely-missing`，避免随机路径本身进入 RSC 载荷后改变测量值。

Iteration 0119 以内容活动功能提交 `5fb508c` 的稳定生产响应在 2026-08-11 统一重测十三条基线：`/` 32195/6821、`/posts` 23165/5101、代表文章 57125/13190、代表项目 113705/25394、`/archive` 25184/5543、`/activity` 37888/6401、`/subscribe` 33680/6485、专题 22707/5113、标签 22560/5110、搜索 41251/14704、知识地图 40497/8011、关于页 21811/5105、固定 404 25370/4455 B（raw/gzip）。十三条 gzip 上限依次为 9216、7168、16384、30720、8192、9216、9216、7168、7168、18432、10240、7168、7168 B。来源提交、日期和完整路径清单由脚本与测试共同锁定；基线仍不能自动追随当前输出。

Iteration 0120 以首页最近活动功能提交 `c54535e` 的稳定生产响应再次统一重测十三条基线：`/` 38722/7641、`/posts` 23165/5100、代表文章 57125/13189、代表项目 113705/25391、`/archive` 25184/5542、`/activity` 41778/6507、`/subscribe` 33680/6483、专题 22707/5112、标签 22560/5110、搜索 41251/14701、知识地图 40497/8009、关于页 21811/5104、固定 404 25370/4451 B（raw/gzip）。预算提交 `67a127a` 只更新实测值、日期/来源断言与派生上限；首页 gzip 上限仍为 10240 B，活动页仍为 9216 B，其余上限按同一公式推导。活动专属规则迁入 CSS Module 后，全局 CSS 从 99,995 B 降至 95,383 B，保留 4,612 B 硬门余量；路由级 CSS 不通过扩大全局阈值获得豁免。

`scripts/discovery-budget.mjs` 独立保存七个结构化端点的 stable-origin raw/gzip 基线和逐端点推导上限。它同时约束 raw 与 gzip：可压缩的异常正文不能只靠 gzip 通过，高熵增长也不能只靠 raw 通过。本地应用测试与生产冒烟必须各自恰好覆盖清单、Schema、JSON Feed、RSS、Sitemap、robots、OpenSearch 一次，并输出 `[discovery-budget]` 报告；Iteration 0121 以 RSS 修改时间功能提交 `97eabce` 的稳定生产响应统一重测，依次为 3009/921、3278/755、20697/9876、3536/1298、5059/532、155/127、700/462 B（raw/gzip）。预算提交 `52d6a18` 只更新来源与实测值；七个推导上限依次仍为 7168/2048、8192/2048、31744/14848、8192/2560、9216/2048、5120/1536、5120/1536 B（raw/gzip）。

Iteration 0122 只改变 JSON Feed/RSS 响应头与条件分支，稳定生产正文、SHA-256 ETag 和 raw/gzip 实测逐字节保持 20697/9876、3536/1298 B；因此继续使用 `97eabce` 的七端点 body 基线，不创建自我放行式重测提交。功能提交 `237fd8d` 的 530 项单元、52 页构建、30 项应用测试和线上 smoke 单独证明响应头价值与边缘行为。

Iteration 0123 只把内容清单与单篇 Markdown 已存在的 Last-Modified 接入通用条件分支。功能提交 `3946c36` 通过 530 项单元、52 页构建、30 项应用测试和稳定生产 smoke；线上 27 routes、OAuth 302，清单、两篇代表源文的日期 304、旧/坏日期 200 和 ETag 优先均成立。正文、ETag、HTML 与七端点 raw/gzip 实测未变化，因此不更新冻结基线。

Iteration 0124 没有改运行时响应生成，而是把 Next/Vercel 的 HEAD 发送行为从隐式依赖提升为回归契约。失败优先部署测试先因 smoke 缺少 `method: "HEAD"` 以 5/6 失败；提交 `64ab9dd` 后为真实应用新增第 31 项测试，并让生产 smoke 覆盖九端点 HEAD 矩阵。完整证据为 530 项单元、52 页构建、31 项应用测试和线上 27 routes/OAuth 302；正文、ETag 与 raw/gzip 基线不变。

基线不是自动追随当前页面的自我放行值。只有在确认增长属于有价值的产品变化、真实生产重新测量且完整门通过后，才能同时更新数值、日期和来源提交；不得只为失败路由调高单个阈值。预算用于捕获意外回归，不代替真实网络与 Web Vitals；未来若接入观测服务，仍应以真实用户传输和渲染数据补充。

## 媒体预算

| 媒体属性 | 预算 |
| --- | --- |
| 实际格式 | PNG/JPEG/WebP/GIF/AVIF，且与扩展名一致 |
| 单文件 | `≤ 3 MiB` |
| 单帧宽、高 | 各 `≤ 2560 px` |
| 单帧像素 | `≤ 8,000,000` |
| 动图总像素 | `≤ 80,000,000` |

Obsidian 检查、正式发布和 Next 配置加载复用 `lib/media-policy.ts`；Studio 的独立浏览器模块用回归测试锁定同一扩展名与公开预算，并覆盖真实格式识别、浏览器解码、扩展名伪装、损坏文件、静态格式、GIF/WebP 帧计数、动画总像素、动画 AVIF fail-closed、事件拦截/重放和安装幂等清理。媒体冲突测试还锁定已发布 Decap bundle 的文件名转换调用，覆盖构建清单确定排序与真实仓库摘要、new/same/replace-confirmed、same-session/replace-session-confirmed、只检查不登记、成功重放后提交、取消后保留旧基线、确认后更新、重放异常不提交、空 slug、清单 HTTP 故障和全局媒体库降级。竞态测试用 deferred promise 覆盖旧成功晚到、旧失败晚到、manifest 后过期、确认期间变旧和正常最新选择，断言旧代次不确认、不报告最终状态、不重放、不提交，也不清空当前 input。Obsidian 静态 PNG/JPEG/WebP 可先进入 25 MiB、8192 px、4000 万像素的原图安全包络，再自动校正方向、缩放并以固定参数生成 WebP；产物必须重新通过上表。Studio 不重编码，通过后向 Decap 透传原始 `File`。GIF、AVIF、动画 WebP 与已经更高效的 WebP 保持原字节。构建递归检查 `public/uploads`，符号链接、普通非图片、损坏文件和伪装扩展名均失败。测试还覆盖确定性字节、格式碰撞、真实 CLI 预览/发布和多附件逐字节回滚；响应式候选由 Next.js 在请求时派生，不作为新的 Git 资产保存。

`lib/content/media-references.ts` 使用标准 Markdown AST 抽取行内/引用式图片并忽略代码，`build/validate-media-references.ts` 在每次 Next 配置加载时交叉检查正式 posts/projects 与精确媒体文件清单。测试覆盖安全 URL、缺失/大小写错误、根暂存引用拒绝、跨 slug 所有权、代码伪引用、归档孤儿、cover 和 draft/future 所有权；没有被正式内容引用的根目录 inbox 暂存文件仍获豁免。正文图片 alt 为空时在对应行失败；本地 URL 去重后读取固有尺寸，生产 HTML 证明 `sizes`/`srcSet`/宽高同时存在。外部 HTTPS 图片不占用本地所有权，使用受 CSP 允许但不经 Next 优化器的明确降级；其他协议或相对图片路径失败。

Studio slug 测试覆盖新建、复制、已有条目、缺省兼容、Windows/Unix path 身份回退、字段漂移、readOnly/ARIA/可复制语义、编辑事件、默认预览、注册幂等和浏览器 DOM 标记；同时直接解析实际发布的固定版本 `decap-cms.js.map` 中 `Widget.js` 与 `entryDraft.js`，证明 control 仍收到 entry，且三种 draft 创建路径维持预期 `newRecord` 状态。若 Decap 升级改变任一内部契约，质量门必须先失败，不能让控件静默解锁或误锁复制条目。

## 安全基线

全站必须有 CSP、HSTS、`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、Referrer Policy、Permissions Policy 和 COOP，并且不能暴露 `X-Powered-By`。

Studio 与 OAuth 必须：

- Studio HTML/配置/预览和 OAuth 的 `Cache-Control` 包含 `no-store`；版本化 CMS 运行时使用不可变缓存；
- `X-Robots-Tag: noindex, nofollow`；
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`；
- CSP 不允许第三方脚本源，只额外允许 GitHub API/授权/头像；
- 未配置 secret 返回 503，非法 provider/site/state 返回 4xx；
- OAuth state HMAC 签名、绑定 origin、十分钟失效。

当前 Next.js 流式启动脚本和现有样式需要 `script-src/style-src 'unsafe-inline'`；Studio 的固定 Decap 运行时还需要隔离的 `script-src 'unsafe-eval'`。这些是已知残余风险，框架和编辑器支持稳定 nonce/无 eval 方案后继续收紧。

## 发布门槛

只有以下证据同时成立才可切换生产入口：本地 `release:check` 通过、GitHub Quality Gate 通过、Vercel Production 成功、带 OAuth 的全路由冒烟通过、未登录真实浏览器通过、Studio 和 Obsidian 各完成一次真实发布。
