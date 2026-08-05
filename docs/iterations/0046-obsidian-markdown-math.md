# Iteration 0046：Obsidian 兼容 Markdown 数学公式

## 1. 范围与成功标准

本轮只解决技术文章与项目记录无法从 Obsidian 直接发布数学公式的问题。成功标准是：作者使用 `$...$` 与 `$$...$$` 编写行内/块级公式，生产网页在服务端生成可访问 HTML + MathML，不依赖 CDN、运行时服务或客户端公式脚本；无效公式在发布前带正文行号失败；代码、转义金额和公式内的伪链接/伪图片不污染内容关系、媒体与外链库存；公式源码可进入本地搜索；长公式在 320px 只滚动自身并支持键盘，深浅色、无 JavaScript 和 A4 打印都稳定；依赖版本、许可、安全选项和客户端资产预算有官方边界与实测证据。

## 2. 项目结构状态

- `lib/content/markdown.ts`：由 GFM-only 解析器升级为 GFM + math 的共享服务端 AST，公开 node/walk，统一标题、关系、外链、图片与公式抽取；
- `lib/markdown-math.ts`：集中声明 KaTeX 输出/安全/资源选项，并逐条预解析公式、返回正文行号和紧凑错误；
- `lib/content/contract.ts`：文章与项目在 frontmatter/body 成形后立即执行公式门禁，错误进入原 `ContentValidationError`；
- `components/MarkdownContent.tsx`：Server Component 加入 `remark-math`、`rehype-katex` 和本地 KaTeX CSS，块级公式包装为可聚焦滚动 region；
- `lib/content/external-links.ts`、`lib/content/media-references.ts`：删除各自的第二份 parser/walker，复用共享 math-aware AST；
- `lib/search-index.ts`：新增服务端 Markdown AST→纯文本/搜索文档层，保留 text、代码、公式与图片 alt，移除脚注引用和 HTML；
- `lib/search.ts`：只保留 `SearchDocument`、匹配、排名和摘要等浏览器端轻逻辑，避免解析器与 KaTeX 进入搜索客户端岛；
- `app/search/page.tsx`：从服务端索引模块生成公开文档；
- `app/globals.css`：加入行内公式、calculation strip、焦点、水平溢出、深色 Token 与打印规则；
- `content/projects/myblog.md`：用真实客户端资源预算补充一条行内公式和一条块级公式；
- `docs/PUBLISHING.md`：加入作者语法、金额转义、代码边界、构建失败与长公式打印提醒；
- `tests/markdown-math.test.mjs`：新增四项公式契约，现有 search/footnote/print/production HTML 契约同步扩展；单元测试总数从 130 增至 134；
- `package.json`/lock：精确固定 `remark-math@6.0.0`、`rehype-katex@7.0.1`、`katex@0.16.47`、`micromark-extension-math@3.1.0`、`mdast-util-math@3.0.0`；
- Studio、OAuth、Obsidian 发布事务、内容 schema 字段、路由、Feed 与部署配置未修改。

## 3. 设计内容

公式没有做成通用圆角卡片或第三方 embed，而是 Evidence Rail 中的 calculation strip。行内公式贴合正文基线，只用 Trace 下规则提示其技术语义；块级公式使用 Paper 底色、上下 Trace 规则和等宽 `CALCULATION / MODEL` 眉题，视觉公式居中。它与代码证据块、脚注证据账本共享 Ink/Signal/Trace/Paper Token，但保留自己的“推导/预算”语义。

块级公式 region 有中文 `aria-label`、`tabIndex=0` 和 Signal 焦点轮廓。桌面公式在 48rem 阅读栏中完整居中；320px 时条带保持 288px，内部公式为 387px 并独立横向滚动，不增加页面根宽；深色只替换 Token。打印取消滚动、缩小到 0.86em、保留眉题与上下规则，并以 `break-inside: avoid-page` 保持推导条带完整。

## 4. 使用的技术

- Next.js 16.3.0 / React 19.2.6 Server Component；
- `react-markdown@10.1.0`、`remark-gfm@4.0.1`、`remark-math@6.0.0`；
- `rehype-katex@7.0.1` 与 `katex@0.16.47`；
- `micromark-extension-math@3.1.0`、`mdast-util-math@3.0.0` 与现有 GFM mdast；
- KaTeX `output: htmlAndMathml`、`strict: error`、`trust: false`、`maxSize: 20`、`maxExpand: 1000`、`throwOnError: true`；
- 本地 package CSS/font、CSS overflow/print media、MathML 与 TeX annotation；
- Node test、真实 Next production HTML、Playwright CLI + Chromium、pypdfium2 全页 PDF 渲染；
- research-iteration-loop、frontend-design、playwright 与 pdf skills 分别约束单一可回滚范围、非模板化视觉、真实浏览器验证和 PDF 全页目检。

