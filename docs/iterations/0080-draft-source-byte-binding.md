# Iteration 0080：草稿来源字节 SHA-256 证据绑定

## 1. 范围与成功标准

本轮只解决一个正确性缺口：version 5 能证明当前草稿路径、Vault `TFile`、ALT/REF 行号和 Editor 行界，却不能证明报告生成后正文没有变化。同一路径、同一对象和仍然有效的 L<n> 会让旧证据继续导航到语义已经改变的内容。

成功标准是 inbox readiness 升至 version 6、MyBlog Publisher 升至 1.31.0；每个成功读取的 entry 必须携带原始草稿字节 SHA-256，Obsidian 在打开 source-scoped 摘要和执行任一 ALT/REF 导航前都重新读取并精确匹配完整摘要。同一 `TFile` 只要任意内容字节变化就失败关闭；旧 version、缺失、`null`、大写或畸形摘要均不能进入交互。实现不改写正文、不自动重跑报告、不执行发布事务/Git、不访问网络或云 API。功能提交为 `0b88a46adc1c92ab92ed9144d4847027c597c56a`；回滚应使用 `git revert 0b88a46adc1c92ab92ed9144d4847027c597c56a`，其父提交为 `dfefbeb7204810a5fa0730731254909204122c1c`。

## 2. 项目结构状态

App Router、公开页面、内容目录、正式 Markdown/媒体关系、发布脚本、Git 交付和部署配置均未改变。功能提交修改九个既有文件：

- `lib/content/inbox-readiness.ts`：version 6、原始字节 SHA-256、不可用状态与文本证据；
- `.obsidian/plugins/myblog-publisher/main.js`：v6 严格消费、摘要前复核、导航前复核与短摘要展示；
- `.obsidian/plugins/myblog-publisher/manifest.json`、`lib/content/author-doctor.ts`：插件 1.31.0 版本镜像；
- `README.md`：作者操作边界和新版证据说明；
- `tests/inbox-readiness.test.mjs`：真实字节摘要、CLI 与文本报告回归；
- `tests/obsidian-plugin.test.mjs`：schema、摘要、同一 `TFile` 漂移、导航和只读回归；
- `tests/author-doctor.test.mjs`、`tests/obsidian-publishing.test.mjs`：版本/安装契约回归。

按仓库 `AGENTS.md` 要求，写代码前完整复核了 Next.js 16.3 内置 TypeScript 指南 561 行。本轮没有修改 Next.js API、路由、配置、类型生成或运行时约定。`research-iteration-loop` 规定了失败优先、验证、全局复核和归档顺序；`frontend-design` 让新增信息继续留在原证据 ledger，只增加一行而不扩张组件或视觉语言。

## 3. 设计内容

证据表在既有 TYPE、DATE、MEDIA、LINKS 之后增加 `SOURCE / SHA-256 · <12 chars>`。这只是让作者看见当前摘要身份；安全比较始终使用完整 64 位值。没有新增卡片、颜色、字体、阴影、动画、CTA 或自动动作，仍保持 Commit Trace / Evidence Rail 的高密度工程档案方向。

摘要与导航使用相同的失败语言：内容已变化时保留现场并要求重新运行作者意图检查。摘要未打开时不产生成功 Notice；导航未完成时不关闭 Modal，也不移动 cursor。路径、对象、摘要和行号分别承担来源位置、宿主身份、内容身份和局部定位四个不同责任。

## 4. 使用的技术

- Node `createHash("sha256")` 对 `readFile` 返回的原始 `Buffer` 计算 64 位小写十六进制摘要；
- 同一批字节随后 `toString("utf8")` 进入现有 `prepareObsidianNote`，避免“哈希一次、另读一次”产生生产端竞态；
- `sourceSha256: string | null` 是每个 version 6 entry 的必需字段：成功读取为摘要，符号链接或不可读来源为 `null`；
- source-scoped Obsidian parser 使用严格 exact-key、version 和 `/^[a-f0-9]{64}$/` 检查，诊断型 `null` 不进入交互；
- Obsidian `vault.read` 返回的 UTF-8 文本用同一 SHA-256 算法复核，并在 await 前后继续校验活动 identity 与 Vault `TFile` 映射；
- `DraftIntentModal` 把冻结摘要传给共享 `openDraftIntentSourceLine`，ALT 与 LINK 继续共享 single-flight 和全套导航守卫；
- Node VM harness 注入真实 `node:crypto`，记录 Vault 读取、同一对象内容变更、Modal、Notice、打开、cursor、scroll、focus 和所有写入尝试。

## 5. 实现的功能

- 全库和 `--source` inbox JSON 均升至 version 6，并对每个可读草稿记录原始文件字节 SHA-256；
- 无法安全读取的 entry 仍能以 `sourceSha256: null` 出现在全库诊断中，不会让一个坏文件抹掉其 blocker；
- 当前草稿摘要在显示前进行一次内容摘要复核，报告后发生的编辑会阻止 Modal 打开；
- 每次 ALT/REF 导航重新读取并比较摘要，摘要打开后的同一 `TFile` 编辑也会阻止打开和定位；
- v5、缺失摘要、`null`、非小写或非 64 位摘要严格失败关闭，无兼容回退和自动重跑；
- 摘要页面显示 12 位短标识，完整值不截断地参与比较；
- 所有成功与失败路径保持只读，不调用 `Vault.process`、FileManager、发布事务、Git 或网络。

