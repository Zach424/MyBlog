# Iteration 0140：受约束的 FAQ 问答块

## 1. 范围与成功标准

本轮让作者能在文章与项目中发布“标题 + 多组问题/答案”，并让答案在阅读页以原生渐进披露方式呈现。第一版只保存作者确认的静态问答，不接投票、评论、远程问答库、客户端搜索或跨访问展开状态。

成功标准：

1. 语法在 Obsidian、Studio、GitHub 和普通 Markdown 编辑器中仍可直接阅读；
2. 标题、问题数、答案段数、字符数、单组和单篇规模都有明确预算，错误结构失败关闭；
3. Studio 提供可增删、可排序的结构化组件，Obsidian 提供一键模板；
4. 阅读端、Studio 预览、搜索、320 px 和打印使用同一生产内容契约；
5. 阅读端输出原生 `<details>/<summary>`，首题默认展开，其余问题独立开合并支持键盘；
6. 收起只是屏幕呈现状态，搜索和打印仍保留全部答案；
7. 完整发布门、真实浏览器交互与生产 smoke 能证明能力收敛。

## 2. 项目结构状态

本轮功能提交：`7d21738`。

新增结构：

- `lib/markdown-faq.ts`：mdast 抽取、严格校验、HAST Answer Cabinet 投影与搜索降噪；
- `studio/faq-editor.mjs`：Decap `myblog-faq` 结构化 editor component；
- `app/studio/faq-editor.mjs/route.ts`：显式同源 Studio 静态资源路由；
- `tests/markdown-faq.test.mjs`、`tests/studio-faq-editor.test.mjs`：语法、预算、渲染、搜索、组件和路由契约；
- `docs/knowledge/0140-disclosure-is-not-hidden-content.md`：本轮可复用知识。

本轮同步修改内容解析/预检、共享 Markdown 管线、搜索、Studio 资源与预览、阅读/Studio/打印 CSS、Obsidian Publisher、生产 smoke、应用质量门和相关测试。Obsidian 插件从 1.49.0 升级到 1.50.0，并重新生成 3/3 SHA-256 bundle。

仓库中用户自己的 `README.md`、`docs/README.md` 修改以及三份 `docs/*_CURRENT.md` 新文件继续保留在工作区，本轮未暂存、未提交。

## 3. 设计内容

视觉方向采用 **Answer Cabinet**。顶部 Evidence Rail 显示 `FAQ / NN QUESTIONS` 与 `ANSWERS · NATIVE`；每个条目以 Q/A 双轨区分问题与答案，只让当前展开条目的 Q 轨和加号使用 signal 色。FAQ 是可独立查询的问答集合，不使用数字编号，避免暗示固定阅读顺序。

首题默认展开，让读者无需操作就能看到该区块的回答密度；其余问题保持收起，降低长文章的首屏噪声。交互完全交给浏览器原生 `<details>/<summary>`：没有客户端组件、localStorage、cookie 或数据库。`summary:focus-visible` 提供明确键盘焦点，`prefers-reduced-motion` 关闭加号旋转过渡。

窄屏将 rail 改为纵向排列，Q/A 轨缩窄但不移除；打印则强制显示全部答案并隐藏开合标记。`frontend-design` skill 将本轮收敛到“答案柜 + 原生披露”，并明确与单个 Callout 和顺序步骤区分。

## 4. 使用的技术

- Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- unified、remark-parse、remark-gfm、remark-rehype、mdast 与 HAST；
- 原生 HTML `<details>/<summary>` 渐进披露语义；
- Decap CMS 3.14.1 custom editor component 与两层 list widget；
- Obsidian Publisher 1.50.0、命令模板、三方版本联锁和 3/3 SHA-256 bundle；
- CSS Grid、`color-mix()`、`:focus-visible`、`prefers-reduced-motion`、响应式与打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests、Playwright CLI；
- Vercel 原生交付，不依赖 Cloudflare、数据库或远程问答服务。

