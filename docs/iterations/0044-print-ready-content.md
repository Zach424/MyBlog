# Iteration 0044：可打印技术内容

## 1. 范围与成功标准

本轮只解决文章与项目详情页无法作为可靠纸面技术记录的问题。成功标准是：浏览器打印和“另存为 PDF”得到标准 A4；保留标题、摘要、标签、事实、可信来源、封面、正文、代码、图片、表格、外链来源和必要站内引用；隐藏站点头尾、面包屑、目录、相邻内容、复制按钮和 permalink；标题不孤立，代码/图片/表格/引用分组不被任意切断，长代码与 URL 不裁切；屏幕、320px、无 JavaScript 和客户端 bundle 不变；必须从真实生产域名生成 PDF，渲染并检查全部页面。

## 2. 项目结构状态

- `components/ContentViews.tsx`：新增无客户端状态的 `PrintSource`，把详情页 canonical URL 作为纸面出处；
- `app/posts/[slug]/page.tsx`、`app/projects/[slug]/page.tsx`：分别把既有 `canonicalUrl`/`projectUrl` 传入来源组件；
- `app/globals.css`：新增 `@page`、作用域打印 token、详情页重排、界面隐藏、分页、代码/表格/外链/引用账本纸面规则；
- `tests/print-layout.test.mjs`：锁定服务端来源与 A4 打印契约；`tests/heading-permalink.test.mjs` 同步提高打印隐藏断言；`tests/rendered-html.test.mjs` 锁定两条真实详情路由的可信来源 HTML；
- `package.json`：把打印契约加入既有单元门；`.gitignore`：忽略 `output/` QA 产物；
- `output/pdf/` 保存本轮交付的两份生产 PDF，不进入 Git；`work/pdfs/iteration-0044/` 保存基线、渲染页和提取脚本，同样不进入 Git；
- 内容 Markdown、客户端组件、依赖、Studio、Obsidian、搜索、关系抽取和部署配置均未修改。

## 3. 设计内容

打印不是截图式网页，也不是第二套品牌。纸面使用 A4 白底和现有 Ink/Signal/Trace 色，标题先占完整版心，五列事实在其下排开，来源行明确记录生产 URL。第一版尝试标题与事实双栏，中文长标题被迫过早换行，最终改为全宽标题加五列事实；这比常见“报纸封面”更符合本站的工程档案语言。

正文 H2 使用 Signal 到 Rule 的双段上边线。最初沿用绝对定位伪元素，在分页边界出现脱离标题的“幽灵红线”；最终打印时隐藏伪元素，改用 `border-image`，让线与标题成为同一分页盒。代码由屏幕深色面板转换为浅色证据块并自动折行；关系账本只保留分组、标题和相对路径。站点框架、目录、复制和章节标记均不进入纸面。

## 4. 使用的技术

- Next.js 16 / React 19 Server Component 与已有 canonical URL；
- CSS `@page size: A4`、毫米页边距、`@media print`、打印颜色调整、`break-inside`/`break-after`/`break-before`、orphans/widows、重复表头与生成内容；
- react-markdown/rehype 输出的既有语义 DOM，没有单独的打印组件树；
- Node test 与真实 Next production HTTP；
- Playwright CLI + Edge channel 的 print media、计算样式、320px 屏幕回归、控制台与 `page.pdf()`；
- Poppler `pdfinfo`/`pdftoppm`、pypdf 文本提取和全页视觉复核；
- research-iteration-loop、frontend-design、playwright 与 pdf skills：分别约束单一范围/证据归档、版式取舍、真实浏览器验证和 PDF 全页渲染检查。

## 5. 实现的功能

- 文章和项目详情页可直接打印或导出为标准 A4 PDF；
- 每份纸面记录显示与部署环境一致的可信 canonical 来源，不依赖 `window.location`；
- 标题、摘要、标签、五列事实、项目资源、封面、正文、代码、图片、表格和站内引用保留；
- 站点头尾、面包屑、跳转链接、目录、相邻内容、复制按钮、隐藏状态与章节 permalink 被移除；
- 标题及首个后继内容避免跨页分离，代码/图片/引用/表格容器和表格行尽量整体保留；
- 长代码自动换行且不裁切，表格取消屏幕最小宽度并允许重复表头；
- 正文和项目资源的外部链接追加原始 URL，引用账本追加相对路径；
- 深色系统偏好在纸面强制回到可打印浅色 token，屏幕深浅色、交互和客户端 JavaScript 不变。

## 6. 实现方法

详情路由已经拥有可信 origin 派生的 canonical URL，因此只增加一个服务器组件输出 `<p class="print-source">`；基础样式隐藏它，打印媒体再显示。这样来源进入 SSR、测试和 PDF 文本层，不需要浏览器脚本，也不会把当前临时导航地址误当内容事实。

打印 CSS 在现有语义树上做单向重排：移除网页 shell，恢复全宽正文；内容头部由屏幕网格变为全宽标题和五列事实；封面使用窄 Artifact Rail 加自适应图片；阅读布局取消粘性目录。代码使用 `pre-wrap`/`overflow: visible`，表格清除 `min-width`，外链用 `attr(href)` 生成纸面地址。引用账本删除网页辅助说明、序号和箭头，只留下可验证的记录名称与路径。

