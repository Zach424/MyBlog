# Iteration 0043：Markdown 标题永久链接

## 1. 范围与成功标准

本轮只解决技术内容章节难以直接分享的问题。成功标准是：Markdown 正文 H2/H3 使用 `rehype-slug` 已生成的真实 id 输出原生 fragment 链接，不重新实现 slug；标题文本、目录目标、关系抽取和 H4–H6 不变；链接服务端渲染、无 JavaScript 可用、键盘可达；桌面 hover/focus/target 可发现，窄屏和所有无悬停触控设备至少有 44×44 点击区；中文、重复标题和浏览器编码 fragment 保持同一目标；深浅色可读、打印不输出标记；不增加客户端组件、Clipboard API、依赖或追踪。

## 2. 项目结构状态

- `components/MarkdownContent.tsx`：保持 Server Component，只为 Markdown renderer 的 H2/H3 注入 `MarkdownHeading`；链接、图片、代码、表格和插件顺序未改变；
- `components/MarkdownHeading.tsx`：新增服务端标题边界，按 level 输出 H2/H3，保留 children，并仅在 renderer 提供 id 时追加独立永久链接；
- `lib/heading-permalink.ts`：新增无框架状态的 fragment 与 Markdown 深度标记纯函数；
- `app/globals.css`：新增标题索引沟、hover/focus/target 信号、窄屏和 `hover:none` 触控常显、44px 点击区与打印隐藏；
- `tests/heading-permalink.test.mjs`：锁定原始 id、`##`/`###`、服务端边界、children 顺序、可访问名称、触控和打印契约；
- `tests/rendered-html.test.mjs`：用真实文章中文 H2 和真实项目中文 H3 锁定生产 HTML，确认 H4 不增强；
- `package.json`：把新契约测试加入既有单元门，没有新增依赖；
- `docs/STATUS.md`、`docs/ROADMAP.md`、`docs/DESIGN.md`、`docs/ARCHITECTURE.md`、`docs/QUALITY.md` 与本文：同步结构、设计、技术、功能、方法、验证、经验和下一轮主线；
- 内容 Markdown、目录生成、关系抽取、Studio、Obsidian、媒体、GitHub Actions 与 Vercel 配置均未修改。

## 3. 设计内容

永久链接被设计为“标题深度标记”，而不是通用链条图标。H2 使用 `##`，H3 使用 `###`，直接表达作者正在阅读的 Markdown 结构，也延续 Commit Trace 的等宽索引语言。第一遍评估否决了每级都显示同一个 `#` 的常见模板做法，因为它丢失了层级信息，并让技术博客看起来像套件默认值。

桌面标记位于标题左侧索引沟，默认使用 Faint 且不可见；标题 hover、链接 focus 或章节成为 `:target` 时出现，实际链接 hover/focus/target 再转 Signal。窄屏时标记放在标题文字之后，常显且为 44×44；最终复核又把同一规则扩展到所有 `(hover: none)` 设备，覆盖 800px 横屏平板。链接是标题 children 之后的兄弟节点，不包裹 children，因此作者在标题内写链接时也不会产生嵌套 `<a>`。打印隐藏标记，标题本身保留。

## 4. 使用的技术

- Next.js 16 / React 19 Server Component 与 react-markdown 自定义 H2/H3 renderer；
- rehype-slug 写入的 renderer `id`，原生 `<a href="#…">` 和浏览器 fragment 编码/`:target`；
- TypeScript 字面 level `2 | 3`、动态 `h${level}` 标签与纯函数；
- `aria-label="本节永久链接"`、`aria-hidden` 深度标记、原生键盘焦点与链接行为；
- CSS `:hover`、`:focus-visible`、`:target`、`@media (max-width: 42rem)`、`@media (hover: none)` 和 `@media print`；
- Node test、真实 Next production HTTP、Playwright CLI、Edge channel、JavaScript-disabled 和 print media；
- research-iteration-loop、frontend-design 与 playwright skills：分别约束单一主线和证据闭环、两遍视觉取舍、真实浏览器与打印/无脚本验收。

