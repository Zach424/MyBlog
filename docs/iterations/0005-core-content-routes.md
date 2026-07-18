# Iteration 0005：Markdown 正文与核心内容路由

- 日期：2026-07-18
- 状态：完成

## 1. 范围与成功标准

本轮只打通博客核心阅读路径：实现 Markdown 正文、目录与代码高亮，交付文章、项目、专题、标签、关于和 404 页面，并把首页及全局导航接到稳定 URL。搜索、RSS、Sitemap、浏览器验收和部署留到后续轮次。

成功标准：3 篇文章与 1 个项目可以从列表进入详情；专题和标签从内容索引派生；标题、摘要、canonical 和 Open Graph 随路由生成；未知 slug 返回 404；单元、lint、类型、生产构建、Worker HTML 与本地 HTTP 检查通过；文档归档后独立提交并推送。

## 2. 项目结构状态

```text
app/
  about/page.tsx
  posts/page.tsx
  posts/[slug]/page.tsx
  projects/page.tsx
  projects/[slug]/page.tsx
  series/page.tsx
  series/[slug]/page.tsx
  tags/page.tsx
  tags/[slug]/page.tsx
  not-found.tsx
components/
  ContentViews.tsx
  MarkdownContent.tsx
  SiteChrome.tsx
build/
  markdown-source-plugin.ts
lib/content/
  contract.ts
  index.ts
  markdown.ts
tests/
  content-contract.test.mjs
  rendered-html.test.mjs
```

`layout.tsx` 现在统一输出跳转链接、顶部分隔线、站点导航与页脚。`page.tsx` 的记录、精选项目与主题标签全部改为真实路由。内容、构建校验和托管声明的既有结构保持不变。

## 3. 设计内容

内容页继续使用 iteration 0003 的冷调工程编辑风格，没有引入第二个视觉主题。集合页用编号行表达归档顺序；详情页使用大标题与事实栏形成非对称头部，正文约 760px，桌面目录在右侧粘性停留，窄屏回到正文前。

Markdown 的标题、引用、代码、表格、列表和链接全部复用已有 Canvas、Ink、Signal、Trace 与 Rule Token。唯一主要视觉签名仍是首页 Commit Trace；内容页依靠排版层级和证据信息服务阅读。首页状态更新为 `REV. 005`，Evidence Rail 指向已验证的核心路由和下一阶段发布能力。

## 4. 使用的技术

- React Markdown `10.1.0`：把 Markdown AST 映射为语义化 React 元素；
- remark-gfm `4.0.1`：支持表格、删除线、任务列表等 GitHub Flavored Markdown；
- rehype-slug `6.0.0`：为正文标题生成稳定 ID；
- rehype-highlight `7.0.2`：构建时生成 highlight.js 代码 token，不启用自动语言探测；
- github-slugger `2.0.0`：目录提取与正文标题采用同一 slug 规则；
- Next.js `Link`、`Metadata`、`generateStaticParams`、`notFound`：内部导航、路由元数据、已知参数和 404；
- Vinext/Vite 与 Cloudflare Worker 测试入口：验证实际生产输出，不依赖 Node 运行时文件系统。
- 自定义 Vite pre-transform：在 JavaScript 解析前把 `.md` 转成字符串模块，修复 Vinext RSC 热更新丢失 `?raw` 查询的问题。

## 5. 实现的功能

- 全局导航：文章、专题、项目、关于和品牌首页入口；
- 文章列表与详情：元数据、正文、H2/H3 目录、代码高亮、标签、专题和相邻文章；
- 项目列表与详情：状态、技术栈、仓库/演示外链、正文与目录；
- 专题索引与详情：按内容契约中的顺序连续展示文章；
- 标签索引与详情：跨文章、TIL 和项目聚合；
- 关于页：记录范围、完成标准、技术基线和已确认的 GitHub 入口；
- 统一 404：未知文章、项目、专题或标签返回真实 404 和 `noindex`；
- 每条路由独立 title、description、canonical 与 Open Graph；
- 外部 Markdown 链接在新窗口打开并附 `noreferrer`，表格区域可聚焦和横向滚动；
- 修改 Markdown 后无需重启开发服务器，内容可通过 RSC 热更新进入详情页；
- 首页内容、项目与标签均链接到稳定 URL，当前工程状态同步到第五轮。

## 6. 实现方法

