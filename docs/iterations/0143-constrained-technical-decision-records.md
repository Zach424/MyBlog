# Iteration 0143：受约束的技术决策记录

## 1. 范围与成功标准

本轮让作者能在文章和项目中保存一条真正可追溯的技术决定：当时面对什么约束、最终选择什么、为什么这样选、哪些方案没有选，以及这个选择带来哪些正负或中性影响。第一版只发布作者已经作出的决定，不建立审批、投票、评论、远程工单同步、自动建议或客户端状态。

成功标准：

1. 源文在 Obsidian、Studio、GitHub 和普通 Markdown 阅读器中仍能理解；
2. 标题、状态、日期、固定区段、段落、备选方案、影响类型、唯一性和总量失败关闭；
3. 构建与 Studio 预检拒绝晚于当前上海内容日期的未来决定；
4. Studio 提供结构化表单和 Markdown 往返，Obsidian 提供一键模板；
5. 阅读端、Studio 预览、搜索、桌面、320 px 和打印共享同一个事实契约；
6. 完整发布门、真实 Chromium 和生产 smoke 覆盖能力交付。

## 2. 项目结构状态

本轮功能提交：`bc2c725`。

新增结构：

- `lib/markdown-decision.ts`：mdast 抽取、严格校验、HAST Decision Brief 投影和搜索降噪；
- `studio/decision-editor.mjs`：Decap `myblog-decision` 结构化 editor component；
- `app/studio/decision-editor.mjs/route.ts`：显式同源 Studio 静态资源路由；
- `tests/markdown-decision.test.mjs`、`tests/studio-decision-editor.test.mjs`：语法、预算、日期、渲染、搜索、表单往返和资源契约；
- `docs/knowledge/0143-a-decision-record-is-a-tradeoff-ledger.md`：本轮可复用知识。

同步修改内容构建、Studio 草稿预检、共享 Markdown 管线、搜索、Studio 资源与预览状态、阅读/Studio/打印 CSS、Obsidian Publisher、生产 smoke、应用质量门和相关测试。Obsidian 插件从 1.52.0 升级到 1.53.0，并重新生成 3/3 SHA-256 bundle。

仓库中用户自己的 `README.md`、`docs/README.md` 修改以及三份 `docs/*_CURRENT.md` 新文件继续保留在工作区，本轮未暂存、未提交。

## 3. 设计内容

视觉方向采用 **Decision Brief**。左侧深色垂直 spine 写 `DECISION / LOCK`，顶部保存状态戳、真实日期和标题；正文上半部用不对称的 CONTEXT / DECISION 双栏形成“条件 → 结论”，RATIONALE 横跨全宽解释选择依据；下半部用 NOT SELECTED 与 IMPACT LEDGER 两张对照台账保存落选方案和正负/中性影响。

状态不是交互按钮，而是已发布事实。ACCEPTED 使用 signal 色；SUPERSEDED 保持档案墨色；DEPRECATED / REJECTED 使用克制的删除线提示。POSITIVE 使用 signal 色，NEGATIVE 使用正文墨色，NEUTRAL 使用弱化色，但三者的文字始终完整可见。

320 px 下，CONTEXT、DECISION、RATIONALE 依次堆叠，两个台账也改为纵向排列；标签和正文继续保持固定窄列，避免退化为一串通用卡片。打印允许整条记录跨页，但标题、叙述区和每一条台账项避免被分页切断。

`frontend-design` skill 让新组件服从 Commit Trace 的工程档案语言，同时用“决策锁 + 取舍台账”建立独立识别；没有添加装饰性渐变、圆角卡片、悬浮动作或仪表盘式状态。

## 4. 使用的技术

- Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- unified、remark-parse、remark-gfm、remark-rehype、mdast 与 HAST；
- CommonMark 块引用、段落与无序列表；
- Decap CMS 3.14.1 custom editor component、list/datetime/select fields；
- Obsidian Publisher 1.53.0、命令模板、三方版本联锁和 3/3 SHA-256 bundle；
- 语义 `<time datetime>`、CSS Grid、逻辑属性、响应式和打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests、Playwright CLI；
- Vercel 原生交付，不依赖 Cloudflare、数据库、审批系统或远程工单 API。

