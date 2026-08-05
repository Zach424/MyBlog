# Iteration 0071：当前草稿作者意图摘要

日期：2026-08-06
状态：完成
唯一主任务：在不复制发布规则的前提下，让作者从 Obsidian 当前活动草稿快速核对内容类型、公开目标、日期语义、附件数量、站内链接数量与阻塞证据。

## 1. 范围与成功标准

Iteration 0070 已闭合文件名身份和旧式重复 slug 清理，但作者若只想快速确认“这篇草稿准备发布成什么”，只能打开全 inbox 纯文本报告或运行更重的完整发布检查。本轮成功标准是：摘要必须复用正式发布与 inbox readiness 证据；只对桌面端精确安全的活动 inbox Markdown 开放；运行期间文件身份漂移或报告不可信时失败关闭；界面只读且不成为新的发布授权。

明确不做：不在插件中解析 Markdown/YAML；不修改草稿、frontmatter、附件或正式内容；不调用 Vault 写 API、FileManager 或 reconcile；不进入 author transaction lease；不自动检查、修复、发布、提交、push、fetch 或联网；不接云服务/真实 API；不修改 Next.js 源码，因此本轮按 `AGENTS.md` 无需读取 Next.js 编码指南。

## 2. 项目结构状态

功能提交为 `3754eb01389cf7152ae2a87ab0a7aa034df45ba4`，涉及十个文件：

- `lib/obsidian-publishing.ts`：正式站内链接/标题锚点校验循环返回引用次数，避免第二次提取或第二套语法；
- `lib/content/inbox-readiness.ts`：报告升为 version 1、`mode: read-only`，增加四项 false safety、Article/TIL/Project 与站内链接次数；
- `.obsidian/plugins/myblog-publisher/main.js`：插件升到 1.22.0，增加严格 inbox JSON parser、活动文件冻结/后置复核、新命令和原生 Modal；
- `.obsidian/plugins/myblog-publisher/styles.css`：增加唯一 `.myblog-draft-intent` 作用域；
- `.obsidian/plugins/myblog-publisher/manifest.json`：同步版本与能力说明，最低 Obsidian 仍为 1.5.7；
- `lib/content/author-doctor.ts`：doctor 精确插件版本同步到 1.22.0；
- `tests/inbox-readiness.test.mjs`、`tests/obsidian-publishing.test.mjs`：覆盖版本、安全声明、内容类型与引用次数；
- `tests/obsidian-plugin.test.mjs`：覆盖命令、完整媒体包络、三态日期、schema/safety/count/source 失败和活动文件漂移；
- `tests/author-doctor.test.mjs`：同步版本合同。

归档提交更新 README、项目状态、路线图、设计、架构、操作、发布手册、inbox 指南、公开项目短摘要与本文件。仓库根继续兼作 Obsidian Vault；GitHub 是内容与版本事实源；生产仍由 Vercel 托管且不依赖 Cloudflare。

## 3. 设计内容

`frontend-design` 把功能限制成一张宿主原生、只读、单焦点证据页。顶部是 `AUTHOR INTENT / LOCAL EVIDENCE`、标题和边界；唯一视觉签名为 `DRAFT → PUBLIC`，并列冻结的 inbox 来源和派生的 posts/projects 目标。状态只取 `READY / PUBLIC ON PASS`、`SCHEDULED / FUTURE DATE` 或 `HOLD / n BLOCKER(S)`。

下方四行 ledger 只报告 `TYPE / DATE / MEDIA / LINKS`：Article/TIL/Project、`YYYY-MM-DD · NOW|SCHEDULED`、附件数和站内引用次数。只有 blocked 才追加有序问题证据。全部状态只有“关闭”，没有检查、修复、发布或下一步按钮；视觉复用 Obsidian 字体、颜色 token、规则线和直角间距，没有卡片、渐变、阴影、动画、历史、批量列表或第二套导航。

## 4. 使用的技术

