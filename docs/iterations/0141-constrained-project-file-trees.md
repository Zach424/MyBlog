# Iteration 0141：受约束的项目文件树

## 1. 范围与成功标准

本轮让作者能在文章与项目中发布“标题 + 文件夹/文件层级 + 节点职责”，用于解释仓库切片、模块边界和示例目录。第一版只保存作者确认的静态结构，不接在线文件浏览、远程仓库读取、客户端折叠状态或文件编辑。

成功标准：

1. 语法在 Obsidian、Studio、GitHub 和普通 Markdown 编辑器中仍可直接阅读；
2. 节点数、深度、路径段、完整路径唯一性、说明内容和单篇总量都有明确预算；
3. 文件夹可以拥有子节点，文件不能拥有子节点，错误结构失败关闭并返回来源行；
4. Studio 提供可增删、排序和回填的结构化组件，Obsidian 提供一键模板；
5. 阅读端、Studio 预览、搜索、320 px 和打印使用同一生产契约；
6. 完整发布门、真实浏览器布局与生产 smoke 覆盖能力交付。

## 2. 项目结构状态

本轮功能提交：`f0e3794`。

新增结构：

- `lib/markdown-filetree.ts`：mdast 抽取、严格校验、完整路径派生、HAST Repository Slice 投影与搜索降噪；
- `studio/filetree-editor.mjs`：Decap `myblog-filetree` 结构化 editor component；
- `app/studio/filetree-editor.mjs/route.ts`：显式同源 Studio 静态资源路由；
- `tests/markdown-filetree.test.mjs`、`tests/studio-filetree-editor.test.mjs`：语法、预算、渲染、搜索、组件和路由契约；
- `docs/knowledge/0141-a-file-tree-is-an-explanation-not-a-browser.md`：本轮可复用知识。

同步修改内容构建/Studio 预检、共享 Markdown 管线、搜索、Studio 资源与预览、阅读/Studio/打印 CSS、Obsidian Publisher、生产 smoke、应用质量门和相关测试。Obsidian 插件从 1.50.0 升级到 1.51.0，并重新生成 3/3 SHA-256 bundle。

仓库中用户自己的 `README.md`、`docs/README.md` 修改以及三份 `docs/*_CURRENT.md` 新文件继续保留在工作区，本轮未暂存、未提交。

## 3. 设计内容

视觉方向采用 **Repository Slice**。顶部 Evidence Rail 显示 `FILE MAP / NN NODES` 与 `DEPTH · NN MAX`；每个节点保留 `ROOT/BR` 层级轨、`DIR/FILE` 类型轨、等宽路径名和自然语言职责。文件夹使用 signal 色，文件保持 ink 色，嵌套列表以细竖线连续表达父子关系。

它不是 IDE：没有展开按钮、文件图标矩阵、当前选中态、悬停工具条或远程状态。层级和类型在文本上直接可见，JavaScript 关闭、复制、搜索和打印都不会丢失含义。320 px 时缩窄轨道，让说明落到路径下方并自然换行；打印保留全部节点并允许整棵树跨页，但单行节点避免分页断裂。

`frontend-design` skill 促使本轮延续 Commit Trace 的工程档案语言，同时把文件树做成独立的“仓库切片”，而不是通用卡片或模拟文件浏览器。

## 4. 使用的技术

- Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- unified、remark-parse、remark-gfm、remark-rehype、mdast 与 HAST；
- CommonMark 块引用和递归无序列表；
- Decap CMS 3.14.1 custom editor component 与扁平完整路径表单；
- Obsidian Publisher 1.51.0、命令模板、三方版本联锁和 3/3 SHA-256 bundle；
- CSS Grid、逻辑属性、响应式与打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests、Playwright CLI；
- Vercel 原生交付，不依赖 Cloudflare、数据库或远程 Git API。

