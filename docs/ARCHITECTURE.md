# 技术架构

## 架构原则

1. 内容属于仓库，Git 是内容历史和发布入口。
2. 优先构建期处理，避免为博客维护数据库和长期服务器状态。
3. 页面组件、内容读取、设计 Token 和部署配置相互分离。
4. 新能力必须先证明真实需求，再增加运行时复杂度。
5. 网页后台与 Obsidian 只能编辑同一份仓库内容，禁止产生需要双向同步的第二内容源。

## 当前技术基线

| 层 | 技术 | 用途 |
| --- | --- | --- |
| UI | React 19 + Next.js 兼容 App Router | 页面、布局和服务端组件模型 |
| 构建 | Vinext + Vite 8 | 将 Next 风格项目构建为 Cloudflare-compatible ESM |
| 语言 | TypeScript 5，严格模式 | 类型安全和内容契约 |
| 样式 | Tailwind CSS 4 + CSS 自定义属性 | 基础工具类和设计 Token |
| 运行 | Cloudflare Worker-compatible output | 预览和生产托管 |
| 测试 | Node test + ESLint + Worker 质量审计 | 内容、构建、HTML、安全、链接、体积和对比度验证 |
| 数据 | 仓库内 Markdown，构建期读取 | 文章和项目内容 |
| 交付 | GitHub Actions + Wrangler | 每次提交自动检查，并由仓库所有者控制 Cloudflare 部署 |
| 编辑后台 | Decap CMS 3.14.1 + GitHub OAuth | `/studio` 编辑同一仓库内容，草稿以 pull request 保存 |
| 本地写作 | Obsidian Vault + MyBlog Publisher | 收件箱模板、附件规范、校验、提交和推送 |

## 当前实现状态

```text
app/
  about/page.tsx          关于与记录原则
  posts/                  文章列表与 Markdown 详情
  projects/               项目列表与 Markdown 详情
  series/                 派生专题索引与详情
  tags/                   派生标签索引与详情
  globals.css             首页、集合页、阅读页、响应式和可访问性交互
  icon.png                256 × 256 Commit Trace 站点图标
  layout.tsx              全局站点框架、动态绝对 URL 元数据和主题颜色
  not-found.tsx           未知内容的 404 边界
  page.tsx                内容驱动的首页、Evidence Rail 和 Commit Trace
  search/page.tsx         本地静态搜索页面与可分享查询
  rss.xml/route.ts        RSS 2.0 发布端点
  sitemap.xml/route.ts    站点 URL 索引
  robots.txt/route.ts     爬虫策略与 Sitemap 入口
build/
  markdown-source-plugin.ts Vite pre-transform，统一 Markdown 构建与 HMR
  validate-content.ts     Vite 启动/构建前内容校验
components/
  ContentViews.tsx        集合列表、内容头、目录和相邻内容
  MarkdownContent.tsx     GFM、标题锚点、代码高亮和安全外链
  SiteChrome.tsx          全局导航与页脚
  SearchExperience.tsx    本地加权搜索、建议与结果反馈
  StructuredData.tsx      转义后输出文章与项目 JSON-LD
content/
  posts/                  3 篇真实文章与 TIL
  projects/               MyBlog 项目复盘
lib/content/
  contract.ts             frontmatter schema、规范化、过滤和派生索引
  index.ts                Vite glob 内容仓库与文章/项目/专题/标签查询
  markdown.ts             与渲染器同规则的 H2/H3 目录提取
lib/
  discovery.ts            RSS、Sitemap 与 robots 纯文本生成器
  search.ts               Markdown 纯文本化、静态索引和加权匹配
  site.ts                 全站名称、摘要与请求主机 URL 解析
public/
  og.png                  1200 × 630 社交分享卡
  studio/
    index.html            固定版本与完整性校验的 CMS 启动页
    config.mjs            文章/项目字段、GitHub 后端与发布工作流
    preview.css           复用博客 Token 的正文预览样式
lib/
  cms-oauth.ts            有签名 state 的 GitHub OAuth 授权与回调
.github/workflows/
  quality.yml             pull request 与 main 的完整质量门
  deploy.yml              经显式开关启用的所有者 Cloudflare 自动部署
  rollback.yml            可选版本回滚与稳定生产地址复核
scripts/
  check-release-config.mjs 自助发布配置完整性检查
  check-migration-status.mjs 分支、远端同步与 Cloudflare 身份检查
  smoke-production.mjs     生产 origin、全 Sitemap 与发布端点冒烟
  publish-note.mjs         Obsidian 草稿检查、迁移、回滚、提交和推送
.obsidian/
  app.json                 Vault 收件箱、附件和排除目录设置
  templates.json           核心 Templates 插件目录设置
  plugins/myblog-publisher Obsidian 桌面发布命令
templates/obsidian/        文章、TIL 与项目模板
content/inbox/             不进入博客构建的 Obsidian 草稿收件箱
tests/
  content-contract.test.mjs  内容契约与目录提取单元测试
  search.test.mjs            搜索规范化、排序和匹配单元测试
  discovery.test.mjs         RSS/XML、Sitemap 与公开主机单元测试
  deployment-tools.test.mjs  部署、回滚、冒烟与 Worker-first 契约
  rendered-html.test.mjs    Worker 页面、搜索、发布端点和 404 集成测试
  quality-gates.test.mjs    安全头、缓存、语义、链接、体积与对比度发布审计
worker/
  index.ts                  Worker 入口、Studio 静态入口、OAuth、图像优化与生产响应头基线
output/playwright/         真实浏览器桌面、窄屏、深色、公开未登录与修复前后截图
docs/                     稳定文档、决策记录和逐轮归档
  OPERATIONS.md           内容发布、生产验收、监控与回滚手册
.openai/hosting.json      无 D1 / R2 的托管能力声明
.env.example              可选公开站点地址示例，不包含凭证
```

