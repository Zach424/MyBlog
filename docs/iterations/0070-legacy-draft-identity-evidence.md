# Iteration 0070：旧式草稿身份取证与原子清理

日期：2026-08-06
状态：完成
唯一主任务：让作者在 Obsidian 中独立判断旧式 inbox 草稿的身份是否一致，并只在单文件原子语义可以证明安全时移除一条完全匹配的冗余 `slug`。

## 1. 范围与成功标准

Iteration 0069 已让新草稿只以 `content/inbox/<slug>.md` 的文件名保存身份，但旧模板留下的草稿仍可能同时包含顶层 frontmatter `slug`。本轮不批量迁移、不猜测哪个值正确，也不把诊断扩张成发布流程；成功标准是：先给作者只读证据，只有文件名、旧字段、`draft: true` 和正式命名空间全部一致时才显示一次性清理动作。

明确不做：不改文件名、正文、日期、类型、附件、正式内容或链接；不运行 npm/doctor/Git/发布子进程；不提交或联网；不调用会重排 YAML 的 `processFrontMatter`；不在结果不确定时自动重试或回滚；不修改 Next.js 源码，因此本轮按 `AGENTS.md` 无需读取 Next.js 编码指南。

## 2. 项目结构状态

功能提交为 `77df7791e9d30ca1450d71d2154a2a31caad6951`，涉及七个文件：

- `.obsidian/plugins/myblog-publisher/main.js`：插件升到 1.21.0，增加身份分析、原生证据 Modal、`Vault.process` 清理、同步 guard、独立 lease 与后置证明；
- `.obsidian/plugins/myblog-publisher/styles.css`：增加唯一 `.myblog-draft-identity` 作用域；
- `.obsidian/plugins/myblog-publisher/manifest.json`：同步版本与能力说明，最低 Obsidian 仍为 1.5.7；
- `lib/content/author-doctor.ts`：doctor 的精确插件版本同步到 1.21.0；
- `tests/obsidian-plugin.test.mjs`：Vault 桩增加 `process`，覆盖三态、格式歧义、CRLF 保真、竞态、租约和不确定结果；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步版本合同。

归档提交更新项目状态、路线图、设计、架构、操作、发布指南、inbox 指南、公开项目短摘要与本文件。仓库根继续兼作 Obsidian Vault；GitHub 仍是内容与版本事实源；生产仍由 Vercel 托管且不依赖 Cloudflare。

## 3. 设计内容

`frontend-design` 把功能限制成一张宿主原生证据页：顶部为 `DRAFT IDENTITY / LOCAL EVIDENCE`、标题与边界说明；唯一视觉签名是 `FILE ⇄ FRONTMATTER`；状态只取 `READY / FILE OWNED`、`LEGACY / MATCHED`、`HOLD / CONFLICT`。下方四行 ledger 只报告 `DRAFT / INBOX / POST / PROJECT`，不制造评分或进度。

常规和冲突状态只有“关闭”。只有严格匹配的旧身份多一个“移除冗余 slug”；错误留在同一 `role=alert`。视觉复用 Obsidian 字体、颜色 token、规则线和直角间距，没有卡片、渐变、阴影、动画、历史、批量选择或迁移仪表盘。

## 4. 使用的技术

- Obsidian `TFile`、`Vault.read`、`Vault.process`、`getFrontMatterInfo`、`parseYaml`、`Modal`、`Notice`；
- CommonJS 桌面插件，原生 DOM 元素与作用域 CSS；
- Node test runner、VM Obsidian 桩和 `yaml` 解析器；
- 现有 author doctor、ESLint、TypeScript、Next 16 构建、生产应用门与 npm audit；
- `research-iteration-loop` 负责失败优先、定向验证、真实 doctor、双完整门和功能/归档分提交。

## 5. 实现的功能

- 命令面板新增“MyBlog Publisher: 检查当前草稿身份”；
- 只对桌面端活动的精确安全 inbox Markdown 开放；
- 显示文件名 slug、frontmatter slug、draft 状态及 posts/projects 同名碰撞；
- 无顶层 slug 且其余证据一致时报告文件名已拥有身份，不提供写动作；
- 顶层 `slug: <文件名>` 恰好一行、`draft: true` 且正式命名空间无冲突时提供清理；
- 不匹配、非字符串、无效 YAML、非 draft、缩进/引号/锚点等原始格式歧义或正式碰撞全部保持只读；
- 成功清理只删除该行，其他字节、CRLF、注释、字段顺序和正文不变；
- 同一 Modal 双击和多个 Modal 并发最多进入一次宿主写 API；
- 文件在检查后变化会在原子回调中拒绝；宿主拒绝或后置证据不足标为不确定且不重试。

## 6. 实现方法

检查先固定活动 `TFile` 与安全路径，再用 `vault.read` 读取直接磁盘正文。`getFrontMatterInfo` 证明 frontmatter 存在，`parseYaml` 验证语义；同时用严格原始行匹配证明顶层字段恰好是无引号、无注释、无 tag/anchor 的 `slug: <filename>`。这样既不会把嵌套字段当身份，也不会删除可能被 YAML alias 引用的锚点。