- Obsidian `TFile`、`Modal`、`Notice`、Vault path lookup 和既有固定参数子进程账本；
- CommonJS 桌面插件、原生 DOM 与作用域 CSS；
- TypeScript 内容域、Zod 正式内容契约、共享 Markdown AST 引用提取、Sharp 真实媒体派生；
- version 1 JSON、exact-key schema、路径/计数/日期/安全声明交叉证明；
- Node test runner、VM Obsidian 桩、真实临时 Git/媒体/发布 CLI 夹具；
- `research-iteration-loop` 负责全局复核、失败优先、定向验证、真实 doctor、双完整门和功能/归档分提交；
- `frontend-design` 约束单一视觉签名、宿主原生 token 和零动作只读界面。

## 5. 实现的功能

- 命令面板新增“MyBlog Publisher: 查看当前草稿发布意图”；
- 只对桌面端活动的精确 `content/inbox/<safe-slug>.md` Markdown 开放；
- 显示草稿到正式 posts/projects 路径的目标映射；
- 区分 Article、TIL 与 Project，而不是把全部 post 粗略显示为文章；
- 把公开日解释为 NOW 或 SCHEDULED，并与 ready/scheduled/blocked 独立呈现；
- 显示真实发布器识别的附件数量和站内引用出现次数；
- blocked 时列出结构化 issue code、消息和可选路径；
- 完整验证 JSON version/mode/safety、entry、媒体 preparation、issue、日期状态、路径与聚合计数；
- 只接受一个精确活动来源；报告结算时活动 `TFile`、路径或 Vault 映射变化即拒绝；
- 不可信证据不回退到全库文本，不自动重试，也不启动发布或 doctor。

## 6. 实现方法

`prepareObsidianNote` 原本已经在附件和 Obsidian 链接转换后调用 `extractInternalContentReferences`，逐一证明页面目标与标题锚点。现在同一循环在验证完成后返回引用数组长度，作为 `internalLinkCount`；没有再次扫描正文，也没有在插件里写正则。

`inspectDraft` 继续先调用同一 `prepareObsidianNote`，再显式分支 `parsePostFile`/`parseProjectFile`。post 分支从正式 `PostRecord.type` 保留 article/til，project 分支标记 project；两边共同写入公开日。显式分支也是第一次完整门捕获 TypeScript 联合类型相关性丢失后的修正：不使用断言掩盖，而是在各自类型域内取字段。报告顶层增加 version/mode/safety；无效草稿仍有固定 `internalLinkCount: 0`，一个坏草稿继续不阻断其他条目。

插件运行 `npm --silent run content:inbox -- --format json`，但不信任输出。parser 要求 exact top-level keys，四项 safety 全为 false，逐条验证 prepared identity 的全有/全无、kind/contentType/slug/target 一致性、媒体路径和 preparation envelope、issue code/路径、ready/scheduled 与报告日关系，以及 counts 与 entries 重新聚合全等。最后要求 expected source 恰好命中一次。

命令调用时冻结 `TFile`、sourcePath 和 sourceSlug。子进程成功后，在解析和渲染前再次要求当前 active identity、原始对象与 Vault path mapping 全部仍指向同一对象。失败时不降级到现有全 inbox 文本 Modal，因为它无法继续证明“当前草稿”；只显示 Notice 并保持零副作用。

## 7. 验证证据

失败优先基线：选择性运行 16 个新/变更合同，16/16 按预期失败；失败集中在 version/safety、引用计数、新命令、三态 UI、严格拒绝和桌面活动路径尚不存在。

实现后证据：

- 同一 16 项失败优先合同最终 16/16；
- author doctor、inbox readiness、Obsidian 发布与插件四文件相关回归 143/143；
- 真实 `npm run content:author:doctor`：AUTHOR READY 13/13，11/11 脚本、32/32 固定依赖、5/5 路径、插件 1.22.0；安全边界仍是零安装、零配置/文件修改、零凭据读取、零网络；
- 第一遍完整门最初在 304/304 单元与集成、ESLint 之后由 TypeScript 捕获 post/project 联合类型取值问题；显式分支修复后独立 typecheck 通过；
- 修复后的第一遍 `npm run release:check`：139.6 秒，304/304 单元与集成、TypeScript、45/45 构建页面、19/19 生产应用测试、生产依赖审计 0；Current 1 / Historical 3、inbox 0、根暂存 0、外链本地问题 0；
- 归档后的第二遍 `npm run release:check`：130.7 秒，同样通过 304/304、45/45、19/19 与生产依赖审计 0，证明 Vault 档案、操作文档和公开项目短摘要没有突破内容、HTML 或体积门。

