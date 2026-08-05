# Iteration 0066：作者事务阶段与输出活动脉冲

## 1. 范围与成功标准

本轮完成 Iteration 0065 的唯一主任务：让 Obsidian 作者在一个新发布/复核事务运行期间，不只知道总开始时间和当前 phase，还能知道何时进入该阶段、阶段已持续多久、owning child 最近一次产生 stdout/stderr 的时间以及已静默多久。范围只包含 MyBlog Publisher single-flight lease 的进程内时间证据、快照与原生 Notice；不改变 author doctor schema、publish/review 领域命令、Git 提交包、交付恢复、Studio、Next 页面、内容 schema 或部署配置。

成功标准是：lease 创建时记录 startedAt = phaseEnteredAt、lastOutputAt = null；phase 转换只能修改当前 lease，使用单调时间并清空前一阶段输出时间；只有当前 lease 的 owning child 可以记录 stdout/stderr，旧 child 的迟到输出不能污染新 child/phase。活动必须在 200,000 字符捕获截断之前记录。冻结快照固定输出 `elapsedMs / label / lastOutputAt / phase / phaseElapsedMs / phaseEnteredAt / silentMs / sourcePath / startedAt`，所有 duration 在时钟回拨时钳制为零。ACTIVE 与 BUSY 共用相同证据；IDLE、显式 doctor、报告、分诊、status 与 deliver 原语义不变。静默不解释成 healthy、stuck、fault 或 timeout，也不增加 cancel、retry、watchdog、输出正文、PID 或历史。功能提交 `715a04d417787fce011ba6c0f94e8fc7e5bccfe6` 可回滚到插件 1.16.0，不需要数据迁移、reset 或强推。

## 2. 项目结构状态

- `.obsidian/plugins/myblog-publisher/main.js`：插件契约升到 1.17.0；lease 增加 phaseEnteredAt/lastOutputAt，新增 owner-checked 输出活动记录，快照和 Notice 增加 phase/total/silent 时间；
- `.obsidian/plugins/myblog-publisher/manifest.json`：版本升到 1.17.0，描述同步为观察作者阶段与输出活动；
- `lib/content/author-doctor.ts`：Vault 期望插件版本同步到 1.17.0；version 1 doctor 与 13 项检查不变；
- `tests/obsidian-plugin.test.mjs`：覆盖阶段/child 转交、stdout/stderr、截断后活动、旧 child 迟到输出、回拨时钟、无输出文案、ACTIVE/BUSY 同源证据与小时格式；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步 1.17.0 doctor/manifest 与静态输出记录契约；
- Vault 的架构、设计、操作、发布、路线图、状态、inbox 指南、公开项目页和本轮档案同步当前事实；
- CSS、Next/React 源码、Studio、workflow、依赖、数据库、Cloudflare 与托管配置没有改变。

## 3. 设计内容

作者仍从“MyBlog Publisher: 查看当前作者事务”进入。ACTIVE 与 BUSY 的信息顺序固定为 operation → source → phase → phase entered/elapsed → latest output/silence → total started/elapsed → 下一步建议。尚未输出时显示“本阶段尚无输出”，而不是空字段或虚构时间。阶段继续使用 `前置检查 · PREFLIGHT`、`发布或复核 · DOMAIN`、`证据降级 · DIAGNOSTIC`，时间采用 UTC ISO，duration 使用中文秒/分/小时格式。

界面仍只有 Obsidian 原生 Notice。没有新 Modal、CSS、颜色、图标、卡片、健康标签、动画、按钮、进度条或常驻刷新。设计判断是：stdout/stderr 静默能回答“最近是否有可观察输出”，却不能证明子进程健康；有些构建工具会缓冲输出，因此静默必须保持中性证据，不能自动变成告警或控制动作。

## 4. 使用的技术

- Obsidian CommonJS 插件内的进程内 mutable lease 与 frozen snapshot；
- lease identity + child identity 双重 ownership 检查；
- `getAuthorTransactionNow()` 的可替换墙上时钟和单调 `Math.max` 更新；
- phaseEnteredAt、lastOutputAt 与 `lastOutputAt ?? phaseEnteredAt` 静默基线；
- stdout/stderr 共享 append boundary，在正文截断 guard 前记录活动；
- `Object.freeze` 快照、UTC ISO 8601 和非负 total/phase/silent duration；
- 原 `runRepositoryCommand`、activeRuns、child 结算、进程树清理、诊断/恢复 bypass 和 200,000 字符输出上限；
- `research-iteration-loop` 将本轮约束为一个 activity-pulse 缺口，并要求 fail-first、真实 doctor、两轮完整 release gate、功能/归档双提交与远端证据；
- `frontend-design` 把新增事实压缩进现有 Native Notice，保持同一证据层级，避免第二套 UI、健康颜色和误导性进度表达。

