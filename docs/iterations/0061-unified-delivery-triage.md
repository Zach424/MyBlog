# Iteration 0061：统一 Git 交付分诊与只读恢复 Switchyard

## 1. 范围与成功标准

本轮完成 Iteration 0060 的唯一主任务：为正式复核和新内容发布两类 push 失败提供一个共同的第一入口，让作者无需先猜提交类型。范围只包含本地 Git 只读观察、领域路由、CLI、Obsidian 展示与证据归档；既有两套 status、deliver、schema 和 sealed receipt 继续独立。不增加 fetch、rebase、reset、force push、自动 deliver、Cloudflare、数据库、外部写入 API 或凭据读取。

成功标准是：current branch、local main、tracking ref、ahead/behind 必须只读取一次；同一观察同时驱动 review 与 publication 分析。统一层只能产生 synchronized、exact pending-review、exact pending-publication 或 inspect 四类语义，并在 exact route 中保留完整原领域身份与既有命令。非 main 可识别但不能给出可执行 deliver。真实 Git 测试必须证明远端不可用时分诊仍完成，且 HEAD、index、worktree 不变。回滚功能提交 `30d002e4a5cd712c9ab48c951731431d51e3f9dd` 即可恢复 1.11.0，不需要内容迁移、reset 或强推。

## 2. 项目结构状态

- `lib/content/delivery-triage.ts`：新增 version 1 统一只读报告、共享观测一致性、互斥领域身份与恢复路由纯函数；
- `scripts/delivery-git-snapshot.mjs`：新增 local/tracking/current branch/ahead/behind 的单次 Git 快照；
- `scripts/review-delivery-git.mjs`、`scripts/publish-delivery-git.mjs`：改为接收同一共享快照，保留原领域 commit 读取与分析器；
- `scripts/delivery-triage-git.mjs`：在 ahead 1 时按同一 HEAD 同时尝试两种精确 commit 身份，再组合报告；
- `scripts/report-content-delivery-triage.mjs`：新增 `content:delivery:status` 的 text/JSON CLI、退出码与明确零动作边界；
- `package.json`：注册统一分诊脚本和领域测试；
- `.obsidian/plugins/myblog-publisher/main.js`：新增严格 triage parser、命令、JSON/纯文本降级和 switchyard Modal；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增单节点三路道岔、ledger、同步态与窄屏布局；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.11.0 升到 1.12.0；
- `tests/content-delivery-triage.test.mjs`：新增纯路由、矛盾报告和真实 Git 零远端测试；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：锁定 1.12.0、命令参数、严格 parser、DOM/CSS、移动端边界与纯文本降级；
- Vault 架构、设计、发布、运维、路线图、状态、inbox 说明和公开项目页同步当前事实；Next 页面组件、内容 schema、Studio、workflow、依赖、数据库与托管配置没有改变。

## 3. 设计内容

本轮主体是刚遇到任意 push 失败、尚不知道应进入哪条恢复链路的博客作者，唯一任务是识别恢复轨道。设计拒绝通用状态仪表盘，因为它会重复既有两个详情 Modal，也无法表达“同一提交只能属于一个领域”的排他关系。

唯一视觉签名是 Git switchyard：`OBSERVED LOCAL MAIN` 一个节点向下分到 `REVIEW`、`PUBLICATION`、`INSPECT`。顶部使用 `DELIVERY TRIAGE / READ ONLY` 和 `DELIVERY SWITCHYARD / <ROUTE> ROUTE`；同一时刻只有一条轨道显示 `MATCHED`，其余为 `STANDBY`。下方 ledger 展示 relation、branch、完整 pending 身份、status 命令和在 main 上才允许出现的 deliver 命令。synchronized 不伪造成功动作；错误分支保留身份但显示写入锁；inspect 只要求人工检查 Git。

视觉继续服从 Obsidian token；fallback 为 Ink `#1f272a`、Verified `#2f756f`、Trace `#486f78`、Caution `#c6683c`、Paper `#f4f3ef`。正文使用 host text/interface，OID、路径和命令使用 monospace。界面没有按钮、卡片、自动跳转、分数、阴影、渐变或动画；末行明确分诊不会执行 status/deliver，origin/main 只是最后一次本地观察。窄屏把三条轨道和 ledger 行折为单列。

## 4. 使用的技术

