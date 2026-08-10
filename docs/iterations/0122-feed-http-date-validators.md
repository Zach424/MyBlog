# Iteration 0122：Feed HTTP 日期验证

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

JSON Feed 与 RSS 已有由最终正文生成的 SHA-256 ETag，但尚未公开资源级 `Last-Modified`，也不能用 `If-Modified-Since` 完成日期条件读取。只取内容的最新 `updatedAt` 不够可信：Feed 序列化格式发生变化时，即使内容日期不变，表示正文也已经改变；反过来，构建或部署时间又不应冒充资源修改事实。

本轮目标是为 JSON Feed 与 RSS 建立可解释、可验证的资源修改时间：同时考虑每种格式的正文契约修订时间和公开内容日期；严格遵守 ETag 优先；接受 HTTP 规范要求的三种日期格式；拒绝坏日期和未来响应头；用本地与真实 Vercel 响应验证 200/304、缓存和正文不变。范围不扩散到 robots、Schema、Sitemap 或 OpenSearch，不增加 UI、客户端 JavaScript、依赖、账号、数据库、追踪、第三方服务或云配置。

## 2. 项目结构状态

- `lib/feed-http.ts`：新增 Feed 表示修订台账，并从修订时间与公开内容日期派生资源级 Last-Modified；
- `lib/http-validators.ts`：条件响应助手新增可选 Last-Modified，严格解析三种 HTTP-date，并落实 `If-None-Match` 优先级；
- `app/feed.json/route.ts`：为 JSON Feed 传入确定性 Last-Modified；
- `app/rss.xml/route.ts`：为 RSS 传入确定性 Last-Modified；
- `tests/http-validators.test.mjs`：覆盖规范日期、坏日期、未来响应头、条件优先级和 200/304；
- `tests/discovery.test.mjs`：覆盖表示修订、内容日期最大值与上海时区日界线；
- `tests/rendered-html.test.mjs`：在真实 Next 应用中验证两个 Feed 的精确响应头和条件读取；
- `scripts/smoke-production.mjs`：在线验证精确 Last-Modified、日期 304、旧/坏日期 200、ETag 优先和正文预算；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/OPERATIONS.md`、`docs/QUALITY.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步架构、设计、运行、质量、状态与下一主线；
- `docs/knowledge/0122-http-date-validator-precedence.md`：新增 Obsidian 经验笔记；
- 本文件：归档本轮完整证据。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

Feed 资源的修改时间由两个独立事实合成：

```text
Feed Last-Modified = max(
  该格式最后一次改变序列化正文的表示修订时间,
  所有公开记录的 updatedAt ?? publishedAt
)
```

两种表示分别保存自己的修订来源：

```text
JSON Feed  2026-08-06T10:09:53Z  a55e68b：引入 JSON Feed 1.1
RSS        2026-08-10T21:26:25Z  97eabce：引入 RSS 修改时间
```

公开内容日期只有 `YYYY-MM-DD`，代表作者所在地的日历日。本项目把它解释为 `T00:00:00+08:00` 后再转成 UTC，而不是直接补 `Z`；这样在上海当天凌晨部署时不会向全球缓存发送尚处于未来的 Last-Modified。

条件求值保持单一顺序：

```text
请求存在 If-None-Match
  └─ 只评估 ETag：匹配 304，不匹配 200
请求不存在 If-None-Match
  └─ GET/HEAD 才评估 If-Modified-Since：资源时间 <= 请求日期时 304
```

即使 `If-None-Match` 的值过期或格式无效，它的存在也会屏蔽 `If-Modified-Since`；这不是容错偏好，而是 HTTP 规范规定的条件优先级。

## 4. 使用的技术与规范

- Next.js 16.3 Route Handler；
- TypeScript、Node `Request`/`Response`/`Headers`；
- SHA-256 ETag 与最终正文强弱等价；
- IMF-fixdate、obsolete RFC 850 与 asctime HTTP-date；
- UTC 日历、闰年、星期一致性和闰秒边界校验；
- Node test、ESLint、TypeScript、Next production build；
- Vercel 稳定生产 origin smoke；
- `Buffer.byteLength` 与 Node `gzipSync` 的七端点预算；
- `research-iteration-loop` 的执行—验证—复盘流程。

主要规范证据：

- [RFC 9110 §8.8.2 Last-Modified](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2)：可靠确定日期时应发送，且不得发送未来时间；
- [RFC 9110 §13.1.3 If-Modified-Since](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3)：只用于 GET/HEAD，`If-None-Match` 存在时必须忽略；
- [RFC 9110 §13.2.2 Preconditions](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.2)：定义条件请求求值顺序；
- [RFC 9110 §5.6.7 Date/Time Formats](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7)：发送方使用 IMF-fixdate，接收方必须接受三种 HTTP-date；
- [RFC 9111 §4.3.2 Handling a Received Validation Request](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.2)：缓存验证同样让 `If-None-Match` 优先于 `If-Modified-Since`。

## 5. 实现的功能

1. JSON Feed 返回精确 `Last-Modified: Thu, 06 Aug 2026 10:09:53 GMT`；
2. RSS 返回精确 `Last-Modified: Mon, 10 Aug 2026 21:26:25 GMT`；
3. 每种 Feed 独立维护带来源提交的表示修订时间；
4. 内容日期按上海时区日界线转成不会落到未来的 UTC 时间；
5. Last-Modified 输出值必须是规范 IMF-fixdate 且不在未来；
6. 接收方支持 IMF-fixdate、RFC 850 和 asctime；
7. 日期相等或更晚时 GET/HEAD 返回空正文 304；
8. 旧日期、无效格式、重复值、不可能日历和星期不匹配返回 200；
9. 任何 `If-None-Match` 都优先于 `If-Modified-Since`；
10. 匹配 ETag 即使搭配旧日期仍返回 304；
11. Vercel 精简 304 表示元数据时按等价语义验收；
12. Feed 正文、ETag、缓存策略与 raw/gzip 预算保持不变。

