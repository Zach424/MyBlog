# Iteration 0073：当前草稿精确站内链接目标

日期：2026-08-06
状态：完成
唯一主任务：把当前草稿作者意图中的 `LINKS` 从单一计数提升为可核对的精确目标清单，直接复用正式 Markdown 引用提取与目标/标题锚点验证事实，同时保持公开 outgoing/backlink 语义不变。

## 1. 范围与成功标准

MyBlog 的长期目标是让作者不依赖 Codex，也能从 Obsidian 或网页 Studio 安全维护和发布 Git 中的 Markdown。Iteration 0072 已让“查看当前草稿发布意图”只为目标草稿派生真实媒体，但 `LINKS` 仍只有一个数字；作者无法在发布前确认它具体指向哪个页面或标题，也看不到同一目标在正文出现几次。

本轮成功标准是：

- 每个唯一精确站内目标输出 `post / project / self`、最终公开路径（保留 fragment）、出现次数和全部源码行；
- 同一目标重复出现仍只占一个 `internalLinkCount`，但 `occurrences` 与 `sourceLines` 不丢失；
- 证据必须来自现有 GFM AST 和 `validatePreparedContentLinks` 循环，不再次扫描 Markdown，不在插件中解析链接；
- 原 `extractInternalContentReferences`、详情页 outgoing/backlink 与知识地图的页面级去重不变；
- version 2 readiness JSON 对未完成正式解析的草稿给出空清单，插件严格拒绝计数、顺序、类型、目标、自链接或重复目标漂移；
- 作者意图页只增加原生只读 trace，不增加跳转、修复、发布、动画或第二套导航；
- 不改变发布、Git、网络和 Cloudflare/Vercel 边界，不接云服务或真实 API。

回滚边界是功能提交 `57163eaf8974b84df728fb1fce6a0122e58f0dfd`。本轮未修改 Next.js 源码或调用 Next.js API，按仓库 `AGENTS.md` 无需选择 Next.js 编码指南。

## 2. 项目结构状态

功能提交修改十二个文件：

- `lib/content/markdown.ts`：新增同一次 AST 遍历的精确引用 evidence，并保留旧关系投影；
- `lib/obsidian-publishing.ts`：正式链接验证返回 `PreparedInternalLink[]`，count 由清单长度派生；
- `lib/content/inbox-readiness.ts`：报告升级 version 2，entry 保存并格式化精确目标；
- `.obsidian/plugins/myblog-publisher/main.js`：严格解析新 schema，并在当前意图页渲染 `LINK TRACE`；
- `.obsidian/plugins/myblog-publisher/styles.css`：增加宿主 token 驱动的 trace ledger 与移动端单列；
- `.obsidian/plugins/myblog-publisher/manifest.json`、`lib/content/author-doctor.ts`：插件和 doctor 期望同步到 1.24.0；
- `tests/content-relations.test.mjs`、`tests/obsidian-publishing.test.mjs`、`tests/inbox-readiness.test.mjs`、`tests/obsidian-plugin.test.mjs`、`tests/author-doctor.test.mjs`：覆盖兼容关系、精确证据、version 2、严格拒绝、Modal 和版本。

归档提交更新仓库根 Obsidian Vault 的 README、STATUS、ROADMAP、DESIGN、ARCHITECTURE、OPERATIONS、PUBLISHING、inbox 指南、公开项目页、迭代索引和本文件。GitHub 仍是唯一内容/代码事实源，Vercel 仍是当前生产托管，运行链路不依赖 Cloudflare。

## 3. 设计内容

用户主体是“准备发布一篇草稿、需要快速确认引用证据的作者”。1.24.0 保留 1.22.0 的 `AUTHOR INTENT / LOCAL EVIDENCE`、`DRAFT → PUBLIC`、READY/SCHEDULED/HOLD 和 `TYPE / DATE / MEDIA / LINKS`；数字概览仍用于扫读，新增 `LINK TRACE / n VERIFIED` 承担逐项核对。

trace 按引用首次出现顺序排列。每行只有三类事实：`POST / PROJECT / SELF`、精确公开目标 `<code>`、`L<n>` 源码位置；同一目标重复时追加 `×n`。目标不是超链接，行不是卡片，也没有动作菜单。视觉继续使用 Obsidian 宿主的 interface/monospace 字体、text token、规则线和既有 trace 色；窄屏降为单列。没有新色板、渐变、阴影、动画、完成率或第二套导航。

