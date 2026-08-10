# Iteration 0124：公开条件 HEAD 等价语义

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

七个结构化发现端点和文章/项目 `source.md` 已支持 GET、ETag 与部分日期条件读取，但项目没有证明 HEAD 的真实行为。HEAD 常用于探测元数据和最近修改；如果它返回正文、丢失验证器或绕过条件优先级，监控与缓存客户端会得到和 GET 不一致的事实。

本轮目标不是复制九套 `HEAD()`，而是先审计 Next.js 16.3 的当前框架边界，再把已经存在的正确行为纳入失败优先的真实构建和稳定生产回归门。成功标准是：九个公开条件端点的普通 HEAD 为 200/零正文；匹配 ETag 为 304/零正文；五个带 Last-Modified 的资源还要覆盖日期 304、旧/坏日期 200 与陈旧 ETag 优先 200；关键响应头与 GET 等价；未知源文 HEAD 是无验证器的 `no-store` 404。不触及 OAuth、Studio POST、正文、内容或云配置。

## 2. 项目结构状态

- `tests/rendered-html.test.mjs`：`render()` 支持显式 method，并新增九端点 HEAD 等价矩阵与未知源文 404；
- `scripts/smoke-production.mjs`：新增稳定生产 HEAD 200/304、ETag、日期与边缘元数据矩阵；
- `tests/deployment-tools.test.mjs`：失败优先要求生产 smoke 必须存在 HEAD 覆盖和专用错误边界；
- `node_modules/next/dist/docs/.../15-route-handlers.md` 与 `.../route.md`：当前版本 Route Handler 方法权威说明；
- `node_modules/next/dist/server/send-response.js`：当前版本最终发送层在 HEAD 时不写响应体的本地实现证据；
- 六份全局中文文档、`docs/knowledge/0124-head-is-a-framework-boundary.md` 与本文件：归档状态、设计、方法、风险和下一步。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

HEAD 的项目契约是 GET 元数据的无正文投影：

```text
GET 200 + headers + body
HEAD 200 + equivalent headers + no body

GET/HEAD + matching ETag → 304 + no body
GET/HEAD + matching IMS  → 304 + no body
HEAD + stale/bad IMS     → 200 + equivalent headers + no body
HEAD + stale ETag + matching IMS → 200 + no body
```

本轮保留现有 GET Route Handler。Next 仍调用同一业务生成器得到最终 ETag、Last-Modified、MIME、缓存、文件名、Link/noindex，再由发送层对 HEAD 抑制正文。这避免九套显式 HEAD 逐步和 GET 漂移，同时通过版本绑定的测试承认它是框架契约而不是业务纯函数保证。

## 4. 使用的技术与规范

- Next.js 16.3 Route Handler 与生产发送层；
- Web Fetch、Request、Response 与 HEAD 方法；
- SHA-256 ETag、Last-Modified、`If-None-Match`、`If-Modified-Since`；
- Node test、ESLint、TypeScript、Next production build；
- Vercel 稳定生产 origin、弱 ETag 与 304 元数据精简；
- 十三路 HTML 与七端点 raw/gzip 冻结预算；
- `research-iteration-loop` 执行—验证—复盘流程。

规范与实现证据：

