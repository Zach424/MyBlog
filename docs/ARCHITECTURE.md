# 系统架构

## 1. 架构目标

MyBlog 是 Git-first 个人技术博客。公开阅读不依赖数据库；网页后台、Obsidian 和普通编辑器只负责产生 Git 提交。部署平台可以替换，但内容契约、URL 和写作入口保持稳定。

## 2. 技术组成

| 层 | 技术 | 职责 |
| --- | --- | --- |
| 界面 | React 19、Next.js 16 App Router | 页面、元数据、Route Handlers 与服务端渲染 |
| 内容 | Markdown、YAML、Zod | 文章/项目解析、字段校验、草稿过滤与派生索引 |
| 维护 | Node CLI、GitHub Actions | Current record 日龄、根媒体库存、外链库存、分级队列、摘要与过期门 |
| 阅读 | react-markdown、remark-gfm、remark-math、rehype、KaTeX | GFM、标题锚点、代码高亮、脚注、数学公式与目录 |
| 发现 | 本地搜索、RSS、Sitemap、robots、JSON-LD | 检索、订阅与搜索引擎发现 |
| 发布 | Decap CMS、Obsidian、GitHub | 两个作者入口，共用同一内容事实源 |
| 媒体 | Sharp、Markdown AST、`next/image`、Git `public/uploads` | 原图安全解码、WebP 优化、共享固有尺寸、响应式封面/正文图、引用所有权与附件版本化 |
| 托管 | Vercel | Git 自动预览、`main` 生产部署、环境变量与回滚 |
| 质量 | Node test、TypeScript、ESLint、生产 HTTP 测试 | 内容、HTML、安全、链接、体积与发布契约 |

## 3. 项目结构

```text
app/
  api/cms/{auth,callback}/route.ts  GitHub OAuth 同源端点
  studio/                           Studio HTML、内容复核队列、配置、媒体清单/预检、slug 控件、公式预览与版本化 CMS 运行时路由
  posts/ projects/ series/ tags/   集合与详情页
  knowledge/ search/ about/         知识地图、搜索和关于页
  rss.xml/ sitemap.xml/ robots.txt/ 发现端点
components/                         站点框架、内容视图、Markdown、搜索
  ContentViews.tsx                  详情页事实、目录、引用账本与打印来源
  ContentCover.tsx                  文章/项目共享的响应式封面与 Artifact Rail
  KnowledgeMap.tsx                  服务端 SVG 信号场、关系账本与孤立记录
  MarkdownHeading.tsx               H2/H3 原生 fragment 永久链接的服务端边界
content/
  posts/ projects/                  唯一公开内容源
  inbox/                            以安全文件名作为唯一 slug 身份的 Obsidian 待发布区
  redirects.yml                     版本化永久重定向注册表
.obsidian/plugins/myblog-publisher/ Obsidian 创建、改名、检查、发布、复核与交付恢复入口
public/uploads/<slug>/              按内容隔离的公开图片附件
lib/
  content/                          内容契约、维护报告、文件读取、派生索引与引用关系
    author-doctor.ts                本机作者环境 13 项只读前置契约与 version 1 报告
    inbox-readiness.ts              全部 Obsidian 草稿的只读发布就绪聚合
    delivery-triage.ts              同一 Git 观察上的互斥恢复路由与 version 1 报告
    publish-delivery.ts              新内容多路径待交付身份与六态只读报告
    external-links.ts               GFM 外链库存、受控 HEAD 检查与公网目标防护
    knowledge-graph.ts              公开节点、有向边、邻接与孤立状态派生
    media.ts                        封面与正文图共享的固有尺寸描述器
    media-references.ts             Markdown 图片 AST 抽取与安全 `/uploads` 路径解析
    staging-media.ts                根暂存库存、inbox 引用、年龄证据与报告格式
  cms-oauth.ts                      签名 OAuth state 与 token 交换
  heading-permalink.ts              标题 fragment 与 Markdown 深度标记纯函数
  markdown-math.ts                  KaTeX 安全选项与构建期公式解析门
  markdown-pipeline.ts              生产阅读与 Studio 共享的 remark/rehype/安全 URL 配置
  studio-math-preview.ts            同源作者预览的公式校验、HTML 输出与无障碍语义
  studio-maintenance.ts             公开 Current 内容到最小维护队列快照的适配层
  search-index.ts                   服务端 Markdown AST 到搜索纯文本/文档索引
  media-policy.ts                   原图安全包络、WebP 优化与公开媒体预算的共享策略
  studio-media-manifest.ts          已归档媒体路径、字节数与 SHA-256 的确定性清单
  obsidian-publishing.ts            Obsidian 校验、附件与目标路径转换
  redirects.ts                      重定向 schema、路径不变量与 Next 规则转换
  studio-assets.ts                  构建期 Studio 资源响应
studio/                             Decap CMS、浏览器媒体预检、稳定 slug 与公式 preview template 源文件（不放入 public）
templates/obsidian/                 不重复写入 slug 的文章、TIL、项目受信模板
scripts/                            作者环境自检、发布、统一交付分诊、发布/复核交付、inbox/内容/暂存媒体/外链报告、冒烟、迁移和生产测试器
build/validate-media.ts             构建前递归扫描全部公开上传图片
build/validate-media-references.ts  正式内容图片存在性、slug 所有权和孤儿附件门禁
build/validate-redirects.ts         当前公开路由、静态文件与重定向关系门禁
tests/                              单元、生产 HTTP 与质量审计
.github/workflows/
  quality.yml                       PR/main/每周完整质量门与维护摘要
  production-smoke.yml              Vercel 生产部署成功后的在线验收
  rollback.yml                      所有者手动 Vercel 回滚与复核
vercel.json                         Vercel Next.js 框架声明
```

三条工作流都运行在 GitHub-hosted `ubuntu-latest`，使用 `actions/checkout@v6` 与 `actions/setup-node@v6` 的 Node 24 action runtime，再由 setup-node 显式安装应用所需的 Node.js 22 并启用 npm lockfile 缓存。action 自身的 JavaScript runtime 与应用运行时是两层独立契约；`tests/github-actions-workflows.test.mjs` 结构化解析 YAML，锁定 action major、只读权限、触发器、并发策略、Node 版本、缓存、命令顺序与手动回滚边界。

## 4. 内容与构建

`next.config.ts` 在开发和构建开始时冻结作者时区日期，并行执行内容、媒体文件、内容—媒体关系与永久重定向校验。内容校验器先验证全部 Markdown，再对已公开内容执行关系完整性与新鲜度检查；媒体校验器递归扫描 `public/uploads`，拒绝符号链接、非图片、损坏图片、扩展名伪装和预算超限；媒体关系校验器用标准 Markdown AST 读取正式 posts/projects 的 `cover`、行内图片与引用式图片，核对精确文件路径和 slug 所有权，再拒绝无人引用的已归档附件；重定向校验器交叉检查当前公开 HTML 路由、静态文件、运维命名空间与 `content/redirects.yml`。纯净 Git 检出尚无上传目录时等价于零张图片；目录一旦存在，所有文件和正式引用都必须通过校验。`lib/content/index.ts` 在构建/服务端从 `content/posts` 与 `content/projects` 读取文件，解析为统一记录，过滤草稿和未来内容，再派生专题、标签、搜索、RSS 与 Sitemap。

