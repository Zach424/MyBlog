# Iteration 0067：作者事务会话内最近终态回执

## 1. 范围与成功标准

本轮完成 Iteration 0066 的唯一主任务：让 Obsidian 作者在活动 Notice 已经消失、single-flight lease 已释放后，仍能从“查看当前作者事务”确认本插件会话最近一次新发布/复核事务做了什么、最终在哪个阶段、如何结算以及运行多久。范围只包含 MyBlog Publisher 进程内 terminal receipt、终态分类、owner-checked 结算和原生 Notice；不改变 author doctor schema、publish/review 领域脚本、Git 提交包、交付恢复、Studio、Next 页面、内容 schema 或部署配置。

成功标准是：插件实例初始化时没有回执；最终 owner 结算时只保存一条冻结 `{ elapsedMs, endedAt, label, outcome, phase, sourcePath, startedAt }`。outcome 固定为 `completed / held / command-failed / start-failed / result-failed / unloaded`；endedAt 不早于 startedAt、phaseEnteredAt 或 lastOutputAt。只有当前 lease 且 child identity 匹配时才可写入，ownership 转交后的旧 finally、迟到事件和旧 lease 都不能覆盖。新事务 active 时继续显示实时 snapshot，空闲且有回执时显示 `IDLE · LAST RECEIPT`，空闲且无回执时保持原 IDLE。回执不保存 stdout/stderr、错误文本、退出码、PID、Git 凭据或历史，不写磁盘，插件重载后清除，也不自动重试、恢复或 push。功能提交 `d4b9b3daa2249cc7eb0516acb3e0a6ae922a31a8` 可回滚到插件 1.17.0，不需要数据迁移、reset 或强推。

## 2. 项目结构状态

- `.obsidian/plugins/myblog-publisher/main.js`：插件契约升到 1.18.0；增加六类终态 allowlist、最近回执状态、owner-checked 记录、回执格式器和 IDLE 展示；
- `.obsidian/plugins/myblog-publisher/manifest.json`：版本升到 1.18.0，描述同步为一条会话内作者事务回执；
- `lib/content/author-doctor.ts`：Vault 期望插件版本同步到 1.18.0；version 1 doctor 与 13 项检查不变；
- `tests/obsidian-plugin.test.mjs`：覆盖冻结回执、精确字段、六类 outcome、ACTIVE 优先、后续结算覆盖、旧 owner 拒绝、诊断降级与卸载；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步 1.18.0 doctor/manifest 与静态 terminal receipt 契约；
- Vault 架构、设计、操作、发布、路线图、状态、inbox 指南、公开项目页和本轮档案同步当前事实；
- CSS、Next/React 源码、Studio、workflow、依赖、数据库、Cloudflare 与托管配置没有改变。

## 3. 设计内容

主体是刚完成或刚失败、原终态 Notice 已消失、需要复查“刚才结果是什么”的作者。状态命令仍只有三种作者可见表达：活动 lease 为 `ACTIVE`；没有 lease 但有回执为 `IDLE · LAST RECEIPT`；两者都没有为 `IDLE`。回执的信息顺序固定为 outcome → operation → source → final phase → startedAt → endedAt → elapsed → 会话/动作边界。六类 outcome 同时使用中文说明与 monospace token，避免只暴露内部枚举。

界面继续只用 Obsidian 原生 Notice。没有新 Modal、CSS、颜色、图标、卡片、动画、按钮、历史列表或常驻刷新。`COMPLETED` 也不使用庆祝色，失败类不使用危险卡；最后一行明确“重载即清除、不会重试/恢复/push”。设计取舍是补回一次短暂的记忆，而不是把插件变成任务中心或错误日志浏览器。

## 4. 使用的技术

- Obsidian CommonJS 插件实例内的一条 `lastAuthorTransactionReceipt`；
- `AUTHOR_TRANSACTION_OUTCOME_LABELS` 固定 outcome allowlist 与作者语言；
- 当前 lease identity + 可选 child identity 的双重结算门；
- `Object.freeze` 不可变回执；
- startedAt、phaseEnteredAt、lastOutputAt 与当前墙上时钟的单调 endedAt；
- `runRepositoryCommand` 的允许退出、非允许退出、同步 spawn throw、异步 error、结果回调异常和 unload 汇聚点；
- onSuccess 返回窄 sentinel `held`，不改变其他领域 callback 接口；
- ACTIVE snapshot 与 IDLE receipt 的明确优先级，状态查询仍零 spawn；
- `research-iteration-loop` 将本轮限制为一个 terminal-memory 缺口，并要求 fail-first、真实 doctor、两轮完整 release gate、功能/归档双提交与远端证据；
- `frontend-design` 让终态复查继续服从 Native Notice 的工程证据语法，拒绝新 Modal、颜色状态卡和历史面板。

