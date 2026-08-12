# Iteration 0144：受约束的技术实验记录

## 1. 范围与成功标准

本轮让作者能够在文章和项目中保存一条可复核的技术实验：先写可检验假设，再固定环境、方法、样本、测量、结论与局限。第一版只记录已经完成的运行，不建立在线执行器、遥测采集、实验数据库、自动结论、显著性推断、跨运行比较或客户端状态。

成功标准：

1. 源文离开本站后仍是可读的 CommonMark/GFM；
2. 状态、真实日期、七个固定区段、测量与局限的数量、长度和唯一性均失败关闭；
3. 构建与 Studio 全字段预检共同拒绝未来运行日期；
4. Studio 提供结构化字段和可排序列表，Obsidian 提供一键模板，二者保存同一份 Markdown；
5. 阅读端、Studio 预览、搜索、桌面、320 px 与打印共享同一事实契约；
6. 完整发布门、真实 Chromium 和部署后 production smoke 覆盖能力交付。

## 2. 项目结构状态

本轮功能提交：`70aac0d`。

新增结构：

- `lib/markdown-experiment.ts`：mdast 抽取、严格校验、HAST Bench Sheet 投影和搜索降噪；
- `studio/experiment-editor.mjs`：Decap `myblog-experiment` 结构化 editor component；
- `app/studio/experiment-editor.mjs/route.ts`：显式同源 Studio 静态资源路由；
- `tests/markdown-experiment.test.mjs`、`tests/studio-experiment-editor.test.mjs`：语法、预算、日期、渲染、搜索、表单往返和资源契约；
- `docs/knowledge/0144-an-experiment-record-separates-measurement-from-claim.md`：本轮可复用知识。

同步修改内容构建、Studio 草稿预检、共享 Markdown 管线、搜索、Studio 资源与预览状态、阅读/Studio/打印 CSS、Obsidian Publisher、生产 smoke、应用质量门和相关回归测试。Obsidian 插件从 1.53.0 升级到 1.54.0，并重新生成 3/3 SHA-256 bundle。

仓库中用户自己的 `README.md`、`docs/README.md` 修改以及三份 `docs/*_CURRENT.md` 新文件继续保留在工作区，本轮未暂存、未提交。

## 3. 设计内容

视觉方向采用 **Bench Sheet / 实验台账**。左侧深色垂直 spine 写 `EXPERIMENT / RUN`；顶部只陈列结果状态、真实日期与实验标题。HYPOTHESIS 作为首要判断单独占行，ENVIRONMENT / METHOD / SAMPLE 组成安静的三列设置区，MEASUREMENTS 使用仪器读数式台账，CONCLUSION 与 LIMITATIONS 并排保存“证据支持了什么”和“证据不能支持什么”。

`SUPPORTED`、`REFUTED`、`INCONCLUSIVE`、`FAILED` 只有克制的状态差异，不生成图表、胜负排名或看似精确的统计装饰。320 px 下按标题、假设、环境、方法、样本、测量、结论、局限的阅读顺序堆叠；打印允许整条记录跨页，但单个信息面板、测量项和局限项使用 `avoid-page` 防止被切断。

`frontend-design` skill 让组件继续服从 Commit Trace 的工程档案语言，同时用“实验 spine + 测量台账”建立独立识别；没有引入圆角卡片墙、渐变、悬浮控件、假图表或仪表盘式装饰。

## 4. 使用的技术

- Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- unified、remark-parse、remark-gfm、remark-rehype、mdast 与 HAST；
- CommonMark 块引用、粗体区段、行内代码与无序列表；
- Decap CMS 3.14.1 custom editor component、list/datetime/select fields；
- Obsidian Publisher 1.54.0、命令模板、三方版本联锁和 3/3 SHA-256 bundle；
- 语义 `<time datetime>`、CSS Grid、逻辑属性、响应式与打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests、Playwright CLI；
- GitHub `main` 到 Vercel 的原生交付，不依赖 Cloudflare、数据库、实验服务或遥测 API。

