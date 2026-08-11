# Iteration 0131：受限 Mermaid 服务端 SVG

## 1. 范围与成功标准

本轮解决“作者能在 Obsidian/Studio 写结构化图表，但读者端不能依赖大型 Mermaid 客户端、远程字体或任意 SVG/HTML”的缺口。目标不是开放 Mermaid 全语法，而是把 `mermaid` fenced code 作为受限构建输入，在 Node 服务端生成可审计 SVG，并继续保留源码、搜索、Studio、深浅色、窄屏和打印语义。

成功标准：

1. 支持 flowchart/graph、stateDiagram、sequenceDiagram、classDiagram、erDiagram、xychart 六类；
2. 每篇数量、单张源码字节/行/单行、SVG 字节/元素/视窗和全文 SVG 总量都有硬门；
3. 拒绝初始化、点击链接、作者样式、HTML、危险 URL/CSS 表达式和未支持类型；
4. 固定版本服务端 renderer 的输出仍视为不可信，必须移除 style/外链并通过独立 HAST 白名单；
5. 重复图表的 SVG id 与 marker 引用不能冲突；
6. 读者端不发送 Mermaid JavaScript，不使用 `dangerouslySetInnerHTML`；
7. 读者页与 Studio 共享同一 rehype 转换，条目预检与构建契约在发布前失败关闭；
8. 搜索保留节点文字，公开 Markdown 与源码折叠保留原始 fence；
9. Evidence Rail、深浅色、390px、横向滚动、键盘焦点和打印行为明确；
10. 定向、全量、真实应用、真实浏览器和稳定生产 smoke 全部通过；
11. 更新七份全局中文文档、发布指南、本迭代与知识笔记，并与代码使用独立 Git 提交；
12. 不修改现有公开文章来制造演示，不引入 iframe、账号、数据库、追踪、Cloudflare 或额外云服务。

## 2. 项目结构状态

本轮新增：

- `lib/markdown-diagram.ts`：作者协议、六类识别、资源门、服务端渲染、SVG HAST 清理、id 命名空间与 figure 生成；
- `app/markdown-rich-content.css`：从全局文件迁出的 Callout 规则，以及图表 Evidence Rail、画布、源码、深浅色和打印规则；
- `tests/markdown-diagram.test.mjs`：六类、安全、预算、搜索、id、Studio/样式/打印接线；
- 本文件与 `docs/knowledge/0131-generated-svg-is-untrusted-compiler-output.md`。

本轮修改：

- `lib/content/markdown.ts`：补充 fenced code 的 `lang` 类型；
- `lib/content/contract.ts`：正式内容和 Studio entry preflight 都验证 Mermaid；
- `lib/markdown-pipeline.ts`：在 Callout 之后、slug/KaTeX/highlight 之前运行图表转换；
- `lib/studio-math-preview.ts`：预先验证、统计 `diagramCount` 并复用共享生产管线；
- `studio/math-preview.mjs`：fence-aware 触发、计数、`DIAGRAM / NEEDS FIX` 与竞态状态清理；
- `studio/preview.css`：与读者端一致的 SVG 变量、画布、焦点和源码；
- `app/layout.tsx`、`app/globals.css`：根布局加载富内容 CSS，并把全局文件从 98,801 B 降到约 95.7 KB；
- `scripts/smoke-production.mjs`：合成 POST 同时验证 Callout、两条公式和安全 Mermaid SVG；
- 内容契约、Studio、Callout、部署与真实应用测试；
- `package.json`/lock：固定 `beautiful-mermaid@1.1.3`、`hast-util-from-html@2.0.3`、`hast-util-sanitize@5.0.2`；
- 七份全局文档、发布指南与迭代索引。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

图表继续使用 Commit Trace / Evidence Rail：顶部 `DIAGRAM / FLOWCHART` 表达类型，右侧 Signal 节点与 `SERVER SVG` 表达派生方式；画布以 Paper/Trace 网格承载图形，不做圆角卡片、阴影或第三方白底嵌入。SVG 保持固有宽度，宽图只让 `.markdown-diagram-canvas` 横向滚动，避免缩小到文字不可读或撑宽页面。

底部原生 `<details>` 固定显示 `MERMAID SOURCE / 查看源码` 和两位顺序号。读者可以核对、复制和迁移源码；无 JavaScript 时仍能展开。SVG 有图表类型无障碍名称，画布声明可横向滚动并可聚焦；源码摘要有独立焦点。打印保留 SVG、移除网格并隐藏重复源码。

真实浏览器第一次截图发现 edge label 为黑底：清理上游 `<style>` 后，标签 rect 仍使用 `fill="var(--bg)"`，但页面只定义了 `--diagram-bg`。修复不是恢复上游 style，而是在图表局部显式把 `--bg/--fg/--line/...` 映射到博客 token。第二次桌面、390px 与暗色截图确认标签、节点、箭头、滚动条和焦点正确。