## 自助发布与部署边界

GitHub 仓库继续是唯一内容事实源。网页后台与 Obsidian 都只提交 `content`、附件和相关元数据；GitHub Actions 对精确提交执行 lint、内容契约、单元/Worker 测试、TypeScript、生产构建、依赖审计与 Wrangler 干跑。部署工作流只有在仓库变量 `CLOUDFLARE_DEPLOY_ENABLED=true` 后才会运行，并从 GitHub Environment secrets 读取 `CLOUDFLARE_ACCOUNT_ID` 和 `CLOUDFLARE_API_TOKEN`。

这个开关避免尚未完成所有者 Cloudflare 初始化时把 main 的每次提交变成失败部署。开关启用后，任何通过网页后台、Obsidian 或普通 Git 客户端进入 main 的提交都会由同一个工作流自动发布，不再依赖 Codex 或 Sites 打包操作。

`/studio` 由 Worker 映射到静态 CMS 启动页。CMS 在浏览器中把当前 origin 注入 `base_url`，因此 workers.dev 与未来自定义域名不需要维护不同配置；`/api/cms/auth` 和 `/api/cms/callback` 在同一个 Worker 完成 GitHub OAuth。授权 state 使用 OAuth secret 做 HMAC 签名并在十分钟后失效，回调消息只发送给发起 Studio 的同源窗口。未设置 OAuth secrets 时接口返回 503，后台保持关闭。

Studio 路由单独使用允许 GitHub API 与固定 unpkg 资源的 CSP、`same-origin-allow-popups` 和 `no-store`；公开阅读路由继续使用更严格的原 CSP、`same-origin` 和边缘缓存。CMS 包锁定到 `3.14.1` 并使用 SHA-384 Subresource Integrity，资源异常时启动页给出可恢复提示。

Cloudflare 静态资产默认可以绕过 Worker，因此生成配置对 `/studio`、`/studio/*` 与 `/api/cms/*` 显式启用 `run_worker_first`。Studio HTML、配置和预览样式都先经过 Worker 再从 `ASSETS` binding 读取，保证发布界面的安全头和缓存策略在真实平台上生效；其他普通静态资源仍由资产层直接提供。

