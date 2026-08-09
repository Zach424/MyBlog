# Iteration 0098：Obsidian 插件 Git provenance

## 1. 范围与成功标准

本轮只关闭 Iteration 0097 留下的来源缺口。`bundle.json` 已能证明 `main.js`、`manifest.json`、`styles.css` 的当前磁盘字节彼此属于同一份显式生成的 bundle，但 `--write` 可以为任意未提交字节生成合法摘要；仅有摘要不能证明这四个路径被 Git 跟踪、来自哪个提交，或与 index/worktree 是否一致。

成功标准是：保留已发布的 doctor v1（13 项）与 v2（14 项）原 schema；新增显式协商的 v3（15 项），把四个固定路径绑定到同一份冻结 `localHead` tree/blob，并分别报告 index 与 worktree 状态；MyBlog Publisher 1.41.0 的四个正常事务和两条 recovery writer 都请求 v3。版本、bundle、provenance 三类失败必须进入互相独立的无按钮 interlock；来源异常时不执行 add、commit、push、fetch、reset、descriptor 生成、覆盖或自动重载。本轮不改变内容契约、交付 receipt/handoff、生产等待、网页 Studio、Vercel 配置或公开内容。

## 2. 项目结构状态

- `lib/content/publisher-plugin-provenance.ts`：新增四路径顺序、version 1 observation、verified 判定、规范化描述与深拷贝；
- `lib/content/author-doctor.ts`：插件版本升至 1.41.0，新增 doctor v3、`publisher-provenance` 第 15 项检查与 v2→v3 证据组合；
- `scripts/author-doctor-environment.mjs`：只读观察冻结 localHead、HEAD tree blob、index blob、staged 与 worktree 状态；
- `scripts/report-author-doctor.mjs`：新增 `--plugin-provenance`，JSON v1/v2/v3 明确协商，默认文本使用 v3；
- `.obsidian/plugins/myblog-publisher/main.js`：严格消费并重派生 v3，六个 writer 请求 provenance，新增专用握手状态与 Modal；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增 provenance 四路径证据卡与窄屏布局；
- `.obsidian/plugins/myblog-publisher/manifest.json` / `bundle.json`：Publisher 升至 1.41.0 并重建三文件 SHA-256；
- `tests/author-doctor.test.mjs`：真实临时 Git 仓库覆盖 clean、unstaged、staged 与恢复；
- `tests/obsidian-plugin.test.mjs`：覆盖正常/recovery writer 的 provenance hold、零按钮与零第二进程，并更新 v3 计数和未来版本兼容；
- `tests/obsidian-publishing.test.mjs`：锁定 1.41.0 manifest 与确定性 descriptor；
- README、架构、发现、发布、运维、状态、路线图与本归档同步更新；Next 页面、内容 Markdown、依赖版本和 workflow 未改变。

## 3. 设计内容

报告演进继续采用命令级协商，而不是给旧 schema 塞可选字段。`--format json` 仍返回 v1；追加 `--plugin-bundle` 仍返回 v2；追加 `--plugin-provenance` 才返回 v3，同时隐含完整 bundle 证据。两个增强 flag 互斥；人类文本默认取最新 v3。这样仍运行 1.39/1.40 的代码能取得自己已经发布的严格形状，而 1.41 不需要容忍缺字段。

provenance observation 顶层只有 `version/headOid/files`。files 固定为 bundle、main、manifest、styles 四条，每条只有 path、present、headBlobOid、indexBlobOid、indexStatus、worktreeStatus、status。verified 要求普通文件存在、冻结 HEAD blob 合法、index blob 与其完全相等、index/worktree 都 clean，且派生 status 也是 verified。插件不信任报告中的 check 文本：它验证 exact keys、路径顺序、OID、状态派生、`headOid === observation.repository.localHead`、15 项 checks、summary、status 与 safety 后才建立握手。

握手优先级固定为 version → bundle → provenance → compatible。先处理版本可确保仍运行旧代码时看到 reload；版本一致但摘要坏时看到 bundle 修复语义；两者都通过、只有 Git 来源异常时才显示 `PLUGIN PROVENANCE UNVERIFIED`。Modal 列出每个路径的 HEAD/INDEX 短 OID与 INDEX/WORKTREE 状态，不提供继续按钮。recovery 仍可旁路 Git identity/local-ahead 等一般 attention，但不可旁路 bundle 或 provenance。

## 4. 使用的技术

