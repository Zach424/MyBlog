# Iteration 0057：待交付正式复核识别与只读恢复证据

## 1. 范围与成功标准

本轮解决 Iteration 0056 留下的交付可见性缺口：正式复核提交已经通过候选、父级、唯一路径和 tree/blob 验证，但 `git push` 可能因网络、权限或远端拒绝失败。保留合法本地提交是正确行为；只有一条错误文本却容易让作者忘记提交已经存在、重复运行复核或把本地 ahead 误认为远端已上线。

成功标准是：零网络读取本地 main 与 origin/main tracking ref；只把一个精确可验证的正式复核提交识别为 pending-review；普通 ahead、behind、diverged 和 tracking 缺失保持不同状态；CLI 与 Obsidian 明示证据边界、提交/path/tree/blob 和恢复命令；任何非 synchronized 状态阻止创建新复核；报告本身不改变 HEAD、index 或 worktree。回滚功能提交 `d128b807278a2b6d24213768dce3950db21275eb` 即可恢复 1.7.0 行为，不改写内容或远端历史。

## 2. 项目结构状态

- `lib/content/review-delivery.ts`：新增六态纯分析器、Git object id 契约、pending-review 窄识别和 version 1 报告；
- `scripts/review-delivery-git.mjs`：只读本地 refs、提交关系、subject、父级、diff、tree 与 blob；
- `scripts/report-content-review-delivery.mjs`：新增文本/JSON CLI 与非同步退出码；
- `scripts/review-note.mjs`：完整门前后都要求 delivery synchronized，给 pending 单独阻断说明；
- `package.json`：新增 `content:review:status` 作者命令；
- `.obsidian/plugins/myblog-publisher/main.js`：新增严格交付报告 parser、结构化/纯文本 Modal 与桌面命令；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增本地/最后观察远端的提交差距 rail 和 scoped ledger；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.7.0 升到 1.8.0；
- `tests/content-review.test.mjs`：新增纯六态与真实 push 拒绝/恢复测试；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：锁定新命令、严格降级、零按钮 UI、npm script 与 1.8.0；
- Vault README、项目说明、架构、设计、发布、运维、路线图和状态同步当前事实；Next 页面、Studio、内容 schema、workflow 与托管配置没有改变。

## 3. 设计内容

具体主体是处理“本地已验证、远端尚未确认”的博客所有者，唯一任务是判断是否存在一个可按固定命令继续送达的复核。视图不用泛化后台状态卡，而把真实提交差距作为骨架：`ORIGIN/MAIN · LAST OBSERVED ── +1 ── LOCAL MAIN`。精确 pending 使用 `DELIVERY HOLD / LOCAL ONLY` 与 `PENDING / NOT ON TRACKING REF`；同步时同轨显示 `+0`；无法证明的关系只显示 INSPECT，不给 push 建议。

样式优先服从 Obsidian token；fallback 为 Evidence Ink `#1f272a`、Verified `#2f756f`、Trace `#486f78`、Hold `#c6683c`、Paper `#f4f3ef`。标题使用 text，说明使用 interface，refs/object id/路径/命令使用 monospace。没有“安全评分”、绿色可推送徽章、复制按钮、通用卡片、渐变或动画；恢复命令只是 ledger 证据。窄屏保留两端引用关系，账本折为单列。

## 4. 使用的技术

- TypeScript 判别联合类型、readonly 结构语义与 40/64 位 Git object id 兼容；
- Git `rev-parse --verify`、`rev-list --left-right --count`、`show --format`、`diff-tree -z` 和 `<commit>:<path>` blob 读取；
- 本地固定 refs `refs/heads/main` 与 `refs/remotes/origin/main`，零 `fetch`；
- version 1 exact-key JSON、跨字段 relation/HEAD/pending/recovery 重算与纯文本降级；
- Obsidian 原生 Modal、Notice、宿主 token、语义 section/dl/code 与既有进程生命周期；
- 临时真实 Git 仓库、裸远端 `pre-receive` 拒绝 hook、恢复 push 和状态前后快照；
- `research-iteration-loop` 把本轮限制在识别、阻断和只读证据，先 fail-first 再真实 Git/远端双验证；
- `frontend-design` 用真实提交差距作为唯一签名，并删除会夸大 tracking 新鲜度的“安全”徽章与隐式恢复按钮。

## 5. 实现的功能

- `npm run content:review:status` 输出人读文本；增加 `--format json` 输出稳定机器证据；
- synchronized、pending-review、local-ahead、behind、diverged、tracking-missing 六态互斥；
- tracking 缺失时计数为 null；其他状态使用真实 behind/ahead；
- pending-review 必须恰好 ahead 1 / behind 0、单父级等于 tracking、HEAD 等于 commit、subject/slug/path 严格一致且 tree/blob OID 有效；
- 普通 ahead 即使只有一个提交也不会得到 push 建议；
- 所有非 synchronized 状态返回 CLI 退出码 1，但保留完整文本/JSON；
- 报告明确 `networkChecked: false`、`autoExecuted: false`，不 fetch、不 push、不改历史；
- Obsidian “查看待同步正式内容复核”接受退出码 0/1，严格验证后显示 rail、完整证据和固定恢复命令；
- 结构化证据异常时重新运行本地纯文本命令，不展示半可信交互；
- review-note 在质量门前后都要求 synchronized；已有 pending 或门中 tracking 漂移时失败关闭；
- 新状态报告执行前后的 HEAD、index、worktree 完全一致。

## 6. 实现方法

本地 `origin/main` 是 tracking ref，不是实时远端。报告因此不调用 fetch，并把 `networkChecked: false` 与“LAST OBSERVED”写进 schema 和界面。它能证明的是“本地 main 相对最后一次 Git 观察到的 origin/main 的关系”；远端在观察后是否前进只能由后续 push/server 处理。省略这个边界会把缓存证据伪装成在线事实。

