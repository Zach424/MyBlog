# Iteration 0121：RSS 修改时间语义

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

JSON Feed 已为条目提供 `date_modified`，可见 `/activity` 也能区分首发与更新，但 RSS item 只有 `pubDate`。把 `pubDate` 直接替换为更新时间会破坏首发事实，并可能使阅读器把旧文章误判为新文章；把 Atom 元素任意塞进 RSS item 又不符合 Atom 内容模型。本轮目标是在不改变现有身份和排序的前提下，为 RSS 增加标准、可选、可忽略的逐条修改时间。

成功标准是：只为 `updatedAt > publishedAt` 的公开记录输出修改时间；`guid`、`pubDate`、条目顺序、频道 `lastBuildDate` 与 JSON Feed 既有字段保持不变；XML 命名空间合法；同日或无更新不输出；不出现 item 级 `atom:updated`；单元、真实 Next 应用与生产 smoke 都逐项核对；以已部署功能提交重测全部七个结构化发现端点；不新增 UI、客户端代码、依赖、数据库、账号、追踪、第三方服务或云配置。

## 2. 项目结构状态

- `lib/discovery.ts`：新增 RSS 修改日期投影，并在 RSS 根元素声明 Dublin Core Terms 命名空间；
- `tests/discovery.test.mjs`：用失败优先夹具覆盖严格更晚、同日、缺失更新、首发时间、GUID 顺序和输入不变；
- `tests/rendered-html.test.mjs`：在真实 Next 输出中逐 item 对齐 RSS 与 JSON Feed 时间；
- `scripts/smoke-production.mjs`：在线验证命名空间、逐项时间、无错误 Atom 元素、ETag、304、缓存与预算；
- `scripts/discovery-budget.mjs`：冻结功能提交 `97eabce` 的七端点生产基线；
- `tests/discovery-budget.test.mjs`：锁定来源提交、日期、七个实测值和公式派生上限；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/OPERATIONS.md`、`docs/QUALITY.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步架构、设计、运行、质量、状态与下一主线；
- `docs/knowledge/0121-rss-extension-and-feed-time-semantics.md`：新增 Obsidian 经验笔记；
- 本文件：归档本轮完整证据。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

这是机器协议增强，不改变任何可见页面。时间职责保持分层：

```text
pubDate             = 首次发布时间，稳定保留
dcterms:modified    = 严格更晚的修改时间，可选扩展
channel lastBuildDate = Feed 当前构建所反映的最新内容日期
JSON Feed date_modified = 原有逐条修改字段
```

RSS 根元素新增 `xmlns:dcterms="http://purl.org/dc/terms/"`。条目形式为：

```xml
<item>
  <guid isPermaLink="true">…</guid>
  <pubDate>Sat, 18 Jul 2026 00:00:00 GMT</pubDate>
  <dcterms:modified>2026-08-05T00:00:00Z</dcterms:modified>
</item>
```

不理解扩展的阅读器可以忽略该元素并继续按 RSS 2.0 消费；理解 Dublin Core Terms 的解析器可以读取修改时间。站点不承诺每个阅读器都会在 UI 中显示或触发通知，只承诺输出合法、可解析、与 JSON Feed 对齐的机器事实。

## 4. 使用的技术与规范

- Next.js 16.3 Route Handler 与纯字符串生成；
- TypeScript `ContentRecord` 与现有确定性排序；
- RSS 2.0 XML namespace 扩展；
- Dublin Core Metadata Terms `modified`；
- RFC 3339 UTC 日期格式；
- Node test、ESLint、TypeScript、Next production build；
- SHA-256 ETag、条件读取与 Vercel 生产 smoke；
- `Buffer.byteLength`、Node `gzipSync` 与七端点发现预算；
- PowerShell 标准 XML 解析器的线上结构复核；
- `research-iteration-loop` 的执行—验证—复盘流程。

主要规范证据：

