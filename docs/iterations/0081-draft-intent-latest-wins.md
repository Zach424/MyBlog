# Iteration 0081：当前草稿作者意图 latest-wins 生命周期

## 1. 范围与成功标准

本轮只解决一个生命周期竞态：Iteration 0080 在子进程完成后启动异步 `vault.read` 与 SHA-256 复核，但一次较旧检查可以在较新检查之后完成；插件也可能在读取期间卸载。路径、`TFile` 和摘要仍可信时，旧 continuation 会晚到后打开第二个 Modal 和发送成功 Notice，破坏作者对“最后一次命令生效”的预期。

成功标准是 MyBlog Publisher 升至 1.32.0，并把 generation owner 从命令启动一直带到子进程终态、JSON 解释和异步摘要复核。新运行立即使旧 generation 失效，`onunload` 也失效当前 generation；旧 success、非零 exit、process error、读取成功或读取异常都只能静默清理，不能打开 Modal、发送终态 Notice、读取更多证据或自动重试。当前 generation 仍执行全部既有失败提示。实现不写正文、不取消或重启发布/复核事务、不访问网络或云 API。功能提交为 `aecea1d050230caef3667716d45ee1e08819db1c`；回滚应使用 `git revert aecea1d050230caef3667716d45ee1e08819db1c`，其父提交为 `151fdfe15e1e2b57993f68e4702a099fb83bf659`。

## 2. 项目结构状态

App Router、公开 UI、内容目录、inbox version 6 schema、Markdown/媒体关系、发布脚本、Git 交付和部署配置均未改变。功能提交修改七个既有文件：

- `.obsidian/plugins/myblog-publisher/main.js`：generation owner、runner continuation guard、await 前后守卫与卸载失效；
- `.obsidian/plugins/myblog-publisher/manifest.json`、`lib/content/author-doctor.ts`：插件 1.32.0 版本镜像；
- `README.md`：作者可见的 latest-wins 行为与只读边界；
- `tests/obsidian-plugin.test.mjs`：可控异步 Vault read、五类竞态和全插件回归；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：版本和安装契约回归。

按仓库 `AGENTS.md` 要求，写代码前完整复核了 Next.js 16.3 内置 TypeScript 指南。本轮没有修改 Next.js API、路由、配置、类型生成或运行时约定。`research-iteration-loop` skill 规定了单一风险、失败优先、全量验证、全局复核和 Vault 归档顺序。

## 3. 设计内容

本轮没有新增或改变任何可见组件、文案层级、颜色、字体、动画和操作入口。latest-wins 是已有命令的生命周期语义：作者仍运行同一个“查看当前草稿发布意图”，看到同一个 progress Notice 和证据 Modal；差异只在旧任务不再有资格产生终态。

当前 generation 的真实错误继续明确显示，旧 generation 则静默。这里的静默不是吞掉当前故障，而是避免过期任务用旧上下文覆盖新结果。旧 progress Notice 仍由其自己的 `cancel()` 在进程终态隐藏；本轮不强杀只读子进程，避免把 generation owner 与平台进程终止策略混为一体。

## 4. 使用的技术

- `Object.freeze({})` 创建不可伪造的对象身份 token，不依赖递增整数或时间戳；
- `currentDraftIntentGeneration` 保存唯一当前 owner，`===` 作为资格判断；
- `onload` 初始化为 `null`，`onunload` 在取消 active run 前置空，覆盖已离开 activeRuns 的异步 continuation；
- `runRepositoryCommand` 新增可选 `continuationGuard`，在 stdout/stderr 收集、进度隐藏和 activeRuns 清理之后、解释终态或显示 Notice 之前校验；
- `openCurrentDraftIntent` 在 JSON、身份和 Modal 链入口校验同一 token；
- `openVerifiedCurrentDraftIntent` 在读取前、read reject 分支和 await 恢复后再次校验；
- Node VM harness 用 `deferredVaultReadNumbers` 与 resolver map 精确控制读取恢复顺序，不使用时间 sleep 猜测竞态；
- 现有 Notice、Modal、Vault read、activeRuns 与进程 emitter 记录证明没有额外写入、重试或子进程。

## 5. 实现的功能

- 连续运行两次作者意图检查时，第一次即使以 exit 0 返回畸形 JSON，也不解释、不读取 Vault、不显示错误；
- 较旧进程非零退出或触发 `error` 时，只隐藏自己的 progress 并移出 activeRuns，不发送过期失败 Notice；
- 第一次报告已进入延迟 SHA-256 读取、第二次完整显示之后，第一次恢复也不会再打开第二个 Modal 或发送第二条成功 Notice；
- 插件在摘要读取期间卸载时，读取恢复后不打开 Modal、不通知、不重试；
- 最新运行仍可正常打开唯一 Modal，并保留所有 schema、路径、对象、摘要、行界和宿主失败提示；
- `checking=true` 的命令可用性探测不会创建或替换 generation；
- 发布/复核 author transaction lease、草稿身份清理 lease、文件内容、Git 和网络行为均未改变。