[MLflow Tracking](https://mlflow.org/docs/latest/ml/tracking/) 把一次 run 的元数据、参数、指标与产物作为可追踪事实；[DVC 的实验版本化说明](https://dvc.org/blog/ml-experiment-versioning/) 证明可读实验元数据可以随 Git 版本化而不依赖中央数据库；[NousResearch 的实验日志指南](https://github.com/nousresearch/hermes-agent/blob/main/skills/research/research-paper-writing/SKILL.md) 强调结构化日志需要把结果、失败尝试与后续写作连接起来。本项目据此只提取个人博客真正需要的静态证据字段，没有复制远程追踪平台、运行管理或协作能力。

## 5. 实现的功能

1. 识别正文顶层静态 `[!experiment]`；
2. 元数据固定为 `STATUS + DATE`，状态只允许 SUPPORTED、REFUTED、INCONCLUSIVE、FAILED；
3. 固定且不可增删、不可换序的 HYPOTHESIS、ENVIRONMENT、METHOD、SAMPLE、MEASUREMENTS、CONCLUSION、LIMITATIONS；
4. 标题限制 1–120 字符，五段叙述分别限制 1–800 字符且必须各自恰好一段；
5. 每条实验包含 1–8 个测量和 1–6 个局限；每篇最多 3 条记录，全部测量与局限合计不超过 30 项；
6. 测量固定为 `**指标名** \`测量值\` — 说明`：名称 1–120、值 1–80、说明 1–400 字符；
7. 局限固定为 `**局限名** — 说明`：名称 1–120、说明 1–400 字符；测量名与局限名分别在 NFKC + `zh-CN` 小写后唯一；
8. 日期必须是真实 ISO 日历日期；内容构建和 Studio 全字段预检都拒绝未来运行；
9. 叙述与说明允许文本、行内代码/公式、强调、删除与链接；图片、HTML、脚注、硬换行、嵌套、任务状态和额外段落失败关闭；
10. 阅读端输出语义 section、真实 `<time datetime>`、Bench Sheet 和原生列表；
11. Studio 提供状态、日期、五段叙述、可排序测量和可排序局限，现有 Markdown 可完整回填；
12. `/studio/math-preview` 返回 `experimentCount`、`experimentMeasurementCount`、`experimentLimitationCount`，错误状态显示 `EXPERIMENT / NEEDS FIX`；
13. Obsidian 新增“插入技术实验记录模板”，插件升级到 1.54.0；
14. 搜索保留标题、日期、假设、环境、方法、样本、指标名、测量值、说明、结论和局限，删除 marker、状态和区段名噪声；
15. 桌面、320 px、深浅色和打印保留全部事实，无横向溢出、隐藏项或交互边界；
16. production smoke 锁定编辑器资源、共享预览计数、日期语义、Bench Sheet 与无交互边界。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!experiment] 验证完整发布门耗时
> **STATUS:** `SUPPORTED` · **DATE:** `2026-08-12`
>
> **HYPOTHESIS**
>
> 当前工作站可以在三分钟内完成全部本地发布门。
>
> **ENVIRONMENT**
>
> Windows、Node.js 22、Next.js 16.3.0，使用锁文件依赖。
>
> **METHOD**
>
> 在当前提交运行一次 `npm run release:check` 并保存最终结果。
>
> **SAMPLE**
>
> 单台工作站、一次完整运行，覆盖当前公开内容与全部自动化测试。
>
> **MEASUREMENTS**
>
> - **完整发布检查** `187.1 s` — 配置、内容、测试、类型、构建、应用与审计全部通过。
> - **全量单元测试** `637/637` — 共享内容、作者入口与交付回归全部通过。
>
> **CONCLUSION**
>
> 本次运行支持当前工作站能在约三分钟内完成完整发布检查。
>
> **LIMITATIONS**
>
> - **单次运行** — 没有重复样本，不能证明长期耗时分布。
> - **单机范围** — 结果只覆盖当前硬件、系统与依赖版本。
```

mdast 校验器先识别顶层 blockquote，再逐节点验证 marker/元数据、七个区段及其类型、顺序和数量。日历日期通过 UTC 零点往返验证；构建和 Studio 草稿预检把上海报告日作为 `maximumDate` 传给同一解析器。列表项既校验块级结构，也校验粗体、行内代码和 em dash 的精确行内节点。

共享 rehype 转换器把合法 blockquote 投影成 `data-experiment="bench-sheet"` 的 section，状态进入 `data-status`，日期进入原生 `<time datetime>`。Studio 自定义组件保存的仍是同一开放 Markdown；服务端预览仍是权威边界。搜索只修改 mdast 副本，保留自然语言证据和测量值，删除机械结构 token。

## 7. 验证证据

- 实验专项与 Studio 组件：8/8；全量单元测试：637/637；
- `npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，79 个生成页面/资源，新增 `/studio/experiment-editor.mjs`；
- `npm run test:app`：35/35，真实 production server 的 Studio、预览、公开路由和传输预算全部通过；
- `npm run lint`：0 error；16 条 warning 全部来自 `output/playwright` 的一次性验收函数，其中 7 条属于本轮临时证据，文件被 Git 忽略；
- `npm run release:check`：187.1 秒内通过配置、内容、inbox、媒体、外链、lint、全部测试、类型、构建、应用检查和生产依赖审计；`npm audit --omit=dev --audit-level=high` 为 0 漏洞；
- 插件 bundle：`myblog-publisher@1.54.0 · 3/3 SHA-256 files`；
- Playwright 桌面：Bench Sheet 宽 600 px，3/3 测量、2/2 局限、5/5 copy panel 可见，0 横向溢出，0 交互控件，状态 supported，日期精确为 2026-08-12；
- Playwright 320 px：组件宽 248 px，3/3 测量、2/2 局限仍可见，0 横向溢出，长文本自然换行；
- Playwright print：5/5 台账项与 5/5 copy panel 均为 `avoid-page`，0 隐藏，0 横向溢出；截图位于 `output/playwright/experiment-desktop-current.png`、`experiment-mobile-current.png`、`experiment-print-current.png`；
- 第一遍浏览器验收命中了端口 3100 的旧开发进程，因此 `[!experiment]` 被显示成普通引用；改用当前生产构建的独立 3101 端口后，真实共享管线正确输出 Bench Sheet；
- Playwright CLI 在 Windows 上的长时间 `networkidle` 会被 Studio 后台请求拖住，验收改为 `domcontentloaded` 后显式等待 `[data-experiment='bench-sheet']`，从而把完成条件绑定到待测组件；
- ASCII 验收样本最初使用连字符代替契约中的 middle dot/em dash，服务端预检按设计失败；改为字符码生成精确标点后通过，证明预览没有放宽作者契约。