部署动作使用 Wrangler 返回的本次 deployment URL 运行自动生产冒烟；回滚动作使用稳定的 `CLOUDFLARE_PRODUCTION_URL`，可选择明确 version ID 或上一版本。两个方向使用同一验收器检查内容页、搜索、发现端点、Studio/OAuth、安全头、全 Sitemap 和 404。

仓库根目录可以直接作为 Obsidian Vault。普通新文件进入 `content/inbox`，因此半成品和不完整 frontmatter 不会破坏博客构建；附件进入 `public/uploads`。模板使用文件名作为稳定 Slug。桌面插件只对 inbox Markdown 启用，调用参数数组而不是拼接 shell 字符串；底层脚本关闭 `draft`、规范化 Obsidian 附件链接、复用正式 Zod 内容契约并运行全量检查。检查失败时恢复原始草稿；`--push` 只暂存草稿移动、正式内容和正文实际引用的附件。

启动骨架、未启用的 ChatGPT Auth/D1/Drizzle 示例和相关依赖已删除。首页、全局导航、集合页、详情页、专题与标签索引现在全部使用稳定内容 URL；未知 slug 进入统一 404 边界。搜索索引、RSS、Sitemap 和 robots 只消费经过草稿与未来日期过滤的公开内容。

公开内容的可见日期在 Vite 配置加载时按 `Asia/Shanghai` 冻结为 `__CONTENT_BUILD_DATE__`，内容模块使用这个构建常量过滤未来内容。生产 Worker 不再在模块初始化阶段读取运行时时钟，因此同一提交的页面、搜索、RSS 与 Sitemap 具有确定的公开内容集合。

## 目标模块

```text
app/                    路由、布局、SEO 端点
components/             可复用界面组件
content/
  posts/                学习记录和文章
  projects/             项目复盘
lib/
  content/              读取、校验、排序和渲染
  seo/                  元数据、RSS、Sitemap
public/                 静态资源和分享卡
docs/                   项目档案和决策记录
tests/                  构建与内容契约测试
.openai/hosting.json    托管能力声明
```

目录中的“目标模块”会在对应功能首次实现时创建，避免空目录和提前抽象。

## 目标数据流

```text
Markdown + frontmatter
        ↑
网页后台 / Obsidian / Git 编辑器
        ↓
YAML 解析、Zod schema 与跨内容校验
        ↓
Vite glob 打包、草稿过滤与派生索引
        ↓
页面：React Markdown + GFM + 标题锚点 + 代码高亮
发现：本地搜索索引 + RSS + Sitemap + robots
        ↓
Vite / Vinext 构建 Cloudflare-compatible output
        ↓
Worker 注入安全头与 HTML 边缘缓存
        ↓
GitHub 质量门与 Wrangler 干跑 → 所有者 Cloudflare 自动部署 → 在线验收
```

## 内容契约草案

文章必须具有：`title`、`description`、`publishedAt`、`tags`、`type`、`draft`。

项目必须额外具有：`status`、`stack`，并可选 `repository`、`demo`、`startedAt`、`completedAt`。

字段、URL 和校验规则已经在 [CONTENT_MODEL.md](./CONTENT_MODEL.md) 冻结；解析库在内容模块实现轮次选择，避免让库 API 反向定义内容模型。

## 平台兼容约束

- 生产构建不得依赖运行时文件系统读取。
- 不需要持久化时，`.openai/hosting.json` 中的 D1 和 R2 保持为 `null`，仓库不保留未使用的数据库代码。
- 所有 npm scripts 必须同时兼容 Windows 本地开发和托管构建环境。
- 生产响应统一经过 Worker 安全头基线；HTML 使用浏览器不缓存、Cloudflare 边缘缓存一小时的策略。
- Next.js 的内部 PostCSS 使用已修复的 `8.5.10` 覆盖，并由生产依赖审计与完整构建共同验证。
- 草稿与未来内容过滤必须依赖构建日期，不能依赖 Cloudflare Worker 模块初始化时的 `new Date()`；发布日期时区固定为作者时区 `Asia/Shanghai`。
