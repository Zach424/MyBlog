# 系统架构

## 1. 架构目标

MyBlog 是 Git-first 个人技术博客。公开阅读不依赖数据库；网页后台、Obsidian 和普通编辑器只负责产生 Git 提交。部署平台可以替换，但内容契约、URL 和写作入口保持稳定。

## 2. 技术组成

| 层 | 技术 | 职责 |
| --- | --- | --- |
| 界面 | React 19、Next.js 16 App Router | 页面、元数据、Route Handlers 与服务端渲染 |
| 内容 | Markdown、YAML、Zod | 文章/项目解析、字段校验、草稿过滤与派生索引 |
| 阅读 | react-markdown、remark-gfm、rehype | GFM、标题锚点、代码高亮与目录 |
| 发现 | 本地搜索、RSS、Sitemap、robots、JSON-LD | 检索、订阅与搜索引擎发现 |
| 发布 | Decap CMS、Obsidian、GitHub | 两个作者入口，共用同一内容事实源 |
| 托管 | Vercel | Git 自动预览、`main` 生产部署、环境变量与回滚 |
| 质量 | Node test、TypeScript、ESLint、生产 HTTP 测试 | 内容、HTML、安全、链接、体积与发布契约 |

## 3. 项目结构

```text
app/
  api/cms/{auth,callback}/route.ts  GitHub OAuth 同源端点
  studio/                           Studio HTML、配置和样式路由
  posts/ projects/ series/ tags/   集合与详情页
  search/ about/                    搜索和关于页
  rss.xml/ sitemap.xml/ robots.txt/ 发现端点
components/                         站点框架、内容视图、Markdown、搜索
content/
  posts/ projects/                  唯一公开内容源
  inbox/                            Obsidian 待发布区
lib/
  content/                          内容契约、文件读取与派生索引
  cms-oauth.ts                      签名 OAuth state 与 token 交换
  obsidian-publishing.ts            Obsidian 校验、附件与目标路径转换
  studio-assets.ts                  构建期 Studio 资源响应
studio/                             Decap CMS 源文件（不放入 public）
templates/obsidian/                 文章、TIL、项目模板
scripts/                            发布、冒烟、迁移和生产测试器
tests/                              单元、生产 HTTP 与质量审计
.github/workflows/
  quality.yml                       PR/main 完整质量门
  production-smoke.yml              Vercel 生产部署成功后的在线验收
  rollback.yml                      所有者手动 Vercel 回滚与复核
vercel.json                         Vercel Next.js 框架声明
```

## 4. 内容与构建

`next.config.ts` 在开发和构建开始时调用 `validateContentRepository`，先验证全部 Markdown。`lib/content/index.ts` 在构建/服务端从 `content/posts` 与 `content/projects` 读取文件，解析为统一记录，过滤草稿和未来内容，再派生专题、标签、搜索、RSS 与 Sitemap。

公开日期按 `Asia/Shanghai` 在 Next.js 配置加载时冻结为 `CONTENT_BUILD_DATE`。同一个部署内的页面、搜索和 Feed 因而共享确定内容集合，不会因 Serverless 实例启动时间变化。

内容目录通过 Next.js output tracing 显式包含在部署中，既支持 Vercel Serverless，也不会依赖开发机器路径。

## 5. 作者发布链路

```text
网页 /studio ─┐
              ├─ GitHub 提交/PR ─ 质量门 ─ main ─ Vercel 自动生产部署
Obsidian ─────┘                                      │
                                                    └─ 生产冒烟
```

Studio 在浏览器中用当前 origin 生成 `base_url`。`/api/cms/auth` 创建十分钟有效、HMAC 签名且绑定 origin 的 state；`/api/cms/callback` 交换 GitHub token，并且只向发起授权的同源窗口发送结果。未设置 `GITHUB_OAUTH_ID` 或 `GITHUB_OAUTH_SECRET` 时返回 503，发布入口安全关闭。

Studio HTML、配置和预览样式保留在仓库根 `studio`，由三个显式 Route Handler 以正确 MIME 类型返回；未知子资源返回真实 404。它们不进入 `public`，避免绕过 `no-store`、专用 CSP、`X-Robots-Tag` 与 OAuth 弹窗策略。

## 6. 安全与缓存

`next.config.ts` 为所有响应声明 CSP、HSTS、`nosniff`、`DENY`、权限策略、来源策略和 COOP，并关闭 `X-Powered-By`。公开 HTML 使用浏览器复核、CDN 一小时缓存与一天 stale-while-revalidate；Studio、OAuth 和未知 Studio 路径必须包含 `no-store`。

一般页面的 COOP 为 `same-origin`；Studio 与 OAuth 为 `same-origin-allow-popups`，以允许 GitHub OAuth 弹窗完成握手。Studio CSP 只额外允许锁定的 Decap CDN、GitHub API、GitHub 授权页和头像来源。

## 7. 部署与回滚

Vercel GitHub Integration 负责每个分支的 Preview 和 `main` 的 Production，不再维护重复的部署 Action。GitHub `deployment_status` 成功事件触发生产冒烟，检查代表页面、全 Sitemap、Studio/OAuth、Feed、安全头和 404。

紧急恢复使用 Vercel Instant Rollback。仓库内手动工作流调用固定版本 Vercel CLI，回滚后对稳定生产域名重跑同一冒烟；Git 历史随后通过 revert 或修复提交恢复一致性。

## 8. 不变量

- GitHub 仓库是内容、附件、版本和回滚的唯一事实源。
- 稳定 URL 来自文件名/slug，不随日期和平台变化。
- 草稿、未来内容不能进入页面、搜索、RSS 或 Sitemap。
- `/studio` 与 OAuth 永远不缓存，不索引，并维持同源 state 验证。
- 发布平台不能成为写作前置条件；Obsidian 和 Git 提交在本地仍可完成。
- 每轮结构、设计、技术、功能、方法、验证、经验和风险必须与代码一起归档。
