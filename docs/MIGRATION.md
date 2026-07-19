# Vercel 迁移与上线清单

生产站现已运行在 `https://blog-iota-five-59.vercel.app`。旧站在 Git 自动部署和两条真实发布链路全部验收前继续作为回退。

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

## 2. 导入 Vercel（生产已完成，Git 登录连接待确认）

当前项目为 `czq1/blog`，Framework Preset 为 Next.js，稳定生产域名为 `https://blog-iota-five-59.vercel.app`。Vercel GitHub App 已安装且只授权 `Zach424/MyBlog`。

剩余一次性账户操作：在 Vercel [Account Settings > Authentication](https://vercel.com/account/settings/authentication) 中给当前账户添加 GitHub 登录连接。完成后在仓库运行：

```bash
npx --yes vercel@56.3.2 git connect https://github.com/Zach424/MyBlog.git
```

CLI 返回 `Connected GitHub repository` 后，确认 Production Branch 为 `main`：普通分支 push 生成 Preview，`main` push 生成 Production。当前内嵌浏览器的 GitHub “Authorize Vercel” 按钮被禁用，因此此账户授权必须由所有者在普通浏览器完成，不能通过代码或 Token 绕过。

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

## 4. 配置 GitHub 在线验收与回滚

在 GitHub Actions variable 添加：

- `VERCEL_PRODUCTION_URL=<稳定 HTTPS origin>`

若希望从 GitHub Actions 执行回滚，再添加 repository/environment secrets：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Vercel GitHub Integration 默认发送 production deployment status；成功后 `Verify Vercel production` 会对部署 URL 自动运行带 OAuth 的完整冒烟。

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

网页后台：OAuth 授权、Token 交换、`Zach424` 身份与 `content/posts` 仓库读取已验收；验收 Token 随后撤销。仍需所有者在普通浏览器登录 `/studio`，创建一篇 `draft: true` 草稿，保存后确认 GitHub 出现 editorial workflow 分支/PR；发布后确认进入 `main`、Vercel 自动部署且文章可见。

Obsidian：临时文章已通过 `--check-only`，正确解析到 `content/posts/vercel-publishing-validation.md` 后删除，没有留下测试内容。Git 登录连接完成后，再从模板新建真实草稿，运行“发布当前草稿并同步 GitHub”，确认质量门、提交、push 和部署链路运行，不经过 Codex。

## 7. 切换与回滚

新 origin 的自动部署、Studio 和 Obsidian 各至少成功一次后，更新 README/demo/书签或绑定自定义域名。旧回退站保留至少一个稳定发布周期。

P1/P2 故障使用 Vercel Instant Rollback 或 `Roll back Vercel production`，随后对 Git 仓库做 revert/修复提交。Hobby 套餐留空 deployment URL 回到上一生产版本；不要依赖删除部署或重写历史。

## 完成定义

- [x] `origin/main` 包含 Vercel 原生迁移提交；
- [ ] Vercel 项目与 GitHub `main` 自动部署已连接；
- [x] OAuth secrets 已配置，授权回调和仓库读取已真实验收；
- [x] 全生产冒烟与桌面未登录浏览器主路径验收通过；
- [ ] 网页后台成功发布一篇测试草稿/文章；
- [x] Obsidian 草稿通过真实发布器预检；
- [ ] Obsidian 成功提交并推送一篇真实草稿/文章；
- [ ] 回滚路径已演练或至少由所有者确认可用；
- [x] 新生产入口已记录，旧站仍可回退。
