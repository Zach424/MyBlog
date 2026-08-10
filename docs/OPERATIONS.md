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
7. Obsidian 1.41.0 在所有 Git 写入口前先校验运行代码/runtime manifest/磁盘插件版本、main/manifest/styles 的三份 bundle 摘要，以及 bundle/main/manifest/styles 的 Git HEAD/index/worktree provenance；兼容后，正常 `--push` 或两条可信恢复交付成功会校验 receipt/handoff、释放可能存在的作者事务并完成 Vault reconcile，再自动启动单篇生产等待。等待失败不改变已经完成的 Git 交付；Studio 与普通 Git 仍需手动运行“等待当前正式内容上线”；
8. Vercel 自动创建生产部署，deployment status 工作流检查稳定公开生产域名；
9. 打开首页、文章、`/subscribe`、公开内容清单、清单 Schema、JSON Feed、RSS、Sitemap 和 OpenSearch，确认新内容与五条公开读取通道可见且绝对 URL 指向当前生产域名；首页 `Guest · <n> public URLs · Sitemap synced` 的数字必须等于 Sitemap `<loc>` 数量，首页 `LATEST` 必须等于 Sitemap 根 URL 的 `lastmod`，且不能再出现手写 `REV. <数字>`；清单中的 `markdown_etag` 应与对应源文响应一致，`/content.json` 与 `/content.schema.json` 应通过 describedby/describes Link 双向关联，七个结构化端点应带最终正文 SHA-256 ETag 并支持空正文 304，首页应声明绝对 OpenSearch `rel="search"`。

## URL 迁移

已公开 slug 原则上保持不变。确需迁移时，在同一 Git 提交中移动内容与归档附件、修正所有引用，并把旧路径登记到 `content/redirects.yml`，直接指向最终公开 HTML 页面。每条记录必须填写迁移日期和原因；不要使用查询、锚点、通配参数、链式跳转，也不要覆盖现有页面、静态文件、`/_next`、`/api`、`/studio` 或 `/uploads`。

提交前运行 `npm run check`；上线后用 `curl -I https://<生产域名>/<旧路径>` 或完整生产冒烟确认状态为 308、`Location` 为同源最终地址、目标为 200。误配时回滚注册表和同一次迁移提交；若内容已在错误新地址短暂公开，保留所有曾公开地址并直接指向最终规范页面，避免制造新的链。

Current record 至少每 180 天逐项复核一次架构、版本、状态、外链和操作步骤；有事实变化时同步更新正文与 `updatedAt`，无变化时只更新 `reviewedAt`。Historical snapshot 不要求持续追新，但正文必须说明记录时间与当前去向。

每周 Quality Gate 会在周一 09:00（Asia/Shanghai）生成维护摘要；也可随时运行 `npm run content:status`。剩余 60/30 天分别进入“准备复核/即将到期”，warning 不阻断构建；越过最后有效日才失败。处理提醒时按报告清单逐项验证，不要只更新日期。

日常可先打开 `/studio/maintenance` 查看 Review Horizon 和全库优先级，再从 `Edit entry` 进入稳定条目。该页面的内容集合来自当前部署、日期按请求时的 `Asia/Shanghai` 当天推进；因此修改只有在新 Production 上线后可见，但无需为了日期变化重新部署。接口只返回已公开 Current 内容的最小元数据，不返回正文、源路径、草稿或 Historical。页面失败时先点 `Retry`，仍失败再运行 `npm run content:status` 并检查 `/studio/maintenance.json` 的 HTTP 状态；不要用手工改日期或缓存快照替代复核。

在本机 Vault 中也可从命令面板运行“查看已发布内容复核台账”。插件 1.30.0 先启动本地 `content:status --format json`，严格核对版本、计数、日期计算、状态阈值、排序、公开路由和精确来源路径，再显示四档期限轨迹与逐条记录；“打开笔记”只接受 Vault 中真实存在的 `content/posts|projects/<slug>.md`。报告命令因已过期内容返回退出码 1 时仍会解析并展示有效 JSON；JSON、schema、路径或 Modal 渲染异常时，插件会再运行纯文本 `content:status` 并以安全文本节点显示证据。两条路径都零网络、零日期/文件写入。Windows 报告子进程隐藏运行且不插入动态 shell 字符串，插件卸载时以固定 `taskkill.exe /T /F` 参数清理整棵命令进程树，POSIX 直接终止子进程。持续 Notice 若没有在命令终态消失，或插件关闭后仍存在 npm 进程，视为插件生命周期故障；笔记不存在时先确认文件已同步且路径大小写正确，再在终端运行 `npm run content:status` 取证。插件文件更新后，已打开的 Obsidian 需要重启或重新启用插件才能加载新版本。

