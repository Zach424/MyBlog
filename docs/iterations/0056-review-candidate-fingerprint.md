# Iteration 0056：正式复核候选指纹与 TOCTOU 绑定

## 1. 范围与成功标准

本轮关闭正式内容复核链路中“路径相同但字节已经变化”的 TOCTOU 风险。Iteration 0055 已证明一次 push 只包含目标 Markdown，并能保留 deferred 草稿；但 inspection 在长质量门之前读取正文，门后只重新分类路径。若作者在检查期间继续保存同一笔记，Proof 可能描述旧内容，commit 却收录新内容。

成功标准是：固定一次复核所基于的 HEAD；对质量门实际读取的原始目标字节生成 SHA-256；完整门后再次验证 HEAD 与摘要；push 时让 index 和提交 tree 对应门前经过 Git clean/filter 的同一候选；任何门中编辑、HEAD 漂移、hook 改写或提交范围漂移都必须在 push 前失败关闭。回滚功能提交 `1b07796ee57b8cd0724933463ae08ac2bf3dca69` 即可恢复 1.6.0 行为，不改写任何内容历史。

## 2. 项目结构状态

- `lib/content/review-note.ts`：Proof 从 v2 升至 v3；新增 SHA-256 候选指纹和 candidate schema；语义正文只规范化行尾；
- `scripts/review-note.mjs`：固定 base HEAD、读取原始候选、计算 Git-clean blob、门后复核、index/tree 绑定及异常提交回退；
- `.obsidian/plugins/myblog-publisher/main.js`：严格解析 Proof v3 candidate，并在证据账本增加候选行；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增 scoped Verified 侧线、候选标签和摘要排版；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.6.0 升到 1.7.0；
- `tests/content-review.test.mjs`：新增摘要、目标/HEAD 竞态、CRLF clean filter、tree 篡改与回退的真实 Git 测试；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步 Proof v3、候选 UI、异常降级和 1.7.0 契约；
- Vault 的 README、项目说明、架构、设计、发布、运维、路线图与状态同步当前事实；Next 页面、Studio、内容模型、workflow 与托管配置没有改变。

## 3. 设计内容

视图主体仍是“正在决定是否同步正式内容的所有者”，日期 transition rail 保持唯一视觉签名。候选不是新的仪表盘或安全评分，而是原有 ledger 中的一行机器证据：Verified 侧线、`CANDIDATE / GATE-STABLE`、`sha256:前12位…后8位` 以及“门前与完整质量门后的字节一致”。完整 64 位摘要放在 title 与 aria-label，既避免窄 Modal 被长哈希支配，也不牺牲可核对性和辅助技术信息。

颜色继续服从 Obsidian 宿主 token；fallback 角色为 Evidence Ink `#1f272a`、Verified `#2f756f`、Trace `#486f78`、Caution `#c6683c`、Paper `#f4f3ef`。标题使用宿主 text，界面说明使用 interface，摘要使用 monospace。没有增加分数、绿色成功徽章、复制按钮、卡片、渐变或动画；状态用颜色、文字和结构共同表达。

## 4. 使用的技术

- Node `crypto.createHash("sha256")` 对原始 `Buffer` 计算 64 位小写摘要；
- Git `hash-object --path=<source> --stdin` 对同一原始字节应用仓库 clean/eol 规则，得到候选 blob OID；
- Git `rev-parse HEAD`、`:path`、`HEAD:path` 分别读取 base、index 与提交 tree 身份；
- `diff-tree --root --no-commit-id --name-only -r -z` 验证唯一提交路径；
- `update-ref refs/heads/main <base> <invalid>` 使用 expected-old 原子撤回未经验证的新提交；
- Proof v3 exact-key schema、SHA-256 正则、稳定布尔断言与 CommonJS 信任边界；
- Node test 的真实临时仓库、裸远端、quality command/hook 注入、`core.autocrlf=true` 夹具；
- `research-iteration-loop` 把范围限制为候选/HEAD/index/tree 的证据闭环，并坚持 fail-first、真实 Git 回退和远端双检查；
- `frontend-design` 保留日期轨为唯一签名，把候选设计成一行证据 ledger，而不是模板化卡片或装饰状态。

## 5. 实现的功能

- check-only 和 push 都在完整门之前读取一次原始目标字节并计算 SHA-256；
- 完整门之后再次读取文件，任一字节变化立即失败，不暂存、不提交；
- 完整门期间 HEAD 改变时失败，不把旧 inspection 应用到新历史；
- 文本模式输出短候选摘要，JSON Proof v3 输出完整摘要、算法和门后稳定声明；
- 插件拒绝错误算法、非 64 位小写摘要或假的稳定声明，并回退纯文本检查；
- push 暂存后核对 index blob，提交后核对父提交、唯一 diff 与 tree blob；
- post-commit hook 若改写提交 tree，脚本在 push 前撤回异常提交、取消目标暂存并保留工作区；
- Windows CRLF 工作区按原始 CRLF 做质量门指纹，同时按 Git clean 规则提交 LF blob；纯行尾差异不冒充事实变化；
- deferred 分类、单目标 `commit --only`、合法提交 push 失败保留、JSON 日志隔离和纯文本降级保持原语义。

## 6. 实现方法

