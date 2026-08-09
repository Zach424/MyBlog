# Iteration 0101：结构化发现端点条件读取

## 1. 范围与成功标准

本轮只关闭 Iteration 0100 选定的 HTTP 验证器缺口。稳定生产的 `/feed.json`、`/rss.xml`、`/sitemap.xml`、`/robots.txt` 都有明确正文、MIME 和缓存 TTL，却没有 ETag 或 Last-Modified；清单、Schema 与单篇 Markdown 已经支持增量条件读取，发现协议的缓存语义因此不一致。

成功标准是：四个端点均从最终发送的 UTF-8 正文生成确定性强 SHA-256 ETag；`If-None-Match` 按 GET 弱比较接受精确、`W/`、列表与 `*`；命中返回零正文 304；错值或畸形值返回完整 200；正文、公开内容集合、MIME 和既有 Cache-Control 保持不变。本地锁定完整 304 metadata，生产允许 Vercel 弱化压缩表示的 ETag 或省略 304 representation metadata，但 opaque 摘要、缓存语义和零正文必须等价。

## 2. 项目结构状态

- `lib/http-validators.ts`：新增共享 `createSha256ConditionalResponse()`，复用已有 SHA-256 与 `If-None-Match` 解析；
- `app/feed.json/route.ts`、`app/rss.xml/route.ts`、`app/sitemap.xml/route.ts`、`app/robots.txt/route.ts`：改为通过共享助手构造 200/304；
- `tests/http-validators.test.mjs`：新增共享响应助手的 200、全部匹配形式、错值/畸形值 3 项测试；
- `tests/rendered-html.test.mjs`：在真实 Next production server 上锁定四份正文摘要、原缓存/MIME 与弱标签空 304；
- `scripts/smoke-production.mjs`：线上验证四个最终正文 ETag，并用来源标签再次请求空 304；
- `tests/deployment-tools.test.mjs`：新增 robots 一天 public cache helper 与 smoke wiring 契约；
- `package.json`：新测试纳入 `test:unit`；依赖和 lockfile 未改变；
- README、架构、发现、质量、运维、状态、路线图与本归档同步更新；内容 Markdown、Studio、Obsidian 插件、workflow、Vercel 配置和传输预算基线未改变。

## 3. 设计内容

ETag 必须覆盖实际发送的最终表示，而不是内容记录、更新时间或中间对象。助手先接收 route 已生成的完整 string，再以 UTF-8 SHA-256 产生 `"sha256-<64 hex>"`，从而让 origin、内容、XML/JSON 格式或 robots 文本的任何真实字节变化都自然换标签。

条件判断复用现有 `matchesIfNoneMatch()`：去除强弱前缀后按 opaque tag 比较，接受逗号列表和 `*`，拒绝无法闭合引号的畸形列表。命中时用同一 `Headers` 实例构造 `Response(null, { status: 304 })`，因此源站保留 ETag、MIME 与 Cache-Control；未命中仍返回原正文。Feed、RSS、Sitemap 保持 `public, max-age=3600, stale-while-revalidate=86400`，robots 保持 `public, max-age=86400`。

本轮不新增 Last-Modified。Feed/RSS/Sitemap 可以从内容日期派生某种时间，但 robots 没有统一内容日期事实；为了四端点共享一种真实且可验证的表示身份，只采用最终正文 ETag，不用部署时间或文件 mtime 制造不稳定日期。

## 4. 使用的技术

- Web `Request`、`Response`、`Headers`：Next.js 16.3 Route Handler 的原生动态 GET 边界；
- Node `crypto.createHash("sha256")`：源站与 smoke 对最终 UTF-8 正文独立计算摘要；
- HTTP GET weak comparison：强/弱实体标签共享同一 opaque 表示身份；
- Vercel CDN 等价验证：接受压缩 200 标签弱化和 304 可选 representation metadata 精简；
- Node test + 真实 Next production server + 稳定 Vercel origin：纯函数、路由集成与线上三层证据；
- `research-iteration-loop` skill：单一范围、失败优先、定向/集成/全门、生产复核和唯一下一步。

## 5. 实现的功能

1. JSON Feed 最终 JSON 正文拥有 SHA-256 ETag；
2. RSS 最终 XML 正文拥有 SHA-256 ETag；
3. Sitemap 最终 XML 正文拥有 SHA-256 ETag；
4. robots 最终文本正文拥有 SHA-256 ETag；
5. 四端点均接受精确强标签、弱标签、标签列表与 `*`；
6. 匹配请求返回 304、零正文，并在源站保留原 ETag/MIME/缓存策略；
7. 错误或畸形验证器安全降级为完整 200；
8. 本地真实应用逐端点重算正文摘要，避免只检查 ETag 形状；
9. 生产 smoke 允许 Vercel 强弱转换，但要求相同 opaque SHA-256；
10. 四次条件生产请求独立验证状态、零正文、摘要和正确 TTL；
11. 六端点 raw/gzip 预算继续使用原冻结基线，证明正文没有漂移。

## 6. 实现方法

先对稳定生产四端点读取响应头，确认它们分别具有一小时或一天 public 缓存、准确 MIME，但 ETag 与 Last-Modified 均为空。随后新增测试导入尚不存在的 `createSha256ConditionalResponse`，首次按预期以缺少 export 的 `SyntaxError` 失败。

