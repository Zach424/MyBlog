# Iteration 0093：生产内容收敛等待

## 1. 范围与成功标准

本轮只解决一个缺口：Git 已交付后，作者如何针对一篇活动正式笔记获得“稳定生产站已经接收冻结内容”的有界终态。它不改变 Markdown 事实源、内容 schema、Git 提交、Vercel 部署、公开路由、Studio、默认质量门或全库生产同步。

成功标准是：只接受精确 `content/posts|projects/<slug>.md`；启动时冻结来源原始 SHA-256、公开 id 与本地最终 Markdown ETag；在明确总时限、间隔和单请求时限内使用条件 GET；pending/missing 只继续等待，deployed 结束成功，unexpected、来源漂移、网络或协议错误立即失败；支持调用方取消；CLI 与 Obsidian 都显示进度和 version 1 终态回执；同一 Obsidian scope latest-wins，插件卸载终止在途进程；全过程零作者文件写入、零提交、零推送、零自动部署或重试；完整本地门、GitHub Quality、Vercel Production Smoke 与真实稳定生产验证全部通过。

## 2. 项目结构状态

- `lib/content/production-convergence.ts`：新增冻结目标、等待状态机、取消错误、version 1 报告、中文进度与终态格式；
- `lib/content/production-sync.ts`：在保留原全库请求 API 的同时新增条件读取，支持调用方 signal 与 `If-None-Match`，严格验证可复用的 304；
- `scripts/wait-production-content-convergence.mjs`：新增 `content:production:wait` CLI，固定参数范围、信号取消、stderr 进度与 stdout 终态；
- `.obsidian/plugins/myblog-publisher/main.js`：新增活动正式笔记命令、逐行进度解析、latest-wins scope、终态严格解释器与 `ProductionContentConvergenceModal`；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增冻结目标、指标、尝试时间线、生产快照与安全边界的响应式样式，无渐变、动画或动作按钮；
- `.obsidian/plugins/myblog-publisher/manifest.json`、`lib/content/author-doctor.ts`：Publisher 升至 1.36.0，必需作者脚本增至 13 条；
- `tests/production-content-convergence.test.mjs`：新增冻结、条件快照、来源漂移、unexpected、timeout、取消、安全来源和真实 loopback CLI 回归；
- `tests/production-content-sync.test.mjs`：新增 `If-None-Match` 与严格 304 协议回归；
- `tests/obsidian-plugin.test.mjs`：新增正式来源范围、Windows/POSIX 命令、分块进度、伪造进度忽略、合法 timeout、不可信回执拒绝、latest-wins、卸载取消与零按钮回归；
- README、架构、发布、运维、发现、状态、路线图和本归档全部位于仓库根 Obsidian Vault；内容 Markdown、公开路由、依赖版本和部署 workflow 未改变。

## 3. 设计内容

设计对象是单篇上线证据，不是一个部署控制台。Obsidian 入口只在桌面端活动文件精确属于正式 posts/projects 时可用；持续 Notice 显示“第 N 次、当前状态、剩余秒数”。终态 Modal 使用 `PRODUCTION CONVERGENCE / DEPLOYED|TIMEOUT`，展示被冻结的 Vault 路径、标题、公开 Markdown URL、来源 SHA-256、本地 ETag、总耗时/尝试、每次观测、最终生产清单 ETag/Last-Modified 和“零写入、零提交、零推送”边界，不提供发布、重试、回滚或删除按钮。

状态空间保持封闭。deployed 要求目标生产 ETag 与冻结 ETag 相同且无差异；pending 要求目标存在、有生产 ETag，差异只能是 Markdown ETag 或清单元数据；missing 只能携带 `missing-production`；生产中出现本地没有的记录不是“再等等”，而是全局事实冲突，立即失败。timeout 是合法终态而不是协议失败；取消是独立退出，不产生迟到 Modal 或终态 Notice。

## 4. 使用的技术

- Node.js 原生 `fetch`、`AbortController`、`AbortSignal`、SHA-256 与 promise sleep：传递调用方取消并约束每次网络读取；
- HTTP `If-None-Match`、强/弱 SHA-256 ETag opaque 等价和 Last-Modified：安全复用已经完整验证的生产清单快照；
- 现有 `loadContentRepository()`、`isPublished()`、`createContentManifestDocument()` 与 `compareProductionContent()`：继续共享正式公开范围、最终源文表示和四态比较语义；
- 严格 version 1 JSON：冻结目标、规范时间、时限、观测顺序、状态/差异/ETag 关系与安全声明全部可重算；
- Obsidian CommonJS、固定参数子进程、`activeRuns`、scope generation 与 unload 清理：沿用既有跨平台、无 shell 插值的进程边界；
- Node test loopback HTTP、mock fetch、临时 Git/内容夹具与 VM Obsidian harness；
- `research-iteration-loop` skill：执行失败优先、单功能实现、局部门、完整门、真实生产、全局复盘与下一唯一任务。