## 5. 实现的功能

- 每个 Markdown H2 自动获得 `##` 永久链接，每个 H3 自动获得 `###` 永久链接；
- 链接直接复用 renderer id，中文、重复标题序号及既有编码规则不产生第二套 slug；
- 点击链接把原生 fragment 写入地址栏并滚动到同一标题，用户可直接复制完整章节 URL；
- 键盘可以聚焦链接，焦点和当前目标使用现有 Signal 色；
- 桌面鼠标不持续增加视觉噪声，标题 hover 后即可发现；
- 320px 与任意 `hover:none` 触控环境常显，点击区为 44×44，页面无水平溢出；
- JavaScript 禁用时链接、href、滚动与目标高亮仍存在；
- 深色模式复用已有 Faint/Signal token；打印保留标题、移除 `##`/`###`；
- H4–H6、页面结构标题、目录和内容关系不获得新控件或新状态。

## 6. 实现方法

`MarkdownContent` 没有客户端化。rehype 插件先按原有顺序把 id 写入 Markdown heading props，自定义 H2/H3 renderer 再把该 id 原样传给 `MarkdownHeading`。组件只选择允许的 `h2`/`h3` 标签，并把 `children` 放在前面；有 id 时才追加带中文可访问名称的 anchor。`getHeadingPermalink` 只拼接 `#`，`getHeadingDepthMarker` 只按 level 重复 `#`，两者都不读取标题文本或参与 slug 生成。

CSS 在桌面把 anchor 绝对定位到标题左侧，标题本身提供定位上下文；H2/H3 只因原有上边距不同而使用不同 top。窄屏与无悬停设备把 anchor 恢复为相对位置并固定 2.75rem 宽和最小高。打印规则使用与基础规则相同的 `.markdown-content .heading-permalink` 特异性，确保 `display:none` 真正生效。

测试同时约束纯函数、源码边界和真实服务端 HTML。这样既证明实现没有意外引入 `use client`，也证明插件链确实把中文 id 送到最终 `<h2>/<h3>`；关系和目录仍由既有 markdown inventory 产生，没有依赖新增 DOM 链接。

## 7. 验证证据

- 完整 `npm run release:check`：Release 配置完整；Current 1/Historical 3/未公开 0；inbox 0；根暂存媒体 0；外链 2 URL/3 occurrences/0 issue；
- 同一候选通过 ESLint、124/124 单元测试、TypeScript、37/37 构建页面、17/17 真实生产 HTTP/质量测试与 production-only audit 0；`git diff --check` 通过；
- 真实服务端 HTML：文章中文 H2 精确输出 id、原题、`href="#同一 id"` 与 `##`，共 5 个 permalink；项目 H3 精确输出 `vercel-阶段当前` 与 `###`，共 11 个；H4 与页面关系区标题未增强；
- 桌面 1280px：默认 opacity 0，标题 hover 后显示 Faint，链接 hover/focus 与目标命中后为 Signal；键盘 `Shift+Tab → Tab` 可返回链接；中文 fragment 命中同一 `:target`；
- 320px：document width 等于 viewport，无水平溢出，标记常显且精确 44×44；浅色和深色截图均通过视觉复核；
- 800px 宽触控 context：`matchMedia('(hover: none)').matches=true`，position=relative、opacity=0.78、44×44、无水平溢出，证明横屏平板不依赖悬停；
- 无 JavaScript Edge context：服务端快照仍包含“本节永久链接”、原生 href 和 `##`；直接访问中文 hash 后浏览器滚动并以 Signal 命中目标。CLI 在禁用脚本 context 中对 element eval/click 会超时，因此没有用该自动化限制冒充页面失败；原生导航证据与 SSR 契约共同覆盖降级路径；
- print media：permalink 计算样式为 `display:none`，标题为 block，DOM 与目标 id 保留；
- 本地 production 控制台 0 error/0 warning；视觉截图保存在忽略目录 `outputs/playwright/iteration-0043`，不进入仓库；
- 实现提交 `1bd0793169521c6731fe3527345e9e89ef59b01c` 已推送 `main`；GitHub Quality Gate `30958657382` 与 Verify Vercel production `30958690310` 均 completed/success；
- GitHub Production deployment `5752937315` state=success，精确对应实现 SHA，部署 URL 为 `https://blog-mssqxrb4a-czq1.vercel.app`；
- 稳定生产域名冒烟：`24 routes, OAuth 302`；生产 Playwright 点击中文 `##` 后 URL 原生编码、`:target` 精确命中，控制台 0 error/0 warning；
- 网络代理只在对应检查进程内设置，未写入仓库或永久配置。

