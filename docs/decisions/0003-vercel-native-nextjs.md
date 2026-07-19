# ADR-0003：迁移到 Vercel 原生 Next.js

- 状态：Accepted
- 日期：2026-07-19
- Supersedes：ADR-0001

## 背景

博客的长期目标是作者可通过网页后台或 Obsidian 独立发布。既有 Vinext/Vite/Cloudflare Worker/Sites 链路可以运行，但需要额外适配 Next.js 行为、静态资源路由和平台打包；所有者也明确要求不再使用 Cloudflare。

项目没有 D1、R2 或其他 Cloudflare 持久数据，因此托管替换不涉及数据迁移。现有应用本身已采用 Next.js App Router API，Vercel 是最小认知负担的原生运行目标。

## 决策

使用 Next.js 官方 `next dev/build/start`，由 Vercel GitHub Integration 为分支生成 Preview、为 `main` 生成 Production。保留 Git-first 内容与两个作者入口。Studio 静态资源通过显式 Route Handlers 返回；GitHub OAuth 使用 Node Route Handlers；安全头和缓存由 `next.config.ts` 声明。

删除 Vinext、Vite、Cloudflare Worker、Wrangler、Cloudflare GitHub Actions 与 `.openai/hosting.json`。旧 Sites 站只在 Vercel 生产验收完成前作为外部回退，不再接收新架构部署。

## 原因

- 原生匹配当前 App Router、Route Handler 和元数据模型；
- Git push/PR 自动部署满足“不依赖 Codex发布”；
- Studio OAuth 与博客同源，无需单独代理服务；
- 无数据层迁移，Git 历史与稳定 URL 完全保留；
- 删除一层框架适配与一个托管账号，降低维护面。

## 代价

- 首次需要所有者授权 Vercel GitHub Integration 与 GitHub OAuth App；
- Vercel 平台行为和套餐限制仍需生产验证；
- Node 文件读取需要 output tracing 明确纳入 Markdown；
- 旧 Cloudflare 生产经验只能作为回退/历史，不能证明 Vercel 运行正确。

## 验证与回滚

本地必须通过原生 Next.js 构建和真实 `next start` HTTP 测试；生产必须通过全 Sitemap、Studio/OAuth、安全头、320px 与两条真实发布链路。迁移期间保留旧公开 URL；Vercel 异常可 Instant Rollback，Git 状态用 revert 或修复提交恢复。
