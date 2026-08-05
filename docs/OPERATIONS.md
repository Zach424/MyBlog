# 运行维护手册

## 当前运行模型

- 应用：原生 Next.js 16 / React 19；
- 当前生产站：`https://blog-iota-five-59.vercel.app`，Vercel 项目 `czq1/blog`；
- 生产交付：GitHub `main` 触发 Vercel 自动部署，GitHub deployment status 触发稳定生产域名冒烟；
- 自动化运行时：GitHub-hosted `ubuntu-latest`，checkout/setup-node v6 使用 Node 24 action runtime，仓库命令仍在显式 Node.js 22 + npm cache 下运行；
- 当前回退站：`https://zach424-engineering-notes.zhiqingchen792.chatgpt.site`；
- 内容：GitHub 仓库中的 Markdown 与附件；
- 作者入口：`/studio`、`/studio/maintenance` 只读复核队列、Obsidian、普通 Git；
- 数据库：无。

## 一次性生产配置

1. Vercel 项目、Next.js 设置、稳定生产域名和 GitHub OAuth Production 环境变量已完成；
2. GitHub OAuth App 的 Homepage/Callback 已指向稳定生产 origin，并已验证 Token 交换和仓库读取；
3. Vercel GitHub App 仅授权 `Zach424/MyBlog`，GitHub Login Connection 与 `vercel git connect` 已完成，生产分支为 `main`；
4. GitHub Actions variable 已保存稳定生产域名，repository secrets 已保存 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`；
5. Studio editorial workflow、Obsidian `--push`、Git 自动部署、自动冒烟和回滚恢复均已真实验收。

Secret 只保存在 Vercel/GitHub 的加密设置中，不进入 `.env.example`、文档、截图、聊天或 Git 历史。Preview 默认不设置 OAuth secret，因此后台在预览部署安全关闭。

## 日常发布

1. 在 `/studio` 或 Obsidian 新建内容；
2. 保持稳定 ASCII slug，填写摘要、日期、`freshness`、`reviewedAt`、标签和正文；
3. 草稿阶段保持 `draft: true`；需要定时发布时再设置未来 `publishedAt`；
4. Obsidian 中可先运行“查看已发布内容复核台账”处理已有 Current 内容；打开正式笔记并人工更新事实与复核日期后，依次运行“检查当前正式内容复核”和“提交并同步当前正式内容复核”。发布新草稿时先运行“查看当前草稿发布意图”快速核对类型、目标、日期、附件与站内链接；需要全库对照时运行“查看全部草稿发布就绪状态”，处理 blocked 并确认 scheduled 日期，再运行 `npm run content:publish -- <note> --check-only`；
5. 逐张确认实际格式、宽高、帧数和体积后，使用 Obsidian 的“发布当前草稿并同步 GitHub”或命令行 `--push`。`--push` 会把 `draft` 改为 `false` 后运行完整质量门、提交并推送；网页方式使用 editorial workflow。若新内容 push 失败，先运行“查看待同步新内容发布”，不要恢复草稿或再次发布；
6. 让质量门通过，再把提交合并到 `main`；
7. Vercel 自动创建生产部署，deployment status 工作流检查稳定公开生产域名；
8. 打开文章、RSS 和 Sitemap，确认新内容可见且绝对 URL 指向当前生产域名。

## URL 迁移

已公开 slug 原则上保持不变。确需迁移时，在同一 Git 提交中移动内容与归档附件、修正所有引用，并把旧路径登记到 `content/redirects.yml`，直接指向最终公开 HTML 页面。每条记录必须填写迁移日期和原因；不要使用查询、锚点、通配参数、链式跳转，也不要覆盖现有页面、静态文件、`/_next`、`/api`、`/studio` 或 `/uploads`。

提交前运行 `npm run check`；上线后用 `curl -I https://<生产域名>/<旧路径>` 或完整生产冒烟确认状态为 308、`Location` 为同源最终地址、目标为 200。误配时回滚注册表和同一次迁移提交；若内容已在错误新地址短暂公开，保留所有曾公开地址并直接指向最终规范页面，避免制造新的链。

