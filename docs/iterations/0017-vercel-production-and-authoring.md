# Iteration 0017：Vercel 生产上线与作者链路验收

## 1. 范围与成功标准

本轮把 0016 的 Vercel 原生代码真正发布到作者账户，配置生产 OAuth，验证网页 Studio 和 Obsidian 发布器，并记录仍需所有者完成的唯一账户连接。

成功标准包括：稳定生产域名可公开访问；全站生产冒烟通过；Studio 不依赖第三方 CDN并能启动；GitHub OAuth 能完成授权、Token 交换和仓库读取；Obsidian 草稿能通过真实发布器预检；所有结构、设计、技术、功能、方法、证据和风险随代码归档。Git 自动部署只有在 Vercel 账户建立 GitHub Login Connection 后才算完成，本轮不把 GitHub App 安装误写成已经连通。

## 2. 项目结构状态

- Vercel 项目：`czq1/blog`，稳定生产域名 `https://blog-iota-five-59.vercel.app`；
- 新增 `app/studio/editor-runtime-3.14.1.js/route.ts`，从构建期依赖同源提供完整 Decap CMS；
- `lib/studio-assets.ts` 新增 CMS 浏览器运行时响应；
- `next.config.ts` 的 output tracing 包含 Decap 运行时，并为版本化资源设置不可变缓存；
- `studio/index.html` 不再加载 `unpkg.com`，改用同源版本化 URL 和对应 SRI；
- `package.json`/lock 将 `decap-cms@3.14.1` 固定为构建期开发依赖；
- 生产冒烟、Studio 配置测试和 HTTP 质量测试均覆盖新运行时；
- README、发布、迁移、运维和路线图同步当前生产状态；
- `.vercel`、`.env.local` 与所有 OAuth/Vercel secret 继续被 Git 忽略。

## 3. 设计内容

公开博客的 Commit Trace、Evidence Rail、响应式和深色视觉没有变化。本轮设计工作集中在作者体验和失败可诊断性：Studio 仍先显示与博客一致的加载壳，再交给 Decap CMS；编辑器失败不再依赖不稳定的跨域 CDN；固定版本运行时使用可审计 URL 和 SRI。

权限设计遵循最小范围：Vercel GitHub App 只安装到 `Zach424/MyBlog`，没有选择全部仓库；GitHub OAuth secret 只进入 Vercel Production；验收 Token 只用于确认用户和内容目录，随后立即撤销。

## 4. 使用的技术

- Next.js 16.2.10 / React 19.2.6 / Node.js 24 Vercel Runtime；
- Vercel CLI 56.3.2、Vercel Project/Environment API；
- Decap CMS 3.14.1 完整浏览器包、SRI、同源静态 Route Handler；
- GitHub OAuth App、签名 state、GitHub REST API；
- GitHub App repository installation；
- Obsidian 桌面 Vault、自有 `myblog-publisher` 插件、Markdown/YAML 内容契约；
- Node test、TypeScript、ESLint、真实 `next start` HTTP 测试和公网冒烟。

## 5. 实现的功能

- 博客已在稳定 Vercel 生产域名公开运行；
- Production 环境已配置 GitHub OAuth Client ID/Secret；
- `/api/cms/auth` 返回带签名 state 的 GitHub 302，callback 能交换 Token；
- OAuth Token 已证明可以识别 `Zach424` 并读取 `content/posts` 的 3 个 Markdown 文件；
- `/studio` 已加载完整 Decap CMS 并显示 `Login with GitHub`；
- Decap CMS 运行时改为同源、固定版本、SRI 和不可变缓存；
- Obsidian 临时草稿通过发布器，正确映射到 `content/posts/vercel-publishing-validation.md`；
- Vercel GitHub App 已只授权 MyBlog，为后续 Git 自动部署准备仓库权限；
- 生产站继续保留旧公开站作为迁移期回退。

## 6. 实现方法

先通过 Vercel CLI 创建并关联本地项目，执行多次原生生产部署；再由 GitHub Developer Settings 创建专用 OAuth App，通过 Vercel API把两个 secret 直接写入 Production，不在工具输出、文件或 Git 中暴露值。

初次浏览器验收发现 Studio 只显示“资源加载失败”。第一层原因是外部 CDN TLS/客户端阻断；改为同源后仍失败，进一步检查 UMD 头部发现原先使用的 `decap-cms-app` 是需要外部 React/ReactDOM 的底层包。最终替换为完整 `decap-cms` 浏览器包，并以版本化 Route Handler、SRI、CSP 和 output tracing 交付。生产依赖审计仍为零；Decap 的历史依赖只存在于构建期开发依赖。