`frontend-design` 约束了这个选择：延续 Commit Trace / Evidence Rail 语言，用“源码行 → 已验证目标”的结构表达真实系统关系，而不是把结构化证据包装成通用 dashboard。

## 4. 使用的技术

- TypeScript、Node.js 22+、现有 `mdast-util-from-markdown` GFM + math AST；
- `InternalContentReference` 兼容投影与新的 `InternalContentReferenceEvidence`；
- 正式 `prepareObsidianNote`、内容目标索引、渲染器等价 heading slug 和 URL fragment 解码；
- version 2 只读 JSON、CommonJS exact-key parser 与交叉字段验证；
- Obsidian 原生 Modal DOM、宿主 CSS variables、响应式 CSS Grid；
- Node test runner、临时 Git/Sharp 夹具、ESLint、TypeScript、Next build、生产 HTTP 测试和 npm audit；
- `research-iteration-loop` 用于单主任务、失败优先、定向到全量门禁、全局复核、归档与下一任务冻结。

没有新增依赖、数据集、数据库、凭据、网络数据源、云服务或真实 API。

## 5. 实现的功能

- `prepareObsidianNote` 现在返回 `internalLinks`，每项含 `kind`、`target`、`occurrences` 与 `sourceLines`；
- 文章和项目目标保留 `/posts/<slug>` 或 `/projects/<slug>`，标题目标保留原 fragment；
- `[[#heading]]` 自链接被解析成当前草稿未来的精确公开路径与 fragment，而不是只显示裸 `#heading`；
- 同一精确目标重复出现时只生成一项，源码行按出现顺序保留，同一行的多个出现可重复记录同一行号；
- `internalLinkCount` 等于精确清单长度；无站内链接和阻塞在正式解析前的草稿都返回空清单；
- 文本版 inbox 报告逐项输出目标、行号和重复次数；
- MyBlog Publisher 1.24.0 在当前草稿作者意图页显示 `LINK TRACE`；
- 插件拒绝版本错误、缺字段、count/list 不一致、重复目标、次数/行号长度漂移、倒序或非法行号、类型/路由不一致、自链接不是当前公开目标以及不安全目标；
- 原有公开内容关系 API 继续返回相同引用结构，页面级 outgoing/backlink 去重与知识地图未变化。

## 6. 实现方法

`extractInternalContentReferenceEvidence` 复用原函数的 `parseMarkdown`、definition 表和一次链接 walk。Map key 沿用既有规则：文章/项目为 URL + fragment，自链接为 self + fragment。首次出现保存原 reference、一次 occurrence 和起始行；后续相同 key 只增加次数并追加位置。Map 的 insertion order 自然保留首次出现顺序。

`extractInternalContentReferences` 没有维护第二套逻辑，而是调用 evidence 函数并投影掉 `occurrences/sourceLines`。因此 `lib/content/relations.ts` 无需修改，原有页面关系测试在加入精确重复引用后仍得到相同引用集合和页面级关系。

`validatePreparedContentLinks` 改为消费 evidence。每项仍先执行原有页面存在、fragment URL 解码和真实 heading id 检查；只有验证通过才组装最终目标。无 fragment 直接使用页面 URL，有 fragment 追加原始 fragment，自链接先替换成当前 `kind + slug` 的公开 URL。`prepareObsidianNote` 只从数组长度派生旧 count，避免两个事实源漂移。

Readiness entry 无论成功或阻塞都拥有 `internalLinks`；成功时透传正式准备结果，阻塞默认空数组。schema 版本从 1 升到 2，避免旧插件把缺失字段当成可信证据。插件先检查 exact keys、prepared identity 和 count，再验证每项四个固定字段、类型、正整数 occurrence、等长且非递减的源码行、安全公开目标、唯一目标、kind 路由，以及 self 必须带 fragment 并精确指向当前草稿未来公开 URL。验证完成后 Modal 只消费数据，不接触 Markdown。

## 7. 验证证据