- TypeScript 判别联合、exact report schema、共享观察 invariant 与互斥 route 纯函数；
- Git `symbolic-ref`、`rev-parse`、`rev-list --left-right --count` 的单快照本地读取；
- 原有 review/publication commit/tree/blob/raw diff 领域解析器复用；
- Node ESM、固定 CLI 参数、`shell: false`、严格 text/JSON 输出与 0/1/2 退出码；
- Obsidian CommonJS、原生 Modal/Notice、exact-key parser 与安全纯文本降级；
- 临时真实 Git 工作仓库和裸远端，随后删除远端目录验证无隐式网络访问；
- HEAD/index/worktree 前后快照验证只读后置条件；
- `research-iteration-loop` 把本轮限制为“一个共享观察、一个互斥路由、零写入”，要求 fail-first、真实 Git 无远端证据和完整 release gate，同时保留两套写事务；
- `frontend-design` 将排他关系设计为单节点三路 switchyard，并排除重复领域详情的 dashboard、卡片、按钮、自动动作和装饰动画。

## 5. 实现的功能

- `npm run content:delivery:status` 输出人读 Git 交付分诊；`-- --format json` 输出 version 1 机器证据；
- synchronized 返回 route `none` 且退出码 0；其他可行动或需检查状态返回退出码 1；参数/schema 致命错误返回 2；
- exact pending-review 返回原完整 review 身份、`content:review:status` 和 main 上的 `content:review:deliver -- --format json`；
- exact pending-publication 返回原完整 Commit Envelope、`content:publish:status` 和 main 上的 `content:publish:deliver -- --format json`；
- behind、diverged、tracking-missing、多提交 ahead、未知提交或领域报告矛盾不猜测恢复类型；
- 非 main 可显示 exact review/publication 类型和 status 命令，但 deliverCommand 为 null、deliverable 为 false；
- 统一报告固定 `networkChecked: false` 与 `autoExecuted: false`；
- Obsidian 新增“查看 Git 交付恢复”，桌面 Vault 才可运行；
- 插件把 triage 中的领域证据重新合成为原 review/publication report，并分别通过既有严格 parser，不信任浅层 route 摘要；
- JSON、schema、route、path 或 Modal 渲染异常时只运行一次同样只读的纯文本分诊；
- switchyard 没有动作按钮，也不串联 status 或 deliver；既有两类恢复执行器和 sealed receipt 未合并。

## 6. 实现方法

共享快照先读取当前分支，再读取 `refs/heads/main` 和本地 `refs/remotes/origin/main`。tracking 缺失时不计算差距；两端都有 OID 时只调用一次 `rev-list --left-right --count tracking...local`。review 与 publication Git 适配器不再各自读取 refs，而是接收该冻结对象，所以统一报告中的两种领域判断不可能来自不同时间点。

只有 ahead 1 / behind 0 时才需要读取 HEAD commit。协调器把同一个 OID 分别交给 review 的单路径解析器与 publication 的多路径解析器；不匹配某领域时该候选为 null，再由原有纯函数得出 `local-ahead`。统一纯函数要求两份报告 version/mode、branch、local/tracking OID 和计数逐项相同；两类 pending 同时成立、pending 字段与 status 不一致或共享状态不同都会抛错，避免“最后一个判断覆盖前一个”的静默歧义。

统一层不重新解释 commit manifest。exact review 时它复制完整 pendingReview，并要求 publication 侧只报告普通 local-ahead；exact publication 反向要求 review 侧 local-ahead。这样第三层只负责路由，不会成为新的交付授权。deliverable 还额外绑定 current branch 为 main，非 main 只保留诊断价值。

插件同样不把 route 当作可信快捷方式。parser 使用报告 observation/relation/pending 构造两份完整领域报告，并调用原有 `parseContentReviewDeliveryReport` 与 `parseContentPublishDeliveryReport`；随后才独立重算 expected kind、statusCommand、deliverable 和 deliverCommand。界面展示的命令因此必须同时通过领域身份和统一路由两层验证。

## 7. 验证证据