- `git rev-parse <frozen-localHead>:<path>`：从同一不可变提交读取四个 tree blob，避免观察期间符号名 HEAD 移动后混入另一棵 tree；
- `git rev-parse :<path>`：读取当前 index blob，不借助 porcelain 文本解析；
- `git diff --cached --quiet -- <path>` / `git diff --quiet -- <path>`：固定 pathspec、无 shell 地区分 staged 与 worktree 状态；
- Node `spawnSync(..., shell: false)`：所有参数为仓库常量，不执行网络与 Git 写操作；
- v1/v2/v3 协商、exact-key parser 与派生检查：兼容旧 runtime，同时拒绝伪造 report/check/summary；
- Obsidian VM harness 与真实临时 Git fixture：分别验证 UI/进程边界和真实 object/index/worktree 语义；
- `research-iteration-loop` skill：失败优先、单一缺口、完整门、真实生产、全局复盘与下一项唯一任务。

## 5. 实现的功能

1. `--plugin-provenance` JSON 输出 v3、15 项检查、bundle 与逐路径 Git observation；
2. 默认文本升级为 v3；legacy JSON v1 与显式 bundle JSON v2 保持 13/14 项和原字段集合；
3. clean 仓库中四个插件路径分别证明 present、HEAD/index blob 相等、index/worktree clean；
4. 未暂存文件显示 `worktree: changed`，已暂存文件显示 `index: changed` 且 HEAD/index blob 不同；
5. 四个 HEAD blob 都从一次冻结的 `localHead` 读取，观察过程中的 HEAD 符号名漂移不会改变树来源；
6. Publisher 1.41.0 的显式 doctor、四个作者事务和两条恢复交付固定请求 v3；
7. provenance 不可信时正常与 recovery writer 都只启动 doctor，不进入领域 Git；
8. `PLUGIN PROVENANCE UNVERIFIED` 展示四路径、HEAD/INDEX 短 OID、INDEX/WORKTREE 状态和正常 Git 修复边界；
9. interlock 无按钮，不自动 add/commit/push/fetch/reset、生成 descriptor、覆盖、重载或重试；
10. bundle descriptor 更新为 `myblog-publisher@1.41.0` 并继续通过默认只读复算。

## 6. 实现方法

失败优先先扩展真实 doctor fixture：旧脚本对 `--plugin-provenance` 返回 unknown option；插件正常发布与 recovery 仍发送 `--plugin-bundle`。然后加入 provenance 专用 VM 测试，要求两个 writer 在 worktree changed 时零第二进程、零按钮，并显示专用标题与不执行 Git 写命令的说明。

实现先建立纯 provenance 模块，再让环境检查在现有 v1 report 上顺序组合 bundle v2 与 provenance v3。临时仓库先改 `styles.css` 验证 unstaged，再暂存验证 index changed，最后恢复原字节与 index，确保后续 forged descriptor 测试不被污染。脚本只根据显式 flag 选择 schema；插件 parser 从原始 observation 重新派生全部 15 项，不消费报告作者给出的 pass 结论。

首次功能提交上线后做全局复盘，发现若逐路径使用符号名 `HEAD:<path>`，理论上 HEAD 在多次命令之间移动会让 blob 来自另一棵 tree，而顶层仍保留旧 localHead。随即用独立修正提交把 ref 改成已冻结的 `${headOid}:<path>`；index blob 相等判断继续负责证明 index 对应同一树，worktree diff 只比较工作区与 index。该修正不改 schema，但使“同一 HEAD tree”从时间假设变为参数级事实。

## 7. 验证证据

