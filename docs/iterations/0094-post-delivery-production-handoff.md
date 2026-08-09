# Iteration 0094：交付后自动接力生产等待

## 1. 范围与成功标准

本轮只闭合一条作者体验断点：Obsidian 主发布或正式内容复核已经可信完成 Git push 后，不再要求作者手动打开正式笔记启动生产等待，而是把同一个已交付对象自动交给 Iteration 0093 的只读收敛等待器。它不改变 Markdown 事实源、内容 schema、Git 提交内容、Vercel 部署方式、公开路由、Studio、默认质量门、恢复交付命令或手动等待入口。

成功标准是：只有 `publish-note --push` / `review-note --push` 的可信成功路径能请求 handoff；领域脚本必须先证明 local/tracking 都等于精确已交付 commit，再冻结最终正式来源、来源 SHA-256 和公开 Markdown ETag；handoff 必须是 stdout 唯一最后证据行；Obsidian 必须严格验证 receipt，在作者 Git 事务释放后才等待 Vault reconcile，随后复用现有生产等待器；等待器必须在联网前重新核对冻结摘要；来源漂移、不可信 receipt、reconcile 失败、timeout、网络/协议错误、取消或插件卸载均不得回滚、重新提交、重复 push 或自动重试；完整本地门、GitHub Quality、Vercel 生产验证和真实冻结参数收敛全部通过。

## 2. 项目结构状态

- `lib/content/post-delivery-handoff.ts`：新增 version 1 handoff 领域对象、最终正式来源冻结、Git OID/目标校验和固定前缀格式器；
- `lib/content/production-sync.ts`：导出唯一稳定生产 origin，供全库核对、单篇等待和 handoff 共享；
- `scripts/publish-note.mjs`：新增仅与 `--push` 配对的 `--handoff`；提交后验证 exact pending-publication、当前 clean-filter blob、local/tracking 精确 commit，再输出 publication handoff；
- `scripts/review-note.mjs`：新增相同受限参数；复核候选在提交前冻结，push 后验证 local/tracking 精确 commit，再输出 review handoff；
- `scripts/wait-production-content-convergence.mjs`：新增成对的 `--expected-source-sha256` 与 `--expected-local-etag-sha256`，联网前重算并拒绝 handoff 目标漂移；
- `.obsidian/plugins/myblog-publisher/main.js`：新增严格 handoff parser、内部 post-author-release continuation、Vault reconcile 边界、自动等待参数和交付上下文终态展示；
- `.obsidian/plugins/myblog-publisher/styles.css`：复用生产终态版式并加入 handoff 区域；
- `.obsidian/plugins/myblog-publisher/manifest.json`、`lib/content/author-doctor.ts`：Publisher 与 doctor 期望版本升至 1.37.0；
- `tests/post-delivery-handoff.test.mjs`：新增领域冻结与 handoff 不可变回归；
- `tests/obsidian-publishing.test.mjs`、`tests/content-review.test.mjs`：用真实裸 Git 远端验证 publication/review 精确一次 push 后的 handoff；
- `tests/production-content-convergence.test.mjs`：验证冻结摘要配对、真实 CLI 成功和摘要漂移时零网络请求；
- `tests/obsidian-plugin.test.mjs`：验证两类自动接力、事务先释放、延迟 reconcile、固定参数、伪造/迟到 receipt、卸载和零重复 Git 动作；
- README、架构、发布、运维、发现、状态、路线图和本归档继续位于仓库根 Obsidian Vault；内容 Markdown、公开页面、依赖和 workflow 未改变。

## 3. 设计内容

本轮设计的是跨进程交接协议，不是把网络轮询塞进 Git 写事务。handoff 固定显示为 `[post-delivery-handoff] <JSON>`，只能出现在成功命令 stdout 的最后一行。结构包含 `version: 1`、`mode: post-delivery`、`delivery: publication|review`、精确 commit、完整生产收敛目标，以及 `gitDelivered: true / productionChecked: false / waitStarted: false`。这组安全声明明确区分“Git 已交付”和“生产尚未取证”，避免把 push 成功误画成已经上线。