## 6. 实现方法

先冻结 token 所有权和静默边界，再只修改测试与期望版本。第一次目标命令为 31/204 失败：五个直接生命周期断言证明旧 success、非零 exit、process error、延迟 read 和 unload 均未受保护；其余为测试先要求 1.32.0、实现/manifest/doctor 仍为 1.31.0 产生的预期版本联锁。

实现时在真正运行命令后、启动子进程前创建 token，并把闭包 guard 作为 runner 的第五个可选参数。runner 始终先执行原有 `cancel()`，确保进度 Notice 被隐藏、activeRuns 被清理；随后过期任务直接返回，不进入 onSuccess、failure summary 或终态 Notice。JSON consumer 和 async reader仍各自校验 token，防止 generation 在 runner 回调之后、await 恢复之前被替换。

测试 harness 不用定时器制造概率竞态，而是在指定的第 N 次 `vault.read` 内挂起 Promise，再显式选择恢复顺序。实现后扩展 stale error 覆盖，目标套件达到 205/205；全插件套件 177/177。没有为通过测试而终止旧进程、放宽当前错误、关闭既有 Modal 或改变发布事务。

## 7. 验证证据

- 失败优先：31/204 失败，五类生命周期缺口与 1.32.0 联锁均被直接观察；
- 目标测试：`inbox-readiness`、`obsidian-plugin`、`author-doctor`、`obsidian-publishing` 共 205/205；
- 插件单套件：177/177；
- `git diff --check`：通过；
- `npm run release:check`：完整通过，约 190 秒；
- 单元测试：366/366；
- ESLint 与 TypeScript：通过；
- Next.js 16.3.0：45/45 页面构建完成；
- 生产应用测试：19/19；
- `npm audit --omit=dev --audit-level=high`：0 个漏洞；
- 真实 author doctor：MyBlog Publisher 1.32.0、13/13、`ready`，四项 safety 均为 false；
- 真实 inbox JSON：version 6、`read-only`、空 inbox，四项 safety 均为 false；
- 功能提交已推送；远端 [Quality Gate #145](https://github.com/Zach424/MyBlog/actions/runs/31075902284) 与 [Verify Vercel production #138](https://github.com/Zach424/MyBlog/actions/runs/31075933884) 均成功；
- 稳定生产 URL 复核：首页、`/projects/myblog` 与 `/studio` 均 HTTP 200，分别返回 25,712、99,296 与 7,636 bytes，并包含服务端 `<title>`。

## 8. 经验与教训

- latest-wins 不只是在 await 后比较序号；资格必须从命令启动贯穿 process success、failure、error、JSON 和每个异步恢复点；
- 旧错误不再与当前任务相关，显示它会制造假故障；当前 generation 的错误则必须完整保留，不能一概静默；
- 清理资源和报告终态应分开：旧任务仍先隐藏进度、移出 activeRuns，再被 guard 阻止解释结果；
- 对象身份 token 比可回绕的数字、时间戳或路径更适合单进程 owner 判定；
- 插件卸载与新运行是同一种 owner 失效问题，置空/替换一个 token 可以共享证明；
- 可控 Promise resolver 比 sleep 更适合并发回归，能够确定地证明“旧读最后恢复”；
- latest-wins 不等于强杀；是否主动终止只读进程是资源/体验策略，应独立评估，不能混入正确性修复。

## 9. 全局状态、风险与未解决问题

当前草稿作者意图的命令、报告、来源 SHA-256、Modal 和 ALT/REF 导航已形成连续 owner 与内容证据链。正式 Markdown、媒体、发布/复核事务、Git、Next.js 公开站和 Vercel 语义不变；功能完全本地，无遥测、Cloudflare 或其他云 API 依赖。

被新运行替代的旧只读 `content:inbox` 子进程有意继续运行至终态，只是失去报告资格；因此它在终态前仍占用少量本机资源并保留自己的 progress Notice。主动终止可作为以后独立的资源优化，但当前没有失败或规模证据证明必须抢在其他正确性缺口之前。

相邻的“检查当前草稿身份”使用 `void openDraftIdentityEvidence(...).catch(...)`，也会在异步 `vault.read` 后打开 Modal；连续运行或卸载期间仍可能出现旧 Modal/Notice。其后续 `Vault.process` 清理已经有独立 single-flight lease，因此下一轮只应保护只读取证阶段，不能改写清理事务。真实 Obsidian 主题下仍缺少人工像素/交互验收，按目标约束继续暂缓手动工作。

## 10. 下一轮唯一主任务

Iteration 0082：给“检查当前草稿身份”的只读命令与异步 `vault.read`/Modal 打开链增加独立 latest-wins generation，并在 `onunload` 时失效。旧读取成功或失败均静默，最新读取保留现有身份冲突提示；不得改变 `Vault.process` 严格清理 lease、正文、发布事务、Git、网络或云 API。
