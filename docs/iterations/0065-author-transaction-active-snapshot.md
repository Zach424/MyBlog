# Iteration 0065：作者事务只读活动快照

## 1. 范围与成功标准

本轮完成 Iteration 0064 的唯一主任务：让 Obsidian 作者在不启动第二条命令链、不读取网络且不改变事务状态的前提下，知道当前新发布/复核事务正在做什么、处于哪一阶段、从何时开始以及已经运行多久。范围只包含现有 single-flight lease 的可观测字段、阶段转换、冻结快照、ACTIVE/IDLE 查询命令和 BUSY 复用；不改变 author doctor schema、publish/review 领域脚本、Git 提交包、Studio、Next 页面或部署配置。

成功标准是：租约创建时记录不可重置的 startedAt 与 `preflight`；doctor ready 进入 `domain`，author doctor 或 review Proof 结构化证据失败进入 `diagnostic`；转换只对当前 lease identity 生效。`getAuthorTransactionSnapshot` 必须复制 operation、sourcePath、phase、startedAt 和查询时钟派生的非负 elapsed，并返回冻结对象。“查看当前作者事务”在桌面 Vault 的 ACTIVE/IDLE 两态都不 spawn；并发调用的 BUSY 使用同一快照和格式。所有状态都不取消、重试、排队、猜百分比或保存历史。功能提交 `fbc6c88d86ed0a4e4fcf3e2e9a153bbdecfe6466` 可回滚到插件 1.15.0，不需要内容迁移、reset 或强推。

## 2. 项目结构状态

- `.obsidian/plugins/myblog-publisher/main.js`：增加阶段标签、可替换时钟、identity-checked 阶段转换、冻结活动快照、elapsed 格式器、共享 Notice 格式器和状态命令；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.15.0 升到 1.16.0，并声明 observe + serialize 的作者链路；
- `lib/content/author-doctor.ts`：Vault 期望插件版本同步到 1.16.0；doctor version 1 与 13 项检查不变；
- `tests/obsidian-plugin.test.mjs`：增加 idle/active、冻结快照、确定性时钟、三阶段转换、三阶段 BUSY、小时级格式、桌面边界和零 spawn 证据；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步 1.16.0 manifest/doctor 与静态命令契约；
- Vault 架构、设计、操作、发布、路线图、状态、inbox 指南、公开项目页和本轮档案同步当前事实；
- CSS、Next/React 源码、内容 schema、Studio、workflow、依赖、数据库、Cloudflare 与托管配置没有改变。

## 3. 设计内容

本轮主体是已经启动耗时发布或复核、需要确认“还在做什么”的作者。信息层级固定为 operation → source → phase → startedAt → elapsed → 下一步建议；ACTIVE 与 BUSY 共享顺序，IDLE 只回答没有活动事务。阶段采用中文动作加 monospace 英文 token：`前置检查 · PREFLIGHT`、`发布或复核 · DOMAIN`、`证据降级 · DIAGNOSTIC`，避免只暴露内部枚举。

唯一可见变化仍是 Obsidian 原生 Notice。“查看当前作者事务”主动显示 `AUTHOR TRANSACTION / ACTIVE` 或 `IDLE`；误触第二个事务显示 `BUSY`。不新增 Modal、CSS、颜色、图标、卡片、动画、按钮或常驻面板，也不把 elapsed 绘制成完成率。设计上的取舍是让时间成为工程证据，而不是进度承诺。

## 4. 使用的技术

- Obsidian CommonJS 插件实例内的 mutable lease 与冻结 transaction；
- `AUTHOR_TRANSACTION_PHASE_LABELS` 固定内部 phase 到作者语言的映射；
- `setAuthorTransactionPhase` 同时验证 lease identity 与 phase allowlist；
- `getAuthorTransactionNow()` 隔离墙上时钟，测试可注入确定性毫秒值；
- `getAuthorTransactionSnapshot` 在查询时复制并 `Object.freeze`，elapsed 对时钟回拨钳制到零；
- UTC ISO 8601 startedAt，避免宿主 locale/timezone 造成证据歧义；
- elapsed 分别格式化为秒、分秒、小时分秒，不持续刷新；
- 原 `runRepositoryCommand`、activeRuns、owner child 释放、进程树清理与诊断/恢复 bypass 保持不变；
- `research-iteration-loop` 把本轮限制为 observability gap，要求 fail-first、真实 doctor、功能/归档双提交与两次完整门；
- `frontend-design` 让 ACTIVE/BUSY 共用一条证据语法，并拒绝第二套 Modal、进度条和装饰性状态 UI。

