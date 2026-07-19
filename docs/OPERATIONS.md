# 上线、维护与回滚手册

## 1. 当前生产状态

- 托管：Sites / Cloudflare Worker-compatible application；
- 生产地址：`https://zach424-engineering-notes.zhiqingchen792.chatgpt.site`；
- 访问范围：公开，任何获得生产地址的访客均可访问；
- 数据能力：D1 与 R2 均未启用，内容和历史以 Git 仓库为准；
- 发布模型：构建期读取 Markdown；当前 Sites 生产地址继续运行，所有者 Cloudflare 自动部署底座已进入迁移阶段。

站点已在 2026-07-19 经用户明确批准后切换为公开。后续缩小或扩大共享范围仍属于外部可见性变更，必须先确认；短期源码凭证、旁路验收 Token 和其他密钥不得写入仓库、命令记录或本文档。

## 2. 自助发布链路

仓库包含两个互相独立的工作流：`Quality Gate` 在 pull request 与 main 上执行完整检查；`Deploy to Cloudflare` 在所有者完成一次性配置后，对 main 的每个精确提交重新检查并部署。

一次性迁移的逐项操作、验收与切换条件见 [MIGRATION.md](./MIGRATION.md)。

首次启用由仓库所有者完成：

1. 在自己的 Cloudflare 账号创建一个仅允许编辑 Workers 的 API Token；
2. 在 GitHub 仓库创建 `production` Environment；
3. 把账号 ID 保存为 `CLOUDFLARE_ACCOUNT_ID` secret，把 Token 保存为 `CLOUDFLARE_API_TOKEN` secret；
4. 为该 origin 创建 GitHub OAuth App，把 client ID/secret 保存为 `GITHUB_OAUTH_ID` 与 `GITHUB_OAUTH_SECRET`；callback 固定为 `<origin>/api/cms/callback?provider=github`；
5. 在仓库 Actions variables 中设置 `CLOUDFLARE_DEPLOY_ENABLED=true`；
6. 手动运行一次 `Deploy to Cloudflare`，获得所有者账号下的 `workers.dev` 地址并完成在线验收；
7. 打开 `/studio` 完成 GitHub 登录、草稿保存和发布验证；验收通过后再配置正式域名或切换公开入口。Sites 地址在切换前保持在线。

Secret 只保存在 GitHub Environment；禁止写入 `.env`、Actions 日志、文档或 Git 历史。关闭自动部署只需把开关改为 `false`，不会删除线上 Worker。

网页后台 OAuth 使用公开仓库所需的 `public_repo,user` scope；只有本来就拥有仓库写权限的 GitHub 用户可以编辑。OAuth state 有签名和十分钟有效期，回调只向同源 Studio 发送结果。更换正式域名时必须同步更新 GitHub OAuth App 的 Homepage/callback，再重新部署和验收登录。

Obsidian 发布命令直接复用本仓库内容 schema 和 `npm run check`。`--push` 前要求 Git 暂存区为空，只暂存本次 inbox → 正式目录移动及正文引用附件；全量检查失败会恢复原始草稿。推送失败不会删除已经通过检查的本地内容或提交，作者修复 Git 连接后可以正常重试 push。

## 3. 日常内容发布

1. 使用 `/studio`、Obsidian `content/inbox` 或直接在 `content/posts`/`content/projects` 新增 Markdown；文件名即稳定 slug。
2. 按 [CONTENT_MODEL.md](./CONTENT_MODEL.md) 填写 frontmatter。未来日期和 `draft: true` 不会进入公开索引。
3. 本地运行 `npm run dev`，检查正文、目录、代码块、内链和窄屏折行。
4. 本地可选运行完整发布门槛：

   ```bash
   npm run release:check
   ```

5. 更新稳定文档和当前迭代归档，创建独立 Git 提交并推送 GitHub。
6. 推送或合并到 main。启用 Cloudflare 开关后，工作流会自动检查并部署精确提交；迁移完成前仍按 Sites 手册发布同一提交。
7. 完成下节在线冒烟验收后，才能把轮次状态标记为 `done`。