决策记录的最小语义参考了 [Decision Record 项目对 ADR 的定义](https://github.com/joelparkerhenderson/decision-record)、[ADR 模板目录](https://adr.github.io/adr-templates/) 和 [Michael Nygard 模板](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md)：重要决定需要保存背景、决定与后果。本项目额外要求显式理由与备选方案，以便个人学习复盘时看见当时的取舍，而不是只看最终答案。

## 5. 实现的功能

1. 识别正文顶层静态 `[!decision]`；
2. 元数据固定为 `STATUS + DATE`，状态只允许 ACCEPTED、SUPERSEDED、DEPRECATED、REJECTED；
3. 固定且不可增删、不可换序的 CONTEXT、DECISION、RATIONALE、ALTERNATIVES、CONSEQUENCES 区段；
4. 标题限制 1–120 字符；三段叙述分别限制 1–800 字符且必须各自恰好一段；
5. 每个决定包含 1–6 个备选方案和 1–6 条影响；每篇最多 3 个决定，全部台账项合计不超过 24；
6. 备选方案固定为 `**名称** — 说明`，名称 1–120 字符、说明 1–400 字符；NFKC + `zh-CN` 小写后不能重名；
7. 影响固定为 `POSITIVE / NEGATIVE / NEUTRAL + 说明`，说明 1–400 字符；
8. 日期必须是真实 ISO 日历日期；内容构建与 Studio 全字段预检拒绝未来决定，并返回正文来源行；
9. 叙述与说明允许文本、行内代码/公式、强调、删除与链接；图片、HTML、脚注、硬换行、任务状态、嵌套内容和额外段落失败关闭；
10. 阅读端输出语义 section、真实 `<time datetime>`、Decision Brief 和原生无序台账；
11. Studio 提供状态、日期、三段叙述、可排序备选和可排序影响，现有 Markdown 可完整回填；
12. `/studio/math-preview` 返回 `decisionCount`、`decisionAlternativeCount`、`decisionConsequenceCount`，错误状态显示 `DECISION / NEEDS FIX`；
13. Obsidian 新增“插入技术决策记录模板”，插件升级到 1.53.0；
14. 搜索保留标题、日期、背景、决定、理由、方案名称/说明和影响说明，删除 marker、区段名、状态及影响类型噪声；
15. 桌面、320 px、深浅色和打印保留全部事实，无横向溢出、隐藏项或交互边界；
16. 生产 smoke 锁定编辑器资源、共享预览计数、日期语义、Decision Brief 和无交互边界。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!decision] 选择 Vercel 原生托管
> **STATUS:** `ACCEPTED` · **DATE:** `2026-08-12`
>
> **CONTEXT**
>
> 需要一个能直接运行 Next.js 且减少额外平台层的公开托管方案。
>
> **DECISION**
>
> 使用 Vercel 作为生产托管平台。
>
> **RATIONALE**
>
> 它与当前 Next.js 构建、预览和 Git 交付链路直接对齐。
>
> **ALTERNATIVES**
>
> - **Cloudflare Pages** — 需要额外适配与维护。
> - **自托管** — 运维成本超出个人博客需要。
>
> **CONSEQUENCES**
>
> - `POSITIVE` 发布链路更短，框架支持更直接。
> - `NEGATIVE` 托管能力与 Vercel 平台耦合。
```

CommonMark 会把标记和紧随其后的元数据保存在同一个 paragraph 中，因此 mdast 校验读取第一段原始 children，随后严格验证 10 个区段节点。列表项既校验块级结构，也校验行内强类型节点；真实日期使用 UTC 零点往返验证。Studio 草稿预检和仓库构建分别把上海报告日传给同一解析器，未来日期不能从任一入口绕过。

共享 rehype 转换器把合法 blockquote 投影为 `data-decision="decision-brief"` 的 section，状态进入 `data-status`，日期进入真实 `<time datetime>`。Studio 自定义组件保存的仍是相同开放 Markdown，服务端预检继续是权威边界。搜索只修改 mdast 副本：保留有检索价值的自然语言证据与日期，删除视觉/结构 token。

## 7. 验证证据

- 决策专项与 Studio 组件：8/8；全量单元测试：636/636；
- `npm run lint`：0 error；12 条 warning 全部来自 `output/playwright` 中本轮和前轮的一次性验收函数；
- `npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，78 个生成页面/资源，新增 `/studio/decision-editor.mjs`；
- `npm run test:app`：35/35，通过安全/缓存、Studio、HTML/发现预算和全部公开路由；
- `npm run release:check`：184.3 秒内通过配置、内容、inbox、媒体、外链、lint、全部测试、类型、构建、应用检查与生产依赖审计；`npm audit --omit=dev --audit-level=high` 为 0 漏洞；
- 插件 bundle：`myblog-publisher@1.53.0 · 3/3 SHA-256 files`；
- Playwright 桌面：Decision Brief 宽 600 px，3/3 叙述区与 5/5 台账项可见，0 横向溢出，0 交互控件，状态 accepted，日期精确为 2026-08-12；
- Playwright 320 px：组件宽 248 px，3/3 叙述区与 5/5 台账项可见，0 横向溢出，长文本自然换行；
- Playwright print：Decision Brief 可跨页，3/3 叙述区和 5/5 台账项均为 `avoid-page`，0 隐藏、0 横向溢出；
- Playwright console：0 errors、0 warnings；截图位于 `output/playwright/decision-desktop-current.png`、`decision-mobile-current.png`、`decision-print-current.png`；
- 第一次核心渲染测试发现 remark-rehype 对紧凑列表项会省略 `<p>` 包装；渲染器改为同时接受 tight/loose list 的 HAST 形态，而 mdast 发布契约继续要求相同作者语义；
- 第一次搜索测试发现备选方案的视觉破折号会进入纯文本索引；搜索规范化现在只保留单个词间空格，避免结构符号降低自然语言命中；
- 第一次 Playwright 运行用 `about:blank` 加载 loopback CSS，被 Chromium Private Network Access 阻止；验收页先导航到同源 `/studio` 再注入内容后，CSS 正常加载且控制台清零；
- Playwright CLI 的 `run-code` shell 内联方式会把代码中的反引号当成命令替换；改用官方 `--filename` 参数后稳定执行，避免为了通过工具而篡改测试内容。