## 5. 实现的功能

- 插件加载时初始化空最近回执，重载自然清除；
- `recordAuthorTransactionReceipt` 只接受当前 lease 与固定 outcome；
- 回执冻结 operation、sourcePath、final phase、startedAt、endedAt、elapsed 和 outcome；
- `completed` 表示最终 owning command 允许退出且结果处理完成；
- `held` 表示 author preflight attention，或结构化 doctor 不可信后只展示文本证据、原操作未启动；
- 非允许退出码、同步/异步启动失败、允许退出后的结果处理异常分别记录 command/start/result failed；
- 插件卸载在作废 lease 与终止进程树前记录 unloaded；该值只作为同一实例的清理证据，不跨重载可见；
- ownership 转给 domain/diagnostic child 后，旧 child finally 无法提前生成 completed；
- 后续事务 active 时旧回执保留但不展示，最终 owner 结算后才原子覆盖；
- 空闲查询以 `IDLE · LAST RECEIPT` 显示精确终态，不启动任何子进程；
- 原无回执 IDLE、BUSY/ACTIVE、activity pulse、doctor/报告/分诊/status/deliver bypass 全部保持。

## 6. 实现方法

`recordAuthorTransactionReceipt` 先验证 `this.authorTransactionLease === lease`，再验证 outcome 是否属于冻结 allowlist。endedAt 取 startedAt、phaseEnteredAt、lastOutputAt 与有限当前时钟的最大整数值，因此时钟回拨或无效当前时钟不会让结束证据早于已有事件。方法复制七个作者需要的字段并 `Object.freeze`，先更新 `lastAuthorTransactionReceipt`，随后 `releaseAuthorTransactionLease` 才把当前 lease 置空；无效 outcome 会失败关闭而不是释放出无类别终态。

`runRepositoryCommand` 现在在唯一结算边界传入 outcome：spawn 同步 throw 和 child error 为 start-failed；非允许 close code 为 command-failed；允许退出先假定 completed，onSuccess 明确返回 `held` 时改为 held，onSuccess 抛错时改为 result-failed。author doctor 结构化 attention 返回 held；结构化 doctor 不可信后的文本 fallback 无论 CLI 0/1 都返回 held，因为原发布/复核操作没有启动。review Proof 文本 fallback 仍是完成 check-only 领域事务，因此保留 completed。

ownership 转交语义没有旁路：preflight onSuccess 启动 domain child 后，`lease.child` 已改变，旧 child finally 带旧 identity 调用 release 会返回 false；诊断 fallback 同理。`inspectAuthorTransaction` 先请求实时 snapshot；只有 snapshot 为空时才看最近回执，所以旧结果不会盖住新事务。回执格式器只读冻结对象，不调用命令、不写文件、不推断恢复动作。

## 7. 验证证据

- 初始 fail-first 定向集共 71 项：38 项通过、33 项失败，用时 5.04 秒；失败来自插件仍为 1.17.0、缺少最近回执/六类终态/IDLE 展示，以及版本失配使依赖 doctor 的既有事务按设计进入 HOLD；其他附件、交付、维护和发布功能通过；
- 最终 `node --check` 与三组定向测试 71/71；Node 测试用时 5.10 秒，外层计时 5.22 秒；
- 精确回执测试证明对象被冻结，字段只有 elapsedMs/endedAt/label/outcome/phase/sourcePath/startedAt，且 `IDLE · LAST RECEIPT` 零 spawn；
- completed、held、command-failed、start-failed、result-failed、unloaded 六类终态全部有结算证据；
- ACTIVE 优先测试证明新 lease 运行时不展示旧回执，直到新最终 owner 结算才覆盖；
- 旧 lease 直接 record、ownership 转交后的旧 finally 与迟到 close/error 都不能覆盖当前事务或最近回执；
- author preflight attention 和结构化 doctor 降级均记录 held，review Proof 文本降级记录 completed；
- 真实仓库 doctor 用时 1.42 秒，为 ready、13/13、11/11 脚本、32/32 固定依赖、5/5 路径、MyBlog Publisher 1.18.0，且 `configurationChanged/filesChanged/credentialsRead/networkChecked` 全为 false；
- 第一次完整 `npm run release:check` 用时 122.37 秒：Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、237/237 单元与集成、TypeScript、45/45 页面、19/19 生产应用测试、production audit 0；
- 归档后的第二次完整 `npm run release:check` 用时 100.81 秒：237/237 单元与集成、TypeScript、45/45 页面、19/19 生产应用测试与 production audit 0 再次通过；
- 功能提交 `d4b9b3daa2249cc7eb0516acb3e0a6ae922a31a8` 已推送；`Lint, test, typecheck, and build`、`Smoke-test the deployed site` 与 Vercel commit status 共 3/3 success，并绑定该 SHA；
- `git diff --check` 与功能提交前 `git diff --cached --check` 通过；没有新增依赖、secret、数据库、Cloudflare、真实 API、自动恢复或网络探测；
- 本轮没有修改 Next.js 代码，因此没有触发 Next 16 API、约定或文件结构判断，无需读取 `node_modules/next/dist/docs/`；真实 Obsidian 宿主像素仍未人工截图验收。