OAuth 验收没有把回调成功等同于可用：实际调用 GitHub `/user` 和 MyBlog 内容目录，确认身份和 3 个 Markdown 文件。验收 Token 随后用 OAuth App 凭据撤销。Obsidian 使用临时 draft 运行 `--check-only`，确认目标与附件后用补丁删除，避免公开垃圾内容。

Vercel Git 自动部署拆成两个权限层分别核实：GitHub App repository installation 已完成，但 Vercel Login Connection 仍缺失。CLI 持续返回明确 400，因此保留为所有者账户动作，不绕过 GitHub 禁用的授权按钮。

## 7. 验证证据

- Vercel 多次原生构建成功，最终路由包含 33 个静态生成任务和版本化 Studio runtime；
- 稳定域名 `https://blog-iota-five-59.vercel.app` 上 23 个公开 Sitemap 路由全部成功；
- `npm run production:smoke -- https://blog-iota-five-59.vercel.app --expect-oauth` 通过，OAuth 状态 302；
- 浏览器确认生产首页完整、Studio 显示 `Login with GitHub`；
- GitHub OAuth 授权页成功、callback 成功、`/user` 200、内容目录 200、3/3 Markdown；
- 验收 OAuth Token 撤销返回 204；
- Obsidian 发布器预检返回目标 `content/posts/vercel-publishing-validation.md`、附件 0；临时草稿已删除；
- 28/28 单元测试通过，原生 Next 构建通过；
- `npm audit --omit=dev --audit-level=high` 为 0 个生产漏洞；
- Vercel GitHub App 安装页确认只选择 `Zach424/MyBlog`；
- `vercel git connect` 仍返回“需要 GitHub Login Connection”，因此 Git 自动部署尚未伪报成功。
- 完整发布门首次捕获重命名路由留下的 `.next/types` 引用；`typecheck` 加入 `next typegen` 后独立类型检查恢复通过。
- 最终精确提交部署后，公网冒烟连续两次遇到 TLS/传输层 `fetch failed`；请求器加入最多三次、短退避且仅针对网络异常/429/5xx 的重试，并保留失败路径。

## 8. 经验与教训

- 包名接近不等于交付形态相同；浏览器入口必须检查 UMD 外部依赖和最终全局变量，不能只断言版本字符串。
- 管理后台关键运行时不应依赖单一第三方 CDN；同源固定版本更容易做 CSP、SRI、缓存和离线诊断。
- 浏览器看到登录按钮只是第一层证据；OAuth 还要验证 callback、API 身份、仓库权限并清理临时 Token。
- GitHub App 安装与 Vercel 账户 Login Connection 是两个独立状态；前者不能替代后者。
- 测试文章应默认保持 draft，并优先做不留内容的预检；没有作者正文时不应为了“端到端”向公开仓库制造垃圾。
- CLI 网络偶发 `fetch failed` 要区分平台传输故障和应用构建故障；重试前先确认构建日志已成功。
- 公网验收应对短暂网络错误做有限重试，但不能重试业务断言或掩盖稳定 4xx；最终失败信息必须带路由。
- 类型检查应先重新生成框架路由类型；否则删除/重命名路由后，缓存中的声明会制造与源码无关的假失败。

## 9. 全局状态、风险与未解决问题

公开阅读、搜索、发现、SEO、RSS、Sitemap、Studio 启动、OAuth 后端和 Obsidian 预检已在生产或真实流程中验证。旧站仍可回退。GitHub App 只访问 MyBlog。

唯一发布阻塞是 Vercel 账户尚未添加 GitHub Login Connection；当前 CLI 手动部署可用，但 `main` push 不会自动触发 Vercel。内嵌浏览器中的 GitHub “Authorize Vercel” 按钮始终禁用，这项用户授权必须在所有者的普通浏览器完成。

仍未执行的验收包括：Studio editorial workflow 实际保存一篇作者草稿、Obsidian `--push` 实际提交一篇作者草稿、由 Git push 触发 Vercel Production、GitHub deployment status smoke 和一次回滚演练。Decap runtime 约 5 MB，已通过版本化不可变缓存降低重复下载；升级时需同步更新依赖、URL、SRI 和测试。

## 10. 下一轮唯一主任务

所有者在 Vercel Authentication 中添加 GitHub 登录连接后，执行 `vercel git connect`；随后从 Studio 和 Obsidian 各发布一篇真实 draft，验证 GitHub 自动部署、production smoke 和回滚，再关闭迁移清单剩余项。
