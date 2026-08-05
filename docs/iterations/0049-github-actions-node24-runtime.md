# Iteration 0049：GitHub Actions Node 24 运行时维护

## 1. 范围与成功标准

本轮只处理自动交付底座中 `actions/checkout@v4` 与 `actions/setup-node@v4` 的 Node 20 action runtime 弃用问题，不改变博客应用的 Node.js 22、Vercel Git Integration、内容事实源、workflow 权限/触发器/并发、npm 缓存、质量命令、production smoke 条件或 manual-only rollback。成功标准是：根据 GitHub 官方当前稳定 major 升级三份 workflow；用结构测试锁住上述不变量；push Quality 和 deployment-status smoke 在 GitHub-hosted runner 上真实成功；每周 cron 与手动 rollback 的可执行结构可验证但不制造定时等待或真实回滚副作用；本地完整发布门、稳定生产域名和公开项目状态同步通过。

回滚边界是实现提交 `b581724556851239378f6ee64bfa808b69614d5c`：紧急时可用普通 `git revert` 恢复此前的 checkout/setup-node v4 配置，但这只适合作为短期故障隔离，会重新引入 Node 20 弃用风险。应用代码、内容 schema、Studio/Obsidian、Vercel secrets 和生产数据不在回滚面内。

## 2. 项目结构状态

- `.github/workflows/quality.yml`：checkout/setup-node 从 v4 升为 v6，其余 PR、main push、每周一、手动触发、只读权限、取消策略、Node 22、npm cache 和命令不变；
- `.github/workflows/production-smoke.yml`：同样升级为 v6，`deployment_status`、Production/success 条件、稳定域名优先级、OAuth 冒烟和取消策略不变；
- `.github/workflows/rollback.yml`：同样升级为 v6，仍只有 `workflow_dispatch`，production environment、三个 Vercel secret、显式目标、固定 CLI 和回滚后烟测不变；
- `tests/github-actions-workflows.test.mjs`：新增 YAML 结构契约，覆盖三条 workflow 的 action/runtime、权限、runner、触发器、并发、命令和回滚边界；
- `scripts/check-release-config.mjs`：发布前快速检查三条 workflow 都使用 v6、显式 Node 22 与 npm cache，并拒绝遗留 v1–v5 checkout/setup-node；
- `package.json`：把新增 workflow 契约测试纳入唯一单元测试清单；
- `docs/ARCHITECTURE.md`、`docs/OPERATIONS.md`：记录 action runtime 与应用 runtime 的分层、升级/失败恢复规则；
- `content/projects/myblog.md`：公开项目案例从 Iteration 0028 的旧证据更新到当前自动化、Studio、Obsidian与 148/19/42 门禁状态，并把后续主线改为 Studio 内容维护队列；
- 公开页面结构、设计 token、内容路由、搜索、Feed、Studio 功能、Obsidian 发布事务与 Vercel 配置没有改变。

## 3. 设计内容

本轮是交付系统维护，没有新增读者界面，也没有为了显示 CI 状态制造仪表盘或虚构完成率。公开项目页继续沿用 Commit Trace / Evidence Rail 的工程叙事，只更新真实运行时层次和当前证据。运维文档把环境画成两层明确契约：外层 checkout/setup-node 由 Node 24 执行，内层仓库命令仍在 Node.js 22 执行；“24”不应被误写成博客应用升级。

测试名称和错误信息采用可执行语言：它们分别指出是哪条 workflow 的 runner、permissions、action major、Node/cache、trigger 或 command 漂移，而不是只对整份 YAML 做脆弱字符串快照。这样下一次平台维护能定位到具体不变量，也不会把空格或注释变化冒充语义失败。

## 4. 使用的技术

- GitHub Actions、GitHub-hosted `ubuntu-latest` 与 YAML 1.2；
- `actions/checkout@v6`、`actions/setup-node@v6` 的 Node 24 JavaScript action runtime；
- setup-node 显式 `node-version: 22` 与 `cache: npm`；
- `yaml` 2.9.0 结构化解析、Node.js `node:test` 与 strict assertions；
- Vercel GitHub Integration、`deployment_status`、稳定生产域名 smoke 与 manual workflow dispatch；
- Git tag 远端引用核对、GitHub 未登录 Actions 汇总、真实 GitHub-hosted job 和本地 `release:check`；
- research-iteration-loop 把范围限制为一个可回滚的 CI runtime 维护纵切；browser 工作流尝试读取已连接会话中的动态 job 日志，页面加载超时后没有把未取得的逐行日志写成证据。

