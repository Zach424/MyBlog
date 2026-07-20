# Vercel 迁移与上线清单

生产站现已运行在 `https://blog-iota-five-59.vercel.app`，Git 自动部署和两条作者发布链路均已验收。旧站暂时保留为迁移期回退入口。

## 0. 仓库迁移（代码已完成）

- [x] 使用原生 `next dev/build/start`；
- [x] 删除 Vinext、Vite、Cloudflare Worker、Wrangler 与 Sites 托管标记；
- [x] Markdown 改为 Next.js 服务端/构建期文件读取，并显式 output tracing；
- [x] Studio 静态入口改为 App Router Route Handlers；
- [x] OAuth 改为 Next.js Node Route Handlers；
- [x] 安全头与缓存改为 Next.js headers；
- [x] GitHub Actions 改为 Vercel 生产冒烟和回滚；
- [x] 本地完整质量门通过。

## 1. 同步 GitHub（已完成）

```bash
git status --short --branch
git push origin main
```

要求本地与 `origin/main` 精确同步且工作区干净。GitHub 登录只能在官方页面完成，不把验证码、Token 或密码发送到聊天。

## 2. 导入 Vercel（已完成）

当前项目为 `czq1/blog`，Framework Preset 为 Next.js，稳定生产域名为 `https://blog-iota-five-59.vercel.app`。Vercel GitHub App 已安装且只授权 `Zach424/MyBlog`。

Vercel 账户已添加 GitHub Login Connection，并在仓库运行：

```bash
npx --yes vercel@56.3.2 git connect https://github.com/Zach424/MyBlog.git
```

CLI 已返回 `Connected`。Vercel API 确认 Git 仓库为 `Zach424/MyBlog`、Production Branch 为 `main`；提交 `6644824` 与 `a8a72a4` 均由 `source=git` 的 Production deployment 自动构建为 `READY`。

本地关联可运行：

```bash
npx --yes vercel@56.3.2 link
npm run migration:status
```

`.vercel` 只保存本地关联信息并已忽略，不提交仓库。

## 3. 配置网页后台 OAuth（已完成）

在 GitHub Developer Settings 创建 OAuth App：

- Application name：`Zach424 Engineering Notes Studio`；
- Homepage URL：稳定 Vercel 生产 origin；
- Authorization callback URL：`<origin>/api/cms/callback?provider=github`。

在 Vercel Project Settings > Environment Variables 添加，仅勾选 Production：

- `GITHUB_OAUTH_ID`
- `GITHUB_OAUTH_SECRET`

两个值已仅写入 Vercel Production 并重新部署；未写入本地文档、聊天或 Git。Preview 不配置这些值时 OAuth 返回 503 是预期的安全关闭行为。

## 4. 配置 GitHub 在线验收与回滚（已完成）

GitHub Actions variable 已添加：

- `VERCEL_PRODUCTION_URL=<稳定 HTTPS origin>`

GitHub repository secrets 已添加：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Vercel GitHub Integration 发送 production deployment status；`Verify Vercel production` 使用稳定生产域名运行带 OAuth 的完整冒烟。不可变 deployment URL 可能受 Vercel 保护，因此只用于核对 deployment ID/SHA，不作为公开冒烟入口。

## 5. 生产验收

```bash
npm run production:smoke -- <origin> --expect-oauth
```

必须证明：

- 首页、集合、详情、专题、标签、搜索和关于页返回 200；
- RSS 至少 4 条、Sitemap 至少 23 个 URL 且逐项返回 200；
- `/studio`、`config.mjs`、`preview.css` 与同源固定版本 `editor-runtime-3.14.1.js` 可用；
- OAuth 返回 302 到 GitHub，包含签名 state；
- 未知 Studio 子资源和随机页面返回 404/no-store；
- CSP、COOP、HSTS、`nosniff` 与来源策略存在；
- canonical、Open Graph、RSS 和 Sitemap 使用新 origin。

再用未登录浏览器检查首页、文章、搜索、Studio 登录弹窗、320px、深色和键盘焦点。

## 6. 两条真实发布链路

网页后台：生产 OAuth 完成授权、Token 交换、`Zach424` 身份和仓库读写；按 Decap editorial workflow 创建分支、内容提交和 PR #1，核对 `main` 目标与新增文件后关闭 PR 并删除测试分支，没有污染生产内容。

Obsidian：未来日期的验收内容通过真实 `--push` 运行 29 个单元测试、类型检查、Next.js 构建和 15 个生产 HTTP/质量测试，创建提交 `a8a72a4` 并推送 `main`；Vercel 自动部署同一 SHA。线上确认该计划内容详情为 404，且未进入文章列表、RSS 或 Sitemap；最终清理提交删除测试内容。发布器同时修复了“未跟踪 inbox 文件移动后仍被传给 `git add`”的问题。

## 7. 切换与回滚

新 origin 的自动部署、Studio 和 Obsidian 各至少成功一次后，更新 README/demo/书签或绑定自定义域名。旧回退站保留至少一个稳定发布周期。

P1/P2 故障使用 Vercel Instant Rollback 或 `Roll back Vercel production`，输入上一条健康 deployment URL，随后对 Git 仓库做 revert/修复提交。工作流已成功切回 `6644824` 对应部署并冒烟，再把 `a8a72a4` 对应部署恢复为生产；不要依赖删除部署或重写历史。

## 完成定义

- [x] `origin/main` 包含 Vercel 原生迁移提交；
- [x] Vercel 项目与 GitHub `main` 自动部署已连接；
- [x] OAuth secrets 已配置，授权回调和仓库读取已真实验收；
- [x] 全生产冒烟与桌面未登录浏览器主路径验收通过；
- [x] 网页后台成功创建并核验一篇 editorial workflow 测试草稿/PR；
- [x] Obsidian 草稿通过真实发布器预检；
- [x] Obsidian 成功提交并推送一篇计划内容，且已验证自动部署与公开隐藏；
- [x] 回滚路径已演练并恢复当前生产部署；
- [x] 新生产入口已记录，旧站仍可回退。
