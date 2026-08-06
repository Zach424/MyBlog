# Iteration 0083：当前草稿作者意图进程接管

## 1. 范围与成功标准

本轮只解决 Iteration 0081–0082 连续记录的资源与进度体验债务：“查看当前草稿发布意图”已有 latest-wins generation，旧进程终态不会污染最新证据，但被替代的 `content:inbox --source` 子进程仍会运行到自然结束，旧 progress Notice 也会保留到终态。快速重复检查因此会短暂占用无效本机进程，并让作者同时看到多个进行中提示。

成功标准是 MyBlog Publisher 升至 1.34.0，并为该命令的活动子进程增加不可碰撞的专属 scope。新一次真正运行必须先隐藏、结算并终止同 scope 的旧进程，再启动 replacement；旧 stdout/stderr、error 和 close 均静默。`checking=true` 不产生副作用，全 inbox、维护、doctor、交付状态、发布和复核等未 opt-in 命令保持独立。Windows 继续使用现有 `taskkill /t /f` 并在启动失败时回退 `child.kill()`，POSIX 直接 `kill()`。功能提交为 `b21fd49d1aee7135175e8fa7c1078ec8a4e3f19c`；回滚应使用 `git revert b21fd49d1aee7135175e8fa7c1078ec8a4e3f19c`，其父提交为 `86666d67512b0f45e5f36a3f12f8a79440d7667b`。

## 2. 项目结构状态

App Router、公开 UI、内容目录、inbox version 6、Markdown/媒体关系、发布脚本、Git 事务和部署配置均未改变。功能提交修改七个既有文件：

- `.obsidian/plugins/myblog-publisher/main.js`：Symbol scope、scoped supersede、runner 默认 scope 与作者意图 opt-in；
- `.obsidian/plugins/myblog-publisher/manifest.json`、`lib/content/author-doctor.ts`：插件 1.34.0 版本镜像；
- `README.md`：作者可见的立即接管行为与其他命令隔离边界；
- `tests/obsidian-plugin.test.mjs`：POSIX、Windows、fallback、惰性探测、隔离、迟到事件和 replacement 启动失败回归；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：版本与安装契约回归。

按仓库 `AGENTS.md` 要求，写代码前完整复核了 Next.js 16.3 内置 TypeScript 指南。本轮没有修改 Next.js API、路由、配置、类型生成或运行时约定。`research-iteration-loop` skill 规定了单一范围、失败优先、全量验证、全局复核和 Vault 归档顺序。

## 3. 设计内容

本轮没有新增组件、入口、文案层级、颜色、字体、动画或响应式布局。可见变化只发生在进度生命周期：作者第二次运行同一命令时，旧“正在读取……”Notice 立即隐藏，只保留 replacement 的一个进行中提示；其他同时运行的报告仍保留自己的进度。

进程终止不是发布取消入口，也不是通用“只保留一个命令”策略。专属 Symbol scope 只赋给当前草稿作者意图检查；所有既有 runner caller 默认 `null`，因此不会因这次体验优化互相取消。最新命令启动失败仍显示当前错误，不会为了保持安静而恢复旧 owner 或吞掉失败。

## 4. 使用的技术

- `Symbol("current-draft-intent")` 作为进程内不可碰撞 scope，不依赖用户输入、路径或字符串约定；
- `runRepositoryCommand(..., runScope = null)` 保持所有既有 caller 向后兼容；
- `activeRuns` 记录扩展为 `{ cancel, progressNotice, scope }`；
- `supersedeRepositoryRuns(scope)` 只遍历同一 Symbol owner，并先调用幂等 `cancel()`；
- `cancel()` 先置 `settled`、隐藏 progress、删除 `activeRuns`，随后才调用平台终止器；
- 已有 `terminateChild()` 在 POSIX 直接 `child.kill()`，Windows 使用 `taskkill.exe /pid <pid> /t /f`，启动失败时直接 kill；
- 迟到 emitter 事件再次进入 `cancel()` 时得到 false，因此不能报告或解释输出；
- Node VM harness 的 spawn 账本证明 Windows taskkill 出现在 replacement 命令之前。

## 5. 实现的功能

- 新作者意图检查立即隐藏旧 progress Notice；
- POSIX 上旧同 scope 子进程被直接终止；
- Windows 上先启动精确 PID 的进程树终止，再启动 replacement；
- `taskkill.exe` 不可用时回退旧 child 的直接 kill；
- 旧 stdout、process error、非零或成功 close 都不再产生 Notice、Modal、Vault read 或 activeRuns 变化；
- `checking=true` 只返回命令可用性，不终止旧进程、不创建新进程、不替换 generation；
- 同时运行的全 inbox 报告保持活动、进度可见且 child 未终止，证明 scope-null caller 隔离；
- replacement 同步 spawn 失败时，旧进程保持已停止，当前 progress 被隐藏并显示现有“无法启动”错误；
- 已进入异步 SHA-256 读取的旧任务不在 activeRuns 中，仍由既有 generation 静默失效，不尝试取消不可取消的 Vault Promise。