Obsidian 将 handoff 转换为内部 continuation，而不是在领域命令回调里直接联网。`runRepositoryCommand()` 先记录终态、释放 author transaction lease，再异步执行 continuation；continuation 等待 `vault.adapter.reconcile()`，核对插件仍加载，才启动已有 latest-wins 等待 scope。生产 Modal 继续保持无动作按钮，只额外显示 `DELIVERY HANDOFF / PUBLICATION|REVIEW`、commit 和相同零 Git 动作边界。

手动“等待当前正式内容上线”继续保留，Studio、普通 Git 和本轮未覆盖的两条 recovery deliver 仍可使用。这样自动化只增加已经存在的只读证据，不把联网可用性变成发布成功的必要条件。

## 4. 使用的技术

- Node.js SHA-256、`TextDecoder(..., { fatal: true })` 与现有 Zod 内容契约：从原始 UTF-8 正式来源重建最终公开目标；
- Git `hash-object --path=<path> --stdin`、commit tree blob、local/tracking ref：证明 handoff 对应已交付 commit 的 clean-filter 后正式字节；
- 冻结 version 1 JSON 与 exact-key parser：对 delivery、OID、来源、URL、kind/type、ETag、hash 和 safety 进行双端重算；
- Obsidian CommonJS、symbol continuation、author transaction lease、Vault adapter reconcile、generation 和进程取消：建立 Git 写边界与只读网络边界的明确 happens-before；
- Node 原生参数数组、`shell: false` 与纯十六进制摘要：避免 Windows `cmd.exe` 引号和插值差异；
- Node test 临时裸远端、真实 Git 提交/push、loopback HTTP 与 VM Obsidian harness；
- `research-iteration-loop` skill：执行失败优先、最小闭环、局部门、完整门、真实生产、全局复盘和下一唯一任务。

## 5. 实现的功能

1. `npm run content:publish -- --push --handoff <source>` 在普通新内容发布成功后输出 publication handoff；不带 `--push` 时明确拒绝 `--handoff`；
2. `npm run content:review -- --push --handoff <source>` 在正式内容复核成功后输出 review handoff，并同样拒绝 check-only 请求；
3. 两类脚本只在 local/tracking 同为已交付 commit 后签发 handoff；publication 还用 commit manifest 与 `hash-object` 证明草稿转正式内容的最终 blob，review 使用门禁冻结的同一路径候选；
4. handoff 绑定精确 `content/posts|projects/<slug>.md`、公开 id、kind/type/title、`source.md` URL、原始来源 SHA-256 与最终 Markdown ETag；
5. Publisher 的“发布当前草稿并同步 GitHub”与“提交并同步当前正式内容复核”自动添加 `--handoff`；两个 check-only 入口保持原参数和语义；
6. 插件只接受唯一且位于 stdout 最后一行的前缀 receipt，并验证 publication inbox slug 到正式 slug、review 同一路径、commit 格式、稳定生产 origin、完整目标和三项 safety；
7. 可信 handoff 先结算作者事务，再等待 Vault reconcile；网络等待期间 author lease 已为空，不会阻塞下一次本地作者操作；
8. 自动等待复用原 `content:production:wait`，只额外传入两个无引号摘要；CLI 重读当前正式来源，任何 hash/ETag 漂移都在首次 HTTP 请求前失败；
9. 自动终态 Modal 显示交付类型和 commit，原手动入口的冻结目标、尝试、生产快照和零写入边界保持不变；
10. reconcile 期间插件卸载会取消 continuation，不产生新进程、迟到 Notice 或 Modal；运行中的等待仍沿用 latest-wins 和卸载终止；
11. 不可信 handoff、失败命令或成功后的等待失败都只报告证据不足，不会再次调用发布/复核脚本、再次提交、push、回滚或自动重试；
12. `content:publish:deliver` 与 `content:review:deliver` 仍保持 sealed Git receipt 原语义，成功后暂时使用手动等待，避免本轮扩大恢复事务范围。

## 6. 实现方法

