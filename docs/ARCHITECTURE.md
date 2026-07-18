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

目录中的“目标模块”会在对应功能首次实现时创建；当前结构以启动骨架为准，避免空目录和提前抽象。

## 目标数据流

```text
Markdown + frontmatter
        ↓
内容加载与 schema 校验
        ↓
构建期生成页面、索引、RSS 与 Sitemap
        ↓
Vite / Vinext 构建 Cloudflare-compatible output
        ↓
预览部署 → 主分支生产部署
```

## 内容契约草案

文章必须具有：`title`、`description`、`publishedAt`、`tags`、`type`、`draft`。

项目必须额外具有：`status`、`stack`，并可选 `repository`、`demo`、`startedAt`、`completedAt`。

具体 schema 在内容模块实现轮次冻结，当前只记录边界，不提前选择解析库。

## 平台兼容约束

- 生产构建不得依赖运行时文件系统读取。
- 不需要持久化时，`.openai/hosting.json` 中的 D1 和 R2 保持为 `null`。
- 所有 npm scripts 必须同时兼容 Windows 本地开发和托管构建环境。
