# Iteration 0051：Obsidian 已发布内容复核队列

## 1. 范围与成功标准

本轮只补齐作者在 Obsidian 中查看已发布 Current 内容维护优先级的路径。Studio、CLI 和 Actions 已共享 180 / 60 / 30 / 0 天规则，但 Vault 作者仍需离开 Obsidian 打开终端。本轮复用 `content:status`，新增桌面命令和只读 Modal；不改变内容 schema、`reviewedAt`、发布事务、构建门、网络服务或外部提醒。

成功标准是：命令只在桌面 Vault 可用；Windows 隐藏运行、POSIX 无 shell 运行；成功展示完整本地报告，spawn error/非零退出不打开空 Modal；持续 Notice 在所有终态消失；插件卸载时取消活动命令并防止迟到事件二次结算；Windows 清理整棵 cmd/npm/Node 进程树，POSIX 终止直接子进程；现有检查/发布/inbox 命令无回归。实现回滚需要同时 revert `b6e3134ec90769dfc09a803d5919b084b7498e19` 和生命周期修正 `13d1f1ea5dc38def9da986fcb60fd434d25daf44`，不会影响仓库中的内容或线上服务。

## 2. 项目结构状态

- `.obsidian/plugins/myblog-publisher/main.js`：插件从三个命令扩展为四个；新增通用只读 Modal、内容维护 Modal、统一命令执行器、活动进程账本、输出上限和跨平台卸载清理；
- `.obsidian/plugins/myblog-publisher/manifest.json`：版本从 1.1.0 升至 1.2.0，说明补充已发布维护与 inbox 检查；
- `.obsidian/community-plugins.json`：继续启用 `myblog-publisher`，无需新增插件依赖；
- `tests/obsidian-plugin.test.mjs`：用隔离的 CommonJS/Obsidian/child_process 行为夹具验证命令注册、Modal、Windows/POSIX 参数、桌面限制、错误/迟到事件和卸载；
- `tests/obsidian-publishing.test.mjs`：既有发布事务测试继续运行，静态契约升级到插件 1.2.0、维护命令和生命周期；
- `package.json`：新插件行为测试进入唯一 `test:unit` 清单；
- README、架构、设计、发布、运维、路线图与公开 MyBlog 项目页：同步插件入口、设计、进程边界、验证证据和下一任务；
- Next.js 路由、Studio 页面、公开内容模型、Vercel 配置和网络边界没有改变。

## 3. 设计内容

Obsidian 入口服从宿主应用，不复制网页 Studio 的 Review Horizon。命令成功后使用原生 Modal：标题“已发布内容复核队列”、一句明确的只读边界、一个最高 65vh 的可滚动 `pre`。CLI 输出通过 `setText` 写入，因此内容标题、路径或错误不能成为 HTML；终端、Obsidian 和 Actions 的证据仍能逐行对照。

执行状态使用 Obsidian 原生 Notice。开始时显示持续 Notice，成功后替换为五秒完成提示，spawn error 或非零退出显示可执行诊断；任一终态、重复 close 或插件卸载都不能留下持续状态。第一版有意保留纯文本，不在进程生命周期重构的同一轮引入结构化卡片和打开笔记交互。

## 4. 使用的技术

- Obsidian Desktop Plugin API：`Plugin`、`Modal`、`Notice`、`FileSystemAdapter`；
- CommonJS 插件入口和 Node.js `child_process.spawn`；
- Windows `cmd.exe /d /s /c npm` 隐藏执行、`taskkill.exe /pid <pid> /t /f` 固定进程树清理；
- POSIX 直接 `npm` 执行与 `ChildProcess.kill()`；
- `Map` 活动运行账本、幂等 cancel、200,000 字符输出包络和最后四行错误摘要；
- Node.js `vm` 隔离域、可控 Obsidian/child_process mock、`node:test` 与 strict assertions；
- research-iteration-loop 把本轮限制为一个 Obsidian 作者可见性纵切，并在归档前的全局审计中发现 Windows 进程树清理缺口。

## 5. 实现的功能

