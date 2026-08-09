# Iteration 0095：恢复交付后自动接力生产等待

## 1. 范围与成功标准

本轮只闭合 Iteration 0094 留下的恢复路径缺口：正常 publication/review 的首次 push 失败后，作者通过两条安全 recovery deliver 成功送达原提交时，也应自动获得同一份生产收敛终态。它不改变 pending-publication/pending-review 判定、sealed receipt schema、push refspec、Git 提交、公开内容、Vercel 部署、Studio、默认质量门或手动等待入口。

成功标准是：`content:publish:deliver` / `content:review:deliver` 的 `--handoff` 只能在原 sealed receipt 已成立后输出；目标必须从 receipt 绑定的不可变 commit blob 派生，不依赖可变工作区；原 JSON receipt 必须保留，handoff 必须是唯一最后证据行；Obsidian 必须先分别验证 receipt 和 handoff，再证明两者 commit、交付类型与路径相同；receipt Modal 立即保留 Git 交付事实，Vault reconcile 完成后才启动原只读等待器；全过程仍只有 recovery deliver 内原定的一次非强制 OID push，任何 receipt/handoff/reconcile/来源/网络失败均不得重新提交、增加第二次 push、回滚或自动重试；完整本地门、GitHub Quality、Vercel 生产验证和真实冻结参数收敛全部通过。

## 2. 项目结构状态

- `scripts/deliver-content-publish.mjs`：新增可选 `--handoff`，在 publication sealed receipt 后从 `targetBlobOid` 读取 commit blob 并生成 publication handoff；
- `scripts/deliver-content-review.mjs`：新增相同参数，在 review sealed receipt 后从 `blobOid` 读取 commit blob 并生成 review handoff；
- `.obsidian/plugins/myblog-publisher/main.js`：恢复命令增加 `--handoff` 与 stdout-only 成功解析，分离 receipt JSON/最后 handoff，校验 receipt/handoff commit 后复用既有 continuation；
- `.obsidian/plugins/myblog-publisher/manifest.json`、`lib/content/author-doctor.ts`：Publisher 与 doctor 期望版本升至 1.38.0；
- `tests/content-publish-delivery.test.mjs`：真实 push 失败、恢复成功夹具验证 receipt 后最终 publication handoff；
- `tests/content-review.test.mjs`：真实 pending-review 恢复验证 receipt 后最终 review handoff；
- `tests/obsidian-plugin.test.mjs`：恢复 publication/review 的固定参数、receipt Modal、延迟 reconcile、等待参数、终态 Modal、commit 错绑和零重复命令回归；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步 1.38.0 版本契约；
- README、架构、发布、运维、发现、状态、路线图和本归档继续位于仓库根 Obsidian Vault；内容 Markdown、公开页面、依赖、样式和 workflow 未改变。

## 3. 设计内容

恢复输出保持两层而不是发明第三种 envelope。第一层仍是原 version 1 `mode: delivered` JSON receipt，证明 pending 状态经过唯一一次精确 OID push 转为 synchronized，且 HEAD/index/worktree/manifest 稳定；第二层是 stdout 唯一最后一行 `[post-delivery-handoff] <JSON>`，只说明该已交付 commit 对应哪个生产等待目标。这样 receipt Modal 和 production Modal 各自保留单一责任，失败时作者能区分“Git 已送达”和“生产取证未完成”。

handoff 不读取当前正式文件来决定目标。review 使用 receipt 的 `blobOid`，publication 使用 sealed manifest 的 `targetBlobOid`，通过 `git cat-file blob <oid>` 读取已提交字节；再复用 Iteration 0094 的正式内容 parser、SHA-256、公开 Markdown ETag 和目标验证器。当前工作区只在生产等待 CLI 启动时作为二次现场核对：若作者已继续编辑，摘要漂移会在首次网络请求前失败。

恢复命令有意继续绕过 author transaction lease，便于在诊断期间独立修复 Git 交付。`runRepositoryCommand()` 仍把可信结果转换为 post-author-release continuation；因为 recovery 没有 lease，成功回调结束后立即调度，但 continuation 必须先等待 Vault reconcile。receipt Modal 在调度前打开，handoff/等待失败不会抹掉它。

## 4. 使用的技术

- Git `cat-file blob <oid>`：从 sealed receipt/manifest 指向的不可变对象读取部署实际会消费的正式 Markdown 字节；
- 现有 `createPostDeliveryHandoffTarget()`、`createPostDeliveryHandoff()` 与固定前缀格式器：四条交付路径共享唯一目标和 safety 语义；
- Node.js `spawnSync` 二进制 stdout、fatal UTF-8、SHA-256 与内容契约：拒绝损坏或不符合正式 schema 的 commit blob；
- 双段 stdout 协议：完整 JSON receipt 位于前部，唯一 post-delivery handoff 位于最后一行；stderr 和 npm/Git 诊断不进入成功解析；
- Obsidian exact-key receipt parser、handoff parser、commit 交叉验证、Vault reconcile 与原 production convergence generation；
- Node test 临时裸 Git 远端、pre-receive 失败钩子、真实恢复 push 与 VM Obsidian 延迟 reconcile harness；
- `research-iteration-loop` skill：失败优先、单缺口实现、局部门、完整门、真实生产、全局复盘与下一唯一任务。

