# Iteration 0064：作者事务 Single-flight Lease

## 1. 范围与成功标准

本轮完成 Iteration 0063 的唯一主任务：把 Obsidian 的四个新发布/复核事务从“各自运行 doctor”收敛为一条进程内 single-flight 链路。范围只包含租约 acquisition、child ownership 转交、BUSY 反馈、全部终态释放、插件卸载作废、迟到事件隔离和恢复命令 bypass；不改变 author doctor schema、publish/review 领域脚本、Git 提交包、网页 Studio、Next 页面或部署配置。

成功标准是：租约在 doctor spawn 前原子占用，跨越 ready continuation、领域命令、author-doctor 纯文本降级和 review Proof 纯文本降级；占用时第二个新作者事务不排队、不启动 doctor 或领域子进程，只显示当前 operation 与冻结 sourcePath；成功、非零退出、同步/异步 spawn error、回调异常和插件卸载均释放或作废；旧 child 的迟到 close/error 不能释放新 owner。显式 doctor、全部只读报告、统一分诊、复核/发布状态和两类 deliver 必须继续运行。功能提交 `2ce4380cbc70ec3efe3c1765ff66e0ca37705a6d` 可回滚到插件 1.14.0，不需要内容迁移、reset 或强推。

## 2. 项目结构状态

- `.obsidian/plugins/myblog-publisher/main.js`：新增 `authorTransactionLease`、owner-checked release、BUSY 路由，以及跨子进程 continuation/fallback 的 lease 传递；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.14.0 升到 1.15.0，并声明单一作者事务链路；
- `lib/content/author-doctor.ts`：Vault 期望插件版本同步到 1.15.0；doctor version 1 与 13 项检查不变；
- `tests/obsidian-plugin.test.mjs`：扩展 spawn fixture，覆盖占用、ownership 转交、全部释放路径、诊断降级、恢复 bypass、卸载和迟到事件；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步 1.15.0 manifest/doctor 契约；
- Vault 架构、设计、操作、发布、路线图、状态、inbox 指南、公开项目页和本轮档案同步当前事实；
- CSS、Next/React 源码、内容 schema、Studio、workflow、依赖、数据库、Cloudflare 与托管配置没有改变。

## 3. 设计内容

本轮主体是已经启动一个耗时检查或发布、又误触第二个命令的作者。界面只需说明“已有哪项操作占用写作链路”，不应把暂时串行状态伪装成环境故障，也不应再打开一套 Modal 或 preflight circuit。

唯一新增反馈是一条短暂 Notice：首行 `AUTHOR TRANSACTION / BUSY`，随后显示原始操作、冻结 sourcePath 和“当前操作完成后再试”。它没有按钮、排队承诺、取消入口、百分比、动画或新 CSS。现有 `TRANSACTION INTERLOCK / HELD` 继续只表达可修复的 author doctor attention；BUSY 只表达一个正在运行的互斥事实。

## 4. 使用的技术

- Obsidian CommonJS 插件实例内的单一 mutable lease；transaction 使用 `Object.freeze` 固定 label/sourcePath；
- JavaScript 对象身份作为 owner token，不依赖可碰撞的序号或墙上时钟；
- `lease.child` 把 ownership 从 doctor 转交到 domain 或 diagnostic child；
- `releaseAuthorTransactionLease(lease, child)` 同时验证 lease identity 与 current child identity；
- 共享 `runRepositoryCommand` 第四参数传递 lease，并在 sync spawn catch、async error、allowed/non-allowed close 和 callback `finally` 结算；
- 原活动进程账本继续负责 Notice、一次性 settle、输出上限、进程树清理和迟到事件抑制；
- Node test VM/spawn fixture 增加确定性同步 spawn failure 注入；
- `research-iteration-loop` 将本轮限制为 concurrency gap，要求 fail-first、真实 doctor、功能/归档双提交与两次完整门；
- `frontend-design` 将 BUSY 收敛为最小 Notice，保留既有 evidence rail，不增加第二套故障视觉。

## 5. 实现的功能

- 四个新作者事务在 doctor 启动前争用同一个 lease；
- 第一个调用保存冻结的 operation 与 sourcePath，并把 doctor child 设为 owner；
- ready 后 domain child 接管同一 lease，旧 doctor close 不能释放它；
- author doctor JSON 不可信时，纯文本 doctor child 接管 lease；文本证据结算后释放；
- review Proof JSON 不可信时，纯文本 review child 接管 lease；文本证据结算后释放；
- attention、fatal exit、domain failure、同步 spawn throw、异步 child error 和成功 close 全部释放；
- callback/Notice 处理异常也通过 `finally` 释放；
- 插件卸载先把 lease 置空，再取消活动运行和终止进程树；
- 旧 child 在新事务开始后补发 close/error，只能命中自身 settled guard，不能释放新 lease；
- 占用期间第二个调用只显示 `AUTHOR TRANSACTION / BUSY`、当前操作、路径和等待建议；
- 显式 doctor、inbox/维护报告、统一分诊、两类状态和两类 deliver 全部绕过 lease。

## 6. 实现方法

`preflightAuthorTransaction` 先检查插件实例的 `authorTransactionLease`。已有 lease 时直接从其冻结 transaction 生成 BUSY Notice并返回，不触碰活动进程账本；没有 lease 时创建 `{ transaction, child: null }`，在同一同步调用中交给 `runRepositoryCommand`。spawn 成功后，只有该 lease 仍是实例当前 owner 才写入 child。

