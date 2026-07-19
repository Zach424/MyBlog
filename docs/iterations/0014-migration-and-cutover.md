# Iteration 0014：迁移、生产冒烟与回滚闭环

## 1. 范围与成功标准

本轮目标是把所有者迁移所需的工程能力补齐：部署后自动验收、手动回滚后自动验收、迁移前置检查、Cloudflare 静态资源真实路由验证，以及完整的账号配置/切换清单。成功标准是本地 Wrangler 环境逐路由通过，工作流无需在日志或命令中插入凭证，旧 Sites 可以在新 origin 验收前继续保底。

## 2. 项目结构状态

新增 `.github/workflows/rollback.yml`、`scripts/smoke-production.mjs`、`scripts/check-migration-status.mjs`、`tests/deployment-tools.test.mjs` 与 `docs/MIGRATION.md`。部署工作流接入发布 URL 冒烟；Vite Cloudflare 配置增加 Studio/授权端点的 Worker-first 路由；Worker 增加 Studio 子资源安全响应；Obsidian 插件与 CLI 补强 Windows 命令启动和精确 inbox 路径限制。

## 3. 设计内容

迁移采用双轨切换：旧 Sites 是已验证保底，新 Cloudflare origin 必须先通过自动冒烟和两种作者入口联调，之后才改变公开入口。部署与回滚共用同一个稳定生产验收器，使“发布成功”不只代表平台接受了上传包，而是公开页面、发现端点、后台安全边界和错误页都符合契约。

## 4. 使用的技术

- GitHub Actions Environment、repository variables 与 Wrangler Action；
- Cloudflare Worker Versions/Rollback、静态资源绑定与 `run_worker_first` 路由；
- Node.js 原生 Fetch、AbortSignal 和 XML 路由提取；
- Wrangler 本地 Cloudflare 运行时；
- PowerShell/Windows 下通过固定 `cmd.exe` 包装启动 npm；
- Node test 静态验证交付、回滚、Studio 路由和凭证边界。

## 5. 实现的功能

1. 部署工作流读取 Wrangler 的 deployment URL，并在 OAuth secrets 已注入的线上版本运行生产冒烟；
2. 手动回滚支持可选 version ID 和必填原因，使用 `--yes` 无人值守执行并复核稳定生产地址；
3. 生产冒烟覆盖首页、文章/项目集合与详情、搜索、Studio、OAuth、RSS、robots、Sitemap 全路由和随机 404；
4. `migration:status` 检查 main、干净工作树、origin/main 精确同步和本地 Cloudflare 身份；
5. `/studio`、其静态子资源和 `/api/cms/*` 强制 Worker-first，防止静态资源层绕过 CSP、COOP 与 `no-store`；
6. Obsidian 插件只接受 `content/inbox/<ascii-slug>.md`，Windows npm 调用不解释用户文件名；
7. 一次性账号配置、双入口验收、切换和回滚条件写入稳定迁移清单。

## 6. 实现方法

生产冒烟从目标 origin 读取 Sitemap，并并行访问其中每个 URL；同时对代表性页面内容、绝对 Open Graph 主机、HTTP 状态、安全响应头、OAuth 跳转和 404 缓存做断言。部署使用本次动作返回的 URL，回滚使用仓库保存的稳定生产 URL，避免把临时地址硬编码进源码。

真实 Wrangler 验收发现 Cloudflare 资产层默认先于 Worker 服务 `/studio`，导致安全头被绕过。Vite binding 配置只对 `/studio`、`/studio/*` 与 `/api/cms/*` 设置 `run_worker_first`，不增加全部静态资源的 Worker 请求成本。Worker 读取 `/studio/` 目录入口而不是 `/studio/index.html`，避免 Cloudflare 对 index 文件规范化时产生重定向环。

回滚参数使用 Bash 数组传递可选 version ID 和原因，避免字符串拼接；`--yes` 保证 GitHub runner 不等待交互确认。迁移检查直接调用已安装 Wrangler 的 Node 入口，保持 Windows 与 CI 行为一致。

## 7. 验证证据

- ESLint、TypeScript 与 28/28 单元测试通过；新增测试覆盖 Sitemap 提取、部署/回滚/冒烟连线、无人值守回滚、Worker-first 配置和 Studio 子资源路由；
- 8/8 Worker 集成测试与 6/6 发布质量审计通过；
- 生产依赖审计为 0 个已知漏洞；Wrangler 干跑读取 32 个静态文件，总上传 `2633.65 KiB`、gzip `627.21 KiB`；
- 生成的 `dist/server/wrangler.json` 确认保留 `ASSETS` binding、三个 `run_worker_first` 路由和 `../client` 目录；
- Wrangler 本地 Cloudflare 环境的生产冒烟通过：23/23 Sitemap 路由为 200，Studio 为 200 且 `no-store`/OAuth popup 策略正确，未配置 secrets 时 OAuth 安全返回 503，随机未知路由为 404/no-store；
- 第一次真实运行时测试先发现 Studio 安全头绕过；修复后又发现 index 规范化重定向环，二者都在最终通过前保留为回归测试和配置约束；
- `migration:status` 正确报告当前工作树未提交和 Cloudflare 尚未授权；Wrangler OAuth 授权流程已启动，最终账号部署仍需作者在官方页面完成授权及 GitHub secrets 设置。

## 8. 经验与教训

普通 Worker 单元测试无法证明静态资源实际会先经过 Worker。Cloudflare 资产路由顺序属于部署契约，必须检查生成配置并在 Wrangler 真实运行时发请求。

对 `index.html` 的直接资产请求看似精确，但平台会把它规范化为目录 URL；当目录 URL又被 Worker改写回 index 时就形成循环。生产冒烟必须允许跟随正常跳转，也必须让超限跳转明确失败。

回滚脚本如果缺少非交互确认，在本地帮助输出正确也可能永远卡在 CI。自动化命令既要验证参数含义，也要验证它能在无人值守 runner 上结束。

## 9. 全局状态、风险与未解决问题

工程迁移底座已完成并通过本地 Cloudflare 运行时验收。当前公开 Sites 继续稳定运行；作者 Cloudflare 账号登录、首次 origin、四个 GitHub Environment secrets、两个仓库变量、真实 Studio OAuth、Obsidian 桌面发布和公开入口切换仍属于外部账号联调，未完成前路线图阶段 8、9 保持 `partial`。

## 10. 下一轮唯一主任务

由作者完成 Cloudflare OAuth 与 GitHub 仓库设置，执行首次自动部署，并用 Studio 与 Obsidian 各发布一条真实内容后切换公开入口和演练回滚。
