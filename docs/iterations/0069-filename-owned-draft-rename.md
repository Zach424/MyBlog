# Iteration 0069 · 文件名唯一的未发布草稿安全改名

日期：2026-08-06
状态：完成
唯一主任务：让作者在不依赖 Codex、终端或云服务的情况下，从 Obsidian 安全改变一个尚未发布的 inbox 草稿身份，并消除文件名与 frontmatter slug 的双字段漂移。

## 全局复核与范围

Iteration 0068 已把草稿起点收敛为三个受信模板和一次 Vault 排他创建，但模板仍把同一 slug 同时写进文件名与 frontmatter。改名因此天然需要同步两个字段；任何一步失败都可能留下“文件名指向 A、frontmatter 指向 B”的半迁移。发布转换的既有事实证明 `prepareObsidianNote` 已从 `content/inbox/<slug>.md` 派生目标身份，正式内容 schema 也允许省略 frontmatter slug，因此本轮先删除冗余字段，再把改名缩成宿主的一次文件操作。

明确不做：

- 不改正式 `content/posts` / `content/projects` 的公开 slug、附件目录、引用或 redirect 注册表；
- 不修改草稿正文、frontmatter 日期、标题、类型、附件或 Git 状态；
- 不自动清理旧式草稿中的 frontmatter `slug`，避免把两字段迁移重新塞进改名事务；
- 不在宿主结果不确定时自动重试、复制、删除、回滚或猜测哪条路径正确；
- 不启动 npm、doctor、发布脚本，不暂存、提交、推送或访问网络；
- 不把单一身份转换扩张成文件浏览器、草稿后台、历史列表或迁移仪表盘；
- 不修改 Next.js 源码，因此本轮按 `AGENTS.md` 无需读取 `node_modules/next/dist/docs/` 编码指南；
- 不依赖真实 Obsidian 宿主手工验收、云 API 或新的外部集成；宿主像素与链接设置差异保留为观察风险。

## 项目结构状态

功能提交触及十个文件：

- `.obsidian/plugins/myblog-publisher/main.js`：插件契约升到 1.20.0；增加精确活动草稿识别、改名 Modal、输入/磁盘 frontmatter/路径验证、改名 lease、一次 FileManager 调用和后置状态分类；创建模板渲染改为拒绝重复 slug；
- `.obsidian/plugins/myblog-publisher/styles.css`：增加唯一 `.myblog-draft-rename` 作用域与 CURRENT → TARGET 身份轨迹；
- `.obsidian/plugins/myblog-publisher/manifest.json`：版本升到 1.20.0，最低 Obsidian 版本升到 1.5.7，并同步能力描述；
- `templates/obsidian/article.md`、`til.md`、`project.md`：删除 `slug: "{{title}}"`，文件名成为 inbox 草稿唯一身份；
- `lib/content/author-doctor.ts`：doctor 期望插件版本同步到 1.20.0；13 项报告 schema 与只读安全语义不变；
- `tests/obsidian-plugin.test.mjs`：Vault 桩增加 `TFile`、直接 read、FileManager rename、内容/文件映射与失败后置状态；增加创建无 slug、改名正向、命令范围、输入/碰撞、frontmatter、并发和不确定结果合同；
- `tests/obsidian-publishing.test.mjs`：证明无 frontmatter slug 的文件名身份草稿仍能进入正式发布转换，并静态锁定原生 API 边界；
- `tests/author-doctor.test.mjs`：同步 1.20.0 夹具。

归档提交更新 `content/inbox/README.md`、`content/projects/myblog.md`、`docs/STATUS.md`、`ROADMAP.md`、`DESIGN.md`、`ARCHITECTURE.md`、`OPERATIONS.md`、`PUBLISHING.md` 和本文件。仓库根仍是 Obsidian Vault；GitHub 仍是公开内容、附件、版本与回滚的唯一事实源；生产仍为 Vercel 原生 Next.js，不依赖 Cloudflare。

