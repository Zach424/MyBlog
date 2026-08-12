# Iteration 0146：受约束的 HTTP 请求/响应证据

## 1. 范围与成功标准

本轮让作者能够在文章和项目中保存一份已经完成、已经脱敏、可迁移的 HTTP 请求/响应证据。它记录方法、状态、日期、目的、目标 URL、安全头字段、可选文本正文与验证，但永远不发送请求、不重放交换、不读取凭据，也不把博客变成 API 客户端。

成功标准：

1. 源文离开本站后仍是 Obsidian、GitHub 和普通 Markdown 阅读器可读的文本；
2. 请求与响应使用固定且可审计的双阶段结构，NONE 是显式空值而不是缺失语义；
3. 方法、状态、真实日期、URL、头字段、正文、Content-Type、无正文语义、敏感内容与文章总量失败关闭；
4. Studio 提供结构化编辑器，Obsidian 提供一键完整模板；
5. 正式构建、全字段草稿预检与 Studio 生产预览共用服务端权威解析器；
6. 阅读、搜索、桌面、320 px 和打印保留同一份静态证据，不生成伪 API 工具；
7. 自动测试、真实生产服务器和部署后 smoke 覆盖新增同源资源与预览计数。

## 2. 项目结构状态

新增结构：

- `lib/markdown-http.ts`：mdast 抽取、URL/头/正文/语义/预算/敏感内容校验、HAST Exchange Ledger 投影与搜索降噪；
- `studio/http-editor.mjs`：Decap `myblog-http` 结构化 editor component；
- `app/studio/http-editor.mjs/route.ts`：显式同源、`no-store` 的 Studio 模块路由；
- `tests/markdown-http.test.mjs`、`tests/studio-http-editor.test.mjs`：合法交换、NONE、失败路径、搜索、表单往返、样式与资源契约；
- `docs/knowledge/0146-an-http-exchange-record-is-not-an-api-client.md`：本轮可复用知识。

同步修改内容契约与构建入口、共享 Markdown 管线、搜索、公开代码渲染、Studio 资源/config/生产预览状态、阅读与 Studio CSS、Obsidian Publisher、生产 smoke、应用质量门和回归测试。Obsidian 插件从 1.55.0 升级为 1.56.0，并重新生成 3/3 SHA-256 bundle。

仓库中用户自己的 `README.md`、`docs/README.md` 修改以及三份 `docs/*_CURRENT.md` 新文件继续保留在工作区，本轮不暂存、不提交。

## 3. 设计内容

视觉方向采用 **Exchange Ledger / 交换台账**。左侧 spine 写 `REQUEST → RESPONSE`；标题区只放方法、状态、观察日期与交换标题。PURPOSE 与 `TARGET / REDACTED` 建立公开边界，中部 `01 REQUEST` 和 `02 RESPONSE` 沿单向轨道排列，每一阶段都有安全头字段台账与正文舞台，VERIFICATION 在底部说明实际核对结果。

设计没有仿造 Postman、浏览器 DevTools 或在线 API 控制台：没有 Send、Replay、Copy as cURL、Generate client、Auth、Cookies、Variables、History 或计时。头字段和正文的 NONE 保持可见，避免空白看起来像加载失败。正式文章中的正文围栏绕过通用 `CodeBlock` 客户端复制增强，保持静态证据边界。

宽屏把请求与响应并列，中间只有一个方向节点；`42rem` 以下改为纵向阶段，`32rem` 以下继续压缩头/验证列。正文只在自身舞台横向滚动，不撑破页面。打印移除方向装饰、把两阶段改为纵向并允许正文换行，但保留 URL、全部安全头字段、正文与验证。

`frontend-design` skill 让新组件继续服从 Commit Trace 的 Paper / Ink / Trace / Signal、直角规则线和压缩等宽标签，同时用“单向交换 spine + 两阶段 ledger”形成独立识别，没有引入圆角卡片墙、悬浮工具栏、渐变仪表盘或仿真客户端。