- fail-first：缺少 `delivery-triage` 模块、1.12.0 manifest、`inspect-delivery-triage` 命令、switchyard CSS 和 package script 时，领域与插件契约按预期失败；
- 定向统一分诊 + Obsidian + publishing 测试 50/50；
- 与既有 review/publication 交付回归一起运行 29/29，通过共享快照重构未改变两套原语义；
- 真实 Git review fixture 精确路由到 review，publication fixture 精确路由到 publication；
- 两个 fixture 在创建本地待交付 commit 后删除裸远端目录，分诊仍完成，证明没有 fetch、push 或其他远端访问；
- 真实 Git 分诊前后 HEAD、index 与 worktree 逐字节一致；
- 第一次完整门的 213 项运行时测试全部通过，但 TypeScript 发现布尔别名未保留 nullable 判别联合收窄；改为显式冻结 `pendingReview` / `pendingPublication` 局部值并做不可达空值保护后，独立 typecheck 通过；
- 修复后的完整 `npm run release:check` 用时 136.5 秒：Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、213/213 单元与集成、TypeScript、45 页、19/19 生产应用测试、production audit 0；
- 归档后完整 `npm run release:check` 用时 189.4 秒；相同内容库存、213/213、45 页、19/19 与依赖审计 0 全部保持通过；
- 真实仓库 `content:delivery:status -- --format json` 为 main、ahead 0、behind 0、synchronized、route none、networkChecked false、autoExecuted false，退出码 0；
- `git diff --check` 通过；没有新增依赖、secret、数据库、Cloudflare、fetch/rebase/reset/force push 或外部写入 API；
- 功能提交 `30d002e4a5cd712c9ab48c951731431d51e3f9dd` 已推送；Quality Gate、Vercel deployment status、部署后 Verify Vercel production 3/3 success 并绑定该 SHA；
- 真实 Obsidian 宿主像素外观仍未人工截图验收，本轮只声明 DOM、行为、严格 parser 与 CSS 契约。

## 8. 经验与教训

- 两个分析器分别“只读”并不等于组合结果来自同一时刻；先冻结共享观察，才能让互斥路由具有审计意义；
- 统一入口不应统一写事务。导航层保留完整原领域证据、执行层继续独立，才能减少选择成本而不扩大授权面；
- route 摘要不能替代原 schema。插件复用领域 parser，能阻止伪造 `kind: publication` 绕过多路径清单校验；
- 非 main 上的身份识别仍有诊断价值，但命令展示必须把“知道是什么”与“允许写入”分开；
- 删除测试远端比 mock “没有调用 fetch”更强：任何隐式远端访问都会让真实夹具直接失败；
- synchronized、exact pending 与 inspect 是互斥路线，不适合用并列 dashboard 卡片表达；单节点道岔更贴近领域结构；
- 没有动作按钮是一项安全设计：统一视图只回答去哪条轨道，作者仍需在领域 status 中检查细节后显式运行 deliver；
- TypeScript 对由布尔别名间接表达的 nullable 收窄可能保守；将已验证联合成员冻结为局部变量，让运行时 invariant 和静态类型边界保持一致；
- 完整门必须跑到 TypeScript 和生产构建。仅凭 213 个 Node 测试通过，会漏掉纯类型层的契约缺口。

## 9. 全局状态、风险与未解决问题

MyBlog Publisher 1.12.0 现在为任意 Git push 失败提供一个首先可运行的只读入口。作者不再需要先判断复核或新内容发布；exact route 会把他带到既有 status/deliver 链路，而两个 OID 写事务和各自 sealed receipt 保持独立。站点继续以 GitHub 为唯一内容事实源、Vercel 原生托管，不依赖 Cloudflare。

统一分诊仍只观察本地 tracking ref，不声称知道远端当前状态；inspect 不会自动 fetch、合并或重排历史。它只解决“该进入哪条既有恢复链路”，不解决本机缺 Node/npm、Git 身份、错误仓库根、插件未重载等环境问题。真实 Git 凭据和网络仍是作者环境责任。实际 Obsidian 主题、超长 OID/path、大量媒体清单和窄屏像素体验仍需在日常使用中观察。

其他长期风险不变：Studio OAuth 与固定 Decap bundle 需要维护；实时外链网络结果不进入硬门；自定义域名、公开邮箱、统计和评论等待所有者选择；`decap-cms` 开发依赖审计与 Actions major tag 指针另行处理。

## 10. 下一轮唯一主任务

增加只读作者环境自检。新增版本化 `content:author:doctor`，在发布或复核前检查受支持的 Node/npm、Git 仓库根、当前分支与 tracking、Git 用户身份、关键 npm scripts、内容目录、Vault 和 MyBlog Publisher 版本；Obsidian 增加“检查本机发布环境”视图。报告给出每项 observed/expected 与可执行修复路径，但不安装工具、不改 Git 或 Obsidian 配置、不读取凭据、不访问云 API，也不替代 `release:check` 或任何领域 status。