永久重定向注册表只接受小写 ASCII 精确路径，并要求每条记录包含加入日期和原因。来源不能仍是当前页面、公开静态文件、API/Studio 或 Next 内部路径；目标必须是同一次构建中的公开 HTML 页面。注册表拒绝重复来源、自跳转、链式跳转和环路，再由 Next `redirects()` 输出单跳 `308 Permanent Redirect`。查询参数沿用 Next 原生透传语义，旧地址不进入 Sitemap，也不另建内容副本。

公开日期按 `Asia/Shanghai` 在 Next.js 配置加载时冻结为 `CONTENT_BUILD_DATE`。同一个部署内的页面、搜索和 Feed 因而共享确定内容集合，不会因 Serverless 实例启动时间变化。

每条正式内容声明 `freshness` 和 `reviewedAt`。`historical` 是保留当时决策的快照，不随时间失效；`current` 承诺与现行系统一致，公开后最多 180 天必须复核。复核日期不能早于内容更新日期、不能晚于构建日期。详情页服务端渲染 Context 与 Reviewed；结构化数据的 `dateModified` 使用复核日期。

`lib/content/maintenance.ts` 复用构建硬门的 UTC 完整日计算，把公开 Current record 派生为 healthy、review-soon、due-soon、overdue。60 天进入复核窗口，30 天进入紧急队列，第 180 天仍是最后有效日，第 181 天过期。`scripts/report-content-maintenance.mjs` 提供文本/JSON、固定日期演练、GitHub Markdown 摘要和源文件注解；Historical、草稿与未来记录不参与队列。Quality Gate 在 push、PR、手动运行和每周一 01:00 UTC 执行报告，只有 overdue 返回非零，预警不改变原 180 天契约。

`lib/studio-maintenance.ts` 在同一维护报告之上生成版本化的最小作者快照，只保留标题、kind/slug、公开 URL、稳定 Studio 条目 URL、复核日期、最后有效日、剩余天数和状态；正文、源文件路径、草稿、未来记录与 Historical 快照都不会进入响应。`/studio/maintenance.json` 是 Node.js 动态 Route Handler：内容集合仍按本次部署冻结，报告日则按请求时的 `Asia/Shanghai` 日期计算，因此同一个部署会随自然日推进队列而不扩大公开内容。响应使用 `no-store` 与 `noindex`；浏览器只从同源读取并严格核对版本、计数、日期、状态和 URL，异常时失败关闭且保留重试入口。

`lib/content/staging-media.ts` 只扫描 `public/uploads` 根文件，并复用 Obsidian 发布器自己的 Wiki/Markdown/cover 附件解析语义，交叉建立 inbox 草稿引用账本。现存文件分为单草稿引用、多草稿共享和未引用；报告还列出缺失引用与无法审计的草稿。干净且已跟踪的文件以 Git 最后提交日计算年龄，本地修改或未跟踪文件以明确标注的 filesystem mtime 作为观察证据；默认 30 天进入陈旧复核，但任何发现都只产生建议和 Actions warning，不删除文件、不改变构建结果。`scripts/report-staging-media.mjs` 提供文本/JSON、固定日期/阈值与 GitHub 摘要，Quality Gate 每次运行和每周复核都会生成库存。

`lib/content/inbox-readiness.ts` 在作者工作区逐篇隔离检查直接位于 `content/inbox` 的 Markdown：复用真实发布器完成类型/slug/frontmatter/站内链接与附件目标派生，再按报告 scope 决定哪些附件交给同一媒体发布策略，在系统临时目录生成并校验实际候选产物。默认 scope 对全部草稿派生，保持既有全库报告；`sourcePath` scope 仍轻量解析全部草稿并交叉检查正式目标、附件目标、Git 跟踪附件和多草稿共享源，但只有精确目标执行真实媒体派生，应用共享问题后才裁成单 entry 报告。一个坏草稿不会阻止其他草稿产生证据。状态分为现在可发布的 `ready`、可以提交但尚未到公开日的 `scheduled` 和需要处理诊断的 `blocked`。version 1 JSON 固定 `mode: read-only`，并证明作者文件、commit、push 与网络均未变化；entry 同时保留 Article/TIL/Project、站内引用次数、正式目标与媒体候选。临时目录在成功和失败路径都删除，作者 Markdown 与附件不写入；`scripts/report-inbox-readiness.mjs` 提供文本/JSON 和安全的 `--source content/inbox/<slug>.md`，Obsidian 桌面插件保留全库文本 Modal，并用聚焦 JSON 生成当前草稿作者意图摘要。它不接入 Actions，因为未跟踪本地草稿对 CI 天然不可见。

`lib/content/external-links.ts` 用与正文渲染一致的 GFM AST 读取公开文章/项目正文，并从同一 `ContentRecord` 读取文章 canonical、项目 repository/demo。每个 occurrence 标明 `sourceField`；正文另保留相对行和可见标签，字段显示 `frontmatter.<field>`。URL 规范化后统一聚合，因此正文与结构化字段指向同一地址时只形成一个 link entry 和一次健康检查；图片、代码、站内链接、锚点、邮件链接和 `demo: null` 不参与。正文中的 HTTP、协议相对、无效 HTTPS 与含凭据 URL 进入本地 issue 且凭据不会写入报告；结构化字段继续由 schema 先保证 HTTPS。`scripts/report-external-links.mjs` 默认只输出确定性文本/JSON 库存并进入本地 `release:check`。只有显式 `--check` 才发送 HEAD：每跳限制 HTTPS/443/无凭据，拒绝本地命名空间和任一私网/回环/链路本地/保留 DNS 结果，再把连接固定到已验证公网地址以收窄 DNS rebinding；并发 1–8、超时 500–30000ms、重试 0–2、重定向 0–10。响应头到达后立即关闭，不下载或保存正文。404/410、其他确定 4xx、安全或重定向错误才计入 broken；403/429/HEAD 不支持、5xx、超时和网络错误保留为暂不可确认。实时检查不进入 Actions 或默认构建硬门。

`lib/content/knowledge-graph.ts` 接收同一公开文章/项目集合与已经校验的引用关系，确定性派生节点、有向边、每个节点的 outgoing/backlinks、唯一邻居数和孤立状态。`app/knowledge/page.tsx` 在服务端读取该结果；`KnowledgeMap.tsx` 同时输出可聚焦的 SVG 链接信号场、原生 HTML 有序关系账本和孤立记录列表。桌面端按文章/项目双列绘制，互相引用分轨显示；`≤ 42rem` 隐藏需要宽画布的 SVG，保留完整关系账本和说明，因此辅助技术、搜索引擎、无 JavaScript 与 320px 设备都不依赖 Canvas、客户端布局或另一份索引。新增/修改正文站内链接会在下一次构建自动更新详情页与知识地图。

