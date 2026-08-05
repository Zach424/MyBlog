# Iteration 0059：新内容待交付身份、重复发布阻断与 Commit Envelope

## 1. 范围与成功标准

本轮完成 Iteration 0058 的唯一主任务：为新草稿发布失败后留在本地的 `content: publish <slug>` 建立独立、只读、版本化的精确身份，并在作者再次发布前阻断重复提交。范围刻意停在“识别与取证”；本轮不执行恢复 push，不把正式复核的单路径状态泛化到多路径发布，也不引入 fetch、rebase、reset、Cloudflare 或外部写入 API。

成功标准是：只有本地 main 相对最后观察到的 `origin/main` 为 ahead 1 / behind 0，HEAD 单父级等于 tracking head，subject、正式 Markdown、可选已跟踪 inbox 删除、零到多归档媒体和每个 blob 都满足同一 slug 的原子发布契约，才返回 `pending-publication`；普通 ahead、复核提交、额外文件、修改正式文件、错误媒体目录和多提交堆叠都不给恢复命令。`content:publish -- --push` 在已有任何非同步本地历史时必须在读取源草稿前失败关闭。回滚功能提交 `d399a6cb18b3b75893742f785adf6c2d50be8858` 即可恢复 1.9.0，不需要内容迁移、reset 或强推。

## 2. 项目结构状态

- `lib/content/publish-delivery.ts`：新增 version 1 发布交付报告、六态关系和纯函数原子发布包分析器；
- `scripts/publish-delivery-git.mjs`：新增只读 Git 适配器，读取 refs、ahead/behind、commit、tree 和 raw diff/blob；
- `scripts/report-content-publish-delivery.mjs`：新增 text/JSON 作者状态命令；
- `scripts/publish-note.mjs`：发布前后锁定 synchronized 基线，成功提交后反证精确 pending-publication，push 使用精确 OID refspec，push 后要求 local/tracking 对齐；
- `package.json`：新增 `content:publish:status`，新测试进入全量单元门；
- `.obsidian/plugins/myblog-publisher/main.js`：新增严格发布报告 parser、只读命令、纯文本降级和 Commit Envelope Modal；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增发布引用轨、manifest spine、证据账本和窄屏折叠；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.9.0 升到 1.10.0；
- `tests/content-publish-delivery.test.mjs`：新增纯分析器、歧义历史和真实裸远端拒绝/防重复发布测试；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：锁定命令参数、严格 schema、损坏报告降级、DOM/CSS 与 1.10.0；
- Vault README、项目说明、架构、设计、发布、运维、路线图和状态同步当前事实；Next 页面代码、内容 schema、Studio、workflow、依赖、数据库与托管配置没有改变。

## 3. 设计内容

本轮主体是刚完成新内容发布、但不确定 Git push 是否送达的博客作者，唯一任务是确认“本地领先的这个 commit 到底包含什么”。顶部继续使用真实引用关系 `ORIGIN/MAIN · LAST OBSERVED ── +1 ── LOCAL MAIN`，但发布状态有独立语义 `PUBLICATION HOLD / ATOMIC BUNDLE`。唯一视觉签名是 `COMMIT ENVELOPE / N PATHS` manifest spine，并按作者任务顺序展示 `NOTE / ADDED`、`MEDIA nn / ADDED`、`INBOX / DELETED`；它不伪装成复核的唯一路径 receipt。

视觉服从 Obsidian 宿主 token；fallback 为 Ink `#1f272a`、Verified `#2f756f`、Trace `#486f78`、Caution `#c6683c`、Paper `#f4f3ef`。正文使用 text/interface，ref、OID、path 与命令使用 monospace。Manifest 用规则线与左侧 spine 表达原子边界，没有卡片、阴影、渐变、动画、分数、“安全”徽章、复制或 push 按钮；状态检查保持零网络。窄屏将 manifest 与 ledger 三列/两列折为单列，完整路径和 OID 允许换行。

## 4. 使用的技术