- [RSS 2.0 Specification](https://www.rssboard.org/rss-specification)：RSS 可通过有命名空间的模块扩展；
- [DCMI Metadata Terms: modified](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/terms/modified/)：定义为资源发生变化的日期；
- [DCMI Metadata Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/)：`/terms/` 命名空间可用于非 RDF XML；
- [RFC 4287: The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)：`atom:updated` 属于 Atom feed/entry 内容模型；
- [Python feedparser Dublin Core namespace implementation](https://github.com/kurtmckee/feedparser/blob/develop/feedparser/namespaces/dc.py)：为常用解析器能识别 `dcterms:modified` 提供具体兼容性证据。

## 5. 实现的功能

1. RSS 根元素声明 Dublin Core Terms 命名空间；
2. 严格更晚的更新日输出 RFC 3339 UTC `dcterms:modified`；
3. 无更新和同日更新均不输出修改元素；
4. `pubDate` 始终保留首次发布时间；
5. `guid`、条目顺序与输入数组保持不变；
6. 频道 `lastBuildDate` 与 JSON Feed 行为保持不变；
7. 明确禁止 RSS item 级 `atom:updated`；
8. 本地真实应用逐 item 对齐 RSS `pubDate`/`dcterms:modified` 与 JSON Feed `date_published`/`date_modified`；
9. 生产 smoke 在线验证 XML、协议字段、ETag、304、缓存和预算；
10. 七端点基线用同一已部署功能提交统一重测。

## 6. 实现方法

先在 `tests/discovery.test.mjs` 增加期望：根命名空间存在，严格更晚更新有修改时间，同日与缺失更新没有，`pubDate` 不变，GUID 顺序不变，输入数组不被排序器改写，且不存在 `atom:updated`。旧实现首先因缺少 `xmlns:dcterms` 失败，证明新测试确实约束目标能力。

实现只增加一个最小纯函数：当 `record.updatedAt && record.updatedAt > record.publishedAt` 时复用 JSON Feed 的 RFC 3339 日期格式化，否则返回 `undefined`。RSS item 在原 `pubDate` 之后条件插入 `dcterms:modified`；根 `<rss>` 同时保留 Atom self-link 命名空间并新增 Dublin Core Terms 命名空间。

真实应用测试不只搜索 XML 子串，而是按 item 块读取 GUID、首发时间和修改时间，并与同一请求 origin 的 JSON Feed items 对齐。生产 smoke 使用同样的跨格式关系：RSS 与 JSON Feed 必须条目数量一致、顺序一致、首发时间一致，且只有严格更晚的 JSON 修改时间才对应一个 RSS 修改元素。这样避免“XML 看起来有字段，但字段属于错误条目或改写了发布日期”的假绿。

预算继续采用“功能先部署，生产实测后冻结”。功能提交 `97eabce` 上线且生产 smoke 通过后，才把七个端点全部按同一次响应重测并由 `52d6a18` 固定；Sitemap 的既有可解释增长也在这次统一测量中被正确吸收，而不是只抬高 RSS 单路阈值。

## 7. 验证证据

- 失败优先：旧生成器缺少 `xmlns:dcterms` 时目标测试按预期失败；
- `npm run typecheck`：通过；
- `npm run lint`：通过；
- `npm run test:unit`：524/524；
- `npm run build`：52 个页面；
- `npm run test:app`：30/30；
- 功能实现后的本地 RSS：3426/1289 B（raw/gzip），在新生产基线与推导上限内；
- 功能提交：`97eabce`（`feat: publish RSS modification dates`），已推送并部署；
- 预算提交：`52d6a18`（`test: rebaseline RSS discovery output`），已推送；
- 稳定生产 XML 解析：4 个 item、4 个 `dcterms:modified`、0 个 item 级 `atom:updated`；
- 稳定生产 smoke：27 routes、OAuth 302，十三条 HTML 与七个发现端点全部 PASS；
- 生产 RSS：3536/1298 B（raw/gzip），上限 8192/2560 B；
- 七个生产基线：清单 3009/921、Schema 3278/755、JSON Feed 20697/9876、RSS 3536/1298、Sitemap 5059/532、robots 155/127、OpenSearch 700/462 B（raw/gzip）；
- 最终响应 SHA-256 ETag、Vercel 强弱等价、空 304 与缓存策略继续通过；
- `git diff --check`：通过；
- UI、客户端 bundle、页面路由与内容 frontmatter 未改变。

## 8. 经验与教训

1. “发布时间”和“修改时间”是两个事实，不能为了提醒更新而覆盖首发字段；
2. RSS 2.0 的扩展必须有正式命名空间，不能发明无命名空间元素；
3. Atom 元素的名字看似合适，也不能脱离 Atom 的内容模型随意复用；
4. 可选 XML 扩展应允许旧客户端忽略，基础 RSS 仍必须完整可用；
5. `updatedAt > publishedAt` 应在生成边界明确表达，避免同日更新制造无意义噪声；
6. 跨格式测试应按同一 item 身份对齐，而不是分别统计字段数量；
7. parser 源码能提供具体兼容性证据，但不能外推为所有阅读器都会展示；
8. XML 字符串断言之外还要用标准解析器验证命名空间和结构；
9. ETag 应由最终字节派生，新增命名空间和字段后自然换值；
10. 协议增长同样属于产品变化，必须经过真实生产测量与预算归档；
11. 统一重测全部端点可以吸收同一稳定版本的真实状态，避免各基线来自不同部署；
12. Obsidian 知识笔记、项目状态、实现和生产证据继续保存在同一 Git 历史。

## 9. 全局状态、风险与未解决问题

读者和机器消费者现在有三种一致但职责不同的更新时间入口：可见 `/activity`、JSON Feed `date_modified` 和 RSS `dcterms:modified`。首发身份仍由 archive、RSS `pubDate` 和内容排序保持。当前所有四条公开记录都有严格更晚更新，因此生产 RSS 有四个修改元素；未来无更新或同日更新记录不会生成该字段。

Dublin Core Terms 是合法扩展，但 RSS 客户端可以忽略未知 namespace；因此“解析器可以读取”不等于“每个阅读器都会在 UI 里提醒”。如果需要强保证的通知行为，必须先基于真实目标客户端做兼容矩阵，不能继续堆叠替代字段。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择，不进入自动主线。

## 10. 下一轮唯一主任务

评估并实现 Feed 级可信 HTTP `Last-Modified` 与 `If-Modified-Since`。先依据 HTTP 条件请求规范审计现有 `If-None-Match` 助手与 Next.js Route Handler 行为，再从同一公开记录的最新真实日期派生 RSS/JSON Feed 响应头；ETag 条件必须优先，日期条件只在没有 ETag 条件时参与。同步单元、真实 Next、生产 200/304、缓存、预算与中文归档，不为 robots、Schema 或无日期端点伪造时间，也不新增外部服务。