## 6. 实现方法

先在 `tests/http-validators.test.mjs` 和发现测试中写失败用例：两个 Feed 必须返回精确 Last-Modified；三种标准日期都能命中；旧日期与多类坏日期不能误报 304；任何 `If-None-Match` 的存在都必须屏蔽日期条件；响应端的非规范日期和未来日期必须立即失败。旧实现首先因没有 Last-Modified 和 IMS 路径而失败，证明测试约束了新增能力。

随后新增 `createFeedLastModified()`。它不读取构建时间、文件 mtime 或当前时间，而是从明确的表示修订台账开始，再遍历公开记录并取内容日期最大值。表示修订常量对应“最终正文契约最后一次变化”的提交，避免仅修改 TypeScript 重构或文档时无意义刷新缓存。

通用条件响应助手继续先生成最终正文字节的 ETag，再验证可选 Last-Modified。日期解析没有直接依赖宽松的 `Date.parse(requestHeader)`，而是按三种规范语法拆分年月日时分秒、验证真实日历与星期，再生成 UTC 时间戳。这样 `31 Feb`、错误星期、重复 header 合并值或随意 ISO 字符串不会被 JavaScript 自动纠正成一个看似有效的日期。

最后把两条 Route Handler 的正文只生成一次，并将同一公开记录集合用于正文和 Last-Modified；生产 smoke 同时请求普通 200、日期命中 304、旧日期 200、坏日期 200、ETag 优先与零正文。由于正文完全未改变，现有 ETag 和七端点 raw/gzip 实测也完全未改变，因此本轮明确不提交预算重基线。

## 7. 验证证据

- 失败优先：旧条件响应助手缺少 Last-Modified/IMS 路径时目标测试按预期失败；
- 目标 HTTP/发现测试：16/16；
- `npm run typecheck`：通过；
- `npm run lint`：通过；
- `npm run test:unit`：530/530；
- `npm run build`：52 个页面；
- `npm run test:app`：30/30；
- 功能提交：`237fd8d`（`feat: add Feed date validators`），已推送并部署；
- 稳定生产 smoke：27 routes、OAuth 302，十三条 HTML 与七个发现端点全部 PASS；
- 生产 JSON Feed Last-Modified：`Thu, 06 Aug 2026 10:09:53 GMT`；
- 生产 RSS Last-Modified：`Mon, 10 Aug 2026 21:26:25 GMT`；
- 生产条件行为：匹配日期 304，旧/坏日期 200，陈旧或无效 ETag 均屏蔽 IMS，匹配 ETag 优先返回 304；
- 生产 JSON Feed：20697/9876 B（raw/gzip），与 0121 基线一致；
- 生产 RSS：3536/1298 B（raw/gzip），与 0121 基线一致；
- Feed 正文与 ETag 未变化，不需要预算重基线；
- `git diff --check`：通过；
- UI、客户端 bundle、页面路由与内容 frontmatter 未改变。

## 8. 经验与教训

1. 资源修改时间不等于最新内容时间；序列化格式本身变化时也要刷新；
2. 构建时间和部署时间容易取得，但不是资源修改事实；
3. 表示修订应按输出格式独立维护，并记录来源提交；
4. 只有日期没有时区时，必须明确作者日界线，避免未来 Last-Modified；
5. 发送端只能输出规范 IMF-fixdate，接收端却必须兼容三种历史格式；
6. JavaScript 宽松日期解析会纠正错误日历，不能直接充当协议验证器；
7. ETag 是更精确的表示验证器，规范要求它在两种条件同时存在时优先；
8. “错误 ETag + 新日期”仍应返回 200，否则日期会覆盖更精确的验证器；
9. 响应头变化不等于正文变化，预算不应为了制造提交而重写；
10. 边缘平台可能精简 304 元数据，生产门应验证等价语义而不是机械复制源站响应；
11. 条件响应规则适合集中在一个纯助手中，避免不同端点逐渐形成不同优先级；
12. Obsidian 知识笔记、项目状态、实现和生产证据继续保存在同一 Git 历史。

## 9. 全局状态、风险与未解决问题

JSON Feed 与 RSS 现在同时具有强内容指纹和粗粒度时间验证器：ETag 精确到最终字节，Last-Modified 为不知道 ETag 的缓存提供日期回退。表示修订台账是显式维护契约；以后 Feed 正文生成规则改变时，必须同步更新对应时间和来源注释，否则内容日期未变化时 Last-Modified 可能滞后于真实表示。

`/content.json` 和文章/项目 `source.md` 已经返回 Last-Modified，但当前条件助手调用仍只使用 ETag，日期尚未参与 304 决策；这是下一轮明确范围。Schema、Sitemap、OpenSearch 和 robots 没有既有可靠修改日期，本轮没有为了“统一”而伪造。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择，不进入自动主线。

## 10. 下一轮唯一主任务

把 `/content.json` 与文章/项目 `source.md` 已公开的 Last-Modified 接入 `If-Modified-Since`。复用本轮严格日期解析与 `If-None-Match` 优先路径，不改变正文、ETag、缓存、清单 version 1、源文投影或生产同步轮询；补齐失败优先单元、真实 Next 和稳定生产条件响应证据。无可靠日期事实的其他端点继续不扩散。
