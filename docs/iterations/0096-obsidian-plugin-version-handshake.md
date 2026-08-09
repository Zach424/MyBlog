# Iteration 0096：Obsidian 插件运行时/磁盘版本握手

## 1. 范围与成功标准

本轮只关闭插件更新后的陈旧运行时缺口。仓库同步了新 `manifest.json`、`main.js` 或 `styles.css` 时，已经运行的 Obsidian 可能继续持有旧 CommonJS 实例；旧行为只会把未来 doctor 报告降级为通用纯文本，作者无法判断是否应重载插件。范围不改变 Git 交付协议、sealed receipt、post-delivery handoff、生产等待、内容契约、Studio、Vercel 配置或公开内容。

成功标准是：所有可能进入 Git 写入的正常发布/复核与 recovery delivery 都必须先比较运行 bundle 内嵌版本、Obsidian runtime manifest 版本和 Author Doctor 读取的磁盘 manifest 版本；完全相等才继续。不一致时显示专用无按钮 `PLUGIN RELOAD REQUIRED`，给出三份版本和关闭再启用插件或重启 Obsidian 的步骤，不自动 reload、不运行 Git 领域命令。旧运行时必须能结构化解析未来 patch/minor 磁盘版本，同时真正伪造、缺失或无效的版本证据失败关闭。恢复命令保持在 author transaction lease 外，非版本 attention 不得阻断必要恢复。

## 2. 项目结构状态

- `.obsidian/plugins/myblog-publisher/main.js`：新增完整数字语义版本验证、三方握手、reload interlock 与 recovery version-only preflight；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增 reload 卡片、三列版本账本和窄屏单列布局；
- `.obsidian/plugins/myblog-publisher/manifest.json`：Publisher 升至 1.39.0 并声明 stale runtime interlock；
- `lib/content/author-doctor.ts`：磁盘 doctor 期望版本同步至 1.39.0；
- `tests/obsidian-plugin.test.mjs`：宿主 harness 增加独立 runtime manifest 事实，覆盖版本漂移、未来版本、伪造证据、恢复旁路和磁盘身份缺失；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步 1.39.0 契约；
- README、架构、发布、运维、发现、状态、路线图和本归档继续位于仓库根 Obsidian Vault；Next 页面、内容 Markdown、依赖与 workflow 未改变。

## 3. 设计内容

版本握手使用三个互不替代的事实。`AUTHOR_DOCTOR_PLUGIN_VERSION` 代表当前运行代码实际包含的协议；`this.manifest.version` 是 Obsidian 加载插件实例时赋予的 runtime manifest；doctor 报告中的 `observation.vault.plugin.version` 来自仓库磁盘。只有三者完全相等才是 compatible。把 runtime manifest 单列出来可以捕获 Obsidian 只热读 manifest、却仍运行旧 JavaScript 的情况；把运行代码单列出来则不会相信一个已变化的 runtime 对象替代实际 bundle。

未来磁盘版本不能再由旧 parser 的硬编码 expected 阻断。插件按照 doctor 的磁盘 observation 动态重建 publisher check 的 expected/observed/resolution，并要求版本是 `major.minor.patch` 三段数字；因此 1.39.1、1.40.0 可形成可信但不兼容的结构化证据。报告中的派生 check 若与 observation 不一致仍被拒绝，不能用一个合法版本字符串掩盖伪造字段。

reload interlock 有意没有动作按钮。插件不尝试自行启停、覆盖磁盘文件或调用 Git；它只显示 RUNNING CODE、RUNTIME MANIFEST、DISK 三列证据和人工重载步骤。恢复交付需要在 Git identity 或 local-ahead attention 时仍可用，所以只消费 doctor 的版本身份，不把整个 ready 状态当恢复授权；但版本身份缺失或不可信仍禁止写入。

## 4. 使用的技术

- Obsidian `Plugin.manifest`：作为运行实例加载时的独立版本事实；
- 内嵌运行协议常量与严格 `/^(\d+)\.(\d+)\.(\d+)$/u`：拒绝范围、前缀、预发布和非数字模糊版本；
- Author Doctor version 1 observation/check 重派生：允许未来磁盘版本结构化通过完整性解析，而不是放宽任意报告字段；
- 冻结的 `compatible | reload-required | unavailable` 握手结果：Modal 与命令门共享单一判定；
- Obsidian 原生 Modal/Notice 与 CSS grid：显示三份版本、事务来源和人工恢复步骤；
- recovery version-only doctor：复用固定无 shell npm 参数、stdout schema 和 exit 0/1 语义，不占用 author transaction lease；
- Node test VM 宿主、可控 runtime manifest 和模拟子进程：证明零领域 spawn、零按钮和普通 attention 恢复可达；
- `research-iteration-loop` skill：失败优先、单缺口实现、局部门、完整门、真实生产和下一唯一任务。