## 设计内容

使用 `frontend-design` 的影响是让改名只表达一次身份转换：

- 顶部按 `DRAFT IDENTITY / FILE OWNED` → “重命名当前草稿” → 操作边界排列；
- 边界文案明确只改变 inbox 文件名、内部链接服从 Obsidian 设置、不会发布/提交/联网；
- 当前精确路径独立展示，唯一视觉签名为 `CURRENT → TARGET`，实时目标来自作者输入；
- 输入区只有新的英文 slug、规则提示和同一 `role=alert` 错误区；
- 底部只有取消和“重命名草稿”，提交时禁用本 Modal 的输入与按钮；
- 成功只显示新路径；宿主结果不确定时同时显示旧路径、新路径和“不自动重试”；
- 继续复用 Obsidian text/interface/monospace、Trace 规则线与 Signal 箭头；没有卡片、阴影、渐变、图标、动画、步骤条、回滚按钮或虚构进度。

## 技术与实现方法

### 文件名唯一身份

新建向导仍让作者明确填写小写 ASCII slug，但它只决定 `content/inbox/<slug>.md`。三个模板不再包含 frontmatter `slug`，渲染器也主动拒绝任何 `^slug\s*:` 漂移。发布器已从 inbox 文件名派生 `slug` 与正式路径；新增回归证明删掉冗余字段后仍得到相同的 `content/posts|projects/<slug>.md`，且 `draft` 正常变为 false。Studio 的正式条目 slug 控件属于另一条网页编辑链，本轮没有修改。

### 命令范围与前置合同

“重命名当前草稿”只在以下条件同时成立时出现：

- 桌面 Vault；
- 活动对象是 Obsidian `TFile`；
- 路径精确匹配 `content/inbox/([a-z0-9]+(?:-[a-z0-9]+)*)\.md`；
- 扩展名精确为 `md`。

目标 slug 不做 trim、大小写转换或字符删除；空值、超过 80 字符、非小写 kebab-case 或与当前值相同都在任何异步读取前拒绝。同一目标在 `content/inbox`、`content/posts`、`content/projects` 任一路径存在也在读取前拒绝。

### 磁盘证据与宿主写边界

插件对固定来源 `TFile` 调用 `vault.read`，而不是使用可能返回缓存内容的 `cachedRead`，因为改名前必须观察直接磁盘 frontmatter。`getFrontMatterInfo` 确认边界，`parseYaml` 要求顶层为映射、`draft === true` 且没有自有 `slug` 属性。异步读取后再次检查三命名空间，并确认来源路径仍映射到同一个 `TFile` 对象。

满足前置条件后只调用一次 `app.fileManager.renameFile(file, targetPath)`。FileManager 是 Obsidian 为安全移动/改名及按作者设置更新内部链接提供的上层 API；插件不直接调用 Adapter，也不手工重写链接。调用完成后必须同时证明旧路径返回 null、目标路径返回精确 `TFile`。只有这组后置证据成立才返回 `renamed`。

### 并发与不确定结果

每个 Modal 在首个 await 前设置同步 `submitting` guard，防止同一按钮双击。插件另有独立 `draftRenameLease`：输入与第一轮碰撞通过后同步占用，直到读取、改名和后置观察完成；第二个 Modal 立即得到“另一个草稿改名正在进行”，不会排队或进入 FileManager。它不复用发布/复核的 author transaction lease，因为改名没有子进程、doctor 或 Git 领域阶段。

FileManager 抛错不等于文件一定未移动，调用成功也不等于测试环境能证明宿主状态。因此两种情况都可以收敛为 `uncertain`：Modal 关闭、Notice 保留旧/新路径和禁止自动重试说明，lease 正常释放。插件不尝试反向 rename，因为第一次动作可能已经完成；自动回滚反而可能把链接和路径再改一次。

## 实现功能