正式内容复核使用 `npm run content:review -- content/posts|projects/<slug>.md --check-only`，确认后把最后一个参数改为 `--push`。命令只接受 `main` 上已经公开的 Current 文件：`publishedAt` 不得改变，`reviewedAt` 必须从固定 HEAD 推进到 `Asia/Shanghai` 当天；事实变化时 `updatedAt` 也必须是当天。暂存区必须完全为空，包括 `git add -N`；可以并行保留已修改/未跟踪的稳定 inbox 草稿，以及未跟踪的根暂存图片。已跟踪根图片修改、嵌套归档媒体、其他正式内容、代码、配置或未知路径会阻断。完整门前后都重算影响，并要求 HEAD 与目标原始 SHA-256 保持不变；push 只提交当前 Markdown，且 index/tree blob 必须对应门前经过 Git clean/filter 的同一候选，deferred 路径原样留在本地。MyBlog Publisher 1.30.0 严格验证 Proof v3 的 candidate 与 worktree 差集，再显示短指纹、路径和状态；结构或 UI 异常重新执行普通文本 check-only，命令失败不伪造 Proof。门失败保持未暂存；commit 前失败取消目标暂存；commit 后 tree 不匹配会原子撤回本地提交并保留工作区；已验证 commit 的 push 失败仍保留本地提交。

任何复核或新内容发布 push 失败后，不先猜提交类型：运行 `npm run content:delivery:status`，或 Obsidian 的“查看 Git 交付恢复”。该命令从同一份本地快照输出 version 1 只读分诊，明确 `networkChecked: false` 与 `autoExecuted: false`。`REVIEW / MATCHED` 或 `PUBLICATION / MATCHED` 只表示当前 commit 满足相应领域身份，下一步仍要单独运行界面列出的 status 命令复核完整证据，再由作者显式执行对应 deliver。`INSPECT / MATCHED`、behind、diverged、tracking-missing 或多提交 ahead 都不提供写命令；非 main 只显示类型和 status 命令，deliver 保持锁定。分诊不 fetch/push/rebase/reset，不修改 HEAD、index、worktree，也不会串联执行任何恢复动作。

push 失败后先运行 `npm run content:review:status`，或在 Obsidian 运行“查看待同步正式内容复核”。报告只读取本地 main 与 `refs/remotes/origin/main`，不访问网络；非同步状态返回 1 但仍输出完整证据。只有 ahead 1 / behind 0，且提交 subject、父级、唯一正式路径、tree/blob 都匹配，才允许运行 `npm run content:review:deliver -- --format json` 或命令面板的“重新同步待交付正式内容复核”。执行器会再次确认当前分支和完整 pending 身份，保存 index/worktree，然后运行普通非强制 `git push origin <verified-oid>:refs/heads/main`；OID 源关闭分支名解析竞态，远端的 fast-forward 规则继续阻止 unseen remote advance。成功后必须证明 local/tracking 都等于原 commit 且 HEAD/index/worktree 稳定，才返回 version 1 receipt；Obsidian 会额外请求 `--handoff`，从 receipt 的 commit blob 冻结目标，核对同一 commit 后 reconcile 并自动等待。否则按“push 可能已经完成”处理，重新运行只读状态，绝不自动重试。服务器拒绝、网络失败或状态漂移都保留本地提交；全程不 fetch/rebase/reset。普通 ahead、behind、diverged 或 tracking-missing 仍只提示人工检查 Git。

