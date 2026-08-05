# Iteration 0054：Obsidian 结构化正式内容 Author Proof

## 1. 范围与成功标准

本轮只补齐 Iteration 0053 的检查结果可见性：作者已经人工核对正式 Current 内容并修改日期后，check-only 必须在完整仓库门通过后给出机器可验证、人在 Obsidian 中可读的 Author Proof。它需要显示 HEAD 到当前的复核日期迁移、是否有事实变化、updatedAt 证据、质量门状态、Git 边界和唯一可提交路径，同时保持“检查”和“提交并同步”为两个独立动作。

成功标准是：JSON stdout 只能包含版本化 Proof，长质量日志不能污染它；插件不能只检查字段存在，而要重算日期、语义和路径关系；任何 JSON/schema/活动路径/Modal 异常都必须重跑纯文本 check-only，命令本身失败不能降级成假成功；Modal 只读且没有同步按钮；原有 push、日期、单文件提交和失败恢复语义全部不变。功能回滚点为 `8d4c7346ae85a3956ebd7d3710813c4261bbbf03` 的父提交，回滚不会改变既有正式内容历史。

## 2. 项目结构状态

- `lib/content/review-note.ts`：在既有正式复核领域结果上新增 `ContentReviewProof` 与 `createContentReviewProof`，固定 schema version 1；
- `scripts/review-note.mjs`：参数解析扩展为 `--format text|json`，JSON 仅允许 check-only，负责隔离完整门日志并在门后生成 Proof；
- `.obsidian/plugins/myblog-publisher/main.js`：新增严格 Proof validator、结构化只读 Modal 和纯文本二次检查降级；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增 `.myblog-review-proof` 范围内的日期迁移轨、证据账本和窄屏规则；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.4.0 升到 1.5.0；
- `tests/content-review.test.mjs`：覆盖 schema、250,000 字符日志隔离和 push/JSON 非法组合；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：覆盖严格解析、UI、活动路径、版本/关系异常与降级，静态契约同步到 1.5.0；
- `content/inbox/README.md`、架构、设计、发布、运维、路线图、状态与公开项目页：同步使用方式、实现边界、证据、风险和下一任务；
- Next.js 页面、Studio、内容 schema、媒体事务、GitHub workflow、Vercel 配置和公开客户端 bundle 没有改变。

## 3. 设计内容

这个视图的主体是“准备决定是否同步的内容所有者”，任务不是查看一组抽象指标，而是确认一次从 HEAD 证据到当前声明的真实转换。因此最终布局从 `AUTHOR PROOF / CHECKED` 开始，接着显示标题和稳定 sourcePath，再用 HEAD 日期到当前日期的 review transition rail 表达唯一视觉主线；下方规则线 ledger 依次回答事实是否变化、updatedAt、质量门、分支、index、untracked 和唯一提交路径。

颜色使用 Obsidian 宿主 token，并以 Evidence Ink、Verified、Trace、Caution 的角色组织；标题服从宿主正文，界面标签使用 interface 字体，日期、命令与路径使用 monospace。颜色始终配合文字，不单独承担状态语义。迁移轨是本轮唯一视觉签名：不使用渐变、动画、阴影卡片阵列，也不复制博客网页外观。曾考虑的四张摘要卡会把一次线性证据转换误画成通用 dashboard，已删除。Modal 底部只说明仍需单独运行同步命令，不提供按钮，避免把“看过证据”混同为“授权提交”。

## 4. 使用的技术

- TypeScript discriminated data contract 与现有 `ContentReviewInspection` 领域结果；
- Node.js `util.parseArgs`、同步子进程、分离 stdout/stderr 和 5,000,000 字符质量日志包络；
- Git porcelain/plumbing 复查 main、changed、committable、staged 与 untracked；
- Obsidian Desktop Plugin API 的原生 Modal、宿主 CSS variables、活动文件和既有进程账本；
- CommonJS 边界的 exact-key schema validation、ISO 日期解析和跨字段关系重算；
- Node `vm` DOM/插件行为夹具、真实临时 Git 仓库与 `node:test`；
- `research-iteration-loop` 将范围限定为 Proof 证据闭环；`frontend-design` 用真实日期迁移轨和证据账本取代通用卡片界面。

## 5. 实现的功能

- 新增 `npm run content:review -- <path> --check-only --format json`；
- 成功 JSON 固定为 `version`、`mode`、`review`、`git`、`qualityGate` 三组领域证据，且 stdout 不混入质量日志；
- `review` 包含 kind、slug、title、sourcePath、前后 reviewedAt/updatedAt 与 substantiveChanged；
- `git` 明确 main、唯一 changed/committable path、空 staged 和空 untracked；
- `qualityGate` 只有完整 `npm run check` 实际成功后才能出现 `passed`；
- `--push --format json` 明确拒绝，避免把机器证据模式与写事务混在一起；
- Obsidian check 命令通过后打开结构化 Author Proof，不再只显示短暂 Notice；
- 插件严格检查精确顶层/嵌套字段、version/mode、活动路径、身份、真实 ISO 日期、旧日期早于新日期、updatedAt 与事实变化关系、main、唯一范围、空 index/untracked 和质量门命令/状态；
- JSON、schema、活动路径或 UI 构建异常时重新运行普通文本 check-only，再以纯文本 Modal 显示；命令非零退出仍直接失败；
- push 命令保持独立，check-only 不 reconcile、不暂存、不提交、不推送。

## 6. 实现方法