## 8. 经验与教训

1. “复用结果”应从产生事实的函数边界返回，而不是让 UI 或下游报告重新扫描同一正文。
2. `post` 不等于 `article`；若产品要显示作者选择的内容类型，必须保留正式 record 的 article/til 区分。
3. read-only 不是一句文案。version、mode、safety、计数和来源路径必须相互证明，才能让插件安全渲染外部子进程输出。
4. 当前文件语义需要调用时冻结和结算时复核两道门；只把 sourcePath 传给子进程不能防止作者在等待时切换笔记。
5. 通用报告的纯文本降级不总适用于聚焦视图。失去结构后无法证明“唯一当前项”时，失败关闭比展示相关但不精确的文本更诚实。
6. 状态与日期语义是两个维度：一篇未来草稿可以因附件缺失而 blocked，界面仍应保留未来日期事实，而不是把 HOLD 当作日期。
7. 真实媒体 preparation schema 看似与摘要无关，但附件数量来自同一数组；严格验证完整 envelope 能防止半可信条目进入聚焦 UI。
8. TypeScript 门捕获了运行时测试未暴露的联合类型相关性问题；显式领域分支比类型断言更能维持后续演进安全。
9. 只读摘要不应顺手加入“立即检查/发布”按钮，否则会把事实核对与写事务授权重新耦合。
10. 当前实现为了保持共享附件判断会检查整个 inbox 并派生全部媒体；正确性优先，但这也暴露了下一轮可独立优化的性能边界。

## 9. 全局状态、风险与未解决问题

作者现可在 Obsidian 独立完成草稿创建、文件名改名、旧身份取证/严格清理、当前作者意图核对、全 inbox 就绪查看、单篇检查与发布。作者意图 Modal 已覆盖 DOM/CSS、ready/scheduled/blocked、Article/Project、完整媒体包络、schema/safety/count/source 失败与活动文件漂移，但没有真实 Obsidian 宿主像素快照；TIL 类型由正式 record 逻辑与模板回归覆盖，尚未在新 Modal 专门渲染断言中单列。

当前命令读取整个 inbox report，才能保留共享附件诊断；这也会对所有草稿执行真实媒体派生。空 inbox 和小型工作区成本很低，但多草稿/大图工作区可能为一个当前摘要等待无关候选。任何 source-scoped 优化都必须先轻量观察全草稿附件所有权和正式目标，不能通过只扫描当前文件而制造假 ready。新功能仍不替代完整 `content:publish --check-only`、`npm run check`、author doctor 或 Git 交付状态。

## 10. 下一轮唯一主任务

评估 source-scoped inbox evidence：为 `inspectInboxReadiness`/CLI 设计一个只返回当前草稿完整证据的模式，同时继续轻量解析所有草稿以保留共享附件和碰撞判断，只跳过无关草稿的真实媒体派生。必须证明全库默认报告完全不变、当前证据与全库同项语义一致、无关坏草稿仍不会中断目标结果；不得复制发布规则、弱化安全声明、引入云服务/真实 API、自动发布或自动修复。

## 结论

MyBlog Publisher 1.22.0 已把“我正在写的这篇准备公开成什么”变成可验证的本地摘要，而不是另一套手工元数据或插件正则。类型、目标、日期、媒体、链接和 blocker 都来自正式发布/inbox readiness 链路；当前文件或证据不能被严格证明时就不打开。作者获得了更快的核对入口，同时发布、Git、网络和自动修复边界保持不变。
