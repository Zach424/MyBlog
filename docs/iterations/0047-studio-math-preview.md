# Iteration 0047：Studio 数学公式作者预览

## 1. 范围与成功标准

本轮只补齐网页 Studio 的数学公式作者预览，不改变 Git 内容事实源、公开内容 schema、Obsidian 发布事务或生产阅读交互。成功标准是：普通 Markdown 继续使用 Decap 原生预览且不发请求；含 `$...$` / `$$...$$` 的正文经同源端点重放生产 remark/rehype/KaTeX 规则；有效公式显示明确验证状态和 HTML + MathML，错误带正文行号并保留原 Markdown；网络失败可恢复；快速输入不会让旧响应覆盖新草稿；长公式在 320px 只滚动自身、支持键盘并适配深浅色；预览不引入外部 CDN、数据库、第二份内容契约或公开页面客户端公式脚本；端点有同源、类型、体积、缓存、索引和危险 URL 边界。

## 2. 项目结构状态

- `lib/markdown-pipeline.ts`：集中生产阅读与 Studio 共用的 remark、rehype、脚注、KaTeX、代码高亮和安全 URL 规则；
- `components/MarkdownContent.tsx`：从共享管线读取插件/选项，并显式使用同一 URL transform；
- `lib/studio-math-preview.ts`：先复用构建期公式门，再通过 unified 输出预览 HTML，补充块级公式 region 语义并清空危险协议；
- `app/studio/math-preview/route.ts`：同源、JSON-only、100,000 B、`no-store`/`noindex` 的 POST 预览端点；
- `studio/math-preview.mjs`：Decap posts/projects 自定义 preview template，提供防抖、取消、latest-wins 与普通 Markdown 降级；
- `app/studio/math-preview.mjs/route.ts`：同源提供版本受仓库管理的作者端预览模块；
- `lib/studio-assets.ts` 与 `app/studio/katex-0.16.47.css/route.ts`：构建时读取固定 KaTeX CSS，把 20 个 WOFF2 字体转成内联 data URL，并以版本化不可变路由提供；
- `studio/preview.css`：加入 AUTHOR PROOF 头、公式状态证据条、长公式焦点/滚动、深色和窄屏规则；
- `studio/index.html`：在 CMS 初始化前注册公式模板并补齐 favicon；
- `studio/config.mjs`：文章/项目正文提示加入公式语法、raw Markdown 与生产规则预览说明；
- `scripts/smoke-production.mjs`：线上烟测新增预览模块、内联字体 CSS 和真实公式 POST；
- `next.config.ts`：输出追踪包含 KaTeX CSS/WOFF2，版本化 Studio 字体 CSS 使用 immutable 缓存；
- `tests/studio-math-preview.test.mjs`：覆盖注册、请求边界、状态、快速变更、卸载取消与回退；生产质量测试覆盖全部 HTTP 状态、安全 URL 和真实 KaTeX/MathML；
- `docs/PUBLISHING.md`：补齐作者操作、状态解释、失败恢复与发布门边界；
- `package.json`/lock：精确固定 `unified@11.0.5`、`remark-parse@11.0.0`、`remark-rehype@11.1.2`、`rehype-stringify@10.0.1`；
- 公开路由、内容字段、OAuth 协议、媒体上传事务、搜索和 Feed 没有改变。

## 3. 设计内容

Studio 预览不是复制公开站首页，也不是通用圆角卡片。预览顶部以 `AUTHOR PROOF / GIT DRAFT` 标明它是作者证据，不是已发布页面；标题和摘要保持正文排版，下面用固定状态条显示 `STANDARD / MARKDOWN`、`FORMULA / CHECKING`、`FORMULA / VERIFIED`、`FORMULA / NEEDS FIX` 或 `FORMULA / PREVIEW UNAVAILABLE`。状态、标题、说明三层分别回答“当前模式、是否可按生产规则渲染、下一步怎么做”。

公式本身继续沿用公开阅读的 calculation strip 与 Paper/Ink/Signal/Trace Token，避免预览和正文出现第二套视觉语义。错误状态用 Signal 左轨和 `role=alert`，检查/成功/不可用使用 live status；正文预览始终在状态下方，错误或网络失败回退为 Decap 原生 Markdown，不用模态层阻断编辑。320px 的壳体以全局 `border-box` 保持根宽，长公式在 288px 内容区内独立滚动，命名 region 可聚焦且方向键有效；深色只替换既有 Token。

