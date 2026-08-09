# Iteration 0092：生产内容同步检查器

## 1. 范围与成功标准

本轮只补齐“Git 已交付”到“内容已出现在稳定生产站”的作者证据，不改变 Markdown 事实源、发布提交、Vercel 部署、公开页面、内容 schema、Studio、Feed/Sitemap 或默认离线发布门。成功标准是：本地为稳定生产 origin 生成与站点相同的公开内容清单；受限读取真实 `/content.json`；只有响应与 version 1 协议全部可信时，才输出 deployed、pending、missing、unexpected；网络/HTTP/格式/协议错误单独失败；CLI 默认零写入、零提交、零推送；Obsidian 提供严格、可读、无动作按钮的原生命令；完整本地门、GitHub Quality 与 Vercel 生产冒烟全部通过。

## 2. 项目结构状态

- `lib/content-manifest.ts`：导出类型化 `ContentManifestDocument`/`ContentManifestItem` 与 `createContentManifestDocument()`；原 `/content.json` 字节输出继续由同一对象格式化，公开协议不变；
- `lib/content/production-sync.ts`：新增生产 origin 约束、受限流式请求、严格清单验证、四态比较、version 1 报告与中文文本格式；
- `scripts/report-production-content-sync.mjs`：新增 `content:production` CLI，支持 `--origin`、`--date`、`--format`、`--timeout-ms` 与显式 `--fail-on-drift`；
- `.obsidian/plugins/myblog-publisher/main.js`：新增结构化报告解释器、“检查生产内容同步状态”命令、统一子进程生命周期接入和 `ProductionContentSyncModal`；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增四态 Evidence Ledger、响应式计数/验证器/记录布局，无渐变、动画或写动作；
- `.obsidian/plugins/myblog-publisher/manifest.json`、`lib/content/author-doctor.ts`：Publisher 升至 1.35.0，`content:production` 成为第 12 条必需作者命令；
- `tests/production-content-sync.test.mjs`：新增四态、协议、超时、chunked 上限取消、真实 loopback CLI 与作者文件字节稳定回归；
- `tests/obsidian-plugin.test.mjs`：新增命令、Modal、Windows/POSIX spawn、移动端隐藏、计数/路径/safety 拒绝、不重试和传输失败隔离回归；
- `package.json`、README、架构、发现、发布、运维、状态和路线图同步更新；内容 Markdown、公开路由、依赖版本与部署工作流未改变。

## 3. 设计内容

设计对象是作者侧只读生产证据，而不是新的部署后台。台账顶部使用 `PRODUCTION CONTENT / SYNCHRONIZED|ATTENTION`，随后显示四个固定计数：已上线、待部署、生产缺失、生产多出。每条记录显示内容类型、标题、稳定生产 URL、本地 Vault 路径或生产来源、两侧强 Markdown ETag 与差异原因；快照区固定生产清单 URL、响应 ETag 和 Last-Modified，使结论能指向一次具体 CDN 响应。

四态语义严格互斥：本地和生产同 id 且完整公开 item 相同为 deployed；同 id 但 `markdown_etag` 或其他公开字段不同为 pending；仅本地存在为 missing；仅生产存在为 unexpected。UI 不提供发布、重试、打开、修复或删除按钮，避免把观察结果升级为未授权动作。有效 drift 仍是可展示报告；传输或协议失败则不打开台账，也不会用“待部署”掩盖网络问题。

## 4. 使用的技术

- Node.js 原生 `fetch`、`AbortController`、`ReadableStreamDefaultReader` 与 fatal UTF-8 `TextDecoder`：手动重定向、超时和真实流式字节上限；
- 现有 `loadContentRepository()`、`isPublished()`、`resolveContentBuildDate()`：与正式内容契约和上海作者日期共享公开范围；
- 现有 `createContentManifestDocument()`、`createPublicMarkdown()` 与 SHA-256 ETag：本地期望值不复制生产序列化逻辑；
- 精确 JSON schema 防御：顶层和 item 字段、URL origin/路由、kind/type、日期、标签、强 ETag、唯一 id、稳定排序与响应验证器逐项验证；
- Obsidian CommonJS 插件 API、`runRepositoryCommand()`、`activeRuns` 与 unload 终止：复用既有 Windows/POSIX 无 shell 子进程边界；
- Node test 的 mock `fetch`、自定义 `ReadableStream`、loopback HTTP server 和 VM Obsidian harness；
- `research-iteration-loop` skill：坚持单功能、失败优先、离线 fixture、真实生产、全量门禁与全局状态归档。

