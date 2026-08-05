# 运行维护手册

## 当前运行模型

- 应用：原生 Next.js 16 / React 19；
- 当前生产站：`https://blog-iota-five-59.vercel.app`，Vercel 项目 `czq1/blog`；
- 生产交付：GitHub `main` 触发 Vercel 自动部署，GitHub deployment status 触发稳定生产域名冒烟；
- 自动化运行时：GitHub-hosted `ubuntu-latest`，checkout/setup-node v6 使用 Node 24 action runtime，仓库命令仍在显式 Node.js 22 + npm cache 下运行；
- 当前回退站：`https://zach424-engineering-notes.zhiqingchen792.chatgpt.site`；
- 内容：GitHub 仓库中的 Markdown 与附件；
- 作者入口：`/studio`、`/studio/maintenance` 只读复核队列、Obsidian、普通 Git；
- 数据库：无。

## 一次性生产配置

1. Vercel 项目、Next.js 设置、稳定生产域名和 GitHub OAuth Production 环境变量已完成；
2. GitHub OAuth App 的 Homepage/Callback 已指向稳定生产 origin，并已验证 Token 交换和仓库读取；
3. Vercel GitHub App 仅授权 `Zach424/MyBlog`，GitHub Login Connection 与 `vercel git connect` 已完成，生产分支为 `main`；
4. GitHub Actions variable 已保存稳定生产域名，repository secrets 已保存 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`；
5. Studio editorial workflow、Obsidian `--push`、Git 自动部署、自动冒烟和回滚恢复均已真实验收。

Secret 只保存在 Vercel/GitHub 的加密设置中，不进入 `.env.example`、文档、截图、聊天或 Git 历史。Preview 默认不设置 OAuth secret，因此后台在预览部署安全关闭。

## 日常发布

1. 在 `/studio` 或 Obsidian 新建内容；
2. 保持稳定 ASCII slug，填写摘要、日期、`freshness`、`reviewedAt`、标签和正文；
3. 草稿阶段保持 `draft: true`；需要定时发布时再设置未来 `publishedAt`；
4. Obsidian 中可先运行“查看已发布内容复核队列”（命令行为 `npm run content:status`）处理已有 Current 内容；发布新草稿时运行“查看全部草稿发布就绪状态”（命令行为 `npm run content:inbox`），处理 blocked 并确认 scheduled 日期，再运行 `npm run content:publish -- <note> --check-only`；
5. 逐张确认实际格式、宽高、帧数和体积后，使用 Obsidian 的“发布当前草稿并同步 GitHub”或命令行 `--push`。`--push` 会把 `draft` 改为 `false` 后运行完整质量门、提交并推送；网页方式使用 editorial workflow；
6. 让质量门通过，再把提交合并到 `main`；
7. Vercel 自动创建生产部署，deployment status 工作流检查稳定公开生产域名；
8. 打开文章、RSS 和 Sitemap，确认新内容可见且绝对 URL 指向当前生产域名。

## URL 迁移

已公开 slug 原则上保持不变。确需迁移时，在同一 Git 提交中移动内容与归档附件、修正所有引用，并把旧路径登记到 `content/redirects.yml`，直接指向最终公开 HTML 页面。每条记录必须填写迁移日期和原因；不要使用查询、锚点、通配参数、链式跳转，也不要覆盖现有页面、静态文件、`/_next`、`/api`、`/studio` 或 `/uploads`。

提交前运行 `npm run check`；上线后用 `curl -I https://<生产域名>/<旧路径>` 或完整生产冒烟确认状态为 308、`Location` 为同源最终地址、目标为 200。误配时回滚注册表和同一次迁移提交；若内容已在错误新地址短暂公开，保留所有曾公开地址并直接指向最终规范页面，避免制造新的链。

Current record 至少每 180 天逐项复核一次架构、版本、状态、外链和操作步骤；有事实变化时同步更新正文与 `updatedAt`，无变化时只更新 `reviewedAt`。Historical snapshot 不要求持续追新，但正文必须说明记录时间与当前去向。

每周 Quality Gate 会在周一 09:00（Asia/Shanghai）生成维护摘要；也可随时运行 `npm run content:status`。剩余 60/30 天分别进入“准备复核/即将到期”，warning 不阻断构建；越过最后有效日才失败。处理提醒时按报告清单逐项验证，不要只更新日期。

日常可先打开 `/studio/maintenance` 查看 Review Horizon 和全库优先级，再从 `Edit entry` 进入稳定条目。该页面的内容集合来自当前部署、日期按请求时的 `Asia/Shanghai` 当天推进；因此修改只有在新 Production 上线后可见，但无需为了日期变化重新部署。接口只返回已公开 Current 内容的最小元数据，不返回正文、源路径、草稿或 Historical。页面失败时先点 `Retry`，仍失败再运行 `npm run content:status` 并检查 `/studio/maintenance.json` 的 HTTP 状态；不要用手工改日期或缓存快照替代复核。

