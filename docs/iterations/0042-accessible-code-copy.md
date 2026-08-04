# Iteration 0042：可访问的代码块复制

## 1. 范围与成功标准

本轮回到读者侧技术内容，只解决 fenced code block 的高频操作成本。成功标准是：服务端 HTML 始终保留完整 `<pre><code>`；没有 JavaScript 时不展示失效按钮，代码仍可阅读、选择和横向滚动；hydration 后出现语言标签和 COPY；复制的是高亮后 code DOM 的精确 `textContent`，包括空格与末尾换行；成功和失败同时更新按钮与中文 `aria-live`；键盘、320px 和生产模式均可用；inline code 不被包装；不引入依赖、追踪、持久化或旧式 `execCommand`。

## 2. 项目结构状态

- `components/MarkdownContent.tsx`：仍是服务端 Markdown 边界，只在 `pre` renderer 中读取 code 类名并把现有子树交给最小客户端岛；图片、链接、表格和插件顺序未改变；
- `components/CodeBlock.tsx`：新增唯一客户端组件，负责 progressive enhancement、Clipboard 写入、COPY/COPIED/FAILED、live region 和定时复位；
- `lib/code-block.ts`：新增无浏览器依赖的 fenced language 解析与常见别名规范化；
- `app/globals.css`：新增 Commit Trace 风格的代码证据条、状态色、SSR hidden 保护和 320px full-bleed wrapper；原语法高亮色继续复用；
- `tests/code-block.test.mjs`：锁定语言标签、客户端边界、精确文本来源、Clipboard API、timer 清理、hidden CSS 和旧 API 禁用；
- `tests/rendered-html.test.mjs`：锁定真实生产 HTML 的 figure/rail/hidden button/live region，并用两篇真实文章证明 fenced 与 inline code 隔离；
- `package.json`：把新契约测试加入既有单元门；没有新增运行时或开发依赖；
- `docs/STATUS.md`、`docs/ROADMAP.md`、`docs/DESIGN.md`、`docs/ARCHITECTURE.md`、`docs/QUALITY.md` 与本文：同步结构、设计、技术、功能、方法、验证、经验和下一步；
- 内容 Markdown、schema、Studio、Obsidian、媒体、GitHub Actions 与 Vercel 配置均未修改。

## 3. 设计内容

代码块被定义为“可复制的终端证据条”，而不是另一个卡片系统。深蓝代码面板上方只有一条 2.5rem 操作轨：左侧等宽大写 `CODE / LANGUAGE`，右侧单一 COPY 动作；直角、细规则线、现有字体和色阶继续服从 Commit Trace / Evidence Rail。成功用浅 mint 表示确定完成，失败用 warm coral 表示需要手工选择，键盘焦点仍使用全站 Signal outline。状态只改变动作格，不让代码区位移，也不增加动画。

桌面操作轨固定在代码滚动层之外，长代码只让 `<pre>` 横向滚动。`≤42rem` 时整个 wrapper 延伸到视口边缘，轨道保持 320px 完整宽度，代码保留正文水平内边距。无 JavaScript 时 rail 只显示语言，隐藏的按钮不占布局；这不是残缺态，而是完整可读的服务端降级。

## 4. 使用的技术

- React 19 Client Component、`useEffect`、`useId`、`useRef`、`useState` 与 timer cleanup；
- Next.js 16 Server/Client Component 边界：Markdown 解析留在服务端，只有复制交互进入客户端 bundle；
- react-markdown `pre` component、React `Children.toArray`/`isValidElement` 与 rehype-highlight 的 `language-*` 类；
- 原生 `navigator.clipboard.writeText` 与 code DOM `textContent`；
- `aria-describedby`、`aria-live="polite"`、原生 button、figure/figcaption 与全站 `:focus-visible`；
- CSS 属性选择器 `.code-copy-button[hidden]`、data-state 状态样式、固定 rail 与独立 overflow；
- Node test、真实 Next production HTTP、Playwright CLI、禁用 JavaScript 的独立 Edge browser context；
- research-iteration-loop、frontend-design 与 playwright skills：分别约束单一主线/证据循环、两遍视觉判断和真实浏览器验收。

## 5. 实现的功能