## 5. 实现的功能

- 新事务原子创建 lease 时写入 `phase: preflight` 与 startedAt；
- doctor ready 只在 lease 仍是当前 owner 时切换 `domain`，随后启动原发布/复核命令；
- author doctor JSON 降级与 review Proof JSON 降级在启动文本 child 前切换 `diagnostic`；
- 新增“MyBlog Publisher: 查看当前作者事务”桌面命令；
- idle 查询显示 `AUTHOR TRANSACTION / IDLE`，不要求当前笔记且不启动任何进程；
- active 查询显示冻结操作、来源、阶段、ISO 开始时间、动态已运行时长和只读边界；
- preflight、domain、diagnostic 中误触第二事务都用相同快照显示 BUSY，且 spawn 数不增加；
- elapsed 支持 `0 秒`、`1 分 05 秒`、`1 小时 01 分 01 秒` 等确定格式；
- 原 success/nonzero/sync throw/async error/unload/late event 的 lease 结算语义保持通过；
- 显式 doctor、inbox/维护报告、统一分诊、两类状态和两类 deliver 全部继续 bypass。

## 6. 实现方法

租约仍只有 transaction、owning child 和少量进程内状态。`preflightAuthorTransaction` 在任何 spawn 之前读取一次 `getAuthorTransactionNow()`，保存 startedAt 并把 phase 设为 preflight。ready continuation 不直接改字段，而是调用 `setAuthorTransactionPhase(lease, "domain")`；如果旧回调面对的 lease 已失效，就停止 continuation。两条结构化证据 catch 同样先用该 helper 进入 diagnostic，再启动文本 child，因此旧事务不能给后来租约改阶段。

`getAuthorTransactionSnapshot` 默认只接受实例当前 lease，也可接收 BUSY 捕获到的同一对象；identity 不匹配返回 null。它在每次查询时重新读时钟，计算 `max(0, floor(now - startedAt))`，只复制作者需要的五项事实并冻结，既不暴露 child，也不写回 lease。ACTIVE 与 BUSY 都交给 `formatAuthorTransactionNotice`；查询命令本身不调用 `runRepositoryCommand`，所以不会占用 activeRuns、创建持续 Notice 或接触 npm。IDLE 是独立短 Notice。

快照没有定时器。作者再次运行命令或误触事务时才取得新的 elapsed，这避免插件常驻刷新、Notice 竞争和“计时还在跳所以进程一定健康”的错误暗示。查询也没有按钮：发布 push 可能处于 commit 已创建但网络结果未知的边界，安全动作仍必须依靠现有 delivery triage/status/deliver，而不是从活动时间推断。

## 7. 验证证据

- 初始 fail-first 定向集 70 项中 44 项通过、26 项失败；失败来自插件仍为 1.15.0、缺少查询命令/快照方法、lease 没有 phase/startedAt，以及版本失配使依赖 doctor 的既有事务按设计进入 HOLD；
- 最终 author-doctor + Obsidian plugin + publishing 定向测试 70/70；连同真实 doctor 的复验总用时 5.77 秒；
- `node --check .obsidian/plugins/myblog-publisher/main.js` 通过；
- idle/active 测试证明状态命令在零活动与活动租约下都不增加 spawn；移动端 checkCallback 返回 false；
- 确定性时钟测试证明 startedAt 不随阶段改变，snapshot 被冻结，elapsed 在 2 秒、1 分 05 秒和 1 小时 01 分 01 秒边界正确；
- preflight、domain、diagnostic 三阶段的 BUSY 与 ACTIVE 使用相同阶段/时间证据，且第二事务不启动；
- author doctor 与 review Proof 两条结构化失败路径都在文本 child 接管前进入 diagnostic；
- 原 attention、fatal、sync spawn throw、domain nonzero、async error、插件卸载、旧 child 迟到事件和八个 bypass 命令继续通过；
- 真实仓库 doctor 为 ready、13/13、11/11 脚本、32/32 固定依赖、5/5 路径、MyBlog Publisher 1.16.0，`filesChanged: false`、`networkChecked: false`；
- 第一次完整 `npm run release:check` 用时 107.8 秒：Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、236/236 单元与集成、TypeScript、45/45 页面、19/19 生产应用测试、production audit 0；
- 归档后第二次完整 `npm run release:check` 用时 99.9 秒：236/236 单元与集成、TypeScript、45/45 页面、19/19 生产应用测试与 production audit 0 再次通过；
- 功能提交 `fbc6c88d86ed0a4e4fcf3e2e9a153bbdecfe6466` 已推送；两条 GitHub Actions check 与 Vercel commit status 共 3/3 success，并绑定该 SHA；
- `git diff --check` 与 `git diff --cached --check` 通过；没有新增依赖、secret、数据库、Cloudflare、真实 API、自动修复或网络探测；
- 本轮没有修改 Next.js 代码，因此无需依据本地 Next 16 指南做 API 迁移判断；真实 Obsidian 宿主像素仍未人工截图验收。

