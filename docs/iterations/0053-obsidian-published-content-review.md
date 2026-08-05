# Iteration 0053：Obsidian 正式内容自助复核闭环

## 1. 范围与成功标准

本轮只补齐 Iteration 0052 台账“打开笔记”之后的正式内容复核路径。作者仍是事实核对者：插件不能自动把打开、保存或点击当成已经验证版本、架构、状态、命令和链接；Markdown/Git 仍是唯一事实源，完整仓库门仍是交付权威。本轮不改变新稿发布事务、Studio、公开路由、内容新鲜度期限、线上 API、Vercel 或外部提醒。

成功标准是：作者手工编辑已发布 Current 笔记后，可从 Obsidian 或 CLI 做只读完整检查，确认后只提交并推送当前正式 Markdown；HEAD 与当前内容之间的复核日期、事实变化和身份必须可信；分支、暂存区和工作区边界不允许把其他文件混入复核；门失败不暂存、不提交；commit 前失败取消暂存；真实 Git 仓库和本地裸远端证明成功提交只含目标文件。回滚功能提交 `2e6f05f62ed8543a15cca593ba82cfa5d460c319` 即可移除 1.4.0 两条命令和 `content:review`，不会回退维护台账或改变任何已有内容。

## 2. 项目结构状态

- `lib/content/review-note.ts`：新增正式复核领域契约，解析 HEAD/当前内容并判断日期、身份与语义变化；
- `scripts/review-note.mjs`：新增跨平台 CLI、Git 工作区隔离、完整检查、精确暂存/commit/push 与失败恢复；
- `package.json`：新增 `content:review`，新测试进入唯一 `test:unit` 清单；
- `.obsidian/plugins/myblog-publisher/main.js`：新增“检查当前正式内容复核”和“提交并同步当前正式内容复核”，复用既有固定参数 spawn、Notice、输出上限和卸载清理；
- `.obsidian/plugins/myblog-publisher/manifest.json`：MyBlog Publisher 从 1.3.0 升到 1.4.0；
- `tests/content-review.test.mjs`：新增纯领域测试与临时真实 Git/裸远端集成测试；
- `tests/obsidian-plugin.test.mjs`：active-file harness 增加正式文章/项目命令可用性、固定参数、桌面限制和 reconcile 证据；
- `tests/obsidian-publishing.test.mjs`：静态插件契约同步到 1.4.0 与两条 review 命令；
- `content/inbox/README.md`、架构、设计、发布、运维、路线图、状态与公开 MyBlog 项目页：同步人工边界、使用方法、恢复语义、验证证据、风险与下一任务；
- Next.js 页面、Studio、内容 schema、媒体事务、维护 JSON、GitHub workflow、Vercel 配置和公开客户端 bundle 没有改变。

## 3. 设计内容

正式复核的主语必须是作者，不是按钮。台账只负责回答“该复核什么、笔记在哪里”；打开笔记后，作者逐项确认事实并显式编辑日期。1.4.0 使用两条完整动词命令而不是 Save/Done：“检查当前正式内容复核”明确为无 Git 副作用的证据门；“提交并同步当前正式内容复核”明确包含完整检查、提交与推送。命令只在活动文件是精确正式 Markdown 时出现，避免在 inbox、普通笔记或移动端给出不可执行动作。

本轮不新增确认弹窗、完成率、自动日期按钮或另一套后台视觉。进度与终态继续用宿主 Notice：check-only 成功文案明确“没有暂存、提交或推送”，同步成功文案明确“等待线上部署”；失败保留 CLI 最后四行供修复。作者先运行 check、阅读结果，再主动选择 sync，这两个分离动作本身就是确认边界。详细 Git/日期规则写进发布手册和 Vault README，不把安全条件藏在错误之后。

## 4. 使用的技术

- TypeScript 内容契约：`parsePostFile`、`parseProjectFile`、`isPublished` 与 `ContentValidationError`；
- `Asia/Shanghai` 的 `resolveContentBuildDate`，与构建、维护、Studio 共享同一报告日定义；
- 语义快照比较：排除 reviewedAt、updatedAt 和派生字数/阅读时间后比较真实 frontmatter/正文；
- Node.js `spawnSync`、固定参数数组、Windows 固定 `cmd.exe /d /s /c npm`、POSIX 直接 npm、`shell: false`；
- Git plumbing/porcelain：`branch --show-current`、`ls-files`、NUL 分隔 diff、`show HEAD:path`、pathspec add、`commit --only`、`diff-tree` 与 `push origin main`；
- Obsidian Desktop Plugin API 的 active file、`FileSystemAdapter`、Notice 与 adapter reconcile；
- Node.js `vm` 行为夹具、临时 Git 工作仓库、本地 bare remote、`node:test` 与 strict assertions；
- research-iteration-loop 把范围限制为正式 review-note 一个纵切，在完整门后做全局状态复核并选择下一处证据可见性空白。