Current record 至少每 180 天逐项复核一次架构、版本、状态、外链和操作步骤；有事实变化时同步更新正文与 `updatedAt`，无变化时只更新 `reviewedAt`。Historical snapshot 不要求持续追新，但正文必须说明记录时间与当前去向。

每周 Quality Gate 会在周一 09:00（Asia/Shanghai）生成维护摘要；也可随时运行 `npm run content:status`。剩余 60/30 天分别进入“准备复核/即将到期”，warning 不阻断构建；越过最后有效日才失败。处理提醒时按报告清单逐项验证，不要只更新日期。

日常可先打开 `/studio/maintenance` 查看 Review Horizon 和全库优先级，再从 `Edit entry` 进入稳定条目。该页面的内容集合来自当前部署、日期按请求时的 `Asia/Shanghai` 当天推进；因此修改只有在新 Production 上线后可见，但无需为了日期变化重新部署。接口只返回已公开 Current 内容的最小元数据，不返回正文、源路径、草稿或 Historical。页面失败时先点 `Retry`，仍失败再运行 `npm run content:status` 并检查 `/studio/maintenance.json` 的 HTTP 状态；不要用手工改日期或缓存快照替代复核。

在本机 Vault 中也可从命令面板运行“查看已发布内容复核台账”。插件 1.25.0 先启动本地 `content:status --format json`，严格核对版本、计数、日期计算、状态阈值、排序、公开路由和精确来源路径，再显示四档期限轨迹与逐条记录；“打开笔记”只接受 Vault 中真实存在的 `content/posts|projects/<slug>.md`。报告命令因已过期内容返回退出码 1 时仍会解析并展示有效 JSON；JSON、schema、路径或 Modal 渲染异常时，插件会再运行纯文本 `content:status` 并以安全文本节点显示证据。两条路径都零网络、零日期/文件写入。Windows 报告子进程隐藏运行且不插入动态 shell 字符串，插件卸载时以固定 `taskkill.exe /T /F` 参数清理整棵命令进程树，POSIX 直接终止子进程。持续 Notice 若没有在命令终态消失，或插件关闭后仍存在 npm 进程，视为插件生命周期故障；笔记不存在时先确认文件已同步且路径大小写正确，再在终端运行 `npm run content:status` 取证。插件文件更新后，已打开的 Obsidian 需要重启或重新启用插件才能加载新版本。

正式内容复核使用 `npm run content:review -- content/posts|projects/<slug>.md --check-only`，确认后把最后一个参数改为 `--push`。命令只接受 `main` 上已经公开的 Current 文件：`publishedAt` 不得改变，`reviewedAt` 必须从固定 HEAD 推进到 `Asia/Shanghai` 当天；事实变化时 `updatedAt` 也必须是当天。暂存区必须完全为空，包括 `git add -N`；可以并行保留已修改/未跟踪的稳定 inbox 草稿，以及未跟踪的根暂存图片。已跟踪根图片修改、嵌套归档媒体、其他正式内容、代码、配置或未知路径会阻断。完整门前后都重算影响，并要求 HEAD 与目标原始 SHA-256 保持不变；push 只提交当前 Markdown，且 index/tree blob 必须对应门前经过 Git clean/filter 的同一候选，deferred 路径原样留在本地。MyBlog Publisher 1.25.0 严格验证 Proof v3 的 candidate 与 worktree 差集，再显示短指纹、路径和状态；结构或 UI 异常重新执行普通文本 check-only，命令失败不伪造 Proof。门失败保持未暂存；commit 前失败取消目标暂存；commit 后 tree 不匹配会原子撤回本地提交并保留工作区；已验证 commit 的 push 失败仍保留本地提交。

