# Iteration 0034：Obsidian inbox 发布就绪报告

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex，即可从网页 Studio 或 Obsidian 发布学习记录和项目复盘；内容、附件、路由历史与每轮工程证据进入 Git，`main` 自动交付到 Vercel。Iteration 0033 已闭合 URL 迁移，但 Obsidian 仍只能对当前打开的草稿逐篇运行 `--check-only`，作者无法在发布前一次看到全部草稿、未来日期、正式目标冲突和跨草稿附件风险。

本轮只闭合“全 inbox 发布就绪可见”这一条纵切：逐篇隔离解析全部 `content/inbox/*.md`，复用真实发布与媒体派生契约，输出 ready/scheduled/blocked 和可执行原因；提供文本/JSON CLI 与 Obsidian 只读弹窗；证明报告不会改变草稿、附件、Git 或正式内容。不得批量发布、不得自动修复/删除、不得把本地未跟踪状态伪装成 CI 可见，也不在本轮新增云服务或网页后台功能。

## 2. 项目结构状态

- `lib/content/inbox-readiness.ts`：草稿扫描、逐篇隔离、媒体候选、目标/Git/共享源交叉检查、状态与文本格式；
- `scripts/report-inbox-readiness.mjs`：`content:inbox` CLI，支持固定作者日期与 text/JSON；
- `tests/inbox-readiness.test.mjs`：ready/scheduled/blocked、真实媒体、冲突、CLI、零写入与临时目录清理；
- `.obsidian/plugins/myblog-publisher/main.js`：新增全 inbox 命令与纯文本 Modal；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件版本提升到 1.1.0；
- `package.json`：新增 `content:inbox`，纳入 95 项单元测试和本地 `release:check`；
- `tests/obsidian-publishing.test.mjs`、`deployment-tools.test.mjs`：锁定插件安全启动、Modal 和脚本/发布候选连接；
- `content/inbox/README.md`、根 `README.md`、架构/内容/发布/质量/运维文档：同步作者操作和边界；
- `docs/STATUS.md`、`ROADMAP.md` 与本文件：仓库根 Obsidian Vault 的状态、经验和下一主线归档。

## 3. 设计内容

这是作者诊断信息设计。状态只有三种：`ready` 表示单篇写入事务当前就绪；`scheduled` 表示同样就绪但公开日晚于报告日；`blocked` 表示至少有一个必须先处理的问题。blocked 排在前，scheduled 次之，ready 最后，同状态按源路径稳定排序。每篇先显示源/目标、文章或项目、原始 draft 状态和公开日，再显示每个附件的源/目标与真实媒体变化，最后列结构化 issue code 和中文原因。

Obsidian 命令面板新增“查看全部草稿发布就绪状态”。弹窗以 `pre` 和 `setText` 呈现 CLI 输出，不把草稿标题、路径或错误消息解释为 HTML。进度 Notice 在进程 error/close 都关闭；报告内容可滚动、换行且适配窄窗口。blocked 仍以成功进程返回并展示，不会误触发布动作；只有扫描/工具基础设施错误才走失败 Notice。

## 4. 使用的技术

- 现有 `prepareObsidianNote`：类型推断、稳定 slug、严格 frontmatter、Wiki/Markdown 站内链接和附件目标转换；
- 现有 `prepareMediaForPublishing` + Sharp 0.35.3：真实 PNG/JPEG/WebP 优化、GIF/AVIF/动画保留和全部媒体预算；
- Node.js `fs/promises`：确定性 inbox 读取、目标存在检查、系统临时目录创建/清理；
- `git ls-files -z -- public/uploads` + `spawnSync` 参数数组：识别会被正式发布器拒绝移动的已跟踪根附件，不经过 shell；
- Obsidian Desktop `FileSystemAdapter`、`Modal`、`Notice` 与 Node `spawn`；
- Node `parseArgs`：`--date`、`--format text|json`；
- Node 原生 test、真实临时 Git 仓库、Sharp 生成图、ESLint、TypeScript、Next build、生产 HTTP 与 Vercel smoke。