生产自动交付已收敛：功能提交 `70aac0d` 与首份归档提交 `2caf0cc` 均进入 `origin/main`；`/studio/experiment-editor.mjs` 在第 4 次有效有界轮询返回 200/15,583 B，并包含 `myblog-experiment` 注册契约。稳定生产 smoke 在 39.6 秒内通过 27 条路由、GitHub OAuth 302、1 条 Bench Sheet、2 个测量、2 个局限、真实 `datetime="2026-08-12"`、无按钮/contenteditable/onclick 边界，以及全部 HTML/发现资源传输预算。本轮没有改变公开内容集合或结构化端点正文，因此不重置既有生产预算基线。当前公开内容仍没有真实 `[!experiment]` 样本，生产证据证明部署后的能力与合成预览，不冒充真实作者实验。

## 8. 经验与教训

1. 实验记录必须先保存可复现条件，再允许结论出现；
2. “支持/反驳”只是这一次证据与假设的关系，不是永久真理或统计显著性；
3. 样本应独立成字段，否则单次运行很容易被误读成稳定规律；
4. 测量值必须与指标名和说明成组，只有一个醒目的数字会制造错误精度；
5. 局限不是补充说明，而是结论的适用边界；
6. FAILED 与 INCONCLUSIVE 也值得公开，它们能阻止后来者重复同一失败；
7. 固定区段让 Studio、Obsidian、Git diff、搜索、HTML 和打印共享一份事实；
8. 搜索应保留自然语言条件、读数与结论，删除状态和区段 token；
9. 生产视觉验收必须运行当前构建，端口存在并不证明服务版本正确；
10. 浏览器等待条件应绑定目标语义节点，不应依赖与功能无关的全页网络静默。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务台账、本地 MP3 音频笔记、参考资料清单、步骤流程、术语定义表、FAQ、项目文件树、项目时间线、技术决策记录与技术实验记录。交付仍是 GitHub `main` → Vercel，不依赖 Cloudflare。

当前公开内容没有真实 `[!experiment]` 样本。现有证据覆盖语法、日期、作者入口、共享预览、搜索、桌面、320 px 和打印，但不证明作者假设、测量或结论本身正确，也不覆盖第一次真实 Decap workflow 编辑 8 个测量或真实 Obsidian 主题下查看长实验的效率。重复运行、跨运行比较、统计分析、图表、原始数据附件、远程追踪和实验自动执行继续关闭；需要这些能力时应使用独立实验系统，并把已确认结论投影回博客。

记忆事件 `EVT-20260812-174618-8a599b` 已写入 `D:\Study\obsidian\CodexMemory\99_Inbox\2026-08-12.md`，记录“静态可移植、测量先于结论、无在线执行/遥测/自动推断”的长期项目决策。

## 10. 下一轮唯一主任务

建立受约束的代码变更证据块：用可迁移 Markdown 保存变更标题、文件路径、目的、变更前/后或统一 diff、验证结果与已知风险；冻结文件数、行数、语言、文本和总量预算，接入 Studio/Obsidian、搜索、窄屏与打印。第一版不读取实时 Git、执行 patch、编辑仓库、自动生成变更说明、提供行级评论或保存读者状态。