任何复核或新内容发布 push 失败后，不先猜提交类型：运行 `npm run content:delivery:status`，或 Obsidian 的“查看 Git 交付恢复”。该命令从同一份本地快照输出 version 1 只读分诊，明确 `networkChecked: false` 与 `autoExecuted: false`。`REVIEW / MATCHED` 或 `PUBLICATION / MATCHED` 只表示当前 commit 满足相应领域身份，下一步仍要单独运行界面列出的 status 命令复核完整证据，再由作者显式执行对应 deliver。`INSPECT / MATCHED`、behind、diverged、tracking-missing 或多提交 ahead 都不提供写命令；非 main 只显示类型和 status 命令，deliver 保持锁定。分诊不 fetch/push/rebase/reset，不修改 HEAD、index、worktree，也不会串联执行任何恢复动作。

push 失败后先运行 `npm run content:review:status`，或在 Obsidian 运行“查看待同步正式内容复核”。报告只读取本地 main 与 `refs/remotes/origin/main`，不访问网络；非同步状态返回 1 但仍输出完整证据。只有 ahead 1 / behind 0，且提交 subject、父级、唯一正式路径、tree/blob 都匹配，才允许运行 `npm run content:review:deliver -- --format json` 或命令面板的“重新同步待交付正式内容复核”。执行器会再次确认当前分支和完整 pending 身份，保存 index/worktree，然后运行普通非强制 `git push origin <verified-oid>:refs/heads/main`；OID 源关闭分支名解析竞态，远端的 fast-forward 规则继续阻止 unseen remote advance。成功后必须证明 local/tracking 都等于原 commit 且 HEAD/index/worktree 稳定，才返回 version 1 receipt；否则按“push 可能已经完成”处理，重新运行只读状态，绝不自动重试。服务器拒绝、网络失败或状态漂移都保留本地提交；全程不 fetch/rebase/reset。普通 ahead、behind、diverged 或 tracking-missing 仍只提示人工检查 Git。

新内容发布的 push 失败与正式复核分开处理。先运行 `npm run content:publish:status`，或在 Obsidian 运行“查看待同步新内容发布”；报告只读本地 refs 与 HEAD commit，不 fetch、不 push、不写文件。只有 ahead 1 / behind 0，subject 为 `content: publish <slug>`，父级等于 tracking head，且 raw diff 精确等于一个新增正式 Markdown、可选同 slug inbox 删除和零到多个同 slug 归档媒体新增，才显示 `PUBLICATION HOLD / ATOMIC BUNDLE`、完整 Commit Envelope 与精确 OID refspec。确认后运行 `npm run content:publish:deliver -- --format json`，或命令面板的“重新同步待交付新内容发布”。执行器会再次验证 main、同一 commit/tree/全部 blob、完整 manifest 与 index/worktree，再运行普通非强制 OID push；远端 fast-forward 判定继续阻止 unseen remote advance。只有 push 后 local/tracking 同为原 commit，HEAD/index/worktree/manifest 全部稳定，才签发 version 1 receipt。服务器拒绝、网络失败或状态漂移保留本地 envelope；成功但回执证据不足时重新查看只读状态，绝不自动重试。普通 ahead、复核提交、额外路径、修改旧媒体和多提交堆叠都不给恢复动作。不要手工恢复草稿或再次运行发布器；任何非 synchronized 状态会在读取源草稿前阻止第二次 `--push`。

外部链接使用 `npm run links:external` 做本地确定性库存；命令默认不访问网络并随 `release:check` 输出。需要现场证据时运行 `npm run links:external -- --check`，但 403/429、HEAD 不支持、5xx、超时和网络错误只进入人工复核，不能直接作为生产事故或默认构建失败。检查器不下载正文、不访问私网、不改写链接；若显式 `--fail-on-broken` 返回失败，先在普通浏览器复核确定 4xx 或坏重定向再修改内容。

