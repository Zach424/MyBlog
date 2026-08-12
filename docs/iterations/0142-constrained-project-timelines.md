# Iteration 0142：受约束的项目里程碑时间线

## 1. 范围与成功标准

本轮让作者能在文章与项目中发布“日期 + 事件类型 + 标题 + 简短说明”，用于记录已经发生的启动、决策、交付、变更、验证与退役事件。第一版只保存作者确认的历史，不接日历提醒、未来任务、项目管理同步、客户端动画或读者编辑状态。

成功标准：

1. 源文在 Obsidian、Studio、GitHub 和普通 Markdown 阅读器中仍可理解；
2. 日期真实性、类型、排序、重复、内容白名单和单篇总量失败关闭；
3. 构建与 Studio 预检拒绝晚于当前上海内容日期的未来事件；
4. Studio 提供可排序、可回填的结构化组件，Obsidian 提供一键模板；
5. 阅读、Studio 预览、搜索、1280 px、320 px 与打印共享一个事实契约；
6. 完整发布门、真实 Chromium 和生产 smoke 覆盖能力交付。

## 2. 项目结构状态

本轮功能提交：`7b5b7f0`。

新增结构：

- `lib/markdown-timeline.ts`：mdast 抽取、严格校验、HAST Release Tape 投影与搜索降噪；
- `studio/timeline-editor.mjs`：Decap `myblog-timeline` 结构化 editor component；
- `app/studio/timeline-editor.mjs/route.ts`：显式同源 Studio 静态资源路由；
- `tests/markdown-timeline.test.mjs`、`tests/studio-timeline-editor.test.mjs`：语法、预算、日期、渲染、搜索、组件与路由契约；
- `docs/knowledge/0142-history-is-not-a-schedule.md`：本轮可复用知识。

同步修改内容构建/Studio 预检、共享 Markdown 管线、搜索、Studio 资源与预览、阅读/Studio/打印 CSS、Obsidian Publisher、生产 smoke、应用质量门和相关测试。Obsidian 插件从 1.51.0 升级到 1.52.0，并重新生成 3/3 SHA-256 bundle。

仓库中用户自己的 `README.md`、`docs/README.md` 修改以及三份 `docs/*_CURRENT.md` 新文件继续保留在工作区，本轮未暂存、未提交。

## 3. 设计内容

视觉方向采用 **Release Tape**。顶部 Evidence Rail 显示 `HISTORY / NN EVENTS` 与首尾日期；每条事件由真实 `<time datetime>` 日期带、菱形轨迹节点、类型戳、标题和说明组成。START、SHIP、VERIFY 使用 signal 色强调，DECISION、CHANGE、RETIRE 保持克制的档案墨色。

它不是日历或路线图：没有未来列、提醒、进度条、完成按钮、滚动动画或“今天”游标。日期和含义直接存在于服务端 HTML，JavaScript 关闭、复制、搜索和打印都不会丢失。320 px 压缩为轨迹、日期、正文三列，事件类型与标题垂直排列；打印允许整条时间线跨页，但单条事件避免被分页切断。

`frontend-design` skill 让时间线继续服从 Commit Trace 的工程证据语言，同时通过日期磁带和类型戳形成独立识别，而不是落入通用圆点卡片时间线。

## 4. 使用的技术

- Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- unified、remark-parse、remark-gfm、remark-rehype、mdast 与 HAST；
- CommonMark 块引用和无序列表；
- Decap CMS 3.14.1 custom editor component、list/datetime/select fields；
- Obsidian Publisher 1.52.0、命令模板、三方版本联锁和 3/3 SHA-256 bundle；
- 语义 `<time datetime>`、CSS Grid、逻辑属性、响应式与打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests、Playwright CLI；
- Vercel 原生交付，不依赖 Cloudflare、数据库、日历或远程项目管理 API。

