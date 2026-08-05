# Iteration 0052：Obsidian 结构化内容复核台账

## 1. 范围与成功标准

本轮只把 Iteration 0051 的 Obsidian 纯文本维护报告推进为可信、可操作的本地复核台账。权威数据仍由仓库 `content:status` 和 Git 内容文件产生；不改变文章/项目公开规则、`reviewedAt` 语义、发布事务、Studio、线上路由、Vercel、网络服务或外部提醒。

成功标准是：CLI JSON 有显式版本；插件逐字段验证版本、日期计算、四级计数、阈值、排序、URL 与来源路径；原生 Modal 显示真实期限轨迹和逐条记录；只允许打开 Vault 中精确存在的 `content/posts|projects/<slug>.md`；已过期内容导致 CLI 返回 1 时仍展示有效报告；JSON、schema、安全路径或 UI 渲染失败时重新取得纯文本证据；全部入口保持零网络、零自动改日期、零文件/Git 写入；Windows/POSIX 进程边界与既有发布命令无回归。回滚功能提交 `69e3ee5e35e45a3e261172c27749386c6ad19c8b` 即可恢复 1.2.0 纯文本界面，不影响任何内容文件或线上数据。

## 2. 项目结构状态

- `lib/content/maintenance.ts`：`ContentMaintenanceReport` 新增固定 `version: 1`，所有文本、JSON、Actions 与 Obsidian 消费者继续共享同一报告派生；
- `scripts/report-content-maintenance.mjs`：无需新分支；既有 `--format json` 自动输出新版本字段，逾期仍用退出码 1 表达构建门语义；
- `.obsidian/plugins/myblog-publisher/main.js`：新增版本化 JSON validator、结构化 `ContentMaintenanceModal`、纯文本降级 Modal、精确 Vault 文件打开和维护命令的 `[0, 1]` 有效退出码；既有通用子进程生命周期继续复用；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增只作用于 `.myblog-maintenance` 的宿主原生 deadline ledger 样式；
- `.obsidian/plugins/myblog-publisher/manifest.json`：MyBlog Publisher 从 1.2.0 升到 1.3.0；
- `tests/content-maintenance.test.mjs`：锁定报告版本；
- `tests/obsidian-plugin.test.mjs`：DOM mock 扩展为嵌套原生元素、class/attribute/event、Vault 文件与 leaf 打开行为，覆盖结构化、逾期、降级、空态、缺失路径与跨平台生命周期；
- `tests/obsidian-publishing.test.mjs`：既有发布器静态契约同步到 1.3.0；
- `docs/STATUS.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/OPERATIONS.md`、`docs/PUBLISHING.md`、`docs/ROADMAP.md` 与 `content/projects/myblog.md`：同步当前结构、设计、使用方法、运行边界、证据、风险与下一任务；
- Next.js 页面、Studio、公开内容 schema、媒体事务、GitHub workflow、Vercel 配置和生产客户端 bundle 没有改变。

## 3. 设计内容

### 用户、场景与任务

唯一用户是正在 Obsidian 中维护已发布 Current 内容的仓库所有者。打开 Modal 后的核心任务不是“浏览后台数据”，而是快速回答三件事：现在有多少内容进入哪个期限阶段、哪一条最紧急、对应的事实源笔记在哪里。因此界面采用 deadline ledger，而不是网页 Studio 的复制品或卡片仪表盘。

### 信息层级与视觉语言

顶部先声明“Git 文件仍是唯一事实源”和报告版本/日期；三格范围账本区分持续复核、历史快照和未公开；四段期限轨迹始终列出健康、进入复核窗口、即将到期、已过期的真实计数。逐条记录以左侧状态线形成唯一可记忆的 urgency rail，同时显示中文状态、剩余/逾期天数、标题、公开路由、最近复核、最后有效日、运行天数和来源路径。颜色、状态文字和数值同时表达语义，不能只靠颜色。

排版、颜色和控件服从 Obsidian：正文使用 `--font-interface`/`--font-text`，日期和路径使用 `--font-monospace`，颜色使用宿主 `--color-*` 与 `--text-*` token 并提供克制回退。结构用规则线和留白，不用圆角卡片、阴影、渐变、图标或动画。窄 Modal 把四档轨迹折成两列、日期折成单列；每条记录只有一个原生 `mod-cta`“打开笔记”。复核清单默认收起，避免抢占紧急记录视线。

### 降级设计

不可信结构不能渲染成可点击 UI。解析、版本、schema、路径或 Modal 构建异常时，插件显示原生 Notice 并重新运行纯文本 `content:status`；结果进入 `pre` 且只用 `setText`，与终端证据逐行一致。降级不是把原始无效 JSON 伪装成报告，而是第二次请求既有、独立的文本格式。

## 4. 使用的技术