`lib/content/media.ts` 是封面与正文图共享的服务端尺寸层。文件系统根静态收窄到 `public/uploads`，避免 Turbopack 把整个仓库追踪进 Serverless 产物；同一仓库路径的检查通过 React cache 复用。封面描述器附带 `coverAlt`，交给共享 `ContentCover` 和 OG/Twitter/JSON-LD；没有封面的记录不渲染 figure。`MarkdownContent` 则先从正文 AST 收集并去重 URL，只为本地 `/uploads/...` 建立描述器，再把真实宽高、作者 alt 和对应 48rem 阅读栏的 `sizes` 交给 `next/image`。两条详情路由必须传入内容 `sourcePath`，因此页面渲染与构建媒体契约使用同一安全路径边界。

`MarkdownContent` 继续作为 Server Component 执行 GFM、slug、高亮和媒体描述；只有 fenced `pre` 把现有 code child 与从 `language-*` 类规范化的标签传给最小 `CodeBlock` Client Component。该客户端岛的 SSR 输出仍含完整 figure/figcaption/pre/code，COPY button 初始 hidden 并在 mount 后揭示；写入只使用当前 code DOM 的精确 `textContent` 和原生 Clipboard API，状态通过 button、data attribute 与 polite live region 表达。inline code 不进入该边界。CSS 额外锁定 `[hidden]`，移动端由 wrapper full-bleed、pre 独立 overflow，避免操作轨随长代码滚走。

H2/H3 由 `MarkdownHeading` 服务端组件接收 `rehype-slug` 已写入的真实 `id`，在原 children 之后追加独立原生 `<a href="#id">`；组件不读取标题文本、不重新计算 slug，也不进入客户端 bundle。链接子节点仅呈现 Markdown 深度标记，避免与标题内作者链接形成嵌套锚点。桌面、窄屏、无悬停触控和打印只由 CSS 媒体条件改变可发现性，不改变 fragment、目录或关系抽取的数据源。

文章和项目详情路由从同一已解析记录生成 canonical URL，并把它交给 `ContentViews.PrintSource` 服务端输出。来源节点在屏幕上隐藏，在打印媒体中显示，因此 PDF 不读取 `window.location`、不增加客户端脚本，也不会因浏览器 hydration 状态缺失出处。`@page` 固定 A4 和毫米页边距；全局打印作用域只重排详情页现有语义 DOM，隐藏站点框架与网页交互，保留正文资产。标题/后继内容、代码、图片、表格行和关系分组使用分页约束；代码在纸面改为 `pre-wrap`，表格取消屏幕最小宽度，外链与引用路径用 CSS 生成可辨来源。屏幕基础规则不被修改。

脚注沿用已经安装的 `remark-gfm` 解析，不增加第二套 Markdown 解析器或客户端脚本。`MarkdownContent` 通过 `remarkRehypeOptions` 固定 `note-` DOM clobber 前缀、中文“注释与来源”标签和按引用位置生成的中文回链名称；自定义 anchor renderer 保留 rehype 生成的 `id`、`data-*`、`aria-*` 与 class，同时继续只为 HTTP(S) 外链设置新窗口策略。脚注标题绕开正文 `MarkdownHeading`，因此不进入 H2/H3 permalink 或目录。构建期内容关系仍从同一 GFM AST 读取脚注定义中的真实链接并去重；搜索纯文本只移除 `[^id]` 和定义标签，保留证据正文，避免作者语法污染摘要又不丢失可检索信息。

数学公式沿用 Obsidian 的 `$...$` 与 `$$...$$`。`lib/content/markdown.ts` 把 GFM 与 `micromark-extension-math`/`mdast-util-math` 合并为共享服务端 AST，标题、关系、外链和媒体抽取都复用它，所以公式里的链接/图片外观文本不会变成真实引用，代码与未闭合的普通美元文本保持原义。`lib/markdown-math.ts` 使用本地 KaTeX 预解析每条公式，固定 `htmlAndMathml`、`strict: error`、`trust: false`、`maxSize: 20` 与 `maxExpand: 1000`；失败会带正文行号进入内容构建门。`MarkdownContent` 通过 `remark-math` 与 `rehype-katex` 在 Server Component 内输出可视 HTML、MathML 和 TeX annotation，不加载 CDN 或客户端公式脚本。块级公式得到可聚焦横向滚动区，打印取消滚动并避免跨页。`lib/search-index.ts` 只在服务端把同一 AST 转为索引文本，保留公式 TeX 值；`lib/search.ts` 继续只包含浏览器端排名逻辑，避免把解析器和 KaTeX带入搜索客户端岛。

`lib/markdown-pipeline.ts` 进一步把生产阅读的 remark/rehype 插件、脚注选项、受限 KaTeX 和 URL protocol transform 集中成共享配置。`/studio/math-preview` 先调用同一构建期公式门，再用 pinned unified/remark/rehype/stringify 重放共享管线；raw HTML 保持关闭，`href`/`src` 再应用同一安全 URL 规则。端点只接受同源 JSON，限制声明与实际正文为 100,000 B，返回 `no-store`/`noindex` 的 200 或带行号 422；其他协议/类型/体积错误分别失败。它只生成作者预览，不保存 Git 或替代完整构建门。

内容目录通过 Next.js output tracing 显式包含在部署中，既支持 Vercel Serverless，也不会依赖开发机器路径。

## 5. 作者发布链路

```text
网页 /studio ─┐
              ├─ GitHub 提交/PR ─ 质量门 ─ main ─ Vercel 自动生产部署
Obsidian ─────┘                                      │
                                                    └─ 生产冒烟
```

Studio 在浏览器中用当前 origin 生成 `base_url`。`/api/cms/auth` 创建十分钟有效、HMAC 签名且绑定 origin 的 state；`/api/cms/callback` 交换 GitHub token，并且只向发起授权的同源窗口发送结果。未设置 `GITHUB_OAUTH_ID` 或 `GITHUB_OAUTH_SECRET` 时返回 503，发布入口安全关闭。

Studio HTML、内容复核页面、配置、预览样式、媒体预检、稳定 slug 控件和公式 preview template 保留在仓库根 `studio`；完整 `decap-cms@3.14.1` 浏览器包作为构建期依赖。上述资源、构建期媒体清单、版本化内联 WOFF2 的 KaTeX CSS、动态公式预览与维护快照均由显式 Route Handler 同源返回。未知子资源返回真实 404。资源不进入 `public`，以便统一应用专用 CSP、`X-Robots-Tag` 与 OAuth 弹窗策略。维护页是独立、语义化的作者视图，Studio shell 左下角固定链接位于 Decap 的 `#nc-root` 之外，不依赖其未公开的侧栏 DOM。

公式 preview template 对 posts/projects 幂等注册。正文无 `$` 时继续用 Decap 原生 widget 且零请求；潜在公式经过 240 ms 防抖后 POST 当前正文。timer、AbortController 与单调 generation 共同保证 latest-wins；无效公式、网络失败和组件卸载都保留原 Markdown。有效响应才插入服务器生成的 HTML + MathML。KaTeX CSS 在构建时读取固定 package 文件，只保留并内联 20 个 WOFF2，版本化 CSS immutable 缓存且只由 noindex 作者 iframe 加载。