- TypeScript 判别联合、exact-key JSON 与跨字段不变量重算；
- 40/64 位 Git object id、commit/tree/blob identity 与 raw `diff-tree -z --no-renames --no-abbrev`；
- Git refs `refs/heads/main`、`refs/remotes/origin/main`、`rev-list --left-right --count` 与单父级约束；
- 精确 refspec `<verified-oid>:refs/heads/main` 和服务器端普通非强制 fast-forward 保护；
- Markdown 正式内容 parser，稳定 kebab-case slug、kind/path/subject 派生和归档媒体扩展名约束；
- Node `spawnSync`、固定参数数组、`shell: false`、stdout/stderr 隔离与明确退出码；
- Obsidian CommonJS 插件、原生 Modal/Notice、语义 section/dl/code 与已有进程生命周期；
- 临时真实 Git 仓库、裸远端 `pre-receive` 拒绝 hook、真实附件优化和真实发布提交；
- `research-iteration-loop` 将范围固定为“多路径身份、只读状态、防重复”，先 fail-first，再验证真实 bare remote；恢复写事务留到下一轮；
- `frontend-design` 把复核 receipt 与发布 bundle 视觉拆开，用 Commit Envelope manifest spine 表达路径集合，删除按钮、卡片、分数和动画。

## 5. 实现的功能

- `npm run content:publish:status` 输出人读结果；`--format json` 输出 version 1 机器证据；
- synchronized、pending-publication、local-ahead、behind、diverged、tracking-missing 六态互斥；
- 精确发布包必须是单个 `content: publish <slug>` HEAD，父级等于 tracking head；
- 正式目标必须是新增的 `content/posts|projects/<slug>.md`，且公开内容 kind/slug/title 与路径一致；
- 已跟踪 inbox 源可以作为同 slug 的删除项；原源未跟踪时，提交中必须没有伪造删除项；
- 附件只允许作为新增 blob 位于 `public/uploads/<slug>/`，扩展名只允许发布器产出的 WebP、GIF 或 AVIF；
- 任一额外路径、重复路径、错误状态、错误 blob、错误目录或非确定性顺序都会降级为普通 local-ahead；
- pending 状态只建议 `git push origin <commitOid>:refs/heads/main`，报告明确 `autoExecuted: false`、`networkChecked: false`；
- `content:publish -- --push` 在任何非 synchronized 状态下提前阻断；如果正好是精确待交付发布包，文案明确不要再次创建发布提交；
- 完整质量门期间 tracking/local 基线漂移时回滚当前文件与媒体事务，不创建 commit；
- 创建 commit 后再次验证 slug、parent、tree、正式 blob、inbox 与媒体清单；不匹配则失败关闭；
- 首次发布 push 也改用精确 commit OID；成功后要求 local/tracking 都等于该 OID；失败保留本地原子发布提交并引导运行 status；
- Obsidian 新增“查看待同步新内容发布”，只读展示 Commit Envelope；损坏 JSON 或 manifest 计数不一致时重新运行纯文本状态，不给半可信恢复建议；
- 真实仓库同步状态下报告为 ahead 0 / behind 0、pendingPublication null，运行前后工作区完全相同。

## 6. 实现方法

发布提交不是“一个 Markdown 文件”的同义词。发布器可能同时把未公开草稿变成正式笔记、删除一个已跟踪 inbox 源，并把多个原附件转换后归档；因此分析器先对 commit raw diff 做确定性排序，再从正式新增 Markdown 读取 kind/slug/title，反向派生唯一允许的目标、源和媒体命名空间。允许集合的大小必须与 changes 完全相等，避免用“至少包含目标”误把代码、文档或另一篇内容夹进可恢复提交。

untracked inbox 是合法发布输入，但不会出现在 Git 父提交中，也不能产生删除记录。`sourceDeletionTracked` 因而不是由文件系统当前状态猜测，而是由 commit diff 是否存在精确 `content/inbox/<slug>.md` 删除项派生。媒体同理只接受 Git 新增 blob；修改旧媒体或跨 slug 目录都不是发布器合法产物。

只读适配器不依赖工作区文件推断提交内容。它从 HEAD commit 读取正式 Markdown，从 raw diff 保存 old/new blob OID，并把父级、tree 和 subject 交给纯分析器。报告明确本地 `origin/main` 只是最后观察且没有联网；普通 ahead 不显示 push 命令。插件再独立复算 exact keys、引用关系、路径安全、排序、blob 形状、附件计数、允许集合与精确 OID 命令，不能只信脚本给出的状态字符串。

防重复发布放在读取源草稿之前。这样第一次 push 失败后，即使原 inbox 已经被 commit 删除，第二次命令也会先说明已有待交付包，而不是误报“源文件不存在”并诱导作者恢复或复制草稿。质量门前后还锁定 synchronized 基线；commit 后反证整个原子包，使发布器不仅验证准备写入的文件，还验证 Git 实际记录的 tree。

## 7. 验证证据

