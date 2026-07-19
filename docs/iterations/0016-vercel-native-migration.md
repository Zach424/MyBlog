# Iteration 0016：Vercel 原生迁移

## 1. 范围与成功标准

本轮响应作者“不使用 Cloudflare”的决定，把博客代码、发布后台、质量门和运维文档迁移为 Vercel 原生 Next.js，同时保持旧公开站作为迁移期回退。

代码层成功标准：Cloudflare/Vinext/Vite/Worker/Wrangler/Sites 依赖与配置全部退出；原有阅读、搜索、发现、Studio OAuth、Obsidian 和安全功能在 `next build`/`next start` 下通过验证。生产层成功标准仍包括 GitHub 同步、Vercel 导入、OAuth 配置、全公网冒烟、Studio/Obsidian 真实发布和入口切换；这些需要所有者账号授权，未用本地成功替代。

## 2. 项目结构状态

- 删除 `.openai/hosting.json`、`vite.config.ts`、`worker/index.ts`、两个 Vite 插件和 Cloudflare deploy workflow；
- 新增 `vercel.json`；
- 新增 `app/studio` 三个静态 Route Handlers；
- 新增 `app/api/cms/auth` 与 `callback` 两个 Node Route Handlers；
- 新增 `lib/studio-assets.ts` 与 `scripts/test-production.mjs`；
- `lib/content/index.ts` 改为 Next.js 服务端文件读取；
- `next.config.ts` 接管内容预检、构建日期、output tracing、安全头和缓存；
- GitHub Actions 改为质量门、Vercel production smoke、Vercel rollback；
- 架构、内容、发布、质量、运维、迁移、路线图和 ADR 已同步更新。

本地旧 `.vinext`、`.wrangler`、`dist` 只是已忽略的历史生成物，不再被构建、测试、部署或 Git 跟踪使用。

## 3. 设计内容

Commit Trace、Evidence Rail、浅色/深色 Token、响应式布局、320px 约束与内容页面视觉保持不变，平台迁移不制造无关界面改版。关于页和精选项目卡的技术栈改为 TypeScript、React、Next.js、Vercel；项目复盘新增迁移记录，使读者看到的当前技术与代码一致。

Studio 仍使用与博客一致的工业日志视觉，但继续作为独立 HTML 文档，避免 CMS 样式污染公开页面。未知 Studio 资源维持真实 404。

## 4. 使用的技术

- React 19.2.6；
- Next.js 16.2.10 App Router 与 Route Handlers；
- Node.js 文件系统与 Next output tracing；
- Decap CMS 3.14.1、GitHub OAuth；
- Vercel Git Integration 与固定 Vercel CLI 56.3.2 回滚命令；
- GitHub Actions `deployment_status`；
- Node test、TypeScript、ESLint、Zod、YAML。

## 5. 实现的功能

- 原生 `next dev/build/start` 开发与生产运行；
- Vercel 框架自动识别；
- Git 分支 Preview、`main` Production 的目标流程；
- Vercel Production 成功事件触发全站在线冒烟；
- Vercel Instant Rollback 的手动 Actions 路径；
- Studio HTML、配置、预览 CSS 的安全路由；
- 同源 GitHub OAuth 在 Node Route Handlers 运行；
- 内容构建日期、草稿/未来过滤和全派生索引保持确定；
- Obsidian/Git/Studio 继续共用单一内容源；
- Vercel 与 OAuth 的一次性配置、日常发布、回滚和切换手册。

## 6. 实现方法

先从工作树和已构建 Worker 反向列出平台耦合点，再把每项映射到 Next.js 原生能力。内容层没有退回手工 import：同步读取受控 Markdown 目录，并在 Next 配置阶段预检；`CONTENT_BUILD_DATE` 在配置加载时冻结；output tracing 显式包含内容与 Studio 源文件。

Worker 原先承担三项职责，被分别迁移：Studio 资源进入 force-static Route Handlers，OAuth 进入 force-dynamic Node Route Handlers，通用/发布专用响应头进入 `next.config.ts`。测试不再直接调用 Worker bundle，而是启动真实 `next start` 随机端口，通过 HTTP 验证与生产更接近的行为。

部署不再由 GitHub Action 重复执行 Vercel build；Vercel Git Integration 是唯一部署者，Actions 只在生产 deployment status 成功后做独立验收。回滚工作流固定 CLI 版本并在恢复后复用相同生产冒烟。

## 7. 验证证据

- 原生 Next.js 生产构建成功，32 个静态生成任务完成；Studio 三个路由静态生成，OAuth 两个路由为动态 Node 端点；
- 28/28 单元测试通过，覆盖内容、发现、搜索、OAuth、Studio、Obsidian 和交付配置；
- 15/15 `next start` HTTP/审计测试通过，覆盖 HTML、全部内部链接、安全头、Studio、OAuth 安全关闭、RSS/Sitemap/robots、404、体积和 WCAG AA；
- GitHub 三个 workflow 均通过 YAML 解析；
- `npm audit --omit=dev --audit-level=high` 为 0 个生产漏洞；
- Vercel 生产与真实发布证据尚未生成，明确保留在迁移完成定义中。

迁移中发现原有审计直接调用 Worker、canonical 强制尾斜杠、404 缓存头要求精确等于 `no-store`。改为真实 HTTP 后，Next.js 合法地输出无尾斜杠 canonical 和包含 `no-store` 的复合缓存头；断言改为验证语义而非旧平台的字符串形状。

## 8. 经验与教训

- 平台迁移应按“职责”拆解，不按旧文件一比一复制；这样才能删除适配层而不丢功能。
- 本地构建成功不能证明 Serverless 文件存在，内容目录必须进入 output tracing。
- 发布后台的静态文件也属于安全边界；显式路由比把管理入口放进 `public` 更易验证 MIME、缓存和未知路径。
- Git 自动部署和 GitHub Action 主动部署只能保留一个权威入口，否则一次提交可能生成重复生产版本。
- 跨框架测试应验证 HTTP 语义；精确匹配平台私有 header 格式会制造无价值迁移阻力。
- 删除依赖后还要同步公开“关于”和项目复盘，否则站点会向读者陈述过期架构。

## 9. 全局状态、风险与未解决问题

博客功能代码已完成 Vercel 本地迁移，旧公开站仍在线。生产完成仍缺少外部证据：本地三个旧提交加本轮提交尚未同步 GitHub；Vercel 项目未由所有者导入/授权；GitHub OAuth App 和 Vercel production secrets 未配置；生产冒烟、未登录浏览器、Studio 真实发布、Obsidian 真实发布与回滚尚未执行。

这些操作需要所有者在 GitHub/Vercel 官方页面授权。任何 Token、secret 或验证码都不得进入聊天和归档。新站全部通过前不删除旧公开站。

## 10. 下一轮唯一主任务

完成 GitHub 推送与 Vercel 所有者授权，部署本轮精确提交；随后配置 GitHub OAuth，依次完成公网冒烟、未登录浏览器、Studio/Obsidian 真实发布和入口切换，并把最终生产 URL 与证据回写本轮档案后提交。
