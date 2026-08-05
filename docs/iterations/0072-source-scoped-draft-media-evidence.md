# Iteration 0072：当前草稿 source-scoped 媒体证据

日期：2026-08-06
状态：完成
唯一主任务：在保留全草稿轻量解析、共享附件和正式目标碰撞判断的前提下，只为当前目标草稿执行真实媒体派生，减少多草稿工作区中“查看当前草稿发布意图”的无关开销。

## 1. 范围与成功标准

MyBlog 的长期目标是让作者不依赖 Codex，也能在 Obsidian 或网页 Studio 中把本地 Markdown 安全发布到公开知识库。Inbox readiness 负责把正式发布器、媒体策略和跨草稿事实聚合成只读证据；Obsidian 当前草稿摘要只消费证据，不拥有第二套内容规则。

Iteration 0071 为了保留共享附件判断，会为全部 inbox 草稿生成真实媒体候选。当前轮只优化这一个昂贵边界，成功标准是：

- 默认 `inspectInboxReadiness` 与 `content:inbox` 继续返回完整全库 version 1 报告，并为全部附件执行原有媒体派生；
- `--source content/inbox/<safe-slug>.md` 仍读取并正式解析全部草稿，保留正式目标、附件缺失/目标/Git 跟踪和跨草稿共享源判断；
- 只有精确目标草稿调用 `prepareMediaForPublishing`，聚焦 entry 与默认全库报告中的同一 entry 语义全等；
- 聚焦报告只有一个 entry 并重算 counts；来源不安全、不存在或不能唯一命中时失败；
- Obsidian 插件必须传入冻结来源，并拒绝多 entry 报告、证据漂移和活动文件漂移；
- 全程不修改作者文件，不发布、不提交业务内容、不 push、不联网，不接云服务或真实 API。

回滚边界是单个功能提交 `ee8b4e6e9917d17b5dfd5b432853b1c429dddbee`。本轮未修改 Next.js 源码或调用 Next.js API，按仓库 `AGENTS.md` 无需选择 Next.js 编码指南。

## 2. 项目结构状态

功能提交修改九个文件：

- `lib/content/inbox-readiness.ts`：增加安全 source scope、媒体派生选择与测试注入缝；
- `scripts/report-inbox-readiness.mjs`：增加 `--source PATH` 参数和帮助；
- `.obsidian/plugins/myblog-publisher/main.js`：当前意图命令传精确来源，parser 强制单 entry；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件升级到 1.23.0；
- `lib/content/author-doctor.ts`：doctor 期望版本同步到 1.23.0；
- `tests/inbox-readiness.test.mjs`：覆盖 scope 等价、媒体调用集合、共享/目标阻塞、安全与缺失来源、真实 CLI；
- `tests/obsidian-plugin.test.mjs`：覆盖固定 `--source` 参数与多 entry 失败关闭；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步插件版本契约。

归档提交更新仓库根 Obsidian Vault 中的 README、STATUS、ROADMAP、DESIGN、ARCHITECTURE、OPERATIONS、PUBLISHING、inbox 指南、公开项目页、迭代索引和本文件。GitHub 继续是代码与内容事实源；Vercel 继续托管公开站，当前运行链路不依赖 Cloudflare。

## 3. 设计内容

本轮没有新增视觉组件或交互动作。1.23.0 保留 1.22.0 的 `AUTHOR INTENT / LOCAL EVIDENCE`、`DRAFT → PUBLIC`、READY/SCHEDULED/HOLD 和 `TYPE / DATE / MEDIA / LINKS`；性能优化不能改变作者判断语义，也不能用进度条伪装无法可靠测量的全库阶段。

唯一界面契约变化发生在不可见的证据边界：插件只接受恰好一个 entry。完整报告即使包含当前路径，也不能再伪装成聚焦报告。等待文案仍只说明正在读取被冻结来源；没有新增按钮、卡片、渐变、阴影、动画、自动发布或第二套导航。

## 4. 使用的技术