同一 Author Proof 还为 posts/projects 各创建带固定集合身份的条目预检模板。浏览器只从 Decap entry 取内容契约白名单字段，把 Date/Immutable 值归一为 JSON，空的可选字段不发送；其他编辑器状态、GitHub token 或未知字段不会离开浏览器。字段变化经 320 ms 防抖后 POST `/studio/entry-preflight`，独立 timer、AbortController 与 generation 保证快速输入时只有最新结果可见。端点限制同源 JSON 和 128 KiB，直接调用 `inspectContentDraft` 复用正式 frontmatter schema、跨字段日期/草稿/封面约束、标签注册表、正文公式门与 Current 180 天时效规则；200/422 都返回路径、公开状态、内容语境、字词/阅读时长和逐字段问题。该检查不读取仓库、不保存、不阻断编辑；跨文件 slug/专题连续性、媒体引用、站内关系与完整构建仍在 Git 保存后执行。

Studio 的全局 `media_folder`/`public_folder` 保留为根暂存与媒体库兼容入口；posts/projects 集合各自覆盖为绝对仓库模板 `/public/uploads/{{fields.slug}}` 与公开模板 `/uploads/{{fields.slug}}`。编辑器因此在作者填写稳定 slug 后，把封面和 Markdown 正文图直接写入该内容的归档目录。slug 同时决定内容文件名、公开 URL 与附件命名空间，首次保存后不可修改。

构建期 `lib/studio-media-manifest.ts` 递归读取 `public/uploads` 的普通文件，按仓库路径排序并计算字节数与 SHA-256；`/studio/media-manifest.json` 以静态、同源、`no-store`/`noindex` 响应提供这一不可写快照。浏览器预检在读取和解码同一份原始字节后计算摘要，按固定 Decap 3.14.1 的小写、去音调和 ASCII 文件名规则推导 `public/uploads/<slug>/<filename>`。不存在为 new；路径与摘要/字节相同为 same；同路径不同内容必须展示双方体积与摘要前缀，并由作者明确确认。稳定 slug 缺失、清单失败或清单结构异常时条目上传失败关闭；全局媒体库没有条目身份时只执行原媒体预算预检。文件通过后仍透传原始 `File`，不在浏览器内改写字节。

同一个 conflict checker 还持有仅存于页面内存的 `approvedTargets` Map。生产清单是初始基线，成功重放过的目标成为会话优先基线；后续同路径同摘要返回 same-session，不同摘要返回 replace-session-confirmed 并再次要求证据型确认。检查函数只返回幂等 `commit()`，handler 在合成 change 事件成功返回后才调用；取消、格式/清单失败或重放异常均不写账本。卸载并重新安装预检或刷新页面会创建新 Map，不使用 localStorage、IndexedDB 或远端状态。

media handler 另用 `WeakMap<input, generation>` 实现 latest-wins。每个真实 change 在任何 await 前同步递增代次，合成重放由 approved `File` 提前识别且不递增；`isCurrent()` 同时核对 token 和当前 `input.files[0]`。图片解码、manifest、确认等异步边界后，旧代次返回显式 stale 或静默结束。过期成功不能 report/dispatch/commit，过期失败不能清空最新 input 或覆盖 Evidence Rail；空文件 change 也会递增代次以使在途选择失效。底层解码/fetch 不伪装成已取消，只是失去产生副作用的权限。

posts/projects 的顶层 slug 使用项目自有 `stable-slug` custom widget，专题内的普通 slug 仍使用内建 string。实际提供给浏览器的 Decap 3.14.1 bundle 把当前 Immutable `entry` 传给 control；其 reducer 用 `newRecord=true` 标记新建/复制，用 `false` 标记已加载的正式或 editorial workflow 条目。控件因此只在 `newRecord=false` 时使用原生 `readOnly`，保存值仍参与序列化且可复制；新建、复制和未保存本地备份保持可编辑。已有条目若字段值与 entry 顶层 slug/path 身份不一致，`isValid` 在保存前返回可执行错误。控件使用官方全局 `createClass`/`h` 注册，在 CMS init 前安装，并以 DOM data 属性提供无内容写入的浏览器可观测性；当前内部 `entry/newRecord` 传递由所发布 bundle 的 source map 回归测试锁定，升级 Decap 时必须重审。

Obsidian 草稿中的 Wiki 图片嵌入、指向 `public/uploads` 的 Markdown 图片和 frontmatter `cover` 会在发布前转换。文件进入 `public/uploads/<内容 slug>/<稳定文件名>`，正文或 cover 改写为对应 `/uploads/...` URL；文件名不稳定时使用可读 ASCII 名加路径哈希消除冲突。静态 PNG/JPEG/WebP 的公开文件名统一使用 `.webp`，相同 stem 的多种源格式因而会在修改工作区前被拒绝为目标冲突；GIF 和 AVIF 保持扩展名。cover 与正文附件登记到同一映射，所以共享源不会重复移动，且都受同一 staging、安装与回滚事务保护。

发布前，作者可以从 Obsidian 命令面板运行“新建博客草稿”“重命名当前草稿”“检查当前草稿身份”“查看当前草稿发布意图”“检查本机发布环境”与“查看全部草稿发布就绪状态”；维护既有内容时运行“查看已发布内容复核台账”；任何 push 失败后首先运行“查看 Git 交付恢复”。插件 1.23.0 的创建/改名/旧身份清理直接使用 Vault/FileManager API，其余报告与交付入口以固定参数数组和 `shell: false` 启动本地 `content:author:doctor --format json`、`content:inbox`/`content:inbox --format json`/`content:inbox --format json --source <path>`、版本化 `content:status --format json`、`content:delivery:status --format json`、`content:review:status --format json`、`content:publish:status --format json`，或两个独立的 `content:review:deliver --format json` / `content:publish:deliver --format json`。Windows 通过隐藏 `cmd.exe` 执行 npm，POSIX 直接执行 npm。doctor、inbox、维护、分诊、状态与回执 JSON 在 CommonJS 插件边界严格验证精确字段、派生计数、日期或 Git object identity、确定性顺序、安全声明和来源路径；当前草稿摘要还要求报告只有一个精确来源，输出返回时仍是同一活动 `TFile`。统一分诊还必须通过原有两套领域 parser，doctor 则从原始 observation 重新派生全部 13 项 check。仅当 Vault 返回同路径 Markdown 文件时才交给原生 leaf 打开。attention、逾期与待交付状态允许 CLI 退出码 1；通用报告无效时按既有设计降级纯文本；当前草稿意图因不能安全保持“当前”语义而专门失败关闭，不回退、不重试。不可信的成功回执也失败关闭，绝不自动再次 push。输出最多捕获 200,000 字符；activity timestamp 在截断判断前记录，因此正文停止累积后仍保留 owning child 活动。所有命令共用活动进程账本：成功、非零退出、spawn error 都隐藏持续 Notice 并只结算一次，插件卸载会隐藏 Notice、忽略迟到事件，并在 Windows 以固定参数、无 shell 的 `taskkill.exe /T /F` 终止命令进程树（启动失败回退直接 kill），POSIX 直接终止子进程。doctor、状态报告、作者意图与分诊都只读；deliver 是明确命名的 Git 写动作，单篇检查与发布保持原语义，完整 `npm run check` 仍是最终权威门禁。