## 5. 实现的功能

- CLI 新增 `npm run content:review -- <正式 Markdown> --check-only|--push`，两种模式必须显式二选一；
- 仅接受稳定的 `content/posts|projects/<slug>.md`，文件必须存在且已被 Git 跟踪；
- 前后内容都必须在复核日已公开且为 `freshness: current`，`publishedAt` 不可改变；
- 当前 `reviewedAt` 必须等于上海当天，并严格晚于 HEAD 中的上次复核日；日期精度为一天，因此同日不能重复声明复核；
- 只推进复核证据时，`updatedAt` 必须保持 HEAD 原值；正文或元数据语义变化时，`updatedAt` 必须等于当天；
- 只允许当前分支为 `main`、暂存区为空、没有未跟踪文件、唯一未暂存修改是当前目标；
- `npm run check` 前后各复查一次 Git 状态，避免测试/构建或并发编辑在门禁期间扩大提交范围；
- `--check-only` 通过后保持 HEAD、index 与工作区修改关系不变；
- `--push` 只 `git add -- <source>`，验证 index 唯一路径，再以 `git commit --only -m "content: review <slug>" -- <source>` 提交；commit 后用 tree 再验证唯一文件才推送；
- 完整门失败时不进入 staging；commit 前任何错误用 `git restore --staged` 只清理 index，不碰作者工作区；push 失败保留合法本地 commit 并给出恢复命令；
- Obsidian 1.4.0 只在活动正式笔记上暴露检查/同步命令，固定调用同一 CLI，原有新稿发布、inbox 和维护命令保持不变。

## 6. 实现方法

先把领域转换从 Git 脚本中拆开。`inspectContentReview` 用同一 sourcePath 分别解析 `git show HEAD:<path>` 和磁盘当前文本；这同时复用严格 frontmatter、slug/文件名、标签和正文规则。它先验证公开 Current 身份和 publishedAt，再验证 reviewDate。语义快照只删除 reviewedAt、updatedAt 与派生统计：如果剩余结构相同，就是“事实未变，只推进 reviewedAt”；否则要求 updatedAt 同步当天。这样既不强迫无事实变化时伪造 updatedAt，也不允许修改正文后只刷新复核时间。

Git 层采用 fail-closed 的单文件工作区。脚本先拒绝非 main、未跟踪目标、任何 staged、任何 untracked，以及 changed path 不精确等于目标的状态。它在完整门后再次执行同一审计；因此即使作者在长测试期间编辑另一文件，也不会被后续 add/commit 忽略成“已经验证”。push 模式先验证 index，再使用 `commit --only` 和显式 pathspec，最后检查新 HEAD tree 的路径。commit 尚未成功时只恢复 index；commit 已成功后不自动 reset，因为那会破坏合法作者历史，网络失败改为保留 commit 并指导重推。

集成测试不是 mock Git。每条事务测试创建临时 `main` 工作仓库、提交一份旧复核内容、创建本地 bare origin 并完成初始 push，再写入当天复核内容。成功路径真实运行 npm check、git add/commit/push，并比较工作 HEAD、remote main、commit subject 和 diff-tree；失败路径分别制造未跟踪文件、pre-staged、非 main、质量门退出 7，验证 HEAD、index 和 remote 均不改变。Obsidian VM harness 只负责证明活动文件路由和固定参数，Git 正确性由真实仓库测试承担。

## 7. 验证证据

- 失败优先：新 `tests/content-review.test.mjs` 首次因 `lib/content/review-note.ts` 不存在而失败；插件旧实现为 9/11，通过既有维护行为，失败精确指向 manifest 仍为 1.3.0 和 review 命令不存在；
- 定向最终验证：内容复核与插件合计 19/19；覆盖 review-only、事实变化、旧日期、publishedAt 漂移、Historical、非法路径、check-only、untracked、staged、非 main、门失败和真实 bare remote push；
- ESLint 零 warning、TypeScript、`node --check` 和 `git diff --check` 通过；
- 首次 `release:check` 因命令执行时间超过 120 秒被运行器终止，不是测试失败；提高外层时间包络后原样重跑通过，没有删除真实 Git 测试或缩小门禁；
- 完整 `npm run release:check`：Current 1 / Historical 3、inbox 0、根暂存 0、外链 2 URL / 3 occurrences / 0 issue、171/171 单元、TypeScript、45 个页面生成任务、19/19 生产应用测试、production audit 0；
- `.next/static` 保持 1,818,133 B；插件 main/manifest/styles 合计 29,770 B，不进入公开阅读客户端；
- 功能提交 `2e6f05f62ed8543a15cca593ba82cfa5d460c319` 已推送；Quality Gate `30986953764`（#93）与 Vercel Production 验证 `30986989441`（#86）均 completed/success；
- 当前真实 `content/projects/myblog.md` 已在 2026-08-05 复核，且本轮开发工作区包含多文件变化；新 CLI 会正确拒绝拿它伪造同日第二次单文件复核，因此真实端到端正向证据来自日期动态生成的隔离 Git 仓库，不篡改生产内容历史；
- 没有新增依赖、secret、云配置、数据库、Cloudflare 或外部消息通道。