- TypeScript、Node.js `fs/promises`、固定 `spawnSync` Git 清单与现有 version 1 JSON；
- `prepareObsidianNote`、Zod 正式内容契约和现有跨草稿附件所有权聚合；
- Sharp 驱动的 `prepareMediaForPublishing` 真实候选派生；
- Node `parseArgs` 的严格 `--source` 字符串参数；
- Obsidian `TFile` 冻结/后置复核和 CommonJS 严格证据 parser；
- Node test runner、真实临时 Git/媒体夹具与可观察媒体派生调用的依赖注入缝；
- `research-iteration-loop` 用于限定单一性能模块、先失败、定向回归、全局审查、归档和下一任务冻结。

没有增加数据集、数据库、网络数据源、云服务、凭据或真实 API。

## 5. 实现的功能

- `npm run content:inbox -- --format json --source content/inbox/<slug>.md` 返回一篇草稿的完整只读证据；
- source 只接受直接位于 inbox 的小写 ASCII kebab-case Markdown，反斜杠先规范化，目录穿越和缺失目标失败；
- 聚焦模式仍发现其他草稿中的共享附件，因此不会把危险共享源误报为 ready；
- 当前草稿的正式目标已存在、附件缺失、附件目标已存在或根附件被 Git 跟踪仍照常阻塞；
- 无关坏草稿保持隔离，不会中断目标报告；
- 当前草稿的每个有效附件仍生成完整 source/output 媒体包络，无关附件不进入真实派生器；
- 默认不传 source 的全库文本/JSON 和 Obsidian“查看全部草稿发布就绪状态”保持原行为；
- MyBlog Publisher 1.23.0 的当前意图命令传入精确冻结路径，并拒绝多 entry JSON。

## 6. 实现方法

`normalizeScopedSourcePath` 复用本模块既有 `SLUG_PATTERN`，先统一路径分隔符，再要求 `content/inbox/` 后只有一个 `<slug>.md` 文件名。它不新增内容类型、slug 或发布目标规则。

`inspectInboxReadiness` 的 `sourcePath` 是可选项。目录、正式内容链接目标和 Git 跟踪附件清单仍只读取一次；随后每个 dirent 继续进入同一个 `inspectDraft`。`inspectDraft` 先读取正文、调用 `prepareObsidianNote`、写入正式身份/日期/内容类型，并完成目标、附件存在、附件目标和 Git 跟踪检查。只有走到媒体阶段时，`deriveMedia` 才区分全库模式和目标来源。

所有草稿处理完成后，`applySharedAttachmentIssues` 仍在完整 entry 集合上运行。只有它结算后才筛选目标 entry，因此共享附件的其他 owner 即使最终不返回，也仍能阻塞当前草稿。聚焦 counts 从唯一 entry 重新聚合；默认分支继续把全部 entries 交给原有 `createReport`。

测试通过 `mediaPreparer` 注入包装真实 `prepareMediaForPublishing`，记录第三个参数中的仓库来源路径；它不是新的生产媒体策略。夹具让目标和 peer 同时引用共享图片，并各有独立图片、正式目标碰撞和一篇坏文件。聚焦调用只包含目标的两个源，同时返回 entry 与默认报告中的目标 entry 深度全等。

CLI 只把 `--source` 透传给同一 library。插件把调用时冻结的 `identity.sourcePath` 作为固定参数数组项传入，继续使用 `shell: false` 边界；parser 在已有 exact-key、safety、媒体、issue、状态、日期和 counts 交叉验证之后，再要求 `entries.length === 1` 且来源唯一匹配。没有 fallback、retry、Vault 写入或 author transaction lease。

## 7. 验证证据

失败优先基线：选择性运行新增/变更合同，得到 4 个预期失败：library 仍返回 3 entries、CLI 拒绝未知 `--source`、插件命令参数缺少来源、插件接受含当前来源的多 entry 报告。

实现后证据：

- 同一选择性集合 11/11 通过；
- author doctor、inbox readiness、Obsidian publishing 与插件相关回归 145/145；
- `npm run lint` 与独立 `npm run typecheck` 通过；
- 真实 `npm run content:author:doctor`：AUTHOR READY 13/13、11/11 脚本、32/32 固定依赖、5/5 路径、插件 1.23.0，且未安装、修改、读取凭据或访问网络；
- CLI help 显示 `--source`；目录穿越来源以非零退出和精确安全错误拒绝；
- 第一遍 `npm run release:check` 用时 109.7 秒：306/306 单元与集成、TypeScript、45/45 构建页面、19/19 生产应用测试、生产依赖审计 0；Current 1 / Historical 3、inbox 0、根暂存 0、外链本地问题 0；
- `git diff --check` 通过；功能提交只含九个实现/契约文件。