- fail-first：缺少 `lib/content/publish-delivery.ts`、1.10.0 manifest、`inspect-publish-delivery` 和 `content:publish:status` 时，5 项新契约按预期失败；既有测试无回归失败；
- 核心真实 Git 测试 3/3：精确包识别、歧义历史拒绝、裸远端拒绝后状态识别与第二次发布阻断；
- 定向 content delivery + Obsidian + publishing 测试 46/46；损坏 attachmentCount 会触发纯文本降级且不产生第二个动作；
- 真实 bare remote `pre-receive` 拒绝首次发布：远端保持 base，本地保留 3 路径 commit（inbox 删除、正式笔记新增、媒体新增）；
- 删除拒绝 hook 后，手工使用精确 OID refspec 送达，状态回到 synchronized；
- 完整 `npm run check` 用时 162.7 秒：ESLint、204/204 单元与集成、TypeScript、45 个页面、19/19 生产应用测试全部通过；
- Vault 与公开项目页归档后完整 `npm run release:check` 用时 137.2 秒：Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、204/204、45 页、19/19 与 production audit 0；
- 真实仓库 `content:publish:status -- --format json` 为 main、ahead 0、behind 0、synchronized、pendingPublication null、recovery none，命令前后 porcelain-v2 状态严格相同；
- `git diff --check` 通过；没有新增依赖、secret、数据库、Cloudflare、fetch/rebase/reset 或外部写入 API；
- 功能提交 `d399a6cb18b3b75893742f785adf6c2d50be8858` 已推送；GitHub 提交页显示 `Status checks: success` 且 3/3 全部成功，并绑定该 SHA；
- 真实 Obsidian 主题像素外观仍未人工截图验收，本轮只声明 DOM、行为、严格 parser 与 CSS 契约。

## 8. 经验与教训

- 事务身份应从 commit tree 和 blob 推导，不应从当前工作区“看起来有哪些文件”猜测；
- 多路径原子提交需要允许集合全等校验；只检查必需路径会让额外改动混入恢复建议；
- “源草稿不存在”可能是上一次发布已提交但未送达的正常结果；先检查交付状态，才能给作者正确因果；
- untracked 输入不会产生 Git 删除记录，报告必须显式区分“源未跟踪”与“删除丢失”；
- 发布媒体经过转换后合法扩展名比作者源格式更窄，身份规则应绑定产物契约；
- 状态名和恢复命令都不能跨用例泛化；pending-review 与 pending-publication 有不同 subject、路径集合和作者任务；
- read-only 必须既是文案也是实现事实：没有 fetch、push、文件写入，测试还应比较运行前后 Git 表面；
- 精确 OID refspec 不只属于恢复命令，首次 push 同样应绑定刚验证的 commit 对象；
- 状态界面不应顺手加入动作按钮；先让证据边界稳定，再单独设计写事务与成功回执。

## 9. 全局状态、风险与未解决问题

MyBlog Publisher 1.10.0 现在同时覆盖正式内容的 Author Proof、待交付复核识别与安全重送，以及新内容多路径待交付识别和重复发布阻断。作者在第一次新内容 push 失败后可以留在 Obsidian 确认 exact commit envelope，不再依赖 Codex 判断该不该重新发布。站点仍以 GitHub 为唯一内容事实源，Vercel 原生托管，不依赖 Cloudflare。

当前发布恢复仍只有只读基础：界面显示精确 OID 命令，但没有由系统执行、二次取证、服务器拒绝后的稳定性证明或 delivered receipt。tracking ref 仍可能过期，普通非强制 push 必须继续让服务器作最终 fast-forward 判定；push 成功但本地 postcondition 漂移时也必须避免自动重试。实际 Git 凭据和网络是作者环境责任，真实 Obsidian 主题、超长 manifest 与大量媒体的像素体验仍需在日常使用中观察。

其他长期风险不变：Studio OAuth 与固定 Decap bundle 需要维护；实时外链网络结果不进入硬门；自定义域名、公开邮箱、统计和评论等待所有者选择；`decap-cms` 开发依赖审计与 Actions major tag 指针另行处理。

## 10. 下一轮唯一主任务

实现“新内容发布待交付”安全重送与可信回执。新增独立 `content:publish:deliver`：执行前必须重新验证同一个 exact pending-publication、current branch、完整 Commit Envelope 和本地 index/worktree 表面；只以 `<verified-oid>:refs/heads/main` 做普通非强制 push，不 fetch/rebase/reset。服务器拒绝或状态漂移保留本地提交；只有 push 后 local/tracking 对齐原 commit，HEAD/index/worktree 稳定，且 tree/正式 blob/媒体 manifest 未漂移，才返回 version 1 delivered receipt。Obsidian 的执行命令与只读状态继续分离，不自动重试，不把复核 receipt 复用为发布回执，不引入云 API。
