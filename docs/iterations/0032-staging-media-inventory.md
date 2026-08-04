# Iteration 0032：根暂存媒体库存

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex，即可从网页 Studio 或 Obsidian 发布学习记录和项目复盘，内容、附件与历史进入 Git，并由 `main` 自动交付到 Vercel。Iteration 0031 已锁定 Studio slug，但 Obsidian 粘贴图片在发布前仍会进入 root `public/uploads`；构建有意豁免这些 inbox 附件的孤儿门禁，长期积累只能靠作者记忆清理。

本轮只闭合“根暂存区可审计”这一条纵切：确定性列出文件、字节、引用草稿、Git 状态、最近变化证据和处理建议；识别共享、未引用、陈旧、缺失引用与无法解析的草稿；同时服务本地未跟踪附件和 CI 已跟踪附件；接入发布候选与 GitHub Actions；无论报告结果如何都不得自动删除文件或改变现有构建/发布结果。

## 2. 项目结构状态

- `lib/content/staging-media.ts`：库存、引用账本、Git/文件系统年龄证据、状态分类、文本/Markdown/Actions 格式；
- `lib/obsidian-publishing.ts`：导出与真实发布同源的严格附件提取和容错审计模式；
- `scripts/report-staging-media.mjs`：`media:staging` CLI，支持固定日期、陈旧阈值、text/JSON 和 GitHub summary；
- `tests/staging-media.test.mjs`：纯状态矩阵、真实临时 Git 仓库、CLI、Actions 摘要和零删除验证；
- `.github/workflows/quality.yml`：每次 PR/push、手动和每周维护都输出暂存库存；
- `package.json`：增加 `media:staging`，纳入单元测试与 `release:check`；
- `tests/deployment-tools.test.mjs`：锁定 CLI、workflow 和包脚本的交付连接；
- `README.md`、`docs/ARCHITECTURE.md`、`CONTENT_MODEL.md`、`PUBLISHING.md`、`QUALITY.md`：同步操作方法、证据语义和质量基线；
- `docs/STATUS.md`、`ROADMAP.md` 与本文件：仓库根 Obsidian Vault 的状态与经验归档。

## 3. 设计内容

这是维护信息设计，不新增公开页面。终端输出使用已有 `[staging]` 证据前缀，先给日期、30 天阈值、文件/体积/状态总览，再逐文件给路径、引用草稿、年龄来源、Git 状态和一句处理建议。Actions summary 使用单表，不使用虚构分数、进度条或自动清理按钮；warning 精确绑定到附件或草稿源路径。

最重要的视觉/语义边界是“证据来源可见”：干净跟踪文件显示 `Git`，本地修改或未跟踪文件显示 `filesystem`，避免把本机 mtime 冒充仓库历史。所有格式末尾都明确“只提供证据与建议，不会自动删除”，使未引用不等于可以无确认删除。

## 4. 使用的技术

- Node.js `fs/promises`：目录、字节、mtime 与 Markdown 读取；
- `child_process.spawnSync` + 参数数组：查询 `git status`、`git ls-files` 和 `git log`，不经过 shell 插值；
- 现有 `listMediaRepositoryFiles`：复用根上传目录、安全文件类型和大小写清单；
- 现有 `transformMarkdownProse`、Wiki/Markdown/cover 解析与附件路径归一化：审计和真实发布共享语义并忽略代码示例；
- `resolveContentBuildDate`：把 filesystem mtime 也转换到作者时区 `Asia/Shanghai`；
- Node `parseArgs`：`--date`、`--stale-days`、`--format`、`--github-summary`；
- `GITHUB_STEP_SUMMARY` 与 workflow command warning；
- Node 24 原生 test、真实临时 Git 仓库、ESLint、TypeScript、Next build、生产 HTTP 测试和 Vercel smoke。

## 5. 实现的功能

- 只扫描 `public/uploads` 根文件，不把 `public/uploads/<slug>/...` 正式归档媒体混入队列；
- 识别单草稿引用 `referenced`、多草稿共享 `shared` 和 `unreferenced`；
- 额外报告草稿引用但文件不存在，以及命名/附件路径无法审计的草稿；
- Wiki 图片、Markdown 图片和 frontmatter cover 复用发布器同一规则，行内/围栏代码示例不形成占用；
- 即使草稿包含一个非法引用，仍保留同一草稿中其他合法附件的占用证据；真实发布继续对非法引用严格失败；
- 干净已跟踪文件用最后 Git 提交日期；modified/staged/untracked 文件用本地 filesystem 日期，并同时显示 Git 状态；
- 默认 30 天标记陈旧，`--stale-days` 可做确定性演练；
- 文本与 JSON 可本地使用，Markdown 和 warning 自动进入 Actions；
- 发现共享、未引用、陈旧、缺失或草稿问题时 CLI 仍返回成功，只有扫描/参数错误失败；
- `release:check` 和 Quality Gate 都会运行同一库存；
- 当前仓库实际报告为根暂存 0 个、0 B、0 需关注，不修改任何文件。

## 6. 实现方法

库存先复用构建媒体清单，再以 `public/uploads/` 后是否含 `/` 精确区分根暂存和 slug 归档。inbox 只读取发布器允许的直接子级小写 slug Markdown，并显式忽略 `README.md`；其他 Markdown 文件记录为命名问题。附件解析使用发布器的相同 cover、Markdown image 和 Wiki embed 规则，不通过文件名模糊搜索，因此代码示例、普通链接和归档 URL 不会误占用根文件。

