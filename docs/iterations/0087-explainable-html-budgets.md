# Iteration 0087：可解释的 HTML 双层预算

## 1. 范围与成功标准

本轮只修复质量基础设施，不改变公开页面、内容、Studio、Obsidian、部署平台或外部服务。旧门禁把所有关键页面统一限制为 raw HTML `< 100,000` 字节，并用较短的 `blog.example.test` 代替稳定生产域名；Iteration 0086 已证明它会在测试中显示 99,997 字节通过、真实生产却返回 100,493 字节。成功标准是：用实际稳定域名语义测量完整 HTML 响应；保留独立 raw 紧急上限；用 Node zlib 计算 gzip 传输模拟；阈值由有来源的生产基线和公开余量公式推导；本地生产测试与部署后冒烟复用同一模块；九条关键路由逐条输出实测、阈值、基线和余量；漏测、重复、意外路由及两层超限都失败关闭。

## 2. 项目结构状态

- `scripts/html-budget.mjs`：新增稳定生产 origin、基线日期/来源提交、九条 raw/gzip 基线、预算推导、测量、覆盖完整性、失败断言和文本报告；
- `tests/html-budget.test.mjs`：新增余量公式、可压缩/高熵夹具、raw 紧急上限、报告格式、路由覆盖和基线来源测试；
- `tests/quality-gates.test.mjs`：本地生产请求改用稳定域名 forwarded host，旧 raw 100KB 断言被完整移除，九条完整响应进入双层预算；
- `scripts/smoke-production.mjs`：部署后实际输入域名现在复测同一九条预算并输出报告；
- `tests/deployment-tools.test.mjs`：锁定生产冒烟必须调用预算与覆盖断言；
- `package.json`：完整单元测试清单纳入新预算测试；
- `README.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`：公开状态、阈值规则、基线维护和发布后操作同步更新；
- 页面组件、CSS、内容 Markdown、Next 路由、依赖版本、workflow、Studio、Obsidian 插件与 Vercel 配置均未改变。

## 3. 设计内容

本轮是质量信息设计，不新增可见 UI。终端证据使用固定 `[html-budget]` 前缀：首行声明生产 origin、八位来源 revision、测量日期、raw 上限、gzip 余量和取整规则；其后每条路由固定输出 `raw=实测/上限 headroom=±余量 baseline=基线 gzip=实测/上限 headroom=±余量 baseline=基线 PASS|FAIL`。读者不需要反推百分比，也不会把 raw 与传输大小混为一谈。

raw 与 gzip 承担不同职责。raw `160 KiB` 是异常解压和文档膨胀的紧急护栏，不是性能目标；gzip 才是传输回归门。每条 gzip 上限等于生产基线加 `max(20%, 2 KiB)` 后向上取整到 `1 KiB`，兼顾小页面的固定框架波动和大页面的比例增长。项目页当前生产 raw 为 100,493 字节，不再因旧十进制 100KB 被迫逐字符压缩；它的 gzip 上限仍只给有边界的真实传输余量。

## 4. 使用的技术

