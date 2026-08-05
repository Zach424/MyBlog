# Iteration 0063：作者事务 Doctor 前置联锁

## 1. 范围与成功标准

本轮完成 Iteration 0062 的唯一主任务：让 Obsidian 的四个新作者事务在启动原领域命令前自动运行同一个 version 1 author doctor。范围固定为“检查当前草稿”“发布当前草稿并同步 GitHub”“检查当前正式内容复核”“提交并同步当前正式内容复核”的 ready、attention、不可信 JSON 与 fatal 路由；所有只读报告、统一 Git 交付分诊、复核/发布状态和两类待交付 deliver 继续绕过联锁，避免 synchronized 缺口封死正确恢复。

成功标准是：调用时冻结当前 Markdown sourcePath；ready 不弹 doctor Modal，且恰好启动一次原领域命令；attention 展示与显式 doctor 相同的严格证据，并清楚标记被停止的操作和来源路径，领域命令零启动；不可信 JSON 只允许纯文本诊断且失败关闭；doctor 致命退出不显示伪造证据、不进入领域命令；插件卸载或活动运行取消后，迟到事件不得继续事务。功能提交 `01997fd1fef7b2a836b8407a04574e2627652da4` 可回滚到插件 1.13.0，不需要内容迁移、reset 或强推。

## 2. 项目结构状态

- `.obsidian/plugins/myblog-publisher/main.js`：新增共享 `preflightAuthorTransaction` / `continueAuthorTransaction`，四个命令接入 doctor 前置子进程；Author Doctor Modal 与纯文本降级可携带 transaction context；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.13.0 升到 1.14.0，并描述自动前置联锁；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增 transaction latch、caution rail 与窄屏单列规则；
- `lib/content/author-doctor.ts`：Vault 期望版本同步到 1.14.0；13 项 doctor schema 与 version 1 报告保持不变；
- `tests/author-doctor.test.mjs`：更新插件版本事实；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：覆盖四个 ready 路由、四个 attention 路由、不可信 JSON 纯文本失败关闭、fatal 退出、冻结 sourcePath、DOM/CSS 与恢复命令 bypass；
- Vault 架构、设计、操作、发布、路线图、状态、inbox 指南、公开项目页和本轮档案同步当前事实；Next 页面、内容 schema、Studio、workflow、依赖、数据库与托管配置没有改变。

## 3. 设计内容

本轮主体是已经从当前笔记触发检查或发布、不应该再记住“先手工跑 doctor”的作者。ready 是一条无视觉打断的通路：前检成功后立即进入原 Author Proof 或 Commit Envelope。只有 attention 才需要界面，并且第一眼必须回答“哪个事务被拦住、针对哪篇笔记”，随后才解释环境缺口。

1.14.0 复用既有 `RUNTIME → GIT → WORKSPACE → VAULT → AUTHOR HOLD` 电路，不创建第二个 dashboard。电路前仅增加一条窄的双列 `TRANSACTION INTERLOCK / HELD` latch，显示精确 operation label 与调用时 sourcePath；它使用既有 caution 规则线、Obsidian host token 和 monospace，不增加按钮、卡片、进度环、阴影、渐变或动画。窄屏按“被停止的事务 → 前置证据”折为单列。

## 4. 使用的技术

- Obsidian CommonJS 插件命令、workspace active file、原生 Modal/Notice 与共享子进程生命周期账本；
- version 1 author doctor exact-key parser，从 observation 独立重算 13 项 check、summary、repair 和 safety；
- Node 子进程固定参数、`shell: false`、0/1/2 退出码与一次性 settle 语义；
- continuation 回调把 ready 前检与原 `runContentPublish` / `runContentReview` 组合，但不改变领域脚本；
- transaction context 冻结 operation、sourcePath、mode，避免前检期间切换活动笔记导致目标漂移；
- 结构化诊断不可信时单次纯文本重跑；fatal 退出直接失败关闭；
- Node test 表驱动的四命令 ready/attention 契约、进程桩和无领域调用断言；
- `research-iteration-loop` 把本轮冻结为单一可证伪范围，要求 fail-first、真实 doctor、功能/归档双提交和两次完整门；
- `frontend-design` 促使界面复用现有 preflight circuit，只增加最小 transaction latch，避免新 dashboard 与装饰性组件。

## 5. 实现的功能

- “检查当前草稿”启动前自动运行 JSON doctor；ready 才进入 publish-note `--check-only`；
- “发布当前草稿并同步 GitHub”启动前自动运行 JSON doctor；ready 才进入 publish-note `--push`；
- “检查当前正式内容复核”启动前自动运行 JSON doctor；ready 才进入 review-note `--check-only`；
- “提交并同步当前正式内容复核”启动前自动运行 JSON doctor；ready 才进入 review-note `--push`；
- 四条 ready 路由均无 doctor Modal，原命令恰好启动一次；
- 四条 attention 路由均显示 `TRANSACTION INTERLOCK / HELD`、操作、冻结路径、13 项 circuit 与修复证据，原命令不启动；
- 不可信 doctor JSON 自动运行纯文本 doctor，仅展示安全文本，绝不乐观继续；
- doctor 启动失败或退出码 2 时停止事务；
- 显式“检查本机发布环境”命令保留；
- 维护、inbox、统一分诊、复核/发布状态和两类 deliver 不走联锁，作者仍可观察并恢复已经存在的本地提交；
- 联锁不安装依赖、不改配置、不读凭据、不访问网络、不自动修复。

## 6. 实现方法

四个入口在读取当前文件后立即构造不可变 transaction 描述，并把原领域动作作为 continuation 交给共享前检。前检调用现有 `inspectAuthorEnvironmentJson`，继续复用活动进程账本、固定命令参数、输出上限和插件卸载清理；成功回调仍必须处于有效活动运行，才会把同一冻结路径交给领域方法。这样切换编辑器活动页不会重定向已经发起的事务，卸载/取消后的迟到结果也不会越过生命周期边界。

