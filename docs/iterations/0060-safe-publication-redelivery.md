# Iteration 0060：新内容发布安全重送与可信 Commit Envelope 回执

## 1. 范围与成功标准

本轮完成 Iteration 0059 的唯一主任务：把已经由只读状态证明的 exact pending-publication 升级为作者可独立执行的安全重送事务，并生成与多路径发布语义一致的可信回执。范围只包含本地 Git / Obsidian 作者工作流；不增加 fetch、rebase、reset、force push、自动重试、Cloudflare、数据库或外部写入 API。

成功标准是：执行器只能在 main 上处理同一个 ahead 1 / behind 0 的精确 `content: publish <slug>` Commit Envelope；push 前必须固定 index/worktree，二次验证状态并重读完整 commit manifest；只允许 `<verified-oid>:refs/heads/main` 普通非强制 push。服务器拒绝或远端抢先推进时，本地 envelope 和 stale tracking observation 必须保留。只有 push 后 local/tracking 同为原 commit，HEAD/index/worktree 未变，commit/tree/正式 blob/媒体与 inbox 路径清单三次一致，才签发 version 1 delivered receipt。回滚功能提交 `13eff6ffa5cf2a46f1872326f13b9264c333988d` 即可恢复 1.10.0，不需要内容迁移、reset 或强推。

## 2. 项目结构状态

- `lib/content/publish-delivery.ts`：新增 version 1 publication delivery receipt 类型和纯函数 postcondition；
- `scripts/publish-delivery-git.mjs`：暴露按精确 commit OID 读取 parent/subject/tree/publication/raw diff/blob manifest 的只读入口；
- `scripts/deliver-content-publish.mjs`：新增安全重送 CLI、状态复查、二进制 Git 表面快照、三次 manifest 比对、OID push 和文本/JSON 回执；
- `package.json`：新增 `content:publish:deliver`；
- `.obsidian/plugins/myblog-publisher/main.js`：新增严格 receipt parser、执行命令、sealed envelope Modal 与可信后 reconcile；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增 Verified manifest spine、sealed transition 和四项稳定性窄屏布局；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.10.0 升到 1.11.0；
- `tests/content-publish-delivery.test.mjs`：新增纯回执、真实服务器拒绝、成功交付和 unseen non-fast-forward 远端测试；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：锁定 1.11.0、命令参数、可信/损坏回执、不重试/reconcile 与 DOM/CSS；
- Vault 架构、设计、发布、运维、路线图、状态、inbox 说明和公开项目页同步当前事实；Next 页面代码、内容 schema、Studio、workflow、依赖、数据库与托管配置没有改变。

## 3. 设计内容

本轮主体是已经确认本地存在精确发布包、现在要恢复 Git 送达的博客作者，唯一任务是判断“同一封多路径 envelope 是否完整送达”。执行命令与只读状态继续分开；成功回执不是把 pending Modal 染绿，也不借用正式复核的单路径 receipt。

顶部使用 `PUBLICATION RECEIPT / SEALED ENVELOPE`，唯一轨迹为 `VERIFIED COMMIT ENVELOPE ── SEALED PUSH ── ORIGIN/MAIN · OBSERVED AFTER PUSH`。中段保留原 Commit Envelope 的 manifest spine，但从 Caution 变为 Verified，并写明 `DELIVERED ENVELOPE / N PATHS`；NOTE、MEDIA、INBOX 的顺序、路径和 blob 短身份不变。下方账本展示完整 commit/tree/target blob/精确 refspec，再以 `HEAD STABLE / INDEX STABLE / WORKTREE STABLE / MANIFEST STABLE` 说明四项后置证据。

视觉继续服从 Obsidian token；fallback 为 Ink `#1f272a`、Verified `#2f756f`、Trace `#486f78`、Caution `#c6683c`、Paper `#f4f3ef`。正文用 text/interface，OID/path/命令用 monospace。回执没有按钮、复制、重试、卡片、分数、徽章、阴影、渐变、动画或庆祝效果；末行明确 Git 送达不等于 Production 完成。窄屏把四项稳定性折成单列。

## 4. 使用的技术