- 命令面板新增“查看已发布内容复核队列”；
- 命令调用仓库自己的 `npm --silent run content:status`，显示报告日、Current/Historical 数量、四级状态、sourcePath、review-by、剩余天数和复核清单；
- 报告零网络、零内容写入、零 Git 操作，不自动修改 `reviewedAt`；
- 新维护报告和既有 inbox 报告共用通用只读 Modal 基类；
- 发布、检查、inbox 和维护命令共用进程启动、输出捕获、Notice、错误摘要和结算语义；
- 合并 stdout/stderr 最多保留 200,000 字符，超出时显式标记截断，避免插件内存被异常命令输出无限占用；
- spawn 同步抛错、异步 error、非零 close、成功 close 和 error 后迟到 close 都只结算一次；
- 插件卸载隐藏所有活动 Notice，并阻止随后事件创建完成/失败提示；
- Windows 通过无 shell、纯数字 PID 的 `taskkill.exe /T /F` 清理整棵命令树，taskkill 无法启动时回退直接 child.kill；POSIX 直接 child.kill；
- 原有“检查当前草稿”“发布当前草稿并同步 GitHub”“查看全部草稿发布就绪状态”保持可用，且持续进度 Notice 现在会正确关闭。

## 6. 实现方法

先用现有插件确认可复用模式：它已从 Vault 根目录以 `shell: false` 启动 npm，并把 inbox 输出用 `setText` 放入 `pre`，但三条命令重复进程代码，发布进度 Notice 没有保存/关闭，也没有卸载清理。新实现先抽出 `ReadOnlyReportModal` 和 `runRepositoryCommand`，再让 inbox、maintenance 与 publish 仅提供固定 npm 参数、文案和成功回调。

每次运行创建一个 progress Notice、output buffer、settled 标记和 cancel 闭包，并以 child 为键写入 `activeRuns`。error/close 先调用幂等 cancel；只有第一次调用能隐藏 Notice、删除账本并产生后续 UI。卸载遍历账本快照，先 cancel 阻断迟到事件，再终止进程。初版只调用 `child.kill()`；归档前审计 Node/Windows 的 cmd 子进程语义后发现这不能证明 npm/Node 后代退出，于是增加 `terminateChild`：Windows 以 `taskkill.exe` 固定参数按 PID 递归强制清理，spawn error 回退直接 kill；POSIX 保持直接 kill。

行为测试在 `vm` 中加载真实 CommonJS 文件，只替换 `obsidian` 与 `node:child_process`。Mock 保存命令、Notice、Modal DOM、spawn 参数和事件监听器，使测试能主动发出 stdout、error、close 和 taskkill error，而不启动真实发布。测试第一轮按预期 0/3：manifest 仍是 1.1.0且维护命令不存在；实现后 16/18，两个失败来自 vm 跨 realm Array 与主 realm 深相等的原型差异，测试把跨域值 JSON 规范化后 18/18。随后进程树修正增加 taskkill 与 POSIX kill 断言，仍保持 18/18。

## 7. 验证证据

- 失败优先：`tests/obsidian-plugin.test.mjs` 初始 0/3，精确指出版本和命令缺失；实现/测试域修正后，与既有发布测试合并为 18/18；
- `node --check`、定向 ESLint 和真实 `npm --silent run content:status` 通过；真实报告为 2026-08-05、Current 1、Historical 3、未公开 0，`content/projects/myblog.md` healthy、review by 2027-02-01、剩余 180 天；
- Windows 行为夹具验证 `cmd.exe /d /s /c npm --silent run content:status`、`windowsHide: true`、`shell: false`；POSIX 验证直接 `npm`、无 shell；
- 成功路径验证纯文本 Modal 和 Notice 关闭；错误路径验证 spawn error、迟到 close 不重复提示；卸载路径验证 Windows `taskkill.exe /pid <numeric> /t /f`、taskkill error 直接 kill 回退和 POSIX child.kill；
- `npm run release:check` 通过：Current 1 / Historical 3、inbox 0、根暂存 0、外链 2 URL / 3 occurrences / 0 issue、ESLint、155/155 单元、TypeScript、45 个页面生成任务、19/19 生产应用测试、production audit 0；
- 公开 `.next/static` 仍为 1,818,133 B；插件 `main.js` 与 manifest 合计 7,509 B，不进入公开阅读客户端；
- 功能提交 `b6e3134ec90769dfc09a803d5919b084b7498e19` 已推送；Quality Gate `30982692190`（#87）与 Vercel Production 验证 `30982724221`（#80）completed/success；
- 生命周期修正 `13d1f1ea5dc38def9da986fcb60fd434d25daf44` 已推送；Quality Gate `30983045512`（#88）与 Vercel Production 验证 `30983074861`（#81）completed/success；
- `.obsidian/community-plugins.json` 当前包含 `myblog-publisher`，仓库根目录仍可作为 Vault 打开；没有新增手工云配置、secret、API 或数据库。