JSON 路径先执行既有严格 parser。ready 直接调用 continuation，不创建 Modal；attention 将解析后的 report 与 transaction 交给 Author Doctor Modal。schema 或 UI 结构不可信时，前检只执行纯文本 doctor，AuthorDoctorTextModal 明确说明原 operation 未启动；纯文本成功也不能替代结构化 ready。fatal 路径只显示诊断 Notice，不调用 continuation。

`reviewCurrentPublishedNote` 与 `publishCurrentNote` 分别拆出 `runContentReview` / `runContentPublish`，把原命令实现完整保留在领域方法中；前置层只决定是否允许进入，避免复制参数、Proof/Envelope parser 或交付语义。恢复命令没有接入共享前检，这是显式安全边界而非遗漏。

## 7. 验证证据

- fail-first 定向测试 55 项中 34 项通过、21 项按预期失败；失败集中在插件仍为 1.13.0、缺少 transaction interlock/CSS，以及旧测试仍假设领域命令直接启动；
- 实现后原定向集 55/55；补充 fatal 退出契约后，author-doctor + Obsidian plugin + publishing 定向测试 56/56，用时 15.75 秒；
- `node --check .obsidian/plugins/myblog-publisher/main.js` 通过；
- 四个 ready 表驱动路由证明 doctor 先于领域命令且领域命令恰好一次；四个 attention 路由证明 operation/sourcePath 可见且领域命令零调用；
- 不可信 JSON 测试证明纯文本降级后失败关闭；fatal 退出测试证明无 Modal/领域调用；
- 真实仓库 doctor 为 ready、13/13、11/11 脚本、32/32 固定依赖、5/5 路径、MyBlog Publisher 1.14.0，`filesChanged: false`、`networkChecked: false`；文档未提交的 dirty worktree 不会造成环境级误报；
- 第一次完整 `npm run release:check` 用时 198.3 秒：Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、222/222 单元与集成、TypeScript、45 页、19/19 生产应用测试、production audit 0；
- 归档后第二次完整 `npm run release:check` 用时 134.1 秒；相同内容库存、222/222、45 页、19/19 与 production audit 0 全部保持通过；
- 功能提交 `01997fd1fef7b2a836b8407a04574e2627652da4` 已推送；公开 GitHub 提交页观察到检查汇总 `3 / 3`；
- `git diff --check` 将在归档提交前执行；没有新增依赖、secret、数据库、Cloudflare、自动修复或外部写入 API；
- 真实 Obsidian 宿主像素外观仍未人工截图验收，本轮只声明行为、DOM、严格 parser 与 CSS 契约。

## 8. 经验与教训

- 只提供 doctor 命令仍把流程顺序留给作者记忆；把同一个机器契约放在事务边界，才能让“检查环境”从建议变成可执行不变量；
- ready 不需要成功弹窗。对高频动作而言，无视觉打断本身就是正确反馈；只有 hold 才应占用注意力；
- 前检期间活动笔记可能改变，因此 transaction context 必须在命令调用时冻结，不能在 continuation 中重新读取 workspace；
- 纯文本 doctor 是诊断降级，不是授权凭据。结构化证据无法验证时必须失败关闭，否则降级路径会成为绕过联锁的成功通道；
- 恢复既有 pending commit 与启动新事务是不同安全问题。把 synchronized doctor 加到 deliver 会在最需要恢复时阻断作者，因此 bypass 需要作为测试和文档中的显式契约；
- 把原 publish/review 实现提取成领域方法，比在四个回调里复制命令参数和 parser 更容易证明“只增加前置条件，不改变原事务”；
- 当前活动进程账本解决进程清理与迟到事件，但还不是跨事务互斥。两个并发调用仍可能各自通过 doctor，这应由下一轮的 single-flight lease 单独解决。

## 9. 全局状态、风险与未解决问题

MyBlog Publisher 1.14.0 已把本机环境 doctor 联锁到四个新发布/复核事务。站点继续以 GitHub 为唯一内容事实源、Vercel 原生托管，不依赖 Cloudflare；Studio/Obsidian 双发布、内容维护、统一 Git 交付分诊、两类安全重送和可信回执保持原状。作者仍可显式运行 doctor 做环境诊断，也能在 synchronized 缺口存在时使用只读报告和待交付恢复路径。

主要新增风险是并发事务：联锁目前按单次 invocation 独立运行，没有占用从 doctor 到领域命令结束的共享租约。快速连续触发两个命令时，它们可能都在同一基线上通过前检，随后并行运行耗时 `npm run check`，甚至竞争 Git 写入；领域门通常会因状态漂移阻止错误提交，但多余进程与竞态本身仍需消除。真实 Obsidian 主题、超长路径、异常 npm 布局和窄屏像素体验继续随日常使用观察。

其他长期风险不变：Studio OAuth 与固定 Decap bundle 需要维护；实时外链网络结果不进入硬门；自定义域名、公开邮箱、统计和评论等待所有者选择；`decap-cms` 开发依赖审计与 Actions major tag 指针另行处理。

## 10. 下一轮唯一主任务

为四个 Obsidian 作者事务增加 single-flight lease。租约在 doctor 启动前原子占用，跨越 ready continuation，直到 publish/review 领域命令成功、失败或 spawn error 才释放；插件卸载必须作废租约，迟到事件不得释放新租约或继续事务。租约占用时第二次调用只显示当前 operation 与冻结 sourcePath，不启动 doctor 或领域命令。显式 doctor、全部只读报告、统一分诊、复核/发布状态与两类 deliver 继续绕过租约；不自动修复、不接云 API。
