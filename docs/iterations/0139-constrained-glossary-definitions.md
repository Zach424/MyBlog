# Iteration 0139：受约束的术语定义表

## 1. 范围与成功标准

本轮让作者能在文章与项目中发布局部语境明确的术语、定义、可选别名和可选上下文，同时继续以 Git Markdown 为唯一事实源。第一版只保存作者已经确认的静态知识，不接远程词典、自动翻译、知识数据库、客户端筛选或协同编辑。

成功标准：

1. 语法在 Obsidian、Studio、GitHub 和普通 Markdown 编辑器中仍可直接阅读；
2. 标题、条目、别名、上下文、单组和单篇规模都有明确预算，错误结构失败关闭；
3. 同一组的术语与别名经规范化后不能互相冲突；
4. Studio 提供可增删、可排序的结构化组件，Obsidian 提供一键模板；
5. 阅读端、Studio 预览、搜索、窄屏和打印使用同一生产内容契约；
6. 阅读端输出语义 `<dl>/<dt>/<dd>`，无按钮、网络请求和客户端状态；
7. 完整发布门、真实浏览器桌面/移动验收与生产 smoke 能证明能力收敛。

## 2. 项目结构状态

本轮功能提交：`b6afbaf`。

新增结构：

- `lib/markdown-glossary.ts`：mdast 抽取、严格校验、HAST Definition Ledger 投影与搜索降噪；
- `studio/glossary-editor.mjs`：Decap `myblog-glossary` 结构化 editor component；
- `app/studio/glossary-editor.mjs/route.ts`：显式同源 Studio 静态资源路由；
- `tests/markdown-glossary.test.mjs`、`tests/studio-glossary-editor.test.mjs`：语法、预算、渲染、搜索、组件和路由契约；
- `docs/knowledge/0139-definition-is-not-a-dictionary-service.md`：本轮可复用知识。

本轮同步修改内容解析/预检、共享 Markdown 管线、搜索、Studio 资源与预览、阅读/Studio/打印 CSS、Obsidian Publisher、生产 smoke、应用质量门和相关测试。Obsidian 插件从 1.48.0 升级到 1.49.0，并重新生成 3/3 SHA-256 bundle。

仓库中用户自己的 `README.md`、`docs/README.md` 修改以及三份 `docs/*_CURRENT.md` 新文件继续保留在工作区，本轮未暂存、未提交。

## 3. 设计内容

视觉方向采用 **Definition Ledger**。顶部 Evidence Rail 显示 `GLOSSARY / NN TERMS` 与 `CONCEPTS · STATIC`；桌面左侧是术语和别名索引，右侧是定义与 CONTEXT 证据轨；窄屏按“术语 → 别名 → 定义 → 上下文”堆叠。术语表不是步骤序列，因此没有数字编号，也没有暗示先后关系。

别名使用轻量等宽标签，帮助读者匹配缩写和另一种叫法；上下文使用独立细线轨道，强调“这个定义在本文为何成立”，但不冒充全局权威词典。打印保留术语与解释在同一条目中，并允许在条目边界分页。

`frontend-design` skill 将本轮收敛到“定义账本 + 上下文证据”，避免复用普通卡片、参考资料 Source Index、步骤路径或任务状态样式。

## 4. 使用的技术

- Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- unified、remark-parse、remark-gfm、remark-rehype、mdast 与 HAST；
- Decap CMS 3.14.1 custom editor component 与嵌套 list widget；
- Obsidian Publisher 1.49.0、命令模板、三方版本联锁和 3/3 SHA-256 bundle；
- CSS Grid、`color-mix()`、响应式媒体查询与打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests、Playwright CLI；
- Vercel 原生交付，不依赖 Cloudflare、数据库或第三方词典服务。

