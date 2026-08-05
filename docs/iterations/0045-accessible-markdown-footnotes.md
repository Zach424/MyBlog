# Iteration 0045：可访问 Markdown 脚注

## 1. 范围与成功标准

本轮只解决 Obsidian 作者无法在公开文章中使用 Markdown 脚注记录证据的问题。成功标准是：`[^id]` 与定义可以直接从 Obsidian/GitHub 进入生产网页；同一脚注多次引用和中文 id 得到稳定编号与精确回链；脚注内链接、inline code、无 JavaScript、键盘与屏幕阅读器名称、深浅色、320px 和 A4 打印都有明确结果；脚注标题不进入正文目录或 permalink，作者标记不污染搜索纯文本，脚注内真实链接仍进入内容关系；不得接入外部服务或无必要地增加依赖、客户端 JavaScript。

## 2. 项目结构状态

- `lib/markdown-footnote.ts`：集中声明 DOM clobber 前缀、中文脚注标题、标题 class 和按引用位置生成的中文回链名称；
- `components/MarkdownContent.tsx`：把共享脚注选项交给 `react-markdown`，保留 rehype 生成的 anchor 语义属性，并让脚注标题绕开正文永久链接组件；
- `app/globals.css`：新增屏幕、深色、目标状态、窄屏与打印脚注样式；
- `lib/search.ts`：从纯文本中移除脚注引用/定义标签，保留证据正文；
- `content/posts/building-a-maintainable-blog.md`：加入一个中文 id、两次引用、站内标题深链和 inline code 的真实脚注；
- `docs/PUBLISHING.md`：记录作者可独立使用的 Obsidian/GitHub 兼容语法；
- `tests/markdown-footnote.test.mjs`：覆盖解析配置、服务端 HTML、目录/搜索/关系边界和屏幕/打印 CSS；现有 search 与 production HTML 契约同步扩展；
- `package.json`：把脚注测试加入原单元门，无新增运行时或开发依赖；
- Studio、OAuth、Obsidian 发布器、内容 schema、媒体、路由、部署与客户端组件边界均未修改。

## 3. 设计内容

脚注被设计为 Evidence Rail 的阅读内证据层，而不是通用博客常见的悬浮气泡、卡片或边栏。正文标记使用 20px 等宽编号、Trace 边框和 Signal 上规则；末尾证据区使用 `ANNOTATION / EVIDENCE`、中文“注释与来源”、`01 /` 序号和横向规则，目标脚注以 Paper 底色加 Signal 左轨回应跳转。回链本身保留至少 28px 操作区与现有焦点轮廓，不把箭头当作唯一可访问名称。

320px 下账本自然折行且页面根宽不增长；深色模式只复用 Ink/Muted/Trace/Signal/Paper Token；打印把编号压缩为纸面下划线，保留标题、证据、链接与 inline code，隐藏只对网页有意义的返回正文控件。脚注标题有真实 `<h2>` 语义，但不冒充作者章节，也不进入文章目录或 `##` permalink。

## 4. 使用的技术

- Next.js 16 / React 19 Server Component；
- `react-markdown` 的 `remarkRehypeOptions` 与现有 `remark-gfm@4.0.1`；
- remark/rehype 原生脚注 DOM、`clobberPrefix`、`footnoteLabel`、`footnoteBackLabel`、label tag/properties；
- CSS `data-footnote-ref` / `data-footnote-backref` / `data-footnotes`、`:target`、打印媒体与 `break-inside`；
- 现有 GFM mdast 内容关系解析与轻量搜索纯文本转换；
- Node test、真实 Next production HTML、Playwright CLI + Edge、Poppler 与 pypdf；
- research-iteration-loop、frontend-design、playwright 与 pdf skills 分别约束单一范围/证据归档、视觉取舍、真实浏览器流程和 PDF 全页渲染检查。

