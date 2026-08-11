# Iteration 0130：Obsidian Markdown Callout

## 1. 范围与成功标准

本轮解决“作者虽然可以写 GFM、脚注和公式，但还不能在同一篇 Markdown 中插入类似飞书文档的信息块”的体验缺口。目标不是开放 raw HTML，而是把 Obsidian 已有的 Callout 语法作为受限作者协议，服务端生成可访问、可打印、可搜索且与 Studio 一致的语义结构。

成功标准：

1. 支持 Obsidian 官方 13 种 Callout 类型、官方别名、自定义纯文本标题与大小写不敏感解析；
2. 支持无折叠、默认展开 `+`、默认收起 `-`、嵌套、列表、强调、链接和公式；
3. 未知但受限的标识符安全降级为 note，非法标记、普通 blockquote 与 fenced code 示例保持原样；
4. 静态块输出语义 `<aside role="note">`，折叠块只使用原生 `<details><summary>`；
5. 读者页与 Studio 共享同一 rehype 插件，不维护第二套 HTML renderer；
6. 搜索保留可见标题和正文但不泄漏 `[!type]` 作者标记；
7. 深浅色、390px、键盘焦点、嵌套和打印行为明确；打印必须显示默认收起内容；
8. 生产 smoke 用同时包含 Callout 和公式的真实 POST 固定共享管线；
9. 六份全局中文文档、发布指南、本迭代和知识笔记同步写入仓库根 Obsidian Vault；
10. 不增加依赖、客户端脚本、任意 HTML、iframe、数据库、账号、追踪、第三方服务、Cloudflare 或云配置。

## 2. 项目结构状态

本轮新增：

- `lib/markdown-callout.ts`：受限标记解析、官方类型/别名映射、HAST 转换与搜索纯文本降级；
- `tests/markdown-callout.test.mjs`：解析、折叠、嵌套、普通引用、搜索、Studio/样式/打印静态契约；
- 本文件与 `docs/knowledge/0130-rich-markdown-should-be-an-ast-contract.md`。

本轮修改：

- `lib/markdown-pipeline.ts`：把 Callout 转换加入生产阅读与 Studio 共享的 rehype 插件序列；
- `lib/search-index.ts`：从 mdast 删除作者标记但保留可见语义；
- `lib/studio-math-preview.ts`、`studio/math-preview.mjs`：历史兼容端点扩为增强 Markdown 预览，增加 `calloutCount` 和 fenced-code-aware 触发；
- `app/globals.css`、`studio/preview.css`：Evidence Rail 五色组、折叠、嵌套、深色、焦点和打印契约；
- `scripts/smoke-production.mjs`：生产预览同时验证 warning Callout 与 KaTeX HTML/MathML；
- `tests/quality-gates.test.mjs`、`tests/studio-math-preview.test.mjs`、`tests/deployment-tools.test.mjs`、`package.json`：增加失败优先、真实应用与部署门；
- `docs/STATUS.md`、`docs/ROADMAP.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/OPERATIONS.md`、`docs/QUALITY.md`、`docs/PUBLISHING.md`：更新全局结构、设计、运行、质量和作者语法。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

Callout 继续使用 Commit Trace / Evidence Rail，不做通用彩色卡片：左侧类型轨道与上下规则线建立边界，标题行固定为 `TYPE / 标题`，类型码使用等宽字。13 种语义映射为信息、成功、问题、警告、引用五个可读色组；标题、类型文字、轨道与结构同时表达语义，颜色不是唯一信号。

```text
作者 Markdown
> [!warning]- 发布前检查
> 正文
        │
        ▼ 共享 HAST 转换
<details data-callout="warning">
  <summary>WARNING / 发布前检查</summary>
  <div>正文</div>
</details>
```

静态 Callout 使用 `<aside role="note">`；只有作者明确写 `+/-` 时才出现可折叠控件。原生 `<details>` 保证无 JavaScript、键盘可用和失败时可读。打印强制显示收起正文，隐藏加减号；390px 不改变信息顺序，嵌套只收紧间距。普通引用保持现有 Signal 左线，从视觉和语义上都不冒充 Callout。

## 4. 使用的技术