ahead 不是待交付的同义词。纯分析器只有在 ahead 1、behind 0 时读取 HEAD 候选；随后要求 commit OID 等于 local head、唯一父级等于 tracking head、subject 精确为 `content: review <slug>`、diff 只有对应正式 Markdown，并从实际 commit 读取 tree/blob。任何普通功能提交、多提交堆叠、merge、路径或 message 漂移都归为 local-ahead，仅给 inspect，不生成 push 恢复动作。

状态判断在正式复核的完整门前和门后复用。门前可阻止已有待交付提交被第二次复核覆盖；门后可发现另一个进程 fetch/push 后导致的 tracking 关系变化。它与候选 SHA/HEAD/worktree classifier 共同组成前置证据，但不进入 release:check 默认链：非同步本来就是需要恢复的运行态，不能让一条合法 pending 反过来阻断所有无关工程质量命令。

插件不信任 CLI JSON 自述。除了 exact keys 和 object id 格式，还重算 ahead/behind 对应状态、同步时 HEAD 必须相等、pending commit/parent 必须等于 local/tracking、slug/path/subject 必须互相派生、恢复动作必须与状态一致，且 `networkChecked`/`autoExecuted` 必须为 false。异常只进入纯文本 evidence，不开放按钮。

## 7. 验证证据

- fail-first：`review-delivery.ts` 不存在，manifest 仍为 1.7.0，插件缺 `inspect-review-delivery`；5 项新契约失败；
- 核心实现后 `content-review` 19/19，通过 synchronized/pending、普通 ahead/diverged/missing 与真实 Git 行为；
- 插件与发布定向测试合计 58/58；补锁 npm script 与报告零副作用后关键测试 2/2；
- 裸远端 `pre-receive` 明确拒绝：review push 返回 1，本地 HEAD 为新复核提交，远端仍为 base；
- JSON 报告识别 ahead 1 / pending-review，commit/parent/path/subject/tree/blob 与真实 Git 一致；
- 报告前后 HEAD、`write-tree` 与 porcelain worktree 快照完全相同；
- 第二次运行 review-note 在检查目标修改前就以“已有待同步正式内容复核”阻断；
- 移除拒绝 hook 并 push 后，报告返回 synchronized 与退出码 0；
- 真实仓库文本/JSON 报告均为 synchronized、behind 0 / ahead 0、`networkChecked: false`；
- 完整 `npm run release:check` 用时 163 秒：Current 1 / Historical 3、inbox 0、根暂存 0、外链 2 URL / 3 occurrences / 0 issue、195/195 单元、TypeScript、45 个页面、19/19 生产应用测试、production audit 0；
- `.next/static` 为 1,819,941 B；插件 main/manifest/styles 合计 68,821 B，且不进入公开客户端；
- 功能提交 `d128b807278a2b6d24213768dce3950db21275eb` 已推送；Quality Gate `30995223063`（#101）与 Vercel Production 验证 `30995260542`（#94）均 completed/success；
- 没有新增依赖、secret、数据库、Cloudflare、外部 API 或手动云接入；真实 Obsidian 主题像素外观仍未人工截图验收，本轮只声明 DOM、行为和 CSS 契约。

## 8. 经验与教训

- tracking ref 必须叫“最后本地观察”，不能叫“远端当前状态”；不 fetch 是可复现/零网络优势，也是证据上限；
- ahead 只是图关系，不是业务身份；恢复自动化需要 message、parent、path、tree/blob 的窄证明；
- 状态报告可以用非零退出码表达 attention，同时仍输出可解析 JSON；插件应显式允许这一业务退出码；
- 只读不能只靠代码审查，应在真实 pending 仓库里比较 HEAD、index tree 与 worktree 快照；
- 重复动作应在昂贵质量门之前阻断，并在门后再检查一次以覆盖并发 ref 变化；
- “显示恢复命令”与“执行恢复”应分轮设计；第一轮先稳定识别 schema，避免 UI 按钮先于安全状态机；
- 有意义的 rail 可以直接编码 Git 图关系，比状态卡和泛化警告更支持作者判断。

## 9. 全局状态、风险与未解决问题

正式内容复核现在覆盖人工事实确认、领域日期规则、完整质量门、候选字节、index/tree、并行工作隔离、异常提交回退，以及合法提交未送达后的识别/防重复。网页 Studio、Obsidian inbox 发布、Current 维护与 review-note 继续共享 Git 内容源；生产部署仍由 GitHub → Vercel 自动完成，不依赖 Cloudflare、数据库或 Codex。

剩余主要缺口是恢复动作本身仍需终端。状态视图已经能给出固定命令，但用户要离开 Obsidian；下一轮可在相同窄状态上增加独立命令。该命令必须把 push 失败视为“提交仍安全保留”，不能自动 fetch/rebase/reset。另有 tracking ref 过期、真实主题、超长 path/object id 和大量状态记录的像素体验，需要在实际使用中继续观察。

## 10. 下一轮唯一主任务

实现待交付复核的独立安全恢复命令。执行前重新读取状态并要求 pending-review、当前分支 main，保存 commit/tree/blob 身份；随后只执行参数固定且 `shell: false` 的 `git push origin main`。push 成功后再次读取 refs，要求 synchronized、local/tracking 都等于原待交付 commit，才返回结构化成功 receipt 并让 Obsidian reconcile。状态在执行前漂移、远端拒绝、网络失败或 push 后未对齐都返回失败，保留本地提交；不 fetch、不 rebase/reset、不自动修改工作区，也不在只读恢复 Modal 内放隐式按钮。
