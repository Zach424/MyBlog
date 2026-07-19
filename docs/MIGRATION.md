# 所有者 Cloudflare 迁移清单

本清单用于把当前公开 Sites 版本迁移到作者自己的 Cloudflare Worker，并启用 `/studio`、main 自动部署、生产冒烟和一键回滚。迁移期间旧 Sites 地址保持在线；只有新 origin 全部验收通过后才切换公开入口。

## 1. 本地前置检查

使用 Node.js 22，在 `main` 分支和干净工作区执行：

```bash
npm ci
npm run release:check
npm run migration:status
```

`migration:status` 要求本地与 `origin/main` 精确同步并且 Wrangler 已登录。首次使用运行 `npx wrangler login`，只在 Cloudflare 官方 OAuth 页面完成授权；不要把 Token 发到聊天、文档或提交中。

## 2. 获得稳定 Worker 地址

首次部署用于创建名为 `zach424-myblog` 的 Worker，并获得稳定的 `workers.dev` origin：

```bash
npx wrangler deploy --config dist/server/wrangler.json --name zach424-myblog
```

记录命令返回的 HTTPS 地址。此时没有 OAuth secrets 时 `/api/cms/auth` 返回 503 是预期的安全关闭状态；公开阅读、RSS、Sitemap 和搜索仍可验收。

## 3. 配置 GitHub OAuth App

在 GitHub `Settings → Developer settings → OAuth Apps` 新建应用：

- Homepage URL：上一步得到的完整 Cloudflare origin；
- Authorization callback URL：`<origin>/api/cms/callback?provider=github`。

保存 Client ID，生成 Client Secret。不要把两个值写进本地 `.env` 或仓库文件。

## 4. 配置 GitHub 仓库

在 `Zach424/MyBlog` 创建 `production` Environment，并添加四个 Environment secrets：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `GITHUB_OAUTH_ID`
- `GITHUB_OAUTH_SECRET`

Cloudflare API Token 只授予目标账号 Worker 所需编辑权限。在仓库 Actions variables 添加：

- `CLOUDFLARE_PRODUCTION_URL=<稳定 HTTPS origin>`
- `CLOUDFLARE_DEPLOY_ENABLED=true`

建议给 `production` Environment 配置只允许 `main` 部署；是否增加人工审批由作者按个人发布频率决定。

## 5. 首次自动部署与验收

手动运行 GitHub Actions 的 `Deploy to Cloudflare`。工作流会安装锁定依赖、执行完整质量门、部署精确提交并对本次 deployment URL 自动运行：

```bash
npm run production:smoke -- <origin> --expect-oauth
```

成功条件：23 个 Sitemap 路由全部返回 200；首页、文章、项目、搜索、RSS、robots、404 和安全头正确；`/studio` 为 `no-store`；OAuth 跳转 GitHub 且包含签名 state。

## 6. 自助发布端到端验收

### Studio

1. 打开 `<origin>/studio`，用对 `Zach424/MyBlog` 有写权限的 GitHub 账号登录；
2. 创建一篇保持 `draft: true` 的测试文章，确认 GitHub 出现 editorial workflow 分支/PR；
3. 预览正文和图片，关闭草稿并发布/合并；
4. 等待自动部署，通过新文章 URL、搜索、RSS 和 Sitemap 复核结果；
5. 删除测试内容时使用正常提交或 revert，不改写历史。

### Obsidian

1. 桌面 Obsidian 打开仓库根目录，启用 Templates 和 MyBlog Publisher；
2. 在 `content/inbox/<ascii-slug>.md` 创建测试草稿；
3. 先运行“检查当前草稿”，再运行“发布当前草稿并同步 GitHub”；
4. 确认只提交该文章及实际引用附件，并由同一 GitHub 工作流发布；
5. 线上复核完成后再把该内容视为正式发布。

## 7. 切换与回滚

新 origin 的自动部署、Studio 和 Obsidian 各至少成功一次后，才能把书签、README 或自定义域名切到新地址。旧 Sites 地址保留至少一个稳定发布周期，不在切换当日删除。

出现 P1/P2 故障时，在 GitHub Actions 手动运行 `Roll back Cloudflare production`：可留空版本 ID 回滚到上一版本，也可指定已验证的 Cloudflare version ID；必须填写原因。工作流使用 `--yes` 无人值守回滚，并对 `CLOUDFLARE_PRODUCTION_URL` 自动重跑生产冒烟。Git 仓库随后用显式 revert 或修复提交恢复一致性，禁止 `reset --hard` 或强制推送。

## 8. 迁移完成定义

以下条件同时满足才可把路线图阶段 8、9 标为 `done`：

- GitHub `main` 提交能自动部署到作者 Cloudflare 账号；
- `/studio` 完成真实 OAuth、草稿 PR、图片和发布；
- Obsidian 完成真实草稿检查、提交、推送和线上可见；
- 自动生产冒烟通过，回滚工作流至少完成一次可控演练；
- 公开入口已经切换，新旧地址与恢复窗口有记录；
- 全过程没有把 secret、Token 或 OAuth code 写入 Git 历史和文档。