新内容发布的 push 失败与正式复核分开处理。先运行 `npm run content:publish:status`，或在 Obsidian 运行“查看待同步新内容发布”；报告只读本地 refs 与 HEAD commit，不 fetch、不 push、不写文件。只有 ahead 1 / behind 0，subject 为 `content: publish <slug>`，父级等于 tracking head，且 raw diff 精确等于一个新增正式 Markdown、可选同 slug inbox 删除和零到多个同 slug 归档媒体新增，才显示 `PUBLICATION HOLD / ATOMIC BUNDLE`、完整 Commit Envelope 与精确 OID refspec。确认后运行 `npm run content:publish:deliver -- --format json`，或命令面板的“重新同步待交付新内容发布”。执行器会再次验证 main、同一 commit/tree/全部 blob、完整 manifest 与 index/worktree，再运行普通非强制 OID push；远端 fast-forward 判定继续阻止 unseen remote advance。只有 push 后 local/tracking 同为原 commit，HEAD/index/worktree/manifest 全部稳定，才签发 version 1 receipt。Obsidian 额外请求 `--handoff`，从 receipt 的 target blob 冻结正式目标，核对 publication commit 后 reconcile 并自动等待。服务器拒绝、网络失败或状态漂移保留本地 envelope；成功但回执证据不足时重新查看只读状态，绝不自动重试。普通 ahead、复核提交、额外路径、修改旧媒体和多提交堆叠都不给恢复动作。不要手工恢复草稿或再次运行发布器；任何非 synchronized 状态会在读取源草稿前阻止第二次 `--push`。

外部链接使用 `npm run links:external` 做本地确定性库存；命令默认不访问网络并随 `release:check` 输出。需要现场证据时运行 `npm run links:external -- --check`，但 403/429、HEAD 不支持、5xx、超时和网络错误只进入人工复核，不能直接作为生产事故或默认构建失败。检查器不下载正文、不访问私网、不改写链接；若显式 `--fail-on-broken` 返回失败，先在普通浏览器复核确定 4xx 或坏重定向再修改内容。

本地图片必须是扩展名与真实格式一致的 PNG/JPEG/WebP/GIF/AVIF，单文件不超过 3 MiB，宽高各不超过 2560 px；大截图和照片优先导出为 AVIF/WebP。即使绕过 Studio/Obsidian 直接提交，Next 构建也会扫描全部 `public/uploads` 并阻止损坏或超预算媒体进入生产。

## 发布前检查

### 在 Obsidian 新建草稿

重启或重新启用 MyBlog Publisher 1.30.0 后，在命令面板运行“新建博客草稿”。选择技术文章、今日所学或项目记录，填写 1–120 字符的单行标题和最多 80 字符的小写 ASCII slug；slug 只能使用小写英文、数字和单个连字符。向导将读取精确的 `templates/obsidian/article.md`、`til.md` 或 `project.md`，验证固定 frontmatter/占位符后创建 `content/inbox/<slug>.md`，并写入 `Asia/Shanghai` 当天日期。文件名是唯一 slug 身份，模板不会再写 frontmatter `slug`。

向导不会从标题猜 slug，也不会覆盖 `content/inbox`、`content/posts` 或 `content/projects` 中的同名文件。若出现“模板漂移”，先比较模板是否仍保留唯一的空标题、三个日期 token、`draft: true`、`featured: false` 和类型特征行，并确认没有 `slug:` 或未知 Mustache token；不要绕过检查直接改插件。创建按钮双击只产生一次请求；若同步工具在检查后抢先产生文件，Vault 的排他创建仍会失败并保留现状。提示“草稿已创建，但无法自动打开”时，不要再次创建；按 Notice 中路径从文件列表打开。该命令不运行 doctor 或 npm，不发布、不提交、不联网；写完后仍需运行“检查当前草稿”。

### 在 Obsidian 重命名未发布草稿

保存当前 `content/inbox/<slug>.md` 后运行“重命名当前草稿”。该命令只支持桌面 Vault、精确小写 ASCII 文件名和 Markdown 扩展名；目标 slug 必须不同且不超过 80 字符。插件会在读取前和执行前检查 inbox/posts/projects，同步读取磁盘 frontmatter 并要求 `draft: true`、没有旧式顶层 `slug`，然后只调用一次 `FileManager.renameFile`。内容字节不改，内部链接更新按 Obsidian 设置执行；该动作不启动 npm、doctor、发布、Git 或网络。

多个改名弹窗同时提交时只有一个 lease 可以进入宿主 API。宿主拒绝或执行后无法证明旧路径消失、新路径存在时，Notice 会把结果标为不确定；此时先从文件列表检查两个精确路径，不要立即重试，也不要复制或删除文件。

### 在 Obsidian 检查和清理旧式草稿身份