## 5. 实现的功能

1. `npm run content:publish:deliver -- --format json --handoff` 仍先执行原 pending-publication 二次确认、manifest 三次稳定性检查和唯一一次 OID push；
2. publication receipt 成立后，从 `receipt.publication.targetBlobOid` 读取正式内容，绑定 `targetPath` 与 `commitOid`，输出 publication handoff；
3. `npm run content:review:deliver -- --format json --handoff` 仍先执行原 pending-review 二次确认、工作区快照和唯一一次 OID push；
4. review receipt 成立后，从 `receipt.review.blobOid` 读取正式内容，绑定 `sourcePath` 与 `commitOid`，输出 review handoff；
5. 不带 `--handoff` 的 CLI 继续只输出原 text/JSON receipt，保持人工与既有自动化兼容；
6. handoff 派生发生在 push 后且 receipt 已在内存中成立；若不可变 blob 无法解析，命令明确说明 Git 交付已经完成、应改用手动等待，并保证不重新提交或 push；
7. Obsidian 两条“重新同步待交付…”命令固定请求 JSON + handoff，只使用 stdout 解析成功证据；
8. 插件先剥离最后 handoff 行，把前部完整交给原 receipt parser；随后用 receipt 的 inbox/source path 验证 handoff 路径，并要求两者 commit 完全相同；
9. 任一 receipt、handoff、行位置、commit 或路径不可信时，不打开 Modal、不 reconcile、不启动 wait、不重跑 recovery；
10. 全部可信时先打开原 sealed receipt Modal，再异步 reconcile；完成后以 handoff 的两个纯十六进制摘要启动 `content:production:wait`；
11. 自动生产终态继续显示 publication/review 与同一个 commit，手动等待入口和全库生产同步入口保持可用；
12. Publisher 1.38.0 的 doctor、manifest、README 与操作文档同步说明正常和恢复四条交付路径。

## 6. 实现方法

先把两条真实恢复集成用例改为请求 `--handoff`。旧 publication 脚本立即以退出码 2 返回 `Unknown option '--handoff'`，证明测试不是在验证已有 receipt。随后更新 Obsidian harness：两条恢复命令必须多出固定 `--handoff`；输出 receipt + handoff 后，reconcile 未完成前不能出现第二个子进程；commit 错绑必须零 Modal、零 reconcile、零 wait。旧插件分别因参数缺失和把双段输出当作单一 JSON 而失败。

脚本实现保留原 push 与 receipt 路径不动，只在 `createContent*DeliveryReceipt()` 成功后进入可选 handoff 分支。通过 receipt 中已经验证的 blob OID 调用 `git cat-file blob`，把 Buffer 直接交给共享 target builder；因此 Git attributes 已经产生的 clean-filter 表示和真正部署字节是一致事实。handoff 仍由共享构造器验证 OID、URL、kind/type、source path、ETag 和 safety。

插件新增的 `extractRecoveryDeliveryReceiptOutput()` 只允许最后一行是 handoff，并要求它之前有非空 receipt；完整输出仍交给现有 handoff parser，以继续拒绝重复 handoff 或迟到日志。成功回调先调用原 receipt parser，再创建带 `expectedCommitOid` 的 continuation；commit 比较在任何 Modal/reconcile 前完成。

恢复命令没有 author lease，但沿用同一 continuation 调度器。`runRepositoryCommand()` 成功处理器先打开 receipt Modal 并返回 continuation；finally 阶段看到没有 lease 便异步调度。continuation 的第一个 await 仍是 Vault reconcile，插件在此期间卸载就不会启动等待；网络阶段只消费冻结摘要，不调用任一 Git 写命令。

## 7. 验证证据