在本机 Vault 中也可从命令面板运行“查看已发布内容复核队列”。插件 1.2.0 只启动本地 `content:status` 并显示纯文本证据，零网络、零写入；Windows 子进程隐藏运行且不插入 shell 字符串。持续 Notice 若没有在命令终态消失，或插件关闭后仍存在 npm 进程，视为插件生命周期故障；可先禁用插件并在终端运行同一命令取证，再回滚插件提交。插件文件更新后，已打开的 Obsidian 需要重启或重新启用插件才能加载新版本。

外部链接使用 `npm run links:external` 做本地确定性库存；命令默认不访问网络并随 `release:check` 输出。需要现场证据时运行 `npm run links:external -- --check`，但 403/429、HEAD 不支持、5xx、超时和网络错误只进入人工复核，不能直接作为生产事故或默认构建失败。检查器不下载正文、不访问私网、不改写链接；若显式 `--fail-on-broken` 返回失败，先在普通浏览器复核确定 4xx 或坏重定向再修改内容。

本地图片必须是扩展名与真实格式一致的 PNG/JPEG/WebP/GIF/AVIF，单文件不超过 3 MiB，宽高各不超过 2560 px；大截图和照片优先导出为 AVIF/WebP。即使绕过 Studio/Obsidian 直接提交，Next 构建也会扫描全部 `public/uploads` 并阻止损坏或超预算媒体进入生产。

## 发布前检查

```bash
npm run release:check
```

该命令先输出内容维护队列、当前作者工作区的 inbox 发布就绪状态、根暂存媒体库存和离线外链库存，并覆盖内容契约、Studio 配置、Obsidian 发布器、TypeScript、原生 Next.js 构建、生产 HTTP、安全头、全站内部链接、体积预算和生产依赖审计。inbox blocked 与外链 issue 都不会阻断未涉及它们的既有生产版本，但发布对应草稿前必须处理；报告不会执行任何发布或网络健康检查动作。

发布门还会结构化解析三份 GitHub workflow：它要求 checkout/setup-node 均为 v6，应用 Node 仍为 22，npm 缓存保持显式启用，并锁定 Quality 的 PR/main/每周/手动触发、production smoke 的 deployment-status/手动触发以及 rollback 的 manual-only 边界。若 GitHub 再提示 action runtime 弃用，先核对官方 action release 与 runner 要求，再升级 major；不要通过允许不安全 Node runtime 的环境变量压住 warning。

## 发布后检查

```bash
npm run production:smoke -- https://your-production.example --expect-oauth
```

必须验证：首页、集合、文章、项目、知识地图、搜索、RSS、robots、Sitemap 全部 URL、Studio HTML/配置/媒体清单/媒体预检/稳定 slug 控件/预览/固定版本运行时、OAuth 跳转、安全头、缓存和真实 404。首次上线或域名切换还需用未登录浏览器覆盖桌面、320px、深色和键盘路径。

## 故障等级

| 等级 | 示例 | 处理 |
| --- | --- | --- |
| P1 | 首页不可访问、全部 5xx、错误版本覆盖生产 | 立即 Vercel Instant Rollback，复核稳定域名 |
| P2 | Studio 无法登录、内容详情 404、Feed/搜索错误 | 暂停发布，回滚或修复后重跑完整冒烟 |
| P3 | 单篇格式、轻微视觉或非关键元数据问题 | 建 issue，正常修复提交 |

## 回滚

Vercel Hobby 默认可立即回到上一生产部署；更早的指定部署取决于套餐能力。优先在 Vercel Deployments 执行 Instant Rollback，或手动运行 GitHub Actions 的 `Roll back Vercel production`，填写上一条已验证的 deployment URL。回滚完成后工作流自动检查 `VERCEL_PRODUCTION_URL`。

路由恢复后，用 `git revert` 或新的修复提交使 `main` 与生产重新一致。若事故来自重定向，先确认回滚版本不会让已经公开的旧地址失去去向；必要时用新的单跳规则修复，而不是删除历史入口。禁止强制推送、`reset --hard` 或删除旧部署作为第一响应。

## 域名与可选能力

绑定自定义域名后，在 Vercel 设置中完成 DNS 验证并等待 HTTPS 生效，再重新检查 canonical、Open Graph、RSS 与 Sitemap。评论、统计、公开邮箱和数据库保持可选；只有真实需求出现时才增加运行时复杂度。