活动文件仍在 `content/inbox/<safe-slug>.md` 时运行“检查当前草稿身份”。`READY / FILE OWNED` 表示文件名已经是唯一身份，不需要动作；`HOLD / CONFLICT` 会列出 YAML、draft 或正式命名空间原因，只能关闭；`LEGACY / MATCHED` 才会出现“移除冗余 slug”。确认 `FILE ⇄ FRONTMATTER` 两侧相同和 `DRAFT / INBOX / POST / PROJECT` ledger 后再点击。

清理只接受原始行精确为 `slug: <文件名>` 的 `draft: true` 草稿。带引号、注释、anchor/tag、缩进、重复键、非字符串、不匹配值，或 posts/projects 已有同名内容时不会自动修改。成功只删除该行；宿主拒绝、文件在检查后变化或后置字节无法证明时不会自动重试。重新运行身份检查取得新证据，不要连续点击或手工复制草稿。该动作不改文件名/正文其余字节，不运行 npm、doctor、Git、发布或网络。

### 在 Obsidian 快速核对当前草稿发布意图

活动文件精确位于 `content/inbox/<safe-slug>.md` 时运行“查看当前草稿发布意图”。插件会隐藏运行 `npm --silent run content:inbox -- --format json --source content/inbox/<safe-slug>.md`，从 version 5、`mode: read-only` 的单 entry 证据中核对当前冻结路径，并以 `DRAFT → PUBLIC` 显示目标，再列出 `TYPE / DATE / MEDIA / LINKS`。`MEDIA TRACE` 逐项给出 COVER/BODY、来源行、逐次 `ALT · L<n> · AUTHORED/FILENAME FALLBACK` 和真实媒体变换；`LINK TRACE` 给出 POST/PROJECT/SELF、最终公开路径、重复次数与每次 `REF · L<n>`。ALT 和 REF 都是原生导航按钮：点击会重新验证冻结/活动路径、原 `TFile`、Vault 映射和磁盘/编辑器行界，成功才打开精确行并关闭 Modal；任何漂移、越界或宿主错误都保留 Modal。整个 Modal 共用一个 single-flight，目标地址仍只读；导航不修复正文、不执行检查/发布/Git，也不联网。

这个摘要复用完整 inbox readiness 的类型、正式内容契约、共享源、媒体准备和站内链接判断，不在插件中解析 Markdown/YAML 或读取图片。链接 trace 来自同一次 AST 遍历和正式目标/标题验证循环；公开关系索引仍使用原投影。媒体用途/行号/正文 alt 在既有附件替换时直接聚合，coverAlt 来自已经通过 Zod 的正式 record；同一附件可以同时是 COVER 与 BODY，BODY 同行重复仍保留逐次行号和文本。空 alt 会生成同附件 blocker，插件要求空值与 blocker 双向对应。媒体 trace 继续消费现有 preparation，并交叉验证用途顺序、出现次数、行号/文本长度、路径、扩展名、格式、尺寸、帧数、字节差、保留稳定性与静态 WebP 不放大语义。聚焦模式仍轻量解析全部草稿并检查正式目标、附件存在/目标/Git 跟踪与共享所有权，但只为当前草稿执行真实媒体派生；全库命令不带 `--source`，继续为每篇草稿生成完整候选。JSON version/mode/safety、单 entry、计数、精确链接、路径、媒体包络、用途/alt 来源、状态日期或来源不一致时失败关闭；命令运行期间切换、改名或替换活动文件也拒绝打开。不要把它当成发布授权：`READY / PUBLIC ON PASS` 仍必须继续运行“检查当前草稿”；摘要不修改文件、不进入 author transaction lease、不 reconcile、不提交、不推送、不联网，也不会在失败时自动回退或重试。

环境或仓库位置发生变化后，可运行 `npm run content:author:doctor`，或在 Obsidian 运行“检查本机发布环境”单独诊断。默认文本的 15 项增强检查覆盖 Node/npm/Git、仓库根、main/upstream 本地同步、身份是否配置、package/关键脚本/全部固定依赖、内容路径、Vault、插件 1.41.0、三文件 bundle 摘要及四个插件路径的 Git provenance。attention 返回退出码 1 并给出修复指令，但不会自动执行；姓名、邮箱和凭据不进入报告。该命令不要求整个工作区为空，因为合法草稿、附件和待复核内容可能存在；provenance 只要求四个插件路径与 HEAD/index 一致。

