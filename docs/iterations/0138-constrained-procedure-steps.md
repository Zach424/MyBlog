# Iteration 0138：受约束的步骤流程块

## 1. 范围与成功标准

本轮让作者能在文章与项目中发布有严格先后次序的教程、运行手册和排障流程，同时继续以 Git Markdown 为唯一事实源。第一版只表达“流程标题、步骤名、操作说明、可选验证条件”，不保存读者执行状态，不接数据库、提醒、负责人或外部任务系统。

成功标准：

1. 语法在 Obsidian、Studio、GitHub 和普通 Markdown 编辑器中仍可直接阅读；
2. 标题、单组步骤、单篇流程与总步骤数都有明确预算，错误结构失败关闭；
3. 步骤顺序是内容语义，列表必须从 1 开始，不能把步骤误建成可勾选任务；
4. Studio 提供可增删、可排序的结构化组件，Obsidian 提供一键模板；
5. 阅读端、Studio 预览、搜索、窄屏和打印使用同一生产内容契约；
6. 纯静态 HTML 无按钮、复选框、客户端状态或网络请求；
7. 完整发布门、真实浏览器桌面/移动验收与生产 smoke 都能证明能力收敛。

## 2. 项目结构状态

本轮功能提交：`13d5658`。

新增结构：

- `lib/markdown-steps.ts`：mdast 抽取、严格校验、HAST Runbook Path 投影与搜索降噪；
- `studio/steps-editor.mjs`：Decap `myblog-steps` 结构化 editor component；
- `app/studio/steps-editor.mjs/route.ts`：显式同源 Studio 静态资源路由；
- `tests/markdown-steps.test.mjs`、`tests/studio-steps-editor.test.mjs`：语法、预算、渲染、搜索、组件和路由契约；
- `docs/knowledge/0138-sequence-is-not-state.md`：本轮可复用知识。

本轮同步修改内容解析/预检、共享 Markdown 管线、搜索、Studio 资源与预览、阅读/Studio/打印 CSS、Obsidian Publisher、生产 smoke、应用质量门和相关测试。Obsidian 插件从 1.47.0 升级到 1.48.0，并重新生成 3/3 SHA-256 bundle。

仓库中用户自己的 `README.md`、`docs/README.md` 修改以及三份 `docs/*_CURRENT.md` 新文件继续保留在工作区，本轮未暂存、未提交。

## 3. 设计内容

视觉方向采用 **Runbook Path**，而不是普通圆角卡片：顶部 Evidence Rail 显示 `PROCEDURE / NN STEPS` 与 `ORDERED · STATIC`；左侧圆形双位编号和连续竖线强调不可随意交换的执行顺序；右侧依次呈现步骤名、说明和可选 `CHECK` 验证轨道。

桌面使用 4.2rem 编号轨，390 px 下收窄为 3.25rem，并把 `CHECK` 标签与验证文本改为单列。流程标题和每一步都允许任意长中文安全换行；打印时标题与单步避免跨页，流程整体仍允许在步骤边界自然分页。没有动画、悬浮操作或读者交互状态。

`frontend-design` skill 将本轮收敛到“操作手册路径 + 证据层级”，让它在视觉职责上区别于任务账本、参考资料 Source Index、Callout 和普通列表。

## 4. 使用的技术

- Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- unified、remark-parse、remark-gfm、remark-rehype、mdast 与 HAST；
- Decap CMS 3.14.1 custom editor component 与嵌套 list widget；
- Obsidian Publisher 1.48.0、命令模板、三方版本联锁和 3/3 SHA-256 bundle；
- CSS Grid、`color-mix()`、响应式媒体查询与打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests、Playwright CLI；
- Vercel 原生交付，不依赖 Cloudflare、数据库或第三方流程服务。

