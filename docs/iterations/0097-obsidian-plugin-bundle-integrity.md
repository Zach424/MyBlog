# Iteration 0097：Obsidian 插件 bundle 完整性

## 1. 范围与成功标准

本轮只关闭 Iteration 0096 留下的同版本局部同步缺口。三方版本握手能识别运行代码、runtime manifest 和磁盘 manifest 的版本漂移，却只证明 `main.js` / `styles.css` 存在；若同步工具只替换同版本 release 的一部分文件，版本仍可能完全相等。范围不改变发布/复核领域命令、sealed receipt、post-delivery handoff、生产等待、内容契约、Studio、公开内容或 Vercel 配置，也不引入远程下载或签名服务。

成功标准是：仓库保存一份确定性且不自我哈希的 descriptor，按固定顺序绑定 `main.js`、`manifest.json`、`styles.css` 的 SHA-256 与插件 id/version；只读命令能复算，显式写命令能在受控开发后重建；Author Doctor 同时保留旧 runtime 可消费的 version 1 和含完整 bundle 证据的 version 2；MyBlog Publisher 1.40.0 的四个作者事务与两条 recovery delivery 都固定请求 v2，只有三方版本兼容且 bundle verified 才进入 Git。缺失、符号链接、未知字段、局部更新或摘要漂移必须显示专用无按钮 `PLUGIN BUNDLE INVALID`，不自动生成、覆盖、重载或运行 Git。

## 2. 项目结构状态

- `.obsidian/plugins/myblog-publisher/bundle.json`：新增 release descriptor，固定 contract、算法、插件身份和三个文件摘要；
- `.obsidian/plugins/myblog-publisher/main.js`：Publisher 升至 1.40.0，消费 doctor v2、重派生 bundle 证据并为正常/恢复 writer 增加 bundle-invalid interlock；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增 descriptor 状态、逐文件 expected/observed 短摘要与窄屏布局；
- `.obsidian/plugins/myblog-publisher/manifest.json`：版本升至 1.40.0；
- `lib/content/publisher-plugin-bundle.ts`：新增 exact-schema descriptor parser、确定性生成、SHA-256 观察与 verified 判定；
- `lib/content/author-doctor.ts`：保留 13 项 version 1，新增第 14 项 bundle check 的 version 2；
- `scripts/author-doctor-environment.mjs`：只读取普通插件文件，规范化 descriptor 与三文件摘要；
- `scripts/report-author-doctor.mjs`：新增 `--plugin-bundle`；JSON 无参数保持 v1，默认 text 和显式参数使用 v2；
- `scripts/manage-publisher-plugin-bundle.mjs`、`package.json`：新增默认只读验证、显式 `--write` 生成的 `plugin:bundle`；
- 三组测试及 README、架构、发布、运维、发现、状态、路线图和本归档同步更新；Next 页面、内容 Markdown、依赖版本与 workflow 未改变。

## 3. 设计内容

descriptor 不包含 `bundle.json` 自身摘要，因此不会形成无法求值的自引用哈希。顶层只允许 `version / algorithm / plugin / files`，算法固定 `sha256`，插件固定 `myblog-publisher@<major.minor.patch>`，files 必须恰好按 main、manifest、styles 排列且每个只含 path/sha256。环境检查先以 `lstat` 拒绝符号链接，再读取原始 bytes；descriptor 被规范化为 valid/invalid/missing，每个文件被规范化为 verified/mismatch/missing/untrusted。插件不相信 check 文本，而是再次验证 exact keys、路径顺序、摘要格式、状态派生、插件版本、summary 和 safety。

报告采用协商兼容而不是直接破坏 version 1。`content:author:doctor -- --format json` 继续输出旧 13 项 v1，使仍在运行的 1.39 代码面对磁盘 1.40 时能完成上一轮的结构化版本握手并准确要求 reload；1.40 的三个内部 doctor 调用追加 `--plugin-bundle`，只接受 14 项 v2。人类不带参数的 text 默认使用 v2。这样旧 runtime 不认识新增字段的问题被命令级协商隔离。

bundle 失败与版本漂移分开显示。版本漂移仍优先进入 `PLUGIN RELOAD REQUIRED`；版本相等但 descriptor/摘要不可信进入 `PLUGIN BUNDLE INVALID`，显示 bundle.json 状态和三个文件的摘要短迹。两个 Modal 都没有继续按钮。恢复命令仍在 author transaction lease 外并允许 Git identity/local-ahead 等非版本 attention，但 bundle 必须 verified，防止恢复旁路绕过完整性。

## 4. 使用的技术

- Node `crypto.createHash("sha256")` 与原始 `Uint8Array`：摘要绑定真实磁盘 bytes；
- exact-key JSON descriptor、固定路径顺序和完整数字语义版本：拒绝未知字段、重复/重排文件和模糊版本；
- `lstat` + `readFile`：只接受普通文件并拒绝符号链接；
- v1/v2 命令级报告协商：旧插件继续请求 legacy，新插件显式请求 bundle；
- 纯函数 descriptor create/parse/observe/verify：生成器、doctor 与测试共享权威规则；
- Obsidian VM harness：验证 normal/recovery 都零领域 spawn、零按钮，非版本 attention 仍可恢复；
- 真实临时 Git 仓库：验证完整 descriptor、单文件局部更新和 unknown-field 伪造；
- `.gitattributes` LF 与实际字节审计：保证 Windows 生成摘要在 Linux Actions checkout 中稳定；
- `research-iteration-loop` skill：失败优先、局部门、完整门、真实生产、全局复盘和下一唯一任务。