- [RFC 9110 §9.3.2 HEAD](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.2)：HEAD 与 GET 相同，但服务器不得发送响应内容；应发送与 GET 相同的响应头，允许省略只能在生成正文时确定的字段；
- [Next.js Route Handler HTTP Methods](https://nextjs.org/docs/app/api-reference/file-conventions/route#http-methods)：当前 Route Handler 支持 HEAD；
- 本地安装版本 `node_modules/next/dist/server/send-response.js`：最终发送阶段在 `req.method !== 'HEAD'` 时才写 `response.body`。

## 5. 实现的功能

1. 本地真实 Next 构建覆盖七个结构化端点与两篇代表源文；
2. 普通 HEAD 200 且正文长度为零；
3. ETag 条件 HEAD 304 且正文长度为零；
4. 五个日期资源的 IMS 条件 HEAD 304；
5. 旧日期与非 HTTP-date HEAD 返回 200/零正文；
6. 陈旧 ETag 屏蔽命中日期，返回 200/零正文；
7. 200 HEAD 的 ETag、Last-Modified、MIME、缓存、文件名、Link/noindex 与 GET 完全相同；
8. 生产 304 允许省略可选表示元数据，但存在值不得漂移；
9. 强/弱 ETag 保持同一 SHA-256 opaque identity；
10. 未知 Markdown HEAD 返回 `no-store` 404 且没有 ETag/Last-Modified；
11. 生产 smoke 以后会在 Next/Vercel 升级时阻止 HEAD 静默回归；
12. 运行时、正文、页面、ETag 与预算保持不变。

## 6. 实现方法

先读当前仓库内 Next 16.3 文档：它明确支持 HEAD，但只明确 OPTIONS 的自动实现，没有直接把“GET 自动转 HEAD”写成公开承诺。随后检查安装包发送层，并对稳定生产九个端点逐一发出普通、ETag 与日期 HEAD，确认当前行为真实存在。

失败优先不是让已经正确的生产响应人为失败，而是在 `tests/deployment-tools.test.mjs` 要求生产 smoke 必须出现 `method: "HEAD"` 和专用 HEAD 错误边界。旧 smoke 以 5/6 失败，证明缺口是“行为没有进入发布门”。

实现阶段先扩展真实应用测试请求方法，再用同一 GET 响应作为逐端点事实源比较 HEAD。生产 smoke 复用已经下载的九份 GET 响应和既有缓存策略验证器，减少重复正文下载；对每个端点执行普通/ETag HEAD，对日期端点并行执行 IMS 命中、旧值、ISO 坏值和陈旧 ETag 优先。没有新增显式 Route Handler，也没有改通用条件助手，因为直接 Response 的 HEAD 正文由 Next 的 HTTP 发送层负责抑制。

## 7. 验证证据

- 失败优先：部署工具测试因缺少 `method: "HEAD"` 以 5/6 失败；
- 当前生产预审：九端点普通 HEAD 200/零正文、ETag 304，五个日期资源 IMS 304；
- `npm run typecheck`：通过；
- `npm run lint`：通过；
- `npm run test:unit`：530/530；
- `npm run build`：52 个页面；
- `npm run test:app`：31/31，其中新增一项完整 HEAD 矩阵；
- 功能提交：`64ab9dd`（`test: lock conditional HEAD semantics`），已推送；
- 稳定生产 smoke：27 routes、OAuth 302，增强 HEAD 矩阵全部通过；
- 十三条 HTML 与七个发现端点预算全部 PASS；
- 七端点生产正文仍为清单 3009/921、Schema 3278/755、JSON Feed 20697/9876、RSS 3536/1298、Sitemap 5059/532、robots 155/127、OpenSearch 700/462 B（raw/gzip）；
- `git diff --check`：通过；
- 无运行时代码、UI、客户端 JavaScript、依赖或内容变更。

## 8. 经验与教训

1. 框架当前“做对了”不等于项目已经拥有该能力；没有回归门就只是隐式依赖；
2. 官方文档若只声明支持方法，不能直接外推自动派生细节；
3. 本地安装包源码可以解释当前行为，但不能替代真实 HTTP 测试；
4. HEAD 必须验证零正文，而不只是状态码；
5. HEAD 200 与 304 是两条不同路径，都要覆盖；
6. 日期条件同样需要旧值、坏值和 ETag 优先反例；
7. 逐端点从 GET 响应派生期望，比维护第二份硬编码头清单更可靠；
8. 边缘 304 可以合法精简元数据，存在的值仍不能漂移；
9. 未知资源也需要 HEAD 404/no-store 边界，避免错误页得到公开缓存身份；
10. 如果框架层已经正确，无需为了“有功能代码”复制九个 HEAD handler；
11. 测试与生产 smoke 本身是可交付的维护能力；
12. Obsidian 状态、迭代和知识笔记继续与代码共享 Git 历史。

## 9. 全局状态、风险与未解决问题

公开只读发现协议现在同时覆盖 GET 与 HEAD，验证器、日期优先级、缓存和错误边界在本地与 Vercel 都有证据。该能力依赖 Next 16.3 的发送层；将来升级 Next 时，即使 TypeScript 和单元测试通过，真实应用第 31 项或生产 smoke 仍可能因框架行为变化失败，这正是本轮保留的升级信号。

本轮没有给所有页面 HTML 建立 HEAD 矩阵，也没有触及 OAuth、Studio POST 或内容写入端点；这些不属于机器发现资源的条件读取边界。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择。

## 10. 下一轮唯一主任务

为 RSS item 增加基于现有 tags 的标准 `<category>`。先依据 RSS 2.0 规范审计字段与 JSON Feed tags，再失败优先实现逐 item 稳定映射、XML 转义与跨格式对齐；保持 GUID、首发/修改时间和排序不变，并完成真实生产预算重测与中文归档。