- TypeScript 精确 receipt 类型、判别状态与跨报告 postcondition；
- Git commit/tree/blob identity、raw `diff-tree -z --no-renames --no-abbrev` 与精确 OID 重读；
- `git ls-files --stage -z` 二进制 index 快照和 `git status --porcelain=v2 -z --untracked-files=all` worktree 快照；
- 普通非强制 `<commitOid>:refs/heads/main` refspec 和服务器 fast-forward 最终保护；
- Node `spawnSync`、固定参数数组、`shell: false`、2 MB Git 输出边界和严格 text/JSON 参数；
- Obsidian CommonJS、原生 Modal/Notice、exact-key parser、受信成功后 Vault reconcile；
- 临时真实 Git 工作仓库、裸远端 pre-receive hook、第二 peer clone 与真实 non-fast-forward；
- `research-iteration-loop` 把范围固定为“同一发布包的送达事务与回执”，要求 fail-first、真实裸远端和完整 release gate，不通过 fetch/rebase/reset 掩盖竞态；
- `frontend-design` 让成功态继续以多路径 manifest spine 为视觉骨架，和正式复核单路径回执保持不同身份，删除按钮、卡片、分数与动画。

## 5. 实现的功能

- `npm run content:publish:deliver` 输出人读回执；`-- --format json` 输出 version 1 机器回执；
- 非 main、非 exact pending-publication、堆叠/歧义历史或状态复查漂移均在 push 前阻断；
- push 前保存 index/worktree，按精确 OID 读取完整 manifest，并在二次状态检查后再次比对；
- push 只使用精确 OID 作为源，绝不 force，远端普通 fast-forward 判定保留；
- push 失败时检查本地 main 是否仍为原 commit；稳定时明确告知发布提交保持不变；
- push 后重新观察 local/tracking，并再次读取同一 commit manifest；
- 纯函数只在 synchronized、同一 commit、index/worktree/manifest 全稳定时签发回执；
- receipt 明确 `fetchExecuted/rebaseExecuted/resetExecuted: false` 和 `head/index/worktree/manifestStable: true`；
- Obsidian 新增“重新同步待交付新内容发布”，桌面 Vault 才可运行；
- 插件重新验证完整 publication schema、前后关系、精确命令和七个 safety 字段，不只相信成功退出码；
- 可信成功显示 sealed envelope 并 reconcile 一次；损坏回执不显示 Modal、不 reconcile、不再次执行命令；
- 只读“查看待同步新内容发布”继续无动作按钮、无网络、无自动恢复。

## 6. 实现方法

执行器先读取 version 1 pending report，再要求 current branch 为 main。它立即保存 index/worktree 的 NUL 分隔原始字节，并按 pending commit OID 读取第一份 manifest。随后重新运行完整状态分析；只有 local/tracking、关系和序列化 pendingPublication 全部相同，才读取第二份 manifest。两份一致后才构造 OID refspec 并 push，因此状态检查和写动作之间不会把分支名重新解析成另一提交。

manifest 不只是路径字符串。它包含 commit OID、所有父级、subject、tree、正式 Markdown 解析出的 kind/slug/title，以及每条 raw diff 的 path/status/old/new blob OID。Git 对象按 OID 不可变，但显式三次读取把“实际检查了整个发布包”写成后置证据，也让 receipt 的 `manifestStable` 有清晰来源，而不是根据提交号推测。

普通非强制 push 有意保留服务器决定权。本地 tracking ref 可能过期；另一个 peer 在远端推进后，客户端仍会把本地状态读成 pending-publication，但服务器拒绝 non-fast-forward。执行器不 fetch 或重排历史，只证明本地 envelope 没丢并要求作者重新取证。push 返回成功但本地后置读取失败时同样不自动重试，因为第一次写入可能已经完成。

插件不能把 CLI 的 `mode: delivered` 当作信任边界。它先把 receipt 中的 publication 嵌入一个合成 exact pending report，复用严格路径、排序、附件计数和 blob 形状校验；然后独立绑定 before/after OID、精确命令与全部固定 safety 值。只有 parser 完整返回，才打开回执并 reconcile。执行与展示因此是两道独立验证。

## 7. 验证证据