## 8. 经验与教训

- 永久链接应该复用 renderer 的 id，而不是从 children 再提取文本。后者会在重复标题、标题内链接、格式节点或 Unicode 变化时形成第二套 slug 事实源；
- 标题内作者链接是容易遗漏的 HTML 边界。把 permalink 放在 children 之后作为兄弟节点，比用 permalink 包裹整个标题更安全，也保留原标题语义；
- 可发现性不等于桌面 hover。只写窄屏媒体查询会遗漏宽屏触控设备，最终差异复核必须显式检查 `(hover: none)`，不能用 320px 结果代替触控能力证据；
- CSS 特异性也是功能契约。第一版通用 `.markdown-content a` 覆盖了 permalink 的 Faint 色，第一版打印 `.heading-permalink` 又输给基础选择器；两次都通过提高到相同作用域修正，并补充计算样式验证；
- `:target` 是原生、可链接且无脚本的状态源，适合做章节确认；没有必要为复制地址或目标高亮增加 Clipboard/Router 客户端代码；
- Markdown 深度标记比通用链条图标更符合本站的工程档案语言，同时避免新增图标资产和不可解释的视觉装饰；
- 无 JavaScript 自动化工具本身可能依赖页面执行环境。工具命令超时不等于原生页面交互失效，应以服务端 HTML、直接 URL 导航、目标命中和截图交叉判断；
- 构建后必须重启 production server 才能做视觉验收；跨构建存活的 Next 进程可能混用旧 CSS manifest，产生假回归。

## 9. 全局状态、风险与未解决问题

博客当前已经覆盖 Git-first 内容、Studio/Obsidian 双写作入口、媒体与链接完整性、搜索/Feed/知识地图、Vercel 自动交付/恢复、可访问代码复制和可分享章节永久链接。新增 permalink 完全服务端渲染，没有扩大客户端故障面；内容、目录和关系语义仍由原 Markdown 与同一 heading inventory 决定。

现存主要风险保持：Studio 不自动优化图片并依赖固定 Decap 3.14.1 契约；OAuth scope、CSP inline 例外、Hobby 回滚、外部网络假阴性、知识图扩容和内容复核仍需维护；自定义域名、统计、评论、公开邮箱与外部提醒仍等待所有者选择。读者侧新的直接缺口是打印只隐藏了 permalink 标记，尚未统一网页导航、事实栏、代码块、表格、长 URL、引用区和分页；浏览器“打印为 PDF”还不能被视为正式的技术记录输出。

## 10. 下一轮唯一主任务

为文章与项目详情页建立可打印、可导出 PDF 的技术文档版式。必须保留标题、内容事实、正文、代码、图片替代信息与必要引用，隐藏站点导航、目录交互、复制按钮和只服务网页浏览的邻接界面；控制标题、代码块与表格的分页，给外部链接提供纸面可辨来源，并保持屏幕样式、无 JavaScript 和客户端 bundle 不变。需要补齐 print CSS 契约、真实浏览器 print media、生成 PDF 的视觉复核、中文/代码/长 URL、浅深色来源、320px 回归与生产 HTML 验证。
