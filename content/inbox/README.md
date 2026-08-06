# Obsidian 写作收件箱

这里保存尚未进入博客构建的本地草稿。推荐先在 Obsidian 命令面板运行 `MyBlog Publisher: 新建博客草稿`：选择 Article、TIL 或 Project，填写标题和稳定小写 ASCII slug；插件 1.30.0 会从对应的 `templates/obsidian/*.md` 受信模板创建 `content/inbox/<slug>.md`、写入上海当天日期并立即打开。文件名是 inbox 草稿唯一的 slug 身份，frontmatter 不再重复保存 `slug`。向导只创建一个本地 Markdown；不会发布、提交或联网。

向导会在读取模板前和原子创建前分别检查同 slug 的 inbox、posts、projects；模板缺失、占位符/关键字段漂移、非法输入和任何路径碰撞都会停止且不覆盖文件。若文件已经创建但 Obsidian 无法自动打开，它会保留草稿并显示精确路径，避免删除作者刚得到的内容。手工新建仍可使用同一模板；不要重新加入 frontmatter `slug`，发布器会从安全文件名派生正式身份。

完成标题、摘要、标签和正文后，在 Obsidian 命令面板运行：

- `MyBlog Publisher: 查看全部草稿发布就绪状态`：在只读弹窗中列出 ready、scheduled、blocked、目标路径、附件派生和阻塞原因；
- `MyBlog Publisher: 新建博客草稿`：从三类受信模板原子创建并打开一个 inbox 草稿；不覆盖、不发布、不提交、不联网；
- `MyBlog Publisher: 重命名当前草稿`：只在桌面端活动的安全 inbox Markdown 上出现；确认新 slug 后仅通过 Obsidian FileManager 改文件名，不改正文、不发布、不提交、不联网；
- `MyBlog Publisher: 检查当前草稿身份`：只读核对文件名、旧 slug、draft 与正式命名空间；仅完全匹配时允许用 Vault 单文件原子清理一条冗余字段；
- `MyBlog Publisher: 查看当前草稿发布意图`：复用版本化 inbox evidence，只读显示 Article/TIL/Project、公开目标、NOW/SCHEDULED、精确媒体变换、站内目标/源码行/重复次数和阻塞原因；
- `MyBlog Publisher: 检查本机发布环境`：独立查看 Runtime、Git、Workspace 与 Vault 共 13 项前置条件；只给修复指令，不自动修改；
- `MyBlog Publisher: 检查当前草稿`：先自动执行同一环境联锁，ready 才只读验证草稿，不移动、不提交；
- `MyBlog Publisher: 查看 Git 交付恢复`：任何 push 失败后首先运行；它从同一份本地 Git 快照把现场分到复核、新内容发布或人工检查，只显示既有后续命令；
- `MyBlog Publisher: 查看待同步新内容发布`：只读比较本地 `main` 与最后观察到的 `origin/main`，识别由正式笔记、可选 inbox 删除和归档媒体组成的精确原子发布包；
- `MyBlog Publisher: 重新同步待交付新内容发布`：只对再次验证的精确发布 Commit Envelope 执行非强制 OID refspec push；成功后显示 sealed receipt，失败保留本地提交；
- `MyBlog Publisher: 发布当前草稿并同步 GitHub`：先自动执行环境联锁，ready 才关闭草稿、移动到正式内容目录、执行全量检查、提交并推送。

命令行等价总览为 `npm run content:inbox`；JSON 证据使用 `npm run content:inbox -- --format json`。只查看一篇的结构化证据可用 `npm run content:inbox -- --format json --source content/inbox/<slug>.md`；它仍扫描跨草稿轻量事实，但只派生目标媒体。两种模式都不会移动、改写、提交或推送作者文件。