本地图片必须是扩展名与真实格式一致的 PNG/JPEG/WebP/GIF/AVIF，单文件不超过 3 MiB，宽高各不超过 2560 px；大截图和照片优先导出为 AVIF/WebP。即使绕过 Studio/Obsidian 直接提交，Next 构建也会扫描全部 `public/uploads` 并阻止损坏或超预算媒体进入生产。

## 发布前检查

### 在 Obsidian 新建草稿

重启或重新启用 MyBlog Publisher 1.25.0 后，在命令面板运行“新建博客草稿”。选择技术文章、今日所学或项目记录，填写 1–120 字符的单行标题和最多 80 字符的小写 ASCII slug；slug 只能使用小写英文、数字和单个连字符。向导将读取精确的 `templates/obsidian/article.md`、`til.md` 或 `project.md`，验证固定 frontmatter/占位符后创建 `content/inbox/<slug>.md`，并写入 `Asia/Shanghai` 当天日期。文件名是唯一 slug 身份，模板不会再写 frontmatter `slug`。

向导不会从标题猜 slug，也不会覆盖 `content/inbox`、`content/posts` 或 `content/projects` 中的同名文件。若出现“模板漂移”，先比较模板是否仍保留唯一的空标题、三个日期 token、`draft: true`、`featured: false` 和类型特征行，并确认没有 `slug:` 或未知 Mustache token；不要绕过检查直接改插件。创建按钮双击只产生一次请求；若同步工具在检查后抢先产生文件，Vault 的排他创建仍会失败并保留现状。提示“草稿已创建，但无法自动打开”时，不要再次创建；按 Notice 中路径从文件列表打开。该命令不运行 doctor 或 npm，不发布、不提交、不联网；写完后仍需运行“检查当前草稿”。

### 在 Obsidian 重命名未发布草稿

保存当前 `content/inbox/<slug>.md` 后运行“重命名当前草稿”。该命令只支持桌面 Vault、精确小写 ASCII 文件名和 Markdown 扩展名；目标 slug 必须不同且不超过 80 字符。插件会在读取前和执行前检查 inbox/posts/projects，同步读取磁盘 frontmatter 并要求 `draft: true`、没有旧式顶层 `slug`，然后只调用一次 `FileManager.renameFile`。内容字节不改，内部链接更新按 Obsidian 设置执行；该动作不启动 npm、doctor、发布、Git 或网络。

多个改名弹窗同时提交时只有一个 lease 可以进入宿主 API。宿主拒绝或执行后无法证明旧路径消失、新路径存在时，Notice 会把结果标为不确定；此时先从文件列表检查两个精确路径，不要立即重试，也不要复制或删除文件。

### 在 Obsidian 检查和清理旧式草稿身份

活动文件仍在 `content/inbox/<safe-slug>.md` 时运行“检查当前草稿身份”。`READY / FILE OWNED` 表示文件名已经是唯一身份，不需要动作；`HOLD / CONFLICT` 会列出 YAML、draft 或正式命名空间原因，只能关闭；`LEGACY / MATCHED` 才会出现“移除冗余 slug”。确认 `FILE ⇄ FRONTMATTER` 两侧相同和 `DRAFT / INBOX / POST / PROJECT` ledger 后再点击。

清理只接受原始行精确为 `slug: <文件名>` 的 `draft: true` 草稿。带引号、注释、anchor/tag、缩进、重复键、非字符串、不匹配值，或 posts/projects 已有同名内容时不会自动修改。成功只删除该行；宿主拒绝、文件在检查后变化或后置字节无法证明时不会自动重试。重新运行身份检查取得新证据，不要连续点击或手工复制草稿。该动作不改文件名/正文其余字节，不运行 npm、doctor、Git、发布或网络。

### 在 Obsidian 快速核对当前草稿发布意图