## 4. 使用的技术

- Next.js 16.3、React 19 Server Components 与既有 `react-markdown`；
- unified、remark-parse/GFM/rehype 与 HAST；
- `beautiful-mermaid` 1.1.3 的纯 Node/零 DOM 同步 SVG renderer 与 ELK；
- `hast-util-from-html` 2.0.3、`hast-util-sanitize` 5.0.2；
- TypeScript 判别联合、TextEncoder 字节计数与后序树遍历；
- 原生 `<figure>`、`<figcaption>`、`<details>`、`<summary>` 与内联 SVG；
- CSS custom properties、`color-mix()`、`:focus-visible`、暗色媒体查询与打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests；
- Playwright CLI 真实浏览器截图、交互、viewport、color-scheme 与计算样式检查；
- Vercel 稳定生产端点与 27 路由完整 smoke；
- `research-iteration-loop`、`frontend-design`、`playwright` 与 memory retrieval 工作流。

实现前完整阅读了仓库 Next 16.3 的 CSS、Server/Client Component 本地说明；上网核对 Mermaid CLI、beautiful-mermaid 与 HAST sanitizer 官方资料。Mermaid CLI 依赖 Chromium/Puppeteer，不符合 Vercel 运行时和无浏览器目标；beautiful-mermaid 1.1.3 是 MIT、纯 TypeScript、零 DOM，但仍不被当作安全边界。

## 5. 实现的功能

1. 大小写不敏感识别 `mermaid` fence，并保留 fence 起始行；
2. 支持六类图表和 graph/flowchart、state v2、xy beta 别名；
3. 拒绝 `%%{}`、click、style/classDef/linkStyle、`:::`、HTML、危险协议与 CSS URL；
4. 每篇最多 8 张，单张 8192 字节/160 行/500 字符单行；
5. 单张 SVG 最多 240000 字节/1800 元素，视窗边长 12000、面积 36000000，全文 SVG 最多 800000 字节；
6. renderer 语法错误压缩为最长 240 字符的可定位诊断；
7. SVG 只保留必要 shape/text/defs/marker 标签与坐标、颜色、变换、marker 属性；
8. 删除 style、script、foreignObject、a、image、use、iframe、href、事件属性和远程 namespace 字符串；
9. `diagram-N-*` 重写 SVG id 与 `url(#...)` 引用；
10. 输出 server-rendered figure、类型 rail、可聚焦滚动画布和可展开源码；
11. Studio 只对潜在图表请求同源端点，成功分别报告公式/信息块/图表数量，失败显示图表身份；
12. Studio entry preflight 与正式内容 build 在保存/部署前拒绝不安全图表；
13. 搜索继续索引 Mermaid 节点/标签源码，普通 code fence 保持原样；
14. 公开 Markdown 继续保留原始 fence，Obsidian round-trip 不依赖 SVG；
15. 深浅色、390px、横向滚动、键盘焦点、源码折叠和打印均有契约；
16. 生产 smoke 验证 `diagramCount: 1`、flowchart/server-svg 标志以及图表片段没有外链/style/foreignObject。

## 6. 实现方法

先写失败测试：图表定向测试因缺少 `lib/markdown-diagram.ts` 失败，Studio 测试因缺少 `hasPotentialStudioDiagram` 失败。这证明转换与作者触发两个边界都不存在。随后实现最小共享模块，并让内容契约在页面渲染前调用同一完整 render+sanitize 路径；无效输入不会等到 React 或浏览器才失败。

renderer 返回的“自包含 SVG”含 Google Fonts `@import`、内嵌 `<style>` 与 root style 变量。本轮没有试图正则清理 HTML 字符串后直接注入，而是先解析为 HAST，用显式 schema 复制安全树；style 整棵删除，颜色派生改由站点 CSS 负责。这样 CSP 不需要新增远程 font/style source，作者输入也不能扩大标签/属性集合。

Next typegen 首次失败：上游 package exports 只有 `import`/`bun`/`types`，Next 配置加载期的条件找不到 main。固定版本包内 ESM 路径后，Node 定向测试、Next typegen/TSC、Turbopack 和 Vercel build 全部通过。该兼容点写入文档和升级门，不能靠修改 `node_modules` 临时掩盖。

全局 CSS 原本 98,801 B，直接加入图表会越过 100 KB 门。把真正跨页面共享的 Callout 规则连同新图表规则迁到根布局单独导入的 `markdown-rich-content.css`；旧 Callout/打印测试同步指向新文件。全局 CSS 最终约 95.7 KB，没有调高预算。

视觉验收不改公开文章。Playwright 打开真实生产构建文章页，再从同源 Studio endpoint 取合成 Mermaid HTML放入现有 Markdown 容器，检查同一 CSS/DOM。演示内容只存在浏览器会话与截图，不写入公开 Markdown。