- 失败优先：真实 fixture 返回 `Unknown option '--plugin-provenance'`；正常与 recovery writer 的命令参数仍是 `--plugin-bundle`；
- 定向回归：真实 doctor clean/unstaged/staged 三态通过；版本漂移、未来 patch/minor、normal/recovery provenance hold 全通过；
- 开发中兼容证据：插件文件未提交时 v1 `ready 13/13`、v2 `ready 14/14`，v3 `needs-attention 14/15` 且四路径均为 worktree changed；
- 提交并同步后真实 doctor：v1 `ready 13/13`、v2 `ready 14/14`、v3 `ready 15/15`；最终 `headOid=dabc9ce53eea514715ab7ee7e7833e11728bc239`，四路径 HEAD/index OID 各自相等且两层 clean；
- 当前 bundle：main `e891a0f9aea4480193c9ecb67ca1847ab135e592b036905a147702ce3dfff031`、manifest `505c1220e0b72080d94f960b4f07a06132be1a22e6b95aa4015451adc40f891d`、styles `96790818e721c9d5a3427e9d46902ab3044390de69420696455fbffc837bd572`；
- ESLint、TypeScript、`git diff --check` 与 bundle 默认复算通过；
- 首次完整 `npm run release:check`：114.4 秒，468/468 单元与集成测试、47/47 构建路由、20/20 真实应用检查、九路 HTML raw/gzip 预算、生产依赖审计 0；
- 状态、路线图与本归档写入后第二次完整 `npm run release:check`：112.6 秒，同样保持 468/468、47/47、20/20、九路预算全 PASS 与生产依赖审计 0；
- 功能提交：`2ebefe347cafd506b26d151084805eb4d4737d58`；竞态修正：`dabc9ce53eea514715ab7ee7e7833e11728bc239`；
- [Quality Gate #182](https://github.com/Zach424/MyBlog/actions/runs/31337907641) / [Production Smoke #175](https://github.com/Zach424/MyBlog/actions/runs/31337929515) 与 [Quality Gate #183](https://github.com/Zach424/MyBlog/actions/runs/31338090575) / [Production Smoke #176](https://github.com/Zach424/MyBlog/actions/runs/31338115812) 均成功；
- 最终真实生产等待：`content/projects/myblog.md` 在 1 次、1244 ms 内 deployed；来源 SHA-256 `f8099473652329e06343194baaf48e7c65a8f1a53ea7f6c092fe5a20f344daf4`，Markdown ETag digest `ab62e9d92481f053474c6a29d0dd6413076b59927c99f123002346dd214fd303`；
- 生产清单 ETag 保持 `W/"sha256-88aa4a0c0cae5890a15b9f13ecaeeeb79d3d47f43c60dbcde23915e7ad2debbb"`，Last-Modified `Thu, 06 Aug 2026 00:00:00 GMT`。

## 8. 经验与教训

内容摘要与来源证明不能混为一谈。descriptor 回答“这些当前 bytes 是否属于同一显式 bundle”，Git provenance 回答“这组路径是否来自受版本控制的提交”。把两者分成独立 check 和 interlock，才能既给出准确修复路径，也避免把本地 `--write` 错称为签名。

兼容性应由调用方显式选择，而不是让一个严格 parser 无限容忍可选字段。旧 runtime 继续请求自己认识的 v1/v2，新 runtime 请求 v3；三份 schema 都可以 exact 验证。这样磁盘先更新、运行代码后重载的真实时序不会再次把可行动的版本漂移退化成纯文本。

“读取 HEAD”还不等于“绑定同一个 HEAD”。对多命令 observation，符号 ref 可能在步骤之间变化；只要上游已经冻结提交 OID，后续 tree lookup 就应直接使用该 OID。index 与 worktree 同样分别建模，不能用一个 `git status clean` 模糊掉 staged/unstaged 的不同修复语义。

## 9. 全局状态、风险与未解决问题

网页 Studio 与 Obsidian 都能由作者独立发布；GitHub 仍是内容和版本唯一事实源，Vercel 是当前生产托管，不依赖 Cloudflare、数据库或 Codex。六个 Git writer 现在共同要求运行版本、磁盘 bundle 与冻结 HEAD/index/worktree provenance 三层证据；正常与恢复交付仍共享 sealed receipt、handoff 与生产等待，provenance 不改变任何已发布内容协议。

自动化剩余的主要风险已从协议正确性转为真实桌面体验：VM harness 能证明 DOM、文本、按钮和进程边界，但不能证明当前 Obsidian 主题中的视觉密度、Modal 连续切换、长 OID/ETag 折行和 Notice 持续时间。Node 24 在本机代理环境下仍需要 `NODE_USE_ENV_PROXY=1` 并重启 Obsidian。统计、评论、自定义域名和公开邮箱仍等待所有者选择，不阻塞博客发布。开发依赖中的 Decap 上游审计项、Actions 不可变 pin 主动更新、内容规模增长后的 feed/manifest 成本继续保留为长期风险。

回滚本轮功能可依次执行 `git revert dabc9ce53eea514715ab7ee7e7833e11728bc239` 与 `git revert 2ebefe347cafd506b26d151084805eb4d4737d58`。回滚会移除 v3 provenance 和 1.41 interlock，恢复 1.40 的 v2 bundle 保护；不会迁移内容、数据库或外部配置，也不影响 receipt/handoff 与生产等待协议。

## 10. 下一轮唯一主任务

执行 MyBlog Publisher 1.41.0 的首次真实 Obsidian 端到端验收。先在 clean/synchronized 仓库运行无写入 doctor，观察 15/15 与三个专用 interlock 的真实主题布局；再用可丢弃测试草稿完成一次正常发布，记录 transaction、receipt、Vault reconcile、生产等待和本机代理继承。任何异常保留精确现场并回到对应证据层，不绕过 doctor、不重复 push、不用自动 Git 修复换取通过。