## 4. 使用的技术与资料

- Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- unified、remark-parse、remark-gfm、remark-rehype、mdast 与 HAST；
- CommonMark 块引用、粗体固定区段、行内代码、无序列表和 tilde fenced code；
- Decap CMS 3.14.1 custom editor component、list/code/datetime/select widget；
- Obsidian Publisher 1.56.0、命令模板、三方版本联锁和 3/3 SHA-256 bundle；
- rehype-highlight、语义 section/time/dl/list/code、CSS Grid、逻辑属性、响应式与打印媒体查询；
- Node test、ESLint、TypeScript、Next production build/application tests 与 production smoke；
- GitHub `main` 到 Vercel 的原生交付，不依赖 Cloudflare、数据库、远程 API 或凭据服务。

[RFC 9110](https://www.rfc-editor.org/info/rfc9110/)用于确认方法、状态和字段的通用 HTTP 语义；[IANA HTTP Method Registry](https://www.iana.org/assignments/http-methods/http-methods.xhtml)与[HTTP Field Name Registry](https://www.iana.org/assignments/http-fields/http-fields.xhtml)用于核对标准登记边界；[Hurl request](https://hurl.dev/docs/request.html)、[response](https://hurl.dev/docs/response.html)与[grammar](https://hurl.dev/docs/grammar.html)证明文本可以清楚表达一组请求/响应交换。本项目没有复制 Hurl 语言或执行能力，只采用“文本交换也可以成为可移植证据”的原则，并进一步收紧为静态博客安全契约。

## 5. 实现的功能

1. 识别正文顶层静态 `[!http]`，每篇最多 2 条；
2. 元数据固定为 METHOD + STATUS + DATE；方法只允许 GET、HEAD、POST、PUT、PATCH、DELETE、OPTIONS；状态为 100–599；日期必须真实且不能晚于构建/Studio 报告日；
3. 固定且不可换序的 PURPOSE、TARGET、REQUEST HEADERS、REQUEST BODY、RESPONSE HEADERS、RESPONSE BODY、VERIFICATION；
4. 标题 1–120 字符、目的 1–800 字符、目标 URL 最长 400 字符；说明只接受受限安全行内 Markdown；
5. 公网目标只允许 HTTPS；本机开发证据额外允许 localhost、127.0.0.1 与 `[::1]` 的 HTTP；拒绝 URL 用户名、密码和片段；
6. 查询参数名包含 auth/token/key/secret/password/session/signature/credential/code 时失败关闭；目标值仍检查常见令牌特征；
7. 请求头每条最多 10 个、响应头每条最多 12 个，每篇合计最多 30 个；空头字段用唯一 `NONE` 行；
8. 头字段必须符合 `Name: value`，名称使用 HTTP token 字符集合，按 NFKC + 小写唯一，值必须为不超过 240 字符的单行；
9. 拒绝 Authorization、Proxy-Authorization、Cookie、Set-Cookie、API key 及 auth/token/secret/password/signature/private-key/access-key 类字段；
10. 检测 Private Key、Bearer/Basic token、JWT、GitHub token、AWS access key ID 和常见 secret 赋值特征；
11. 请求/响应正文类型只允许 NONE、json、text、html、xml、graphql、form；NONE 后不得跟围栏；
12. 每个正文最多 80 行、8,000 字符、单行 240 字符，每篇正文合计最多 160 行；拒绝控制字符、独立围栏结束行与疑似凭据；
13. 非 NONE 正文必须有匹配 Content-Type：JSON/+json、text/*、text/html、XML/+xml、application/graphql 或 application/x-www-form-urlencoded；
14. GET/HEAD/OPTIONS 不接受请求正文；HEAD 与 204/304 不接受响应正文；
15. 每条包含 1–6 个验证项，名称按 NFKC 唯一，名称/结果/说明都有长度与敏感值约束；
16. 阅读端输出 Exchange Ledger、真实 `<time datetime>`、目标代码、请求/响应 section、头字段 `<dl>`、原生 `<pre><code>` 与验证列表；
17. Studio 提供方法、状态、日期、目的、目标、双侧头字段、双侧正文类型/正文和验证字段；现有 Markdown 可往返回填；
18. `/studio/math-preview` 返回 `httpExchangeCount`、`httpExchangeHeaderCount`、`httpExchangeBodyLineCount`，错误显示 `HTTP EXCHANGE / NEEDS FIX`；
19. Obsidian 新增“插入 HTTP 请求 / 响应证据模板”，插件升级到 1.56.0；
20. 搜索保留标题、方法、状态、日期、目的、目标、安全头值、正文与验证，删除 marker 和固定区段名；
21. 桌面、320 px、深浅色和打印保留全部事实，且不提供网络操作或读者交互状态。

## 6. 实现方法

作者语法：

````markdown
> [!http] 创建草稿文章
> **METHOD:** `POST` · **STATUS:** `201` · **DATE:** `2026-08-13`
>
> **PURPOSE**
>
> 记录草稿创建接口的脱敏请求与响应，方便复盘字段约定。
>
> **TARGET**
>
> `https://api.example.com/v1/posts?draft=true`
>
> **REQUEST HEADERS**
>
> - `Accept: application/json`
> - `Content-Type: application/json`
>
> **REQUEST BODY:** `json`
>
> ~~~json
> {"title":"HTTP 交换台账","status":"draft"}
> ~~~
>
> **RESPONSE HEADERS**
>
> - `Content-Type: application/json`
>
> **RESPONSE BODY:** `json`
>
> ~~~json
> {"id":"42","status":"draft"}
> ~~~
>
> **VERIFICATION**
>
> - **Status and schema** `PASS` — 状态码和脱敏响应结构与预期一致。
````

mdast 解析器先锁定 12 节点元数据段，再用 cursor 顺序消费固定区段。REQUEST/RESPONSE BODY 的 NONE 会使 cursor 跳过围栏，其他语言必须紧跟同语言代码节点；这比为所有组合维护固定总节点数更稳定。解析完成后再做跨字段语义：方法/状态的无正文规则，以及正文语言与 Content-Type 对齐。

URL 先通过原生 `URL` 解析，再限制协议、主机例外、credentials、fragment 和敏感查询参数。头字段从第一个冒号拆分，保留作者大小写用于展示，但唯一性使用 NFKC + `en-US` 小写；敏感名称与敏感值分开判定，避免把正常 `Content-Security-Policy` 之类字段误判成 secret。

共享 rehype 转换器把合法 blockquote 投影为 `data-http-exchange="exchange-ledger"` 的静态 section。公开 `MarkdownContent` 识别 `.markdown-http-pre` 并保留原生 pre，避免通用复制按钮制造 API 工具错觉。Studio 自定义组件改善输入，但服务端预览和完整构建仍是最终权威；浏览器端的镜像校验只负责尽早反馈。

搜索把整个 HTTP blockquote 替换为一段纯语义文本：方法、状态、目标、允许公开的头/正文和验证仍可检索，marker、区段名、围栏和 NONE 不进入索引。它不联网，也不从状态码推断成功。

## 7. 验证证据

功能候选与发布前阶段已完成：

- HTTP 解析/渲染/搜索/Studio 专项：10/10；
- Studio 生产预览与 config 回归：7/7；
- Obsidian 发布与插件全量回归：256/256（一次版本断言仍指向 1.55.0，修正为 1.56.0 后通过）；
- TypeScript `next typegen && tsc --noEmit`：通过；
- ESLint：0 error，16 条既有 Playwright 输出文件 warning；
- 插件 bundle：`myblog-publisher@1.56.0 · 3/3 SHA-256 files`；
- 最终完整 `npm run release:check`：153.2 秒通过，639/639 单测、81 个生成页面/资源、35/35 应用测试、生产依赖审计 0 漏洞；
- 真实 Chromium 桌面 1200 px：Exchange Ledger 1 个、交互控件 0 个，请求/响应各 459 px 并排；根宽 1,185 px，小于 1,200 px 视口；
- 真实 Chromium 320 px：根宽 305 px，无页面横向溢出；请求/响应各 241 px、同列且响应位于请求之后，TARGET 无内部溢出；
- 打印 PDF：2 页，方法、状态、日期、URL、请求/响应头、正文与验证完整；首轮发现 VERIFICATION 标题孤留第一页，给公开 CSS 与 Studio CSS 的整个验证区补上 `break-inside: avoid-page` 后，标题与验证项一并移至第二页并复验通过；
- 本地开发模式控制台只有严格 CSP 阻止 React 调试 `eval()` 的既有错误；正式构建与应用测试通过，不把该开发模式噪声计作生产功能错误。

功能提交、Vercel 收敛与稳定生产 smoke 将在同一轮完成后继续补写到本节。

## 8. 经验与教训

1. HTTP 交换证据不是请求工具：核心任务是解释已经发生的观察，而不是方便再次执行；
2. 脱敏必须同时覆盖 URL、头字段名、头字段值、正文和验证说明，不能只隐藏 Authorization；
3. HTTP 头名称大小写不敏感，作者展示大小写与系统唯一键应分开；
4. NONE 是重要语义：它让“没有公开头/正文”与“作者漏填”可以区分；
5. 方法、状态、正文和 Content-Type 是跨字段约束，不能由独立表单字段各自校验完就结束；
6. GET 请求正文虽然在协议历史中存在复杂边界，技术博客第一版应选择更清晰、可教的保守契约；
7. 可迁移 Markdown 可以借鉴文本 HTTP 工具，但博客不需要变量、捕获、断言引擎或执行语义；
8. 搜索应保留安全公开的 payload 与验证，不应保留固定结构噪声；
9. 代码围栏在证据块里不一定需要复制按钮，交互暗示本身也是产品边界；
10. 先用服务端 AST 冻结安全契约，再做 Studio 表单和视觉，可避免作者体验反过来扩大权限；
11. `break-inside` 只加在验证项上仍会留下孤立的区段标题；打印分组必须同时约束拥有标题和列表的外层容器，并通过实际 PDF 分页复核。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务台账、本地 MP3 音频笔记、参考资料清单、步骤流程、术语定义表、FAQ、项目文件树、项目时间线、技术决策、技术实验、代码变更与 HTTP 请求/响应证据。交付仍是 GitHub `main` → Vercel，不依赖 Cloudflare。

当前公开内容没有真实 `[!http]` 样本。合成证据能证明语法、安全预算、作者入口、预览、搜索和布局，不证明远端交换真实发生、时间顺序、TLS 身份、响应完整性或业务结论正确。敏感值检测是保守的发布门，不是完整 DLP；真实凭据仍必须在进入草稿前移除。

第一版不支持 TRACE/CONNECT/WebDAV 方法、请求重放、重定向链、Cookie、鉴权、变量、捕获、断言引擎、HAR/cURL 导入导出、SDK 生成、二进制/multipart、压缩体、计时、DNS/TLS 证据、实时状态和客户端历史。出现真实 API 测试任务时应使用 Hurl、curl、Postman、Bruno 或专用测试框架，只把脱敏结论投影到博客。

## 10. 下一轮唯一主任务

建立受约束的终端命令运行证据块：用可迁移 Markdown 保存已执行命令、操作系统/运行时、仓库相对工作目录、退出码、受限 stdout/stderr、说明与验证；提供 Studio/Obsidian 作者入口、搜索、窄屏和打印。第一版只记录已完成且已脱敏的静态运行，不执行或重放命令、不保存环境变量/凭据、不提供终端模拟器、不生成脚本、不连接远程 shell，也不持久化读者状态。
