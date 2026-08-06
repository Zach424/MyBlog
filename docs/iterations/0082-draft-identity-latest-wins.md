# Iteration 0082：当前草稿身份 latest-wins 生命周期

## 1. 范围与成功标准

本轮只修复“检查当前草稿身份”的只读取证竞态。命令会捕获当前 inbox `TFile`，异步执行 `vault.read`，再分析文件名、frontmatter 和正式内容命名空间并打开 Modal；较旧读取可能在较新命令之后完成，插件也可能在读取期间卸载，因此旧 Modal 或错误 Notice 会晚到覆盖作者对最后一次操作的理解。

成功标准是 MyBlog Publisher 升至 1.33.0，并给“命令触发 → `vault.read` → 身份 Modal”增加独立 generation owner。新运行立即使旧 owner 失效，`onunload` 置空当前 owner；旧读取无论成功或失败都静默，最新读取继续保留原有成功证据与当前错误提示，读取期间活动文件漂移也不得打开旧证据。已经展示的 Modal 不受后续 generation 影响，其显式旧 slug 清理继续只由原有 `Vault.process` single-flight lease、观测字节和后置条件保护。功能提交为 `9b899d68199232aa150c8f69983fced1eec1817b`；回滚应使用 `git revert 9b899d68199232aa150c8f69983fced1eec1817b`，其父提交为 `cbb89781c78a3f236f87d1cdae8527d56d9c80d9`。

## 2. 项目结构状态

App Router、公开 UI、内容目录、inbox version 6、Markdown/媒体关系、发布脚本、Git 交付和部署配置均未改变。功能提交修改七个既有文件：

- `.obsidian/plugins/myblog-publisher/main.js`：身份检查 generation、卸载失效、读取前后 owner 与活动 `TFile` 守卫；
- `.obsidian/plugins/myblog-publisher/manifest.json`、`lib/content/author-doctor.ts`：插件 1.33.0 版本镜像；
- `README.md`：作者可见的身份检查 latest-wins 与清理 lease 边界；
- `tests/obsidian-plugin.test.mjs`：可控 read resolve/reject、五类生命周期行为和既有清理 lease 回归；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：版本和安装契约回归。

按仓库 `AGENTS.md` 要求，写代码前完整复核了 Next.js 16.3 内置 TypeScript 指南。本轮没有修改 Next.js API、路由、配置、类型生成或运行时约定。`research-iteration-loop` skill 规定了单一风险、失败优先、全量验证、全局复核和 Vault 归档顺序。

## 3. 设计内容

本轮没有新增或调整可见组件、入口、文案层级、颜色、字体、动画和响应式布局。作者仍运行同一个“检查当前草稿身份”命令，看到同一个 `DRAFT IDENTITY / LOCAL EVIDENCE` Modal；区别只在旧异步 continuation 不再有资格展示界面或错误。

“静默”严格限于已经被新命令替代或插件卸载后的 owner。最新读取失败仍显示原有错误，活动草稿在 await 期间变化仍明确要求重跑。Modal 一旦展示便成为一次完整观测，后续点击“移除冗余 slug”继续使用其中冻结的 `observedContent`，不会被新一轮只读 generation 隐式授权或撤销。

## 4. 使用的技术

- `Object.freeze({})` 创建基于对象身份的不可伪造 generation token；
- `currentDraftIdentityGeneration` 保存唯一当前 owner，`===` 判定 continuation 资格；
- `onload` 初始化、`onunload` 置空，覆盖插件生命周期边界；
- `openDraftIdentityEvidence(identity, generation)` 在读取开始、read reject、await 恢复和 Modal 打开前校验同一 owner；
- await 恢复后重新读取活动 inbox identity，并同时核对捕获的 `TFile` 与 Vault 路径映射；
- Node VM harness 把 deferred Vault read 从单 resolver 扩展为 `{ resolve, reject }`，确定性控制旧成功和旧失败的到达顺序；
- 既有 `DraftIdentityModal`、`observedContent`、`draftIdentityCleanupLease` 和 `Vault.process` 路径保持原样。

## 5. 实现的功能

- 连续运行两次身份检查时，只允许第二次读取打开一个最新身份 Modal；
- 第一次读取在最新 Modal 后成功，不再打开第二个旧 Modal，也不发送 Notice；
- 第一次读取在被替代后失败，不再显示过期错误；
- 当前读取失败继续显示包含来源路径和宿主错误的作者提示；
- 读取期间活动文件切换到另一篇 inbox 草稿时，不打开捕获来源的旧证据，并提示重新运行；
- 插件在读取期间卸载时，恢复后的 continuation 不打开 Modal、不通知、不重试；
- 两个已经完成并展示的身份 Modal 仍通过一个插件级清理 lease 串行化 `Vault.process`，证明 generation 没有越权进入写事务；
- `checking=true` 的命令可用性探测不会创建或替换 generation。