## 8. 经验与教训

- “租约释放”本身信息不足；如果不在同一个 owner-checked 原子点生成回执，终态和 ownership 会发生竞态；
- 成功退出不总等于事务完成。author doctor attention 使用允许退出码 1，但原操作被 held，必须由 onSuccess 语义显式区分；
- 结构化 doctor 降级到文本即使退出 0，也不能改称 completed，因为原领域命令仍有意失败关闭；
- review Proof 降级与 doctor 降级不同：前者仍完成了领域 check-only，只是证据载体降级，因此 outcome 仍可 completed；
- child `error` 在当前 Node spawn 边界代表命令无法启动或保持运行，用 start-failed 比 command-failed 更符合作者修复路径；
- 结果 callback 抛错与 CLI 非零需要分开。命令可能已成功，但插件无法安全处理结果，此时 result-failed 更诚实；
- 最近一条比历史列表更符合当前需求。历史会带来存储、隐私、过期和清理策略，本轮没有足够收益；
- ACTIVE 必须优先于旧 receipt，否则作者会把上一事务结果误认成当前运行状态；
- unload receipt 对测试清理顺序有价值，但实例随即销毁，所以不能承诺跨重载可见；
- outcome 只表达结算类别，不替代 Git delivery triage、Vercel checks 或生产冒烟。

## 9. 全局状态、风险与未解决问题

MyBlog Publisher 1.18.0 现在把作者事务观察链从启动前 doctor、single-flight、phase/output activity 延伸到会话内终态复查。站点继续以 GitHub 为唯一内容事实源、Vercel 原生托管，不依赖 Cloudflare；Studio/Obsidian 双发布、内容维护、统一 Git 交付分诊、两类安全重送和可信 deliver receipt 保持原状。作者无需终端或 Codex，即可在 Notice 消失后区分完成、前置拦截、命令失败、启动失败与结果处理失败。

当前本地作者链路最明显的重复操作转移到草稿起点：作者仍需手工创建 `content/inbox/<slug>.md`，从 `templates/obsidian/article.md`、`til.md` 或 `project.md` 选择模板，再替换日期、slug 与标题。这个过程不需要云服务，适合由插件提供一个窄的安全向导；但任何模板漂移、路径碰撞或非法 slug 都必须在写文件前失败关闭，不能覆盖作者笔记。

其他长期风险不变：terminal receipt 不含错误正文，详细失败仍看原终态 Notice/终端；重载会清除回执；构建工具输出静默不能证明卡死；真实 Obsidian 主题、超长路径和窄屏像素体验需要日常观察；Studio OAuth 与固定 Decap bundle 需要维护；实时外链网络结果不进入硬门；自定义域名、公开邮箱、统计和评论等待所有者选择。

## 10. 下一轮唯一主任务

为 Obsidian 增加一个模板驱动的安全新建草稿向导。作者选择 Article、TIL 或 Project，输入稳定小写 ASCII slug 与非空标题；插件只从 Vault 中对应的 `templates/obsidian/*.md` 受信模板生成一个 `content/inbox/<slug>.md`，以 `Asia/Shanghai` 当天替换模板日期、写入明确 slug/title 后立即打开。任何非法 slug、空标题、模板缺失或契约漂移、inbox 路径已存在、正式 post/project 目标碰撞都必须在创建前失败关闭。它不覆盖、不发布、不暂存、不提交、不推送、不访问网络，也不依赖云 API；模板解析、日期边界和原子创建语义先在失败优先测试中冻结。
