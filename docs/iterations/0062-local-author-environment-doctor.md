# Iteration 0062：本机作者环境 Doctor 与发布前置电路

## 1. 范围与成功标准

本轮完成 Iteration 0061 的唯一主任务：在作者开始新内容发布或正式内容复核前，用一个版本化、只读的本机报告发现环境缺口。范围只包含 Runtime、Git、Workspace、Vault 四组前置事实、CLI、Obsidian 展示、严格验证和证据归档；不安装软件、不修改 Git/Obsidian 配置、不读取凭据值、不访问网络、不自动修复，也不替代单篇领域门和 `release:check`。

成功标准固定为 13 项检查：Runtime 3 项（Node、npm、Git），Git 4 项（仓库根、main、main/origin-main 本地同步基线、姓名/邮箱是否配置），Workspace 4 项（package/engine、11 个作者脚本、全部声明依赖的固定版本、5 个作者路径），Vault 2 项（`.obsidian`、MyBlog Publisher 1.13.0 的 manifest/main/styles）。报告必须只序列化 Git identity 布尔值而不是内容；真实 Git 夹具删除裸远端后仍须完成 doctor，且 HEAD、index、worktree 与 package 文件不变。回滚功能提交 `7f8ecc124b79851426c4d50865357e6723d11f37` 即可恢复 1.12.0，不需要内容迁移、reset 或强推。

## 2. 项目结构状态

- `lib/content/author-doctor.ts`：新增 version 1 observation、13 项固定检查、summary、repair 与 safety 的纯分析契约；
- `scripts/author-doctor-environment.mjs`：新增本地 Node/npm/Git/package/dependency/path/Vault 只读适配器；
- `scripts/report-author-doctor.mjs`：新增 text/JSON CLI、ready/attention/fatal 退出码和明确安全边界；
- `package.json`：注册 `content:author:doctor`，并把新测试纳入 unit 门；
- `.obsidian/plugins/myblog-publisher/main.js`：新增严格 doctor parser、命令、纯文本降级和 Author Doctor Modal；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增 preflight circuit、四组 ledger、汇合端点与窄屏布局；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.12.0 升到 1.13.0；
- `tests/author-doctor.test.mjs`：覆盖纯函数健康态、13 条失败路由和真实无远端 Git 只读夹具；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：锁定命令参数、严格 parser、summary 重算、DOM/CSS、无按钮、移动端边界与纯文本降级；
- Vault 架构、设计、发布、运维、路线图、状态、inbox 说明和公开项目页同步当前事实；Next 页面、内容 schema、Studio、workflow、依赖、数据库与托管配置没有改变。

## 3. 设计内容

本轮主体是准备开始新发布或新复核、但不应被迫记忆全部本机前提的博客作者，唯一任务是回答“当前本机是否具备启动作者事务的条件”。界面不采用通用健康 dashboard、分数、卡片或一组修复按钮，因为这些形式会把离散前置条件误表达成可平均的健康度，也会把只读诊断变成隐含授权。

唯一视觉签名是发布前置电路：`RUNTIME → GIT → WORKSPACE → VAULT → AUTHOR READY/HOLD`。顶部 `AUTHOR PREFLIGHT / LOCAL ONLY` 固定边界；四个站点按真实依赖顺序串联，用 PASS/HOLD 文本与 Verified/Caution 规则线同时表达状态。下方 ledger 为每项展示 observed、expected，并只在 attention 时给出修复指令。最终端点是视觉汇合，不是动作按钮。

视觉服从 Obsidian 宿主 token；正文使用 host text/interface，版本、路径和观测值使用 monospace。界面没有自动安装、自动配置、按钮、进度环、阴影、渐变或动画；窄屏把站点和证据行折为单列而不改变信息次序。

## 4. 使用的技术

