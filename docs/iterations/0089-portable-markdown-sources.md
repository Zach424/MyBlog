# Iteration 0089：可移植 Markdown 源文

## 1. 范围与成功标准

本轮只补齐单篇公开内容的可移植 Markdown 读取路径，不改变 Git Markdown 事实源、Studio/Obsidian 写入流程、JSON Feed/RSS、部署平台或外部账号。成功标准是：已公开文章和项目分别提供 `/posts/<slug>/source.md` 与 `/projects/<slug>/source.md`；详情页同时提供 `text/markdown` alternate 和无需 JavaScript 的可见入口；导出只含公开字段；站内链接、本地媒体和自页面 fragment 转为当前 origin 的绝对 URL；草稿、未来内容、未知 slug 和作者内部字段不能泄漏；响应、缓存、生产冒烟、桌面与 320px 视觉均通过。

## 2. 项目结构状态

- `lib/public-markdown.ts`：新增公开字段投影、AST URL 绝对化、YAML/正文组装和成功/404 Response 工厂；
- `app/posts/[slug]/source.md/route.ts`、`app/projects/[slug]/source.md/route.ts`：新增两个嵌套动态 Route Handler；
- `lib/content/markdown.ts`：为共享 Markdown 节点位置类型补充源码起止 offset；
- `app/posts/[slug]/page.tsx`、`app/projects/[slug]/page.tsx`：新增 Markdown alternate 与请求时绝对 source URL；
- `components/ShareTrace.tsx`、`app/globals.css`：在既有规范来源下增加可见 Portable source 行；
- `next.config.ts`：把文章/项目 HTML 缓存规则从递归通配收窄到集合和单层详情，避免覆盖嵌套源文的成功/404 响应缓存；
- `scripts/smoke-production.mjs`：新增源文、详情发现、公开字段、绝对 URL、响应头、Vercel 缓存归一化和未知 404 验证；
- `tests/public-markdown.test.mjs`：新增生成器白名单、链接语义、项目投影、稳定路径和零变异测试；
- 渲染、质量、部署与分享测试以及 README、架构、内容模型、设计、发现、质量、运维文档同步更新；
- 内容 Markdown、媒体、Studio、Obsidian 插件、依赖版本和 workflow 未改变。

## 3. 设计内容

详情页继续以 Commit Trace / Evidence Rail 为唯一视觉语法。源文入口位于 Share Trace 的 canonical 下方，以 `Portable source / VIEW .MD →` 形成第二条结构来源线；它不是下载卡片、营销按钮或新的主 CTA。链接服务端直接输出，无 JavaScript 也可使用；320px 下 URL 与标签自然换行，不产生页面级横向滚动，深色与焦点状态复用现有 Token。

公开源文是“可移植阅读投影”，不是仓库作者原稿的逐字下载。它保留 Markdown 标题、链接、图片、代码、公式和正文结构，但用显式 YAML allowlist 隔离写作流程字段。canonical 继续指向 HTML 页面；`X-Robots-Tag: noindex` 避免搜索结果重复收录 `.md`，读者和工具仍可从详情 alternate/可见链接主动发现。

## 4. 使用的技术

- Next.js 16.3 Route Handler、异步动态 `params`/`RouteContext` 与 Metadata `alternates.types`；实现前读取仓库内当前版本的 Route Handler、动态路由和 `generateMetadata` 文档；
- 共享 GFM + math mdast：复用现有 `parseMarkdown`/`walkMarkdown` 和节点源码 offset，只处理真实 link/image/definition，不用正则扫描整篇 Markdown；
- `yaml.stringify`：以固定字段插入顺序和 `lineWidth: 0` 输出可审阅 frontmatter；
- 既有公开 getter、`resolveSiteUrl` 与 `absoluteSiteUrl`：统一草稿/未来过滤以及本地、Preview、Production origin；
- 原生 `Response`：声明 `text/markdown; charset=utf-8`、安全 ASCII `Content-Disposition`、HTML canonical `Link`、`noindex` 和分层缓存；
- `frontend-design` skill：把新入口约束为既有结构来源行，避免泛化卡片/CTA；
- in-app browser skill：完成桌面、320px、DOM、console 与横向溢出验收。

## 5. 实现的功能

1. 每篇公开文章与项目都有稳定相邻的 `source.md` 地址；
2. 详情页 `<head>` 输出 `text/markdown` alternate，正文输出可访问的源文原生链接；
3. 共同 YAML 字段包含标题、摘要、类型、日期、语境、复核、标签、canonical 和可选封面；文章另含可选 series，项目另含 status/stack 与可选 repository/demo；
4. `draft`、`featured`、`slug`、`sourcePath`、`body`、阅读时间和字数等工作/派生字段不输出；
5. 根相对站内链接、本地图片、引用式定义和自页面 fragment 使用请求 origin 绝对化；外链、行内代码和围栏代码保持原样；
6. 响应文件名固定为安全 `<slug>.md`，canonical `Link` 指回 HTML 详情页；
7. 成功响应浏览器零 fresh、CDN 一小时 fresh/一天 SWR；Vercel 消费 CDN 指令后客户端可见 `public, max-age=0`；
8. 未知、草稿与未来记录统一返回 plain-text、`no-store`、`noindex` 的 404；
9. 生产冒烟同时验证两类源文、详情发现、隐私字段、绝对链接/媒体与缓存等价语义。

## 6. 实现方法

先写生成器、路由、metadata、可见入口、404、隐私、安全基线和生产冒烟测试，不加入实现；首次 18 项中 15 项通过、3 项失败，分别证明生成器模块、生产源文检查和 Share Trace 入口尚不存在。实现生成器后其 2/2 定向测试通过；加入路由、metadata、UI 和冒烟后定向 19/19。