## 5. 实现的功能

1. `npm run content:production` 默认检查稳定 Vercel origin，并输出中文人类可读四态报告；
2. `--format json` 输出 version 1、`mode: read-only`、检查时间、本地日期、生产快照、四态计数、逐项 ETag/差异和安全声明；
3. `--fail-on-drift` 只在明确需要脚本门时让有效 attention 报告返回非零；默认 drift 可读，传输/协议错误始终非零；
4. origin 默认只允许 HTTPS；HTTP 只允许 localhost/loopback 测试，禁止凭据、路径、查询和片段；
5. 生产请求固定 `Accept: application/json`、禁止自动重定向、默认 10 秒超时、最大 1 MiB，并在 chunked 响应越界的那个分块立即取消 reader；
6. 响应必须是 HTTP 200、JSON MIME、合法 Content-Length（如存在）、SHA-256 响应 ETag 和有效 Last-Modified；
7. 生产清单必须严格满足 version 1 allowlist、同源地址、稳定内容路由、kind/type、相邻 `source.md`、强源文 ETag、日期、标签、唯一 id 和排序；
8. Obsidian 命令面板新增“MyBlog Publisher: 检查生产内容同步状态”，桌面端隐藏运行 JSON CLI，并复用现有 active child 清理；
9. Publisher 解释器重新验证全部字段、计数、状态、路径、两侧 ETag、差异与 safety；不可信成功输出不重试网络、不降级为另一份网络报告；
10. Author Doctor 继续是 13 项电路，但必需作者脚本从 11 条增至 12 条，并严格要求 Publisher 1.35.0。

## 6. 实现方法

先加入 `tests/production-content-sync.test.mjs` 和 npm script 入口；首轮定向执行以 `ERR_MODULE_NOT_FOUND` 失败，证明核心模块尚不存在。随后导出类型化清单对象，构建纯比较器与请求器，再以 deployed/pending/missing/unexpected 混合 fixture 固定状态、计数、顺序、差异、来源路径和四项安全声明。请求 fixture 依次锁定重定向、MIME、声明体积、畸形 JSON、未知字段、错误 origin 与超时。

最初实现虽然在 `response.text()` 后检查实际字节，却会先把无 Content-Length 的任意大正文完整读入内存。新增 failure-first chunked stream 用例后，改为逐块累计 `Uint8Array.byteLength`，越过 1 MiB 立即 `reader.cancel()`；测试用零 high-water mark 证明第三块不会被消费。最终只在完整界限内合并字节并以 fatal UTF-8 解码。

本地比较不是读取作者文件哈希，也不是用日期猜部署。CLI 先由正式内容记录生成目标 origin 的完整 `ContentManifestDocument`，再按绝对 id 与生产 item 对齐；Markdown ETag 差异和其他公开字段差异分别记录。local-only/production-only 使用显式 null 证据，报告计数从 records 重算，status 再由非 deployed 数量派生。

Obsidian 端没有信任 CLI 的“成功”字符串。VM 解释器要求精确 HTTPS origin、规范时间、响应 ETag、HTTP 日期、四态记录与内容路由/本地路径互相推导；deployed 必须两侧强 ETag 相同且无差异，pending 的 `markdown-etag` 差异必须与真实不等相符，missing/unexpected 各有唯一封闭差异。任何不一致只显示“证据不可用；不会自动重试”。

## 7. 验证证据