## 5. 实现的功能

- 三条工作流不再加载 Node 20 runtime 的 checkout/setup-node v4，而是使用当前官方 v6；
- 应用仍在 Node.js 22 上安装、Lint、测试、构建、审计和运行生产烟测；
- npm 缓存仍由显式 `cache: npm` 控制，不依赖 setup-node v6 的 package-manager 自动探测；
- Quality 继续支持 pull request、main push、每周一 01:00 UTC 和手动运行；
- Production smoke 继续只接受手动目标或成功的 Vercel Production deployment status，并优先使用稳定生产变量；
- Rollback 继续是所有者手动、production environment、显式 deployment URL 和原因，不会因 push 或 schedule 自动回滚；
- 发布前检查会拒绝 checkout/setup-node v1–v5 回归，以及缺失 v6、Node 22 或 npm cache；
- 单元测试按 YAML 语义锁住所有关键边界，不受普通缩进与注释调整影响；
- 公开 MyBlog 项目案例同步当前 Studio/Obsidian 与 CI 证据，不再向读者展示已经完成的旧“下一步”。

## 6. 实现方法

先查阅 GitHub 官方 Node 20 runner 弃用公告及两个官方 action 仓库。2026-08-05 观察到 `actions/checkout` README 的当前示例为 v6，v6 提供 Node 24 runtime 与凭据移出 `.git/config`；`actions/setup-node` 当前示例和最新 release 为 v6，v6 的缓存探测与 `always-auth` 有 breaking change。本仓库没有 `always-auth`，三份 workflow 都显式设置 `cache: npm`，且不从 Docker container 内执行认证 Git 命令，因此这些变化不需要额外迁移配置。GitHub-hosted `ubuntu-latest` 由平台维护，满足 v6 runner 要求。

远端 tag 核对时，checkout `refs/tags/v6` 指向 `d23441a48e516b6c34aea4fa41551a30e30af803`，`v6.0.2` 指向 `de0fac2e4500dabe0009e67214ff5f5447ce83dd`；setup-node `refs/tags/v6` 指向 `249970729cb0ef3589644e2896645e5dc5ba9c38`，`v6.4.0` 指向 `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e`。workflow 保留官方移动 major tag 以延续原 v4 更新策略，观察到的提交只作为本轮供应链证据，不被误写成永久固定值。

实现先增加失败测试：新 runtime 测试在 v4 配置上精确失败，并显示实际/期望 action 数组。随后只替换六个 `uses` 值，测试转绿。结构测试通过 `YAML.parse` 获取真实 `on`、permissions、jobs、steps、with、env 和 concurrency，而 `check-release-config` 保留适合发布前快速失败的最小文本门。schedule 不等待一周才验收，rollback 也不为了测试制造真实生产状态变化：两者由解析后的触发器、环境、secret 引用和命令契约证明；push 与 deployment_status 则由真实远端运行证明。

## 7. 验证证据