测试分三层：源码契约证明来源仍是 Server Component；生产 HTML 证明两条详情路由输出可信测试 origin；真实浏览器切换 print media 检查最终计算样式并生成 PDF。PDF 再用 Poppler 确认 A4/page count、渲染每页，用 pypdf 验证标题/来源存在且网页导航文本不存在。

## 7. 验证证据

- 基线项目 PDF 为 Letter 8 页，包含站点头尾、面包屑、目录、重复“跳到主要内容”和大面积首页空白；最终生产 PDF 为文章 3 页、项目 5 页，均为 `594.96 × 841.92 pt` A4；
- 两份最终 PDF 共 8 页全部以 144 DPI PNG 渲染并逐页目视复核：没有裁切、幽灵线、空白页、重复导航或不可读代码；封面和正文图片清晰，末页正常留白；
- pypdf：文章 3 页/1691 字符、项目 5 页/5007 字符；两者标题和 `Source` 均存在，`跳到主要内容` 与导航文本均不存在；
- 真实生产 Edge print media：`matchMedia('print')=true`，来源显示且 href 为稳定生产域名，头尾/面包屑/目录/复制/permalink 为 `display:none`，五列事实、H2 `avoid-page`、双段边线、代码 `pre-wrap`/visible overflow 和白底均生效；控制台 0 error/0 warning（只有 Edge 图片懒加载 info）；
- 320px 屏幕回归：根宽度稳定，来源继续隐藏，站点头、目录、permalink 与代码复制保持原屏幕行为；
- 完整 `npm run release:check`：Release 配置完整；Current 1/Historical 3/未公开 0；inbox 0；根暂存媒体 0；外链 2 URL/3 occurrences/0 issue；ESLint、126/126 单元测试、TypeScript、37/37 构建页面、17/17 生产 HTTP 测试与 production audit 0 全部通过；
- 第一次完整门禁只因新增 HTML 断言误引用另一个测试作用域的 `visibleHtml` 而 16/17；改为当前响应的 `html.replaceAll(...)` 后，定向 10/10 与最终完整 17/17 通过。该失败保留为测试隔离经验，不属于产品回归；
- 实现提交 `df671ec91746d71c5af23be7a701b235992062ca` 已推送 `main`；Quality Gate `30961145805`、Verify Vercel production `30961173906` 均 completed/success；Production deployment `5753354034` state=success，部署 URL `https://blog-o3210dzc9-czq1.vercel.app`；
- 稳定域名生产冒烟为 `24 routes, OAuth 302`；最终 PDF 从 `https://blog-iota-five-59.vercel.app` 生成；网络代理仅设置在对应进程，未持久化。

## 8. 经验与教训

- 打印验收必须看真正 PDF 的每一页。DOM 计算样式无法发现首页空洞、标题孤立或跨页伪元素；仅看第一页也会漏掉末页引用和正文裁切；
- 纸面标题应先保证完整语义，再安排元数据。双栏在短英文标题上可能成立，但会伤害中文技术标题；全宽标题加五列事实更稳定；
- 绝对定位装饰不属于标题分页盒，分页时会留下幽灵线。`border-image` 把视觉信号绑定到真实标题盒，比额外 DOM 或伪元素更可靠；
- 打印来源必须来自服务器已信任的 canonical 计算，而不是客户端位置；本地预览、Preview deployment 与稳定生产域名因而都能得到各自正确来源；
- 代码的屏幕滚动策略不能直接用于纸面。打印必须主动取消 overflow 并换行，否则长命令会静默裁切；
- 引用账本的网页说明和动作不必全部打印，保留标题与路径反而更像可核验档案；
- Poppler 随运行时提供的 wrapper 指向错误的 `native/poppler/bin`，实际可执行文件位于 `Library/bin`；中文用户路径又让未使用的 Bulgarian/Greek/Thai 映射表发出警告，但进程成功、A4 元数据、PNG 和中文文本提取均正常，不能把无关 stderr 当成 PDF 失败。

## 9. 全局状态、风险与未解决问题

博客当前拥有 Git-first 内容、Studio/Obsidian 双写作入口、媒体与链接完整性、搜索/Feed/知识地图、Vercel 自动交付/恢复、代码复制、章节永久链接和完整 A4 纸面输出。打印实现只增加 SSR 来源与 CSS，不扩大客户端故障面，也不创建第二份内容数据。

现存风险保持：Studio 固定 Decap 3.14.1 且不自动优化图片；OAuth scope、CSP inline 例外、Hobby 回滚、外部网络假阴性、知识图扩容和内容复核仍需维护；自定义域名、统计、评论、公开邮箱与外部提醒仍等待所有者选择。PDF 是读者按需生成的派生物，不作为 Git 内容源或服务端缓存；任何影响详情 DOM/打印 CSS 的迭代都必须重新生成和全页复核。

## 10. 下一轮唯一主任务

支持 Obsidian 兼容的 Markdown 脚注/尾注。作者使用 `[^id]` 与定义记录技术证据，网页输出语义化编号、脚注区和返回正文链接；覆盖同一脚注多次引用、中文 id、脚注内链接/代码、键盘与屏幕阅读器、无 JavaScript、深浅色和 A4 分页。脚注定义不得污染搜索摘要、目录或内容关系；不接入外部服务。实现前先核对当前 unified/remark 官方解析能力与维护状态，再用真实 Obsidian 草稿、生产 HTML 和 PDF 验收。