- 失败优先：真实 publication recovery 首次以退出码 2 返回 `Unknown option '--handoff'`；Obsidian 恢复测试首次同时显示 review/publication 固定参数缺少 `--handoff`，commit 错绑输出被旧 receipt parser 当作无效 JSON；
- 两条真实恢复场景在实现后均通过：先由远端 hook 拒绝首次 push，移除 hook 后 recovery 只送达原 commit，并按 receipt → 最后一行 handoff 输出；
- Obsidian 恢复接力专用回归：5/5，覆盖两类 receipt Modal、延迟 reconcile、自动等待、无效 receipt 和 receipt/handoff commit 错绑；
- 相关领域、恢复、handoff、收敛、Obsidian、doctor 和发布定向回归：262/262；
- TypeScript、ESLint 与 `git diff --check` 通过；
- 真实 Author Doctor：13/13 ready、13/13 必需脚本、32/32 固定依赖、五类路径全部存在、Publisher 1.38.0；配置、凭据、文件、网络 safety 均为 false；
- 首次完整 `npm run release:check`：用时 120.6 秒，453/453 单元与集成、TypeScript、47/47 构建路由、20/20 真实应用测试、九路 HTML raw/gzip 预算、生产依赖审计 0；Current 1、Historical 3、inbox 0、根暂存 0、外链本地问题 0；
- 状态、路线图和本归档写入后第二次 `npm run release:check`：用时 119.9 秒，同样保持 453/453、47/47、20/20、九路预算全部 PASS、生产依赖审计 0 与全部内容/媒体/外链本地状态不变；
- 功能提交：`35e71935d2830e37cd1fd5963b3344ece4e6e1d4`；父提交：`05df0996a2aa116e4f815321def40274d2e91292`；
- [Quality Gate #176](https://github.com/Zach424/MyBlog/actions/runs/31333423354) 与 [Production Smoke #169](https://github.com/Zach424/MyBlog/actions/runs/31333451433) 均成功；
- 真实稳定生产冻结参数等待：`content/projects/myblog.md` 在 1 次、1213 ms 内返回 deployed；来源 SHA-256 为 `f8099473652329e06343194baaf48e7c65a8f1a53ea7f6c092fe5a20f344daf4`，Markdown ETag digest 为 `ab62e9d92481f053474c6a29d0dd6413076b59927c99f123002346dd214fd303`；
- 最终生产清单快照 ETag 为 `W/"sha256-88aa4a0c0cae5890a15b9f13ecaeeeb79d3d47f43c60dbcde23915e7ad2debbb"`，Last-Modified 为 `Thu, 06 Aug 2026 00:00:00 GMT`。

## 8. 经验与教训

恢复交付不能从“现在工作区里恰好有什么”推断上线目标。push 已经完成时，唯一可信事实是服务器接受的 commit；receipt 中的 blob OID 是连接 Git 交付与生产内容的最窄桥梁。直接读取 commit blob 还能自然覆盖 clean filter，避免工作区字节与部署字节不同。

sealed receipt 和 handoff 不应合并成一个新 schema。前者证明一次有副作用的 Git 状态迁移，后者只传递只读等待目标；保留两个证据让已有 parser、Modal 和人工恢复手册继续有效，也让任一层失败时不否定上一层已经完成的事实。

自动化成功路径仍要兼容人工 CLI。把 `--handoff` 设计为显式可选参数，使不带参数的 text/JSON receipt 字节形状保持原样；只有 Obsidian 或其他明确消费 handoff 的调用方才请求双段协议。恢复成功后手动等待始终是安全退路。

跨证据比较不能只验证各自内部 schema。一个完全合法的 receipt 与另一个完全合法但属于别的 commit 的 handoff，组合后仍是伪证据；在 reconcile 前比较 commit、交付类型和路径，才能证明交接连续性。

恢复命令在 author lease 之外并不代表它可以跳过时序边界。receipt Modal 可以立即显示，但等待器仍要等 Vault reconcile；这使 Git 事实及时可见，同时避免新子进程读取 Obsidian 尚未刷新到的文件图。

## 9. 全局状态、风险与未解决问题

正常 publication、正常 review、recovered publication、recovered review 四条 Git 交付路径现在都使用同一 version 1 handoff 和 production convergence。主路径有 author transaction lease，恢复路径有 sealed receipt/manifest；两者最终都在 Vault reconcile 后进入相同只读等待器。GitHub 仍是唯一写入事实源，Vercel 仍只负责构建、部署和公开读取，不依赖 Codex、Cloudflare、数据库、第三方同步 API 或通知。

当前显著的作者运维缺口转为插件更新生命周期。仓库里的 manifest/main/styles 已升级时，已经运行的 Obsidian 仍可能保留旧 CommonJS 实例；现有 doctor 会验证磁盘文件，但旧 runtime parser 遇到未来版本时只会退化为通用不可信 JSON/纯文本诊断，不能准确告诉作者需要重载。插件不会也不应自动 reload 自己。真实主题下两个连续 Modal、长 ETag、commit 与持续 Notice 仍需首次人工观察；Node 24 代理仍需 `NODE_USE_ENV_PROXY=1`。

回滚功能提交使用 `git revert 35e71935d2830e37cd1fd5963b3344ece4e6e1d4`。该提交没有数据库迁移、外部配置或内容变更；回滚会让两条 recovery deliver 恢复为只输出 sealed receipt、把 Publisher/Doctor 恢复到 1.37.0，并保留正常 publication/review 自动 handoff、手动等待和已公开站点。

## 10. 下一轮唯一主任务

为 Obsidian 增加明确的运行时/磁盘插件版本握手。Author Doctor 的结构化报告继续验证仓库磁盘 manifest、main 与 styles；运行中的插件把 `this.manifest.version` 作为独立 runtime 事实，与报告里的磁盘版本比较。若不一致，任何作者 Git 领域命令都在 preflight 显示专用 `PLUGIN RELOAD REQUIRED` interlock，给出关闭再启用 MyBlog Publisher 或重启 Obsidian 的步骤，不自动 reload、不运行领域命令、不读取凭据、不修改文件。doctor parser 必须能结构化识别未来磁盘 patch/minor 版本并保持真正伪造报告失败关闭，普通只读状态命令继续可用于诊断。