## 5. 实现的功能

1. Publisher 1.39.0 在四个正常 author transaction 通过 doctor 后、任何领域命令 spawn 前创建三方版本握手；
2. 三份版本相等且 doctor ready 时保持原快速路径，只启动一次原领域命令；
3. 任一版本漂移时打开 `PLUGIN RELOAD REQUIRED`，列出 RUNNING CODE、RUNTIME MANIFEST、DISK，不提供继续按钮；
4. Notice 明确原发布/复核操作未启动，并要求关闭再启用 MyBlog Publisher 或重启 Obsidian；
5. 显式“检查本机发布环境”也显示相同 reload 证据，不把 ready doctor 误报为运行时可用；
6. doctor parser 接受未来完整数字 patch/minor 版本，按 observation 动态验证 publisher check；
7. check observed/expected/resolution 与 observation 不一致时继续降级纯文本并失败关闭，不信任伪造 JSON；
8. “重新同步待交付正式内容复核”和“重新同步待交付新内容发布”先运行相同 JSON doctor，只验证版本兼容后再启动原 recovery deliver；
9. recovery preflight 不创建作者事务 lease，Git identity、local-ahead 等非版本 attention 仍允许恢复；
10. recovery 遇版本漂移显示同一 reload interlock；磁盘插件身份缺失、runtime manifest 无效或报告不可信时不启动 Git 恢复；
11. 普通只读状态、当前草稿作者意图、维护与生产检查不变，版本门不被扩大为全插件禁用；
12. README、发布、运维、架构和发现文档同步 1.39.0 行为与人工重载边界。

## 6. 实现方法

先把宿主 harness 的 `Plugin` 补上可独立控制的 `this.manifest`，再写失败测试。旧插件在 runtime manifest 1.38.0、运行代码/磁盘 1.39.0 时仍启动第二个领域进程；两条 recovery 直接启动 deliver，不先 doctor；1.39.1/1.40.0 报告因硬编码 1.38.0 检查退化为纯文本。这三类失败证明测试命中了真实缺口。

实现时先让 `deriveAuthorDoctorChecks()` 根据 observation 中的磁盘版本生成 publisher expected 和 repair，同时保持 id、desktop、main/styles 及完整数字版本约束。`parseAuthorDoctorReport()` 仍对精确 key、summary、所有派生 check 与 safety 做原验证，只把“必须等于当前版本”替换成“必须是可验证版本”。因此未来版本不再是假报告，字段伪造仍是假报告。

`createAuthorDoctorPluginVersionHandshake()` 冻结三份版本和状态。正常事务在 doctor parse 后立即调用它：reload-required 直接开 Modal 并让租约以 held 结算；ready/compatible 才进入原 callback。显式 doctor 同样把握手交给 Modal，因此运行时漂移不会显示 AUTHOR READY。

恢复路径抽出 `preflightRecoveryDeliveryVersion()`，固定执行 `content:author:doctor -- --format json` 并接受 exit 0/1。它有意不调用 author lease；可信 compatible 即使 report 有非版本 attention 也进入原 delivery，reload-required 显示 interlock，unavailable 或 parser 异常通过现有 command failure Notice 失败关闭。原 receipt/handoff/reconcile/wait 实现移动到私有运行方法，证据协议没有改动。

## 7. 验证证据