插件 1.41.0 在“检查当前草稿”“发布当前草稿并同步 GitHub”“检查当前正式内容复核”“提交并同步当前正式内容复核”启动时自动运行同一 provenance version 3 JSON doctor，并冻结调用时的来源路径。ready 不弹出 doctor，直接且仅启动一次原领域命令；attention 显示 `TRANSACTION INTERLOCK / HELD` 和完整 circuit，原命令不启动；无效 JSON 改读纯文本但仍失败关闭，doctor 致命退出同样停止。“查看当前草稿发布意图”及其 ALT/REF 本地导航是独立只读交互，不占用这条事务租约。

进入任一 Git 写命令前，插件会把运行代码、runtime manifest 与磁盘 doctor 观察到的插件版本做严格三方比较。三者不相等时显示 `PLUGIN RELOAD REQUIRED` 与精确版本，不提供按钮，不自动重载，也不启动领域命令；关闭再启用插件或重启 Obsidian 后重新运行原命令。未来 patch/minor 磁盘版本仍按结构化报告显示，不退化成不可行动的纯文本。两条“重新同步待交付…”恢复命令在原租约之外先做一次 version-only doctor：非版本 attention 不影响已经需要恢复的 Git 交付，但版本身份缺失、证据不可信或版本漂移一律禁止恢复写入。

若显示 `PLUGIN BUNDLE INVALID`，先不要发布或恢复。运行 `npm run plugin:bundle` 只读复算；若你刚完成受控插件开发并确认 main/manifest/styles 都是同一 release，运行 `npm run plugin:bundle -- --write` 生成确定性 descriptor，再运行无 `--write` 版本验证。若不是受控开发现场，应重新同步或重新安装完整插件，不要用 `--write` 为未知文件背书。descriptor 不包含自身摘要；精确 schema、插件身份、固定三文件顺序和各文件 SHA-256 共同检测缺失、符号链接、局部更新、未知字段与内容漂移。

若显示 `PLUGIN PROVENANCE UNVERIFIED`，按 Modal 核对四个固定路径的 HEAD/INDEX、INDEX 状态和 WORKTREE 状态。受控开发完成后应通过正常 Git 工作流提交并同步全部四个路径，再关闭重启插件；意外漂移则先审阅 diff 并恢复正确版本。doctor 和插件只读观察，不会自动运行 `git add`、`commit`、`push`、`fetch` 或 `reset`。legacy JSON v1（13 项）与显式 `--plugin-bundle` v2（14 项）继续保留；1.41 插件固定请求 `--plugin-provenance` v3（15 项），默认文本也使用 v3。

四个新事务还共享一个 single-flight lease：从 doctor spawn 前持续到领域命令或诊断降级进程结算。运行“MyBlog Publisher: 查看当前作者事务”时，ACTIVE 依次显示操作、冻结来源路径、`前置检查 · PREFLIGHT` / `发布或复核 · DOMAIN` / `证据降级 · DIAGNOSTIC`、阶段进入时间/用时、owning child 最近一次 stdout/stderr 时间/静默时长，以及总开始时间/用时。本阶段还未产生输出时会明确显示“本阶段尚无输出”。租约占用时再次调用新事务不会排队或启动第二条链，而是用同一事实显示 `AUTHOR TRANSACTION / BUSY` 和等待建议。阶段转换和 child ownership 转交都会重置输出活动；旧 child 的迟到 stdout/stderr/close/error 不能更新或释放后来 owner，即使输出正文达到捕获上限，活动时间仍可更新。时钟回拨产生的 duration 钳制为零。所有时间都只用于观察，不代表 healthy/stuck/timeout，也不会触发 watchdog、取消或重试。

租约结算后再次运行状态命令，会显示 `AUTHOR TRANSACTION / IDLE · LAST RECEIPT`。结果只有 `COMPLETED / HELD / COMMAND FAILED / START FAILED / RESULT FAILED / UNLOADED` 六类，并列出原操作、冻结来源、最终阶段、UTC 开始/结束与总用时。成功回调若把 ownership 转给 domain 或 diagnostic child，旧 child 的 finally 不会生成回执；只有最终 owner 结算才覆盖上一条。新事务运行期间 ACTIVE 始终优先。回执只在当前插件实例内保留一条，不存输出正文、错误文本或退出码，不写 Vault/Obsidian 配置；重启或重新启用插件后清空。它不执行重试、恢复、push 或下一步命令；具体失败仍看终态 Notice，push 不确定仍先运行“查看 Git 交付恢复”。显式 doctor、只读报告、统一分诊、复核/发布状态和两类 deliver 继续绕过租约。