`MarkdownContent.tsx` 是唯一正文渲染入口，插件列表固定并关闭代码语言自动探测，未知语言不会让构建失败。自定义链接只对 HTTP(S) 外链增加新窗口策略；表格包裹在带标签和焦点的滚动区域中。

`markdown-source-plugin.ts` 在 Vite 的 pre-transform 阶段把所有 `.md` 源码变成默认导出的字符串模块；`import.meta.glob` 因此不再依赖可能在 Vinext RSC HMR 中丢失的 `?raw` 查询。这个转换只发生在开发/构建阶段，Cloudflare Worker 仍不读取文件系统。

`markdown.ts` 逐行提取 H2/H3，忽略 fenced code，清理常见行内 Markdown，再交给 `github-slugger`。因此目录 ID 与 `rehype-slug` 生成的正文 ID一致，重复标题也会同步得到 `-1` 后缀。

路由不直接解析文件，而是只调用 `lib/content/index.ts` 的查询函数。动态详情先查已发布索引，不存在即调用 `notFound()`；专题和标签不保存额外数据文件。内部导航统一使用 `Link`，外部资源继续使用普通锚点。

## 7. 验证证据

- 内容与目录单测：6/6 通过，新增重复标题、H3 和 fenced code 排除测试；
- `npm run lint`：通过；
- `npm run typecheck`：通过；
- `npm run build`：通过，Vinext 五个环境完成构建，生产路由表包含 10 类页面；
- Worker HTML 测试：5/5 通过，覆盖首页、7 个公开入口、Markdown 标题/目录/高亮、canonical、项目资源和真实 404；
- 本地 HTTP：`/`、`/posts`、文章详情、项目详情、专题详情、标签详情和 `/about` 共 7/7 返回 200；
- Markdown HMR：临时标记写入后无需重启即可在文章 HTML 中出现，移除后也立即消失，服务器日志没有再次出现 Markdown 解析错误；
- 当前未压缩构建产物：`dist/server` 约 2.63 MB，作为部署轮次的体积基线；
- 完整 `npm test`、`git diff --check` 与文档链接检查在提交前通过。

首次 lint 失败指出 20 个站内普通锚点不符合 Next.js 导航规范，统一改成 `Link` 后通过。首次 Worker 新测试失败来自测试文案与真实页面标题不一致，不是产品渲染错误；断言改为页面实际契约后通过。这两类失败均保留在本轮记录中。

长时间运行的开发会话最初在 Markdown 变更时报告 `Cannot assign to this expression`：Vinext RSC HMR 丢掉了 raw 查询，把 `---` frontmatter 当作 JavaScript。加入 Markdown pre-transform、移除 glob 的 raw 查询并做写入/回退实测后解决。

## 8. 经验与教训

- 目录解析器和正文标题不能各自发明 slug 规则；中文和重复标题尤其容易出现漂移，必须共享同一种算法；
- 核心路由一旦存在，首页和全局导航就应立即切换到稳定 URL，避免长期保留同页占位链接；
- Worker 级 HTML 测试比只测 React 组件更有价值，它能同时发现路由状态、元数据、内容打包和 404 边界问题；
- 测试断言应该针对页面契约或结构，不应凭记忆复制尚未实现的文案；
- Markdown 高亮库显著增加构建模块数，应记录体积基线，并在真实 Cloudflare 部署包上继续验证。
- 能通过冷启动和生产构建不代表内容编辑体验正确；文件型内容源必须额外验证“修改后不重启”的开发路径。

## 9. 全局状态、风险与未解决问题

- 工程与归档基线：done；
- 内容契约、元数据管线与 Markdown 渲染：done；
- 设计系统、首页与核心内容路由：done；
- 发布能力：partial，基础 SEO/OG 和草稿过滤完成，搜索/RSS/Sitemap/robots 未完成；
- 上线候选与生产部署：pending。

风险：Vinext 对动态主机元数据的静态路由分类仍显示 Unknown 提示，但构建和 Worker 渲染通过；Markdown 高亮的真实压缩部署包待检查；移动排版、键盘流程、颜色对比和系统字体折行尚未完成浏览器验收；最终域名和联系方式公开范围仍待确认。

## 10. 下一轮唯一主任务

完成发布发现能力：实现静态站内搜索、RSS、Sitemap 和 robots，并为这些端点补充 Worker 级集成测试。