作者语法建立在 [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) 的块引用和嵌套列表之上；Studio 入口使用 [Decap 自定义 widget/editor component](https://decapcms.org/docs/custom-widgets/) 的序列化边界，存储结果仍是开放 Markdown，而不是 CMS 专有 JSON。

## 5. 实现的功能

1. 识别正文顶层静态 `[!filetree]` 块和紧随其后的紧凑无序列表；
2. 标题限制 1–120 字符；每棵树 2–32 个节点、最深 4 层；每篇最多 3 棵且合计不超过 64 个节点；
3. 每行必须写成 `` `单个路径段` — 简短说明 ``；文件夹路径段以 `/` 结尾；
4. 路径段限制 1–79 字符，拒绝空白、斜杠、反斜杠、反引号、控制字符、`.` 和 `..`；
5. 解析器从祖先派生完整相对路径，并按 NFKC + `zh-CN` 小写规范化后拒绝重复；
6. 只有文件夹能拥有子列表，文件带子节点会失败关闭；
7. 说明限制 1–240 字符，只接受文本、行内代码/公式、简单强调与链接；图片、HTML、脚注、硬换行、任务状态和额外段落失败关闭；
8. `[!filetree]+`/`[!filetree]-`、有序列表、嵌套候选或畸形候选不能静默退化；
9. 内容构建和 Studio 全字段预检返回带正文行号的中文错误；
10. 阅读端输出带标题的语义 `<section>` 和原生嵌套 `<ul>/<li>` Repository Slice；
11. Studio 使用按文档顺序排列的完整相对路径表单，验证父目录后再序列化为可移植嵌套 Markdown；
12. `/studio/math-preview` 返回 `fileTreeCount`、`fileTreeNodeCount`、`fileTreeMaxDepth`，错误状态显示 `FILE TREE / NEEDS FIX`；
13. Obsidian 新增“插入项目文件树模板”，插件升级至 1.51.0；
14. 搜索保留标题、路径名和职责，去除 `[!filetree]`、末尾目录 `/` 与视觉分隔符噪声；
15. 320 px 无横向溢出或路径截断，打印保留完整层级；
16. 生产 smoke 锁定编辑器资源、共享预览计数、语义 HTML 和无交互边界。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!filetree] MyBlog 核心结构
> - `app/` — 页面、布局与同源路由。
>   - `studio/` — Git-backed 发布后台。
>     - `page.tsx` — 后台静态入口。
> - `lib/` — 共享内容解析与渲染。
> - `package.json` — 脚本、依赖与质量门。
```

mdast 层先识别顶层候选，再递归验证无序列表、条目唯一段落、行内代码路径、精确 ` — ` 分隔符、节点类型、深度、数量和说明白名单。每进入一层就携带祖先路径段，得到完整路径后才做规范化唯一性校验，因此不同目录下的同名文件合法，同一完整路径的全角/大小写变体不合法。

共享 rehype 转换器把合法 blockquote 投影为 `data-filetree="repository-slice"` 的 section，节点仍是原生嵌套列表。Studio 表单用完整路径降低拖动和编辑时的层级歧义；序列化时根据路径深度重建嵌套 Markdown，解析已有正文时再还原为相同顺序的完整路径。正式内容预检始终由服务器权威契约兜底。

搜索在 mdast 副本上把 marker 改为标题、去除目录末尾 `/` 并把分隔符换成普通空格，不引入视觉标签。阅读 CSS 和 Studio CSS 使用同一 class 词汇但独立尺寸；打印不依赖屏幕折叠状态，因为组件本身没有折叠状态。

## 7. 验证证据

- 项目文件树专项：9/9；跨入口/版本回归：261/261；全量单元测试：634/634；Mermaid：5/5；FAQ：9/9；
- `npm run lint`：0 error，仅保留上一轮 `output/playwright` 三个临时脚本的 3 条既有 warning；
- `npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，76 个生成页面/资源，新增 `/studio/filetree-editor.mjs`；
- `npm run test:app`：35/35，通过安全/缓存、Studio、HTML/发现预算和全部公开路由；
- `npm run release:check`：183.8 秒内通过配置、内容、inbox、媒体、外链、lint、全部测试、类型、构建、应用检查与生产依赖审计；`npm audit --omit=dev --audit-level=high` 为 0 漏洞；
- 插件 bundle：`myblog-publisher@1.51.0 · 3/3 SHA-256 files`；
- Playwright 桌面：7 个节点、最深 3 层、树宽 600 px、0 横向溢出、0 路径截断、0 交互控件；
- Playwright 320 px：树宽 248 px、0 横向溢出、0 路径截断，长说明和 `markdown-filetree.ts` 正常换行；
- Playwright print：7/7 节点可见、0 横向溢出、`break-inside: auto` 允许长树自然跨页；
- 截图：`output/playwright/filetree-desktop.png`、`output/playwright/filetree-mobile-320.png`；
- 第一次专项回归发现加粗说明前的作者空格被 AST 真实保留，同时搜索还保留 `/ —` 噪声；修正夹具和专用搜索规范化后 9/9 通过；
- 第一次 Studio 模块加载发现 Unicode 正则中转义反引号会触发语法错误，改为 `\x60` 后真实 import 与往返序列化通过；
- Playwright 首次把中文脚本直接作为 Windows 命令参数时破折号被拆分；改用 CLI `--filename` 后完成同一真实浏览器验收。这是 shell 编码问题，不是组件故障。
- 功能提交 `f0e3794` 与归档提交 `5e94e0d` 推送后，稳定生产 `/studio/filetree-editor.mjs` 在第 6 次有界轮询从 404 收敛为 200，返回 10,382 B，并包含 `myblog-filetree` 与 `registerStudioFileTreeEditor`；
- `npm run production:smoke -- https://blog-iota-five-59.vercel.app --expect-oauth`：45.5 秒内通过 27 条路由、GitHub OAuth 302、`fileTreeCount: 1`、`fileTreeNodeCount: 5`、`fileTreeMaxDepth: 3`、Repository Slice、原生嵌套列表、无交互边界及全部 HTML/发现资源预算；
- 当前生产仍没有真实公开 `[!filetree]` 内容，因此线上证据证明模块、作者资源和合成生产预览已交付，不冒充真实项目文章样本。