- [Node.js `zlib.gzipSync`](https://nodejs.org/api/zlib.html#zlibgzipsyncbuffer-options)：对完整 UTF-8 HTML 执行同一进程内、无网络依赖的 gzip 传输模拟；
- [Node.js `Buffer.byteLength`](https://nodejs.org/api/buffer.html#static-method-bufferbytelengthstring-encoding)：计算字符串真实 UTF-8 raw 字节，而不是 JavaScript UTF-16 `length`；
- Next.js 16.3 的异步 [`headers()`](https://nextjs.org/docs/app/api-reference/functions/headers) 请求时语义：站点 canonical 来自请求头，因此质量请求必须使用稳定生产 host，不能把 localhost 或替代主机称为生产等价；
- 版本化基线：`2026-08-06`、来源提交 `018cb33c1c3573996902493fa393fdb865b04e5e`、稳定 origin `https://blog-iota-five-59.vercel.app`；
- 纯 ESM 模块：本地 Node test、Next 生产 HTTP 测试和 Vercel 生产冒烟直接共享函数，无第二份公式；
- 确定性高熵夹具：按序号 SHA-256 十六进制串构造不可压缩增长，避免随机测试漂移。

## 5. 实现的功能

1. 九条关键 HTML 路由同时拥有 raw 与 gzip 生产基线；
2. raw 统一紧急上限为 163,840 字节；
3. gzip 上限由基线、20%/2 KiB 最大余量和 1 KiB 取整公式自动推导，不保存随手填写的阈值；
4. 每次本地生产应用测试逐路由输出 raw/gzip 实测、上限、正负余量、基线和 PASS/FAIL；
5. `production:smoke` 对实际传入的线上 origin 运行同一九路预算，而不是信任本地替代主机；
6. 缺失、重复或未登记的关键路由失败关闭，避免新增页面或重排验证时静默漏测；
7. 100KB 以上但高度重复的夹具可以通过，等规模高熵内容被 gzip 层拒绝；
8. 即使内容高度可压缩，超过 160 KiB 的 raw 响应仍由独立紧急层拒绝；
9. 基线来源 revision、日期和稳定站点进入报告与测试，README 变化会暴露 origin 漂移。

## 6. 实现方法

先只加入 `tests/html-budget.test.mjs` 和完整测试清单，第一次定向执行以 `ERR_MODULE_NOT_FOUND` 失败，证明旧代码没有可复用预算模型。实现最小模块后六项纯模型测试通过；接入部署工具后为 8/8；增加基线 provenance 和路由覆盖闭合后为 9/9。

最初用 PowerShell/.NET `GZipStream` 通过代理采集生产页面，随后让最终 Node 模块直接运行真实 `production:smoke`，发现相同 HTML 的压缩字节存在实现差异。没有混用数字，而是把九条 gzip 基线全部替换为 Node `gzipSync` 在来源提交上的真实生产结果，再重跑定向、本地应用与完整发布门。质量测试同时改为对完整响应测量，结构检查仍只使用 `</html>` 前的可见文档；这避免把传输预算错误地缩小为 DOM 片段预算。

## 7. 验证证据

- 失败优先：新测试首次 0/1，因 `scripts/html-budget.mjs` 不存在而失败；
- 定向最终：预算与部署工具 9/9；公式、两类压缩夹具、raw 独立上限、报告、来源和覆盖完整性均有测试；
- 静态门：Next 类型生成、TypeScript、ESLint 与 `git diff --check` 全部通过；
- 本地应用：19/19；稳定 host 语义下项目页 raw `100,193/163,840`、gzip `23,351/28,672`，余量分别 `63,647` 与 `5,321` 字节；
- 完整 `npm run release:check`：398/398 单元测试、45/45 页面构建、19/19 应用测试、生产依赖审计 0；Current 1、Historical 3、inbox 0、根暂存媒体 0、外链本地问题 0；
- 稳定生产 `production:smoke`：24 条 Sitemap 路由、OAuth 302、九条预算全通过；项目页 raw `100,493/163,840`、gzip `23,385/28,672`，余量 `63,347` 与 `5,287` 字节；
- 功能提交：`ab5e088e8a6398947daf60f6f63c2d9bb5d88d1a`；
- [Quality Gate #158](https://github.com/Zach424/MyBlog/actions/runs/31089835689) 成功；[Verify Vercel production #151](https://github.com/Zach424/MyBlog/actions/runs/31089875181) 成功。

## 8. 经验与教训

raw HTML 不是网络传输成本。旧 100KB 门曾有效迫使公开页与档案分层，但当项目页接近阈值后，它开始奖励缩类名、删装饰符和换短测试主机，而不是控制用户真正下载的字节。把 raw 降级为宽松但明确的异常护栏、把 gzip 绑定生产基线，能继续阻止膨胀，同时允许有价值且可压缩的语义内容增长。

“使用生产等价请求头”也不等于真实生产。canonical 同时进入 metadata、可见来源和 RSC，主机长度会多次放大；本地必须固定到当前稳定域名，部署后仍要再测实际输入 origin。另一个重要教训是压缩器也是测量契约的一部分：.NET 与 Node 对同一响应给出不同 gzip 数字，基线与后续门必须使用同一实现。真实生产同一 raw 页面连续 gzip 结果仍可能有 1–5 字节差异，因此阈值需要公开余量而非零容差快照。

## 9. 全局状态、风险与未解决问题

内容、阅读、作者、部署与恢复模块保持稳定；质量模块新增可解释传输预算并关闭 Iteration 0086 的替代主机假绿。新增门不发送外部请求，只有既有生产冒烟会读取已经在验证范围内的公开页面；页面与客户端 bundle 不增加代码。

剩余边界是：Node gzip 只是确定性传输模拟，不等同 Vercel CDN 的 Brotli、响应头、TLS 或真实用户 Web Vitals；它适合做相对回归门，不应冒充完整性能监控。稳定域名以后变化时，必须同步更新 origin 并重新采集带来源的基线；当前测试能锁定 README，却无法在本地直接证明 GitHub `VERCEL_PRODUCTION_URL` 变量未漂移，部署后实际 origin 冒烟是最终兜底。基线更新仍需人工判断增长是否有产品价值。既有 Decap 开发依赖上游高危项、Actions pin 主动复核、真实 Obsidian 主题首次使用，以及等待所有者选择的自定义域名、统计、评论和公开邮箱保持不变。

## 10. 下一轮唯一主任务

实现 [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/)：在 `lib/discovery.ts` 复用现有公开内容索引、稳定排序、绝对 URL 和 `markdownToPlainText`，生成带 `version`、`title`、`home_page_url`、`feed_url`、`description`、`language` 与 items 的 `/feed.json`；item 至少提供稳定 `id`/`url`、标题、摘要、`content_text`、发布日期、可选修改日期和 tags。响应必须使用 `application/feed+json; charset=utf-8`、现有缓存策略和请求时 origin；根 metadata 增加发现 `<link>`，RSS 保持不变。先写转义/排序/日期/草稿排除/内容纯文本/响应头/发现链接/生产冒烟失败测试，再实现并让本轮九条 HTML 预算证明新增 discovery link 仍在余量内；不接入账号、云服务或第三方 SDK。