官方能力核对以维护方资料为准：[remark-gfm](https://github.com/remarkjs/remark-gfm#readme) 明确支持 `[^id]` 脚注，[remark-rehype](https://github.com/remarkjs/remark-rehype#options) 提供本地化标签、回链和 clobber 前缀选项，[react-markdown](https://github.com/remarkjs/react-markdown#options) 允许传入 `remarkRehypeOptions`。当前锁文件已经由 `remark-gfm` 带入脚注解析链，因此本轮没有安装已弃用的 `remark-footnotes` 或任何新包。

## 5. 实现的功能

- 作者直接写 `判断[^来源]` 与 `[^来源]: 证据说明与链接`；
- 中文 id 被安全编码并加 `note-` 前缀，避免作者标识符与页面 DOM id 冲突；
- 正文脚注编号是原生链接；同一脚注出现两次时，脚注末尾输出两个分别返回精确引用位置的链接；
- 回链 `aria-label` 使用中文并区分“第 2 处”，无需读取箭头字符猜测动作；
- 脚注内站内链接与 inline code 正常渲染，前者继续进入站内引用账本且同一目标只出现一次；
- 脚注标题不进入 H2/H3 目录，不生成正文 permalink；
- 搜索剥离 `[^当前架构]` 等作者标记和定义前缀，但仍可搜到证据说明；
- 屏幕浅色/深色、320px、`:target` 高亮和 A4 纸面均有专用表现，无 JavaScript时语义与跳转仍完整。

## 6. 实现方法

没有新增解析插件。现有 `remark-gfm` 已经解析脚注，`MarkdownContent` 只把共享配置传给 remark→rehype 转换层。`clobberPrefix="note-"` 把作者 id 放入受控命名空间；中文标题和回链函数在服务端确定生成。自定义 anchor renderer 改为删除内部 AST `node` 后透传其余安全的 React 属性，因此脚注的 `id`、`data-*`、`aria-*` 和 class 不再丢失，同时 HTTP(S) 外链规则保持不变。脚注 label `<h2>` 用 class 与固定 id 双条件识别，直接输出语义标题，不经过只属于作者正文 H2/H3 的 `MarkdownHeading`。

内容关系不做特殊旁路：脚注定义本来就是同一 GFM AST 的一部分，其中真实站内链接继续接受目标与标题校验并进入确定性去重。搜索仍保持客户端友好的纯函数，只先移除脚注标记/定义标签，再让原流程处理链接与 inline code；这样不会把服务端 AST 解析器搬进搜索 bundle。CSS 只针对标准 footnote data attributes，屏幕、窄屏和打印从同一语义 DOM派生。

## 7. 验证证据

- 定向脚注/search/relations/external/heading/print 测试先后为 27/27；属性与打印修复后的相关测试为 5/5；
- 最终两次完整 `npm run release:check` 均通过：release 配置、Current 1/Historical 3/未公开 0、inbox 0、根暂存媒体 0、外链 2 URL/3 occurrences/0 issue、ESLint、130/130 单元测试、TypeScript、37 个构建页面、17/17 生产 HTTP、production audit 0；
- 生产 HTML：正文有 2 个脚注标记、中文编码 id、1 个中文脚注标题、2 个精确回链；脚注标题不在目录，站内深链仍只派生 1 条 outgoing 关系；
- 生产 Edge：点击首个标记命中 `note-fn-...` 脚注并滚动到证据区；点击第二回链精确命中 `note-fnref-...-2`；控制台 0 error/0 warning；
- 320px：`clientWidth=scrollWidth=320`，证据区 288px，正文标记 20px；桌面、移动、深色证据区截图均目视通过；深色画布 `rgb(16, 24, 32)`，证据文字 `rgb(237, 244, 245)`；
- 生产 print media：稳定来源为 `https://blog-iota-five-59.vercel.app/posts/building-a-maintainable-blog`，中文标题与 `ANNOTATION / EVIDENCE` 存在，脚注 `break-inside: avoid-page`，目录与两个回链均 `display:none`；
- 正式域名 PDF 为 3 页 A4（`594.96 × 841.92 pt`），以 144 DPI 渲染全部 3 页并逐页目视复核；pypdf 提取 1820 字符，中文标题、Signal 标签、证据正文和稳定来源均存在，“返回正文中的注释”不存在；
- 实现提交 `6bc707142122a15e92e5dfbf077d52a88736c652` 已推送 `main`；Quality Gate `30963453598`、Verify Vercel production `30963487300` 均 completed/success；Production deployment `5753737731` state=success，deployment URL `https://blog-erp267uf6-czq1.vercel.app`；稳定域名冒烟为 `24 routes, OAuth 302`。

失败与修复证据：第一版 anchor renderer 只显式保留 `href/title`，会丢弃 rehype 生成的脚注 id/data/aria，导致回链目标与可访问信息消失；改为仅排除 AST `node` 并透传其余属性。第一版打印 CSS 使用 `.markdown-content [data-footnote-backref]`，真实浏览器计算后仍被更高优先级的基础 anchor 选择器覆盖为 `inline-flex`；改为 `.markdown-content a[data-footnote-backref]` 并收紧测试，最终线上两个回链均为 `display:none`。

## 8. 经验与教训

- 解析器“支持脚注”不等于产品已经支持：renderer 很容易在不知情时删除由 rehype 生成的语义属性，必须验证最终 HTML 与真实跳转；
- Anchor 属性透传应该明确排除框架内部 `node`，同时保留标准/ARIA/data 属性；白名单只覆盖早期需求，会悄悄破坏新语义；
- 目录标题和脚注区标题虽然都是 `<h2>`，产品责任不同。正文 permalink 不能按标签名泛化，必须用语义 class/id 收窄；
- 搜索无需为了脚注引入 AST 到客户端。先移除作者标记、再保留定义正文，可以维持小 bundle 与正确检索；关系图则应继续使用正式 AST，避免产生第二份链接事实；
- 打印选择器不能靠目测源码判断优先级。只有真实 print media 的 computed style 能发现基础 `a[...]` 规则覆盖后续通用属性选择器；测试也应锁定足够具体的选择器；
- 同一脚注多次引用是必要夹具：只测单次引用无法发现第二回链 id、中文可访问名称和返回位置是否正确；
- Poppler 在中文 Windows 用户路径下仍会为未用的 Bulgarian/Greek/Thai 映射打印警告，但进程成功、A4 元数据、中文提取和每页 PNG 均正常；应按产物与退出状态判断，不能把无关 stderr 当作失败。

## 9. 全局状态、风险与未解决问题

博客当前拥有 Git-first 内容、Studio/Obsidian 双作者入口、发布就绪与媒体/链接完整性门、搜索/Feed/知识地图、Vercel 自动交付/恢复、代码复制、章节永久链接、Obsidian 兼容脚注和完整 A4 输出。脚注复用了现有服务器解析链，不增加外部服务、客户端脚本或新依赖，并把证据展示继续纳入统一设计语言。

现存风险保持：Studio 固定 Decap 3.14.1 且不自动优化图片；OAuth scope、CSP inline 例外、Hobby 回滚、外部网络假阴性、知识图扩容和内容复核仍需维护；自定义域名、统计、评论、公开邮箱与外部提醒仍等待所有者选择。脚注标识符改名会改变 fragment，脚注内链接与其他正文链接一样受严格构建门约束；未来 Markdown renderer 或 print CSS 变化必须复测多回链、目录排除和 PDF 全页结果。

## 10. 下一轮唯一主任务

支持 Obsidian 兼容的 Markdown 数学公式。作者可以使用 `$...$` 与 `$$...$$` 编写行内/块级公式，由服务端生成可访问、可打印内容；必须区分代码与货币文本，保留公式源或可读替代，不让搜索摘要退化为不可读命令，长公式在 320px 有明确溢出策略，深浅色与 A4 分页稳定。实现不接入外部 CDN 或运行时服务；先核对 `remark-math`、KaTeX 的官方维护、许可、CSS/字体体积和安全边界，再用真实技术文章、生产 HTML 与 PDF 验收。
