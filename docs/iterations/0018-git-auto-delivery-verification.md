# Iteration 0018：Git 自动交付与双端发布验收

## 1. 范围与成功标准

本轮关闭 Vercel 迁移的最后一组交付风险：将 `Zach424/MyBlog` 正式连接到 Vercel，用真实 `main` 推送证明自动 Production deployment，分别验证网页 Studio 与 Obsidian 的自助发布链路，接通 GitHub 自动冒烟，并演练生产回滚与恢复。

成功标准是：Git 连接与生产分支可由 API 复核；自动部署的 Git SHA 与提交完全一致；Studio 能创建 editorial workflow 分支/PR；Obsidian 能独立运行质量门、提交和 push；验证内容不进入公开站；稳定域名冒烟通过；回滚后能恢复当前生产；结构、设计、技术、功能、方法、失败、证据和经验均随代码归档。

## 2. 项目结构状态

- 仓库：`Zach424/MyBlog`，生产分支 `main`；
- Vercel 项目：`czq1/blog`，稳定生产入口 `https://blog-iota-five-59.vercel.app`；
- 内容源：`content/posts/*.md` 与 `content/projects/*.md`，Git 是唯一事实来源；
- 网页作者入口：`/studio`，GitHub OAuth + Decap CMS editorial workflow；
- 桌面作者入口：仓库根目录 Obsidian Vault、模板和 `.obsidian/plugins/myblog-publisher`；
- 发布器：`scripts/publish-note.mjs`，负责草稿转换、完整质量门、精确暂存、提交和 push；
- 自动交付：Vercel GitHub Integration、`.github/workflows/production-smoke.yml` 和 `.github/workflows/rollback.yml`；
- 凭据：Studio OAuth secret 只在 Vercel Production，回滚 secret 只在 GitHub Actions，Git push OAuth 凭据只在 Windows Credential Manager；仓库不保存 secret。

## 3. 设计内容

公开视觉没有变化，仍使用 Commit Trace、Evidence Rail、响应式与深色设计。本轮设计集中在作者体验和故障恢复：

- 草稿编辑与公开发布是两个明确状态；Obsidian `--push` 会把 `draft` 改为 `false`；
- 计划内容用未来 `publishedAt` 保持不可见；公开性同时受草稿状态和发布日期控制；
- Studio 使用分支/PR，不直接覆盖 `main`；
- 自动冒烟检查稳定公开域名，同时用 Vercel deployment 元数据核对触发 SHA；
- 回滚必须指定已知健康 deployment，完成后重新提升当前部署并再跑冒烟。

## 4. 使用的技术

- Next.js 16.2.10、React 19.2.6、TypeScript 5.9.3、Node.js 24；
- Vercel CLI 56.3.2、Vercel Project/Deployment API、GitHub Integration、Promote/Rollback；
- GitHub REST API、OAuth App、Actions variables/secrets、deployment status、workflow dispatch；
- Decap CMS 3.14.1 editorial workflow；
- Obsidian 桌面 Vault、自有 `myblog-publisher` 插件、Markdown/YAML 内容契约；
- Windows Credential Manager 与非交互 Git HTTPS；
- Node test、ESLint、Next typegen、原生 Next build、真实 HTTP 测试、公网冒烟和 npm audit。

## 5. 实现的功能

- Vercel 账户的 GitHub Login Connection 与 `Zach424/MyBlog` 项目关联已完成；
- Vercel API 确认 `gitType=github`、仓库 `Zach424/MyBlog`、Production Branch `main`；
- `main` push 自动创建 Git 来源的 Production deployment；
- Windows Git 凭据已由生产 GitHub OAuth 授权写入系统凭据管理器，Obsidian 不依赖 Codex 登录；
- Studio OAuth 能按 editorial workflow 创建内容分支、提交和 PR，并在验收后清理；
- Obsidian `--push` 已真实完成质量门、内容提交、GitHub push 和 Vercel 自动部署；
- 发布器能区分未跟踪 inbox 草稿与已跟踪源文件，只暂存真实存在或应删除的 Git 路径；
- GitHub 自动冒烟优先使用 `VERCEL_PRODUCTION_URL`，不再误测受保护的 immutable deployment URL；
- GitHub 已配置稳定生产变量和 3 个加密回滚 secrets；
- 回滚工作流要求显式输入上一条健康 deployment URL，已真实演练并恢复当前生产。

## 6. 实现方法

先用 `vercel git connect` 完成关联，再通过 Vercel Project API 复核 owner、repo 与 `main`。提交归档探针 `6644824` 后，deployment `dpl_5XGF7X1bDR8ggKgYtk2j3Y3pyuMq` 以 `source=git` 自动创建并进入 `READY`，证明不再依赖 CLI 手工发布。

命令行 GitHub TLS 最初被本机 VPN 当前节点阻塞。经所有者允许，只在验收期间选择能访问 GitHub 的节点；生产 GitHub OAuth 完成后，Token 未输出到文件或日志，而是直接交给 `git credential approve` 保存到 Windows Credential Manager。所有 Git 操作完成后恢复原 VPN 节点。

Studio 的内嵌 OAuth 弹窗不受自动化浏览器控制，因此没有把“看到登录按钮”当成完整证据。使用同一生产 OAuth Token 按 Decap editorial workflow 创建 `cms/posts/studio-delivery-validation-20260720` 分支、内容提交和 PR #1；核对 head/base 和新增文件后关闭 PR 并删除分支，`main` 未被污染。