归档后的第二遍完整门第一次运行 106.3 秒：306/306、TypeScript 与 45/45 构建已通过，但生产应用为 18/19；`/projects/myblog` 的可见 HTML 超过 100 KB。没有调高预算或弱化门禁，而是把公开项目页的迭代细节压缩，把完整证据保留在本 Vault 档案；公开 Markdown 相对功能提交基线减少约 809 UTF-8 字节。定向重建通过 45/45 和 19/19。修复后的完整 `release:check` 用时 132.0 秒，最终通过 306/306、TypeScript、45/45、19/19 与生产依赖审计 0；Current 1 / Historical 3、inbox 0、根暂存 0、外链本地问题 0 保持不变。

## 8. 经验与教训

1. “只看一篇”不能等同于“只读一篇”。跨草稿共享附件是全局事实，必须在筛选返回值之前观察。
2. 性能边界应放在昂贵副作用模拟之前。正文解析、目标派生和轻量路径检查保留，Sharp 候选生成才按 source 收窄。
3. 先应用全局问题、再裁剪局部视图，能让聚焦报告与全库报告中的同一 entry 保持语义全等。
4. 默认 API 缺省分支必须结构和执行都不变；source scope 是显式 opt-in，不能把全库报告悄悄降级成抽样。
5. 耗时断言容易受机器和图片编码波动影响。记录真实 media preparer 的调用集合比“应快于 N ms”更直接地证明优化边界。
6. 测试缝应包裹正式实现，而不是用假媒体对象替代；这样调用范围和真实候选结构同时受证据约束。
7. 聚焦消费者不能只在全库报告里 `find` 当前项。强制单 entry 才能证明生产者实际遵守 scope，而不是 UI 在末端隐藏无关工作。
8. 不安全 source 应在扫描和临时目录创建之前失败，避免路径语义不可信时继续做昂贵工作。
9. UI 没变也是设计决定：性能优化不需要新增进度、成功动画或行动按钮来证明存在。
10. 迭代索引在 0071 已出现但未登记；状态归档本身也需要交叉检查，不能只依赖文件存在。

## 9. 全局状态、风险与未解决问题

作者现在可以独立创建、改名、取证/清理旧身份、快速查看当前发布意图、查看全 inbox、检查并发布草稿。当前摘要在多草稿大图工作区不再派生无关媒体，同时仍保留共享源和正式目标正确性；发布、Git、网络和自动修复边界未改变。

聚焦模式仍会读取并正式轻量解析全部 inbox 草稿，也会读取正式 posts/projects 作为链接目标。这是当前保持共享附件和严格站内链接语义的必要成本；若未来继续优化，必须先建立等价索引或惰性正文读取证据，不能跳过全局事实。真实 inbox 当前为空，正向、共享、碰撞和坏草稿路径由临时 Git/Sharp 夹具覆盖；尚无大型真实 Vault 基准或 Obsidian 宿主像素快照。`mediaPreparer` 是内部 library 测试缝，生产 CLI 不暴露替换入口。

本轮没有改变数据集或公开内容集合；Current 1 / Historical 3 / 未公开 0 保持稳定。Studio、Vercel、GitHub Actions、Cloudflare 历史边界和所有手动外部接入均未改变。

## 10. 下一轮唯一主任务

把当前草稿的 `LINKS` 从单一计数提升为可核对的精确站内目标清单，直接复用 `validatePreparedContentLinks` 已解析并验证的页面/标题锚点事实。必须覆盖文章、项目、自引用标题、同一目标重复出现与严格失败路径；当前 count 与公开 outgoing/backlink 语义不得漂移。不得二次扫描 Markdown、在插件中解析链接、改变发布规则、引入云服务/真实 API、自动发布或自动修复。

## 结论

MyBlog Publisher 1.23.0 把“当前草稿”从 UI 末端过滤提升为 evidence producer 的明确执行范围。全草稿轻量事实仍参与判定，只有与作者当前核对无关的真实媒体候选被跳过；因此速度优化没有以假 ready、弱 schema 或第二套解析器为代价。默认全库报告保持完整，聚焦报告更窄且更严格，作者工作流继续保持本地、只读和可验证。