清理前再次核对活动对象、来源映射、观察正文和两个正式命名空间。独立 `draftIdentityCleanupLease` 在首个 await 前占用，Modal 的 `submitting` guard 负责同按钮重复点击。随后只调用一次 `vault.process(file, callback)`；同步 callback 首先要求宿主传入的最新 `data` 与 Modal 的 `observedContent` 完全相等，再重新执行同一身份分析并返回预先证明的删行结果。

回调不用 `processFrontMatter`，因为后者通过 JavaScript 对象重新序列化 YAML，无法满足逐字节保留目标；也不用 `vault.modify` 或 Adapter。完成后同时要求 `process` 返回值、再次 `vault.read` 的磁盘内容和预期字节全等，且重新分析为 `filename-owned`。任何一项无法证明只返回 `uncertain`，不重试、不反向写入。

## 7. 验证证据

失败优先基线：新增合同后定向插件套件为 91 pass / 15 fail；失败集中证明命令、Modal、三态分析、原子清理、lease 和 1.21.0 尚不存在，既有功能保持通过。

实现后证据：

- 插件定向套件最终 107/107；
- author doctor、Obsidian 发布与插件三文件 125/125，随后 ESLint 通过；
- 真实 `npm run content:author:doctor`：AUTHOR READY 13/13，11/11 脚本、32/32 固定依赖、5/5 路径、插件 1.21.0；安全边界仍是零安装、零配置/文件修改、零凭据读取、零网络；
- 第一遍 `npm run release:check`：159.9 秒，292/292 单元与集成、TypeScript、45/45 构建页面、19/19 生产应用测试、生产依赖审计 0；Current 1 / Historical 3、inbox 0、根暂存 0、外链本地问题 0；
- 归档后的第二遍 `npm run release:check` 同样通过 292/292、45/45、19/19 与生产依赖审计 0，证明项目文档和公开项目短摘要没有突破构建或体积门。

## 8. 经验与教训

1. 原子 API 只解决“一个文件不会在 callback 读写间漂移”，不自动解决旧观察、对象替换、命名空间碰撞和结果报告；这些仍需分别证明。
2. 语义 YAML 相等不足以授权保格式迁移。锚点、tag、引号、注释和重复键可能解析成相同值，却具有不同依赖或书写意义；高风险删行必须同时验证原始表示。
3. 只读证据应该是默认状态，写按钮是证据导出的例外，而不是进入 Modal 后必然出现的下一步。
4. `processFrontMatter` 适合结构化字段编辑，但不适合要求保留注释、顺序和换行的最小迁移；API 选择应服从数据保真目标。
5. callback 内的最新内容比较是消除检查后竞态的关键；callback 外多读一次只能改善错误提示，不能替代原子边界。
6. 宿主 Promise 拒绝时不能安全假设零副作用；不确定结果应关闭动作界面、给出精确路径并禁止自动重试。
7. 本地 lease 与 Modal guard 解决不同并发层级；两者都必须在异步边界前建立所有权。
8. 公开项目页只保存结论，完整方法和验证留在 Vault 迭代档案，可同时维护工程可追溯性与 HTML 预算。

## 9. 全局状态、风险与未解决问题

作者已能独立完成草稿创建、旧身份检查、严格清理、文件名改名、就绪检查和发布。没有真实 Obsidian 像素快照，首次日常使用仍需观察 Modal 宽度、长路径换行和宿主主题对状态色的影响。清理仅接受精确 `slug: <filename>`；带注释、引号、anchor/tag、缩进、重复键或不匹配值的旧草稿故意不自动处理。`Vault.process` 的宿主拒绝统一视为不确定，因此作者必须重新运行身份检查，不能连续点击。新功能不处理正式 slug 迁移、附件目录或内部链接，也不改变既有发布事务和 Git 恢复边界。

## 10. 下一轮唯一主任务

评估 Obsidian 草稿发布前的单篇“作者意图摘要”：在不重复现有 inbox readiness 和完整发布检查的前提下，把当前草稿的类型、公开目标、日期语义、附件数量与站内链接数量汇成一个只读、可快速核对的本地摘要。先证明现有数据能够无副作用复用；不得新增云服务、真实 API、自动发布、自动修复或第二套内容解析器。

## 官方资料与判断来源

- [Obsidian Vault 指南](https://docs.obsidian.md/Plugins/Vault)：需要修改的正文应从 `read` 获取；`Vault.process()` 提供原子 read-modify-save，并建议异步工作流在 callback 中比较最新 data 与先前观察；
- [Obsidian API 类型定义](https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/obsidian.d.ts)：`Vault.process` 自 1.1.0 提供原子单文件处理；`getFrontMatterInfo` 自 1.5.7 可用；`processFrontMatter` 会通过 JavaScript 对象编辑并序列化 frontmatter，因此本轮没有采用。

## 结论

MyBlog Publisher 1.21.0 已把旧式草稿迁移从“人工猜测并删字段”变成“先本地取证、仅严格匹配时原子删一行”。安全草稿保持纯只读，冲突草稿不会出现写按钮，允许清理的草稿也必须在 `Vault.process` callback 中重新证明未变化。作者因此不依赖 Codex 或终端即可完成这项一次性维护，同时没有扩大到批量迁移、发布、Git 或网络。