- 失败优先：正常发布在 runtime manifest 1.38.0 下错误 spawn 领域命令；recovery 未先运行 doctor；未来 1.39.1/1.40.0 磁盘报告退化为纯文本；
- 新边界回归通过：正常事务和 recovery 漂移均零领域 spawn、零按钮；未来 patch/minor 显示结构化三列版本；伪造 check 退化并关闭；非版本 attention 继续 recovery；磁盘身份缺失零 recovery；
- `tests/obsidian-plugin.test.mjs` 全部通过；插件、doctor、发布与复核交付联合定向回归全部通过；
- ESLint、TypeScript、`git diff --check` 通过；
- 真实 Author Doctor：13/13 ready、13/13 必需脚本、32/32 固定依赖、五类路径全部存在、Publisher 1.39.0；配置、凭据、文件与网络 safety 均为 false；
- 首次完整 `npm run release:check`：用时 125.7 秒，462/462 单元与集成、TypeScript、47/47 构建路由、20/20 真实应用测试、九路 HTML raw/gzip 预算、生产依赖审计 0；
- 状态、路线图和本归档写入后第二次 `npm run release:check`：用时 128.8 秒，同样保持 462/462、47/47、20/20、九路预算全部 PASS、生产依赖审计 0 与全部内容/媒体/外链本地状态不变；
- 功能提交：`82dd8a0c460712918b3ed198f2c29105d124964a`；父提交：`9fb8776ed0a6a1a33596e5126f5622acbcd9bc7d`；
- [Quality Gate #178](https://github.com/Zach424/MyBlog/actions/runs/31334703695) 与 [Production Smoke #171](https://github.com/Zach424/MyBlog/actions/runs/31334729268) 均成功；
- 真实稳定生产冻结参数等待：`content/projects/myblog.md` 在 1 次、1267 ms 内返回 deployed；来源 SHA-256 为 `f8099473652329e06343194baaf48e7c65a8f1a53ea7f6c092fe5a20f344daf4`，Markdown ETag digest 为 `ab62e9d92481f053474c6a29d0dd6413076b59927c99f123002346dd214fd303`；
- 最终生产清单快照 ETag 为 `W/"sha256-88aa4a0c0cae5890a15b9f13ecaeeeb79d3d47f43c60dbcde23915e7ad2debbb"`，Last-Modified 为 `Thu, 06 Aug 2026 00:00:00 GMT`。

## 8. 经验与教训

磁盘 manifest 与运行实例的 manifest 不是同一个事实。插件管理器可能已经读取新 metadata，但 JavaScript 仍是旧闭包；只比较两个 manifest 会产生假兼容。运行代码必须自报它实际实现的协议版本，才能构成可解释的三方证据。

面向未来不等于跳过验证。允许未来 patch/minor 的正确方式是从受限 observation 重建所有派生 check，再精确比较报告，而不是忽略 expected 或接受未知字段。这样旧 runtime 既能准确提示重载，也不会把任意 JSON 当可信 doctor。

恢复命令需要区分“环境是否完全 ready”和“本次恢复是否具备版本安全”。local ahead 正是 recovery 的正常前提，把完整 doctor status 当授权会自我封锁；但完全绕过 doctor 又会让陈旧 runtime 执行写操作。version-only preflight 是更窄且可证明的边界。

安全 interlock 不应提供一个诱导作者继续的按钮。重载插件会改变宿主生命周期，当前运行代码无法可靠证明自己已被替换；显示精确证据并把控制权交还 Obsidian 是诚实边界，也保留了零自动 Git 的约束。

## 9. 全局状态、风险与未解决问题

网页 Studio 与 Obsidian 都可由作者独立发布；GitHub 仍是内容与版本唯一事实源，Vercel 仍是当前生产托管，不依赖 Cloudflare、数据库或 Codex。正常 publication/review、recovered publication/review 四条交付路径都使用 sealed Git 证据、可信 handoff、Vault reconcile 和同一生产等待；其中所有六个潜在 Git 写入口现在都先通过版本握手。

显著风险已从“陈旧 runtime 无法说明原因”收窄为“同版本磁盘 bundle 局部同步”。doctor 当前验证 manifest 的 id/version/desktop 和 main/styles 存在，但没有证明三份文件来自同一 release；如果同步工具只替换 main.js 或 styles.css 而保留同版本 manifest，三方版本仍可能一致。真实 Obsidian 主题下 reload 卡片和连续 Modal 的视觉密度也仍需首次人工观察；Node 24 代理仍需 `NODE_USE_ENV_PROXY=1`。

回滚功能提交使用 `git revert 82dd8a0c460712918b3ed198f2c29105d124964a`。该提交没有数据库迁移、内容或外部配置变化；回滚会把 Publisher/Doctor 恢复到 1.38.0 并移除版本握手，但保留全部 Git receipt/handoff、恢复交付、生产等待与公开站点。

## 10. 下一轮唯一主任务

为 MyBlog Publisher 增加磁盘 bundle 完整性契约。设计一份确定性、可复算且避免 `main.js` 自引用哈希的 release 身份，证明 `manifest.json`、`main.js` 与 `styles.css` 来自同一构建；Author Doctor 要结构化报告各文件摘要或 build identity，并在文件缺失、局部更新、摘要漂移、非法版本或未知字段时失败关闭。运行时复用本轮的三方版本 interlock，不自动下载、覆盖、重载或执行 Git，也不扩展为远程签名分发系统。