作者语法遵循 [CommonMark 的块引用与有序列表结构](https://spec.commonmark.org/0.31.2/)；阅读投影使用语义 `<ol>`，因为 [MDN 对有序列表的说明](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ol)明确指出，改变条目顺序会改变含义的项目应使用有序列表；Studio 入口基于 [Decap 自定义 widget/editor component](https://decapcms.org/docs/custom-widgets/) 扩展，而不是创建第二种存储格式。

## 5. 实现的功能

1. 识别正文顶层静态 `[!steps]` 块和紧随其后的有序列表；
2. 流程标题限制 1–120 字符；每组 2–10 步、每篇最多 3 组且合计不超过 24 步；
3. 列表必须从 1 开始，每步必须包含“仅粗体步骤名 + 操作说明”两个段落；
4. 可选第三段必须精确以 `**验证：**` 开头；步骤名在同一流程内按 NFKC + 中文小写规范化后唯一；
5. 步骤名 1–100 字符、说明 1–600 字符、验证 1–240 字符；
6. 说明和验证允许文本、行内代码/公式、简单强调与链接；拒绝图片、HTML、脚注、硬换行、嵌套列表、任务复选框和额外段落；
7. 内容构建和 Studio 全字段预检都返回带正文行号的中文错误；
8. 阅读端输出带命名标题的语义 `<section>`、原生 `<ol>`、稳定两位编号、说明和可选 CHECK；
9. Studio 提供标题与 2–10 项可增删/拖动步骤字段，并可回填已有 Markdown；
10. `/studio/math-preview` 返回 `procedureCount`、`procedureStepCount`，错误状态显示 `STEPS / NEEDS FIX`；
11. Obsidian 新增“插入操作步骤流程模板”，插件升级至 1.48.0；
12. 搜索保留流程标题、步骤名、说明和验证内容，但去掉 `[!steps]` marker 与“验证：”标签噪声；
13. 桌面、390 px 和打印共享 Runbook Path 语义与布局；
14. 生产 smoke 检查编辑器资源、预览计数、HTML 身份与无交互边界。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!steps] 发布流程
> 1. **运行完整检查**
>
>    执行 `npm run release:check`，处理全部失败项。
>
>    **验证：** 命令以退出码 0 完成。
> 2. **推送主分支**
>
>    将已审阅提交推送到 `main`。
```

mdast 层先只识别顶层候选，再验证 marker、起始序号、唯一有序列表、每步段落数量、粗体名称、行内节点白名单、字符预算和重复名称。候选一旦匹配 `[!steps]` 前缀却不满足契约就失败关闭，不会静默退化为普通 Callout。

共享 rehype 转换器位于通用 Callout 之前，把合法 blockquote 投影成 `data-procedure="runbook-path"` 的语义 section。阅读页和 Studio 服务端预览都复用该管线；Studio 自定义组件只负责生成同一开放 Markdown。搜索在 mdast 副本上把 marker 替换为标题并删除验证标签，原 AST 中的链接仍照常参与站内关系与 HTTPS 库存。

步骤流程与只读任务账本有意分离：流程表达“必须按什么顺序做”，任务账本表达“哪些工作当前完成”。前者没有 checkbox 和状态，后者不承诺执行先后。把两者合并会让阅读语义、编辑操作和未来状态责任变得含混。

## 7. 验证证据

- 定向集成：267/267 通过；
- 全量单元测试：622/622 通过；Mermaid 独立测试：5/5；
- `npm run lint`、`npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，73 个生成页面/资源，新增 `/studio/steps-editor.mjs`；
- `npm run test:app`：35/35，通过安全/缓存、Studio、HTML/发现预算和全部公开路由；
- `npm run release:check`：125.4 秒内通过配置、内容、inbox、媒体、外链、lint、全部测试、类型、构建、应用测试与生产依赖审计；`npm audit --omit=dev --audit-level=high` 为 0 漏洞；
- 插件 bundle：`myblog-publisher@1.48.0 · 3/3 SHA-256 files`；
- Playwright Studio：`myblog-steps` 注册成功，控制台 0 error / 0 warning；
- Playwright 合成预览：桌面 1440 px 与手机 390 px 均为 1 个流程、2 步、1 条 CHECK，标题“发布流程”，无横向溢出；
- 截图：`output/playwright/iteration-0138-steps-desktop.png`、`output/playwright/iteration-0138-steps-mobile.png`；
- 第一次真实浏览器预览因脚本把样式地址写成 `127.0.0.1`、页面为 `localhost` 而触发同源样式失败，导致无样式截图；改为同一 `localhost` origin 并修正 DOM 选择器后，最终计数、布局和控制台全部通过；
- 第一次 `release:check` 不是检查失败，而是工具在 120 秒上限终止；提高到 360 秒后取得退出码 0 和完整证据。

- 功能提交 `13d5658` 与归档提交 `11ffa59` 推送后，稳定生产 `/studio/steps-editor.mjs` 在第 12 次有界轮询从 404 收敛为 200，返回 9,076 B，并包含 `myblog-steps` 与 `registerStudioStepsEditor`；
- `npm run production:smoke -- https://blog-iota-five-59.vercel.app --expect-oauth`：39.6 秒内通过 27 条路由、GitHub OAuth 302、`procedureCount: 1`、`procedureStepCount: 2`、Runbook Path HTML、无交互边界及全部 HTML/发现资源预算；
- 当前生产仍没有真实公开 `[!steps]` 内容，因此线上证据证明模块、作者资源和合成生产预览已经交付，不冒充真实教程样本。

## 8. 经验与教训

1. 顺序和状态是不同数据：教程步骤需要顺序语义，不需要持久化 checkbox；
2. 有序列表必须验证起始值，否则 `3.` 可能被 Markdown 解析器合并进 marker 段落而绕过简单 AST 判断；候选 marker 的原始文本仍需补充检查；
3. 自定义 Callout 的识别优先级属于内容契约，专用转换必须在通用 Callout 前运行；
4. Studio 表单是开放 Markdown 的便捷投影，不应成为独占数据格式；
5. 验证条件是读者判断结果的证据，不是系统运行状态；用独立 CHECK 视觉层表达即可；
6. 搜索应保留作者意义，去掉 marker 和结构标签，而不是把完整语法噪声交给读者；
7. 服务端预览计数可证明同一解析器生效，但仍必须用真实浏览器验证样式、溢出和控制台；
8. `localhost` 与 `127.0.0.1` 是不同 origin，真实浏览器验收资源必须保持同源；
9. 长发布门需要匹配实际耗时的工具时限；超时终止不能被记录为通过或失败；
10. 没有真实公开流程样本时，应诚实区分“模块/合成生产预览”与“真实内容上线证据”。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务账本、本地 MP3 音频笔记、参考资料清单和受约束步骤流程。当前交付仍是 GitHub `main` → Vercel，不依赖 Cloudflare。

当前公开内容没有真实 `[!steps]` 样本。本轮证据覆盖语法、构建、作者入口、共享预览、搜索、桌面/移动和打印 CSS，但不覆盖第一次在真实 Decap workflow 中编辑 10 步流程的效率，也不证明一篇真实教程的读者理解效果。流程分支、循环、并行泳道、交互完成状态、负责人、期限、提醒、自动执行和外部任务同步继续关闭；需要这些能力时应建立独立工作流产品契约。

## 10. 下一轮唯一主任务

建立受约束的术语定义表：用可迁移 Markdown 表达“术语 + 定义 + 可选别名/上下文”，冻结单组/单篇预算、Studio/Obsidian 作者入口、搜索、窄屏、打印与语义 `<dl>` 阅读投影；不加入远程词典抓取、自动翻译、知识数据库或客户端筛选。