先新增 `tests/post-delivery-handoff.test.mjs`，首次执行因 `lib/content/post-delivery-handoff.ts` 不存在返回 `ERR_MODULE_NOT_FOUND`。随后在 Obsidian harness 中先写出“命令必须带 `--handoff`、Git author lease 必须在 reconcile 前释放、reconcile 完成后才出现第三个 wait 子进程、伪造 safety 不能标记完成”等断言；旧插件因为缺少参数和 continuation 而失败，保留了功能确实由本轮引入的证据。

领域层没有让插件自行猜最终路径或 ETag。发布脚本在完整质量门后从目标正式文件冻结 record；提交生成后再次读取 exact pending-publication，并用当前正式字节经过 Git clean filter 得到 blob OID，与提交 manifest 中目标 blob 比较。复核脚本复用已经由 gate-stable 证明的候选。两者 push 后都要求 local/tracking 指向同一个原 commit，才把 handoff 写成 stdout 最后一行。

插件 parser 把子进程输出视为不可信。除了 exact keys 和基本格式，它还重新计算来源路径与公开 URL 的 slug 关系、kind/type 关系、Markdown URL、稳定生产 origin、摘要形状与安全布尔值；任何第二条 handoff 或 receipt 后还有输出都失败关闭。parser 成功只创建 continuation，不代表生产成功。

`runRepositoryCommand()` 的顺序是本轮最重要的并发边界：先完成成功回调和终态 receipt，再释放 author transaction，最后才调度 continuation。continuation 本身先等待 Vault reconcile；因此 Git 子进程已经结束、工作区视图已经刷新，才启动网络子进程。等待 CLI 用成对摘要重建现场目标，若作者在边界间修改来源，比较失败且网络请求计数保持为零。

## 7. 验证证据