- TypeScript 维护域模型与固定 JSON schema version；
- Obsidian Desktop Plugin API：`Plugin`、`Modal`、`Notice`、`FileSystemAdapter`、Vault `getAbstractFileByPath` 与 workspace leaf `openFile`；
- CommonJS 插件入口、原生 DOM/Obsidian element helpers、作用域 CSS 与宿主 design token；
- Node.js `child_process.spawn`、固定 npm 参数、`shell: false`、200,000 字符输出包络、幂等运行账本和 Windows 进程树清理；
- 纯函数式 JSON 边界校验：exact keys、ISO 日期、UTC 日差、阈值状态、计数、排序、slug/路由/来源对应关系；
- Node.js `vm`、`node:test`、strict assertions 与可控 DOM/Vault/child process mock；
- research-iteration-loop 把本轮限制为“可信维护 JSON → Obsidian 台账”一个纵切，并要求先验证旧行为与失败模式；
- frontend-design 把结构收敛为期限轨迹和规则线台账，复用宿主字体/颜色，不引入模板化管理卡片。

## 5. 实现的功能

- `ContentMaintenanceReport` 输出 `version: 1`；
- 命令面板入口更名为“查看已发布内容复核台账”，运行 `npm --silent run content:status -- --format json`；
- 插件拒绝未知字段、未知版本、无效日期、错误日差、错误 review-by/remaining、计数漂移、阈值矛盾、记录乱序、重复路径、kind/slug/URL 不一致和任何非精确来源路径；
- 原生 Modal 显示报告边界、范围、四级期限轨迹、逐条维护记录、来源路径和复核清单；
- 空队列有明确空态，不制造虚构记录或完成率；
- “打开笔记”在点击时再次核对安全路径，并要求 Vault 返回同路径 `.md` 文件；成功后使用当前 workspace leaf 打开并关闭 Modal，缺失或打开失败只显示 Notice；
- 维护 CLI 返回 1 且 JSON 有效时照常显示逾期记录，修复了 1.2.0 在最需要看报告时反而报命令失败的语义缺口；
- JSON/schema/path/UI 异常自动启动第二个纯文本报告命令；纯文本即使因逾期返回 1 也作为只读证据显示；
- inbox、发布和维护继续共享输出上限、Notice、单次结算、卸载取消和跨平台进程清理；
- 公开页面与客户端体积不变，新增插件 CSS 只由本地 Obsidian 加载。

## 6. 实现方法

先把预期写进测试。初次运行扩展后的完整单元集为 152/162，通过的旧行为保持不变，10 个失败精确落在缺失 `version`、插件仍为 1.2.0、命令没有请求 JSON、逾期退出码被拒绝、没有结构化 DOM/打开动作和没有纯文本二次降级。实现后定向维护/插件测试为 15/15。

JSON validator 在交互前 fail closed。它先检查顶层 exact keys 与 `version === 1`，再验证报告日和阈值；逐条复算 `buildDate - reviewedAt === ageDays`、`reviewedAt + maxAgeDays === reviewBy`、`maxAgeDays - ageDays === remainingDays`，按阈值得到应有状态，并核对 `kind → posts|projects → slug → sourcePath/url`。最后重新统计四档计数、Current 数量和紧急度排序。只有整个快照可信，Modal 才获得记录和按钮。

`runRepositoryCommand` 新增每条命令可配置的有效退出码集合，并把 success Notice 设为可选。维护 JSON/文本允许 `[0, 1]`，因为 1 既可能是“存在逾期”的领域结果，也可能是错误；JSON 路径依靠严格 parser 区分可信报告，无法解析时转入纯文本证据。其他 inbox/发布命令仍只接受 0。成功回调现在有同步异常隔离，不会让 Modal 错误逃出事件处理器。

打开来源采用两层防线。schema 只接受由 kind 与 slug 唯一计算出的路径；点击时再用固定正则核对，并通过 Vault 查询确认对象的 `path` 和 `extension`。不使用可解释别名或模糊匹配的 `openLinkText`，避免恶意/漂移路径越过内容边界。DOM 测试模拟按钮事件和异步 `openFile`，既证明成功的唯一文件，也证明缺失文件不会打开或关闭 Modal。

## 7. 验证证据