活动文件精确位于 `content/inbox/<safe-slug>.md` 时运行“查看当前草稿发布意图”。插件会隐藏运行 `npm --silent run content:inbox -- --format json --source content/inbox/<safe-slug>.md`，从 version 2、`mode: read-only` 的单 entry 证据中核对当前冻结路径，并以 `DRAFT → PUBLIC` 显示目标，再列出 `TYPE / DATE / MEDIA / LINKS`。`MEDIA TRACE` 逐项给出本地来源、仓库目标、公开 URL、输入/输出格式、尺寸、帧数、字节与 optimized/preserved/unproven 状态；`LINK TRACE` 给出 POST/PROJECT/SELF、最终公开路径、源码行与重复次数。日期为报告日或过去时标记 `NOW`，未来日期标记 `SCHEDULED`。blocked 会显示精确 issue，不提供跳转、修复或发布按钮。

这个摘要复用完整 inbox readiness 的类型、正式内容契约、共享源、媒体准备和站内链接判断，不在插件中解析 Markdown/YAML 或读取图片。链接 trace 来自同一次 AST 遍历和正式目标/标题验证循环；公开关系索引仍使用原投影。媒体 trace 只消费现有 preparation，并交叉验证路径、扩展名、格式、尺寸、帧数、字节差、保留稳定性与静态 WebP 不放大语义。聚焦模式仍轻量解析全部草稿并检查正式目标、附件存在/目标/Git 跟踪与共享所有权，但只为当前草稿执行真实媒体派生；全库命令不带 `--source`，继续为每篇草稿生成完整候选。JSON version/mode/safety、单 entry、计数、精确链接、路径、媒体包络、状态日期或来源不一致时失败关闭；命令运行期间切换、改名或替换活动文件也拒绝打开。不要把它当成发布授权：`READY / PUBLIC ON PASS` 仍必须继续运行“检查当前草稿”；摘要不修改文件、不进入 author transaction lease、不 reconcile、不提交、不推送、不联网，也不会在失败时自动回退或重试。

环境或仓库位置发生变化后，可运行 `npm run content:author:doctor`，或在 Obsidian 运行“检查本机发布环境”单独诊断。13 项固定检查覆盖 Node/npm/Git、仓库根、main/upstream 本地同步、身份是否配置、package/关键脚本/全部固定依赖、内容路径、Vault 与插件 1.25.0。attention 返回退出码 1 并给出修复指令，但不会自动执行；姓名、邮箱和凭据不进入报告。该命令不要求工作区为空，因为合法草稿、附件和待复核内容可能存在；具体提交边界仍由 publish/review 门决定。

插件 1.25.0 在“检查当前草稿”“发布当前草稿并同步 GitHub”“检查当前正式内容复核”“提交并同步当前正式内容复核”启动时自动运行同一 JSON doctor，并冻结调用时的来源路径。ready 不弹出 doctor，直接且仅启动一次原领域命令；attention 显示 `TRANSACTION INTERLOCK / HELD` 和完整 circuit，原命令不启动；无效 JSON 改读纯文本但仍失败关闭，doctor 致命退出同样停止。“查看当前草稿发布意图”是独立只读报告，不占用这条事务租约。

四个新事务还共享一个 single-flight lease：从 doctor spawn 前持续到领域命令或诊断降级进程结算。运行“MyBlog Publisher: 查看当前作者事务”时，ACTIVE 依次显示操作、冻结来源路径、`前置检查 · PREFLIGHT` / `发布或复核 · DOMAIN` / `证据降级 · DIAGNOSTIC`、阶段进入时间/用时、owning child 最近一次 stdout/stderr 时间/静默时长，以及总开始时间/用时。本阶段还未产生输出时会明确显示“本阶段尚无输出”。租约占用时再次调用新事务不会排队或启动第二条链，而是用同一事实显示 `AUTHOR TRANSACTION / BUSY` 和等待建议。阶段转换和 child ownership 转交都会重置输出活动；旧 child 的迟到 stdout/stderr/close/error 不能更新或释放后来 owner，即使输出正文达到捕获上限，活动时间仍可更新。时钟回拨产生的 duration 钳制为零。所有时间都只用于观察，不代表 healthy/stuck/timeout，也不会触发 watchdog、取消或重试。