`lib/content/review-note.ts` 把正式复核定义为固定 HEAD 快照与当前文件之间的领域转换：路径必须是稳定正式文件，前后都已公开且为 Current，`publishedAt` 不变，`reviewedAt` 必须严格推进到上海当天；去除 reviewedAt/updatedAt 和派生字数后若语义快照变化，当前 `updatedAt` 必须是当天，否则只能保持旧 updatedAt。语义快照只规范化 CRLF/CR 为 LF，避免行尾差异伪装成事实变化；候选 SHA-256 仍覆盖未规范化的原始字节。`lib/content/review-worktree.ts` 以 Git 状态而不只是路径分类影响：已修改/未跟踪的稳定 inbox 草稿可以 deferred；根暂存图片只有未跟踪新增时可以 deferred，已跟踪修改或删除会阻断，避免本地修复掩盖 HEAD 问题；任何 staged（含 intent-to-add）、正式内容、代码、嵌套媒体与未知路径均阻断。

`scripts/review-note.mjs` 在完整 `npm run check` 前后复算同一分类，并把门前 HEAD、目标原始字节 SHA-256 和 `git hash-object --path --stdin` 得到的 clean/filter 后 blob OID 一起固定。门后 HEAD 与原始 SHA 必须不变；push 前再次核对 HEAD，暂存后 index blob、提交后父提交/唯一 diff/tree blob 都必须匹配门前候选。若 commit hook 改写了 tree，脚本用带 expected-old 的 `git update-ref` 原子移回 base HEAD、只取消目标暂存并保留工作区，绝不推送未经验证的提交。Proof v3 新增严格 candidate 段；插件 1.20.0 验证 `sha256`、64 位小写摘要和 `stableAfterQualityGate: true`，再以短指纹展示，完整摘要保留在 title 与 aria-label。deferred、JSON 日志隔离、纯文本重跑和合法 commit 后 push 失败保留本地提交的语义不变。

`lib/content/review-delivery.ts` 把本地 `refs/heads/main` 相对 `refs/remotes/origin/main` 的观察分类为 synchronized、pending-review、local-ahead、behind、diverged 或 tracking-missing。pending-review 是窄状态：behind 0 / ahead 1，HEAD 提交只有一个父级且等于 tracking head，subject 必须是 `content: review <slug>`，diff 只有对应 `content/posts|projects/<slug>.md`，tree/blob object id 可读；普通 ahead 绝不借用恢复指令。`scripts/review-delivery-git.mjs` 只以 `rev-parse`、`rev-list`、`show`、`diff-tree` 读取本地 refs，不 fetch；`report-content-review-delivery.mjs` 输出 version 1 文本/JSON，所有非同步状态返回 1。review-note 在完整门前后都要求 synchronized，因此 tracking ref 在门中变化或已有待交付提交都会失败关闭。插件重新验证 exact keys、40/64 位 object id、计数/HEAD/父级/path/subject/recovery 关系，并明确 `networkChecked: false`；结构异常降级到同样零网络的纯文本报告。

`scripts/deliver-content-review.mjs` 是状态报告之外的窄写事务。它只接受 `--format text|json`，要求 current branch 为 main 且状态仍为同一个 pending-review；在 push 前保存二进制 index 与 porcelain-v2 worktree 快照，并二次读取完整身份。push 使用 `git push origin <commitOid>:refs/heads/main`，因此源不会在 Git 解析 `main` 时漂移，同时仍是非 force，服务器的 fast-forward 判定是 stale tracking 的最终保护。push 后重新读取关系并交给 `createContentReviewDeliveryReceipt`：after 必须 synchronized，local/tracking 必须等于原 commit，index/worktree 必须逐字节稳定，才生成 version 1 delivered receipt；fetch/rebase/reset 固定为 false。push 返回成功但后置证据不足时不会自动重试，因为第一次 push 可能已经送达。插件对 receipt exact keys、OID、slug/path/subject、前后关系、精确命令和六个 safety 值全部重算后才 reconcile 和展示。

`lib/content/publish-delivery.ts` 为新内容发布建立独立六态，但 pending-publication 不是 review 的别名。它要求 ahead 1 / behind 0、单父级等于 tracking head、subject 为 `content: publish <slug>`；raw diff 必须精确等于一个新增 `content/posts|projects/<slug>.md`、可选同 slug 的已跟踪 inbox 删除和零到多个同 slug 归档媒体新增。正式内容会从 commit blob 重新解析 kind/slug/title；old/new blob、路径安全、唯一性、确定性顺序、媒体扩展名和允许集合全等都必须成立。`scripts/publish-delivery-git.mjs` 只读取本地 refs/commit/tree/raw diff，`report-content-publish-delivery.mjs` 输出 version 1 text/JSON 且所有非同步状态返回 1。普通 ahead、复核提交或夹带路径都只得到 inspect-git-state；精确包才显示 OID refspec，仍明确 `networkChecked: false` 与 `autoExecuted: false`。插件 1.20.0 独立重算同一 schema，结构异常降级为同样只读的纯文本报告。

`scripts/deliver-content-publish.mjs` 把恢复写动作封装为与复核不同的多路径事务。它要求 main 上仍是同一个 exact pending-publication，先保存二进制 index 与 porcelain-v2 worktree，再按精确 commit OID 重读包含父级、subject、tree、正式内容和全部 old/new blob 的 manifest；二次状态与 manifest 相同才运行普通非强制 `git push origin <commitOid>:refs/heads/main`。push 后再次读取关系、同一不可变 commit 对象和本地表面；只有 local/tracking 都等于原 commit，index/worktree 逐字节稳定，且三次 manifest 完全相同，`createContentPublishDeliveryReceipt` 才签发 version 1 delivered receipt。服务器拒绝或 unseen remote advance 保留本地 envelope；成功但后置证据不足按可能已送达处理，不自动重试。fetch/rebase/reset 始终为 false。插件再独立重算完整 publication schema、前后关系、精确命令与七项 safety，可信后才 reconcile 并展示 sealed envelope。

`scripts/delivery-git-snapshot.mjs` 是两类只读分析器共享的本地观察边界：current branch、`refs/heads/main`、`refs/remotes/origin/main` 和 ahead/behind 只读取一次，随后同一对象同时驱动 review/publication 分析。`lib/content/delivery-triage.ts` 要求两份领域报告的 branch、OID、计数、mode/version 完全相同，且 exact pending 身份互斥；复核精确命中时发布报告必须只是 `local-ahead`，发布命中时反之，否则失败关闭。version 1 统一报告只映射 `none`、`review`、`publication` 或 `inspect`，保留完整原领域 pending 证据和既有 status/deliver 命令；非 main 可以识别类型但 `deliverable: false`。`report-content-delivery-triage.mjs` 不 fetch/push、不运行后续命令，synchronized 返回 0，其余返回 1。Obsidian 的 switchyard 复用两个严格领域 parser；它是导航证据，不是第三种写事务或新的授权边界。

