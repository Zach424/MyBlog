# 运行维护手册

## 当前运行模型

- 应用：原生 Next.js 16 / React 19；
- 当前生产站：`https://blog-iota-five-59.vercel.app`，Vercel 项目 `czq1/blog`；
- 目标交付：GitHub `main` 触发 Vercel 自动部署；账户 GitHub 登录连接完成前暂由固定版本 Vercel CLI 手动部署；
- 当前回退站：`https://zach424-engineering-notes.zhiqingchen792.chatgpt.site`；
- 内容：GitHub 仓库中的 Markdown 与附件；
- 作者入口：`/studio`、Obsidian、普通 Git；
- 数据库：无。

## 一次性生产配置

1. Vercel 项目、Next.js 设置、稳定生产域名和 GitHub OAuth Production 环境变量已完成；
2. GitHub OAuth App 的 Homepage/Callback 已指向稳定生产 origin，并已验证 Token 交换和仓库读取；
3. Vercel GitHub App 已仅授权 `Zach424/MyBlog`；所有者还需在 Vercel Authentication 添加 GitHub 登录连接，再运行 `vercel git connect`；
4. 在 GitHub Actions variable 保存 `VERCEL_PRODUCTION_URL=https://blog-iota-five-59.vercel.app`；如启用仓库回滚工作流，再保存 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` secrets；
5. Git 自动部署接通后，用一篇真实 Studio 草稿和一篇 Obsidian 草稿完成最终验收。

Secret 只保存在 Vercel/GitHub 的加密设置中，不进入 `.env.example`、文档、截图、聊天或 Git 历史。Preview 默认不设置 OAuth secret，因此后台在预览部署安全关闭。

## 日常发布

1. 在 `/studio` 或 Obsidian 新建内容；
2. 保持稳定 ASCII slug，填写摘要、日期、标签和正文；
3. 草稿阶段保持 `draft: true`；
4. 本地先运行 `npm run content:publish -- <note> --check-only`；确认后使用 Obsidian 的“发布当前草稿并同步 GitHub”或命令行 `--push`，网页方式使用 editorial workflow；
5. 让质量门通过，再把提交合并到 `main`；
6. Vercel 自动创建生产部署，生产冒烟检查部署 URL；
7. 打开文章、RSS 和 Sitemap，确认新内容可见且绝对 URL 指向当前生产域名。

## 发布前检查

```bash
npm run release:check
```

该命令覆盖内容契约、Studio 配置、Obsidian 发布器、TypeScript、原生 Next.js 构建、生产 HTTP、安全头、全站内部链接、体积预算和生产依赖审计。

## 发布后检查

```bash
npm run production:smoke -- https://your-production.example --expect-oauth
```

必须验证：首页、集合、文章、项目、搜索、RSS、robots、Sitemap 全部 URL、Studio HTML/配置/预览/固定版本运行时、OAuth 跳转、安全头、缓存和真实 404。首次上线或域名切换还需用未登录浏览器覆盖桌面、320px、深色和键盘路径。

## 故障等级

| 等级 | 示例 | 处理 |
| --- | --- | --- |
| P1 | 首页不可访问、全部 5xx、错误版本覆盖生产 | 立即 Vercel Instant Rollback，复核稳定域名 |
| P2 | Studio 无法登录、内容详情 404、Feed/搜索错误 | 暂停发布，回滚或修复后重跑完整冒烟 |
| P3 | 单篇格式、轻微视觉或非关键元数据问题 | 建 issue，正常修复提交 |

## 回滚

Vercel Hobby 默认可立即回到上一生产部署；更早的指定部署取决于套餐能力。优先在 Vercel Deployments 执行 Instant Rollback，或手动运行 GitHub Actions 的 `Roll back Vercel production`。工作流可以留空 deployment URL 选择上一版本，回滚完成后自动检查 `VERCEL_PRODUCTION_URL`。

路由恢复后，用 `git revert` 或新的修复提交使 `main` 与生产重新一致。禁止强制推送、`reset --hard` 或删除旧部署作为第一响应。

## 域名与可选能力

绑定自定义域名后，在 Vercel 设置中完成 DNS 验证并等待 HTTPS 生效，再重新检查 canonical、Open Graph、RSS 与 Sitemap。评论、统计、公开邮箱和数据库保持可选；只有真实需求出现时才增加运行时复杂度。