```bash
npm run content:author:doctor
npm run release:check
```

该命令先输出内容维护队列、当前作者工作区的 inbox 发布就绪状态、根暂存媒体库存和离线外链库存，并覆盖内容契约、Studio 配置、Obsidian 发布器、TypeScript、原生 Next.js 构建、生产 HTTP、安全头、全站内部链接、体积预算和生产依赖审计。inbox blocked 与外链 issue 都不会阻断未涉及它们的既有生产版本，但发布对应草稿前必须处理；报告不会执行任何发布或网络健康检查动作。

发布门还会结构化解析三份 GitHub workflow：它要求 checkout/setup-node 均为 v6，应用 Node 仍为 22，npm 缓存保持显式启用，并锁定 Quality 的 PR/main/每周/手动触发、production smoke 的 deployment-status/手动触发以及 rollback 的 manual-only 边界。若 GitHub 再提示 action runtime 弃用，先核对官方 action release 与 runner 要求，再升级 major；不要通过允许不安全 Node runtime 的环境变量压住 warning。

## 发布后检查

作者只需要判断本地正式内容是否已经到达稳定生产站时，运行：

```bash
npm run content:production
npm run content:production -- --format json
npm run content:production:wait -- --source content/projects/myblog.md
```

该命令受限读取真实 `/content.json`，以本地相同 origin 的公开投影逐项比较 id、Markdown ETag 与清单元数据，并报告 deployed、pending、missing、unexpected。有效报告不代表执行过部署；它只证明特定响应 ETag/Last-Modified 快照与本地内容的关系。网络超时、重定向、非 200、MIME/体积/JSON/schema 错误会以非零退出，且不会转成内容漂移。默认不因有效 drift 返回非零；需要脚本门时显式增加 `--fail-on-drift`。命令不写文件、不提交、不推送，有意不进入 `release:check` 或 Actions，避免把临时网络状态变成本地发布硬门。

`content:production:wait` 只等待 `--source` 指定的一篇正式文章或项目。启动时冻结来源原始 SHA-256 和本地公开 ETag；默认最多等待 180 秒、每 5 秒一次、单请求最多 10 秒，并在后续请求发送 `If-None-Match`。pending/missing 继续等待；deployed 返回 0；到时仍未收敛返回 2；来源漂移、unexpected、网络或协议失败返回 1；取消返回 130。JSON 模式把逐次进度写到 stderr、最终 version 1 回执写到 stdout，适合 Obsidian 严格解析。等待过程只读且不会提交、推送或触发部署。

自动接力时，正常发布/复核与两条 recovery deliver 都额外请求一条 version 1 post-delivery handoff。它必须是 stdout 唯一最后证据行，并同时证明 Git commit 已送达、生产尚未检查、等待尚未开始；恢复输出在它之前保留完整 JSON sealed receipt，并从 receipt 固定的 commit blob 派生目标。插件严格核对 receipt、schema、两者 commit、交付类型、inbox/formal slug、最终来源与冻结摘要；无效或迟到证据不 reconcile、不等待。可信证据也要等可能存在的 author transaction lease 释放和 Vault reconcile 完成后才启动等待；reconcile 期间卸载插件不会留下新子进程。任何后续失败只报告生产取证未完成，不再执行 Git；手动等待始终保留。

若终端能访问生产站而 Obsidian 子进程不能，先确认 Obsidian 继承了系统代理环境。Node 24 使用 `HTTP_PROXY`/`HTTPS_PROXY` 时还需要设置 `NODE_USE_ENV_PROXY=1` 后完整重启 Obsidian；不要把代理地址、令牌或凭据写进仓库。代理、DNS 或 CDN 暂时不可用只表示本次取证失败，不应通过扩大时限掩盖协议问题。

```bash
npm run production:smoke -- https://your-production.example --expect-oauth
```

