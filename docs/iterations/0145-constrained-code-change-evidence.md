# Iteration 0145：受约束的代码变更证据

## 1. 范围与成功标准

本轮让作者能够在文章和项目中保存一份静态、可迁移、可审阅的代码修改证据。它既可以保存完整 Git unified diff，也可以用 before/after 展示一个文件的小范围改动；文件清单、目的、验证和风险与代码处在同一事实边界内。第一版不读取实时 Git、不执行或写回补丁、不修改仓库、不自动生成变更说明、不提供行级评论，也不保存读者状态。

成功标准：

1. 源文离开本站后仍是 Obsidian、GitHub 和普通 Markdown 阅读器可读的文本；
2. `UNIFIED` 与 `BEFORE_AFTER` 使用互斥、明确的结构，文件清单必须与代码证据一致；
3. 路径、状态、语言、日期、代码行数/字符数、列表项和文章总量均失败关闭；
4. Studio 提供结构化表单和两种模式的条件字段，Obsidian 提供一键静态模板；
5. 正式构建、全字段草稿预检与 Studio 生产预览共用服务端权威解析器；
6. 阅读、搜索、桌面、320 px 和打印保留同一份证据，不生成虚假的 Git 操作界面；
7. 自动测试、真实生产服务器和部署后 smoke 覆盖新增同源资源与预览契约。

## 2. 项目结构状态

新增结构：

- `lib/markdown-codechange.ts`：mdast 抽取、路径/diff/预算/敏感内容校验、HAST Review Docket 投影和搜索降噪；
- `studio/codechange-editor.mjs`：Decap `myblog-codechange` 结构化 editor component；
- `app/studio/codechange-editor.mjs/route.ts`：显式同源、`no-store` 的 Studio 模块路由；
- `tests/markdown-codechange.test.mjs`、`tests/studio-codechange-editor.test.mjs`：两种模式、失败路径、搜索、表单往返、样式和资源契约；
- `docs/knowledge/0145-a-code-change-record-is-a-review-envelope.md`：本轮可复用知识。

同步修改内容契约与构建入口、共享 Markdown 管线、搜索、公开代码渲染、Studio 资源/config/生产预览状态、阅读与 Studio CSS、Obsidian Publisher、生产 smoke、应用质量门和回归测试。Obsidian 插件从 1.54.0 升级为 1.55.0，并重新生成 3/3 SHA-256 bundle。

仓库中用户自己的 `README.md`、`docs/README.md` 修改以及三份 `docs/*_CURRENT.md` 新文件继续保留在工作区，本轮不暂存、不提交。

## 3. 设计内容

视觉方向采用 **Review Docket / 变更审阅卷宗**。左侧深色 spine 写 `CHANGE / REVIEW`；标题区只放模式、文件数、完成日期与变更标题。PURPOSE 是阅读入口，FILES / REVIEW INDEX 是文件级目录，代码舞台位于中部，VERIFICATION 与 KNOWN RISKS 在底部形成“已经证明什么 / 仍需留意什么”的边界。

`UNIFIED` 使用单个原生 diff 舞台；`BEFORE_AFTER` 在宽屏并排、窄屏依次显示。状态只在文件清单中使用克制的文字差异，不绘制伪 GitHub 工具栏、不提供 Apply、Comment、Approve、复制补丁或折叠文件等按钮。正式文章中的该代码区绕过通用 `CodeBlock` 客户端复制增强，保持无客户端状态的静态审阅证据。

320 px 下元数据、文件行、before/after 和验证/风险依次堆叠；代码区允许自身横向滚动而不撑破页面。打印允许整个卷宗跨页，但标题、目的、单个文件、代码舞台、验证项和风险项尽量不被切断；代码转为可换行的静态文本。

`frontend-design` skill 让新组件继续服从 Commit Trace 的工程档案语言，同时用“审阅 spine + 文件索引 + 深色代码舞台”形成独立识别，没有引入圆角卡片墙、悬浮操作、仪表盘或仿真的代码托管产品界面。

## 4. 使用的技术

- Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- unified、remark-parse、remark-gfm、remark-rehype、mdast 与 HAST；
- CommonMark 块引用、粗体固定区段、行内代码、无序列表和 tilde fenced code；
- Git unified patch 语义：`diff --git`、前/后映像、文件头、hunk、added/deleted/renamed 元数据；
- Decap CMS 3.14.1 custom editor component、条件字段、可排序 list、code 与 datetime widget；
- Obsidian Publisher 1.55.0、命令模板、三方版本联锁和 3/3 SHA-256 bundle；
- rehype-highlight、语义 section/time/list/code、CSS Grid、逻辑属性、响应式和打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests 与 production smoke；
- GitHub `main` 到 Vercel 的原生交付，不依赖 Cloudflare、数据库、实时 Git API 或补丁服务。