草稿写作中途需要改变身份时，先保存笔记，再运行“重命名当前草稿”。新 slug 必须不同、最多 80 字符并符合小写 ASCII kebab-case；插件会在读取前和执行前检查 inbox、posts、projects 三个命名空间，读取磁盘正文并确认 `draft: true`，再调用一次 Obsidian `FileManager.renameFile`。正文内容保持逐字节不变，内部链接是否随文件改名更新服从 Obsidian 的链接设置。旧模板创建、仍带顶层 frontmatter `slug` 的草稿先运行“检查当前草稿身份”：常规/冲突状态只读，只有 `slug: <文件名>` 完全匹配且没有正式碰撞时才可原子删除一行；格式歧义或结果不确定时不自动重试。若宿主拒绝改名或无法证明旧路径消失且新路径精确存在，插件只提示同时检查两个路径，不自动重试或回滚。

写完一轮正文后先运行“查看当前草稿发布意图”。`DRAFT → PUBLIC` 与 `TYPE / DATE / MEDIA / LINKS` 来自同一正式发布解析和 inbox readiness，不是插件内的第二套 Markdown/YAML 规则。1.30.0 的 `MEDIA TRACE` 逐项显示 COVER/BODY、出现次数、草稿行号、`ALT · L<n> · AUTHORED/FILENAME FALLBACK` 最终替代文本和真实媒体变换；空文本或文件名回退继续以 `WILL FAIL` 阻塞。`LINK TRACE` 按首次出现顺序显示 POST/PROJECT/SELF、最终公开目标和重复次数，并把每次来源展开为 `REF · L<n>`。插件把当前路径作为 `--source` 传给 version 5 报告：仍轻量解析全部草稿以保留共享附件、正式目标和媒体路径判断，只为当前草稿生成真实媒体候选，再返回唯一 entry。正文 alt/来源由既有 Wiki/Markdown 归一化回调登记，cover alt 读取正式 Zod 结果；媒体和链接 trace 都只消费正式解析证据。默认全库报告仍完整派生每篇草稿。报告 JSON、安全声明、单 entry、计数、媒体包络、用途/行号/alt/来源、链接类型/目标/行号、路径或活动 `TFile` 漂移时失败关闭，不回退、不重试。每个 ALT 与 REF 标签都是本地导航按钮：点击时重新验证冻结/活动路径、同一 Vault `TFile` 与磁盘/编辑器行界，成功才打开精确行并关闭 Modal；失败保留 Modal，整个页面的重复点击只执行一次。该动作不会修改、检查、发布、提交、推送或联网；`READY / PUBLIC ON PASS` 后仍需单独运行“检查当前草稿”。

首次使用、升级 Node/Git、重新安装依赖、移动仓库或更新插件后，先运行 `npm run content:author:doctor`，或命令面板的“检查本机发布环境”。version 1 报告固定检查 Node/npm/Git、仓库根、main、origin/main 本地同步基线、Git 身份是否配置、package/脚本/固定依赖、内容目录、Vault 与 MyBlog Publisher 版本。它只输出身份是否配置，不泄露姓名或邮箱；不会安装依赖、修改 Git/Obsidian 配置、读取凭据、访问网络或要求工作区为空，也不替代单篇发布门和 `release:check`。

MyBlog Publisher 1.30.0 会在“检查当前草稿”“发布当前草稿并同步 GitHub”“检查当前正式内容复核”“提交并同步当前正式内容复核”真正启动前自动运行同一 JSON doctor，并用一个 single-flight lease 串行化四类新事务。租约从 doctor 启动跨越领域命令与诊断降级，直到成功、失败或 spawn error 才释放；占用期间再次调用只显示同一只读快照，不启动第二个进程链。运行“查看当前作者事务”可在 active 时查看操作、冻结路径、`preflight / domain / diagnostic` 阶段、阶段进入时间/用时、owning child 最近一次 stdout/stderr 时间、静默时长以及总开始时间/用时；BUSY 使用完全相同的事实。事务结算后，同一命令会在 `IDLE · LAST RECEIPT` 中显示本插件会话最近一条操作、来源、最终阶段、开始/结束/总用时，以及 completed、held、command-failed、start-failed、result-failed 或 unloaded 终态。只有当前 lease/child 能覆盖回执，旧事件无权改写；新事务 active 时优先显示实时快照。回执不保存输出正文、不写磁盘，重载插件即清除，也不会自动重试、恢复或 push。attention 仍打开 `TRANSACTION INTERLOCK / HELD`；当前草稿作者意图及其 ALT/REF 本地导航、其他只读状态、统一分诊和两类待交付重送继续绕过租约。