- 每个 Markdown fenced code block 自动显示规范化语言，例如 `text → TEXT`、`json → JSON`、`ts → TYPESCRIPT`，未知带连字符语言转换为可读大写标签；
- hydration 完成后才揭示 COPY，避免无 JavaScript 时出现无法使用的控件；
- 按钮通过当前 figure 内 `<code>.textContent` 复制精确文本，不复制 highlight spans 或 HTML；
- 成功立即进入 COPIED，live region 宣告“代码已复制到剪贴板。”；
- Clipboard API 不存在或拒绝写入时进入 FAILED，live region 提示“复制失败，请手动选择代码。”；
- 每次操作清理旧 timer，2400ms 后复位；组件卸载时清理仍在等待的 timer；
- inline code 保持原 `<code>`，没有按钮、figure 或客户端状态；
- SSR `<pre><code>`、rehype-highlight 类、原换行和末尾换行全部保留；
- 320px 页面无水平溢出，代码自身仍可滚动，操作轨不随长代码移出视口。

## 6. 实现方法

`MarkdownContent` 不改成 Client Component。服务端 `pre` renderer 从现有 child 中找到 React code element，只读取可序列化的 `className`，用纯函数取得语言标签，再把原 children 和标签传入 `CodeBlock`。因此 Markdown 文件读取、GFM、slug、高亮与图片尺寸仍在服务端完成，客户端只得到一个局部交互岛。

`CodeBlock` 的 SSR 输出包含 figure、figcaption、语言、hidden button、原 pre/code 和空 live region。CSS 显式声明 `[hidden] { display: none }`，避免作者级 `display: inline-flex` 覆盖浏览器默认 hidden。mount effect 直接移除按钮的 hidden 属性，不用额外一次 state render；后续 copy state 更新不会改变该属性，因为 React 虚拟属性值保持不变。点击时先清理旧 timer，再从组件自己的 pre 中查询 code；只有字符串和 Clipboard writer 同时存在才写入。异常统一进入可恢复失败态，状态 timer 使用 ref 保存并在卸载时清理。

移动端不再让旧 `.markdown-content pre` 自己负 margin；wrapper 承担 full bleed，内部 pre 以更高特异性恢复 `margin-inline: 0`。这样语言和 COPY 形成固定 rail，只有 code overflow。生产 HTML 测试允许 React 19 为相邻字符串插入 hydration comment，但仍严格校验按钮 hidden、语言和 pre/code 结构。

## 7. 验证证据

- 完整 `npm run release:check`：Release 配置完整；Current 1/Historical 3/未公开 0；inbox 0；根暂存媒体 0；外链 2 URL/3 occurrences/0 issue；
- 同一候选通过 ESLint、122/122 单元测试、TypeScript、37/37 构建页面、17/17 真实生产 HTTP/质量测试与 production-only audit 0；`git diff --check` 通过；
- Server HTML：figure/rail、`CODE / TEXT`、`hidden` COPY、完整 `<pre><code class="hljs language-text">` 与空 polite live region 均存在；第二篇真实文章的 `cmd.exe` inline code 保持裸 code，JSON fenced block 独立增强；
- 本地新鲜 production server：1280px 代码块 768px；320px wrapper/rail 均为 320px，document width = viewport width，页面无横向溢出，pre 保留独立滚动；生产控制台 0 error/0 warning；
- 键盘：按钮 focus 后 `Shift+Tab → Tab` 可返回，Enter 触发成功；
- Clipboard 成功：writer 接收 `content/\n  posts/<slug>.md\n  projects/<slug>.md\n`，与 code `textContent` 逐字一致，`exact=true`；按钮/live region 为 COPIED/成功中文；
- Clipboard 拒绝：按钮为 FAILED，live region 为“复制失败，请手动选择代码。”；
- JavaScript disabled Edge context：`COPY` 0 match，`content/` 代码 1 match，figure 可访问名只含 `CODE / TEXT`，代码与样式完整；
- 视觉截图覆盖 desktop、320px、COPIED 与 no-JS，保存在忽略目录 `outputs/playwright/iteration-0042`，不进入仓库；
- 实现提交 `6fe93c0cfe9ce5b14472707362f497a77081ebe8` 已推送 `main`；GitHub Quality Gate `30955778568` 与 Verify Vercel production `30955810777` 均 completed/success；
- GitHub Production deployment `5752424482` state=success，精确对应实现 SHA，部署 URL 为 `https://blog-hi48gx4x9-czq1.vercel.app`；
- 稳定生产域名独立冒烟：`24 routes, OAuth 302`；稳定域名 Playwright 找到 COPY，复制后 `state=copied`、`exact=true`、语言 `CODE / TEXT`，控制台 0 error/0 warning；
- 网络代理只在对应检查进程内设置，未写入仓库或永久配置。

