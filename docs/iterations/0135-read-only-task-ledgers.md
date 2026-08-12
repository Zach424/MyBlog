# Iteration 0135：受约束的只读任务清单

## 1. 范围与成功标准

本轮把 GFM 原生 `[x]` / `[ ]` 任务项提升为可命名、可校验、可搜索、可编辑、可打印的项目进度契约。它服务文章或项目复盘中的阶段状态，不承担读者端任务管理、多人协作、提醒、截止日期或数据库同步。

成功标准：

1. 作者使用 Obsidian/GFM 兼容语法表达标题、完成和待完成状态；
2. 每组 2–20 项、每篇最多 4 组且合计最多 40 项；标题最多 120 字符，单项最多 240 字符；
3. 任务必须位于顶层静态 `[!tasks]` 区块，裸任务列表、折叠、松散列表、嵌套列表、重复任务和复杂块内容失败关闭；
4. Studio 提供可增删、重排、勾选的结构化组件，Obsidian 提供快捷插入命令；
5. 阅读端保留列表顺序、完成状态和行内 Markdown，但所有 checkbox 都是 disabled；
6. 可见标题、DONE/OPEN 计数、原生 `<progress>`、搜索纯文本、窄屏和打印共用同一事实；
7. 不引入客户端任务管理脚本、本地存储、账户、远程状态或第二数据源。

## 2. 项目结构状态

本轮新增：

- `lib/markdown-task-list.ts`：任务清单抽取、预算/内联内容校验、HAST 转换与搜索降级；
- `studio/task-list-editor.mjs`：Decap `myblog-task-list` 自定义 editor component；
- `app/studio/task-list-editor.mjs/route.ts`：显式同源 Studio 资源路由；
- `tests/markdown-task-list.test.mjs` 与 `tests/studio-task-list-editor.test.mjs`；
- 本文件与 `docs/knowledge/0135-task-state-is-published-evidence.md`。

本轮修改共享 Markdown 类型/rehype 管线、内容文件和 Studio 结构化预检、搜索、Studio 预览计数/状态、生产与预览 CSS、Studio 配置/入口、Obsidian 插件版本/命令/bundle，以及质量门。功能提交为 `0797cfa`，首份归档为 `ce9f4a8`，稳定生产 smoke 门提交为 `7edb506`。

归档时工作区仍有用户自己的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件；本轮没有覆盖、暂存或提交它们。

## 3. 设计内容

视觉继续使用 Commit Trace / Evidence Rail，但语义角色收敛为 `TASK LEDGER`。顶部显示 `TASK LEDGER / NN ITEMS`、`NN DONE · NN OPEN`、标题、原生进度和百分比；每行显示不可交互的状态方框、任务正文和 `DONE` / `OPEN` 证据标签。

完成项使用信号色实心方框与删除线，待完成项保持空框和主文字色。checkbox 本身仍留在语义树中，但以 disabled 且视觉隐藏的原生 input 表达状态；自定义方框只负责外观。桌面使用三列行结构，390 px 下状态标签换到正文下一行。打印保留状态与进度，避免标题和单项内部断页。

## 4. 使用的技术

- Next.js 16.3、React 19、Route Handlers；
- unified、remark-gfm、remark-rehype、mdast 与 HAST；
- GFM task list 的 `listItem.checked` 状态；
- Decap CMS 3.14.1 editor component、list widget 与 boolean widget；
- Obsidian Publisher 1.45.0 与 3/3 SHA-256 bundle；
- 原生 disabled checkbox、`<progress>`、CSS Grid、响应式与 `@media print`；
- Node test、ESLint、TypeScript、Next production build/application tests；
- Playwright CLI 的真实浏览器语义快照和桌面/390 px 截图；
- Vercel 原生自动交付，不依赖 Cloudflare。

## 5. 实现的功能