租约结算后再次运行状态命令，会显示 `AUTHOR TRANSACTION / IDLE · LAST RECEIPT`。结果只有 `COMPLETED / HELD / COMMAND FAILED / START FAILED / RESULT FAILED / UNLOADED` 六类，并列出原操作、冻结来源、最终阶段、UTC 开始/结束与总用时。成功回调若把 ownership 转给 domain 或 diagnostic child，旧 child 的 finally 不会生成回执；只有最终 owner 结算才覆盖上一条。新事务运行期间 ACTIVE 始终优先。回执只在当前插件实例内保留一条，不存输出正文、错误文本或退出码，不写 Vault/Obsidian 配置；重启或重新启用插件后清空。它不执行重试、恢复、push 或下一步命令；具体失败仍看终态 Notice，push 不确定仍先运行“查看 Git 交付恢复”。显式 doctor、只读报告、统一分诊、复核/发布状态和两类 deliver 继续绕过租约。

```bash
npm run content:author:doctor
npm run release:check
```

该命令先输出内容维护队列、当前作者工作区的 inbox 发布就绪状态、根暂存媒体库存和离线外链库存，并覆盖内容契约、Studio 配置、Obsidian 发布器、TypeScript、原生 Next.js 构建、生产 HTTP、安全头、全站内部链接、体积预算和生产依赖审计。inbox blocked 与外链 issue 都不会阻断未涉及它们的既有生产版本，但发布对应草稿前必须处理；报告不会执行任何发布或网络健康检查动作。

发布门还会结构化解析三份 GitHub workflow：它要求 checkout/setup-node 均为 v6，应用 Node 仍为 22，npm 缓存保持显式启用，并锁定 Quality 的 PR/main/每周/手动触发、production smoke 的 deployment-status/手动触发以及 rollback 的 manual-only 边界。若 GitHub 再提示 action runtime 弃用，先核对官方 action release 与 runner 要求，再升级 major；不要通过允许不安全 Node runtime 的环境变量压住 warning。

## 发布后检查

```bash
npm run production:smoke -- https://your-production.example --expect-oauth
```

必须验证：首页、集合、文章、项目、知识地图、搜索、RSS、robots、Sitemap 全部 URL、Studio HTML/配置/媒体清单/媒体预检/稳定 slug 控件/预览/固定版本运行时、OAuth 跳转、安全头、缓存和真实 404。首次上线或域名切换还需用未登录浏览器覆盖桌面、320px、深色和键盘路径。

## 故障等级

| 等级 | 示例 | 处理 |
| --- | --- | --- |
| P1 | 首页不可访问、全部 5xx、错误版本覆盖生产 | 立即 Vercel Instant Rollback，复核稳定域名 |
| P2 | Studio 无法登录、内容详情 404、Feed/搜索错误 | 暂停发布，回滚或修复后重跑完整冒烟 |
| P3 | 单篇格式、轻微视觉或非关键元数据问题 | 建 issue，正常修复提交 |

## 回滚

Vercel Hobby 默认可立即回到上一生产部署；更早的指定部署取决于套餐能力。优先在 Vercel Deployments 执行 Instant Rollback，或手动运行 GitHub Actions 的 `Roll back Vercel production`，填写上一条已验证的 deployment URL。回滚完成后工作流自动检查 `VERCEL_PRODUCTION_URL`。

路由恢复后，用 `git revert` 或新的修复提交使 `main` 与生产重新一致。若事故来自重定向，先确认回滚版本不会让已经公开的旧地址失去去向；必要时用新的单跳规则修复，而不是删除历史入口。禁止强制推送、`reset --hard` 或删除旧部署作为第一响应。

## 域名与可选能力

绑定自定义域名后，在 Vercel 设置中完成 DNS 验证并等待 HTTPS 生效，再重新检查 canonical、Open Graph、RSS 与 Sitemap。评论、统计、公开邮箱和数据库保持可选；只有真实需求出现时才增加运行时复杂度。