## 8. 经验与教训

- progressive enhancement 必须同时约束 HTML 和 CSS。只给 button 写 `hidden` 不够；作者样式的 `display` 可以覆盖 UA hidden 规则，所以必须有同特异目标的 `[hidden] { display: none }` 回归测试；
- 复制高亮代码时 DOM `textContent` 是正确事实源：它保留用户看到的空格/换行，又不会把 syntax spans 当作内容；重新从 Markdown 解析会形成第二套文本语义；
- Server Component 应继续拥有昂贵和确定性的 Markdown 工作，客户端岛只负责浏览器能力。为一个按钮客户端化全文会扩大 bundle、hydration 和故障面；
- 页面上的成功状态是短命视觉反馈，live region 是独立可访问反馈，两者需要同一状态事实源但不必让空闲态反复播报；
- `localhost:3000` 在 `next build` 覆盖 `.next` 后成为“新服务端 chunk + 旧 CSS manifest”的混合旧进程，导致第一次截图误判样式失效。视觉验收必须使用构建后新启动的 production server，不能相信跨构建存活的预览进程；
- React 19 会在相邻服务端文本节点间加入 `<!-- -->` hydration 边界，HTML 契约应允许这个框架细节，但不能放松真实元素和属性断言；
- inline/fenced 隔离必须使用确实同时包含两者的真实文章。首篇样本没有 inline code，断言虚构的 `<code>Git</code>` 只会测错样本；
- Node 24 Unicode regex 中字面 `{` 必须转义。新增测试文件应先单独解析运行，再进入耗时完整门禁；
- Playwright 隔离 context 默认需要自带 Chromium；本机未安装时可以显式使用已安装的 `msedge` channel，同时保留 `javaScriptEnabled: false`，不需要为了一次降级测试下载浏览器；
- Clipboard read permission 与 write 行为不是同一能力。测试不应读取用户系统剪贴板，而应在受控页面上下文替换 writer，直接验证组件传入的字符串和状态结果。

## 9. 全局状态、风险与未解决问题

博客当前已经覆盖 Git-first 内容、Studio/Obsidian 双写作入口、媒体与链接完整性、搜索/Feed/知识地图、Vercel 自动交付/恢复，以及可访问的技术代码复制。新增客户端能力被限制为单个 CodeBlock 岛；无 JS 与 inline code 仍完整。代码块没有自动执行、行号、折叠或追踪，这些都不是当前内容规模下的必要能力。

现存主要风险保持：Studio 不自动优化图片并依赖固定 Decap 3.14.1 契约；OAuth scope、CSP inline 例外、Hobby 回滚、外部网络假阴性、知识图扩容和内容复核仍需维护；自定义域名、统计、评论、公开邮箱与外部提醒仍等待所有者选择。读者侧新的直接缺口是文章标题虽然已有稳定 id 和目录入口，但正文 H2/H3 没有可发现的原生 permalink；读者要分享具体章节仍需手工从目录或地址栏组合 fragment。

## 10. 下一轮唯一主任务

为 Markdown H2/H3 增加服务端渲染、无 JavaScript 依赖的章节 permalink。必须复用 rehype-slug 已生成的真实 id，不重新实现 slug；标题文本与目录语义不变，链接应可键盘访问、在 hover/focus/touch 上可发现、复制原生 fragment URL，不引入客户端 bundle、Clipboard API 或追踪。需要覆盖中文、重复标题、编码 fragment、320px、深色/浅色、无 JS、打印与真实生产 HTML，并确保标题链接不会改变内容关系抽取或目录目标。
