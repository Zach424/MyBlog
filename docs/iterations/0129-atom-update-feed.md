# Iteration 0129：Atom 更新订阅

## 1. 范围与成功标准

本轮解决“旧内容发生真实修订后，部分只按 RSS `pubDate` 排序的阅读器不会把它重新放到顶部”的发现缺口。新增独立的 Atom 1.0 更新订阅，以标准 `published`/`updated` 同时表达首次发布和真实内容变化；现有根、标签和专题 RSS 的 GUID、首发排序、`pubDate` 与 `dcterms:modified` 语义必须保持不变。

成功标准：

1. 新增公开 `/updates.atom`，只消费当前公开内容集合；
2. Feed 与 entry 满足 Atom 1.0 必填结构、namespace、稳定 ID 和日期语义；
3. entry 按 `updatedAt ?? publishedAt` 倒序，稳定决胜且不修改调用方输入；
4. 首页 head 和 `/subscribe` 能发现 Atom；
5. OPML 明确排除 Atom，避免默认导入两个内容重叠的全站频道；
6. 响应具备准确 MIME、文件名、Link、`noindex`、缓存、SHA-256 ETag、Last-Modified、GET/HEAD 与条件请求语义；
7. Atom 不进入 Sitemap；
8. 先部署功能，再从稳定生产测量 raw/gzip 并纳入结构化发现预算；
9. 六份全局中文文档、本迭代和知识笔记同步写入仓库根 Obsidian Vault；
10. 不增加客户端 JavaScript、依赖、账号、数据库、追踪、邮件投递、第三方服务或手动云配置。

## 2. 项目结构状态

本轮新增：

- `lib/atom.ts`：Atom 1.0 确定性 XML 生成器与共享 HTTP 响应边界；
- `app/updates.atom/route.ts`：公开 Route Handler，只传入可信 origin 与 `getAllContent()`；
- `tests/atom.test.mjs`：排序、必填元素、日期、转义、分类、输入不变、摘要验证器与日期验证器；
- 本文件与 `docs/knowledge/0129-one-content-set-can-have-two-time-orders.md`。

本轮修改：

- `lib/feed-http.ts`：Feed 表示类型扩为 Atom/JSON/RSS，并公开 ISO `createFeedUpdatedAt()`；
- `lib/subscriptions.ts`、`app/subscribe/page.tsx`：只读通道由六条扩为七条；
- `app/layout.tsx`：首页 metadata 增加 `application/atom+xml` alternate；
- `scripts/smoke-production.mjs`：增加 Atom 生产协议、排序、跨格式、条件 GET/HEAD、发现与排除验证；
- `scripts/discovery-budget.mjs`：增加第十一个稳定生产端点基线；
- `tests/subscriptions.test.mjs`、`tests/opml.test.mjs`、`tests/rendered-html.test.mjs`、`tests/discovery-budget.test.mjs`、`tests/deployment-tools.test.mjs` 与 `package.json`：扩展失败优先、应用、部署和预算门；
- `docs/STATUS.md`、`docs/ROADMAP.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/OPERATIONS.md`、`docs/QUALITY.md`：更新全局结构、设计、运行和质量事实。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

```text
同一公开 ContentRecord 集合
├─ RSS：publishedAt 倒序
│  ├─ pubDate = 首次发布
│  └─ dcterms:modified = 可选真实更新
│
└─ Atom：updatedAt ?? publishedAt 倒序
   ├─ published = 首次发布
   ├─ updated = 真实更新或首次发布
   └─ summary/content/category = 描述/纯文本正文/标签
```

RSS 和 Atom 不是两份内容事实，而是同一集合的两种读者任务投影：RSS 回答“最近首次发布了什么”，Atom 回答“最近真正改了什么”。因此两者在 `/subscribe` 并列，由读者主动选择；OPML 仍只聚合根、标签和专题 RSS，不自动加入 Atom，避免导入后收到两个全站频道的重叠提醒。

Atom 端点没有站点壳、卡片、动画或客户端状态。Feed 使用站点 title/description、唯一 feed URL、self/alternate、作者和 icon；entry 使用规范内容 URL 同时作为永久 id 与 HTML alternate。正文使用 `content type="text"`，由既有 Markdown 纯文本投影生成，阅读器无需执行站点脚本；summary 和 category 继续使用作者已有事实，不制造“更新”标签。

## 4. 使用的技术