- 失败优先：handoff 单元测试首次因缺少 `lib/content/post-delivery-handoff.ts` 返回 `ERR_MODULE_NOT_FOUND`；Obsidian 测试首次因命令没有 `--handoff`、没有第三个等待进程且伪造 safety 被错误接受而失败；
- handoff 领域专用回归：2/2；生产收敛专用回归：7/7，其中冻结摘要漂移用例证明零网络请求；
- Obsidian 插件完整回归：202/202，覆盖 publication/review、author lease 先释放、延迟 reconcile、自动参数、终态 commit、伪造 safety、handoff 非最后行和 reconcile 中卸载；
- 真实 publication 裸远端集成：精确一次提交/一次 push 后生成可信 publication handoff；真实 review 裸远端集成同样通过；
- 全部单元与集成测试：452/452；ESLint、TypeScript 与 `git diff --check` 通过；
- 真实 Author Doctor：13/13 ready、13/13 必需脚本、32/32 固定依赖、五类路径全部存在、Publisher 1.37.0；配置、凭据、文件、网络 safety 均为 false；
- 首次完整 `npm run release:check`：用时 120.7 秒，452/452 单元与集成、TypeScript、47/47 构建路由、20/20 真实应用测试、九路 HTML raw/gzip 预算、生产依赖审计 0；Current 1、Historical 3、inbox 0、根暂存 0、外链本地问题 0；
- 状态、路线图和本归档写入后第二次 `npm run release:check`：用时 127.7 秒，同样保持 452/452、47/47、20/20、九路预算全部 PASS、生产依赖审计 0 与全部内容/媒体/外链本地状态不变；
- 功能提交：`aacf8230aead04b74c0c87239e244301b60f7b18`；父提交：`38eaa98160d1c22861d54ad3b03c64390c133d73`；
- [Quality Gate #174](https://github.com/Zach424/MyBlog/actions/runs/31332336369) 与 [Production Smoke #167](https://github.com/Zach424/MyBlog/actions/runs/31332362563) 均成功；
- 真实稳定生产冻结参数等待：`content/projects/myblog.md` 在 1 次、1276 ms 内返回 deployed；来源 SHA-256 为 `f8099473652329e06343194baaf48e7c65a8f1a53ea7f6c092fe5a20f344daf4`，Markdown ETag digest 为 `ab62e9d92481f053474c6a29d0dd6413076b59927c99f123002346dd214fd303`；
- 最终生产清单快照 ETag 为 `W/"sha256-88aa4a0c0cae5890a15b9f13ecaeeeb79d3d47f43c60dbcde23915e7ad2debbb"`，Last-Modified 为 `Thu, 06 Aug 2026 00:00:00 GMT`。

## 8. 经验与教训

“push 成功后自动等待”最危险的实现方式，是在 Git 成功回调里直接发起三分钟网络轮询。那会让 UI 看起来仍被发布事务占用，也会模糊失败责任：网络失败可能被误解为 Git 发布失败。把 continuation 做成 author release 之后的独立阶段，才能让 Git 交付回执先成为不可逆事实，生产等待只追加证据。

handoff 必须冻结最终 Git 表示，不应只携带来源路径。publication 会删除 inbox、生成正式文件并可能经过属性 clean filter；因此需要用 `hash-object --path --stdin` 证明当前正式字节与提交 tree 的目标 blob 相同，再从这些字节计算公开目标。否则一个看似合法的 path 可能在 push 与等待之间指向不同内容。

stdout 的行位置也是协议。只搜索任意一行前缀，会让后续日志、多个 receipt 或包装脚本输出悄悄改变语义。要求唯一且最后一行，使 CLI 仍可保留人类日志，同时插件能明确知道哪个对象是终态交接证据。

Vault reconcile 不是 Git 交付的一部分，却是桌面作者体验的重要可见性屏障。只有宿主文件视图更新后再启动正式来源等待，才能避免插件基于旧 inbox/旧正式文件状态继续工作。reconcile 失败不应撤销已经完成的 push；它只意味着自动接力没有开始，作者仍可使用手动等待。

Windows 固定参数不应携带嵌套引号的 ETag。把 ETag 的 64 位 digest 与来源 SHA-256 分开作为纯小写十六进制参数，由 CLI 在领域内重建强 ETag，既缩小参数语法，也降低 `cmd.exe` 和测试宿主差异。

## 9. 全局状态、风险与未解决问题

主作者链路现在连续保存四段独立证据：Author Proof/质量门证明候选，Git delivery 证明 commit 进入 tracking ref，post-delivery handoff 证明等待目标精确继承已交付对象，production convergence 证明冻结的公开表示出现在稳定生产清单。网络阶段不持有 Git 写租约；GitHub 仍是唯一写入事实源，Vercel 仍只负责构建、部署和公开读取，不依赖 Codex、Cloudflare、数据库、第三方同步 API 或通知。

本轮没有把 recovery deliver 纳入自动接力。push 首次失败后，`content:publish:deliver` / `content:review:deliver` 能安全按精确 OID 恢复并签发 sealed receipt，但作者仍需手动运行等待。这是刻意留下的窄缺口，而不是交付失败。Studio 与普通 Git 也继续使用手动入口。Obsidian 子进程访问 Vercel 仍依赖本机 DNS/代理；Node 24 使用环境代理时需要 `NODE_USE_ENV_PROXY=1`。真实主题下长 ETag、commit、尝试列表和持续 Notice 仍需首次人工观察。

回滚功能提交使用 `git revert aacf8230aead04b74c0c87239e244301b60f7b18`。该提交没有数据库迁移、外部配置或内容变更；回滚会移除 post-delivery handoff 与自动 continuation，把 Publisher/Doctor 恢复到 1.36.0，并保留手动 `content:production:wait`、全库 `content:production` 和已公开站点。

## 10. 下一轮唯一主任务

让 `content:publish:deliver` 与 `content:review:deliver` 两条可信恢复交付在 sealed receipt 成功后生成同一 version 1 post-delivery handoff，并由 Obsidian 在 receipt 严格验证和 Vault reconcile 后自动接力现有等待器。必须从已交付 commit 与不可变 publication/review manifest 派生最终正式目标，不重新提交、不增加第二次 push；不可信 receipt、来源漂移、reconcile 失败、timeout、网络/协议错误、取消或卸载只能保留恢复证据并提示手动等待，不能自动重试。仍不接账号、数据库、第三方 API 或通知。