必须验证：首页、集合、文章、项目、时间档案、订阅目录、知识地图、搜索、OpenSearch、公开内容清单及 Schema、JSON Feed、RSS、robots、Sitemap 全部 URL、文章/项目 Markdown 源文、Studio HTML/配置/媒体清单/媒体预检/稳定 slug 控件/预览/固定版本运行时、OAuth 跳转、安全头、缓存和真实 404；清单、JSON Feed 与 RSS 要保持同一公开 URL 顺序，根页面必须包含实际生产 origin 的清单/Feed/OpenSearch 发现链接。OpenSearch 必须验证 1.1 namespace、唯一必填元素、同源 results/self URL、安全 `{searchTerms}` 模板、示例查询、语言/编码、MIME、文件名、`noindex`、SHA-256 ETag、等价缓存与空 304，且不进入 Sitemap。清单必须验证 version 1、字段 allowlist、绝对 HTML/Markdown URL、每项强 SHA-256 `markdown_etag`、全部真实源文强弱等价、MIME、文件名、self/describedby/up Link、`noindex`、Last-Modified、Vercel 等价缓存与空 304；Schema 必须验证 Draft 2020-12、同源 `$id`、结构关键字、MIME、文件名、self/describes/up Link、`noindex`、SHA-256 ETag、等价缓存与空 304。JSON Feed、RSS、Sitemap、robots 与 OpenSearch 必须验证最终正文 SHA-256 ETag，以及携带源响应标签时同 digest、同缓存策略、空正文的 304；除 robots 外均保留一小时 fresh，robots 保留一天 fresh。源文必须验证详情页 alternate/可见入口、公开 frontmatter、绝对链接/媒体、MIME、文件名、canonical、`noindex`、Vercel 等价缓存、SHA-256 ETag、Last-Modified、携带响应 ETag 的空 304，以及未知 slug 的 `no-store` 404。生产响应允许 Brotli CDN 把强标签弱化并精简 304 metadata，但强/弱 opaque digest 必须相同，Cache-Control 必须安全，仍存在的日期/链接/robots 不能漂移。命令会为十二条关键 HTML 路由输出实际生产域名下的 raw/gzip、阈值、基线与余量，任何漏测、重复或超限都会失败。首次上线或域名切换还需用未登录浏览器覆盖桌面、390px、深色和键盘路径；域名变化后必须重新核对 manifest/schema/Feed/OpenSearch/source URL、验证器、预算 origin 与真实生产基线，不能沿用替代主机的假绿。

Iteration 0110 起，关键 HTML 覆盖由九条增为十条，新增 `/archive`。该路由必须返回 200、使用 `/archive` canonical、出现在 Sitemap 与主导航中，并以可见 HTML 混排 Article、TIL 与 Project；检查真实 `<time>`、类型、标题和条目数，不把 RSC 载荷当作页面证据。稳定生产基线绑定功能提交 `49e92a61`，档案页为 20374/4742 B（raw/gzip），Sitemap 同批次为 4703/512 B。

Iteration 0111 起，关键 HTML 覆盖由十条增为十一条，新增 `/subscribe`。该路由必须返回 200、使用 `/subscribe` canonical、出现在 Sitemap 与页脚，并以可见 HTML 恰好列出五条只读通道；逐项检查真实端点链接、MIME、Freshness、最新 Markdown 示例与“这些接口只负责读取”边界。稳定生产基线绑定功能提交 `5ab34a7`，订阅页为 29108/5727 B（raw/gzip），Sitemap 同批次为 4882/524 B、26 URLs。

Iteration 0112 起，关键 HTML 覆盖由十一条增为十二条，新增固定 `/definitely-missing`。它必须返回 404、`no-store`、至少一个 `robots=noindex`、单一 H1 和搜索/档案/文章/项目四条恢复链接，不得自动跳转、输出 BreadcrumbList 或内容身份。稳定生产基线绑定修复提交 `c2e1d968`，404 为 25370/4459 B（raw/gzip）；全部十二条同批生产响应统一重测，预算实现提交为 `928c0bf`。随机未知路由仍可用于状态抽查，但不能用作体积基线，因为请求路径会进入 RSC 载荷。