## 8. 经验与教训

- 可观测性应复制状态，不应返回 mutable lease。冻结 snapshot 把“给作者看什么”与“内部如何转交 child”分开；
- elapsed 必须按查询时钟派生，而不是定时写回。否则刷新本身会制造状态写入和生命周期清理问题；
- 墙上时钟可能回拨，负 elapsed 没有作者语义，最小安全解释是钳制到零；
- phase 转换和 child ownership 一样需要 lease identity。旧 continuation 不只可能错误释放，也可能错误改写新事务阶段；
- startedAt 用 UTC ISO 保留无歧义证据，elapsed 用中文可读格式承担日常扫读，两者职责不同；
- ACTIVE 与 BUSY 若各自拼文案，阶段标签和时间格式迟早漂移；共享 formatter 是视觉一致性也是行为契约；
- idle 不是错误，也不需要打开 Modal。“没有活动事务”本身就是完整结果；
- 运行时间不能证明进程健康。没有输出活动和阶段进入时间前，不应提供“卡住”判断，更不应自动 cancel；
- 只读命令绕过 lease 不等于启动另一个 child；能直接从内存回答时，零 spawn 是更强的恢复边界。

## 9. 全局状态、风险与未解决问题

MyBlog Publisher 1.16.0 现在同时具备 author doctor 前置联锁、新事务串行化和活动 phase/elapsed 查询。站点继续以 GitHub 为唯一内容事实源、Vercel 原生托管，不依赖 Cloudflare；Studio/Obsidian 双发布、内容维护、统一 Git 交付分诊、两类安全重送和可信回执保持原状。作者无需等待第二个 BUSY 才知道活动状态，也不需要终端或 Codex 即可查询。

当前快照只有总 startedAt/elapsed。一次长事务如果 preflight 用时 90 秒、随后刚进入 domain，作者仍只能看到总 90 秒；它也不记录 owning child 最近何时产生 stdout/stderr。因此 phase 已可见，但“进入该 phase 多久”和“输出静默多久”仍不可见。即使补齐这些时间，构建工具可能长时间缓冲输出，静默只能作为观察，不能直接作为故障、watchdog 或 cancel 条件。

其他长期风险不变：真实 Obsidian 主题、超长路径和窄屏像素体验需要日常观察；Studio OAuth 与固定 Decap bundle 需要维护；实时外链网络结果不进入硬门；自定义域名、公开邮箱、统计和评论等待所有者选择；`decap-cms` 开发依赖审计与 Actions major tag 指针另行处理。

## 10. 下一轮唯一主任务

为 Obsidian 作者事务增加只读活动脉冲。lease 记录 phaseEnteredAt 与 owning child 最近一次 stdout/stderr 的时间；phase 转换与 child ownership 转交时原子更新阶段证据，快照增加阶段用时、最近输出时间和静默时长。输出正文、PID、取消/重试按钮、自动 watchdog 和持久历史都不进入快照；静默时间不分类为 healthy/stuck。显式 doctor、报告、分诊、状态与 deliver 继续 bypass，不接云 API。