维护与安全边界只引用维护方资料：[Obsidian Advanced formatting syntax](https://obsidian.md/help/advanced-syntax) 定义 `$...$`/`$$...$$`；[remark-math 官方仓库](https://github.com/remarkjs/remark-math) 给出 `remark-math` + `rehype-katex` 的统一处理链并采用 MIT 许可；`rehype-katex@7.0.1` 的[官方 manifest](https://raw.githubusercontent.com/remarkjs/remark-math/main/packages/rehype-katex/package.json)声明 `katex: ^0.16.0`，所以本轮固定该兼容线的 `0.16.47`，没有强行切到当前 KaTeX 网站展示的 0.18 系列；[KaTeX options](https://katex.org/docs/options) 说明 HTML + MathML、trust 与资源上限，[KaTeX security](https://katex.org/docs/security) 说明 `trust` 命令和资源限制的威胁边界。所有新增直接依赖均为 MIT，不引入外部字体/CDN。

## 5. 实现的功能

- 行内 `$B_{\mathrm{client}}$` 与块级 `$$...$$` 可直接从 Obsidian/GitHub 发布；
- 公式在服务端输出可视 KaTeX HTML、MathML 和 `application/x-tex` annotation；视觉层对辅助技术隐藏，MathML 保留语义；
- 块级公式是命名 region，可聚焦并用方向键横向滚动；
- 发布/构建在页面渲染前逐条调用 KaTeX，括号或命令错误带正文行号失败；
- `trust: false` 禁止作者公式启用可加载资源或改写属性的可信命令，尺寸与宏展开有固定上限；
- 标题中的行内公式按同一 TeX 值进入 renderer-equivalent slug；
- 公式里的 `[text](/posts/...)` 与 `![alt](/uploads/...)` 只是 TeX 字符，不形成站内关系、外链或媒体所有权；
- 行内/围栏代码中的 `$...$` 保持代码，普通未闭合 `$5` 保持文本，作者可用 `\$` 明确转义金额；
- 搜索保留 `B_{\mathrm{client}}`、`B_i` 等公式源码；浏览器端搜索 bundle 不包含 Markdown parser 或 KaTeX；
- 真实 MyBlog 项目页展示客户端资源总量 `< 3 MiB` 的计算模型，`/search?q=B_i` 可找到该项目；
- 320px、深色、无 JavaScript 与 A4 纸面均由同一 Markdown/服务端 DOM 派生。

## 6. 实现方法

解析层先收敛为单一 `parseMarkdown`：micromark 同时安装 GFM 与 math extension，mdast 同时安装对应 from-Markdown 扩展。关系、外链和图片抽取不再自行构造树，因此新增语法不会在不同校验器中产生相互矛盾的 token 边界。公式抽取只访问 `inlineMath`/`math` node，代码 node 和普通 text 不进入验证器。

内容契约在 `parseFrontmatter` 已验证正文非空后调用 KaTeX 预解析。验证器复用与 renderer 完全相同的选项，捕获错误后移除控制字符、压缩空白并限制 240 字符，避免构建日志失控；正文行号来自 mdast position。renderer 仍是 Server Component：remark 识别公式，rehype 在 React 生成前转换为 KaTeX DOM；package CSS 由 App 构建本地打包，CSP 既有 `font-src 'self'` 覆盖字体。

搜索按执行环境拆层：`search-index.ts` 递归读取 AST，将 block node 加空格、保留 text/inlineCode/code/inlineMath/math/image alt，跳过脚注引用和 HTML，再压缩空白；`search.ts` 只做 NFKC/小写归一化、AND 匹配、加权排名和摘要。这既比旧正则更准确，也避免服务端解析依赖进入 `SearchExperience` 客户端岛。

## 7. 验证证据

- 定向 math/search/footnote/relations/media 为 24/24；最终 `npm run release:check` 通过：release 配置、Current 1/Historical 3/未公开 0、inbox 0、根暂存 0、外链 2 URL/3 occurrences/0 issue、ESLint 0 warning、134/134 单元、TypeScript、37 个页面、17/17 生产 HTTP、production audit 0；
- 生产 HTML：项目页含 1 个块级公式、1 个行内公式、2 个 MathML 节点、TeX annotation、`aria-hidden` 视觉层和 1 个命名/可聚焦滚动 region；公式未进入 code block；`/search?q=B_i` 命中 MyBlog；
- 客户端产物：JS 609,752 B、CSS 102,870 B、本地 KaTeX 字体 1,076,572 B，三类合计 1,789,194 B，小于 3 MiB；与公式前相比没有增加 JS；
- 真实 Chromium 浅色桌面：`clientWidth=scrollWidth=1280`，公式 `768=768`，1 display/1 inline/2 MathML，控制台 0 error/0 warning；
- 真实 Chromium 320px 深色：根宽 `320=320`，公式 `scrollWidth=387 > clientWidth=288`，键盘方向键使 `scrollLeft 0→2`，公式色 `rgb(237,244,245)`、Paper 背景 `rgb(23,35,45)`；
- 320px 深色无 JavaScript：HTTP 200、1 display/2 MathML、根宽 `320=320`；生产内容无需 hydration 才可读；
- print computed style：公式 `overflow-x: visible`、`break-inside: avoid-page`；项目 PDF 为 5 页、1,419,213 B，pypdfium2 以 1.5 倍渲染全部 5 页并逐页目视确认公式完整、未裁切、未跨页，标题/来源/封面/正文/关系账本分页正常；
- 实现提交 `7c46cf5fdce1c2926bba56b22353a19fcd6f217e` 已推送 `main`；Quality Gate `30966993482` completed/success。归档提交后继续等待并记录最终 Vercel production verification 与稳定域名冒烟。

失败与修复证据：第一轮 production HTML 断言错误地依赖 KaTeX `class`/`aria-hidden` 属性顺序，改用同一元素上的前瞻断言。更重要的是，首次增量 `next build` 虽成功，但真实浏览器显示 320px 根宽被公式撑到 419px；检查发现源码已有 `overflow-x: auto`，生产 CSS 却仍是旧的 62,614 B chunk。将已验证位于仓库内的 `.next` 移出工作区后做干净构建，暴露 `node_modules/sharp` 目录意外为空；重新按锁定版本安装 `sharp@0.35.3` 后，干净构建生成包含新规则的 78,434 B global CSS，移动端根宽恢复 320px。该过程没有删除作者文件，旧缓存被移到系统临时目录。

## 8. 经验与教训

- 公式支持不是“加两个插件”即可完成；renderer、内容契约、关系、媒体、外链、标题、搜索、移动与打印必须共享同一 token 边界，否则公式文本会被其他子系统误认；
- KaTeX 的 MathML 是可访问输出，不应只用视觉截图判断。最终 HTML 要同时验证 MathML、TeX annotation 和视觉层 `aria-hidden`；
- 安全边界应在构建期和 renderer 使用同一组选项。只在页面渲染时 `throwOnError` 会把作者错误推迟到请求期，也无法给发布器稳定行号；
- 搜索解析可以放在服务端，而排名继续留在客户端。按责任拆文件比继续堆正则更准确，也不会牺牲浏览器 bundle；
- 横向滚动容器必须真实测量 `documentElement.scrollWidth` 和自身 `scrollWidth/clientWidth`。看到公式被裁在截图中不等于溢出被正确包含；
- 可聚焦 scroll region 的键盘行为要实测。`tabIndex`、ARIA 名称和 CSS 焦点只是前提，方向键确实改变 `scrollLeft` 才是完成；
- 增量生产构建成功不保证样式产物包含源码变化。高风险 CSS 边界出现矛盾时应比较源码、chunk 大小和 computed style，并做一次经过路径核对的干净构建；
- 干净构建会暴露缓存掩盖的依赖损坏。本轮空 `sharp` 目录说明“缓存命中可构建”不能替代锁文件可重装性；精确重装后必须再跑完整发布门；
- PDF 的 DOM/print CSS 断言不能替代纸面。公式字体、缩放和分页只有逐页渲染才能确认。

## 9. 全局状态、风险与未解决问题

博客现在拥有 Git-first 内容、Studio/Obsidian 双作者入口、发布就绪与媒体/链接完整性门、搜索/Feed/知识地图、Vercel 自动交付/恢复、代码复制、章节永久链接、Obsidian 脚注、Obsidian 数学公式和完整 A4 输出。公式实现增加本地构建依赖与字体资产，但不增加公式客户端脚本、CDN、数据库或外部运行时；现有 3 MiB 客户端产物预算仍有约 1.21 MiB 余量。

现存风险保持：Studio 固定 Decap 3.14.1 且不自动优化图片；OAuth scope、CSP inline 例外、Hobby 回滚、外部网络假阴性、知识图扩容和内容复核仍需维护；自定义域名、统计、评论、公开邮箱与外部提醒仍等待所有者选择。公式新增风险是：网页 Studio 默认预览尚不渲染 KaTeX；非常宽的打印公式没有通用自动断行，本轮以缩放和真实五页夹具验证当前内容；KaTeX/remark-math 升级必须重新核对声明的主版本兼容线、CSS/字体体积、安全选项与 MathML DOM。

## 10. 下一轮唯一主任务

补齐网页 Studio 的数学公式作者预览。作者在 Studio 正文编辑器输入 `$...$` 与 `$$...$$` 时，应得到与生产阅读端一致或明确说明差异的预览/错误反馈；不得建立第二份内容契约、外部 CDN、数据库或全站客户端公式脚本。先核对固定 Decap 3.14.1 的 preview template/Markdown renderer 扩展边界，再验证新建与编辑条目、无公式内容回归、深浅色、长公式和作者可恢复错误。