发布路径保持 fail-fast；审计路径增加 `onIssue` 收集器。非法引用或多个源会生成同一 WebP 目标时，审计记录问题但继续收集可识别的合法源路径，防止一个坏引用让其他附件被误判为未引用。这个容错只存在于只读报告，`prepareObsidianNote` 未传收集器，仍会在真实发布前抛错。

年龄证据按工作树状态选择。`git ls-files` 判定是否跟踪，porcelain 两列区分 clean/modified/staged/staged-and-modified/untracked；只有 clean 且存在 commit date 时使用 Git 日期，否则使用当前文件 mtime，并以作者时区转换为日期。固定 report date 只计算完整日差，未来本地时间按 0 天处理。状态排序把 shared、unreferenced 和陈旧项放前面；attention 对同一无效草稿只计一次，但保留它的全部问题消息。

## 7. 验证证据

- 最终专项测试：staging media + Obsidian 发布 20/20 通过；首轮 staging/Obsidian/交付组合 22/22 通过；
- 完整 `npm run check`：ESLint、82/82 单元测试、TypeScript、35/35 静态页面生成、15/15 生产 HTTP/质量测试全部通过；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- 真实临时 Git 仓库覆盖 2026-01-01 固定 commit date、2026-02-10 untracked mtime、clean/untracked 状态、Wiki/Markdown/代码示例、缺失附件与非法草稿；
- 真实 CLI 固定 JSON 输出验证 files、missing、invalidDrafts；运行前后逐字节读取 orphan 文件一致；
- GitHub summary 测试确认 warning 存在但进程退出 0；文本和 Markdown 均含零删除声明；
- 当前仓库 `npm run media:staging -- --date 2026-08-05`：根暂存 0 个 / 0 B，引用、共享、未引用、陈旧、缺失均为 0；
- `check-release-config.mjs`：Release configuration is complete；同日内容维护报告 Current 1、Historical 3、未公开 0，Current 状态健康；
- 实现提交 `09bb44187af247a095d4f6fc8f80256283d6c3f8` 已推送 `main`；GitHub Quality Gate `30937066839` completed/success；
- GitHub Production deployment `5749029489` 精确绑定实现 SHA，state=success；`Verify Vercel production` `30937105665` completed/success；
- 稳定域名 `https://blog-iota-five-59.vercel.app` 独立冒烟：`23 routes, OAuth 302`；
- 网络命令只在当前进程使用 `http://127.0.0.1:7897`，未写入永久代理配置。

失败与修复证据：最初按旧记忆读取了不存在的 `scripts/content-maintenance.mjs`，现状审计随后确认真实入口是 `scripts/report-content-maintenance.mjs`；第一版审计遇到任一非法附件就把整篇草稿标为不可审计，复盘发现这会丢失同篇其他合法附件的占用证据，随后增加只读容错收集器并用“合法 + 缺失 + 非法 + 代码示例”混合夹具验证；第一版 filesystem 日期直接截取 UTC，随后改为复用 `Asia/Shanghai` 日期函数，使本地观察与内容维护报告共享作者日期边界。上述修正没有放宽真实发布的严格校验。

## 8. 经验与教训

- 构建豁免根附件是作者工作流需要，不等于它们应该不可见；报告层可以提供治理而不破坏草稿自由度；
- Git 历史和文件系统 mtime 是不同强度的证据，必须显式标注，不能用一个 `last modified` 字段混淆；
- CI 看不到未提交的 Obsidian 图片，因此 Actions 库存是仓库证据，本地 CLI 才是作者工作区证据；两者需要同一个实现但不能宣称覆盖相同数据；
- “无法解析整篇”看似保守，实际上可能抹掉可证明的有效占用并诱导误删；只读审计应尽量保留局部事实，写入/发布仍应 fail closed；
- 多草稿共享附件不是普通引用：第一个发布会移动源文件，第二个草稿会缺失，所以必须在发布前复制为独立所有权；
- 未引用和陈旧只是复核信号，不能自动转成删除；作者内容和附件的不可逆动作必须留给明确人工决定；
- 真实临时 Git 仓库比 mock 更能验证 clean/untracked、commit date 和无 shell 插值契约；
- research-iteration-loop skill 把本轮保持在报告纵切内，没有混入自动清理、云存储或新的公开 UI。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容契约、知识链接、内容维护、媒体预算/引用/展示、Obsidian 优化事务、Studio per-slug 归档/上传预检/稳定身份、根暂存库存、自动交付和恢复均可用。根暂存风险已经从“只能靠记忆”变成每次发布候选、每次 CI 和每周任务都可读取的证据。

剩余主要风险：本地未跟踪附件天然不会出现在 GitHub Actions，作者需要在 Obsidian 工作区运行 CLI；报告有意不删除，清理仍需人工确认；真正 slug 迁移仍须 Git 同步修改文件、引用和附件，且文档要求永久重定向但仓库尚无 redirect 注册表；同 slug 文件名冲突仍由 Decap 与作者处理；附件增长会扩大 Git 历史；Decap 固定 bundle 契约/上游开发依赖审计、宽 OAuth scope、CSP 内联/eval 例外、Vercel deployment 保护/Hobby 回滚、自定义域名、统计、评论、外部提醒与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

建立仓库内永久重定向注册表，闭合真正 slug/URL 迁移。用一个版本化数据文件声明旧站内路径到现行公开路径，构建时拒绝源路径与当前路由冲突、目标不存在、链式/循环重定向、查询/锚点和不安全路径；Next/Vercel 输出永久 308，并由真实 HTTP 测试证明旧 URL 到最终 URL 的单跳行为。不得自动生成迁移、不得依赖云端控制台，也不能把 redirect 变成第二份内容身份源。