## 5. 实现的功能

- 新 lease 原子记录 startedAt、phaseEnteredAt、preflight 与空 lastOutputAt；
- phase 转换只接受当前 lease 与 allowlist phase，时间不倒退，并清空上一阶段输出证据；
- child ownership 转交时清空 lastOutputAt，使每阶段/child 的活动边界独立；
- stdout 与 stderr 都可更新 lastOutputAt；只有当前 lease + 当前 child 才能更新；
- 输出正文达到 200,000 字符捕获上限后，后续 chunk 仍更新活动时间；
- 旧 preflight/domain child 的迟到 stdout/stderr 不能污染 domain/diagnostic 或后来事务；
- frozen snapshot 同时提供总用时、阶段用时、最近输出和静默用时；
- 时钟回拨时 elapsedMs、phaseElapsedMs 与 silentMs 全部保持非负；
- ACTIVE 与 BUSY 显示完全相同的阶段/输出证据，IDLE 仍零 spawn；
- 无输出状态明确显示“本阶段尚无输出”；既有 attention、success、failure、spawn error、unload 与恢复 bypass 不变。

## 6. 实现方法

`preflightAuthorTransaction` 只读一次当前时间，同时赋给 startedAt 和 phaseEnteredAt。`setAuthorTransactionPhase` 先验证 `this.authorTransactionLease === lease` 与 phase allowlist，再以 `max(old phaseEnteredAt, floor(now))` 更新阶段进入时间并把 lastOutputAt 置空；无效时钟保留原时间。这样旧 continuation 无法给新 lease 改 phase，宿主时钟回拨也不会让阶段证据倒退。

`runRepositoryCommand` 在当前 lease 接收 child 后清空 lastOutputAt。stdout/stderr 都进入同一个 `appendOutput`，它先调用 `recordAuthorTransactionOutput(lease, child)`，再检查正文是否达到捕获上限。记录函数同时验证 lease identity 和 `lease.child === child`，再以 phaseEnteredAt 为下界单调推进 lastOutputAt。因此截断只限制诊断正文的内存，不会让活动观察失真；旧 child 的迟到数据也无法命中新 owner。

`getAuthorTransactionSnapshot` 在查询时读一次时钟，派生 `elapsedMs = now - startedAt`、`phaseElapsedMs = now - phaseEnteredAt`、`silentMs = now - (lastOutputAt ?? phaseEnteredAt)`，全部以零为下界。Notice formatter 不进行健康分类，只把相同 snapshot 分别放进 ACTIVE 或 BUSY 标题。没有 timer、网络、文件写入或新的子进程；作者再次查询或误触并发事务时才得到新的时间值。

## 7. 验证证据

- 初始 fail-first 定向集 70 项中 45 项通过、25 项失败，用时 4.37 秒；失败来自插件仍是 1.16.0、缺少 activity 字段/方法与旧 Notice 契约，其他既有行为通过；
- 初次实现后定向集为 69/70：测试夹具向预期 JSON stdout 写入 `doctor pulse`，真实结构化 parser 按设计进入 diagnostic；把夹具改为只含空白、既保留 stdout 活动又不破坏 JSON 后通过，证明失败来自无效夹具而非放宽 parser；
- 最终 `node --check` 与三组定向测试 70/70；单独测试用时 4.55 秒，外层计时 4.76 秒；
- 定向测试 + 真实 doctor 复验用时 5.97 秒；doctor 为 ready、13/13、11/11 作者脚本、32/32 固定依赖、5/5 路径、MyBlog Publisher 1.17.0，且 `configurationChanged/filesChanged/credentialsRead/networkChecked` 全为 false；
- 确定性时钟证明 phase transition 重置 lastOutputAt、时间单调、回拨 duration 为零；
- 200,001 字节 stdout 触发正文截断后，后续 stderr 仍推进 lastOutputAt；
- preflight/domain 旧 child 的迟到输出不能污染当前 child，旧 lease 也不能修改新 lease phase；
- ACTIVE 与 BUSY 对相同 lease 呈现相同 phaseEnteredAt、lastOutputAt 与三类 duration；无输出文案与小时级格式通过；
- 第一次完整 `npm run release:check` 用时 103.41 秒：Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、236/236 单元与集成、TypeScript、45/45 页面、19/19 生产应用测试、production audit 0；
- 归档后的第二次完整 `npm run release:check` 用时 113.53 秒：236/236 单元与集成、TypeScript、45/45 页面、19/19 生产应用测试与 production audit 0 再次通过；
- 功能提交 `715a04d417787fce011ba6c0f94e8fc7e5bccfe6` 已推送；`Lint, test, typecheck, and build`、`Smoke-test the deployed site` 与 Vercel commit status 共 3/3 success，并绑定该 SHA；
- `git diff --check` 与功能提交前 `git diff --cached --check` 通过；没有新增依赖、secret、数据库、Cloudflare、真实 API、自动修复或网络探测；
- 本轮没有修改 Next.js 代码，因此没有触发 Next 16 API、约定或文件结构判断，无需读取 `node_modules/next/dist/docs/`；真实 Obsidian 宿主像素仍未人工截图验收。