## 6. 实现方法

先只写两个 scoped supersession 子场景。失败优先插件套件为 183/186：POSIX 场景观察到三个 active run 而不是两个，Windows 场景只有两个 npm child、没有预期的 taskkill；父测试也随之失败，其余 183 项通过。

第一次实现后测试仍是 183/186。核对 diff 发现补丁的相似上下文把 supersede 调用误放进前一个“检查当前草稿身份”方法，而作者意图入口没有调用它。该错误会让身份检查越权取消作者意图进程，正是 scope 设计要阻止的行为。测试在提交前发现后，调用被移回 `inspectCurrentDraftIntent`，身份读取重新保持完全独立。

正确实现把 Symbol 作为 runner 第六个可选参数，仅此调用 opt-in。接管先运行 `cancel()`，因此即使终止器同步/异步产生事件，旧 listener 也已失去结算资格。随后补充 replacement spawn 失败场景，证明资源接管与当前错误可见性同时成立，而不是只覆盖成功路径。

## 7. 验证证据

- 失败优先：插件套件 183/186 通过；两个新增子行为及父测试失败；
- 错误落点复测：仍为 183/186，直接阻止身份检查越权取消；
- 插件目标套件：187/187；
- 定向回归：`author-doctor`、`obsidian-publishing`、`obsidian-plugin` 共 207/207；
- `git diff --check`：通过；
- `npm run release:check`：完整通过，约 173 秒；
- 单元测试：376/376；
- ESLint 与 TypeScript：通过；
- Next.js 16.3.0：45/45 页面构建完成；
- 生产应用测试：19/19；
- `npm audit --omit=dev --audit-level=high`：0 个漏洞；
- 真实 author doctor：MyBlog Publisher 1.34.0、13/13、`ready`，四项 safety 均为 false；
- 真实 inbox JSON：version 6、`read-only`、空 inbox，四项 safety 均为 false；
- 功能提交已推送；远端 [Quality Gate #149](https://github.com/Zach424/MyBlog/actions/runs/31078691653) 与 [Verify Vercel production #142](https://github.com/Zach424/MyBlog/actions/runs/31078724667) 均成功；
- 稳定生产 URL 复核：首页、`/projects/myblog` 与 `/studio` 均 HTTP 200，分别返回 25,712、99,296 与 7,636 bytes。

## 8. 经验与教训

- latest-wins 解决结果资格，不自动解决旧任务的资源占用；generation 与 process supersession 是互补层；
- scope 应用不可伪造的内部身份，避免路径相同或字符串复用导致跨命令取消；
- 取消顺序必须先结算 listener，再终止 OS 进程，否则同步 error/close 可能抢先报告；
- `checking=true` 是 Obsidian 的命令探测协议，不是用户执行，任何副作用都必须位于其 return 之后；
- Windows 应终止 npm/cmd 进程树，而不是只 kill 外层 shell；fallback 只处理终止器无法启动，不猜测 taskkill 的业务结果；
- 相似方法附近的窄补丁仍可能落错位置；失败测试应同时证明“目标被改变”和“相邻模块未改变”；
- replacement 启动失败是接管事务的一等终态：不能恢复旧任务，也不能吞掉最新错误。

## 9. 全局状态、风险与未解决问题

当前草稿作者意图从命令、活动子进程、JSON、异步来源字节到 Modal/导航已经形成连续 owner：活动旧进程会被回收，已离开 runner 的旧 Promise 则由 generation 失效。身份读取继续使用独立 generation，发布/复核继续使用 owner-checked lease。正式 Markdown、媒体、Git、Next.js 公开站和 Vercel 语义不变；本轮不访问新 API、不接入新云服务，也不修改作者文件。

全局复核表明作者竞态主线已没有已知自动化缺口。下一个低爆炸半径风险来自 GitHub Actions 的移动 major tag：三个 workflow 共六处 `actions/checkout@v6` / `actions/setup-node@v6` 会随上游 tag 移动，当前结构测试只证明 major 与 Node 24 runtime 语义，不能证明下载的 action bytes 不变。下一轮应从官方仓库核对当前 v6 commit，把六处引用固定到不可变 SHA并保留可读版本注释，再让本地 workflow 测试拒绝浮动 ref；自动更新机器人和真实 API 接入继续暂缓。nonce CSP 会迫使全部页面动态渲染并损失缓存，对当前低敏感公开博客不是更优先的下一步。

## 10. 下一轮唯一主任务

Iteration 0084：从 `actions/checkout` 与 `actions/setup-node` 官方 GitHub 仓库核对当前 v6 不可变 commit SHA，把三个 workflow 的六处 `uses:` 固定到 SHA并保留 `# v6` 注释；扩展本地 workflow 结构测试，拒绝 tag/branch/短 SHA、错误 owner/repository 和版本注释漂移。不得启用 Dependabot、Renovate、真实 API、其他云服务或改变 workflow 触发器、权限、Node 22 应用运行时和命令语义。