- Next.js 16.3、React 19 Server Components 与现有 `react-markdown`；
- unified、remark-parse/remark-gfm/remark-rehype、HAST、rehype-stringify；
- [Obsidian 官方 Callouts 语法](https://obsidian.md/help/callouts)；
- TypeScript 判别类型、受限正则和后序树遍历；
- 原生 HTML `<aside>`、`<details>`、`<summary>` 与 `role="note"`；
- CSS `color-mix()`、`prefers-color-scheme`、`:focus-visible` 与 `@media print`；
- 既有 KaTeX、搜索 mdast、Studio no-store 同源预览；
- Node test、ESLint、TypeScript、Next production build；
- Playwright 真实浏览器视觉与交互验收；
- Vercel 稳定生产端点与完整生产 smoke；
- `research-iteration-loop` 和 `frontend-design` 的执行—验证—部署—归档流程。

实现前完整阅读当前 Next 16.3 本地 Server/Client Component 与 CSS 约定，并核对 Obsidian 官方 Callouts 文档，没有依赖第三方语法摘要或旧版框架记忆。

## 5. 实现的功能

1. 识别 note、abstract、info、todo、tip、success、question、warning、failure、danger、bug、example、quote；
2. 映射 summary/tldr、hint/important、check/done、help/faq、caution/attention、fail/missing、error、cite 等官方别名；
3. 标识符不区分大小写，限制为 `a-z` 开头、最长 32 位的英文/数字/连字符；
4. 未知合法标识符保留来源身份并按 note 渲染，非法格式保持普通引用；
5. 无自定义标题时使用中文默认标题；未知类型使用可读 Title Case；
6. 无折叠符输出静态 aside；`+` 默认展开，`-` 默认收起；
7. 嵌套、列表、强调、链接和数学公式继续由既有 Markdown 管线处理；
8. 标记独占标题行或标题行后直接接正文都可工作；
9. 普通引用与 fenced code 中的示例不转换；
10. 搜索纯文本包含可见标题与正文，不包含作者标记；
11. Studio 只对潜在公式/Callout 调用同源端点，成功态分别报告公式和信息块数；
12. 读者和 Studio 共享类型结构、深浅色、折叠和嵌套视觉；
13. 打印时默认收起内容强制展开；
14. 生产 smoke 同时验证 `data-callout="warning"`、标记移除、KaTeX HTML 与 MathML。

## 6. 实现方法

先建立失败优先证据。新增 Callout 与 Studio 定向测试初始 0/2：`lib/markdown-callout.ts` 和 `hasPotentialStudioRichMarkdown` 都不存在；旧真实 Next 应用门为 8/9，生产预览结果没有 `calloutCount`。这证明缺口同时存在于纯转换、作者触发和真实 HTTP 边界。

实现没有在字符串 HTML 上做替换。remark 先把 Markdown 变成 mdast，再由既有 remark-rehype 形成 HAST；`rehypeMarkdownCallouts()` 后序遍历 HAST，只检查 blockquote 第一段的第一个文本节点。后序遍历先转换内层 blockquote，因此外层正文可以自然包含已经转换好的嵌套 Callout。标记从首个文本节点删除，余下段落、列表、公式和链接节点不重建、不拼接 HTML。

搜索走独立但同源的 mdast 归一化：只把 `[!type]` 替换成可见标题，保留正文和 fenced code 字面值。Studio 浏览器端只做轻量、代码围栏感知的“是否值得请求”判断；真正渲染仍由服务器端 `renderStudioMathPreview()` 共享生产插件完成。历史 URL 和导出命名保留，避免无价值的内部迁移；可见状态改为 `RICH MARKDOWN`。

视觉先在生产 CSS 和 Studio CSS 中建立相同五色 token，再用真实生产服务器和 Playwright 构造非持久样本。1280px 浅色和 390px 深色截图确认信息密度、标题换行、嵌套和色彩；原生点击把 warning 从 `+` 切换到 `−` 并显示正文，控制台为 0 error。验收样本和截图随后清理，没有把演示内容写入公开文章。

## 7. 验证证据

- 失败优先：Callout/Studio 定向旧实现 0/2；真实应用旧实现 8/9；
- 定向实现测试：22/22；
- `npm run typecheck`：通过；
- `npm run lint`：通过；
- `npm run build`：通过，66 个生成页面；
- `npm run test:app`：35/35，全部 HTML/发现预算 PASS；
- `npm run test:unit`：540/540；
- `git diff --check`：通过；
- Playwright：1280×900 浅色、390×844 深色、4 个 Callout、2 个折叠控件、1 个嵌套、1 个普通引用；点击默认收起 warning 后正文出现，控制台 0 error；
- 功能提交：`3c6dfbf`（`feat: render Obsidian callouts`），已推送并进入稳定生产；
- 部署探测：第 1–5 次仍是旧结果，第 6 次返回 `formulaCount: 1`、`calloutCount: 1`；
- 稳定生产 smoke：27 routes、OAuth 302，十三条 HTML 与十一个结构化发现端点全部 PASS；
- 本轮只改变全局 CSS 资产与 Studio 增强预览，没有修改公开内容正文或发现表示；现有基线仍有足够余量，不重置预算；
- 无依赖、客户端脚本、任意 HTML、iframe、账号、数据库、追踪、第三方服务、Cloudflare 或云配置变更。

## 8. 经验与教训

1. 富 Markdown 应在语法树边界实现，而不是对 HTML 或源码做全局正则替换；
2. 作者协议、生产渲染、搜索和 Studio 可以共享语义，但不必共享完全相同的树操作；
3. 原生 `<details>` 同时解决交互、键盘、无脚本降级和状态语义，比自制客户端折叠器更适合博客；
4. 普通引用不变是兼容契约，不只是一个额外测试；
5. 代码围栏中的语法示例必须保持字面值，触发器也不能为它发起无意义请求；
6. 未知受限类型安全降级，比拒绝整篇文章或开放任意 class 更适合可移植写作；
7. 标题先限制为纯文本，避免为装饰能力扩大可访问名称和内联树复杂度；
8. 颜色只能分组，类型文字和轨道结构才是稳定的语义证据；
9. 打印必须主动展开折叠内容，否则屏幕交互状态会造成 PDF 信息丢失；
10. Studio 的轻量触发判断只负责省请求，服务器共享管线才是正确性边界；
11. 生产 smoke 用合成 POST 可以证明未来内容能力，不必为了展示功能改写现有公开文章；
12. 浏览器截图之后还应操作原生控件并检查无障碍快照与控制台；
13. 新 CSS 接近预算时必须让真实应用门裁决，不能凭源码行数猜测；
14. 没有公开正文变化时不应机械重置 HTML 或发现基线；
15. Obsidian 状态、迭代、知识笔记与代码继续共享同一 Git 历史。

## 9. 全局状态、风险与未解决问题

当前作者可以从 Studio 或 Obsidian 写 GFM、图片、代码、脚注、数学公式和 Callout，并由 Git/Vercel 自动上线。Callout 已覆盖官方类型、别名、折叠、嵌套、Studio、搜索、深浅色、窄屏和打印，但标题有意只接受纯文本；原始公开 Markdown 保留作者语法，第三方渲染器是否支持 Callout 取决于其实现。

未知合法类型会显示其来源 code 并采用 note 色组，这保证内容可见但不会自动获得自定义图标或色彩。任意 HTML、iframe、脚本、style/class 与外部嵌入继续被排除。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱继续需要所有者操作或选择，不阻塞当前开发。

富内容剩余主要缺口是图表和视频。视频涉及远程隐私、iframe 权限、无障碍标题与打印降级，不能与图表一起扩张；下一步只做一个独立主任务。

## 10. 下一轮唯一主任务

实现受限的 Mermaid fenced diagram 服务端渲染：保留 Obsidian 可移植源码，限制 diagram 类型、源码/节点/输出字节，生成并清理安全 SVG；解析或渲染失败时保留可读源码与明确诊断。读者、Studio、搜索、深浅色、390px、打印和生产 smoke 必须共享契约；不得执行任意脚本、开放 raw HTML/iframe、加载第三方运行时或把大型客户端 Mermaid bundle 发送给读者。