## 8. 经验与教训

- 输出正文与输出活动是两个不同预算：正文可以截断，activity timestamp 不应随之失明；
- output ownership 必须同时绑定 lease 和 child。只验证 lease 会让旧 child 在转交后污染当前阶段；
- phase 转换既是标签改变，也是观察窗口重置；lastOutputAt 不重置会把 preflight 的最后输出误当成 domain 活动；
- 无输出不是 null UI。明确写“本阶段尚无输出”比空白、epoch 或隐藏整行更可审计；
- duration 必须从一份 snapshot clock 派生并钳制为零，避免三种时长在同一次查询中观察不同 now；
- JSON parser 不应为了测试中的日志前缀变宽松。修复夹具保住了生产边界，也展示了 stdout activity 可以由合法空白触发；
- 静默时间是事件缺失的观测，不是健康结论。自动 watchdog 需要独立协议和领域授权，不能从本轮字段偷渡；
- 原生 Notice 足以承载少量高价值证据；新增 Modal、CSS 或颜色反而会制造另一套状态语言；
- 两轮完整门分别覆盖实现快照和最终文档快照，能避免“代码通过、归档破坏内容契约”的分离风险。

## 9. 全局状态、风险与未解决问题

MyBlog Publisher 1.17.0 现在同时具备 author doctor 前置联锁、新事务串行化、phase/elapsed 查询和 stdout/stderr 活动脉冲。站点继续以 GitHub 为唯一内容事实源、Vercel 原生托管，不依赖 Cloudflare；Studio/Obsidian 双发布、内容维护、统一 Git 交付分诊、两类安全重送和可信回执保持原状。作者不需要终端或 Codex，就能区分“刚进入 domain 且尚无输出”和“domain 已运行一段时间且最近有输出”。

当前 activity 只在 lease 活动期间存在。事务成功、attention、命令失败或 spawn error 结算后，ACTIVE Notice 消失，随后运行状态命令只能看到 IDLE，不能回查上一事务的操作、来源、最终 phase、结算类别和总用时。下一步应只保留一条当前插件会话内的 terminal receipt；持久历史、输出正文和跨重启恢复会引入存储、隐私与失效语义，本阶段不需要。

其他长期风险不变：构建工具可能长时间缓冲输出，静默不能证明卡死；真实 Obsidian 主题、超长路径和窄屏像素体验需要日常观察；Studio OAuth 与固定 Decap bundle 需要维护；实时外链网络结果不进入硬门；自定义域名、公开邮箱、统计和评论等待所有者选择；`decap-cms` 开发依赖审计与 Actions major tag 指针另行处理。

## 10. 下一轮唯一主任务

为 Obsidian 作者事务增加一条仅当前插件会话保留的最近终态回执。每个 lease 只在 owner-checked 结算点冻结 operation、sourcePath、最终 phase、startedAt、endedAt、总用时和明确 outcome category；“查看当前作者事务”在 IDLE 时显示该回执。成功、前置 attention、命令非零、spawn error、卸载等类别需要先冻结语义与清理优先级；回执不保存 stdout/stderr 正文，不跨 Obsidian 重启持久化，不自动重试、恢复或 push，也不从静默时间推断结果。显式 doctor、报告、分诊、status 与 deliver 继续绕过，不接云 API。