失败优先基线：定向运行五个相关测试文件时出现 8 个预期失败，归因于四个缺失契约——evidence 导出不存在、readiness 仍为 version 1、prepared result 没有清单、插件拒绝 version 2 且无法渲染 trace。测试夹具同时冻结了重复目标、自链接、项目链接和失败关闭路径。

实现后证据：

- 相关五文件定向回归 155/155；
- `npm run lint` 0 error、0 warning；
- `npm test` 通过 311/311 单元与集成、TypeScript、45/45 构建页面和 19/19 生产应用测试；
- `npm audit --omit=dev --audit-level=high`：0 vulnerability；
- 真实 `npm run content:inbox -- --format json` 返回 version 2、空 inbox、四项安全声明全为 false；
- 归档后的 `npm run release:check` 用时 129 秒：Release config、Current 1 / Historical 3、inbox 0、根暂存 0、外链本地问题 0、lint、311/311、TypeScript、45/45 页面、19/19 生产应用测试与生产依赖审计 0 全部通过；公开项目页仍满足 HTML 与部署产物预算；
- `git diff --check` 通过；功能提交只含十二个实现/契约文件。

## 8. 经验与教训

1. “唯一目标数”和“出现次数”是不同事实，不能为了显示重复引用而改变既有 count。
2. 精确证据应在验证循环里产生；在 UI 或 readiness 末端重新扫 Markdown 会制造第二套语义。
3. 兼容 API 最安全的演进方式是让旧接口成为新 evidence 的纯投影，而不是复制原遍历。
4. 自链接的作者价值来自未来公开地址；裸 fragment 对发布前核对不够明确。
5. 源码行数组比只保存 first line 更能解释重复引用，也能与 occurrence 做可验证的等长约束。
6. 同一行可以出现同一目标多次，因此行号要求非递减而不是严格递增。
7. schema 增加必需证据时必须升版本；宽松兼容会让旧消费者把不完整报告误判为可信。
8. 路由前缀与 kind、自链接与草稿身份必须交叉验证，单纯检查字符串“像 URL”不足以失败关闭。
9. 审计目标不应默认变成导航。当前任务是发布前确认，不是浏览站点；保持文本避免误触和功能漂移。
10. 关系兼容测试必须把相同精确目标真的重复写入 fixture，否则“公开语义没变”只是推测。

## 9. 全局状态、风险与未解决问题

作者现在可以在 Obsidian 独立创建、改名、清理旧身份、查看当前草稿类型/目标/日期/媒体数量/精确链接、检查并发布；网页 Studio 仍提供另一条独立发布路径。当前链接 trace 能解释文章、项目、自链接和重复出现，但不提供点击、编辑或自动修复，完整发布门仍是最终权威。

真实 inbox 当前为空，正向路径由临时 fixture 覆盖；尚无真实 Obsidian 宿主像素快照。源码行来自规范化后仍保持行数的 prepared Markdown；当前附件和 Wiki/Markdown 链接转换不增删换行，这一假设已有转换测试但没有独立 source-map 抽象。插件限制目标为当前支持的 `/posts` 与 `/projects` 路由；未来增加新的公开内容 kind 时必须同步 schema 和 parser。精确目标唯一性符合当前发布器可接受输入；若未来允许显式当前页 URL 与 self fragment 同时存在，需要重新冻结去重语义。

本轮没有改变公开内容集合、数据集或托管；Current 1 / Historical 3 / 未公开 0 保持稳定。Studio、Vercel、GitHub Actions、Cloudflare 历史边界和所有手动外部接入均未改变。

## 10. 下一轮唯一主任务

把当前草稿的 `MEDIA` 从单一附件数提升为精确媒体变换清单，直接消费 readiness 已验证的 source/target/public URL、输入输出格式、宽高、帧数、字节和 optimized 状态。必须保持 source-scoped 媒体调用集合、发布器和安全 schema 不变；不得重新读取图片、在插件中实现媒体规则、增加上传/修复/发布动作、引入云服务或真实 API。

## 结论

MyBlog Publisher 1.24.0 把一个无法解释的 `LINKS 3` 变成可追溯的发布证据，同时没有增加解析器或改变公开关系。作者能从源码行核对到最终公开目标，重复引用仍可见，错误证据严格失败关闭；界面继续本地、只读、宿主原生，并把发布动作留给原有完整门禁。