- TypeScript exact report schema、固定检查目录、纯派生 summary/status/repair 与 safety invariant；
- Node ESM、`spawnSync` 固定参数、`shell: false`、filesystem/Git 本地适配和 0/1/2 退出码；
- 复用 `delivery-git-snapshot` 的本地 branch/ref/ahead-behind 观察，不 fetch；
- 通过当前 Node 执行受信 `npm-cli.js`，兼容 Windows 且不拼接 shell 命令；
- `npm ls --json --depth=0` 与 package 声明的全部 dependencies/devDependencies 精确版本比对；
- Obsidian CommonJS、原生 Modal/Notice、exact-key parser、从 observation 独立重算和安全纯文本降级；
- 临时真实 Git 工作仓库和裸远端，删除远端目录后验证零网络依赖；
- HEAD/index/worktree/package 前后快照验证只读后置条件；
- `research-iteration-loop` 将本轮冻结为 13 项可证伪契约，要求 fail-first、真实无远端夹具、功能/归档双提交和两次完整门；
- `frontend-design` 将离散前置依赖设计为单向 preflight circuit，并排除通用 dashboard、自动修复和装饰性 UI。

## 5. 实现的功能

- `npm run content:author:doctor` 输出人读报告；`-- --format json` 输出 version 1 机器证据；
- 13/13 通过时返回 `ready` 与退出码 0；任一 attention 返回退出码 1；参数或采集致命错误返回 2；
- Node 对照 package engine `>=22.13.0`，npm 与 Git 要求可用并显示版本；
- Git 验证仓库根、main、upstream 与本地 main/origin-main 同步基线，只显示姓名/邮箱是否已配置；
- Workspace 验证 package 身份、11 个关键作者脚本、全部声明依赖的精确安装版本和 5 个固定作者路径；
- Vault 验证 `.obsidian` 与插件 1.13.0 的 manifest/main/styles；
- safety 固定声明 `configurationChanged/filesChanged/credentialsRead/networkChecked` 全为 false；
- Obsidian 新增“检查本机发布环境”，桌面 Vault 才可运行；
- 插件不信任 CLI summary，而是从 observation 独立重算全部 13 项、总数、状态和 repair；
- JSON、schema、路径或 Modal 渲染不可信时只重新运行一次纯文本 doctor；
- doctor 有意不要求工作区为空，合法 inbox 草稿、附件和待复核内容不会制造环境级误报；具体写入边界仍由 publish/review 命令决定。

## 6. 实现方法

环境适配器先读取当前 Node 和 package，再通过固定 Git 子命令取得版本、仓库根、分支、upstream 与最后观察到的本地 tracking ref。姓名和邮箱只在进程内转换为非空布尔值，原值不进入 observation。同步性复用本地 delivery snapshot；因此即使远端目录或网络不可用，doctor 仍只依据本机已经存在的 refs 给出诚实结果。

依赖核对不把 `node_modules` 目录存在当作成功。适配器用当前 Node 直接执行受信 npm 安装目录中的 `npm-cli.js`，读取顶层已安装依赖，再把 package 中 dependencies 与 devDependencies 的每一项按名称和精确版本比较。脚本和路径同样绑定固定清单，额外脚本不会造成失败，缺少任何必需项才产生 attention。

纯分析器是状态的唯一来源：每项从 raw observation 计算 observed/expected/status/resolution，然后汇总 13 项。插件边界再次校验所有 exact keys、类型、路径、OID、布尔值和 safety，并用实际 Vault 根验证 `currentDirectory`；随后独立执行同样的 13 项派生，拒绝伪造的 check、summary、status 或 repair。结构化路径失败时纯文本降级仍保持只读。

## 7. 验证证据