## 5. 实现的功能

1. `npm run content:production:wait -- --source <path>` 默认等待稳定 Vercel 生产站，文本模式显示逐次进度和中文终态；
2. `--format json` 将带固定前缀的逐次观测写入 stderr，把唯一 version 1 最终回执写入 stdout，避免日志污染结构化证据；
3. 默认总时限 180000 ms、间隔 5000 ms、单请求 10000 ms；CLI 分别限制在 1000–900000、250–60000、500–30000 ms，并要求间隔和单请求时限小于总时限；
4. 退出码固定为 0 deployed、2 timeout、1 输入/来源/生产/协议失败、130 取消；
5. 创建目标时从正式公开记录重算 id、kind、type、title、Markdown URL 与 ETag，拒绝草稿、未来、非正式、重复或不安全路径；
6. 每次生产请求前后重读来源 SHA-256；任何字节变化都立即停止，并要求重新冻结本地 ETag；
7. 首次读取完整清单，后续携带上一响应 ETag；304 必须返回匹配的 SHA-256 ETag 和有效 Last-Modified，否则作为协议失败；
8. 每个完整快照仍执行全库比较，发现 production-only/unexpected 立即失败，避免单篇看似 deployed 掩盖生产事实分叉；
9. Obsidian 新增“MyBlog Publisher: 等待当前正式内容上线”，只传活动正式来源和 JSON 格式，不接受任意路径输入；
10. 同一等待命令新运行立即隐藏并终止旧活动进程；generation 使旧 stdout/stderr、close 和异步结果全部静默，插件卸载同样取消；
11. 插件逐行缓存 stderr 进度并严格验证精确字段、数字范围、日期、状态、差异集合和 ETag 形状；伪造或不一致进度不会覆盖可信 Notice；
12. 最终回执解释器重新证明冻结来源、origin/manifest URL、时间推导、尝试序号、304 关系、最终状态、生产快照和五项 safety 后才渲染。

## 6. 实现方法

先新增 `tests/production-content-convergence.test.mjs`，首次执行因 `lib/content/production-convergence.ts` 不存在而返回 `ERR_MODULE_NOT_FOUND`，证明用例不是在验证旧功能。随后以纯 target helper 和可注入 `fetchManifest`、时钟、sleep、source digest reader 构造核心状态机；fixture 固定“missing → 304 复用 → deployed”、来源漂移、production-only、timeout 与 cancellation。真实 loopback CLI 在请求前后逐字节比较 posts/projects，确认没有作者侧写入。

条件请求没有把 304 当作新的可信正文。`fetchProductionContentManifestConditional()` 只在调用方已经持有完整快照时发送该快照 ETag；304 响应必须返回与请求强弱形式归一后相同的 SHA-256 opaque tag，并继续提供有效 Last-Modified。核心随后复用上一份已经通过 HTTP、MIME、体积、UTF-8 和 version 1 schema 的 document，再重新比较本地完整快照和冻结目标。

总时限不是“固定尝试次数”。每轮由单调毫秒计算 elapsed/remaining，把下一次 sleep 截断到剩余时间；请求仍有独立时限。来源在每次请求前后核对，使编辑发生在网络等待期间也无法签发旧目标回执。调用方 abort 会中断 sleep 或 fetch，并统一转换为专用取消错误。

Obsidian 没有直接信任 CLI 的进度或终态。stderr 只解析固定前缀、完整换行的 JSON；首轮伪造 304、重复/未知差异、state 与 productionEtag 不一致都会被忽略。最终 stdout 的 parser 比进度更严格，还从 `startedAt`、`checkedAt`、timeout 和观测数组重算 elapsed/remaining、状态顺序、304 复用关系和最终生产 ETag。timeout 的退出码 2 是合法报告；退出 0 但回执伪造则失败关闭，且明确不会自动重试。

## 7. 验证证据

