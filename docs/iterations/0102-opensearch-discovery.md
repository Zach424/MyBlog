# Iteration 0102：OpenSearch 1.1 发现

## 1. 范围与成功标准

本轮只为已有 `/search?q=` 增加标准机器发现入口。迭代前，搜索页已经能在服务端输出首屏结果并在浏览器本地继续筛选，但根 HTML 没有 `rel="search"`，稳定生产也没有 OpenSearch description；浏览器和兼容工具只能依赖人工导航发现搜索能力。

成功标准是：新增同源 `/opensearch.xml`，符合 OpenSearch 1.1 namespace 与必填元素约束；查询模板只指向当前公开 origin 的 `/search?q={searchTerms}`；根布局输出绝对 `application/opensearchdescription+xml` 发现链接且不丢失 favicon；最终 XML 有准确 MIME、安全文件名、`noindex`、明确缓存、强 SHA-256 ETag 与空 304；端点不进入 Sitemap；纯函数、真实 Next、生产 smoke 和第七路传输预算共同锁定协议。

## 2. 项目结构状态

- `lib/discovery.ts`：新增确定性 `createOpenSearchDescription(siteUrl)` 生成器并复用 XML 转义；
- `app/opensearch.xml/route.ts`：新增动态 Route Handler，提供 XML、缓存、安全响应头和条件读取；
- `app/layout.tsx`：根 metadata 显式保留 PNG favicon，并声明绝对 OpenSearch `rel="search"`；
- `tests/discovery.test.mjs`：新增 OpenSearch 生成器协议单元测试；
- `tests/rendered-html.test.mjs`：锁定首页/搜索结果发现链接、真实路由、ETag/304、响应头和 Sitemap 排除；
- `scripts/smoke-production.mjs`：对实际生产 origin 验证 OpenSearch 文档、HTML 发现、条件请求和传输预算；
- `scripts/discovery-budget.mjs`：结构化发现预算从六路扩为七路，生产来源固定到 `e5bb2a8`；
- `tests/discovery-budget.test.mjs`、`tests/deployment-tools.test.mjs`：锁定第七路基线、覆盖与 smoke wiring；
- README、架构、发现、质量、运维、状态、路线图与索引同步更新；内容 Markdown、搜索算法、Studio、Obsidian 插件、workflow、依赖与 lockfile 未改变。

## 3. 设计内容

OpenSearch 文档保持最小、可验证且同源。`ShortName` 为 `Zach424 Notes`，符合最多 16 个字符的约束；`Description` 复用站点公开说明并进行 XML 转义；HTML `Url` 使用 `rel="results"` 和标准 `{searchTerms}` 占位符；第二个 `Url` 用 `rel="self"` 描述文档自身。示例 Query 为 `typescript`，语言为 `zh-CN`，输入/输出编码均为 `UTF-8`。

根布局不根据请求临时拼 origin，而是复用站点公开 URL 解析结果，输出绝对发现链接。端点本身是机器描述，不是希望被收录的内容页面，所以发送 `X-Robots-Tag: noindex`，并明确排除在 Sitemap 之外。缓存与 Feed/RSS/Sitemap 一致：源响应一小时 fresh、一天 stale-while-revalidate；最终 UTF-8 XML 经共享 helper 产生强 SHA-256 ETag，客户端可用强或弱等价标签获取空 304。

本轮不新增远端搜索 API、建议接口或索引下载。OpenSearch 只是标准地描述原有 `/search`；服务端首屏和本地后续输入仍使用同一 Git 派生搜索文档，不引入数据库、分析服务或第三方查询端点。

## 4. 使用的技术

- OpenSearch Description Document 1.1：namespace、ShortName、Description、Url、Query、Language 与编码契约；
- Next.js 16.3 Metadata `icons.other`：服务端输出 `<link rel="search">`，同时显式保留文件约定 favicon；
- Next.js Route Handler + Web `Request`/`Response`：提供动态、同源的 XML 响应；
- Node SHA-256 与 HTTP `If-None-Match` weak comparison：最终正文身份和条件读取；
- XML 字符转义：站点说明和绝对 URL 均按属性/文本安全输出；
- Node zlib gzip：为第七个结构化端点生成可复现的传输代理；
- Node test、真实 Next production server、GitHub Actions 与稳定 Vercel origin：四层验证；
- `research-iteration-loop` skill：全局复核、失败优先、窄范围实现、生产证据、经验归档和下一轮选择。

## 5. 实现的功能

1. `/opensearch.xml` 发布 OpenSearch 1.1 描述；
2. 搜索模板只指向同源 `/search?q={searchTerms}`；
3. 描述文档声明 self URL、示例查询、中文语言和 UTF-8 编码；
4. 首页、搜索结果页及其他根布局页面输出绝对 `rel="search"`；
5. 新 metadata 设置不会覆盖既有 `/icon.png` favicon；
6. 响应使用准确 OpenSearch MIME、安全内联文件名和 `noindex`；
7. 最终 XML 生成强 SHA-256 ETag，并支持强/弱等价的空 304；
8. 端点保留一小时 fresh/一天 SWR，不进入 Sitemap；
9. 本地真实应用验证 XML 内容、发现链接、响应协议和条件读取；
10. 生产 smoke 以实际 origin 重算正文 SHA-256，并在线验证 304/0 B；
11. 结构化发现预算扩为七路，遗漏、重复、意外端点或超限均失败关闭。

## 6. 实现方法

先读取稳定生产 `/opensearch.xml`、首页和 `/search?q=typescript`：前者为 404 HTML且无 ETag，后两者没有 `rel="search"`。随后在 `tests/discovery.test.mjs` 导入尚不存在的生成器，第一次运行按预期因缺少 export 触发 `SyntaxError`，证明测试能观察到目标缺口。