Iteration 0113 起，首页运行事实与 Sitemap 使用 `lib/public-routes.ts` 的同一清单。发布后除完整 smoke 外，应直接核对首页公开 URL 数量、Sitemap `<loc>` 数量和根 `lastmod`；新增可索引静态页面必须登记 `STATIC_PUBLIC_ROUTE_FACTS`，文章、项目、专题和标签由公开索引自动加入。协议、Studio、OAuth、404 与其他 noindex 端点不得为了“总数更大”而进入该清单。功能提交 `28449b9` 的稳定生产 smoke 为 26 routes、OAuth 302；首页 32048/6866 B、Sitemap 4882/524 B（raw/gzip），均继续使用既有预算，无需重建基线。

搜索路径还要分别核对 `/search?q=cloudflare`、`/search?q=Wrangler` 与 `/search?q=B_i`：第一条必须出现可见命中 mark、来源和字段原因，第二条必须只有 1 条正文证据，第三条必须显示 0 条且不存在 mark。不要用 HTML 内 RSC 序列化的完整搜索文档冒充可见结果；生产 smoke 以真实 `<mark class="search-hit">`、来源标签和结果计数作为证据。

继续阅读路径要核对代表文章恰有 2 个、代表项目恰有 3 个真实 `<a class="content-recommendation">`，并包含“当前记录引用”“引用当前记录”“同专题”或“共同标签”等实际理由。不要用 RSC 数据中的标题或推荐对象冒充可点击结果；链接数量、`Continue trace` 标题和理由必须都来自服务端可见 HTML。推荐变化属于关键 HTML 增长，部署后先观察文章/项目 raw-gzip 余量，再用同一提交的稳定生产响应更新有来源基线。

结构化面包屑要核对文章、项目、专题、标签四条代表详情：每页可见路径与唯一 `BreadcrumbList` 的名称、顺序和 URL 必须逐级完全一致，`position` 从 1 连续递增，`item` 必须使用本次冒烟传入的真实 origin。四类随机未知 slug 必须返回 404 且不包含 `BreadcrumbList`。只解析真实 `<nav aria-label="面包屑">` 和 `application/ld+json` script，不得把 RSC 序列化载荷里的字符串当成可见或机器语义。自动门证明页面契约，不保证搜索引擎一定展示富媒体结果；重要结构变化上线前可再用 Google Rich Results Test 或 Schema Markup Validator 抽查。

首页站点身份要核对根页面恰有一个 `WebSite`，`@id` 为实际生产根地址加 `#website`，`name`、`description`、`inLanguage` 与站点事实一致，`url` 为本次冒烟 origin 的规范根地址；代表集合、详情、搜索、地图和关于页必须全部没有 `WebSite`。不得为了字段丰富度添加未经确认的 `alternateName` 或 `SearchAction`。Google Rich Results Test 不支持站点名称，发布前人工语法抽查使用 Schema Markup Validator；自动门和人工语法通过都不代表搜索引擎一定采用该站点名。

内容身份还要核对代表文章的 `BlogPosting` 与代表项目的 `SoftwareSourceCode` 各恰好一个，`@id` 分别是实际生产 canonical 加 `#content`，`url` 与文章 `mainEntityOfPage` 不漂移，`isPartOf` 只含同一生产根 `#website` 引用，非首页不重复完整 `WebSite`；标题、描述、日期、语言、标签、图片、作者、仓库和技术栈也必须来自纯生成器的既有字段。代表文章还必须输出 `wordCount: 899` 与 `timeRequired: PT4M`，并与页面可见“4 min”使用同一内容记录；项目不得出现这两个 Article 字段。未知文章/项目必须 404 且没有两类内容文档。有意新增机器字段时需在稳定生产重测 HTML 基线；自定义域名启用时，这些 ID 与引用必须和主页、canonical、Feed、清单一起重新测量，不能继续沿用 Vercel 域名。

同一命令还会为清单、Schema、JSON Feed、RSS、Sitemap、robots 与 OpenSearch 输出 `[discovery-budget]` 七行 raw/gzip 证据。任一路由缺失、重复、超出自己的冻结上限都会阻止冒烟；不要通过删除检查或自动采用当前输出解决失败。若增长是一次有意的内容/协议变化，先核对实际正文与公开集合，再在稳定生产重新测量七端点，同时更新基线数值、日期、来源提交、测试和迭代归档。域名变化会改变绝对 URL 和正文大小，必须以新稳定 origin 重新建立有来源基线。

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