作者语法使用 [CommonMark](https://spec.commonmark.org/0.31.2/) 可移植的块引用、列表和段落；阅读投影使用 [MDN details](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details) 与 [MDN summary](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/summary) 描述的原生披露关系；Studio 入口基于 [Decap 自定义 widget/editor component](https://decapcms.org/docs/custom-widgets/) 扩展，而不是创建第二种存储格式。

## 5. 实现的功能

1. 识别正文顶层静态 `[!faq]` 块和紧随其后的无序列表；
2. 标题限制 1–120 字符；每组 2–10 个问题、每篇最多 3 组且合计不超过 24 个问题；
3. 每条第一段必须只包含 1–160 字符的粗体问题，随后填写 1–3 个答案段落；
4. 每个答案段落限制 1–600 字符，每个问题的全部答案合计不超过 1,200 字符；
5. 答案允许文本、行内代码/公式、简单强调与链接；拒绝图片、HTML、脚注、硬换行、嵌套列表、任务 checkbox 和额外段落；
6. 同一 FAQ 内的问题按 NFKC + `zh-CN` 小写规范化后不能重复；
7. `[!faq]+`、`[!faq]-`、嵌套候选或错误结构失败关闭，不静默退化为普通 Callout；
8. 内容构建和 Studio 全字段预检都返回带正文行号的中文错误；
9. 阅读端输出带标题的语义 `<section>` 和原生 `<details>/<summary>` Answer Cabinet；
10. 第一题默认展开，其余问题独立开合，不保存状态；
11. Studio 提供标题、2–10 个可增删/拖动问题及每题 1–3 个答案段落，并可回填已有 Markdown；
12. `/studio/math-preview` 返回 `faqCount`、`faqQuestionCount`，错误状态显示 `FAQ / NEEDS FIX`；
13. Obsidian 新增“插入常见问题 FAQ 模板”，插件升级至 1.50.0；
14. 搜索保留标题、问题和全部答案，但去掉 `[!faq]` marker 与视觉标签噪声；
15. 320 px 无横向溢出、键盘焦点可见、减少动态效果偏好生效，打印展开全部答案；
16. 生产 smoke 检查编辑器资源、共享预览计数、原生语义 HTML 与无脚本边界。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!faq] 发布常见问题
> - **应该使用 Studio 还是 Obsidian？**
>
>   Studio 适合浏览器内结构化编辑；Obsidian 适合本地知识库写作。
>
>   两者最终发布同一份 **Markdown**，并通过 `release:check`。
> - **FAQ 会保存读者的展开状态吗？**
>
>   不会。展开只存在于当前页面，不写回 Git，也不会跨访问保存。
```

mdast 层先在顶层寻找候选，再验证静态 marker、唯一无序列表、条目/段落数、仅粗体问题、行内节点白名单、字符预算和规范化去重。专用 FAQ 校验和转换都位于通用 Callout 之前，使拼错结构不能绕过发布门。

共享 rehype 转换器把合法 blockquote 投影为 `data-faq="answer-cabinet"` 的 section。第一项 `<details open>`，其余不带 `open`；每个 `<summary>` 自身就是可聚焦、可点击、可键盘开合的交互边界，不附加按钮或 React 状态。阅读页和 Studio 服务端预览复用同一转换器；Studio 自定义组件只负责生成和读取同一开放 Markdown。

搜索在 mdast 副本上把 marker 改为可见标题，问题和答案保持原样。打印 CSS 对关闭的 details 显式显示非 summary 子树，因此“屏幕收起”不会变成“打印丢失”。

## 7. 验证证据

- 定向跨入口回归：233/233 通过；
- FAQ 专项：9/9；全量单元测试：633/633；Mermaid 独立测试：5/5；
- `npm run lint`、`npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，75 个生成页面/资源，新增 `/studio/faq-editor.mjs`；
- `npm run test:app`：35/35，通过安全/缓存、Studio、HTML/发现预算和全部公开路由；
- `npm run release:check`：206.2 秒内通过配置、内容、inbox、媒体、外链、lint、全部测试、类型、构建、应用测试与生产依赖审计；`npm audit --omit=dev --audit-level=high` 为 0 漏洞；
- 插件 bundle：`myblog-publisher@1.50.0 · 3/3 SHA-256 files`；
- Playwright Studio 登录页资源：18 个静态请求，控制台 0 error / 0 warning；
- Playwright 合成生产预览：2 个原生 details，首题展开、次题收起；点击后次题展开，Enter 后再次收起；焦点 outline 为 `solid`；
- Playwright 320 px：`horizontalOverflow: false`，实际截图复核 Q/A 轨与长问题正常换行；
- Playwright print：关闭答案计算样式为 `display: grid` 且高度 85.9375 px，证明打印未隐藏正文；
- 截图：`output/playwright/faq-desktop.png`、`output/playwright/faq-mobile-320.png`；
- 第一次合并执行 `lint/typecheck` 在 64 秒命令上限内未返回结果，拆分后两项都通过，不记为产品失败；
- 第一次定向回归暴露两个旧断言：插件可见版本仍期待 1.49.0，Rich Markdown 证据串未包含 FAQ 计数；更新可观测契约后 233/233 通过；
- Playwright 首次用 `127.0.0.1` 打开页面时，浏览器的 Origin 与 Next request URL 的 `localhost` 不一致，正确触发 403 同源保护；改用 `localhost` 后生产预览返回 200。该 403 是安全边界工作，不是 FAQ 故障；
- 功能提交 `7d21738` 与归档提交 `f8f4467` 推送后，稳定生产 `/studio/faq-editor.mjs` 在第 7 次有界轮询从 404 收敛为 200，返回 8,701 B，并包含 `myblog-faq` 与 `registerStudioFaqEditor`；
- `npm run production:smoke -- https://blog-iota-five-59.vercel.app --expect-oauth`：39.9 秒内通过 27 条路由、GitHub OAuth 302、`faqCount: 1`、`faqQuestionCount: 2`、Answer Cabinet、首题 `open`、原生 `<summary>`、无脚本边界及全部 HTML/发现资源预算；
- 当前生产仍没有真实公开 `[!faq]` 内容，因此线上证据证明模块、作者资源和合成生产预览已交付，不冒充真实 FAQ 文章样本。