## 8. 经验与教训

- 内容“复核”不是普通保存。reviewedAt 是事实声明，必须比较 HEAD 旧证据并要求严格推进，不能只检查当前字段看起来像日期；
- updatedAt 和 reviewedAt 有不同语义。无事实变化时强迫更新 updatedAt 会制造虚假修改史；有事实变化时不更新 updatedAt 又会隐藏读者应知道的修订；语义快照能把两者分开；
- `git add <path>` 不足以证明单文件提交。空 index、唯一 worktree、pathspec、`commit --only` 和提交后 tree 核对共同提供可审计证据；
- 完整检查必须前后各看一次 Git 状态。长门禁期间作者或工具可能继续写文件，一次前置检查无法证明提交时仍是同一范围；
- push 失败和 commit 失败不是同一恢复状态。前者已经产生合法历史，自动 reset 会破坏作者工作；后者只需取消 staging 并保留工作区；
- 真实临时仓库比 spawn mock 更能发现 branch、index、HEAD、remote 和 pathspec 的组合错误；代价是单元集增加约二十多秒，应提高外层任务超时而不是删掉事务证据；
- 同日重复复核无法用 YYYY-MM-DD 区分。明确拒绝比暗中接受“日期没变”更诚实；同日事实修正仍可用普通 Git 提交，但不应声称形成第二次复核证据；
- 严格零无关变化保证本地完整门与远端单文件 commit 的可复现性，但会要求作者先处理其他未跟踪草稿；这是当前安全/便利权衡，应在真实多草稿使用中继续观察。

## 9. 全局状态、风险与未解决问题

MyBlog 的作者闭环现在分为清晰的四条路径：Studio 处理网页 editorial workflow，新稿 inbox 由 Obsidian 发布事务移动/优化/提交，维护台账定位 Current 内容，正式 review-note 在人工复核后验证/精确同步。公开阅读、搜索、Feed、知识图、媒体/关系/外链/期限门、Vercel 自动交付与恢复都继续共享 Git 内容源。没有运行时依赖 Codex、Cloudflare 或数据库。

正式 check-only 成功目前只显示一条 Notice；CLI 在标准输出给出路径、旧/新复核日和“事实变化：有/无”，但 Obsidian 不显示成功输出，因此作者在同步前仍需自己打开 frontmatter 或终端核对证据。严格工作区要求会阻止同时存在未跟踪 inbox 草稿的复核；它保证远端重现性，但实际多草稿工作方式可能需要未来细分“影响质量门的变化”和“安全本地草稿”。push 网络失败会留下本地 commit，这是明确恢复状态，但插件当前只通过失败 Notice 告知，尚无本地 ahead 状态面板。

插件更新后仍需重启或重新启用 Obsidian。既有 Decap 固定版本/OAuth/CSP、开发依赖审计、Vercel Hobby 回滚、网络健康假阴性、附件 Git 历史、知识图扩容和所有者未选择的域名/统计/评论继续保留原风险。

## 10. 下一轮唯一主任务

给“检查当前正式内容复核”增加结构化 Author Proof。CLI 在完整门通过后支持版本化 JSON，至少包含 sourcePath、kind/slug、HEAD 与当前 reviewedAt、updatedAt、substantiveChanged、唯一 changed/committable path 和 qualityGate 状态；纯文本保持现有终端可读性。插件严格验证 JSON 后，用原生只读 Modal 显示日期轨迹、事实变化和精确提交范围，不在 Modal 内暗中触发同步；JSON/schema/UI 异常时重新执行纯文本 check-only 作为安全降级。继续保持零自动改日期、零 check-only Git 副作用、同步命令独立、无外部服务，并增加空/异常结构、长质量门输出和 fallback 行为测试。