1. 识别精确、顶层、静态的 `> [!tasks] 标题`；
2. 强制其后恰好一个紧凑无序 GFM 任务列表；
3. 裸任务列表、编号任务、折叠 marker、额外段落、嵌套和松散列表失败关闭；
4. 校验标题、单组/单篇数量和单项长度预算；
5. 要求每项都具有明确 boolean 完成状态和单个段落；
6. 允许文本、行内代码、强调、删除、链接和行内公式，拒绝图片、HTML、脚注和换行；
7. 对任务文本做 NFKC/中文小写规范化，拒绝同组重复任务；
8. 输出标题、计数、原生进度、语义列表和 disabled checkbox；
9. 为每个 checkbox 提供“已完成/待完成：任务文本”的可访问名称；
10. 标题和任务正文进入搜索，作者 marker 与视觉 DONE/OPEN 不进入索引；
11. Studio 提供标题和可排序任务项，每项包含 boolean 状态和单行文本；
12. Studio 可把既有任务区块回填为结构化表单，并稳定序列化回开放 GFM；
13. Studio 结构化发布预检和正式内容加载共用同一任务契约；
14. `/studio/math-preview` 返回 `taskListCount`、`taskItemCount`、`taskCompleteCount`，失败显示 `TASKS / NEEDS FIX`；
15. Obsidian 新增“插入项目任务清单模板”，只允许博客内容目录；
16. 插件升级到 1.45.0，三方版本联锁、未来 patch/minor 和 bundle 完整性测试同步顺延；
17. `/studio/task-list-editor.mjs` 进入静态构建和应用层路由门。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!tasks] 发布准备
> - [x] 冻结内容契约
> - [ ] 完成真实主题验收
> - [x] 发布 `main`
```

官方 GFM 解析会把任务状态保存在 mdast 的 `listItem.checked` 中，并把 marker 渲染为 disabled checkbox；因此状态可以在 AST 层校验，不需要正则推断，也不需要读者端 JavaScript。解析器先验证顶层结构、紧凑度、预算、唯一性与行内节点，再由 rehype 转换器把通过的 blockquote 提升为 Task Ledger。

搜索复用同一 AST，只把 `[!tasks]` marker 换成可见标题，任务正文和顺序自然保留。Studio 结构化表单最终序列化为同一 Markdown；Obsidian 命令也只插入模板，不保存独立状态。公开 HAST 里原生 input 保留 checked/disabled/aria-label，自定义标记用 `aria-hidden`，`<progress max value>` 提供只读完成比例。

## 7. 验证证据

- 新任务/Studio 定向测试与最终预览加固：全部通过；
- `npm run test:unit`：585/585；
- `npm run test:diagram`：5/5；
- `npm run lint`、`npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，70 个生成页面/资源；
- `npm run test:app`：35/35，十三条 HTML 与十一个结构化发现端点预算全部 PASS；
- 生产管线预览门：1 组、3 项、2 项完成、3 个 disabled checkbox，HTML 无 button/contenteditable/onclick；
- `npm audit --omit=dev --audit-level=high`：0 漏洞；
- 插件：`myblog-publisher@1.45.0 · 3/3 SHA-256 files`；
- Playwright Studio 登录页：0 console error / 0 warning；
- Playwright 语义快照：原生 progressbar、3 个有名称的 disabled checkbox、强调与行内代码均保留；
- 桌面与 390 px 截图：`output/playwright/iteration-0135-task-desktop.png`、`output/playwright/iteration-0135-task-mobile.png`；
- 功能提交：`0797cfa`；首份归档：`ce9f4a8`；稳定生产 smoke 门：`7edb506`；
- 稳定生产 `/studio/task-list-editor.mjs`：200、8147 bytes，包含 `registerStudioTaskListEditor` 与 `myblog-task-list`；
- 稳定生产合成预览：1 组、3 项、2 项完成，包含原生 progress、三个 disabled checkbox，无 button/contenteditable/onclick；
- 完整生产 smoke：27 routes、OAuth 302；十三条 HTML 与十一个结构化发现端点预算全部 PASS；
- 当前公开内容没有真实任务清单，因此浏览器使用共享生产端点返回的 HTML 夹具，不把它冒充为已发布文章或 CDN 证据。

## 8. 经验与教训

1. 任务状态是发布证据，不应被读者点击后产生无法保存的假状态；
2. GFM 已有稳定的 checked AST，优先复用开放语法，不另造 JSON 或 shortcode；
3. 仅限制每组数量不够，还需限制每篇组数和总任务数；
4. 松散列表在语义上仍可能合法，但会改变 HAST 结构；发布契约应显式关闭；
5. 完成状态必须同时有机器语义、可见状态和打印投影；颜色与删除线不能单独承担信息；
6. disabled 原生 checkbox 比假按钮更诚实，自定义方框只应是 `aria-hidden` 外观；
7. Studio 可提供接近文档工具的任务表单，但 Markdown 必须保持唯一事实源；
8. 搜索应索引标题和任务内容，不应泄漏 marker、DONE/OPEN 或百分比噪声；
9. 真实内容日期不应为了 UI 演示而改变；合成夹具更适合能力验收；
10. 共享预览测试应断言计数、状态与无交互，而不只检查 CSS class；
11. endpoint 的 Origin 保护会正确拒绝不一致浏览器请求，自动化夹具必须尊重同源边界；
12. 作者端可编辑与读者端只读是两种职责，不能因为输入是 checkbox 就默认公开交互。

## 9. 全局状态、风险与未解决问题

作者现在可从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、受限本地静音 MP4、受限多图画廊、受限技术表格和受限只读任务清单。任务清单不依赖 Cloudflare、数据库、第三方任务服务或读者端 JavaScript。

当前公开内容没有真实任务清单。本轮证明共享生产渲染协议、Studio 模块、搜索、移动/打印 CSS 与浏览器语义，不证明所有者第一次在真实 Decap workflow 中编辑 20 项任务的效率，也不证明真实文章上线后的 CDN 表示。第一版有意关闭读者勾选、拖动、截止日期、负责人、提醒、评论、筛选、全站任务聚合、进度历史和双向 Obsidian Tasks 同步。

## 10. 下一轮唯一主任务

建立受约束的参考资料清单：用可迁移 Markdown 组织官方文档、论文、仓库和延伸阅读，冻结标题、条目数量、可见链接文本、HTTPS/站内目标、可选短注释、Studio/Obsidian 作者入口、搜索与打印；不在构建期抓取远程标题、摘要或 favicon，也不引入书签服务。