- 新草稿只在文件名保存 slug，模板与渲染结果不再产生重复 frontmatter 字段；
- 命令面板新增 `MyBlog Publisher: 重命名当前草稿`；
- 命令只对精确桌面 inbox Markdown 开放，正式内容、危险文件名、非 Markdown 与移动端不出现；
- 新 slug 的字符、长度、不同值和三个内容命名空间在读取前验证；
- 直接磁盘 frontmatter 缺失、YAML 无效、非 draft 或旧式 slug 都在 FileManager 前失败；
- 执行前再次检查碰撞和来源对象，缩小异步竞态窗口；
- 成功只改变路径，正文内容逐字节保持不变；
- 内部链接更新交由 Obsidian FileManager 与作者设置；
- 同一 Modal 双击与多个 Modal 并发均不会产生第二次 rename；
- 宿主拒绝或后置条件无法证明时不重试，并明确要求检查两个路径；
- 全流程没有 child process、Git、发布或网络副作用。

## 失败优先与验证证据

`research-iteration-loop` 让本轮保持“一条草稿身份链路、先失败证据、定向回归、真实 doctor、两次完整门、功能/归档分提交”的节奏。

失败优先基线：

- 扩展测试桩、更新创建期望并加入改名合同后，运行 `node --test tests/obsidian-plugin.test.mjs tests/obsidian-publishing.test.mjs`：108 tests，85 pass / 23 fail；其中 4 项证明旧创建仍写 slug，1 项证明模板尚不拒绝重复 slug，18 项证明改名命令与方法尚不存在；既有发布转换测试保持通过。

实现后：

- 同一两文件定向套件：108/108；
- 加上 `tests/author-doctor.test.mjs`：111/111，用时约 5.15 秒；
- 真实 `npm run content:author:doctor`：AUTHOR READY，13/13、11/11 脚本、32/32 固定依赖、5/5 路径、MyBlog Publisher 1.20.0；报告确认零安装、零配置/文件修改、零凭据读取与零网络；
- 第一次 `npm run release:check`：用时 131.1 秒；Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、277/277 单元与集成、TypeScript、45/45 页面、19/19 生产应用测试、production audit 0；
- 首次归档门运行 156.1 秒：277/277、TypeScript 与 45/45 页面均通过，但公开 `/projects/myblog` 因归档摘要过长越过 100 KB HTML 预算，生产应用回归为 18/19；本轮没有放宽预算，而是把技术细节留在本档案，只保留项目页短摘要；
- 修复后先重跑生产 build + app：45/45 页面、19/19；最终第二次 `npm run release:check` 用时 118.3 秒，277/277、TypeScript、45/45 页面、19/19 生产应用测试与 production audit 0 全部通过；Current 1 / Historical 3、inbox 0、根暂存 0 与外链本地问题 0 保持不变。

## Git 与远端交付

- 功能提交：`00a487f2f7364ea3136dffa6437e7d20670fce06`，`feat(obsidian): add safe inbox draft rename`；
- 功能提交已推送 `origin/main`；
- GitHub Quality Gate：run `31035569778`，completed/success；
- Verify Vercel production：run `31035610884`，completed/success；
- Vercel commit status：success，deployment `D7cCraDkrVvwvNuvnbWmPi8L4KWJ` completed；
- 功能提交远端合计 3/3 success；
- 本文件随独立归档提交交付；提交 identity 由本文件的 Git history 固定，不在内容中自引用尚未生成的 hash。

## 官方资料与判断来源