每个 child 结算时，`runRepositoryCommand` 都携带最初的 lease 与 child。成功回调先执行 continuation：如果 continuation 启动了下一阶段，新 child 会先覆盖 `lease.child`；旧阶段随后调用 release 时因 child identity 不匹配而失败，从而保持租约。如果没有下一阶段，当前 child 仍匹配并释放。sync spawn failure 没有 child，因此按 lease identity 直接释放；async error 和非零 close 在展示 Notice 前释放。成功回调包装在 `finally` 中，避免 Modal/Notice/reconcile 异常遗留死租约。

该模型没有把恢复写动作纳入互斥。pending review/publication deliver 处理的是已经存在的精确 commit，与“启动新作者事务”是不同状态机；它们和所有诊断入口继续 bypass，避免在仓库非 synchronized 时既不能开始新事务、也不能恢复旧事务。

## 7. 验证证据

- 初始 fail-first 定向集 67 项中 52 项通过、15 项失败；失败来自插件仍为 1.14.0、缺少 lease/BUSY/释放事实，既有发布与复核行为保持通过；
- 补充 review Proof 文本降级边界后，最终 author-doctor + Obsidian plugin + publishing 定向测试 68/68，用时 5.77 秒；
- `node --check .obsidian/plugins/myblog-publisher/main.js` 通过；
- 并发测试证明 preflight 与 domain 两阶段各自阻止第二个事务，成功 close 后新调用可重新取得不同 lease；
- attention、fatal、sync spawn throw、domain nonzero、async error、插件卸载均证明 lease 回到 null；
- author doctor 与 review Proof 两条纯文本 fallback 均证明 lease 转交给新 child，fallback 前不提前释放；
- 旧 domain child 在新 lease 创建后补发 close，实例仍保留新 owner；
- 八个诊断/状态/分诊/deliver 命令在 author lease 占用时仍各自启动，且不改写 lease.child；
- 真实仓库 doctor 为 ready、13/13、11/11 脚本、32/32 固定依赖、5/5 路径、MyBlog Publisher 1.15.0，`filesChanged: false`、`networkChecked: false`；
- 第一次完整 `npm run release:check` 用时 131.7 秒：Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、234/234 单元与集成、TypeScript、45 页、19/19 生产应用测试、production audit 0；
- 归档后第二次完整 `npm run release:check` 用时 98.7 秒：234/234 单元与集成、TypeScript、45 页、19/19 生产应用测试与 production audit 0 再次通过；
- 功能提交 `2ce4380cbc70ec3efe3c1765ff66e0ca37705a6d` 已推送；两条 GitHub Actions check 与 Vercel commit status 共 3/3 success，并绑定该 SHA；
- `git diff --check` 通过；没有新增依赖、secret、数据库、Cloudflare、真实 API、自动修复或网络探测；
- 本轮没有修改 Next.js 代码，因此无需依据本地 Next 16 指南做 API 迁移判断；真实 Obsidian 宿主像素仍未人工截图验收。

## 8. 经验与教训

- “有活动子进程”不等于“有作者事务”。报告可以合法并行，互斥必须绑定领域 transaction，而不能粗暴复用全局 `activeRuns.size`；
- 租约不能在 doctor 成功时释放。ready 只是从 preflight 进入 domain 的状态转移，owner 必须在同步 continuation 中先转交；
- 单一布尔锁不足以防迟到事件。对象 identity 加 owning child identity 才能证明谁有资格释放；
- 诊断降级也是原事务的一部分。如果结构化失败后先释放再启动文本命令，第二个事务会插入两个阶段之间；
- spawn 既可能同步 throw，也可能异步发 error，两条路径都需要独立测试；
- unload 的顺序重要：先作废 lease，再 cancel/kill child，才能保证任何迟到回调都看不到有效 owner；
- pending deliver 不是新发布。把它纳入 lease 会让恢复受正在失败的作者链路影响，违背既有 recovery boundary；
- busy 是暂时状态，不是错误证据。简短 Notice 比新增 Modal 更符合现有视觉语义，也减少维护面。

## 9. 全局状态、风险与未解决问题

MyBlog Publisher 1.15.0 现在同时具备 author doctor 前置联锁和新事务串行化。站点继续以 GitHub 为唯一内容事实源、Vercel 原生托管，不依赖 Cloudflare；Studio/Obsidian 双发布、内容维护、统一 Git 交付分诊、两类安全重送和可信回执保持原状。并发误触不再启动多个完整质量门或竞争 Git 写入，诊断和恢复入口仍可独立运行。

当前租约只保存 operation、sourcePath 与 owning child。对可能持续数分钟的完整门，作者看到 BUSY 时不知道处于 preflight、domain 还是 diagnostic，也看不到 startedAt/elapsed；不能区分“正常耗时”与“可能卡住”。本轮有意不加入取消按钮或 watchdog，因为 push 阶段的任意终止可能落在 commit 已创建、网络结果未知的边界，需要先提供只读事实再设计安全动作。

其他长期风险不变：真实 Obsidian 主题、超长路径和窄屏像素体验需要日常观察；Studio OAuth 与固定 Decap bundle 需要维护；实时外链网络结果不进入硬门；自定义域名、公开邮箱、统计和评论等待所有者选择；`decap-cms` 开发依赖审计与 Actions major tag 指针另行处理。

## 10. 下一轮唯一主任务

为 Obsidian 作者事务增加只读活动快照。lease 记录 `preflight / domain / diagnostic` phase、startedAt 和基于当前时钟计算的 elapsed；BUSY Notice 使用同一快照，并新增“查看当前作者事务”命令，在 active/idle 两态展示 operation、sourcePath、phase、开始时间与等待建议。快照不提供取消、重试或排队按钮，不猜测百分比，不持久化运行历史；显式 doctor、报告、分诊、状态与 deliver 继续 bypass，不接云 API。