## 5. 实现的功能

- 只读取 inbox 直接子级 Markdown，明确忽略说明 `README.md`，并把非法文件名或符号链接作为单篇 blocked；
- 一个草稿解析失败不会停止其他草稿，所有结果最终合并为稳定报告；
- 成功草稿显示 post/project、slug、正式目标、原始 draft 状态、公开日和附件数量；
- 报告日之前/当天为 ready，未来公开日为 scheduled；
- 正式内容目标已存在时提前 blocked，补足单篇 `--check-only` 只做内容预检而不写入时看不到的冲突；
- 缺失附件、附件目标已存在、根附件已被 Git 跟踪、实际图片无效或超媒体包络分别给出 issue code；
- 同一根附件被多个草稿引用时，所有相关草稿都标记 `attachment-shared`，防止先发布者移动源后破坏其余草稿；
- 每个可读取附件都在系统临时目录真实生成候选，JSON 保留源/产物格式、宽高、帧、字节、优化与节省量；
- 文本/JSON 都明确报告零写入边界；blocked 作为诊断不改变退出码；
- `release:check` 在完整门禁前显示当前作者工作区报告，但 GitHub Actions 不虚构未跟踪本地数据；
- Obsidian 插件 1.1.0 可在没有当前 inbox 笔记时打开全量只读报告。

## 6. 实现方法

扫描器先稳定列出 inbox `.md`，再读取正式 posts/projects 文件名作为与现有发布器一致的链接目标，并通过 NUL 分隔 Git 清单建立跟踪集合。每篇草稿创建独立 entry；文件读取或 `prepareObsidianNote` 错误被收敛为该 entry 的 `draft-invalid`，不会抛到报告全局。成功后再次解析已经关闭 draft 的候选内容，取得可靠 kind/publishedAt，而不是用正则冒充完整 YAML schema；原始 draft 只作为显示状态读取。

媒体检查沿用正式发布器相同的 targetPath 和 `prepareMediaForPublishing`。候选按草稿/附件索引写到由 `mkdtemp` 创建的系统临时目录，文件扩展名与最终目标一致；无论任一步成功或失败，外层 `finally` 都递归删除整个目录。测试还注入专用 stagingParent，断言运行后目录为空。源文件、正式 Markdown 和归档目录从不进入任何 write/rename/remove 分支。

单篇检查完成后再建立 `sourcePath -> entries` 账本；一个源拥有两个以上草稿时，向每个 owner 添加同一共享诊断并强制 blocked。最终状态在所有本地问题和跨草稿问题之后确定，blocked 优先；没有问题时才按 publishedAt 与固定 reportDate 分 ready/scheduled。Obsidian 只调用 `npm --silent run content:inbox`，使用参数数组、`shell: false` 和隐藏 Windows 窗口；输出只交给 `setText`。

## 7. 验证证据

- 最终专项组合：inbox readiness + Obsidian 发布 + 交付连接 22/22 通过；选定文件 ESLint 与 TypeScript 通过；
- 完整 `npm run release:check`：配置完整、Current 1/Historical 3/未公开 0 且 Current 健康、真实 inbox 0/0/0、根暂存媒体 0 个/0 B；
- 同一发布候选继续通过 ESLint、95/95 单元测试、TypeScript、35/35 构建页面、16/16 真实生产 HTTP/质量测试；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- ready 文章夹具真实把 1200×630 PNG 派生为 WebP，scheduled 项目保持未来状态；源 PNG 逐字节不变，正式 posts/上传目录没有生成；
- blocked 夹具覆盖无效文件名、正式目标已存在、缺失附件、已跟踪附件和两个草稿共享源；坏草稿没有阻止其他草稿出报告；
- JSON CLI 在真实临时 Git 仓库返回 ready=1 后，草稿逐字节不变，正式目录和上传根仍为空；注入 stagingParent 最终为空；系统临时目录复核无 `myblog-inbox-readiness-*` 残留；
- 实现提交 `2f4eae92f8912c3147d19b0cb40e6ba0856622a4` 已推送 `main`；GitHub Quality Gate `30940715456` completed/success；
- GitHub Production deployment `5749705914` 精确绑定实现提交且 state=success；`Verify Vercel production` `30940756901` completed/success；
- 稳定域名 `https://blog-iota-five-59.vercel.app` 独立冒烟：`23 routes, OAuth 302`；
- 网络命令只在当前进程使用 `http://127.0.0.1:7897`，未写入永久代理配置。