## 5. 实现的功能

1. `npm run plugin:bundle -- --write` 从当前 manifest 读取插件版本，对三个普通文件生成固定顺序 descriptor；
2. `npm run plugin:bundle` 默认只读复算并输出 VERIFIED/HOLD，不修改任何文件；
3. descriptor exact parser 拒绝未知字段、错误算法、非法版本、路径重排、摘要格式和多余文件；
4. doctor 观察将缺失文件标为 missing、无可信 descriptor 的现存文件标为 untrusted、摘要不同标为 mismatch；
5. legacy JSON v1 继续返回 13 项，保持 1.39 旧 runtime 的未来磁盘版本提示；
6. `--plugin-bundle` JSON 与默认 text 返回 v2、14 项和 `pluginBundle` expected/observed 证据；
7. Publisher 1.40.0 的显式 doctor、四个作者事务和两条 recovery preflight 都固定请求 v2；
8. 插件从规范化 observation 重新派生第 14 项 check，并拒绝伪造状态、摘要、summary 或 safety；
9. 三方版本相等但 bundle 不完整时显示 `PLUGIN BUNDLE INVALID`、descriptor 状态和逐文件 MISMATCH/MISSING/UNTRUSTED；
10. normal/recovery 均不进入领域命令；recovery 仍允许 bundle verified 的普通非版本 attention；
11. 当前仓库 descriptor 绑定 LF bytes，并由完整发布门内的发布包测试逐文件复算；
12. README、架构、发布、运维和发现文档说明生成、验证、重载与“不要为未知文件运行 --write”的边界。

## 6. 实现方法

失败优先先覆盖三条路径：发布包测试读取不存在的 `bundle.json` 立即 ENOENT；插件测试要求新增 `--plugin-bundle` 时旧命令参数不匹配；真实 doctor 夹具先放入 1.40 manifest，旧 1.39 契约将其判为 attention。随后为正常发布和 recovery 各加入一条摘要 mismatch 测试，要求零第二进程、零按钮和专用 bundle 文案。

实现先建立纯函数模块。生成函数只消费 version 与三个 bytes；parser exact 验证 descriptor；observer 无论 descriptor 是否可信都计算实际文件摘要，但无 descriptor 时不制造 expected 值；verified 要求 descriptor valid、插件 id/version 等于磁盘 manifest、三文件顺序固定且 expected=observed。Author Doctor 在既有 v1 report 后追加 bundle check 构成 v2，不复制基础环境分析。

环境检查一次并行读取 bundle/main/manifest/styles，所有读取都经过普通文件守卫。脚本按调用方式选择报告：JSON 只有显式 flag 才升级，text 默认升级。插件常量改为 v2 并固定追加 flag；parser 先验证基础 observation，再验证 descriptor 状态与每个文件 status 的可重算关系，最后重派生 14 checks。握手状态扩展为 compatible/reload-required/bundle-invalid/unavailable，版本漂移优先于 bundle。

生成 descriptor 后再次运行默认 verifier，并检查三个摘要文件实际均为 LF。后续任何 main/manifest/styles 改动都会使 `tests/obsidian-publishing.test.mjs` 与 `npm run plugin:bundle` 失败，要求受控重建；descriptor 自身 exact schema 仍由测试和 doctor 独立验证。

## 7. 验证证据