首次本地生产应用测试为 19/20：实际源文被 `next.config.ts` 既有 `/posts/:path*` 内容缓存头覆盖，说明 Route Handler 自身响应头不是最终契约。先让验证器接受真实分层缓存后，第二次仍为 19/20，测试夹具误猜了正式媒体名；改为真实 `content-delivery-pipeline.webp`。第三次仍为 19/20：同一递归内容缓存规则也覆盖未知源文的 `no-store`。最终把 HTML 缓存精确收窄到集合与单层详情，让嵌套源文自行控制成功/失败缓存，随后应用 20/20。

公开正文改写以 AST 节点位置为证据：只在 link/image/definition 节点的源码范围内定位已解析 URL，再从后向前替换，重叠或无法定位时抛错关闭。这样代码示例不会被误改，正文顺序和记录对象也不变。项目导出使用 `type: project` 作为公开投影类型，明确不冒充仓库作者 schema。

## 7. 验证证据

- 失败优先：首次定向 15/18、3 个预期失败；生成器接入后 2/2；完整定向最终 20/20；
- 调试链：本地应用依次为 19/20（成功缓存被覆盖）→ 19/20（测试媒体名错误）→ 19/20（404 缓存被覆盖）→ 20/20；
- 完整 `npm run release:check`：404/404 单元测试、TypeScript、46/46 静态页面生成、20/20 应用测试、生产依赖审计 0；Current 1、Historical 3、inbox 0、根暂存 0、外链本地问题 0；
- 本地 HTML 预算 9/9：文章详情 raw `45,797/163,840`、gzip `9,761/12,288`；项目详情 raw `100,819/163,840`、gzip `23,502/28,672`；
- 浏览器：桌面 Share Trace 结构、链接 href 和 console 通过；320×800 根宽 `320`、scroll width `305`、无横向溢出，源文入口可见；
- 功能提交：`a753b65d77f1f4aea2bc295049d8f404047abfbb`；
- [Quality Gate #163](https://github.com/Zach424/MyBlog/actions/runs/31324365675) 成功；[Production Smoke #156](https://github.com/Zach424/MyBlog/actions/runs/31324399522) 成功；
- 稳定生产复跑：24 条 Sitemap URL、OAuth 302、九条实际 origin HTML 预算全绿；源文入口、响应、隐私、绝对 URL、缓存和未知 404 全部通过；
- 本机首次生产复跑因 Node fetch 未启用代理而 `fetch failed`；设置 Node 24 `NODE_USE_ENV_PROXY=1` 后同一命令 16.7 秒通过，证明是本机网络路径而非生产故障。

## 8. 经验与教训

路由代码写出的响应头不一定是最终响应头。Next 全局 `headers()`、框架和 CDN 都可能继续覆盖或消费指令；状态相关的端点尤其不能被宽泛 `:path*` 规则包住，否则成功与 404 会失去不同缓存语义。测试必须从真实生产服务器观察最终响应，并让线上冒烟验证平台允许的等价表示，而不是只比较 Route Handler 源码字符串。

AST 提供“这是一个真实 Markdown URL”的语义，源码 offset 提供“只改这一段字节”的证据；两者结合比全篇正则更安全。失败关闭也很重要：遇到解析器无法映射回源码的写法时，应中止导出，而不是猜测并可能改坏正文。测试夹具还必须引用当前内容真实文件名，不能凭设计意图猜媒体路径。

浏览器自动化客户端会阻止直接打开某些 `text/markdown` 非 HTML 导航，本次出现 `ERR_BLOCKED_BY_CLIENT`；这不等价于服务器失败。可见链接/href 由 DOM 与视觉验证，实际 Markdown body、MIME 和响应头由 HTTP 应用测试与生产冒烟验证，两个证据层不能相互冒充。

## 9. 全局状态、风险与未解决问题

公开读取层现在同时提供 HTML、聚合 JSON Feed 纯文本、RSS 摘要和单篇结构化 Markdown。读者可以保存源文，Obsidian/自动化可在不理解 GitHub 仓库目录的前提下读取公开内容；作者写入仍只经过 Studio、Obsidian 发布器或普通 Git，源文端点没有写权限，也没有引入账号、数据库、云存储、第三方 SDK 或客户端 bundle 增量。

源文不是无损 round-trip 格式：公开字段经过 allowlist，项目 type 是公开投影，原始键顺序/引号/注释不会保留，不能直接覆盖作者文件。raw HTML 属性不在当前 URL 改写边界内；正式内容应继续优先使用受构建门验证的 Markdown 链接和图片。现在每次请求都会确定性生成完整正文，尚未显式提供内容摘要 ETag 或条件 GET；CDN 缓存已限制成本，但 Obsidian/同步器仍无法只凭 HTTP 判断正文是否变化。既有 Decap 开发依赖上游高危项、Actions pin 主动复核、真实 Obsidian 主题首次使用和等待所有者决定的自定义域名/统计/评论/公开邮箱保持不变。

## 10. 下一轮唯一主任务

为公开 Markdown 源文增加确定性 ETag 与条件请求。用最终 UTF-8 响应字节生成稳定强 ETag，按公开日期/更新/复核事实提供一致的 `Last-Modified`，正确处理 `If-None-Match` 并返回不带正文的 304；成功 200 与 304 保留安全、canonical、缓存和 `noindex` 契约，404 继续 `no-store`。先写哈希稳定性、内容变化、条件匹配/不匹配、响应头、生产服务器和 Vercel 冒烟失败测试，再实现；不增加数据库、外部同步服务、账号或写入 API。