- 官方依据：[GitHub Node 20 runner 弃用公告](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)、[actions/checkout](https://github.com/actions/checkout) 与 [actions/setup-node](https://github.com/actions/setup-node)；公告要求 action 用户升级到运行 Node 24 的最新版本；
- 失败优先：`tests/github-actions-workflows.test.mjs` 在三份 v4 workflow 上按预期失败，显示 `checkout@v4/setup-node@v4` 与期望 v6 的差异；替换后定向测试 6/6、release 配置检查与 `git diff --check` 通过；
- 最终 `npm run release:check` 在公开项目内容同步后再次通过：Current 1/Historical 3/未公开 0、inbox 0、根暂存 0、外链 2 URL/3 occurrences/0 issue、ESLint 0 warning、148/148 单元、TypeScript、42 条构建页面、19/19 生产应用测试、production audit 0；
- 公开静态产物仍为 1,817,681 B：JavaScript 609,752 B、CSS 88,204 B、字体 562,908 B、最大 JS 228,844 B；workflow 维护没有进入读者客户端；
- 实现提交 `b581724556851239378f6ee64bfa808b69614d5c` 已推送 `main`；Quality Gate `30978159621`（#81）completed/success，证明 checkout/setup-node v6 能在真实 GitHub-hosted runner 上安装 Node 22、恢复 npm cache 并完成全部命令；
- Vercel Production 验证 `30978189378`（#74）completed/success，证明 deployment-status 路径的新 v6 action 能安装依赖并完成生产烟测；
- 本地对稳定域名再次运行 `npm run production:smoke -- https://blog-iota-five-59.vercel.app --expect-oauth`，通过 24 条 Sitemap 路由与 OAuth 302；
- 新 Quality job 的未登录汇总/详情 HTML 为 completed/success，未出现 Node 20、Node20、warning 或 annotation 文本。已连接浏览器能打开正确 job 标题，但 GitHub 动态日志 DOM 两次加载超时，未形成逐行日志证据，因此本轮不声称取得了日志截图；官方 v6 runtime 声明、结构测试和真实成功 job 是主要证据；
- weekly cron 未人为等待，manual rollback 未触发真实外部回滚；YAML 结构测试分别锁定 `0 1 * * 1` 和 rollback 的唯一 `workflow_dispatch`、production environment、required inputs、secrets、固定 Vercel CLI 与回滚后 smoke，符合“不为测试制造生产副作用”的边界。

## 8. 经验与教训

- JavaScript action runtime 与项目 Node runtime 是不同层。把 checkout v6 的 Node 24误读成应用必须升级 Node 24，会扩大变更面并破坏当前受测 Node 22 契约；
- major 升级不能只做字符串替换。setup-node v6 的缓存探测和 checkout v6 的凭据存储都有行为变化，应逐项对照本仓库是否触发，再决定是否需要配置；
- 显式 `cache: npm` 既保留性能，也隔离了 setup-node 的自动探测变化。依赖关键默认值时，应把默认变成仓库自己的可测试声明；
- workflow 也是生产代码。只 grep `@v6` 无法证明权限、触发器或命令没被改，YAML 结构测试更适合锁语义；
- cron 与 rollback 的验证范围要匹配副作用：静态契约可证明“何时允许运行、会使用什么权限与命令”，真实 push/deployment job 可证明 action 可解析执行；不能为了绿灯无理由回滚生产；
- GitHub 未登录汇总适合证明 run conclusion，不等价于完整日志。动态日志无法取得时应保留证据边界，不把“页面没显示 warning”夸大为逐行审计；
- 公共项目案例里的旧数字和已完成“下一步”也是内容债务。CI 维护轮顺手只更新与本轮事实直接相关的证据，能让公开叙事和 Obsidian 状态保持一致，而不扩大到产品重写；
- 官方 major tag 会移动；本轮记录 tag 指针能复盘实际观察版本，但不等价于 immutable SHA pin。若以后提升供应链强度，应单独评估固定 SHA 与自动更新策略。

## 9. 全局状态、风险与未解决问题

博客现在拥有 Git-first 内容、Studio/Obsidian 双入口、内容/媒体/关系/外链/新鲜度门、搜索/Feed/知识地图、Vercel 自动交付与恢复、代码复制、永久链接、脚注、数学公式、打印、Studio 公式/字段 Author Proof，以及不依赖 Node 20 action runtime 的 Quality/production smoke/rollback。公开功能没有因本轮 CI 维护增加客户端字节，Cloudflare 仍不在当前链路中。

本轮消除了已观察到的 checkout/setup-node v4 runtime 风险，但 major tag 可移动、GitHub-hosted runner 与 Vercel 仍是外部平台依赖。Rollback 的实际 secret/environment 权限曾在既有迭代中真实演练，本轮没有再次改变生产状态；以后若 workflow 的 secrets、environment 或 CLI 发生变化，必须单独重演。固定 Decap 3.14.1 开发依赖审计、OAuth scope、Studio CSP 例外、Hobby 回滚范围、网络假阴性、知识图扩容、附件 Git 历史和所有者尚未选择的域名/统计/评论仍是已知边界。

作者体验下一处高价值空白是“全库维护队列”：Current 的 60/30/0 天证据已有 CLI 和 Actions 摘要，但网页 Studio 只能检查正在编辑的一条记录，作者无法在后台直接看到哪些公开内容即将复核。该能力可以完全复用现有确定性报告，不需要数据库、真实 API、外部通知或手工云配置。

## 10. 下一轮唯一主任务

实现 Studio 全库只读内容维护队列：复用 `lib/content/maintenance.ts` 与公开内容索引，向已进入 Studio 的作者集中展示 healthy、review-soon、due-soon、overdue、review-by、剩余天数和稳定条目入口；保持 public-only、同源、`no-store`/`noindex`、不自动修改 `reviewedAt`、不发送外部通知、不改变 180 天构建门。验证空队列/各层级、固定日期边界、文章与项目入口、网络失败、320px/深色/键盘路径和真实生产 smoke。
