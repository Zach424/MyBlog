# 路线图与全局状态

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| 1. 项目与内容契约 | done | 项目章程、严格 schema、稳定 slug、标签/专题索引 |
| 2. 视觉与阅读路径 | done | Commit Trace、响应式/深色、文章/项目/专题/标签/搜索 |
| 3. 发布发现与质量 | done | SEO、OG、JSON-LD、RSS、Sitemap、robots、全链路测试 |
| 4. 作者自助写作 | production verified | `/studio`、真实 OAuth/仓库读取、Obsidian Vault/模板/附件/发布器预检 |
| 5. Vercel 原生迁移 | production live | 原生 Next.js、无 Cloudflare 依赖、23 路由生产冒烟通过 |
| 6. 所有者生产上线 | one account step left | 待 Vercel GitHub 登录连接、Git 自动部署与两篇真实草稿验收 |

## 当前唯一主线

在 Vercel Authentication 添加 GitHub 登录连接，执行 `vercel git connect`，再分别从 Studio 和 Obsidian 发布一篇真实草稿，确认 `main` 自动部署和生产检查。旧公开站继续保持回退。

## 已知风险

- Vercel GitHub App 已安装但账户仍缺 GitHub Login Connection；在此之前 `main` push 不会自动部署；
- Studio 依赖 GitHub OAuth App，回调 origin 变更后必须同步修改设置并重新部署；
- Studio 运行时约 5 MB，已固定 3.14.1、同源提供并使用不可变缓存；升级时必须同步修改版本化 URL、SRI、依赖和测试；
- Decap GitHub backend 的 OAuth scope 对公开仓库仍较宽，账号应启用 2FA 并定期撤销不用的授权；
- CSP 为 Next.js 内联启动脚本暂留 `'unsafe-inline'`，未来应迁移到框架支持的 nonce；
- Vercel Hobby 只保证回滚到上一生产部署，更早版本需要 Git revert/redeploy 或更高套餐；
- 内容持续增长后要继续观察 `.next/static`、Serverless 函数体积和构建时间；
- 自定义域名、公开邮箱、统计和评论尚未选择，但不阻塞生产上线。

## 平台历史

Cloudflare/Sites 版本曾用于首个公开站并暴露了构建日期、静态资源安全头和 320px 宽度问题；这些经验保留在 0008–0015 迭代档案。它们是历史证据，不再是当前运行目标。