## 6. 实现方法

先冻结 v6 contract 和失败条件，再只修改测试：生产测试要求原始字节摘要和 v6，插件测试要求 1.31.0、旧报告拒绝、摘要打开前漂移拒绝，以及摘要打开后同一 `TFile` 内容变化时 LINK 不再导航。目标命令按预期退出 1；直接失败来自仍为 v5/1.30.0、缺少字段/视觉行和没有内容复核，doctor 版本镜像同时产生预期联锁失败。

实现阶段先把 producer 改成一次 Buffer 读取、先哈希再解码；`blockedEntry` 明确初始化 `null`，因此可读但解析失败的草稿仍有摘要，不可读草稿仍保留诊断。consumer 先严格解析报告，再异步读取当前草稿；读取后再次确认活动 identity 和原 `TFile`，完整摘要一致才打开 Modal。导航复用 entry 摘要，在原路径/对象/异步守卫之后、行界之前比较，从而让内容身份先于局部定位生效。

测试 harness 为真实活动文件补齐默认正文、为 Vault read 增加第 N 次异步漂移，并提供同一 `TFile` 内容变更入口。目标套件实现后 199/199 通过。首次完整 `release:check` 只是被外层 120 秒执行上限终止，未出现质量失败；以更长进程上限重跑同一命令后完整通过，没有删减验证范围或放宽断言。

## 7. 验证证据

- 失败优先：目标命令退出 1，v6/schema/摘要前后漂移与版本镜像产生预期失败；
- 目标测试：`inbox-readiness`、`obsidian-plugin`、`author-doctor`、`obsidian-publishing` 共 199/199；
- `git diff --check`：通过；
- `npm run release:check`：完整通过，耗时约 290 秒；
- 单元测试：360/360；
- ESLint 与 TypeScript：通过；
- Next.js 16.3.0：45/45 页面构建完成；
- 生产应用测试：19/19；
- `npm audit --omit=dev --audit-level=high`：0 个漏洞；
- 真实 author doctor：MyBlog Publisher 1.31.0、13/13、`ready`，所有安全声明保持 false；
- 真实 inbox JSON：version 6、`read-only`、空 inbox，`authorFilesChanged`、`commitCreated`、`networkChecked`、`pushExecuted` 均为 false；
- 功能提交已推送；远端 [Quality Gate #143](https://github.com/Zach424/MyBlog/actions/runs/31061516375) 与 [Verify Vercel production #136](https://github.com/Zach424/MyBlog/actions/runs/31061547281) 均成功。
- 稳定生产 URL 复核：首页、`/projects/myblog` 与 `/studio` 均 HTTP 200，分别返回 25,712、99,296 与 7,636 bytes，并包含服务端 `<title>`。

## 8. 经验与教训

- 文件对象身份不是内容身份；路径和 `TFile` 守卫无法替代对实际内容的指纹；
- 要声称“原始字节摘要”，producer 必须先读取 Buffer 并对该 Buffer 哈希，再从同一 Buffer 解码给 parser；
- 全库诊断和单稿交互的可信阈值不同：前者应保留 `null` 及 blocker，后者必须拒绝没有可比较摘要的证据；
- 短摘要适合视觉识别，完整摘要才适合比较；两者不能混用；
- await 前后复核对象身份仍然必要，摘要只补充内容身份，不替代路径和宿主生命周期守卫；
- versioned exact-key consumer 让 schema 演进显式失败，避免旧插件把新报告误解释为可信；
- 长检查的外层超时不是测试失败；记录“被执行上限终止”并原样重跑，比拆掉质量门更可审计。

## 9. 全局状态、风险与未解决问题

当前草稿作者意图的路径、Vault 对象、完整内容和局部行号已形成连续证据链。正式 Markdown 关系、知识图谱、媒体变换、发布/复核事务、Git 恢复、Next.js 公开站与 Vercel 部署语义均未改变。功能完全本地，无遥测、Cloudflare 或其他云 API 依赖。

摘要用于新鲜度和相等性，不是来源签名或权限证明。Obsidian 从 Vault 读取 UTF-8 文本后重编码比较；合法 Markdown 可精确还原，非法 UTF-8 会安全地不匹配。真实 inbox 仍为空，复杂路径由临时 Git/媒体和 VM fixture 覆盖；尚未在真实 Obsidian 桌面主题中做像素和完整交互验收。

本轮新增的异步摘要复核由命令完成回调启动，但尚无命令级 generation：作者快速连续运行两次“查看当前草稿发布意图”，或插件在 `vault.read` 期间卸载时，较旧完成项可能晚到并打开 Modal。它不会写内容或发布，但会破坏 latest-wins 的作者预期，应优先于无真实规模证据的 trace 筛选/折叠。

## 10. 下一轮唯一主任务

Iteration 0081：为“查看当前草稿发布意图”的命令启动、报告回调和异步 SHA-256 复核增加插件级 latest-wins generation；每次新运行使旧 generation 失效，`onunload` 也使所有未完成 generation 失效。旧或卸载后的完成项不得打开 Modal、发送成功 Notice、自动重试或触发任何发布/Git/网络动作。