## 6. 实现方法

先只增强测试夹具并写五个异步子场景。第一次插件套件为 178/183：旧读取晚成功会产生第二个 Modal，旧读取晚失败会产生 Notice，活动草稿漂移仍打开旧 Modal，卸载后没有身份 generation 可失效；当前读取失败用例已经通过，证明测试没有把所有错误一概静默。

实现时在真正运行命令后创建 token，并把它传入异步 reader；命令级 catch 先确认 owner，reader 则在每个异步恢复边界先退出旧 generation。最新读取恢复后新增活动 identity、原 `TFile` 和 Vault 映射三方一致性检查，再执行既有纯同步分析。Modal 打开前最后检查一次 owner。

原清理 lease 测试改为先完成并展示第一个 Modal，再启动并完成第二次检查，然后并发点击两个清理按钮。这样既符合新 latest-wins 语义，也直接证明已经展示的历史证据仍由独立 single-flight lease 管理，而不是被只读 token 绑架。

## 7. 验证证据

- 失败优先：插件套件 178/183 通过；四个新增子行为及其父测试失败，当前读取失败提示已通过；
- 插件目标套件：183/183；
- 定向回归：`author-doctor`、`obsidian-publishing`、`obsidian-plugin` 共 203/203；
- `git diff --check`：通过；
- `npm run release:check`：完整通过，约 128 秒；
- 单元测试：372/372；
- ESLint 与 TypeScript：通过；
- Next.js 16.3.0：45/45 页面构建完成；
- 生产应用测试：19/19；
- `npm audit --omit=dev --audit-level=high`：0 个漏洞；
- 真实 author doctor：MyBlog Publisher 1.33.0、13/13、`ready`，四项 safety 均为 false；
- 真实 inbox JSON：version 6、`read-only`、空 inbox，四项 safety 均为 false；
- 功能提交已推送；远端 [Quality Gate #147](https://github.com/Zach424/MyBlog/actions/runs/31077106174) 与 [Verify Vercel production #140](https://github.com/Zach424/MyBlog/actions/runs/31077137852) 均成功；
- 稳定生产 URL 复核：首页、`/projects/myblog` 与 `/studio` 均 HTTP 200，分别返回 25,712、99,296 与 7,636 bytes。

## 8. 经验与教训

- latest-wins owner 应按用户动作划分，而不是按文件路径划分；同一路径的两个读取仍属于两个不同意图；
- await 前验证对象只能证明起点，恢复后必须再次核对活动文件、捕获 `TFile` 和 Vault 映射；
- stale failure 与 current failure 必须分别测试，否则“全部吞错”也可能伪装成竞态修复；
- 可 reject 的 deferred Promise 能确定性覆盖异步异常，优于依赖宿主时序或 sleep；
- 只读取证 generation 与显式写事务 lease 是不同授权边界；前者不应关闭已展示 Modal，也不应替代 `Vault.process` 的内容比较和后置条件；
- 为 latest-wins 调整旧并发测试时，应保留它原本证明的风险，只改变建立前置状态的顺序。

## 9. 全局状态、风险与未解决问题

当前草稿的文件名身份检查与作者意图检查都已具备 repeated-run/unload owner；身份读取还额外绑定活动 `TFile`，作者意图继续绑定 version 6 报告和原始来源 SHA-256。正式 Markdown、媒体、发布/复核事务、Git、Next.js 公开站和 Vercel 语义不变；功能完全本地，无遥测、Cloudflare 或其他云 API 依赖。

全局复核没有发现新的发布正确性阻断。仍然存在一个已连续记录的作者体验与本机资源债务：被新运行替代的旧 `content:inbox --source` 子进程失去报告资格后会继续执行到终态，其 progress Notice 也要到终态才隐藏。结果不会污染最新证据，但快速重复检查会短暂保留无效进程和进度。下一轮可以复用已有 activeRuns/平台终止器，仅对同一作者意图 scope 进行显式 supersede；必须证明不取消全 inbox、维护、doctor、发布或复核等其他命令。真实 Obsidian 主题像素/交互验收仍需人工，按目标约束继续暂缓。

## 10. 下一轮唯一主任务

Iteration 0083：为“查看当前草稿发布意图”的活动子进程增加专属 supersession scope。新一次真正运行应先隐藏旧 progress、从 activeRuns 结算旧 owner 并使用既有跨平台终止器结束旧只读进程；旧 close/error 必须保持静默，最新命令与其他报告/发布事务不受影响。不得取消 `checking=true` 探测，不得改变身份读取、正文、Git、网络或云 API。