- 失败优先：首次 `node --experimental-strip-types --test tests/production-content-sync.test.mjs` 因缺少 `lib/content/production-sync.ts` 返回 `ERR_MODULE_NOT_FOUND`；
- 流式边界失败优先：旧实现能报超限但没有取消 chunked reader，新增用例以 `false !== true` 失败；修复后在第二个 600,000 B 分块越界并取消，第三块不读取；
- 核心/插件/doctor 定向回归：225/225；生产同步专用回归最终 11/11；
- 首次完整 `npm run release:check`：用时 114.9 秒，429/429 单元与集成、TypeScript、47/47 构建路由、20/20 真实应用测试、九路 HTML raw/gzip 预算、生产依赖审计 0；Current 1、Historical 3、inbox 0、根暂存 0、外链本地问题 0；
- 归档后第二次 `npm run release:check`：用时 140.3 秒，同样保持 429/429、47/47、20/20、审计 0 与全部内容/媒体/外链本地状态不变；
- 真实 Author Doctor：13/13 ready、12/12 必需脚本、32/32 固定依赖、Publisher 1.35.0，且配置/凭据/文件/网络四项 safety 均为 false；
- CLI loopback 集成测试在真实 HTTP 请求前后逐字节比较 `content/posts` 与 `content/projects`，全部稳定；
- 功能提交：`8935ad829f43d68bc5eb2a94bee926ac5909d31c`；父提交：`65c6e1af38cf44441ba9b196e5434d3264c6e89c`；
- [Quality Gate #170](https://github.com/Zach424/MyBlog/actions/runs/31328637037) 与 [Production Smoke #163](https://github.com/Zach424/MyBlog/actions/runs/31328658391) 均成功；
- 真实生产同步：synchronized，4 deployed、0 pending、0 missing、0 unexpected；4 个本地/生产 `markdown_etag` 逐项完全相同；
- 生产快照 ETag：`W/"sha256-88aa4a0c0cae5890a15b9f13ecaeeeb79d3d47f43c60dbcde23915e7ad2debbb"`；Last-Modified：`Thu, 06 Aug 2026 00:00:00 GMT`。

## 8. 经验与教训

“网络失败”和“内容未上线”必须是两个不同的状态空间。只有拿到 HTTP、MIME、体积、编码、响应验证器和清单 schema 都可信的快照，才有资格比较内容；否则 missing 可能只是代理、CDN、重定向或错误页面。把错误失败关闭，比给作者一个看似可操作的错误结论更重要。

限制最终字符串长度不等于限制下载。没有 Content-Length 的 chunked 响应可以在 `.text()` 返回前消耗任意内存；真正的资源边界必须在 stream reader 上逐块执行，并在第一次越界时取消。Content-Length 也不能只在纯数字时使用：存在但畸形应作为协议错误，而不是悄悄忽略。

生产同步应复用公开表示生成器，而不是另造“本地摘要”。同一 origin 会进入公开 Markdown 的绝对链接，因此源文 ETag 必须由最终公开字节计算。类型化 document helper 让 `/content.json`、测试和同步器共享唯一序列化事实，同时原路由仍以相同格式和末尾换行输出。

Obsidian 的可读 UI 仍需有第二层 schema 防线。子进程 stdout/stderr 是跨边界输入；即使命令退出 0，也可能混入日志、被旧插件/脚本污染或结构漂移。计数、状态和路径从 records 重新证明后再渲染，才能保证颜色和中文标签不是未经验证的结论。

## 9. 全局状态、风险与回滚

作者自助链路现在有三段独立证据：Author Proof/质量门证明本地候选，Git delivery receipt 证明提交已送达，production sync 证明公开清单已接收相同最终源文字节。三段都不需要 Codex、数据库、第三方同步 API、云账号读取或外部通知；GitHub 仍是写入事实源，Vercel 仍只负责部署和公开读取。

当前命令是一次全库快照，不会等待部署收敛；有效 pending/missing 需要稍后显式重跑。Obsidian 子进程是否能访问稳定 Vercel 域名依赖本机 Node 的网络/代理环境；超时只报告检查未完成。生产 origin 目前固定为稳定 Vercel URL，自定义域名切换时必须同步更新 CLI 默认值、HTML 预算和生产基线，也可在迁移期显式传 `--origin`。真实 Obsidian 主题下的长 ETag/URL、大量记录密度仍需首次使用观察。

回滚功能提交使用 `git revert 8935ad829f43d68bc5eb2a94bee926ac5909d31c`。该提交没有数据库迁移、远端配置、内容变更或不可逆副作用；回滚会移除 CLI/插件命令并把 Publisher/Doctor 恢复到 1.34.0，不影响已公开 `/content.json` 和现有 Vercel 内容。

## 10. 下一轮唯一主任务

为活动正式笔记增加 source-scoped、可取消的生产收敛等待。命令先冻结精确 `content/posts|projects/<slug>.md` 和本地最终 ETag，再以条件 GET、明确总时限和间隔等待该 id 变为 deployed；pending/missing 只继续等待，unexpected、协议错误、来源字节漂移、插件卸载或新一代命令必须立即失败/取消。Obsidian 显示当前尝试、剩余时间和终态，保持 latest-wins、零写入、零提交、零推送，不接账号、数据库、第三方 API 或通知。