`lib/content/author-doctor.ts` 把本机发布前置条件冻结为 Runtime 3、Git 4、Workspace 4、Vault 2 共 13 项。`author-doctor-environment.mjs` 只读 `process.version`、受信 npm CLI、Git version/root/branch/upstream/local tracking、Git identity 是否配置、package scripts、全部声明依赖的已安装精确版本、五个固定作者路径和插件 manifest/main/styles；姓名与邮箱值不会进入 observation。Windows 不通过 shell 执行 `npm.cmd`，而是用当前 Node 直接运行受信 `npm-cli.js`。同步基线复用本地 delivery snapshot，不访问远端，也不要求工作区为空。`report-author-doctor.mjs` 输出 version 1 text/JSON，ready 返回 0、attention 返回 1；safety 固定证明零安装、零配置/文件变更、零凭据读取与零网络。Obsidian parser 从 observation 独立重算 13 项状态、summary 与 repair，再用 preflight circuit 展示；结构异常只降级为纯文本。插件 1.20.0 把同一 doctor 作为“检查/发布当前草稿”和“检查/提交当前正式内容复核”四个新事务的前置子进程：调用时冻结 sourcePath；ready 不显示中间 Modal，只启动一次原领域命令；attention 显示带 `TRANSACTION INTERLOCK / HELD`、操作名与来源路径的同一 circuit 并停止；不可信 JSON 先降级纯文本再失败关闭，doctor 致命退出同样不进入领域命令。

四个入口还共享一个进程内 single-flight lease。租约在 doctor spawn 前占用，以对象身份绑定当前 transaction 与 owning child；ready continuation、author-doctor 纯文本降级和 review Proof 纯文本降级都会把 ownership 原子转交给新 child。任一终态只在 `lease.child` 仍等于结算 child 时释放，因此旧 error/close 不能清除后来事务的租约；同步 spawn 失败、非零退出、成功回调异常与插件卸载也显式释放或作废。租约创建时固定 `startedAt`、`phaseEnteredAt`、`lastOutputAt: null` 与 `preflight`；ready 转入 `domain`，两类结构化证据失败转入 `diagnostic`。阶段转换必须匹配当前 lease identity，单调更新时间并重置 `lastOutputAt`；child 转交也重置输出证据。只有 lease 与 owning child 都完全相同时，stdout/stderr 才能更新最近输出时间，且记录发生在 200,000 字符正文截断判断之前。`getAuthorTransactionSnapshot` 只接受当前 lease identity，把 operation/sourcePath、phase、startedAt、phaseEnteredAt、lastOutputAt 和查询时钟派生的非负 total/phase/silent duration 复制成冻结快照；时钟回拨统一钳制为零。

1.18.0 在同一个 owner-checked release 点生成一条进程内 terminal receipt。`recordAuthorTransactionReceipt` 只接受当前 lease 与固定 outcome allowlist，把 operation、sourcePath、final phase、startedAt、单调 endedAt 和非负 elapsed 复制为冻结对象，再清空 lease。allowed exit + 正常结果为 `completed`；author preflight attention 或不可信结构化 doctor 后的文本证据为 `held`；非允许退出码、同步/异步启动失败、成功回调处理异常与插件卸载分别是 `command-failed / start-failed / result-failed / unloaded`。ownership 已转交时，旧 child 的 finally release 返回 false，不能写回执；新事务 active 时实时 snapshot 优先，空闲时“查看当前作者事务”才显示 `IDLE · LAST RECEIPT`。回执只保留一条、只驻留当前插件实例，不含 stdout/stderr、exit summary、PID 或 Git 凭据，不持久化，也不自动重试、恢复或 push。显式 doctor、只读报告、统一分诊、领域状态与两类 deliver 继续绕过租约，使诊断与恢复保持可用。

1.19.0 在同一 CommonJS 插件内增加独立的 draft origin transaction，但不复用发布子进程 lease：`DRAFT_CREATION_KINDS` 只映射 Article/TIL/Project 到三个固定 Vault template path。输入先冻结为 trim 后 1–120 字符的单行标题与 1–80 字符小写 ASCII slug；路径集合固定为 inbox/posts/projects 同 slug Markdown。模板读取使用 `vault.cachedRead`，并严格要求 frontmatter 边界、唯一空标题、唯一 slug token、三个日期 token、draft/featured 和类型特征行；任何其他 Mustache token 失败关闭。渲染用 JSON 双引号字符串作为 YAML 标量、上海当天替换日期，然后再次检查全部路径并调用一次排他的 `vault.create`。Modal 级同步 submitting guard 防重复触发；并发 Modal 最终仍由 `vault.create` 的已存在错误仲裁。创建失败不写半文件、不覆盖；创建成功后的 `openFile` 属于次级便利，失败只返回 `opened=false`，保留已创建文件并由 Notice 告知路径。该路径不 spawn、不读取 Git、不进入 author lease、不暂存、不发布、不联网。

1.20.0 将 draft identity 从“文件名 + frontmatter slug”降为单一安全文件名。三个模板和渲染器都拒绝顶层 `slug`，`prepareObsidianNote` 继续从 `content/inbox/<slug>.md` 派生正式目标，因此新建与发布共享同一身份来源。改名命令只对桌面端活动的 `TFile` 且精确匹配小写 ASCII inbox Markdown 开放；输入必须不同、最多 80 字符，并在任何读取前通过 inbox/posts/projects 碰撞门。随后 `vault.read` 读取直接磁盘正文，`getFrontMatterInfo` + `parseYaml` 要求合法映射、`draft: true` 且无旧式 `slug`；异步边界后再次核对碰撞和同一来源对象。每次事务只调用一次 `fileManager.renameFile`，它负责按 Obsidian 设置更新内部链接。独立 `draftRenameLease` 在首个 await 前占用，Modal 还有同步 submitting guard；因此多窗口和双击都不能并发进入宿主写 API。调用异常或后置条件不能同时证明旧路径为空、新路径为精确 `TFile` 时，结果标为 uncertain，释放 lease 但不自动重试、回滚、复制或修改正文。该事务不进入发布 author lease，不 spawn、不读 Git、不暂存、不发布、不联网。

1.21.0 在同一文件名身份模型上增加旧草稿取证，而不重新引入双字段写事务。“检查当前草稿身份”固定活动安全 inbox `TFile`，以 `vault.read`、`getFrontMatterInfo` 和 `parseYaml` 分离磁盘正文、YAML 语义与原始表示；同时观察 posts/projects 同名路径。只有 `draft === true`、顶层字符串值等于文件名、且原始行精确为 `slug: <filename>` 时才产生 cleanable report。缩进、引号、注释、anchor/tag、重复/非字符串/不匹配字段和正式碰撞都只读。清理拥有独立 `draftIdentityCleanupLease` 与 Modal guard，执行前复核活动对象、观察正文和命名空间，然后只调用一次 `vault.process`；同步 callback 要求最新 data 与观察正文全等，再返回只删除一行的结果。插件不用 `processFrontMatter`、`vault.modify` 或 Adapter，完成后同时核对 process 返回值、再次 read 的磁盘字节和 filename-owned 分析；无法证明或宿主拒绝均为 uncertain，不重试、不回滚。该路径不进入 author lease，不 spawn、不触碰 Git/发布/网络。