生产证据将在功能与归档提交推送、Vercel 收敛后补写；当前公开内容仍没有真实 `[!decision]` 样本，因此本地证据只证明能力与合成预览，不冒充真实作者决定。

## 8. 经验与教训

1. 决策记录的价值不在“我们最后用了什么”，而在“当时为什么这样取舍”；
2. 状态是发布事实，不是读者可操作的工作流按钮；
3. 备选方案必须与决定同时保存，否则几年后很容易把历史选择误解成唯一可能；
4. 正负影响需要平等可见，不能只保留成功结果；
5. 区段顺序固定能让 Studio、Obsidian、搜索和普通 Markdown 共享一个稳定结构；
6. NFKC 后判重可以挡住全角/半角伪重复，避免同一方案在台账中出现两次；
7. “已经作出”必须同时由 Studio 和构建日期门证明，不能只依赖作者记忆；
8. HAST 的 tight list 可以省略段落元素，发布校验与展示转换要区分职责；
9. 搜索应保留判断证据，删除状态、区段和类型标签等机械噪声；
10. 浏览器工具的运行方式也是证据链的一部分：同源上下文和文件参数比 shell 内联更可靠。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务账本、本地 MP3 音频笔记、参考资料清单、步骤流程、术语定义表、FAQ、项目文件树、项目时间线和技术决策记录。交付仍是 GitHub `main` → Vercel，不依赖 Cloudflare。

当前公开内容没有真实 `[!decision]` 样本。本轮证据覆盖语法、未来日期门、作者入口、共享预览、搜索、桌面、320 px 和打印，但不能证明作者填写的技术判断本身正确，也没有覆盖第一次在真实 Decap workflow 中拖动 6 个方案或真实 Obsidian 主题下查看长决定的效率。状态变化需要作者主动修改同一记录；第一版不会自动维护“被哪条决定替代”的反向关系。

## 10. 下一轮唯一主任务

建立受约束的技术实验记录块：用可迁移 Markdown 保存假设、环境、方法、测量结果、结论与局限，冻结指标/样本/长度预算、Studio/Obsidian 作者入口、搜索、窄屏和打印；不加入在线执行器、遥测采集、自动结论、统计显著性冒充或客户端状态。