## 8. 经验与教训

- “只读报告”也有运行生命周期：如果持续 Notice 不关闭或子进程在插件卸载后继续运行，用户仍会感到后台失控；
- 多个命令的 spawn 代码应共享一个幂等状态机。Node 的 error 后可能继续 close，若两条监听器各自提示，会产生双重错误和空 Modal；
- `shell: false` 不能被简化成“Windows 没有命令解释器”。npm 是 `.cmd`，所以固定 `cmd.exe` 是必要兼容层；安全边界来自固定参数数组和无作者文本插入，而不是否认 cmd 的存在；
- 终止 shell 进程不等于终止它的后代。Windows 的可靠卸载需要树级清理，且 PID 必须保持数字参数、不能拼进 shell 字符串；
- 输出上限应在成功和失败路径共享，否则一个异常工具仍可能在 Modal 打开前耗尽插件内存；截断必须显式告诉作者，不能把不完整报告伪装成完整证据；
- 使用真实插件源码加 mock API 的 vm 测试比 grep 命令名强，但跨 realm 的 Array/Object 原型会影响 strict deep equality；规范化测试值比放宽为字符串包含更精确；
- 原生 Obsidian UI 是第一版更合适的设计边界：不复制网页皮肤，先保证相同报告、清晰状态和可靠清理，再独立演进结构化交互；
- 插件文件已经写入 Vault 不等于已运行的 Obsidian 立即热更新。版本变更必须在手册中说明重启或重新启用，不能声称当前进程自动加载了新代码。

## 9. 全局状态、风险与未解决问题

博客现在有 Git-first 内容、Studio/Obsidian 双发布入口、公开阅读/搜索/Feed/知识图、内容/媒体/关系/外链/新鲜度门、Vercel 自动交付与恢复，以及 Studio 和 Obsidian 两个 Current 维护视图。Obsidian 插件同时覆盖发布中草稿的 readiness 和已发布内容的 maintenance，且没有引入网络、数据库、Cloudflare 或 Codex 运行依赖。

Obsidian 1.2.0 的维护 Modal 仍是不可点击纯文本：它完整显示 sourcePath，但打开目标笔记需要作者自己在快速切换中搜索。结构化 JSON、插件侧 schema 和一键打开笔记尚未实现。Windows `taskkill /F` 只在插件卸载且命令仍活动时执行，范围锁定为本插件记录的数字 PID 树；行为由 mock 证明参数与回退，但没有为了测试在作者真实 Obsidian 进程中制造并杀死命令树。插件文件更新后，已运行的 Obsidian 仍需重启或重新启用才能加载 1.2.0。

既有 Decap 固定版本/OAuth/CSP、开发依赖审计、Vercel Hobby 回滚、外链网络假阴性、附件 Git 历史、知识图扩容和所有者尚未选择的域名/统计/评论仍保持原风险。下一处高价值且无需外部配置的空白，是把维护 Modal 从“看得到路径”推进到“验证结构并直接打开路径”。

## 10. 下一轮唯一主任务

把 Obsidian 维护 Modal 升级为结构化复核账本：运行 `content:status --format json`，在插件侧严格验证版本化结构、四级计数、ISO 日期、remainingDays、kind/slug/sourcePath 与安全路径，再用原生元素显示摘要和逐条记录；为精确存在的 `content/posts|projects/<slug>.md` 提供“一键打开笔记”。JSON 解析、schema、路径不存在或 UI 渲染失败时必须保留纯文本只读降级；继续保持零网络、零自动改日期、零 Git 副作用，并覆盖空队列、四级状态、路径拒绝、按钮唯一性、打开失败与插件卸载。