- Next.js 16.3 App Router 与 Route Handler；
- TypeScript、Node Web `Request`/`Response`；
- [RFC 4287：The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)；
- Atom namespace `http://www.w3.org/2005/Atom` 与 `application/atom+xml`；
- RFC 3339 日期：entry 使用作者上海日界线的 `+08:00`，feed 表示修订使用 UTC `Z`；
- XML 文本/属性统一转义；
- 既有 Markdown AST 纯文本转换与内容 tags；
- 最终 UTF-8 正文 SHA-256 ETag；
- `If-None-Match` 优先、`If-Modified-Since` 回退、GET/HEAD、200/304；
- Node test、ESLint、TypeScript、Next production build；
- Python `xml.etree.ElementTree` 独立解析生产 XML；
- Vercel 稳定生产 origin、UTF-8 raw 与 Node zlib gzip 双层预算；
- `research-iteration-loop` 的执行—验证—部署—复盘—下一步流程。

实现前完整阅读当前 Next 16.3 本地 Route Handler 与 route 文件约定文档，并核对 RFC 4287 官方规范，没有依赖旧版本框架记忆或第三方摘要。

## 5. 实现的功能

1. 新增 `/updates.atom`；
2. Feed 声明 Atom 1.0 namespace 与 `xml:lang="zh-CN"`；
3. Feed 恰有一个 title、subtitle、id、updated 与 author；
4. Feed 提供 self、HTML alternate 与站点 icon；
5. 每个公开内容生成一个 entry；
6. entry 的 id 和 alternate 使用同一规范内容绝对 URL；
7. `published` 永远保留首次发布日期；
8. `updated` 使用 `updatedAt ?? publishedAt`；
9. entry 按真实变化、首发日、中文标题、英文 URL 稳定决胜；
10. summary 使用 description，content 使用 Markdown 纯文本；
11. category 与 JSON Feed tags 数量、顺序和值一致；
12. 输入记录数组不会被排序器修改；
13. 首页自动发现 Atom；
14. `/subscribe` 增加第七条“更新阅读器”通道；
15. OPML 和 Sitemap 明确排除 Atom；
16. 响应提供准确 MIME、`updates.atom` 文件名、self/alternate Link 与 `noindex`；
17. Feed 表示修订与最新内容日期共同派生 feed `updated` 和 HTTP Last-Modified；
18. 最终正文派生强 SHA-256 ETag，并支持 ETag/日期条件 GET/HEAD；
19. Atom 进入第十一个结构化发现传输预算。

## 6. 实现方法

先写失败优先证据。旧实现的 Atom/订阅/OPML/部署定向测试为 9/12：`lib/atom.ts` 不存在、订阅目录没有 Atom、production smoke 不认识该端点。真实 Next 应用测试为 32/35：`/subscribe` 仍只有六条通道、`/updates.atom` 返回 404、公开 HEAD 矩阵没有 Atom。这些失败分别证明纯序列化、可见入口和实际 HTTP 边界都缺失。

实现保持三层职责：`createAtomXml()` 只做确定性排序与 XML；`createAtomResponse()` 只做缓存、表示元数据、摘要和条件读取；Route Handler 只提供公开记录与可信 origin。`createFeedUpdatedAt()` 把格式修订 `2026-08-11T00:13:39Z` 与公开记录的最新内容日组合，使 feed `updated` 和 Last-Modified 共享同一可审计事实，又不把构建或部署时间伪装成内容时间。

生产 smoke 不维护第二份固定 entry 清单，而是从同一生产 JSON Feed 读取 id、发布日期、修改日期、标题和 tags，按 Atom 的公开决胜规则派生期望顺序，再逐项比较 Atom。它同时验证首页自动发现和 OPML 排除，确保“可选择 Atom”不会退化为“默认双订阅”。

功能提交先部署。第 1–6 次生产探测仍为旧版本 404，第 7 次返回 200 且 Last-Modified 精确匹配新表示，随后完整 smoke 通过。只有这时才从稳定 origin 测量正文，写入预算来源、基线、上限和恰好一次覆盖门。

## 7. 验证证据