- 失败优先：新核心测试首次因缺少 `lib/content/production-convergence.ts` 返回 `ERR_MODULE_NOT_FOUND`；插件测试随后因 manifest 仍是 1.35.0 且命令缺失失败；
- 收敛核心专用回归：7/7，覆盖 loopback 的 missing → 304 → deployed、来源漂移、production-only、timeout、取消、不安全目标和作者文件字节稳定；
- 核心/生产同步/Obsidian/doctor/发布定向回归：239/239；
- 进度解析加固后重新执行全部单元测试：442/442；
- ESLint 与 `git diff --check` 通过；TypeScript 检查通过；
- 真实 Author Doctor：13/13 ready、13/13 必需脚本、32/32 固定依赖、五类路径全部存在、Publisher 1.36.0；配置、凭据、文件、网络 safety 均为 false；
- 首次完整 `npm run release:check`：用时 132.2 秒，442/442 单元与集成、TypeScript、47/47 构建路由、20/20 真实应用测试、九路 HTML raw/gzip 预算、生产依赖审计 0；Current 1、Historical 3、inbox 0、根暂存 0、外链本地问题 0；
- 状态/路线图/迭代归档写入后第二次 `npm run release:check`：用时 117.6 秒，同样保持 442/442、47/47、20/20、九路预算全部 PASS、生产依赖审计 0 与全部内容/媒体/外链本地状态不变；
- 功能提交：`6930a95185f142168bf80a8a6ecaefb35ab748ed`；父提交：`ab72689b45794153585dd94afbdd3a16fca971a5`；
- [Quality Gate #172](https://github.com/Zach424/MyBlog/actions/runs/31330678757) 与 [Production Smoke #165](https://github.com/Zach424/MyBlog/actions/runs/31330702408) 均成功；
- 真实稳定生产等待：`content/projects/myblog.md` 在 1 次、2254 ms 内返回 deployed；冻结来源 SHA-256 为 `f8099473652329e06343194baaf48e7c65a8f1a53ea7f6c092fe5a20f344daf4`，本地 Markdown ETag 为 `"sha256-ab62e9d92481f053474c6a29d0dd6413076b59927c99f123002346dd214fd303"`；
- 最终生产清单快照 ETag 为 `W/"sha256-88aa4a0c0cae5890a15b9f13ecaeeeb79d3d47f43c60dbcde23915e7ad2debbb"`，Last-Modified 为 `Thu, 06 Aug 2026 00:00:00 GMT`。

## 8. 经验与教训

等待部署不是反复执行全库检查那么简单。首先必须冻结“在等什么”：来源文件哈希证明作者字节没变，公开 Markdown ETag 证明部署目标是最终公开表示，id/path/title 让人类能辨认对象。只保存 slug 或当前文件路径，会允许编辑后的新内容借用旧轮询的成功结论。

304 是传输优化，不是新的内容证据。它只能复用先前已经完整验证的快照，并且响应 validator 必须与请求对应；缺少或不匹配 ETag 的 304 不能解释为“没有变化”。生产边缘可能把强标签弱化，因此比较 opaque digest 而不是要求字面强弱一致。

单篇等待仍然需要观察全库 unexpected。若生产存在本地没有的内容，只比较目标 id 可能签发一个局部成功，同时掩盖远端分叉或错误部署。将 unexpected 定义为立即失败，保留了全库清单作为唯一生产事实的信任边界。

长运行 UI 必须把进度与终态分开。stdout 保持纯 JSON，stderr 承载可丢弃进度；generation 决定谁仍有展示权限，进程终止只是资源回收。这样即使旧进程 close 或缓冲区迟到，也不会打开过期 Modal。进度同样是跨进程不可信输入，至少应验证结构与状态关系后再覆盖作者看到的提示。

本机 Node 网络环境与浏览器网络环境不是同一个事实。在当前 Windows/Node 24 环境中，设置 `HTTP_PROXY`/`HTTPS_PROXY` 还需要 `NODE_USE_ENV_PROXY=1` 才能让原生 fetch 使用环境代理；这个要求只写入运维知识，不把本地代理地址或任何凭据提交到仓库。

## 9. 全局状态、风险与未解决问题

作者链路现在有三段独立证据：本地 Author Proof/质量门证明候选，Git delivery receipt 证明提交进入 tracking ref，production convergence 证明冻结的最终公开字节已经出现在稳定生产清单。三段都不需要 Codex、Cloudflare、数据库、第三方同步 API、云账号读取或通知；GitHub 仍是唯一写入事实源，Vercel 仍只负责构建、部署和公开读取。

本轮等待器必须由作者在可信 push 后手动打开正式笔记并运行。它有意不嵌入 `release:check`、GitHub Actions 或 Git 写事务；网络暂时失败不会让正确提交失败，也不会重新提交、push、回滚或通知。Obsidian 子进程能否访问 Vercel 仍依赖本机 DNS/代理；真实主题下长 ETag、尝试列表与持续 Notice 需要首次人工观察。生产清单规模和轮询成本随公开内容线性增长，当前 4 条体量无需分页或派生缓存，达到实测阈值后再处理。

回滚功能提交使用 `git revert 6930a95185f142168bf80a8a6ecaefb35ab748ed`。该提交没有数据库迁移、外部配置或内容变更；回滚会移除等待 CLI/Obsidian 命令，把 Publisher/Doctor 恢复到 1.35.0，并保留原 `content:production` 全库检查和已公开站点。

## 10. 下一轮唯一主任务

让可信的新内容发布和正式内容复核成功回执自动接力现有生产收敛等待。先定义 version 1 post-delivery handoff，只携带最终正式来源路径、已交付 commit 和冻结目标身份；Obsidian 必须在 Vault reconcile 成功、作者 Git 写事务完全释放后，才启动既有只读等待 scope。等待成功只增加生产终态证据；timeout、网络/协议失败、取消或插件卸载不得回滚、重新提交、重复 push 或自动重试。手动“等待当前正式内容上线”继续保留，仍不接账号、数据库、第三方 API 或通知。