- 失败优先：扩展测试在旧实现上 152/162，通过 152、失败 10；失败覆盖报告版本、插件版本/参数、逾期 exit 1、三种降级、空态、打开动作与 POSIX JSON 参数；
- 定向实现验证：`node --experimental-strip-types --test tests/content-maintenance.test.mjs tests/obsidian-plugin.test.mjs` 为 15/15；
- 样式契约验证作用域根、overdue 状态、宿主 interface font，并拒绝 gradient/keyframes/animation；`node --check`、ESLint 与 `git diff --check` 通过；
- 真实 `npm --silent run content:status -- --format json` 输出 `version: 1`，报告日 2026-08-05、Current 1、Historical 3、未公开 0；`content/projects/myblog.md` healthy、review by 2027-02-01、剩余 180 天；
- `npm run release:check` 通过：Current 1 / Historical 3、inbox 0、根暂存 0、外链 2 URL / 3 occurrences / 0 issue、ESLint、162/162 单元、TypeScript、45 个页面生成任务、19/19 生产应用测试、production audit 0；
- 首次同步公开 MyBlog 项目状态时，生产测试发现 `/projects/myblog` HTML 超过 100 KB；没有放宽预算，而是把公开页压缩为结论与数字、把方法细节留在本档案，重新构建与 19/19 生产测试通过；
- `.next/static` 保持 1,818,133 B；插件 `main.js`、manifest、styles 合计 28,240 B，不进入公开阅读客户端；
- 功能提交 `69e3ee5e35e45a3e261172c27749386c6ad19c8b` 已推送；Quality Gate `30984948634`（#91）与 Vercel Production 验证 `30984986149`（#84）均 completed/success；
- `.obsidian/community-plugins.json` 继续启用 `myblog-publisher`，仓库根仍是 Vault；没有新增 secret、云配置、API、数据库、Cloudflare 或外部消息通道。

## 8. 经验与教训

- 非零退出码不一定是执行故障。维护 CLI 的 1 表示“存在逾期并应阻断门禁”，对只读查看器却是最重要的有效结果；进程层和领域层必须分开判断；
- “JSON.parse 成功”远远不等于可信交互。只要数据会生成可点击路径，就应复算字段关系和 exact keys，而不是只检查几个字符串存在；
- schema version 应在生产者和消费者同时明确。静默增加字段会让旧插件误读，新版本则能可靠降级并提示重新加载；
- 安全打开需要“可推导路径 + 真实文件存在”两层，而不是清理 `..` 后接受任意相对路径；精确路径也避免 Obsidian 别名/模糊解析打开错误笔记；
- 降级应重新调用独立的纯文本表示。把损坏 JSON 原样塞进 `pre` 虽然安全，却不能给作者可读、可行动的维护证据；
- 宿主插件 UI 的辨识度可以来自真实期限结构，而不需要复制站点品牌。四段 trace 和逐条 urgency rail 比卡片、图标和动画更适合维护任务；
- VM 行为测试要覆盖嵌套 DOM、属性、事件和异步 workspace API，单纯断言命令名或顶层文字无法证明按钮只打开唯一目标；
- 自动化可以证明结构、行为、颜色 token 和响应式规则，但不能替代真实 Obsidian 主题中的像素验收；这应作为运行风险明示，不能伪装成已经目测通过。
- 公开项目页是当前结论索引，不是迭代档案的镜像。把每轮实现细节同时堆到公开 Current 内容会放大服务端 HTML；100 KB 门应推动信息分层，而不是被状态文案逐轮蚕食或随手调高。

## 9. 全局状态、风险与未解决问题

博客现在有 Git-first 内容、Studio/Obsidian 双发布入口、公开阅读/搜索/Feed/知识图、内容/媒体/关系/外链/新鲜度门、Vercel 自动交付与恢复，以及 Studio、Obsidian、CLI/Actions 三套共享规则的 Current 维护视图。Obsidian 已从“能看到 sourcePath”推进到“只在可信结构中打开精确 sourcePath”，仍没有网络、数据库、Codex 或 Cloudflare 运行依赖。

MyBlog Publisher 1.3.0 写入 Vault 后，已运行的 Obsidian 不会自动热更新，作者必须重启或重新启用插件。当前自动化没有启动真实 Obsidian，也没有目测多种第三方主题、超长标题或大队列；CSS 使用宿主 token 和明确窄屏折叠降低风险，实际内容增长时仍需观察。插件 validator 与 CLI 的 version 需要协调升级；结构漂移会可靠退回文本，但会额外启动一次本地命令。纯文本 fallback 的 exit 1 既可包含逾期证据也可包含 CLI 错误文本，所以它只提供诊断，不产生任何打开按钮。

台账只负责发现和定位，不会替作者完成事实复核。作者打开正式笔记后仍要手动核对架构、版本、项目状态、命令和外链，并显式更新正文、`updatedAt`/`reviewedAt`，再通过终端或 Git 工具提交。既有 Decap 固定版本/OAuth/CSP、开发依赖审计、Vercel Hobby 回滚、网络健康假阴性、附件 Git 历史、知识图扩容和所有者尚未选择的域名/统计/评论继续保留原风险。

## 10. 下一轮唯一主任务

补齐 Obsidian 正式内容的自助复核闭环：为当前精确位于 `content/posts|projects/<slug>.md` 的已发布笔记提供“检查当前正式内容”和“提交并同步复核”两条固定命令。作者必须先人工修改事实和 `updatedAt`/`reviewedAt`；命令复用完整仓库质量门，验证内容身份与复核日期，只暂存精确笔记，并在存在无关工作区修改、身份漂移或门禁失败时不提交、不推送。不得自动把打开/点击当作完成复核，不新增网络服务、数据库或外部提醒，并继续保留完整失败回滚和跨平台行为测试。