Proof 不在检查开始时乐观生成。CLI 先完成参数、Git 前置、HEAD/当前领域转换，再运行完整 `npm run check`，随后第二次审计工作区；只有这些步骤全通过，才从已验证的 inspection 创建 Proof。文本模式把质量输出直接交给终端；JSON 模式把它捕获在 5,000,000 字符上限内，失败时转写 stderr，成功时丢弃过程日志并仅向 stdout 写一个 JSON 文档。这样 CLI 仍保留可诊断性，机器消费者也获得排他的结构通道。

插件不是把 `JSON.parse` 成功当作可信。validator 使用精确 key 集合，随后重算跨字段关系：path 必须等于活动文件；kind/slug 必须和 path 对应；previousReviewedAt 必须早于 reviewedAt；updatedAt 不能早于 published 语义边界或晚于复核日；事实变化要求当天 updatedAt，无事实变化要求前后 updatedAt 相同；Git 数组必须精确指向同一目标且 staged/untracked 为空。只有关系全部成立才构建 Modal。

降级不是把损坏 JSON 原样展示，也不是把解析失败改称成功。插件在 JSON/schema/path/UI 异常时执行第二次普通文本 check-only；只有这次完整检查成功才显示纯文本 Proof。原 JSON 命令若已经非零退出，则保留其诊断并结束。这个区分避免“展示层故障”和“质量门失败”共享一个误导性结果。

## 7. 验证证据

- 失败优先：内容测试最初因缺少 `createContentReviewProof` 失败；插件旧实现先通过既有 9 项，再精确失败于 manifest、JSON 参数和 fallback 契约；
- 定向最终验证：content-review 与 obsidian-plugin 合计 24/24，通过无效 JSON、错误 sourcePath、version 2、updatedAt 关系不一致和 UI 异常等降级路径；
- 长输出夹具让质量命令产生 250,000 字符，最终 JSON stdout 仍小于 5,000 字符且可严格解析，日志没有泄漏；
- ESLint 零 warning、TypeScript、`node --check` 与样式静态契约通过；
- 完整 `npm run release:check`：Current 1 / Historical 3、inbox 0、根暂存 0、外链 2 URL / 3 occurrences / 0 issue、176/176 单元、45 个页面生成任务、19/19 生产应用测试、production audit 0；
- `.next/static` 保持 1,818,133 B；插件 main/manifest/styles 合计 43,548 B，不进入公开阅读客户端；
- 功能提交 `8d4c7346ae85a3956ebd7d3710813c4261bbbf03` 已推送；Quality Gate `30988816791`（#95）与 Vercel Production 验证 `30988856799`（#88）均 completed/success；
- 当前真实 `content/projects/myblog.md` 已在 2026-08-05 复核，不能伪造同日第二次声明；正向 Proof 由日期动态生成的隔离 Git 仓库验证，真实 Obsidian 主题的像素外观尚未人工截图验收，本轮只声明 DOM、行为和 CSS 契约；
- 没有新增依赖、secret、云配置、数据库、Cloudflare 或外部消息通道。

## 8. 经验与教训

- 机器可读 stdout 必须是排他协议通道。即使质量门通常输出不大，也不能靠“消费者从末尾找 JSON”维持脆弱契约；
- `passed` 证据只能在门和门后状态复查之后创建。预先组装再等待检查会使异常路径拥有看似合法的成功对象；
- 严格 schema 不只是字段 allowlist。日期先后、事实变化与 updatedAt、活动文件与 Git 路径等关系必须在消费边界重新计算；
- 安全 fallback 应重新取得可信证据，而不是展示无法验证的原始负载。因此异常时接受第二次完整检查的成本，且只在结构/展示异常时发生；
- Proof 内不放同步按钮是功能边界，不只是视觉偏好。证据确认和写入授权需要保持两个显式动作；
- CLI 的 5,000,000 字符捕获上限与插件既有 200,000 字符进程输出上限处在不同层：前者容纳内部完整门，后者保护 UI 消费；两者都必须有测试，不能互相替代；
- DOM/CSS 契约可以证明无按钮、无渐变、结构和降级，但不能替代真实 Obsidian 主题下的像素观察，文档必须明确证据边界。

## 9. 全局状态、风险与未解决问题

MyBlog 现在同时提供网页 Studio 新稿、Obsidian inbox 发布、Current 维护台账和正式内容 review-note 四条作者路径。1.5.0 让最后一条路径在同步前拥有可读且可机验的 Proof；公开阅读、搜索、Feed、知识图、关系/媒体/外链/期限门、Vercel 自动交付和恢复继续共享 Git 内容事实源，不依赖 Codex、Cloudflare 或数据库运行。

结构化异常会触发第二次完整 check-only，因此极少数插件兼容故障会付出双倍门禁时间，但不会降低证据强度。插件体积增长到 43,548 B，仍是仅本机加载且不进入网页 bundle。CLI 与插件 schema version 必须协同升级。真实主题组合、超长标题和未来大队列仍需随使用观察。

当前最直接的作者体验风险是严格零未跟踪要求：只要另一个 inbox 草稿或根暂存附件仍在工作区，正式复核就会被阻断。不能用 `.gitignore` 或“忽略所有 content 变化”简单放宽，因为这会掩盖会影响构建或提交的路径；需要把安全 deferred author work 和必须阻断的正式/代码/未知改动分开分类。

## 10. 下一轮唯一主任务

实现共享 worktree impact classifier。精确识别 `content/inbox/<slug>.md` 和根 `public/uploads/<file>` 为不会进入正式 review commit 的 deferred author work，并在完整门前后复算；任何 staged、其他正式内容、代码、配置、嵌套已归档媒体或未知路径继续阻断。Proof 必须显式列出 deferred paths，CLI 文本与插件结构同步升级；`git commit --only`、提交后唯一 tree 和失败恢复保持不变。测试需要证明并行草稿可以保留，也要证明伪装路径、嵌套媒体和门禁期间新增影响项仍 fail closed。