- fail-first：缺少 receipt 导出、1.11.0 manifest、`deliver-pending-publication` 和 package script 时，核心模块导入、版本与命令测试按预期失败；
- 定向发布交付 + Obsidian + publishing 测试 50/50；
- 真实裸远端 pre-receive 拒绝：首次发布和 redelivery 均返回失败，远端保持 base，本地 HEAD/index/worktree 与三路径 envelope 不变；
- 删除拒绝 hook 后同一 CLI 成功，receipt 中 commit、3 路径、精确 refspec 与七项 safety 全部匹配，状态回到 synchronized；
- 第二 peer clone 先推进远端：首个工作区 tracking ref 保持旧值，redelivery 被服务器以 non-fast-forward 拒绝，远端 peer commit 与本地发布 envelope 同时保留；
- 完整 `npm run release:check` 用时 143.5 秒：Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、208/208 单元与集成、TypeScript、45 页、19/19 生产应用测试、production audit 0；
- Vault、发布手册与公开项目页归档后再次运行完整 `npm run release:check`，用时 200.5 秒；相同内容库存、208/208、45 页、19/19 与依赖审计 0 全部保持通过；
- 真实仓库 `content:publish:status -- --format json` 为 main、ahead 0、behind 0、synchronized、pendingPublication null；
- `git diff --check` 通过；没有新增依赖、secret、数据库、Cloudflare、fetch/rebase/reset/force push 或外部写入 API；
- 功能提交 `13eff6ffa5cf2a46f1872326f13b9264c333988d` 已推送；Quality Gate、Vercel deployment status、部署后 Smoke Test 3/3 success 并绑定该 SHA；
- 真实 Obsidian 主题像素外观仍未人工截图验收，本轮只声明 DOM、行为、严格 parser 与 CSS 契约。

## 8. 经验与教训

- “提交 OID 不变”与“系统有证据证明整个多路径 manifest 不变”是两层不同的审计语义；重要发布事务值得显式记录后者；
- stale tracking 不是可以用 fetch 自动消除的噪声；让服务器拒绝普通非强制 push，能在不改写作者现场的前提下保护未观察远端工作；
- push 成功和可信 receipt 是两个终点。成功后取证失败时，自动重试会把网络歧义升级成重复写风险；
- success exit code 不能替代 UI 边界 parser；回执展示和 Vault reconcile 都必须依赖独立 schema 验证；
- 多路径发布回执应继续展示 NOTE/MEDIA/INBOX，而不是只显示 commit；作者恢复时最关心的正是这些文件是否属于同一事务；
- 只读状态和写动作分开命名，既减少误触，也让失败后的重新取证路径明确；
- 真实 non-fast-forward 需要第二个 clone 推进远端；只靠 pre-receive 固定拒绝无法证明 unseen remote protection；
- 二进制 NUL 分隔快照比格式化文本更适合证明 index/worktree 字节稳定；
- 完整发布门应同时覆盖领域纯函数、CLI 的真实 Git 行为、插件 parser/DOM 和最终生产构建，任何单层通过都不足以声明闭环。

## 9. 全局状态、风险与未解决问题

MyBlog Publisher 1.11.0 现在为正式复核和新内容发布分别提供只读精确身份、安全 OID 重送与可信 sealed receipt。作者在任一写作入口 push 失败后都不需要 Codex 帮忙恢复，也不会通过重复发布/复核制造第二个提交。站点继续以 GitHub 为唯一内容事实源、Vercel 原生托管，不依赖 Cloudflare。

两个恢复链路目前仍要求作者先判断失败来自“正式内容复核”还是“新内容发布”，再选择对应状态命令；命令面板中的选择成本是下一轮要解决的作者体验问题，但不能通过合并两个写事务来解决。tracking ref 仍只是最后本地观察，服务器拒绝后需要人工处理远端历史；真实 Git 凭据和网络仍是作者环境责任。实际 Obsidian 主题、超长 object id/path、大量媒体清单与窄屏像素体验仍需在日常使用中观察。

其他长期风险不变：Studio OAuth 与固定 Decap bundle 需要维护；实时外链网络结果不进入硬门；自定义域名、公开邮箱、统计和评论等待所有者选择；`decap-cms` 开发依赖审计与 Actions major tag 指针另行处理。

## 10. 下一轮唯一主任务

增加统一、只读的 Git 交付分诊入口。新增一个领域分析器和 `content:delivery:status`，一次读取本地 refs/HEAD 后明确区分 synchronized、exact pending-review、exact pending-publication 与 ambiguous Git state，只返回对应既有 status/deliver 命令和证据边界。Obsidian 增加一个首先可运行的“查看 Git 交付恢复”视图，让作者在任何 push 失败后无需先猜提交类型。两个写事务、schema 与回执必须继续分离；分诊不自动执行 deliver，不 fetch/rebase/reset，不引入云 API。