- [Obsidian Vault API](https://docs.obsidian.md/Plugins/Vault)：Vault 是插件文件操作边界；`read` 读取直接磁盘内容，`cachedRead` 适合非最新内容场景；
- [Obsidian API type definitions](https://github.com/obsidianmd/obsidian-api)：`FileManager.renameFile` 是安全改名/移动并按用户偏好更新链接的公开宿主 API，`getFrontMatterInfo` 从 1.5.7 起可用；因此 manifest 最低版本同步升到 1.5.7；
- [Obsidian plugin submission checklist](https://docs.obsidian.md/oo/plugin)：文件操作应优先使用 Vault/FileManager，而不是低层 Adapter；
- [Obsidian internal links help](https://github.com/obsidianmd/obsidian-help/blob/master/en/Linking%20notes%20and%20files/Internal%20links.md)：内部链接是否在文件改名后自动更新取决于 Obsidian 设置，因此界面只声明宿主行为，不承诺插件自行改写链接。

## 经验与判断

1. 最安全的双字段事务通常是先证明其中一个字段可以删除。发布链已经从文件名派生 slug，继续维护 frontmatter 副本只增加漂移面。
2. 文件改名不应和正文修改绑成一个“看似原子”的 Promise。宿主只提供一个高层 rename 原语时，让正文保持不变比设计补偿写入更可靠。
3. 前置碰撞检查负责给作者可理解的错误，FileManager 负责最终宿主写边界，后置检查负责证明可报告成功；三者职责不同。
4. API 抛错不能安全推断零副作用。把异常归类为 uncertain 并禁止自动重试，比基于错误字符串猜测状态更诚实。
5. 并发保护必须在首个 await 前取得所有权；Modal 内 guard 解决双击，插件级 lease 解决两个窗口，二者不能互相替代。
6. 使用 `vault.read` 而非缓存读取是有意的：高风险操作应以最新磁盘证据为准，性能差异在单文件改名中不重要。
7. FileManager 已承载 Obsidian 的链接偏好；插件若再手工修改链接，会制造重复更新、格式漂移和不可恢复的跨文件事务。
8. UI 用一条 CURRENT → TARGET 轨迹足以表达高风险动作。增加预览树、历史和回滚按钮会暗示插件拥有并不存在的全局事务能力。
9. 迭代档案与公开项目页承担不同责任。把完整实现证据重复写进公开正文会直接消耗 HTML 预算；细节应留在 Vault 档案，项目页只保留可验证结论。

## 风险与下一步

- 自动测试覆盖 DOM/CSS、Vault/FileManager 调用、内容不变、输入、碰撞、frontmatter、并发、宿主拒绝和无法证明的后置状态，但没有固定真实 Obsidian 版本的像素快照；首次日常使用仍需观察 Modal 宽度、路径换行和焦点；
- 内部链接更新服从作者的 Obsidian 设置；关闭自动更新时，旧 Wiki 链接可能继续保留旧名字，发布前仍应运行 inbox readiness 与当前草稿检查；
- `renameFile` 异常被统一视为结果不确定，错误详情不会驱动自动分支；作者必须先观察文件树中的旧/新路径；
- 旧式 frontmatter slug 有意阻断。下一轮唯一主任务是评估只读身份迁移诊断：先报告文件名、slug、draft 与三命名空间事实；只有能证明 Vault 单文件修改、并发和恢复边界时，才提供一次性清理；
- 已归档附件目录不在 inbox 文件名改名事务中；存在根暂存附件时，发布器会按新文件名派生目标，已存在嵌套归档媒体仍由正式媒体所有权门处理；
- minAppVersion 升为 1.5.7；旧 Obsidian 必须升级后才能加载 1.20.0，不能通过删除 manifest 限制绕过 API 契约。

## 结论

MyBlog Publisher 1.20.0 已把未发布草稿身份从两份可漂移数据收敛为文件名这一份事实，并提供一次可验证、可串行、失败不自作主张的宿主原生改名。作者现在可以独立创建、写作、改名、检查并发布 inbox 内容；改名不会修改正文或触碰 Git/网络，旧式迁移与不确定宿主结果也不会被伪装成成功。既有网页 Studio、发布/复核事务和 Vercel 自动交付保持原边界，生产站继续公开且不依赖 Cloudflare。