任何发布或正式复核 push 失败后，统一先运行 `npm run content:delivery:status`，或命令面板的“查看 Git 交付恢复”。它只读取一次本地 `main`、最后观察到的 `origin/main` 和 HEAD，把现场严格分为 synchronized、exact pending-review、exact pending-publication 或 inspect；不会 fetch、push、运行 status/deliver，也不会修改历史或工作区。只有 exact route 才会列出对应的既有 status 与 deliver 命令；当前分支不是 `main` 时仍可识别类型，但会保持写入锁定。

新内容 push 失败后不要恢复草稿或再次发布。统一分诊显示 `PUBLICATION / MATCHED` 后，再运行 `npm run content:publish:status` 或命令面板的“查看待同步新内容发布”。只有本地 main 精确领先一个 `content: publish <slug>`，且父级、正式新增 Markdown、可选已跟踪 inbox 删除、全部归档媒体和 blob 都匹配时，才会显示 `PENDING / ATOMIC BUNDLE` 与精确 OID refspec。确认后运行 `npm run content:publish:deliver -- --format json` 或“重新同步待交付新内容发布”；命令会再次验证 main、完整 manifest 和 index/worktree，只推送已验证 OID。服务器拒绝、远端抢先推进或状态漂移都会保留本地 envelope；只有引用对齐且 HEAD/index/worktree/manifest 稳定才显示可信回执。任何非 synchronized 状态都会在读取源草稿前阻止第二次 `--push`。状态报告不 fetch、不 push、不改历史；deliver 不 fetch/rebase/reset、不强推、不自动重试。

维护已发布 Current 内容时，先从“查看已发布内容复核台账”打开正式笔记，按清单人工核对。无事实变化只把 `reviewedAt` 推进到当天；正文或元数据变化还要把 `updatedAt` 更新到当天。随后运行：

- `MyBlog Publisher: 查看待同步正式内容复核`：只读比较本地 `main` 与最后观察到的 `origin/main`，识别 push 失败后保留的精确复核提交；不 fetch、不 push、不改历史；
- `MyBlog Publisher: 重新同步待交付正式内容复核`：只对刚刚再次验证的精确复核 commit 执行非强制 OID refspec push；成功后显示 sealed receipt，失败保留本地提交；
- `MyBlog Publisher: 检查当前正式内容复核`：执行完整仓库门，然后用只读 Author Proof 显示 HEAD/当前日期、事实变化、质量门、候选内容短指纹和唯一提交范围；不暂存、不提交；
- `MyBlog Publisher: 提交并同步当前正式内容复核`：门禁通过后只提交当前正式 Markdown 并推送 `main`。

该流程要求暂存区（包括 intent-to-add）为空，且同一天不能重复声明复核。可以同时保留稳定的 `content/inbox/<slug>.md` 草稿和未跟踪的根 `public/uploads/<图片>`；它们会在 Proof 中标为 deferred，不进入本次提交。已跟踪根附件修改、嵌套归档媒体、其他正式内容、代码或未知路径仍阻断。命令行等价入口为 `npm run content:review -- content/posts|projects/<slug>.md --check-only|--push`；机器可读证据在 check-only 后增加 `--format json`。Proof v3 的 SHA-256 绑定质量门前后原始字节，push 还核对 Git clean/filter 后的 index 与提交 tree；长检查期间修改目标或移动 HEAD 都会失败关闭。push 失败后由统一分诊确认 `REVIEW / MATCHED`，再运行 `npm run content:review:status`；只有本地 main 正好领先本地 tracking ref 一个 `content: review <slug>`、父级/唯一路径/tree/blob 都匹配时才允许 `npm run content:review:deliver -- --format json`。恢复命令使用 `git push origin <verified-oid>:refs/heads/main`，不 fetch/rebase/reset；服务器拒绝、分支或状态漂移都不会覆盖本地提交。任何非 synchronized 状态都会阻止创建第二个复核提交。结构化证据或成功回执异常时插件不会自动重试，也不会显示半可信的已交付状态。

此 README 不参与博客构建。详细流程见 `docs/PUBLISHING.md`。