## 8. 经验与教训

1. 收起是一种呈现状态，不应从搜索、复制、打印或源文中删除答案；
2. FAQ 适合原生 `<details>/<summary>`，无需为了开合引入客户端组件和持久化；
3. 首题默认展开能同时提供内容预览和渐进披露，其余条目仍保持低噪声；
4. 原生交互也必须验证键盘焦点、减少动态效果和打印，不等于自动满足全部体验要求；
5. 问题唯一性应规范化全角/半角和大小写，但不能推断语义重复；
6. 可折叠 FAQ 与可折叠 Callout 的数据契约不同，专用 marker 必须先于通用转换且错误失败关闭；
7. Studio 表单是开放 Markdown 的便捷投影，不应成为第二事实源；
8. 浏览器同源验证必须让地址栏 Origin 和服务器看到的 request URL 一致，`localhost` 与 `127.0.0.1` 不能在测试中随意混用；
9. 合成生产预览能证明模块和交互契约，不证明 FAQ 答案本身正确；
10. 生产 smoke 应同时锁定静态编辑器资源和动态预览语义，避免只部署其中一半。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务账本、本地 MP3 音频笔记、参考资料清单、步骤流程、术语定义表和 FAQ 问答块。当前交付仍是 GitHub `main` → Vercel，不依赖 Cloudflare。

当前公开内容没有真实 `[!faq]` 样本。本轮证据覆盖语法、构建、作者入口、共享预览、搜索、点击/键盘、320 px 和打印，但不覆盖第一次在真实 Decap workflow 中编辑 10 个问题的效率，也不证明问答内容准确。投票、评论、远程问答库、自动生成答案、客户端搜索、跨访问展开状态和协同审校继续关闭；答案由作者负责核实。

## 10. 下一轮唯一主任务

建立受约束的项目文件树/目录结构块：用可迁移 Markdown 表达根标题、文件夹、文件和简短注释，冻结节点深度/数量、路径唯一性、Studio/Obsidian 作者入口、搜索、窄屏与打印；不加入在线文件浏览、远程仓库读取、客户端折叠状态或文件编辑。