作者语法使用 [CommonMark](https://spec.commonmark.org/0.31.2/) 可移植的块引用、列表和段落；阅读投影使用 [MDN 定义列表](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dl)描述的 term/description 分组；Studio 入口基于 [Decap 自定义 widget/editor component](https://decapcms.org/docs/custom-widgets/)扩展，而不是创建第二种存储格式。

## 5. 实现的功能

1. 识别正文顶层静态 `[!glossary]` 块和紧随其后的无序列表；
2. 标题限制 1–120 字符；每组 2–12 个术语、每篇最多 3 组且合计不超过 24 个术语；
3. 每条必须包含“仅粗体术语 + 定义”两个段落；
4. 可选 `**别名：**` 和 `**上下文：**` 段落有固定次序，别名使用中文顿号分隔；
5. 术语 1–100 字符、定义 1–800 字符、1–5 个别名且每个 1–60 字符、上下文 1–400 字符；
6. 同一术语表内，术语和全部别名按 NFKC + `zh-CN` 小写规范化后全局唯一；
7. 定义和上下文允许文本、行内代码/公式、简单强调与链接；拒绝图片、HTML、脚注、硬换行、嵌套列表、任务 checkbox 和额外段落；别名只接受纯文本；
8. 内容构建和 Studio 全字段预检都返回带正文行号的中文错误；
9. 阅读端输出带标题的语义 `<section>` 与 `<dl>/<dt>/<dd>` Definition Ledger；
10. Studio 提供标题与 2–12 项可增删/拖动术语字段，并可回填已有 Markdown；
11. `/studio/math-preview` 返回 `glossaryCount`、`glossaryTermCount`，错误状态显示 `GLOSSARY / NEEDS FIX`；
12. Obsidian 新增“插入术语定义表模板”，插件升级至 1.49.0；
13. 搜索保留标题、术语、定义、别名与上下文，但去掉 `[!glossary]`、`别名：` 和 `上下文：` 标签噪声；
14. 桌面、390 px 和打印共享同一 Definition Ledger 语义与布局；
15. 生产 smoke 检查编辑器资源、共享预览计数、语义 HTML 身份与无交互边界。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!glossary] React 核心概念
> - **Server Component**
>
>   只在服务端渲染的 React 组件，不向浏览器发送该组件本身的 JavaScript。
>
>   **别名：** RSC、React Server Component
>
>   **上下文：** 在 Next.js App Router 中默认用于服务端数据读取和组合界面。
> - **水合**
>
>   React 在已有服务端 HTML 上绑定客户端行为的过程。
>
>   **别名：** Hydration
```

mdast 层只识别顶层候选，再验证 marker、唯一无序列表、条目数、段落数、纯粗体术语、可选标签顺序、行内节点白名单、字符预算以及术语/别名冲突。候选一旦匹配 `[!glossary]` 前缀却不满足契约就失败关闭，不会静默退化为普通 Callout。

共享 rehype 转换器位于参考资料、步骤和通用 Callout 之前，把合法 blockquote 投影为 `data-glossary="definition-ledger"` 的语义 section。`<dl>` 内以 `div` 分组对应的 `<dt>/<dd>`，让术语与解释保持一个视觉和打印条目；阅读页与 Studio 服务端预览复用该管线。Studio 自定义组件只负责生成和读取同一开放 Markdown。

搜索在 mdast 副本上移除 marker 与元数据标签，但保留别名本身，因此读者仍能用 `RSC` 或 `Hydration` 找到正文。HAST 和 Studio 预览在相邻 alias chip 之间加入真实文本空格，避免只依靠 CSS gap 导致无障碍名称和复制文本粘连。

## 7. 验证证据

- 定向集成：268/268 通过；
- 全量单元测试：632/632 通过；Mermaid 独立测试：5/5；
- `npm run lint`、`npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，74 个生成页面/资源，新增 `/studio/glossary-editor.mjs`；
- `npm run test:app`：35/35，通过安全/缓存、Studio、HTML/发现预算和全部公开路由；
- `npm run release:check`：126.9 秒内通过配置、内容、inbox、媒体、外链、lint、全部测试、类型、构建、应用测试与生产依赖审计；`npm audit --omit=dev --audit-level=high` 为 0 漏洞；
- 插件 bundle：`myblog-publisher@1.49.0 · 3/3 SHA-256 files`；
- Playwright Studio：`myblog-glossary` 注册成功，控制台 0 error / 0 warning；
- Playwright 合成预览：桌面 1440 px 与手机 390 px 均为 1 个术语表、2 个条目、3 个别名、2 条 CONTEXT，标题“React 核心概念”，无横向溢出；
- 截图：`output/playwright/iteration-0139-glossary-desktop.png`、`output/playwright/iteration-0139-glossary-mobile.png`；
- 第一次定向测试暴露三处夹具/断言问题：搜索断言误把人类可读的顿号当噪声、Studio 测试使用了注册表之外的标签、列表延续段落实际需要三个空格；修正预期、规范标签和序列化缩进后通过；
- 第一次 Playwright `run-code` 传入裸语句，第二次又尝试在 VM 中动态 import，均未执行目标预览；改为 CLI 规定的 `async (page) => { ... }` 文件后才取得有效 DOM 和截图证据。无效登录页截图已被最终证据覆盖，未记作通过。

生产收敛与线上 smoke 证据在功能和归档提交推送后补记。

## 8. 经验与教训

1. 术语定义属于文章局部知识，不等于可自动同步的全局词典；
2. 别名是可检索的人类意义，`别名：` 标签才是结构噪声；搜索不能把两者一起删除；
3. 术语与别名需要共用同一个规范化命名空间，否则同一概念可能以 term/alias 互换方式重复；
4. `<dl>/<dt>/<dd>` 提供语义，CSS Grid 只负责视觉布局；不能用两列普通 `div` 冒充定义关系；
5. CSS gap 不会成为复制文本或无障碍树里的分隔符，相邻 alias chip 仍需要真实空白文本；
6. Studio 表单是开放 Markdown 的便捷投影，不应成为第二事实源；
7. 特殊 marker 的错误结构必须失败关闭，并且转换优先于通用 Callout；
8. Markdown 列表延续段落的缩进属于作者协议，必须用真实解析器夹具固定，不能凭视觉猜测；
9. Playwright CLI 的 `run-code` 接受页面函数，VM 内动态 import 也不是默认能力；失败截图不能冒充目标页面证据；
10. 没有真实公开术语表样本时，应诚实区分“模块/合成生产预览”与“真实内容上线证据”。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务账本、本地 MP3 音频笔记、参考资料清单、步骤流程和术语定义表。当前交付仍是 GitHub `main` → Vercel，不依赖 Cloudflare。

当前公开内容没有真实 `[!glossary]` 样本。本轮证据覆盖语法、构建、作者入口、共享预览、搜索、桌面/移动和打印 CSS，但不覆盖第一次在真实 Decap workflow 中编辑 12 个术语的效率，也不证明术语内容本身正确。跨文章术语合并、自动反向链接、远程词典抓取、自动翻译、同义词推断、知识数据库、客户端筛选和协同审校继续关闭；知识内容仍由作者负责核实。

## 10. 下一轮唯一主任务

建立受约束的问答/FAQ 块：用可迁移 Markdown 表达“标题 + 多组问题/答案”，冻结单组/单篇预算、答案行内内容、Studio/Obsidian 作者入口、搜索、窄屏、打印和原生 `<details>/<summary>` 渐进交互；不加入投票、评论、远程问答库、客户端搜索或持久展开状态。