1.22.0 没有在插件中再解析 Markdown 或 YAML，而是把 `prepareObsidianNote` 已验证的事实提升为 version 1 inbox evidence。正式链接验证循环返回渲染器等价的站内引用次数；`inspectDraft` 从正式 `PostRecord`/`ProjectRecord` 写入 Article/TIL/Project 和日期，同时继续复用附件归一化、真实媒体候选、目标碰撞与跨草稿共享源判断。插件冻结活动安全 inbox `TFile` 后运行 `npm --silent run content:inbox -- --format json`，严格验证顶层版本/mode/safety、全部 entry 的字段、路径、媒体包络、issue、状态/日期和聚合计数，再且只选择一个精确来源。命令结算时活动对象、路径或 Vault 映射变化会拒绝；JSON 不可信也不降级到全库文本，因为那会丢失“当前草稿”语义。成功 Modal 只有只读 `DRAFT → PUBLIC`、TYPE/DATE/MEDIA/LINKS 与阻塞证据；它不进入 author transaction lease、不调用 Vault 写 API、不 reconcile、不发布、不提交、不 push、不联网。

1.23.0 在同一 evidence producer 中加入可选 `sourcePath`，而不是为插件创建第二个扫描器。目录枚举、正式内容链接目标、Git 跟踪清单和每篇 `prepareObsidianNote` 仍执行一次；`inspectDraft` 将目标/附件存在性和跟踪判断留在媒体派生之前，再由 `deriveMedia` 只允许目标来源调用 `prepareMediaForPublishing`。所有 entry 完成后先应用共享附件问题，再筛选精确来源并重算 counts；来源不安全、不存在或无法唯一命中即失败。默认 `sourcePath` 缺省时执行路径、version 1 schema 和全部媒体派生不变。CLI 只增加固定 `--source`；插件把冻结路径作为独立参数传入，并拒绝 entries 数量不是 1 的报告。可注入 media preparer 只作为库级测试缝，测试记录目标调用并用真实策略生成候选，从而直接证明无关附件未进入昂贵阶段。

`scripts/publish-note.mjs` 在 `--push` 读取源草稿前要求发布交付状态 synchronized；若已经存在精确 pending-publication，会明确阻止第二次发布。完整质量门前后再次锁定 local/tracking/HEAD 基线，漂移时回滚文件与媒体事务。创建 commit 后重新读取原子发布包，要求 slug、parent、正式 blob、可选源删除和全部媒体清单都对应本次准备结果；首次 push 也使用 `git push origin <commitOid>:refs/heads/main`。push 失败保留本地 commit 并引导运行只读 status；作者确认 exact envelope 后再显式运行独立 deliver。首次 push 成功后必须重新观察 synchronized 且 local/tracking 都等于原 OID。

发布器先在仓库内 `node_modules/.cache/myblog-publish-*` 创建同盘 staging。每个静态 PNG/JPEG/WebP 都先自动校正 EXIF 方向，以固定 quality 82、alpha quality 100、effort 6 的 Sharp 参数生成 WebP，并在 staging 中重新执行公开预算检查；满足预算且重编码不会更小的已有 WebP 保持原字节。GIF、AVIF 和动画 WebP 不改变字节，但必须先满足公开预算。`--check-only` 完成同样的派生并报告源/产物差异，然后删除 staging，不修改工作区。

正式发布写入目标 Markdown、移除 inbox 草稿后，先把每个原附件 rename 到 staging backup，再把验证过的产物 rename 到最终路径。staging 与工作区同盘，所以安装和恢复不依赖跨卷复制。完整质量门失败时按逆序删除已安装产物、将每个 backup rename 回精确源路径、删除目标 Markdown 并按原文本恢复 inbox 草稿；成功后才删除 backup。预检、目标冲突和 `--push` 暂存区检查都发生在事务之前，避免失败残留。

媒体策略只接受 PNG、JPEG、WebP、GIF 和 AVIF，扩展名必须匹配解码格式。自动优化原图安全包络为 25 MiB、8192×8192 px、4000 万单帧像素；公开单文件上限仍为 3 MiB，宽高上限均为 2560 px，单帧上限 800 万像素，动图上限 8000 万总像素。Studio 在捕获阶段接管 Decap 的本地图片 `change` 事件，先读取 magic bytes、PNG/GIF/WebP 动画结构并用 `createImageBitmap` 解码真实宽高；通过后把同一个 `File` 重新派发给 Decap，失败则清空选择并给出本地 Evidence Rail 诊断。浏览器预检不上传、不重编码、不改变 editorial workflow、per-slug 路径、重名确认或 Git 回滚语义；JPEG/PNG 需要自动 WebP 时仍使用 Obsidian 发布器。动画 AVIF 因浏览器端不能可靠计帧而 fail closed。构建扫描仍是所有入口的权威门禁。Sharp 的 libvips 缓存在短命发布/校验进程中关闭，避免 Windows 保留附件句柄。

正式内容的本地图片 URL 必须是 `/uploads/...`，且不能包含查询、锚点、编码路径分隔符、空/`.`/`..` 段或 Windows 非法字符；Markdown 图片必须填写非空 alt。正文的非本地图只允许完整 HTTPS URL：它不加入 `next/image` 的开放远程白名单，而是明确降级为 `loading=lazy`、异步解码、`no-referrer` 的原生图片；公开 CSP 的 `img-src` 只额外允许 `https:`。cover 必须本地化以保证构建期宽高和社交元数据可确定。文件清单保留仓库中的原始大小写，因此 Windows 开发机也能在部署前发现会在 Linux/Vercel 失效的大小写漂移。`public/uploads/<slug>/...` 被视为已归档命名空间，只能由同 slug 的 post/project 正文或 cover 引用；根目录文件只保留给 Obsidian inbox 与媒体库暂存，不能被正式 posts/projects 引用，也不会被自动删除，而是进入独立库存报告供作者复核。正式目录的 draft/future 内容参与所有权，避免编辑分支在公开前被门禁阻断；`content/inbox` 只参与根暂存报告，不参与正式所有权关系。

同一发布阶段还会读取 `content/posts` 与 `content/projects` 的稳定文件名和正文，把 Obsidian Wiki/Markdown 笔记链接转换为站点 URL。裸 slug 只有在文章和项目之间唯一时才可使用；显式 `posts/<slug>`、`projects/<slug>`、别名和标题链接均受支持，块引用被明确拒绝。转换后用目标正文的实际 heading inventory 校验 fragment，所以 `--check-only` 与 inbox readiness 无需先写正式文件即可发现标题漂移。转换跳过行内代码和围栏代码，避免把教程中的语法示例当成真实关系。

`lib/content/markdown.ts` 以与渲染相同的 GFM AST 抽取行内、引用式和自引用链接，并按 H1–H6 全局顺序生成与 `rehype-slug` 一致的 heading id；`lib/content/relations.ts` 校验目标页面、URL 编码和 fragment 后，一次派生 `outgoingByUrl`/`backlinksByUrl`。关系按内容 URL 去重，自引用和 fragment 不制造额外图边。`lib/content/index.ts` 只暴露两个只读查询，文章与项目详情页在服务端把它们交给同一 Reference ledger：`→` 追溯当前正文引用的依据，`←` 继续阅读引用当前记录的后续实践；空方向省略，两侧都空时不产生账本。关系不存入 frontmatter、客户端状态或数据库，正文链接就是唯一事实源；草稿或未来目标不在公开集合中，因此公开内容不能引用尚未公开的目标。