生成器实现后，Route Handler 复用 `createSha256ConditionalResponse()`，只负责响应边界；XML 内容保持纯函数。第一版真实 Next 集成测试暴露两个框架行为：`metadataBase` 不会自动把 `icons.other` 中的相对 URL 绝对化，且声明 `icons.other` 会覆盖文件约定生成的 icon link。最终改为 `new URL("/opensearch.xml", siteUrl)`，并在同一个 `icons` 配置中显式保留 `/icon.png`，再由集成测试同时锁定二者。

功能提交部署成功后，才从稳定生产逐端点读取同一快照并用 `Buffer.byteLength` 与 `gzipSync` 重测七份正文。前六份与 Iteration 0100 完全一致；OpenSearch 为 700/462 B。预算 provenance 因而固定到功能提交完整 OID，而不是使用本地较短 origin 的 678/448 B 假装生产基线。

## 7. 验证证据

- 失败优先：`node --experimental-strip-types --test tests/discovery.test.mjs` 最初因 `createOpenSearchDescription` 未导出而失败；
- 功能实现定向测试通过；首次真实 Next 集成失败发现相对 discovery URL 和 favicon 覆盖，修正后通过；
- 功能提交前 `npm run release:check`：115.7 秒，483/483 单元测试、49 个构建页面、20/20 应用测试、既有预算全部 PASS、生产依赖审计 0；
- 第七路预算、状态与本归档写入后第二次 `npm run release:check`：116.6 秒，同样保持 483/483、49 个构建页面、20/20、九路 HTML 与七路发现预算全部 PASS、生产依赖审计 0；
- 功能提交：`e5bb2a89439a4e6ef2435200e2735ce225163832`；
- [Quality Gate #191](https://github.com/Zach424/MyBlog/actions/runs/31342310873) 与 [Production Smoke #184](https://github.com/Zach424/MyBlog/actions/runs/31342340530) 均成功；
- 部署后生产 smoke：24 个 Sitemap URL、OAuth 302、OpenSearch XML/HTML 发现/条件读取全部通过；
- 稳定生产 `/opensearch.xml`：200、700 B raw、462 B gzip、SHA-256 `5b39cc5b48f04b164b30e84b7f3fffd9d2ce50b26c6e3ee860409b0b0038e2a4`、同摘要强 ETag、准确 MIME、`noindex`、安全文件名与等价一小时缓存；
- 携带生产响应 ETag 再请求：304、0 B；
- 七路生产基线依次为 3009/921、3278/755、20697/9876、3238/1241、4527/504、155/127、700/462 B（raw/gzip）；
- 第七路预算接入后定向测试 22/22，通过真实应用测试 20/20；本地较短 origin 的 OpenSearch 为 678/448 B，仍使用生产基线推导的 5120/1536 B 上限并保有 +4442/+1088 B 余量。

## 8. 经验与教训

Metadata API 的 `metadataBase` 不是所有 URL 字段的隐式绝对化保证。对协议发现链接，测试最终 HTML 比只检查 metadata 对象更可靠；明确构造绝对 URL 也让域名切换行为可见。与此同时，配置同一 metadata 类别可能替换文件约定输出，而不是与之合并，因此新增能力时必须检查已有 favicon、alternate 和 feed link 没有被静默删除。

新结构化端点的预算不能在部署前猜。XML 包含绝对生产 URL，本地固定测试 origin 天然更短；只有功能提交进入稳定生产后测量，才能为域名和最终字节建立可信 provenance。先提交功能、等待双 Actions、线上重测，再提交预算与归档，是本轮必要的两阶段交付。

标准发现不等于浏览器一定展示安装 UI。不同浏览器对 OpenSearch 的支持和交互不同，本站可验证的是规范文档、HTML link、同源模板和 HTTP 契约；不应把外部客户端 UI 当成生产成功标准，也不应为兼容性暴露内部搜索索引。

## 9. 全局状态、风险与未解决问题

本轮后，站内搜索已同时具备用户导航、可分享查询 URL、服务端首屏、本地后续筛选和 OpenSearch 标准发现。七个结构化端点全部拥有冻结生产预算与条件读取。全局复核得到三个候选：

1. 搜索命中证据高亮：当前结果给出匹配字段说明，但标题、摘要和正文片段没有标示具体命中词；可在不改内容模型和排名的前提下直接提升读者判断效率；
2. OpenSearch suggestions：可增加 `application/x-suggestions+json` 建议端点，但协议支持差异较大，会扩大公开查询契约，收益尚不如改善现有搜索结果；
3. CSP nonce 可行性：`unsafe-inline` 仍是明确安全债，但会影响全部 Next 页面、流式渲染和缓存，需要独立高风险验证，不应与搜索体验混合。

选择候选 1。它是读者可见、局部且可回退的改进，能让新发现入口落到更可解释的结果体验；不依赖账号、外部 API 或所有者手工配置。候选 2 保留到真实客户端需求出现时，候选 3 继续作为独立架构迭代。

## 10. 下一轮唯一主任务

为 `/search?q=` 增加可解释命中证据：保持现有 Unicode NFKC、小写规范化、AND 语义和排名契约，安全地在标题、摘要或正文上下文中标示规范化查询词；服务端首屏与客户端输入必须共享同一表示，不能使用未转义 raw HTML。补齐键盘、屏幕阅读器、空查询、未知查询和多词测试，并在稳定生产搜索路径复核；不改变内容 frontmatter、OpenSearch 协议、作者流程或数据库边界。