- 失败优先：Atom/订阅/OPML/部署定向旧实现 9/12，真实应用旧实现 32/35；
- 定向实现测试：13/13；
- `npm run lint`：通过；
- `npm run typecheck`：通过；
- `npm run test:unit`：536/536；
- `npm run build`：66 个生成页面，正式路由表包含 `/updates.atom`；
- `npm run test:app`：35/35；
- Python 独立解析稳定生产：Atom namespace 正确、4 个 entry，首项 `/projects/myblog`、末项 `/posts/project-charter-before-homepage`；
- 功能提交：`7e5909f`（`feat: publish update-first Atom feed`），已推送并进入稳定生产；
- 稳定生产 smoke：27 routes、OAuth 302，七通道目录与 Atom 全部协议断言通过；
- 稳定生产 Atom：4 个 entry、21338/10063 B（raw/gzip）；
- 正文 SHA-256：`a9564d43d1b2fc04cf77812431837c3a1820d2ccdf37269f6bf9278da823671f`；
- 线上边缘 ETag：`W/"sha256-a9564d43d1b2fc04cf77812431837c3a1820d2ccdf37269f6bf9278da823671f"`；
- Last-Modified：`Tue, 11 Aug 2026 00:13:39 GMT`；
- Atom raw/gzip 上限：32768/15360 B，线上余量分别为 +11430/+5297 B；
- 十一个结构化发现端点全部 PASS；
- 预算提交：`fd359c1`（`test: baseline Atom discovery budget`），已推送；
- 无依赖、客户端 JavaScript、账号、数据库、追踪、第三方服务或云配置变更。

## 8. 经验与教训

1. 同一内容集合可以有多个合法时间顺序，排序必须围绕读者任务命名；
2. `published` 与 `updated` 应并存，不能通过篡改首次发布日期制造更新提醒；
3. 新协议不应破坏已公开协议，RSS 的 GUID、`pubDate`、排序和扩展保持原样；
4. Feed 级更新时间与 entry 级内容时间是不同层次，前者还必须覆盖表示格式修订；
5. 永久 Atom id 应复用稳定规范内容 URL，不能使用构建号或当前时间；
6. 全文 Feed 仍应使用已有纯文本投影，避免在阅读器中传播站点 HTML 或脚本；
7. 跨格式测试应从生产事实派生期望顺序，而不是维护第二份手写 URL 列表；
8. 可见入口和自动发现解决“如何找到”，OPML 是否包含解决“默认导入什么”，两者不能混为一谈；
9. 两个内容重叠的全站频道可以同时提供，但不应默认批量导入；
10. XML 单元断言之外还需要独立解析器检查，避免正则测试与生成器共享盲点；
11. 日期验证器必须来自可审计表示修订与内容事实，不能使用部署时间；
12. Vercel 会弱化压缩表示的 ETag，生产门应比较 opaque SHA-256 而不是强弱前缀；
13. 先部署、再冻结预算，确保来源确实是稳定生产正文；
14. 全文 Atom 与 JSON Feed 都会随内容线性增长，需要各自独立 raw/gzip 门；
15. 终端错显中文时应读取 UTF-8 原始字节复核，不能把控制台编码问题误判为源码污染；
16. Obsidian 状态、迭代、知识笔记与代码继续共享同一 Git 历史。

## 9. 全局状态、风险与未解决问题

当前读者可以选择根 RSS 跟踪首次发布、Atom 跟踪真实内容修订、标签/专题 RSS 跟踪局部频道，也可以用 OPML 一次导入全部 RSS。本站能保证 XML、时间与跨格式数据正确，但不能保证每个阅读器的提醒策略、全文展示、分类界面或强弱 ETag 实现完全一致。

Atom 与 JSON Feed 都携带 4 条纯文本全文，当前体积远低于预算，但会随正文数量和长度线性增长；达到门限后应先依据真实阅读任务评估最近 N 条或摘要 Feed，不能直接抬线。新增 scoped Atom 会和现有标签/专题 RSS 形成更大的重叠矩阵，当前没有足够产品价值，不做机械复制。

更重要的全局缺口重新回到用户主目标：写作系统已经支持 GFM 表格、代码、图片、脚注、公式和打印，但还缺少类似飞书文档的信息块、图表、视频等结构化富内容。任意 HTML/iframe 会扩大安全、预览和可移植性边界，下一步应先从受限且 Obsidian 兼容的 Callout 开始。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱继续需要所有者操作或选择，不阻塞当前开发。

## 10. 下一轮唯一主任务

实现 Obsidian 兼容 Markdown Callout：支持一组受限类型与可选标题，服务端输出可访问的语义信息块；普通 blockquote 必须保持原样，搜索/源文/打印/深浅色/320px 与 Studio 预览必须一致。先建立失败优先解析和渲染契约，再选择最小实现；不得开放任意 HTML、iframe、客户端脚本、外部嵌入或云服务。