一个摘要不能同时回答两个不同问题。原始 SHA-256 回答“完整质量门前后读到的工作区字节是否相同”；Git blob OID 回答“这些字节经过当前路径的 `.gitattributes`/clean/eol 规则后，index 与 tree 是否收录同一 Git 对象”。如果直接要求 raw SHA 对应 Git blob，在 Windows `core.autocrlf=true` 时合法 CRLF 文件会被错误拒绝；如果只看 Git blob，又无法证明质量门实际读取的原始输入没有漂移。本轮因此保留两种身份，各自只用于其正确边界。

HEAD 也属于候选上下文。脚本先保存 base HEAD，并用 `git show <base>:<path>` 读取 previous；质量门后及暂存前都要求 HEAD 未变。commit 后父级必须仍是 base，diff 必须只含目标。只有 parent、path 和 tree blob 全部通过，提交才进入 verified 状态并允许 push。

post-commit hook 可能在 `git commit` 返回成功前改写 HEAD，因此“commit 命令成功”不等于“提交可信”。若验证失败，脚本先确认 invalid HEAD 的父级仍是 base，再用 `update-ref` 的 expected-old 比较交换把 main 原子移回 base；随后只取消目标暂存。它不使用 hard reset，不覆盖 hook 留下的工作区字节，也不会把异常提交发到远端。

领域事实比较与字节身份同样需要分层。Markdown 语义快照把 CRLF/CR 规范为 LF，避免只改变行尾时要求作者伪造 `updatedAt`；候选摘要仍计算原始字节，因此检查期间任何行尾变化都会触发漂移。

## 7. 验证证据

- fail-first：内容测试首先因 `fingerprintContentReviewCandidate` 不存在失败；插件 manifest 仍为 1.6.0，旧 parser 拒绝 candidate，Modal 数为 0；
- 首轮实现定向测试 49/49；补入 HEAD 漂移与 post-commit 篡改回退后 36/36；
- CRLF 真实 Git 测试最初暴露“行尾被当作事实变化”，分离语义/字节身份后定向测试 38/38；
- 质量门期间修改目标：命令失败，HEAD/index/裸远端均不变；
- 质量门期间移动 HEAD：命令失败并保留外部产生的新 HEAD，不擅自回退；
- `core.autocrlf=true`：CRLF 工作区保持原样，commit tree 为对应 LF Git blob；
- post-commit hook 篡改/amend：tree OID 不匹配，main 原子回到 base，index 为空，远端不变，篡改后的工作区保留；
- 完整 `npm run release:check` 用时 135.5 秒：Current 1 / Historical 3、inbox 0、根暂存 0、外链 2 URL / 3 occurrences / 0 issue、190/190 单元、TypeScript、45 个页面、19/19 生产应用测试、production audit 0；
- `.next/static` 为 1,818,736 B；插件 main/manifest/styles 合计 50,782 B，且不进入公开客户端；
- 功能提交 `1b07796ee57b8cd0724933463ae08ac2bf3dca69` 已推送；Quality Gate `30993071205`（#99）与 Vercel Production 验证 `30993109404`（#92）均 completed/success；
- 没有新增依赖、secret、数据库、Cloudflare、外部 API 或手动云接入；真实 Obsidian 主题像素外观仍未人工截图验收，本轮只声明 DOM、行为和 CSS 契约。

## 8. 经验与教训

- 同一路径不等于同一内容；TOCTOU 必须绑定字节身份，而不是再次检查文件名；
- 候选不仅包含文件，还包含它所基于的 HEAD；否则 inspection 的 previous 与 commit parent 可能分叉；
- SHA-256 和 Git blob OID 服务不同证据域，不能为了“只有一个哈希”而混淆原始输入与 clean 后对象；
- `.gitattributes`、autocrlf 和 clean filter 是 index/tree 身份的一部分，真实 Git 夹具比字符串 mock 更能暴露跨平台错误；
- `git commit` 成功后仍要验证产物；自动回退必须带 expected-old，且只撤回本轮创建的可识别提交；
- 语义相等与字节相等也不是一回事：行尾可以不改变事实，却仍必须在长门期间保持稳定；
- UI 显示短摘要、可访问属性保留完整摘要，比把 64 位值铺满 Modal 更适合作者判断。

## 9. 全局状态、风险与未解决问题

网页 Studio、Obsidian inbox 发布、Current 维护台账和正式 review-note 继续共享 Git 内容源。正式复核现在能证明领域判断、质量门输入、index 和 commit tree 是一条连续证据链；并行作者工作仍能安全 deferred；部署仍由 GitHub → Vercel 自动完成，不依赖 Codex、Cloudflare 或数据库。

剩余风险已从“错误内容被提交”收敛为“正确提交没有送达”。当 commit 已通过所有本地验证但 push 因网络、权限或 non-fast-forward 失败时，保留本地提交是正确的数据安全行为；但插件当前只显示命令错误文本，作者下次可能忘记它已经存在、误跑复核或不清楚本地 tracking ref 是否新鲜。另有真实主题、超长摘要 title 和大量 deferred 路径的像素级体验仍需实际使用观察。

## 10. 下一轮唯一主任务

实现待交付正式复核的只读恢复状态。它应验证本地 `main` 相对本地 tracking ref 的 ahead/diverged 状态，识别待交付提交是否为 `content: review <slug>`、是否只有一个正式内容路径、父级/tree blob 是否可说明，并在 CLI 与 Obsidian 中给出明确恢复步骤。发现可识别的待交付复核时，新的 review 命令必须 fail closed，避免同日重复或堆叠提交。首版不自动 fetch、不自动 push、不 reset/rebase、不新增外部服务；本地 tracking ref 可能过期必须被标为观察边界，而不能冒充远端实时事实。
