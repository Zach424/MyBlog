# 技术架构

## 架构原则

1. 内容属于仓库，Git 是内容历史和发布入口。
2. 优先构建期处理，避免为博客维护数据库和长期服务器状态。
3. 页面组件、内容读取、设计 Token 和部署配置相互分离。
4. 新能力必须先证明真实需求，再增加运行时复杂度。

## 当前技术基线

| 层 | 技术 | 用途 |
| --- | --- | --- |
| UI | React 19 + Next.js 兼容 App Router | 页面、布局和服务端组件模型 |
| 构建 | Vinext + Vite 8 | 将 Next 风格项目构建为 Cloudflare-compatible ESM |
| 语言 | TypeScript 5，严格模式 | 类型安全和内容契约 |
| 样式 | Tailwind CSS 4 + CSS 自定义属性 | 基础工具类和设计 Token |
| 运行 | Cloudflare Worker-compatible output | 预览和生产托管 |
| 测试 | Node test + ESLint，后续加入浏览器验收 | 构建、HTML 和用户流程验证 |
| 数据 | 仓库内 Markdown，构建期读取 | 文章和项目内容 |

## 当前实现状态

```text
app/
  globals.css             设计 Token、响应式和可访问性交互
  layout.tsx              中文根布局、动态绝对 URL 元数据和主题颜色
  page.tsx                由内容管线驱动的首页、Evidence Rail 和 Commit Trace
build/
  validate-content.ts     Vite 启动/构建前内容校验
content/
  posts/                  3 篇真实文章与 TIL
  projects/               MyBlog 项目复盘
lib/content/
  contract.ts             frontmatter schema、规范化、过滤和派生索引
  index.ts                Vite glob 内容仓库与查询接口
public/
  og.png                  1200 × 630 社交分享卡
tests/
  content-contract.test.mjs  内容契约单元测试
  rendered-html.test.mjs    Worker 构建产物、内容接线和清理验证
docs/                     稳定文档、决策记录和逐轮归档
.openai/hosting.json      无 D1 / R2 的托管能力声明
```

启动骨架、未启用的 ChatGPT Auth/D1/Drizzle 示例和相关依赖已删除。首页暂时使用同页锚点，避免在详情路由实现前产生 404；下一轮页面完成后，导航和记录标题会切换到稳定内容 URL。

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
        ↓
YAML 解析、Zod schema 与跨内容校验
        ↓
Vite glob 打包、草稿过滤与派生索引
        ↓
Vite / Vinext 构建 Cloudflare-compatible output
        ↓
预览部署 → 主分支生产部署
```

## 内容契约草案

文章必须具有：`title`、`description`、`publishedAt`、`tags`、`type`、`draft`。

项目必须额外具有：`status`、`stack`，并可选 `repository`、`demo`、`startedAt`、`completedAt`。

字段、URL 和校验规则已经在 [CONTENT_MODEL.md](./CONTENT_MODEL.md) 冻结；解析库在内容模块实现轮次选择，避免让库 API 反向定义内容模型。

## 平台兼容约束

- 生产构建不得依赖运行时文件系统读取。
- 不需要持久化时，`.openai/hosting.json` 中的 D1 和 R2 保持为 `null`，仓库不保留未使用的数据库代码。
- 所有 npm scripts 必须同时兼容 Windows 本地开发和托管构建环境。