## 4. 使用的技术

- Next.js 16.3.0 App Router Route Handler、React 19.2.6 与 Node runtime；
- Decap CMS 3.14.1 `registerPreviewTemplate` 自定义作者预览；
- `unified`、`remark-parse`、`remark-gfm`、`remark-math`、`remark-rehype`、`rehype-slug`、`rehype-highlight`、`rehype-katex`、`rehype-stringify`；
- KaTeX 0.16.47 的受限 HTML + MathML 渲染和本地 WOFF2；
- `AbortController`、240 ms 防抖、单调 generation 与 same-origin `fetch`；
- CSP 下的同源 ESM、`no-store` 动态 JSON、immutable 版本化字体 CSS；
- Node test、TypeScript、Next production HTTP、Playwright CLI + Chromium；
- research-iteration-loop 把范围限制为一个可回滚作者预览缺口并要求证据/风险归档；frontend-design 把反馈收敛成 AUTHOR PROOF 与 Evidence Rail 状态条；Playwright 用真实 Chromium 找到并复验 320px 根溢出、键盘滚动和 console 边界。

扩展边界以维护方资料为准：Decap 官方的[自定义预览](https://decapcms.org/docs/customization/)提供 `registerPreviewTemplate`，而[编辑器组件与 Markdown widget](https://decapcms.org/docs/widgets/)说明预览扩展入口；[remark](https://github.com/remarkjs/remark)、[rehype](https://github.com/rehypejs/rehype) 与 [remark-rehype](https://github.com/remarkjs/remark-rehype)说明 Markdown→mdast→hast→HTML 的处理链。固定 Decap 3.14.1 的默认 Markdown 预览没有可靠暴露本项目所需的插件边界，因此本轮使用官方 preview template，并在服务端重放共享生产管线，而不是向固定编辑器包注入另一套 parser。

## 5. 实现的功能

- posts 与 projects 共用一个幂等注册的公式作者预览；
- 正文不含 `$` 时零请求，继续显示 Decap 原生 Markdown；
- 检测到潜在公式后等待 240 ms，只把当前正文 POST 到同源端点，不保存、不发布；
- 输入再次变化、组件卸载或新请求开始时取消旧定时器/请求，旧代次结果即使晚到也不能改写当前状态；
- 有效正文返回公式数量、KaTeX HTML、MathML 与 `data-studio-renderer="production-pipeline"` 证据；
- 无效公式返回 422、正文行号和紧凑 KaTeX 错误，界面显示 `NEEDS FIX` 并保留 Markdown；
- 服务暂不可用时显示可恢复状态，仍保留正文并提醒完整构建会再次校验；
- POST 仅接受 JSON 和可选同源 Origin，声明/实际请求体均限制 100,000 B，分别返回 400/403/413/415；
- 预览 HTML 不解析 raw HTML，链接与图片复用生产安全协议白名单，`javascript:` 等危险 URL 变为空值；
- 块级公式提供中文名称、region 与 `tabIndex=0`，长公式可键盘横向滚动；
- KaTeX CSS 与 20 个 WOFF2 在构建期组成 367,928 B 的版本化单一资产，不依赖外部字体源；
- Studio 入口补齐 favicon，真实未登录加载不再产生 404 console error；
- 线上烟测会主动渲染两条公式，确认模块、内联字体、KaTeX、MathML、缓存与安全头。

## 6. 实现方法

公开阅读与作者预览首先共享 `MARKDOWN_REMARK_PLUGINS`、`MARKDOWN_REHYPE_PLUGINS`、`MARKDOWN_REHYPE_OPTIONS` 和 `transformMarkdownUrl`。公开页面仍由 `react-markdown` Server Component 输出；Studio 端点因 Next.js Route Handler 不允许直接引入 `react-dom/server`，改用同版本 unified/remark/rehype/stringify 处理同一插件与配置。端点渲染前先调用现有 `getMarkdownMathIssue`，因此构建门、生产 renderer 和作者预览不会产生三套 KaTeX 选项。

客户端模板只负责状态机和请求编排。`scheduleMathPreview` 每次先清理 timer 与 AbortController，再增加 generation；普通 Markdown立即进入 plain；潜在公式进入 loading 并延迟请求。回包只有在组件未卸载且 generation 仍等于当前值时才能进入 ready/invalid/unavailable。服务器 HTML只在 ready 状态写入；其余状态继续调用 `widgetFor("body")`，避免故障吞掉作者正文。

KaTeX 原 CSS 引用多个字体文件，不能依赖 `node_modules` 路径在 Serverless 运行期存在。`studio-assets.ts` 在构建阶段读取精确 package CSS，只保留 WOFF2 源，把 20 个字体逐个内联并断言不再包含 `url(fonts/)`；Next output tracing 仍显式包含源文件，版本化路由以 immutable 缓存提供给 Studio iframe。公开页面继续走 Next 客户端静态 CSS/font chunk，二者不互相加载。

## 7. 验证证据

- 最终 `npm run release:check` 通过：release 配置、Current 1/Historical 3/未公开 0、inbox 0、根暂存 0、外链 2 URL/3 occurrences/0 issue、ESLint 0 warning、137/137 单元、TypeScript、40 条构建路由、18/18 生产 HTTP、production audit 0；
- 生产 HTTP 覆盖公式 POST 200/422/400/403/413/415，验证 `no-store`/`noindex`、2 个公式、KaTeX、MathML、100,000 B 边界和危险 `javascript:` URL 清空；
- 客户端公开静态产物为 1,817,681 B：JavaScript 609,752 B、CSS 88,204 B、最大 JS 228,844 B，仍在原预算内；与 Iteration 0046 相比公开 JS 不变；
- Studio 作者模块 8,311 B、预览 CSS 4,382 B；版本化 KaTeX+20 WOFF2 为 367,928 B，只在 noindex 作者 iframe 加载；
- 真实 `/studio` 新会话：标题/登录页正确，`data-math-preview=registered`、`data-stable-slug=registered`，favicon 修复后 console 0 error/0 warning；
- 真实 Chromium 1280px 有效预览：根宽 `1280=1280`、2 个公式、2 个 MathML、1 个 display，公式容器 `800=800`，字体加载成功；
- 真实 Chromium 320px 深色最终结果：根宽 `320=320`、2 个 MathML、display `scrollWidth=333 > clientWidth=288`、`tabIndex=0`，聚焦后方向键使 `scrollLeft 0→40`；
- 无效公式视觉：HTTP 422、正文第 5 行错误、`data-math-preview-state=invalid`、0 个 KaTeX 节点、根宽 `900=900`，alert 清晰且原 Markdown 仍存在；
- 本机没有配置可用于自动化的 Studio 登录会话，因此没有声称真实点击已登录的新建/编辑字段；替代证据是实际 Decap 运行时完成 template 注册、状态机单元覆盖、真实 endpoint/render 浏览器测试。首次作者登录后的字段级验收仍保留为运维观察项，不阻塞本轮公开 renderer 与端点上线；
- 实现提交 `138865b1c5a6e4b994b1b04ad30e1e233fa926c9` 已推送 `main`，Quality Gate `30974890088` completed/success（1m15s）；归档提交 `7b02787bbea12746d2dda5c3835bb453f91c1eff` 的 Quality job `92207712432` succeeded（1m03s），对应 run `30975219196` 的未登录汇总页一度仍显示缓存中的 in-progress；Verify Vercel production `30975244464` completed/success（36s）。这些 run 均报告 `actions/checkout@v4` 与 `actions/setup-node@v4` 的 Node 20 action runtime 弃用 warning，不影响本轮测试结论，但应在独立维护轮升级并复验 workflow；
- 稳定域名增强烟测通过 24 条路由与 OAuth 302，并真实 POST 公式、读取模块及内联字体 CSS；生产 Chromium `/studio` 在 1280px 证明 math preview/stable slug 均 registered、根宽 `1280=1280`、console 0 error/0 warning，同源 `$x$` POST 返回 200、1 formula、1 KaTeX、1 MathML 和 production-pipeline；320px 重新加载后根宽 `320=320`、两控件仍 registered、console 0/0。生产项目页已包含归档后的“Studio 全字段只读”文本、2 个 MathML，320px 根宽 `320=320`、console 0/0。

## 8. 经验与教训

- 固定版本编辑器的“文档上存在插件 API”不等于默认 widget 确实把插件传到目标 renderer；查看实际 3.14.1 source map 后，应选择稳定的官方 preview template 边界；
- 不能为了预览再造一份公式契约。先共享插件/KaTeX/URL 选项，再让作者预览重放生产服务端管线，才能让错误和输出真正同源；
- Next.js 16 禁止 Route Handler 导入 `react-dom/server`；直接使用 unified/remark/rehype/stringify 更符合服务器数据端点边界，也避免 React renderer 进入预览函数；
- `dangerouslySetInnerHTML` 即使内容来自 Markdown parser，也必须显式处理 URL 协议。raw HTML 默认关闭只能挡标签注入，不能自动挡 `javascript:` link；本轮审查后把生产 URL transform 抽成共享规则并加入真实 HTTP 回归；
- 只在有 `$` 时请求可以让绝大多数普通正文零成本，但 `\$5` 也会触发一次无公式结果；这是为避免客户端复制完整 Markdown tokenizer 的有意小额开销，服务器仍是权威；
- 防抖不等于竞态安全。必须同时取消 timer、abort 请求并检查 generation，才能覆盖无法真正取消或已完成的旧 promise；
- 320px 第一次出现根宽 325px，公式自身也超出壳体；通用 `box-sizing: border-box` 修复后必须同时测根 `scrollWidth` 和公式自身 `scrollWidth/clientWidth`，否则可能把可滚动内容误当页面溢出；
- 浏览器 console 的 favicon 404 虽不影响功能，也会污染“零错误”证据；作者入口也应拥有完整静态资源基线；
- 首次干净构建暴露 Route Handler 的 ReactDOM 限制；移动 `.next` 后又观察到根 `node_modules/sharp` 目录变空，精确重装 `sharp@0.35.3` 后完整构建恢复。两者是本轮观察到的时序，不把缓存移动与目录变空误写成已证实因果；
- 生成 Playwright 临时 helper 留在工作区会被 ESLint 扫描并产生 warning；验证产物应位于忽略目录，临时脚本验证后删除；
- 共享 Markdown 管线重构会使依赖具体数组字面量的旧测试失效；测试应锁定共享契约和可见行为，而不是旧文件布局。

## 9. 全局状态、风险与未解决问题

博客现在拥有 Git-first 内容、Studio/Obsidian 双入口、内容/媒体/关系/外链/新鲜度门、搜索/Feed/知识地图、Vercel 自动交付与恢复、代码复制、永久链接、脚注、公式、打印，以及网页 Studio 内与生产规则一致的公式作者预览。新增运行时只在作者输入含 `$` 的正文时调用同源只读端点；公开阅读不增加客户端公式 JavaScript，Git 仍是唯一事实源。

现存风险保持：Studio 固定 Decap 3.14.1，浏览器包较大且开发依赖树仍有上游审计项；OAuth scope、CSP inline/eval 例外、Hobby 回滚、外部网络假阴性、知识图扩容、内容复核、自定义域名/统计/评论仍需维护或所有者选择。公式预览新增的已知边界是：潜在公式检测只做 `$` 快速筛选；100 KB 以上正文仍可由 Git/Obsidian 处理但不提供 Studio 公式视觉预览；预览 endpoint 是动态 Serverless 调用；本轮未自动化通过 GitHub OAuth 后的真实编辑表单。正式构建始终是最终权威，预览不可用不会删除或自行发布正文。

GitHub Quality Gate 当前还有一条 Actions Node 20 runtime 弃用 warning；它来自 `actions/checkout@v4`/`actions/setup-node@v4`，不是应用运行时或 production audit 漏洞。本轮保持单一作者预览范围，只归档为后续维护项，不在同一提交中顺带升级 CI action。

## 10. 下一轮唯一主任务

实现 Studio 全字段“发布就绪预检”（只读 Author Proof）。对 posts/projects 当前 entry 复用现有内容契约，集中展示日期/新鲜度、封面与替代文本、draft/featured、series/status/stack、URL 和正文等跨字段问题；不替代 Decap required fields，不在第一版接入 preSave 阻断，不写仓库、不建外部服务，完整构建仍是最终权威。验证新建/编辑、普通正文/公式正文、快速字段变化、320px、深浅色与预检网络失败恢复。