## 8. 经验与教训

1. 文件树首先是解释结构的文档，不是缩小版 IDE；静态层级通常比折叠状态更可迁移；
2. 节点名只保存当前路径段，完整路径必须由解析上下文派生后再判重；
3. 文件夹末尾 `/` 是低成本且可移植的类型信号，能让纯文本和 GitHub 阅读也不丢语义；
4. Studio 表单更适合编辑完整路径，公开 Markdown 更适合保存递归列表；两者可以是同一事实的可逆投影；
5. 先验证父目录再接受子路径，能避免表单生成视觉上嵌套、语义上悬空的节点；
6. 路径唯一性应覆盖 NFKC 和大小写，但不同父目录下的同名文件必须保留；
7. 搜索索引不应照搬视觉标点，路径、标题和职责才是读者真正查询的证据；
8. 静态块也要做 320 px 和打印验收，长文件名与四层缩进比普通段落更容易制造横向溢出；
9. 合成生产预览能证明契约和渲染，不证明作者描述的仓库结构仍然真实；
10. Windows 下复杂 Unicode 浏览器脚本应通过文件传入 CLI，避免命令行参数解析污染测试证据。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务账本、本地 MP3 音频笔记、参考资料清单、步骤流程、术语定义表、FAQ 和项目文件树。当前交付仍是 GitHub `main` → Vercel，不依赖 Cloudflare。

当前公开内容没有真实 `[!filetree]` 样本。本轮证据覆盖语法、构建、作者入口、共享预览、搜索、桌面、320 px 和打印，但不证明树描述与远程仓库持续一致，也不覆盖第一次在真实 Decap workflow 中拖动 32 个节点的效率。在线浏览、远程 GitHub 读取、自动扫描仓库、图标服务、客户端折叠/选中状态、文件内容预览和编辑继续关闭；作者必须在项目结构变化时更新正文与复核日期。

## 10. 下一轮唯一主任务

建立受约束的项目里程碑时间线：用可迁移 Markdown 表达日期、事件类型、标题与简短说明，冻结条目数量、日期排序/唯一性、Studio/Obsidian 作者入口、搜索、窄屏与打印；它只记录作者确认的历史事件，不接日历提醒、未来任务调度、外部项目管理同步或客户端动画。
