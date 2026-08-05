---
title: "MyBlog — 把学习记录做成工程资产"
description: "从内容契约、工程轨迹设计到 Vercel 自动发布，构建一个可维护、可检索、可复盘的个人技术博客。"
publishedAt: 2026-07-18
updatedAt: 2026-08-05
freshness: current
reviewedAt: 2026-08-05
status: maintained
stack: ["TypeScript", "React", "Next.js", "Vercel", "GitHub"]
tags: ["TypeScript", "Next.js", "Vercel", "Personal Knowledge", "Design Systems"]
draft: false
featured: true
cover: "/uploads/myblog/cover.webp"
coverAlt: "文档、提交节点、网页与部署层沿一条工程轨迹连接成可维护博客系统"
repository: "https://github.com/Zach424/MyBlog"
demo: "https://blog-iota-five-59.vercel.app"
---

## 当前状态（2026-08-05）

MyBlog 当前运行在 Vercel，稳定公开地址是 [blog-iota-five-59.vercel.app](https://blog-iota-five-59.vercel.app)。仓库使用原生 Next.js 16.3、React 19 和 TypeScript；GitHub `main` 自动触发 Production，质量门和独立线上冒烟共同验证交付。网页 Studio 与 Obsidian 都可以由作者独立发布；MyBlog Publisher 1.10.0 不仅能用候选指纹保护正式复核、识别并精确重送待交付复核，还能把新内容 push 失败后留下的正式笔记、可选 inbox 删除和归档媒体识别为一个原子 Commit Envelope，在读取源草稿前阻止重复发布。

Cloudflare、Sites、Vinext、Vite Worker 和 Wrangler 仅属于 2026-07-18 至 2026-07-19 的首版与迁移历史，不再是当前运行依赖。旧公开站保留为迁移期回退证据，页面顶部的 Live demo 始终指向当前生产站。

## 背景与目标

学习记录原本分散在代码、聊天和临时笔记中，很难在几个月后重新找到当时的约束与判断。MyBlog 的目标不是建设一个内容展示页，而是把学习过程和项目经历变成能够版本管理、检索和复盘的工程资产。

首页需要让访问者在一分钟内理解最近在学什么、当前在做什么，以及这些内容如何互相验证。

## 约束

- 中文内容优先，同时保留技术术语的准确性；
- 新文章应在五分钟内完成本地预览和发布提交；
- 生产环境由 Vercel 托管，推送 `main` 后自动部署；
- 公开内容不建设数据库或读者账号系统，作者后台只承担 Git 写作入口；
- 所有开发轮次必须归档结构、设计、技术、功能、方法、验证和经验。

## 技术选择

界面使用 React 19 与原生 Next.js App Router，由 Vercel 提供构建、预览和生产部署。内容以 Markdown 和 frontmatter 保存在 Git 中，Next.js 构建期从受校验的内容目录读取，并在进入页面前完成 schema 与跨内容校验。

样式使用 CSS 自定义属性表达设计 Token。Tailwind 只保留为构建入口，不用大量工具类掩盖页面的排版关系。

## 关键实现

内容契约把文件名定义为稳定 slug，日期变化不会改变 URL。标签通过单一注册表规范化，专题从文章字段派生，并校验顺序必须从 1 连续递增。

从章程、内容契约到首页结构的早期取舍记录在 [从零搭建可维护的个人技术博客](/posts/building-a-maintainable-blog)，项目页保留验证结果，文章保留当时的判断过程。

正文使用 `react-markdown` 生成语义化 HTML，GFM 扩展负责表格与任务列表，rehype 统一生成标题锚点和代码高亮。文章、项目、专题和标签都从同一内容仓库查询，详情页不存在时返回真正的 404。

站内搜索在构建时把公开正文转换成轻量索引，在浏览器本地按标题、标签、摘要和正文加权匹配，不上传查询词。RSS、Sitemap 和 robots 与页面共用同一个公开内容索引，并根据请求主机生成绝对 URL。

文章与项目详情分别输出 `BlogPosting` 和 `SoftwareSourceCode` JSON-LD；根布局声明作者、规范 URL、RSS、Open Graph 和站点图标。`next.config.ts` 统一补充 CSP、HSTS、点击劫持防护、权限策略与 HTML 边缘缓存；Studio 和 OAuth 路由使用单独的 CSP、弹窗策略与 `no-store`。

GitHub Actions 把 action 自身运行时和应用运行时分开管理：checkout/setup-node v6 在 Node 24 上执行，setup-node 再显式安装 Node.js 22 并使用 npm lockfile 缓存。结构化 YAML 测试同时锁定只读权限、触发器、并发、命令顺序、production deployment-status 条件与 manual-only 回滚，避免平台维护升级暗中改变交付语义。

Studio 内容复核页复用正式维护报告，而不是在浏览器重写日期规则。动态 JSON 端点只映射已公开 Current 内容的标题、slug、状态、复核期限和两个安全导航目标，不返回正文、草稿或源文件路径；部署内容集合保持确定，报告日按请求时的 `Asia/Shanghai` 当天推进。浏览器严格核对版本、计数、日期、状态与 URL，再绘制 Review Horizon 和逐条账本；坏响应进入可重试失败态，不自动改日期或发送外部提醒。

Obsidian 插件用固定参数数组和 `shell: false` 在 Vault 根目录启动同一 `content:status`，把报告以 `setText` 写入原生只读 Modal；Windows 通过隐藏 `cmd.exe` 运行 npm，POSIX 直接运行 npm。发布、inbox 和维护命令共享活动进程账本与 200,000 字符输出边界，成功、错误、非零退出或插件卸载都会关闭持续 Notice；卸载在 Windows 以固定参数、无 shell 的 `taskkill.exe /T /F` 终止命令进程树，POSIX 直接终止子进程，并忽略迟到事件。报告不访问网络、不写内容，也不改变正式构建门。

视觉系统以 Commit Trace 为唯一主要识别元素，把日期、文章类型和项目里程碑连成一条工程轨迹。Evidence Rail 只显示可验证状态，不展示虚构的完成率。

详情页封面是仓库内的正式内容资产：`cover` 与 `coverAlt` 成对校验，服务端读取真实宽高，文章与项目共享 `next/image` 响应式组件；同一图片同时进入 Open Graph、Twitter 和结构化数据。Obsidian 会把 frontmatter 封面与正文附件放入同一压缩、归档和回滚事务，没有封面的内容保持原布局。

Markdown 正文图片复用同一个媒体描述器：服务端按 AST 中的 `/uploads/...` 引用读取真实宽高，本地图片由 `next/image` 按 48rem 阅读栏和移动端留白生成响应式候选，并保留作者填写的 alt。完整 HTTPS 外图保持明确降级，不进入开放远程优化白名单，只使用 lazy 原生图片、异步解码和 `no-referrer`；正文图片缺少 alt 会在构建前失败。正文图沿用 Evidence Rail 的直角描边与锈红信号边，不对技术截图施加深色滤镜。

## 问题与解决

### 把体积预算写成可复核公式

客户端体积预算不只是构建脚本里的常量，也是内容、字体与交互方案共同遵守的边界。记客户端资源总量为 $B_{\mathrm{client}}$，当前质量门要求 JavaScript、CSS 与字体的生产资源之和保持在 3 MiB 内：

$$
B_{\mathrm{client}} = \sum_i B_{\mathrm{JS},i} + \sum_j B_{\mathrm{CSS},j} + \sum_k B_{\mathrm{font},k} < 3\,\mathrm{MiB}
$$

公式沿用 Obsidian 的原生定界符，发布时在服务端生成可视 HTML 与 MathML；因此无 JavaScript 阅读、站内搜索和打印稿都来自同一份 Markdown。公式过长时只在屏幕阅读区横向滚动，不推动 320px 页面整体越界。

2026-07-19 根据维护目标把托管从 Cloudflare/Sites 迁移到 Vercel。迁移删除 Vinext、Vite、Worker、Wrangler 与 Sites 托管标记，恢复原生 `next dev/build/start`；原先 Worker 中的 Studio 静态资源、OAuth 与安全响应头分别迁入 App Router Route Handlers 和 Next.js headers。内容仍以 Git 为唯一事实来源，Obsidian 与网页后台产生的提交都会触发 Vercel 自动部署，因此迁移没有数据库或媒体数据搬运。

Cloudflare 阶段的初始模板 npm scripts 隐含了特定 shell，导致 Windows 开发失败。当时的命令被收敛为跨平台的 Vinext 入口，并用实际构建验证；迁移到原生 Next.js 后，同一约束继续由 `next dev/build/start` 保持。

这个故障后来沉淀为独立的 [Windows 下的跨平台 npm scripts](/posts/cross-platform-npm-scripts)，用于复用“脚本必须在真实目标 shell 中验证”的判断。

首版社交元数据需要部署域名对应的绝对 URL，但本地与 Cloudflare 主机不同。根布局因此优先读取显式站点地址，否则从代理请求头推导，并保留本地开发回退；这套主机推导在迁移 Vercel 后继续复用。

Cloudflare 阶段的框架默认给 HTML 返回 `no-store`，第一次缓存审计因此失败。Worker 当时对 HTML 显式使用 `max-age=0, s-maxage=3600, stale-while-revalidate=86400`，让浏览器每次复核、Cloudflare 边缘短期复用。Wrangler 干跑目录也曾被 ESLint 扫描并产生大量生成代码噪声；这些目录现在只作为历史产物保留，不进入当前 Vercel 构建路径。

生产依赖审计曾发现 Next.js 内部 PostCSS 版本存在中等级别公告；没有执行会降级框架的 `npm audit fix --force`，而是升级 Next.js 补丁版并将内部 PostCSS 最小覆盖到修复版本，再通过当时的完整构建和 Worker 测试验证兼容性。当前依赖已继续升级到 Next.js 16.3.0，并保持生产依赖审计为 0。

Sites 首次生产发布后，首页与集合页返回 200，但没有任何内容，Sitemap 也只剩 7 个基础 URL，因此所有详情统一返回 404。第一次把现象误判为参数化路由兼容问题；第二次发布证明显式路由包装不能修复空内容索引。根因收敛到 Worker 模块初始化时使用运行时时钟过滤发布日期；Cloudflare 版本随后改为在 Vite 构建时按 `Asia/Shanghai` 冻结日期。迁移 Vercel 后保留了确定构建日期契约，页面、搜索、RSS 与 Sitemap 仍共用同一内容集合。

真实浏览器验收在 320px 宽度下发现文章页有 15px 横向滚动。页面内容本身没有越界，原因是根 `html` 与 `body` 的 `20rem` 最小宽度仍按完整视口计算，而桌面 Chromium 的垂直滚动条把可布局宽度减到 305px。删除根最小宽度后，页面留白继续由 `.page-shell` 控制，首页、文章与搜索页的 `scrollWidth` 都与 `clientWidth` 相等；静态质量审计同时禁止这条规则回归。

## 结果证据

### Cloudflare / Sites 阶段（历史）

工程基线、内容契约、正式首页、响应式设计、深色偏好、分享卡与站点图标、结构化数据、内容校验管线、核心阅读路径、站内搜索与发布发现端点在首个阶段完成。当时的完整质量门通过 13 项单元测试、7 项 Worker 集成测试和 6 项发布审计；构建日期修复后，生产 Sitemap 包含 23 个 URL。2026-07-19 经用户明确授权后，Sites 访问策略切换为公开，无凭证 HTTP 与未登录浏览器完成 23/23 路由验收。

### Vercel 阶段（当前）

当前站使用原生 Next.js、GitHub 自动 Production 和稳定域名冒烟；Studio/Obsidian 双发布、内容维护、关系门与 Vercel 恢复均已验收。Iteration 0059 的完整门通过 204 项单元与集成测试、19 项生产测试和 45 个页面生成任务；裸远端拒绝后保留的三路径发布 commit、精确多路径身份、防重复发布、严格 JSON 降级和只读 Git 表面都有真实行为证据。项目保持 `maintained`，生产站公开且不依赖 Cloudflare。

## 复盘

先固定内容语义再写页面，减少了数据结构反向迁就视觉组件的风险。把设计状态绑定到真实工程证据，也让首页可以随着项目推进自然更新，而不需要维护一套营销文案。

## 下一步

下一轮为已经识别的精确 `content: publish <slug>` Commit Envelope 增加独立安全重送与可信回执：执行前后重新验证 commit/tree/blob、完整路径清单和本地 Git 表面，只推送已验证 OID，服务器拒绝或状态漂移时保留本地提交。自定义域名、公开邮箱、评论与统计保持可选。