## 7. 验证证据

- 失败优先：图表测试因模块不存在 0/1；Studio 因导出不存在 0/1；
- 定向实现：图表 5/5；内容契约、Studio、Callout、部署共 30/30；
- `npm run test:unit`：541/541；`npm run test:diagram`：5/5；
- `npm run typecheck`：通过；首次失败的 package exports 条件已记录并修复；
- `npm run lint`：通过；
- `npm run build`：通过，66 个生成页面；
- `npm run test:app`：35/35，十三条 HTML 与十一个发现预算全部 PASS；
- `npm audit --omit=dev --audit-level=high`：0 漏洞；
- `git diff --check`：通过；`app/globals.css` 约 95.7 KB；
- Playwright：桌面宽图、390×844、浅色/深色、源码点击、Shift+Tab 画布焦点；控制台 0 error，只有 Next CSS preload warning；
- 视觉失败修复：第一张截图 edge label 黑底；补齐局部变量后桌面/移动/暗色截图通过；
- 功能提交：`bbf1ec1`（`feat: render constrained Mermaid diagrams`），已推送 `main`；
- 第一次生产 smoke 命中旧部署，准确失败于“Studio 增强 Markdown 生产管线预览不可用”；
- Vercel 切换后生产 smoke：27 routes、OAuth 302，十三条 HTML 与十一个结构化发现端点全部 PASS；
- 生产合成 POST 已证明 `calloutCount: 1`、`formulaCount: 2`、`diagramCount: 1` 和安全 SVG；
- 公开内容集合、Feed/Schema/清单正文未改变，不重置稳定生产预算基线。

## 8. 经验与教训

1. “server-rendered”不等于“trusted”；生成 SVG 仍是编译器输出，必须有独立 sanitizer；
2. 删除上游 style 之后要清点所有输出变量消费者，视觉截图能捕获字符串测试看不到的 fallback；
3. renderer 的资源门要同时约束输入与输出，单独限制源码字节不足以控制布局器；
4. SVG id 是文档级命名空间，单图测试不会发现多图 marker 冲突；
5. 保留原始 fence 比把 SVG 当发布源更适合 Obsidian、搜索、公开 Markdown 和故障排查；
6. Studio 浏览器端 detector 只负责节省请求，服务器端共享管线才决定正确性；
7. 服务端渲染避免 hydration flash、客户端 bundle、CSP 放宽和无 JavaScript 降级问题；
8. 任意作者样式和 click 指令会把主题、安全与可访问性边界重新交给内容，第一版应明确拒绝；
9. 上游包 exports 是构建系统契约的一部分，Node 单测通过不能替代 Next typegen/build；
10. CSS 硬门迫使共享规则迁出巨型 globals，而不是用提高预算掩盖结构问题；
11. 合成生产 POST 可以证明未来内容能力，不必为了展示功能改写历史文章；
12. 第一次 smoke 失败是部署切换证据，不应通过重试逻辑吞掉；稳定端点出现新字段后再通过才可信；
13. 视觉测试应该包含有 edge label 的图，而不只是最简单 `A --> B`；
14. HAST 白名单应靠六类真实输出联合收敛，不照抄通用 SVG 属性全集；
15. 迭代、状态、发布指南和知识笔记继续与代码位于同一 Obsidian Vault/Git 历史。

## 9. 全局状态、风险与未解决问题

作者现在可从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、数学公式、Callout 和六类 Mermaid 图表，Git/Vercel 自动上线。Mermaid 没有客户端运行时、远程字体、raw HTML、点击链接或自定义主题；源码可搜索、可展开、可公开下载。

固定 `beautiful-mermaid` 1.1.3 包内路径是明确的版本耦合，任何升级必须重审 exports 与 SVG 输出。虽然生产依赖审计为 0 漏洞，renderer/ELK 的复杂输入仍可能消耗构建 CPU；现有数量、源码、行、SVG 与元素上限降低风险，但不是通用 Mermaid 沙箱。当前只支持六类，mindmap、gantt、pie、Git graph、C4、Sankey 等继续返回明确错误。

首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需所有者操作或决策，不阻塞当前生产。富内容剩余主要缺口是视频；它涉及托管、隐私、字幕、带宽和打印，不能与 iframe 自动一起开放。

## 10. 下一轮唯一主任务

为视频内容建立受限发布决策与最小实现边界：比较仓库本地视频、外部直链和第三方播放器，先确定隐私、字幕/文字替代、体积/带宽、Vercel/Git 限制、移动端、打印、Studio/Obsidian 与生产 smoke。只有证据支持时才实现原生 `<video>`；不得默认开放 iframe、追踪播放器、自动播放或不受限远程媒体。