实现助手后，定向测试用固定正文检查强摘要，并以精确、弱、列表、`*` 四类匹配值验证同一空 304；stale 和引号未闭合的畸形值验证完整 200。四个 Route Handler 只替换 Response 构造方式，不触碰生成器或 cache-control 常量。真实应用测试对四份最终 body 各自重算 SHA-256，再用弱标签请求；这样既覆盖源站强标签，也提前模拟 CDN 弱化输入。

生产 smoke 不相信标签形状本身：先读取完整 200，独立哈希正文并比较强弱归一化后的 opaque tag，再携带真实响应标签发起条件请求。Vercel 可能在 304 中省略 Content-Type，因此它若存在必须与 200 一致，不存在也不失败；ETag、Cache-Control、状态与零正文始终是硬门。

## 7. 验证证据

- 失败优先：`tests/http-validators.test.mjs` 最初因 `createSha256ConditionalResponse` 未导出而失败；
- 条件响应 + 部署工具定向测试：9/9 通过；
- 条件响应与既有清单/Schema/源文验证器回归：13/13 通过；
- 独立 TypeScript、Next build 与真实应用测试：48 个构建页面，20/20 通过；
- 功能提交前 `npm run release:check`：114.3 秒，482/482 单元测试、48 个构建页面、20/20 应用测试、九路 HTML 与六路发现预算全部 PASS、生产依赖审计 0；
- 状态、路线图与本归档写入后第二次 `npm run release:check`：113.8 秒，同样保持 482/482、48 个构建页面、20/20、十五路预算全 PASS 与生产依赖审计 0；
- 功能提交：`2fa01cf7f7c247065708bbca5ab454d28751a61c`；
- [Quality Gate #189](https://github.com/Zach424/MyBlog/actions/runs/31341300888) 与 [Production Smoke #182](https://github.com/Zach424/MyBlog/actions/runs/31341325260) 均成功；
- 部署后独立生产烟测：24 个 Sitemap URL、OAuth 302、九路 HTML 与六路发现预算全部 PASS；
- 生产 `/feed.json` 为 20697 B、强 ETag `78d4…112e`、一小时缓存，条件响应 304/0 B；
- 生产 `/rss.xml`、`/sitemap.xml`、`/robots.txt` 的 200 标签由 Vercel 弱化，opaque 摘要分别为 `c6db…ea4f`、`e9b5…2ad0`、`c836…e923`；条件响应均为 304/0 B，前三者一小时、robots 一天缓存；
- 六份结构化正文 raw/gzip 与 Iteration 0100 基线完全一致，证明本轮没有改变公开正文。

## 8. 经验与教训

验证器应绑定最终表示，而不是“看起来相关”的业务时间。Feed、Sitemap 和 robots 的来源事实不同，但最终字节都存在；正文 SHA-256 因而比部署时间、文件 mtime 或拼凑的 Last-Modified 更统一、更稳定，也能自动覆盖 origin 改变造成的绝对 URL变化。

CDN 等价不等于响应头逐字节相同。Vercel 会因压缩把强标签变成弱标签，也会在 304 只保留缓存更新所需 metadata；如果生产门强制源站头集合完全一致，会把合法 HTTP 行为误报为故障。正确硬门是相同 opaque digest、正确缓存、304 和零正文；可选头一旦出现则不能漂移。

把条件读取放在共享 Response 边界，比在四个生成器中分别处理更容易证明“不改正文”。生成器继续只负责 JSON/XML/text，Route Handler 负责 HTTP；传输预算正文完全不变就是这个边界有效的独立证据。

## 9. 全局状态、风险与未解决问题

本轮后，清单、Schema、JSON Feed、RSS、Sitemap、robots 和单篇 Markdown 都具备显式内容身份与条件读取。仍存在的主要技术/产品候选是：

1. OpenSearch description：已有 `/search?q=` 和根导航，但没有标准 `rel="search"` 机器发现入口；改动局部且能直接复用本轮验证器；
2. CSP nonce 可行性：当前 `'unsafe-inline'` 是明确安全债，但迁移会影响全部 Next 页面、缓存和流式渲染，需要先做独立架构/性能验证；
3. 为 Feed/Sitemap 派生 Last-Modified：有一定缓存语义价值，但 ETag 已完整表达表示身份，且 robots 无统一日期事实，收益低于新增搜索发现。

选择候选 1。它增加现有读者搜索能力的标准发现面，不依赖数据库、账号、外部 API 或所有者手工配置；也能把本轮 HTTP helper 用于一个新端点。CSP nonce 保留为后续独立安全迭代，Last-Modified 暂不为一致性而伪造。

## 10. 下一轮唯一主任务

新增同源 `/opensearch.xml` 描述现有 `/search?q={searchTerms}`，并在根布局服务端声明 `application/opensearchdescription+xml` 的 `rel="search"`。端点使用最终正文 SHA-256 ETag、空 304、准确 MIME、安全模板和明确缓存；它不进入 Sitemap，但必须进入结构化发现测试、生产 smoke 和第七路 raw/gzip 预算。预算 baseline 只能在首个稳定生产版本实测后冻结来源，不能从本地较短测试 origin 伪造。