作者语法建立在 [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) 的块引用和列表上；Studio 使用 [Decap 自定义组件](https://decapcms.org/docs/custom-widgets/) 与 [list widget](https://decapcms.org/docs/widgets/)；阅读端日期使用 WHATWG 定义的 [`time` 元素](https://html.spec.whatwg.org/multipage/text-level-semantics.html)。

## 5. 实现的功能

1. 识别正文顶层静态 `[!timeline]` 和紧随其后的无序事件列表；
2. 标题限制 1–120 字符；每条时间线 2–16 个事件；每篇最多 3 条且合计不超过 32 个事件；
3. 事件首行固定为 `` `YYYY-MM-DD` `TYPE` **标题** ``，随后必须恰好一段说明；
4. 类型只允许 START、DECISION、SHIP、CHANGE、VERIFY、RETIRE；
5. 日期必须是真实 ISO 日历日期且非递减；同日不同事件保留作者顺序；
6. 同一时间线中“规范化标题 + 日期”不能重复；
7. 标题限制 1–120 字符，说明限制 1–600 字符；说明允许文本、行内代码/公式、强调、删除与链接；
8. 图片、HTML、脚注、硬换行、任务状态、嵌套列表、额外段落、有序列表、折叠 marker 和嵌套候选失败关闭；
9. 内容构建与 Studio 全字段预检拒绝未来事件，并返回正文来源行；
10. 阅读端输出语义 section、原生有序列表和真实 `<time datetime>`；
11. Studio 提供 datetime、类型选择、标题、说明和拖动排序，现有 Markdown 可往返回填；
12. `/studio/math-preview` 返回 `timelineCount`、`timelineEventCount`，错误状态显示 `TIMELINE / NEEDS FIX`；
13. Obsidian 新增“插入项目里程碑时间线模板”，插件升级至 1.52.0；
14. 搜索保留时间线标题、日期、事件标题与说明，删除 marker 和类型标签噪声；
15. 1280 px、320 px、深浅色与打印保留全部历史事实，无横向溢出或隐藏事件；
16. 生产 smoke 锁定编辑器资源、共享预览计数、日期语义和无交互边界。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!timeline] MyBlog 交付里程碑
> - `2026-07-19` `START` **建立内容契约**
>
>   用 Markdown 与 Zod 冻结内容边界。
> - `2026-08-02` `DECISION` **统一作者入口**
>
>   选择 Studio 与 Obsidian 共享发布契约。
> - `2026-08-12` `VERIFY` **完成生产验证**
>
>   完成自动化、移动端与打印验证。
```

mdast 层先识别顶层候选，再逐项校验准确节点序列、日期、类型、标题、唯一说明段和行内节点白名单。日期用 UTC 零点往返验证，避免 `2026-02-30` 被 JavaScript 自动纠正。排序只比较 ISO 日期字符串，同日不强行重排。Studio 草稿预检和仓库构建分别把上海报告日传给同一解析器，未来事件不能绕过任一入口。

共享 rehype 转换器把合法 blockquote 投影为 `data-timeline="release-tape"` 的 section。日期既显示为 YEAR + MM.DD，也保留机器可读 `datetime`。Studio 表单保存的仍是相同开放 Markdown；正式服务端预检继续是权威边界。搜索在 mdast 副本中保留日期和自然语言证据，只把类型 token 置空。

## 7. 验证证据

- 时间线专项与 Studio 组件：9/9；相关跨入口/插件/预览回归：271/271；全量单元测试：635/635；
- `npm run lint`：0 error，仅有 `output/playwright` 上轮临时验收脚本的 6 条 warning；
- `npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，77 个生成页面/资源，新增 `/studio/timeline-editor.mjs`；
- `npm run test:app`：35/35，通过安全/缓存、Studio、HTML/发现预算和全部公开路由；
- `npm run release:check`：144.2 秒内通过配置、内容、inbox、媒体、外链、lint、全部测试、类型、构建、应用检查与生产依赖审计；`npm audit --omit=dev --audit-level=high` 为 0 漏洞；
- 插件 bundle：`myblog-publisher@1.52.0 · 3/3 SHA-256 files`；
- Playwright 1280 px：3/3 事件可见，时间线宽 640 px，0 横向溢出，0 交互控件，3 个 `datetime` 精确；
- Playwright 320 px：时间线宽 288 px，3/3 事件可见，0 横向溢出，长说明自然换行；
- Playwright print：3/3 事件为 `break-inside: avoid-page`，0 隐藏、0 横向溢出；
- Playwright console：0 errors、0 warnings；截图位于 `output/playwright/timeline-desktop-current.png`、`timeline-mobile-current.png`、`timeline-print-current.png`；
- 第一次专项测试发现 AST 空格文本节点被通用“可见节点”过滤，导致首行 5 节点语义误判；改为只在精确首行读取原始 children 后 9/9 通过；
- 第一次浏览器验收命中了 3100 端口上的旧构建，页面把时间线降级为普通 Callout；核对进程命令行、替换为当前 build 后真实 Release Tape 通过。此经验阻止了用旧服务器的 HTTP 200 制造假绿；
- 第一次打印验收发现 Studio 预览 CSS 缺少单事件 `avoid-page`，补齐后重建并实测 3 条均为 `avoid-page`。

## 8. 经验与教训

1. 时间线首先回答“什么已经发生”，不能用视觉相似性偷换成“未来要做什么”；
2. ISO 日期格式正确不等于日历日期真实，必须做往返校验；
3. 同日事件可能有明确叙事顺序，排序约束应是非递减，而不是额外发明时分秒；
4. 日期与标题组合判重比只判日期更符合项目历史；
5. 类型标签适合筛读和视觉编码，但搜索应优先保留日期、标题和说明；
6. Studio 可以使用 datetime/select 改善输入，存储仍应保持开放 Markdown；
7. “只记录历史”必须同时进入 Studio 预检与仓库构建，否则任一入口都可能产生未来事实；
8. `<time datetime>` 让视觉日期和机器语义一致，不能只画日期磁带；
9. 浏览器验收前要确认监听端口对应当前构建，HTTP 200 和相同仓库路径都不足以证明产物新鲜；
10. 阅读 CSS 与 Studio CSS 是两个发送边界，移动端和打印规则必须分别实测。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务账本、本地 MP3 音频笔记、参考资料清单、步骤流程、术语定义表、FAQ、项目文件树和项目时间线。交付仍是 GitHub `main` → Vercel，不依赖 Cloudflare。

当前公开内容没有真实 `[!timeline]` 样本。本轮证据覆盖语法、未来日期门、作者入口、共享预览、搜索、桌面、320 px 和打印，但不证明作者记录的事件本身正确，也不覆盖第一次在真实 Decap workflow 中拖动 16 个事件的效率。时区边界使用构建报告日而非事件时间；若未来需要时分秒、跨时区或计划任务，必须建立新契约，不能扩写当前历史块。

## 10. 下一轮唯一主任务

建立受约束的决策记录块：用可迁移 Markdown 表达上下文、最终决定、原因、备选方案与影响，冻结段落/长度/唯一性、Studio/Obsidian 作者入口、搜索、窄屏与打印；不加入审批流程、投票、评论、自动建议、远程工单同步或客户端状态。