发布日期按构建时的 `Asia/Shanghai` 日期冻结。预定未来发布的文章到期后仍需要重新构建和部署；平台冷启动不会自动改变同一版本的公开内容集合。

## 4. 每次部署后的在线验收

最小检查顺序：

1. `/`、`/posts`、`/projects` 和一条最新详情返回 200，正文不是空集合；
2. `/sitemap.xml` 的 URL 数量符合当前内容模型，并逐一返回 200；
3. `/search?q=<新内容关键词>` 能找到新内容；
4. `/rss.xml` 条目数、标题、链接和生产主机正确；
5. `/robots.txt` 指向生产 Sitemap，`/icon.png` 返回 `image/png`；
6. 文章含 `BlogPosting`，项目含 `SoftwareSourceCode` JSON-LD；
7. 成功 HTML 使用浏览器不缓存、边缘缓存一小时的策略，并包含 CSP、HSTS、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff` 与 Referrer Policy；
8. 随机不存在路径返回 404 且 `Cache-Control: no-store`。

所有者 Cloudflare 部署会自动执行等价检查；也可手动运行 `npm run production:smoke -- <origin> --expect-oauth`。自动结果不替代首次迁移时的未登录浏览器和真实编辑发布验收。

公开站点默认使用无凭证 HTTP 和全新未登录浏览器会话验收，避免登录状态掩盖访问门禁。若未来临时改回私有，旁路凭证只能放在进程内存中；在线验收只归档状态、数量和响应头，不归档 Token。

## 5. 监控与故障分级

当前没有数据库或写接口，主要风险集中在可用性、内容索引、缓存和平台构建。

| 等级 | 现象 | 立即动作 |
| --- | --- | --- |
| P1 | 首页不可访问、全部 5xx、错误版本覆盖生产 | 检查 Sites 部署状态和 Worker 错误日志，必要时立即回滚 |
| P2 | 详情 404、Sitemap 数量异常、RSS/搜索缺内容 | 比较构建日期、公开内容索引和最近提交，暂停继续发布 |
| P3 | 样式、元数据、单个链接或内容错误 | 建立修复轮次，走完整检查后正常发布 |

每次发布后查看部署结果；出现异常时读取最近 Worker 错误日志，但不得把请求身份、访问 Token 或其他敏感字段复制到公开归档。没有定时监控服务时，至少在每次内容发布后执行完整冒烟验收。

## 6. 回滚

1. 在 GitHub Actions 手动运行 `Roll back Cloudflare production`：留空 version ID 回到上一版本，或填写已验证版本；工作流会回滚并自动复核 `CLOUDFLARE_PRODUCTION_URL`。也可在 Cloudflare Deployments 中执行同一操作；迁移前仍使用 Sites 已保存版本。
2. 不使用 `git reset --hard`，也不删除失败提交；如需让仓库状态与线上一致，创建显式 revert 提交。
3. 轮询到部署成功，并至少验证首页、一个详情、Sitemap、RSS 和随机 404。
4. 新建故障修复分支或后续提交，记录原因、影响、回滚版本证据和防复发测试。
5. 修复通过完整质量门后再发布新版本。

回滚恢复的是运行版本；Git 历史继续保留事故提交，便于复盘和修复。当前无 D1/R2，因此不涉及数据库向前兼容或数据迁移回滚。

## 7. 公开访问与自定义域名

当前生产部署已经完成公开授权和未登录验收。日常公开发布需要继续遵循：

1. 确认本轮新增 Markdown、页面状态和联系方式都适合面向公众；
2. 部署已保存且与 Git 提交一致的版本；
3. 用未登录会话验证首页、详情、搜索、RSS、Sitemap、分享元数据和 404；
4. 保留桌面、窄屏、键盘焦点和深色偏好的定期浏览器回归。

如绑定自定义域名，按 Sites 返回的 DNS 验证记录配置 CNAME/A/验证记录，等待 HTTPS 生效；随后设置明确生产站点地址，并重新检查 canonical、Open Graph、RSS 和 Sitemap 的绝对 URL。邮箱、统计、评论或持久化能力仍不默认加入，先观察真实发布频率与访问需求，再为明确问题增加运行时复杂度。