失败与修复证据：第一轮测试把所有夹具的 `reviewedAt` 固定为 2026-08-01，却给 ready/scheduled 草稿设置 2026-08-05/10 的公开日，现有内容契约正确拒绝“复核日早于公开日”；夹具随后改为复用各自 publishedAt，没有放宽生产 schema。最初把测试、lint、typecheck 用分号放在同一 shell 调用，单元测试失败后后续命令成功导致最终 shell 状态为 0；复盘时依据 Node test 的 fail 摘要而非外层退出码发现问题，修复后用独立测试命令得到 22/22，再运行完整 release gate。这个经验已归档，后续多门禁串行应使用 `&&` 或分别读取每一步状态。

## 8. 经验与教训

- “逐篇检查”无法发现跨草稿共享源；聚合报告的价值不只是批量输出，而是建立单篇工具看不到的关系账本；
- readiness 必须区分“可以提交”和“今天公开”，否则未来日期会被误报为失败或立刻可见；
- 真实媒体候选比只检查源扩展名强：作者需要提前知道最终 WebP、尺寸和字节变化，但候选不应污染仓库 staging；
- blocked 是作者工作队列，不等于现有生产版本有错；因此默认进程成功并保留结构化状态，基础设施故障才非零；
- GitHub Actions 无法看到本地未跟踪草稿，声称 CI 覆盖 inbox 会制造虚假安全感；本地 CLI/Obsidian 与仓库 Actions 应明确数据边界；
- 诊断弹窗必须使用纯文本 API，草稿内容和错误消息都不能成为 HTML 注入面；
- 多命令 shell 的最终退出码可能掩盖前序失败，验证证据必须读具体测试摘要，并优先使用失败即停的组合；
- research-iteration-loop skill 使本轮保持在只读 readiness 纵切内，没有顺手加入批量发布、自动修复或云端同步。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容契约、知识链接、内容维护、永久 URL 迁移、全 inbox readiness、媒体预算/引用/展示、Obsidian 优化事务、Studio per-slug 归档/上传预检/稳定身份、根暂存库存、自动交付和恢复均可用。作者现在可以在不打开每篇草稿的情况下先看到全部本地发布队列和跨草稿附件冲突。

剩余主要风险：readiness 有意只证明单篇写入事务，正式发布仍可能因同时存在的其他仓库变化在完整 `npm run check` 失败；未跟踪草稿不在 Actions；当前真实 inbox 为空，正向多草稿路径由临时仓库验证，首次实际使用仍需观察；全站内容关系只在详情页显示，没有公开知识地图；同 slug Studio 文件名冲突、附件 Git 历史增长、Decap 固定 bundle/上游开发依赖审计、宽 OAuth scope、CSP 内联/eval 例外、Vercel deployment 保护/Hobby 回滚、自定义域名、统计、评论、外部提醒与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

建立公开、可访问的全站知识地图。复用现有公开文章/项目集合与正文派生的 outgoing/backlinks，在 `/knowledge` 服务端生成确定性节点和有方向的边；页面同时提供无 JavaScript 可读的关系清单，让屏幕阅读器、搜索引擎和低能力设备不依赖画布。加入主导航、metadata/canonical、Sitemap、响应式/深色设计、孤立节点和空关系语义，并用真实 HTTP/内部链接/320px 测试闭环。不得把图另存为 frontmatter/JSON、不得接数据库或第三方图服务，Markdown 正文链接继续是唯一事实源。