[Git diff 官方文档](https://git-scm.com/docs/git-diff)与[Git diff 格式说明](https://git-scm.com/docs/diff-format.html)共同定义前/后映像、文件段和 hunk 的文本语义；[Git format-patch](https://git-scm.com/docs/git-format-patch)提醒邮件补丁还包含提交传输语义，本项目没有把静态展示扩张成可应用补丁；[GitHub 的 Pull Request 说明](https://docs.github.com/en/pull-requests/get-started/about-pull-requests)与[标准化 Pull Request](https://docs.github.com/en/pull-requests/reference/managing-and-standardizing-pull-requests)强调 what/why、Files changed、检查和模板化上下文。本轮只取个人技术写作需要的最小审阅投影。

## 5. 实现的功能

1. 识别正文顶层静态 `[!codechange]`，每篇最多 2 条；
2. 元数据固定为 `MODE + DATE`，模式只允许 `UNIFIED` 与 `BEFORE_AFTER`，日期必须是真实 ISO 日期且不能晚于构建/Studio 报告日；
3. 固定且不可换序的 PURPOSE、FILES、CHANGE、VERIFICATION、RISKS；
4. 标题 1–120 字符、目的 1–800 字符；叙述只接受受限安全行内 Markdown；
5. 每条包含 1–4 个文件，每篇文件合计最多 6 个；状态只允许 ADDED、MODIFIED、DELETED、RENAMED；
6. 普通文件使用单个仓库相对路径；RENAMED 使用 `旧路径 -> 新路径`；拒绝绝对路径、反斜杠、空白、控制/保留字符、空段、`.`/`..` 与 `.git`；
7. 目标路径按 NFKC + 小写判重；路径最长 180 字符；
8. `UNIFIED` 必须从 `diff --git` 开始，文件段数量、顺序、前后路径和状态须与 FILES 一致；
9. MODIFIED/ADDED/DELETED 要求对应文件头、hunk 和有效变更行；RENAMED 要求 similarity index、rename from/to；拒绝 combined diff、binary patch 和 binary 摘要；
10. `BEFORE_AFTER` 只允许一个 MODIFIED 文件、同一种受支持语言且前后代码不能相同；
11. before/after 语言限定为常见 Web、配置、Shell 与纯文本语言，不接受任意高亮器名称；
12. 每个代码围栏最多 160 行、16,000 字符、单行 240 字符；每篇代码变更证据合计最多 240 行；
13. 检测私钥头、GitHub token 和 AWS access key ID；独立 `~~~` 结束行失败关闭，避免结构逃逸；
14. 每条包含 1–6 个验证项和 1–6 个风险项；验证名/风险名按 NFKC 唯一；名称、值和说明均有固定长度；
15. 阅读端输出 Review Docket、真实 `<time datetime>`、文件状态、原生 `<pre><code>`、验证与风险列表；
16. Studio 提供模式、日期、文件、完整 diff 或 before/after、验证和风险字段；现有 Markdown 可无损回填；
17. `/studio/math-preview` 返回 `codeChangeCount`、`codeChangeFileCount`、`codeChangeLineCount`，错误显示 `CODE CHANGE / NEEDS FIX`；
18. Obsidian 新增“插入代码变更证据模板”，插件升级到 1.55.0；
19. 搜索保留标题、日期、目的、文件路径/说明、有效代码、验证和风险，删除 marker、固定区段名、diff 文件头与 hunk 噪声；
20. 桌面、320 px、深浅色和打印保留全部事实，且不提供补丁执行或读者交互状态。

## 6. 实现方法

Unified 模式作者语法：

````markdown
> [!codechange] 为 Studio 增加代码变更编辑器
> **MODE:** `UNIFIED` · **DATE:** `2026-08-12`
>
> **PURPOSE**
>
> 让文章保留可审阅的实现依据，而不连接线上 Git 仓库。
>
> **FILES**
>
> - `MODIFIED` `lib/example.ts` — 收敛共享解析与渲染入口。
>
> **CHANGE**
>
> **DIFF**
>
> ~~~diff
> diff --git a/lib/example.ts b/lib/example.ts
> --- a/lib/example.ts
> +++ b/lib/example.ts
> @@ -1 +1 @@
> -export const enabled = false;
> +export const enabled = true;
> ~~~
>
> **VERIFICATION**
>
> - **Unit tests** `11/11` — 解析、预算和失败路径全部通过。
>
> **RISKS**
>
> - **示例漂移** — 编辑器与服务端必须继续共享固定契约。
````

Before/after 模式把 CHANGE 内部替换为 `**BEFORE:** \`ts\`` + 代码围栏和 `**AFTER:** \`ts\`` + 代码围栏。tilde fence 让 diff 中的 Markdown 反引号保持稳定；Studio 和 Obsidian 序列化每一行时继续加 blockquote 前缀。

mdast 解析器按真实节点序列验证 12 个 UNIFIED 子节点或 14 个 BEFORE_AFTER 子节点。服务端先解析自然语言和列表，再从 FILES 派生前/后端点，随后把每个 `diff --git` 文件段与同位置声明逐一比对。构建和 Studio 草稿预检把上海报告日作为 `maximumDate` 传入同一解析器。

共享 rehype 转换器把合法 blockquote 投影为 `data-code-change="review-docket"` 的静态 section。公开 `MarkdownContent` 识别 `.markdown-codechange-pre` 并保留原生 pre，避免通用复制按钮改变这一证据边界。Studio 自定义组件改善输入，但服务端预览和完整构建仍是最终权威；浏览器端的轻量校验不能取代共享 AST。

搜索在 mdast 副本上删除固定标签、状态与 diff 机械头，只留下读者可能检索的路径、代码和解释。它不读取 Git，也不从补丁推断摘要。

## 7. 验证证据

本地功能候选已通过以下门禁：

- `npm run release:check`：256.5 秒，配置、内容维护、inbox、根暂存媒体、外链库存、lint、全部测试、类型、生产构建、应用测试与生产依赖审计通过；
- 代码变更专项与 Studio 组件：11/11；全量单元测试：638/638；应用测试：35/35；
- Next.js 生产构建生成 80 个页面/资源，包含 `/studio/codechange-editor.mjs`；生产依赖审计为 0 漏洞；
- 插件 bundle：`myblog-publisher@1.55.0 · 3/3 SHA-256 files`；
- 真实 Chromium 桌面预览呈现 CHANGE/REVIEW、文件索引、UNIFIED DIFF、验证与风险，无操作按钮；320 px 下 viewport 320、根宽 305、正文 273，页面根无横向溢出，代码仅在自身舞台滚动；
- 浏览器从真实 `/studio/codechange-editor.mjs` 注册 `myblog-codechange/1`，生产预览计数为 `1/1/6`，控制台 0 error；打印 PDF 成功生成。

功能提交推送后的 Vercel 收敛、稳定生产 smoke 与最终提交哈希将在本轮第二笔归档提交中补全，当前不把本地合成预览误写成已上线证据。

修复过的真实失败：

1. 首次共享解析器按推测写成 13/15 个 mdast 子节点；实际 AST 是 UNIFIED 12、BEFORE_AFTER 14，已用真实 AST 和双模式样例锁定；
2. 公开 React renderer 会把新代码区误包进通用复制组件并丢失 pre class；已为 `.markdown-codechange-pre` 保留原生无交互渲染；
3. 插件升到 1.55.0 后两处版本联锁测试仍固定 1.54.0；已同步测试并重跑；
4. Studio 提示文案缩短时意外删除既有“完整文字稿”和公式使用说明，既有契约测试立即失败；已恢复既有信息并只追加代码变更入口。

## 8. 经验与教训

1. 代码变更证据不是代码片段：它必须同时回答为什么改、改了哪些文件、如何验证、还有什么风险；
2. 文件清单不能只是装饰，必须与 diff 文件段、顺序、路径和状态相互校验；
3. unified diff 与 before/after 服务不同阅读任务，不应让一种松散语法同时解释两者；
4. 静态博客应展示已经复核的变更，不应悄悄演化为补丁执行器或代码托管客户端；
5. 先限制路径、行数、字符数和敏感凭据，再做高亮与视觉；
6. 搜索需要有效代码与解释，但不需要 `diff --git`、`@@` 和固定区段名；
7. 通用 CodeBlock 的复制增强并不适用于所有代码语境，证据块可以明确保持无交互；
8. mdast/HAST 节点索引必须由真实解析结果证明，不能根据空行数量猜测；
9. Studio 条件表单提升可发现性，但浏览器端重复校验永远不能替代服务端单一权威；
10. 更新长提示文案时必须保留既有功能说明，回归测试应把作者可发现性视为产品契约。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务台账、本地 MP3 音频笔记、参考资料清单、步骤流程、术语定义表、FAQ、项目文件树、项目时间线、技术决策、技术实验与代码变更证据。交付仍是 GitHub `main` → Vercel，不依赖 Cloudflare。

当前公开内容没有真实 `[!codechange]` 样本。合成证据能证明语法、预算、作者入口、预览、搜索和布局，不证明展示的 patch 来自某个提交，也不校验 hunk 行号与完整源文件内容。重命名同时修改内容时仍可表示，但第一版只要求 rename 元数据正确；patch 应用、签名、commit SHA、PR/CI 状态、行级评论、折叠和读者审批继续关闭。

## 10. 下一轮唯一主任务

建立受约束的 HTTP 请求/响应证据块：用可迁移 Markdown 保存请求方法、脱敏 URL、允许的安全请求头、可选请求体、响应状态、允许的安全响应头、响应体、说明与验证；提供 Studio/Obsidian 作者入口、搜索、窄屏和打印。第一版只记录已完成且已脱敏的静态交换，不发起网络请求、不保存 Cookie/Authorization/API key、不重放请求、不生成客户端、不读取真实 API 凭据，也不连接远程服务。