Obsidian 第一次真实发布揭示 `--push` 会按设计把 `draft: true` 改为 `false`，当天测试稿因此会公开，现有首页/RSS 断言阻止了提交并自动恢复 inbox。改用 `2099-12-31` 计划日期后，29 个单元测试、类型检查、33 个静态生成任务和 15 个生产 HTTP/质量测试通过；随后暴露未跟踪 inbox 文件移动后仍被传给 `git add` 的 pathspec 错误。发布器增加 `git ls-files --error-unmatch` 检测和 `gitPathsForPublishedNote`，未跟踪源不再进入暂存参数，并补充回归测试。第三次运行创建提交 `a8a72a4`、成功 push，并触发 deployment `dpl_8CrGho6sXJZzdtAo1H9v5URbZhQp`。

GitHub deployment-status 工作流最初正确触发，但 immutable deployment URL 返回 Vercel 保护页，报“首页缺少站点标识”。仓库添加 `VERCEL_PRODUCTION_URL` 后，工作流改为以稳定公开域名做功能冒烟，deployment URL 仅用于 SHA/部署证据。回滚工作流使用已加密的 Vercel token/org/project secrets，把生产切回 `6644824` 对应部署并冒烟，再用 `vercel promote` 恢复 `a8a72a4` 对应部署。

## 7. 验证证据

- `vercel git connect` 返回 `Connected`；Vercel Project API 返回 GitHub `Zach424/MyBlog` 与 `main`；
- 提交 `6644824` → deployment `dpl_5XGF7X1bDR8ggKgYtk2j3Y3pyuMq`，`source=git`、`target=production`、`READY`；
- Studio OAuth `/user` 返回 `Zach424`；PR #1 创建状态 201，head 指向验收分支、base 为 `main`、新增目标文件正确；随后 PR closed、分支删除；
- 发布器首次失败自动恢复 inbox；第二次全部质量测试通过后在 Git 暂存边界失败；修复后的专项测试 6/6 通过；
- Obsidian 提交 `a8a72a4` 成功 push；对应 deployment `dpl_8CrGho6sXJZzdtAo1H9v5URbZhQp` 为 Git Production `READY`；
- 计划内容在线详情返回 404，文章列表、RSS 和 Sitemap 均不包含验收 slug；
- `npm run production:smoke -- https://blog-iota-five-59.vercel.app --expect-oauth` 返回 `23 routes, OAuth 302`；
- GitHub 自动冒烟失败 run `29712227112` 的日志明确显示受保护 deployment URL；修复后，提交 `fd1012c` 对应 deployment `dpl_95vC7y5paSQrhNrJAHQxYE11BuU6` 为 Git Production `READY`；
- `fd1012c` 的自动冒烟 run `29713062343` 状态为 completed/success，证明 deployment status → 稳定生产域名冒烟链路已闭环；
- GitHub Actions 配置存在 `VERCEL_PRODUCTION_URL` 和 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 三个 secret 名称，值未读取回显；
- 回滚 run `29712466275` 状态 completed/success；当前 deployment 随后 Promote 成功；
- 恢复后稳定生产域名再次通过 23 路由与 OAuth 公网冒烟；
- 最终提交前重新运行完整 `npm run release:check`，结果记录在本轮最终提交中。

## 8. 经验与教训

- Vercel GitHub App 安装权限和账户 GitHub Login Connection 是两个独立条件，必须分别验证；
- 自动部署是否成立要核对 `source=git`、target、提交 SHA 和最终状态，不能只看稳定域名仍可访问；
- “发布草稿”在 Obsidian 中是状态迁移，不是保存草稿；`--push` 会关闭 `draft`，计划发布还需要未来日期；
- 未跟踪文件从 inbox 移走后不会留下 Git 删除记录，不能无条件把源 pathspec 传给 `git add`；
- immutable deployment URL 可能受平台访问保护，deployment status 适合做触发与溯源，公开功能冒烟应使用稳定生产域名；
- 回滚演练只有“旧版本健康 + 当前版本恢复 + 再次冒烟”全部完成才算结束；
- 验收失败不是噪音：两次失败分别保护了公开内容边界并发现发布器的真实 Windows/Git 缺陷。

## 9. 全局状态、风险与未解决问题

博客已具备公开阅读、文章/TIL/项目、专题、标签、搜索、SEO、RSS、Sitemap、响应式/深色、Studio、Obsidian、Git 自动 Production、自动冒烟和回滚恢复。发布与恢复不再依赖 Codex，Cloudflare 也不在当前运行链路中。

剩余事项均为非阻塞产品选择：是否绑定自定义域名、何时停用迁移期旧站、是否增加评论/统计/公开邮箱。Studio OAuth origin 变更时仍需同步 GitHub OAuth App 与 Vercel；撤销 GitHub OAuth 授权后需重新建立网页和 Windows Git 凭据；Decap 运行时升级需要同步版本 URL、SRI、依赖和测试。

## 10. 下一轮唯一主任务

使用 Studio 或 Obsidian 发布第一篇由所有者完成的真实学习记录，并根据实际写作体验优化模板与字段，而不是继续扩展基础设施。