- 失败优先：缺少 `bundle.json` 产生 ENOENT；旧插件 doctor 参数缺少 `--plugin-bundle`；旧 doctor 把磁盘 1.40 判为 Publisher 1.39 attention；
- 真实临时仓库：完整 bundle v2 为 14/14；只改 `styles.css` 返回 2/3、styles mismatch；descriptor 增加 unknown 字段返回 invalid 且三文件 untrusted；恢复原 bytes 后 Git surface 仍与基线相同；
- 插件 VM：normal publication 与 recovered review 的 bundle mismatch 都只启动 doctor，显示无按钮 `PLUGIN BUNDLE INVALID`，不进入 Git；完整宿主回归全部通过；
- 当前 descriptor 默认复算：`myblog-publisher@1.40.0 · 3/3 SHA-256 files`；main `40bc06fe405656f165cceb03c475602b1fe5866777b58142a4149095af2a4790`，manifest `ac31e41a782521236fa70d0fcb615a213e795d3cb9edf8ab6762d862baf88216`，styles `60b756d3c7b7fd94c75ea9d1abbbca1faf9ae2de2bccf3ca217f1a5b92b344ae`；
- 跨平台字节：`.gitattributes` 对四文件为 `text=auto, eol=lf`，三个摘要文件当前 CRLF 计数均为 0；
- 真实 Author Doctor：legacy v1 13/13 ready；bundle v2 14/14 ready、descriptor valid、三文件 verified、Publisher 1.40.0；
- ESLint、TypeScript、`git diff --check` 与联合 plugin/doctor/publishing 回归通过；
- 首次完整 `npm run release:check`：用时 129.0 秒，465/465 单元与集成、TypeScript、47/47 构建路由、20/20 真实应用测试、九路 HTML raw/gzip 预算、生产依赖审计 0；
- 状态、路线图和本归档写入后再次验证 bundle，并完成第二次 `npm run release:check`：用时 114.3 秒，同样保持 465/465、47/47、20/20、九路预算全部 PASS、生产依赖审计 0 与全部内容/媒体/外链状态不变；
- 功能提交：`5890e5a06c03cca0a378dbc6fa6cf43665304af5`；父提交：`9927e60c45ecca8dda2b826f6d7241ea2846db0f`；
- [Quality Gate #180](https://github.com/Zach424/MyBlog/actions/runs/31336409712) 与 [Production Smoke #173](https://github.com/Zach424/MyBlog/actions/runs/31336436650) 均成功；
- 真实稳定生产冻结参数等待：`content/projects/myblog.md` 在 1 次、1263 ms 内返回 deployed；来源 SHA-256 为 `f8099473652329e06343194baaf48e7c65a8f1a53ea7f6c092fe5a20f344daf4`，Markdown ETag digest 为 `ab62e9d92481f053474c6a29d0dd6413076b59927c99f123002346dd214fd303`；
- 生产清单 ETag 仍为 `W/"sha256-88aa4a0c0cae5890a15b9f13ecaeeeb79d3d47f43c60dbcde23915e7ad2debbb"`，Last-Modified 为 `Thu, 06 Aug 2026 00:00:00 GMT`。

## 8. 经验与教训

摘要清单不能包含自身，否则“文件内容包含自己的最终摘要”形成循环。把 descriptor 排除在 files 之外，再用 exact schema 和三个目标摘要保护它的声明结构，足以解决同步完整性而不伪装成密码学签名。

报告演进必须考虑磁盘脚本先更新、运行插件后重载的真实时序。若直接把 version 1 加字段或升版，1.39 会再次只得到纯文本。保留 legacy 命令形状、让新 runtime 显式协商 v2，比在一个 schema 里无限容忍可选字段更容易严格验证。

“摘要匹配”与“来源可信”是两个不同命题。descriptor 能证明三个当前工作区文件彼此属于作者显式确认的一组，但 `--write` 本身可以为任意 bytes 生成摘要；因此文档明确区分受控开发和普通同步故障，下一轮再补 Git provenance，而不是把本轮 descriptor 称为签名。

恢复路径的非版本 attention 旁路必须继续收窄。local-ahead 是 recovery 的正常现场，但 bundle mismatch 不是；把握手状态明确拆成 bundle-invalid，避免用通用 `report.status` 误放行或误阻断。

## 9. 全局状态、风险与未解决问题

网页 Studio 与 Obsidian 都可由作者独立发布；GitHub 是内容与版本唯一事实源，Vercel 是当前生产托管，不依赖 Cloudflare、数据库或 Codex。四条正常/恢复交付路径共享 sealed Git 证据、handoff 与生产等待，六个 Git writer 现在同时要求版本兼容和 bundle verified。descriptor 的生成与验证是本地维护工具，不进入公开运行时或网络。

当前显著缺口是 Git provenance。`bundle.json` 与三个目标文件还没有在 doctor 报告中证明被 Git 跟踪、与 index/HEAD 相同、来自同一 tree；开发者显式 `--write` 后可让一组未提交 bytes 通过摘要检查。正常内容发布会在领域门拒绝代码改动，但恢复路径的最窄前置证据应该直接表达这个事实。报告继续演进时还必须保持已发布 v2 请求可用。真实 Obsidian 主题下 bundle 卡片、长摘要和连续 Modal 仍需首次人工观察；Node 24 代理仍需 `NODE_USE_ENV_PROXY=1`。

回滚功能提交使用 `git revert 5890e5a06c03cca0a378dbc6fa6cf43665304af5`。该提交没有数据库迁移、内容或外部配置变化；回滚会删除 bundle descriptor/生成器/v2 doctor，把 Publisher/Doctor 恢复到 1.39.0，并保留版本握手、全部 Git receipt/handoff、恢复交付、生产等待与公开站点。

## 10. 下一轮唯一主任务

为插件 bundle 增加只读 Git provenance。通过一个显式协商的下一版 doctor 报告，证明 `bundle.json`、`main.js`、`manifest.json`、`styles.css` 都被 Git 跟踪，工作区与 index 未修改，并将每个路径绑定到同一 HEAD tree/blob；已经发布的 v1/v2 请求必须继续输出原 schema。正常和 recovery Git writer 在 provenance 缺失、staged/unstaged、blob 不一致或不可信报告时显示专用无按钮 hold，不执行 add/commit/push/fetch/reset，不把本地 descriptor 生成当成发布来源签名，也不引入远程签名服务。