- fail-first：缺少 author doctor 模块、1.13.0 manifest、命令、CSS、package script 和测试契约时按预期失败；
- 定向 author doctor + Obsidian + publishing 测试 52/52；
- 纯函数覆盖健康态和 13 个独立 attention 路由，防止新增检查只影响总数而没有可定位原因；
- 真实 Git fixture 配置完整 package、插件、内容目录与依赖，先同步裸远端，再删除远端目录；doctor 仍返回 ready，证明没有 fetch、push 或其他远端访问；
- 真实 Git doctor 前后 HEAD、index、worktree 与 package 文件逐字节一致；
- 第一次真实 fixture 发现 Windows 上 `spawnSync("npm.cmd", { shell: false })` 返回 `EINVAL`；改为当前 Node + 受信 `npm-cli.js` 后，真实 fixture 与仓库均通过；
- 真实仓库 JSON 报告为 ready、13/13、11/11 脚本、32/32 固定依赖、5/5 路径、MyBlog Publisher 1.13.0；Node v24.14.0、npm 11.9.0、Git 2.37.1.windows.1，main 与本地 origin/main 同步，identity 两项均为 true；
- 第一次完整 `npm run release:check` 用时 208.7 秒：Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、218/218 单元与集成、TypeScript、45 页、19/19 生产应用测试、production audit 0；
- 归档后完整 `npm run release:check` 用时 280.8 秒；相同内容库存、218/218、45 页、19/19 与依赖审计 0 全部保持通过；
- `git diff --check` 通过；没有新增依赖、secret、数据库、Cloudflare、安装/配置写入、凭据读取、网络探测或外部写入 API；
- 功能提交 `7f8ecc124b79851426c4d50865357e6723d11f37` 已推送；Quality Gate、Vercel deployment status、部署后 Verify Vercel production 3/3 success 并绑定该 SHA；
- 真实 Obsidian 宿主像素外观仍未人工截图验收，本轮只声明 DOM、行为、严格 parser 与 CSS 契约。

## 8. 经验与教训

- “工具已安装”必须用可执行版本和契约验证，不能只看文件是否存在；依赖同理，`node_modules` 存在不等于版本正确；
- Git identity 是必要前提，但诊断证据只需要“是否配置”，不需要姓名和邮箱原值；最小化采集比事后遮盖更可靠；
- Windows 的 `.cmd` 启动语义不能假设与可执行文件相同。`shell: false` 直接启动 `npm.cmd` 可能返回 `EINVAL`；使用当前 Node 执行受信 npm CLI 同时保留无 shell 的安全边界；
- 删除测试远端比 mock “没有调用网络函数”更强：任何隐式 fetch/push 都会让真实夹具失败；
- 环境 doctor 不应把工作区干净作为健康条件。写作本身会产生未跟踪草稿、附件和目标修改；将提交范围留给领域门，才能避免前置层误伤正常工作；
- CLI 的派生 summary 不能成为插件信任捷径。由宿主从 raw observation 重算全部检查，才能阻止不一致 JSON 把 HOLD 伪装成 READY；
- 修复建议和自动修复是不同授权。attention 可以提供明确命令，但 doctor 本身保持零写入，便于重复运行与审计；
- fail-first 加真实仓库执行发现了纯 mock 不会暴露的 Windows 进程启动问题；完整门继续证明新增作者工具没有破坏生产构建和运行路径。

## 9. 全局状态、风险与未解决问题

MyBlog Publisher 1.13.0 现在提供作者本机环境的统一只读入口。站点继续以 GitHub 为唯一内容事实源、Vercel 原生托管，不依赖 Cloudflare；Studio/Obsidian 双发布、内容维护、Git 交付分诊、两类安全重送和可信回执保持原状。

doctor 只观察最后保存在本地的 origin/main，不声称知道远端当前状态；也不会检查 GitHub/Vercel 凭据或网络。它解决“能否安全启动本机作者事务”的静态前提，不解决单篇内容质量、工作区影响、待交付恢复或线上部署。当前命令仍需作者显式运行，尚未成为新发布/新复核的强制联锁。真实 Obsidian 主题、超长路径、异常 npm 布局和窄屏像素体验仍需随日常使用观察。

其他长期风险不变：Studio OAuth 与固定 Decap bundle 需要维护；实时外链网络结果不进入硬门；自定义域名、公开邮箱、统计和评论等待所有者选择；`decap-cms` 开发依赖审计与 Actions major tag 指针另行处理。

## 10. 下一轮唯一主任务

为 Obsidian 新发布与新复核事务增加 doctor 前置联锁。调用“检查当前草稿”“发布当前草稿”“检查当前正式内容复核”“提交并同步当前正式内容复核”时，先读取同一个 version 1 doctor；只有 ready 才启动原领域命令，attention 则展示 preflight circuit 并停止。待交付复核/发布 deliver 与所有只读状态/分诊命令继续绕过 synchronized 联锁，避免阻断正确恢复；不自动修复、不合并事务、不接云 API。
