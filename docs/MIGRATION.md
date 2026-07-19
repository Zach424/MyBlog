# Vercel 迁移与上线清单

目标是把当前公开回退站迁移到作者自己的 Vercel 项目，并证明网页后台和 Obsidian 都能独立发布。旧站在新生产环境全部验收前保持在线。

## 0. 仓库迁移（代码已完成）

- [x] 使用原生 `next dev/build/start`；
- [x] 删除 Vinext、Vite、Cloudflare Worker、Wrangler 与 Sites 托管标记；
- [x] Markdown 改为 Next.js 服务端/构建期文件读取，并显式 output tracing；
- [x] Studio 静态入口改为 App Router Route Handlers；
- [x] OAuth 改为 Next.js Node Route Handlers；
- [x] 安全头与缓存改为 Next.js headers；
- [x] GitHub Actions 改为 Vercel 生产冒烟和回滚；
- [x] 本地完整质量门通过。

## 1. 同步 GitHub

```bash
git status --short --branch
git push origin main
```

要求本地与 `origin/main` 精确同步且工作区干净。GitHub 登录只能在官方页面完成，不把验证码、Token 或密码发送到聊天。

## 2. 导入 Vercel

1. 打开 Vercel，选择 **Continue with GitHub**；
2. 授权 `Zach424/MyBlog`，点击 Import；
3. Framework Preset：Next.js；Production Branch：`main`；Root Directory：仓库根目录；
4. Build Command、Install Command 和 Output Directory 使用自动检测；
5. 首次 Deploy，记录稳定项目域名，例如 `https://myblog-xxx.vercel.app`；
6. 确认 Vercel Project Settings > Git 保持自动部署：分支 push 生成 Preview，`main` 生成 Production。

本地关联可运行：

```bash
npx --yes vercel@56.3.2 link
npm run migration:status
```

`.vercel` 只保存本地关联信息并已忽略，不提交仓库。

## 3. 配置网页后台 OAuth

在 GitHub Developer Settings 创建 OAuth App：

- Application name：`Zach424 Blog Studio`；
- Homepage URL：稳定 Vercel 生产 origin；
- Authorization callback URL：`<origin>/api/cms/callback?provider=github`。

在 Vercel Project Settings > Environment Variables 添加，仅勾选 Production：

- `GITHUB_OAUTH_ID`
- `GITHUB_OAUTH_SECRET`

重新部署 Production。不要把值写入本地文档或提交；Preview 不配置这些值时 OAuth 返回 503 是预期的安全关闭行为。

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
- `/studio`、`config.mjs`、`preview.css` 可用并且 `no-store`；
- OAuth 返回 302 到 GitHub，包含签名 state；
- 未知 Studio 子资源和随机页面返回 404/no-store；
- CSP、COOP、HSTS、`nosniff` 与来源策略存在；
- canonical、Open Graph、RSS 和 Sitemap 使用新 origin。

再用未登录浏览器检查首页、文章、搜索、Studio 登录弹窗、320px、深色和键盘焦点。

## 6. 两条真实发布链路

网页后台：登录 `/studio`，创建一篇 `draft: true` 草稿，保存后确认 GitHub 出现 editorial workflow 分支/PR；发布后确认进入 `main`、Vercel 自动部署且文章可见。

Obsidian：从模板新建笔记，运行 `Publish current note to blog`，检查附件路径和 frontmatter，提交并推送；确认相同质量门和部署链路运行，不经过 Codex。

## 7. 切换与回滚

新 origin 的自动部署、Studio 和 Obsidian 各至少成功一次后，更新 README/demo/书签或绑定自定义域名。旧回退站保留至少一个稳定发布周期。

P1/P2 故障使用 Vercel Instant Rollback 或 `Roll back Vercel production`，随后对 Git 仓库做 revert/修复提交。Hobby 套餐留空 deployment URL 回到上一生产版本；不要依赖删除部署或重写历史。

## 完成定义

- [ ] `origin/main` 包含本轮迁移提交；
- [ ] Vercel 项目与 GitHub `main` 自动部署已连接；
- [ ] OAuth secrets 已配置且 `/studio` 能真实登录；
- [ ] 全生产冒烟与未登录浏览器验收通过；
- [ ] 网页后台成功发布一篇测试草稿/文章；
- [ ] Obsidian 成功发布一篇测试草稿/文章；
- [ ] 回滚路径已演练或至少由所有者确认可用；
- [ ] 新生产入口已切换，旧站仍可回退。