## 6. 安全与缓存

`next.config.ts` 为所有响应声明 CSP、HSTS、`nosniff`、`DENY`、权限策略、来源策略和 COOP，并关闭 `X-Powered-By`。公开 HTML 使用浏览器复核、CDN 一小时缓存与一天 stale-while-revalidate；Studio HTML、配置、预览 CSS、OAuth 和未知 Studio 路径必须包含 `no-store`。版本化且带 SRI 的 CMS 运行时使用一年不可变缓存。

一般页面的 COOP 为 `same-origin`；Studio 与 OAuth 为 `same-origin-allow-popups`，以允许 GitHub OAuth 弹窗完成握手。Studio CSP 不允许第三方脚本源，只额外允许 GitHub API、GitHub 授权页和头像来源；`unsafe-eval` 例外被限制在 Studio 路由，因为固定版本 Decap 编辑器/解析器需要运行时求值。

## 7. 部署与回滚

Vercel GitHub Integration 负责每个分支的 Preview 和 `main` 的 Production，不再维护重复的部署 Action。GitHub `deployment_status` 成功事件触发生产冒烟，检查代表页面、全 Sitemap、Studio/OAuth、Feed、安全头和 404。

Quality、生产冒烟与回滚工作流均使用 Node 24 runtime 的 checkout/setup-node v6，但实际执行仓库脚本时仍固定 Node.js 22。显式 `cache: npm` 避免 setup-node major 的自动缓存探测改变现有行为；GitHub-hosted runner 由平台维护，不引入自托管 runner 版本责任。升级 action 时必须先更新结构契约测试，再同时验证 push、定时触发结构、deployment status 与手动回滚权限。

紧急恢复使用 Vercel Instant Rollback。仓库内手动工作流调用固定版本 Vercel CLI，回滚后对稳定生产域名重跑同一冒烟；Git 历史随后通过 revert 或修复提交恢复一致性。

## 8. 不变量

- GitHub 仓库是内容、附件、版本和回滚的唯一事实源。
- 稳定 URL 来自文件名/slug，不随日期和平台变化。
- 必要的 URL 迁移必须登记为有日期和原因的单跳永久重定向；来源不能遮蔽现有路由或文件，目标必须在同一构建中公开。
- 草稿、未来内容不能进入页面、搜索、RSS 或 Sitemap。
- 公开站内链接必须指向同一构建中的公开文章或项目；详情页 outgoing/backlinks 与 `/knowledge` 的节点、边和孤立状态只能从同一正文链接集合派生。
- 公开内容必须声明语境和复核日期；Current record 超过 180 天未复核不能进入新部署。
- Current record 的报告状态与构建硬门必须复用同一日龄计算；Historical、草稿和未来内容不进入维护队列。
- `public/uploads` 只能包含真实可解码且扩展名匹配的白名单图片，并满足共享公开媒体预算；Obsidian 自动优化只能从受限原图包络进入 staging，验证产物后才能原子安装。
- 正式 Markdown/cover 的每个本地图片必须精确存在；已归档附件必须由同 slug 内容引用，代码示例不能形成媒体所有权。
- 正式 Markdown/cover 不能引用根暂存图片；Studio 必须先填写稳定 slug，再把媒体直接写入同 slug 归档目录。
- 根暂存媒体必须可由确定性报告区分引用、共享、未引用、陈旧与缺失；报告不得自动删除作者文件或把提醒升级为构建失败。
- inbox 就绪报告必须逐篇隔离错误、真实派生媒体候选并识别目标/共享源冲突；无论 ready、scheduled 或 blocked 都不能移动、改写、提交或推送作者文件。
- Studio 新建/复制条目的顶层 slug 在首次保存前可编辑；已有条目必须以 readOnly 控件锁定并继续序列化，身份漂移必须在保存前失败。
- Studio 本地图片进入 Decap 草稿前必须通过与公开媒体策略一致的真实格式、尺寸、体积和动图总像素预检；预检通过后必须透传原始 `File`，不能悄悄改变附件字节。
- Studio 条目媒体必须由稳定 slug 与固定 Decap 文件名规则得到唯一目标；已发布清单不可用时失败关闭，同路径不同 SHA-256 必须明确确认后才能交给 Decap。
- Studio 会话媒体账本只能在合成 change 成功重放后登记；未提交检查、取消确认和重放错误不能改变同路径摘要基线。
- 同一 Studio file input 只有最新真实 change 可以报告最终状态、重放文件或提交账本；任何旧异步结果都不能清空或覆盖最新选择。
- fenced code 的服务端 HTML 必须始终保留完整 pre/code；COPY 只在 hydration 后出现，复制源只能是当前 code textContent，inline code 不得获得控件。
- Markdown H2/H3 永久链接必须直接使用 renderer 已拥有的 id；不得重新 slug、包裹标题 children、要求 JavaScript 或改变目录与内容关系抽取，触控点击区不得小于 44px，打印不得输出标记。
- Obsidian 行内/块级公式必须在构建期通过受限 KaTeX 解析，并由服务端输出 HTML + MathML；公式源码不得制造链接/图片关系，长公式只能让自身滚动，不能增加 320px 页面根宽，打印不得裁切或依赖 JavaScript。
- Studio 公式预览必须复用生产 Markdown/KaTeX/安全 URL 规则；普通正文零请求，旧异步结果不得覆盖新正文，错误/网络失败不得删除 Markdown；端点只读、同源、限量、不缓存、不索引，长公式不得增加 320px Studio 根宽。
- Studio 条目预检只能发送内容契约白名单字段并复用正式 schema/标签/时效/公式规则；快速输入只允许最新结果更新 Author Proof，网络失败不得删除或改写条目；READY 只能表示单条字段通过，不能替代仓库关系、媒体和完整构建门。
- Markdown 图片 alt 不能为空；本地图使用共享固有尺寸与响应式候选，HTTPS 外图不能进入开放优化主机列表。
- cover 必须是仓库内图片并同时声明 `coverAlt`；详情页尺寸只能来自已验证文件，文章/项目共享组件与社交元数据选择不能分叉。
- `/studio` 与 OAuth 永远不缓存、不索引，并维持同源 state 验证；只有版本化 CMS 运行时可不可变缓存。
- 发布平台不能成为写作前置条件；Obsidian 和 Git 提交在本地仍可完成。
- Obsidian 新建草稿只能从三个固定 Vault 模板创建一个 `content/inbox/<slug>.md`；输入、模板结构和 inbox/posts/projects 同 slug 路径必须在写入前验证，最终创建必须排他且不得覆盖；文件创建成功后，自动打开失败不得回删新文件。
- inbox 草稿的 slug 只能来自安全文件名；受信模板不得再声明顶层 `slug`。改名只允许 `draft: true` 且无旧式 slug 的精确 inbox Markdown，目标必须通过三个内容命名空间检查；只调用一次 FileManager，无法证明后置路径时不得自动重试或回滚。
- 每轮结构、设计、技术、功能、方法、验证、经验和风险必须与代码一起归档。
