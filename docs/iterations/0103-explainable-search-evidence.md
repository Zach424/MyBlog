# Iteration 0103：可解释搜索命中证据

## 1. 范围与成功标准

本轮只改善已有 `/search?q=` 的结果解释。迭代前，搜索已经支持服务端首屏、浏览器本地后续筛选、Unicode NFKC、多词 AND 和字段加权，但结果只显示“标题/标签/摘要/正文命中”的概括原因，没有标出具体词，也不能说明展示文本来自摘要还是正文。

成功标准是：保持内容模型、排名、URL 和无数据库架构不变；在标题、标签和摘要/正文证据中标示真实命中；规范化匹配必须映射回作者原文，不因全角、组合字符或兼容字符切错位置；只渲染 React 文本节点与原生 `<mark>`，不接受 raw HTML；字段原因、证据来源、浅深色 AA、320px 和焦点状态共同形成非颜色唯一的反馈；真实 Next、生产 smoke 和预算覆盖正向、正文命中与真实空结果。

## 2. 项目结构状态

- `lib/search-index.ts`：继续只在服务端把共享 Markdown AST 转为纯文本搜索文档；
- `lib/search.ts`：扩展搜索结果证据来源与安全文本分段，加入规范化索引到原文 grapheme 的映射；
- `components/SearchExperience.tsx`：用共享分段数据渲染标题、证据和标签的原生 `<mark>`，显示摘要/正文来源；
- `app/globals.css`：加入 evidence source 布局、命中视觉和搜索输入高优先级焦点轮廓，覆盖深色与 320px；
- `tests/search.test.mjs`：覆盖证据选择、全角、组合重音、兼容字符、重叠范围、原文重组与空查询；
- `tests/rendered-html.test.mjs`：锁定真实 `<mark>`、来源、字段原因、正文证据和空结果，并拒绝 `dangerouslySetInnerHTML`；
- `tests/quality-gates.test.mjs`：锁定浅深色 ink/trace AA 对比和焦点选择器契约；
- `scripts/smoke-production.mjs`、`tests/deployment-tools.test.mjs`：把三条搜索证据加入稳定生产冒烟；
- README、架构、发现、质量、运维、状态、路线图与迭代索引同步更新；内容 Markdown、frontmatter、OpenSearch、Studio、Obsidian 插件、workflow、依赖和 lockfile 未改变。

## 3. 设计内容

视觉继续使用 Commit Trace / Evidence Rail：浅色 canvas `#f2f6f7`、paper `#f8fafa`、ink `#18263d`、signal `#b9431f`、trace `#b9d8de`，深色沿用既有 token；展示、正文、代码分别沿用站点 display/body/mono 字体。搜索证据像一条可审计的“证据带”：左侧固定显示“摘要”或“正文”，右侧保留作者原文，并以 trace 背景和 signal 底线标出具体命中。

颜色不是唯一信息。结果上方继续显示字段原因，片段左侧显示来源文字，原生 `<mark>` 提供语义；命中文字显式使用 ink，避免继承摘要的 muted text 后在 trace 背景上对比不足。窄屏把来源与片段上下排列；搜索框的 `:focus-visible` 使用足够高的选择器优先级覆盖既有 input 样式。

## 4. 使用的技术

- Unicode NFKC 与 `toLocaleLowerCase("zh-CN")`：保持原有查询规范化和多词 AND 契约；
- `Intl.Segmenter("zh-CN", { granularity: "grapheme" })`：按用户可见字符建立原文边界；
- 规范化前缀长度与二分查找：把规范化命中范围映射回作者原文，随后合并相邻或重叠范围；
- React 文本节点与原生 `<mark>`：安全渲染数据分段，不使用 HTML 注入；
- Next.js Server/Client Component 边界：服务端索引仍不把 Markdown parser 或 KaTeX 带入客户端岛；
- WCAG 对比计算与 CSS 契约测试：命中文字浅深色均达到 4.5:1；
- Node test、真实 Next production server、浏览器桌面/320px/深色检查、GitHub Actions 与稳定 Vercel origin：多层验证；
- `research-iteration-loop`、`frontend-design` 与浏览器技能：用于全局选题、证据驱动实现和视觉/交互核对。

## 5. 实现的功能

1. 标题、标签和证据片段显示真实命中 `<mark>`；
2. 每条结果明确显示证据来自“摘要”或“正文”；
3. 摘要与正文按覆盖的不同查询词数量选择，覆盖相同时优先较短摘要；
4. 正文证据围绕首个规范化命中截取，并保留可读前后文；
5. 全角大小写、组合重音与兼容字符匹配后仍显示作者原文；
6. 重叠或相邻命中合并，文本分段重组后与原文完全一致；
7. 初始服务端 HTML 与浏览器后续输入复用同一搜索/证据函数；
8. 空查询不产生 mark，未知查询显示真实 0 条记录；
9. 深浅色命中文字达到 AA，移动端不横向溢出，搜索输入保留明确焦点轮廓；
10. 生产 smoke 验证 Cloudflare 正向、Wrangler 正文证据和 B_i 空结果，避免 RSC 载荷假阳性。

## 6. 实现方法

先在搜索单元测试中导入尚不存在的 `createSearchTextSegments()`；首次运行因缺少 export 产生 `SyntaxError`，证明失败测试确实覆盖目标缺口。实现没有对原文直接使用规范化字符串下标，因为 NFKC 可能改变码位长度。算法先按 grapheme 切分原文，计算每个原文前缀规范化后的长度，再把规范化查询命中通过二分查找映射到完整 grapheme 边界，合并范围后返回 `{ text, matched }` 数据。

结果上下文先分别统计摘要和正文覆盖的查询词数量，只在正文覆盖更多词时切换到正文；正文窗口以最早命中为中心保留 42 个前置和 118 个后置 grapheme。组件只把数据分段渲染为 React 文本和 `<mark>`，因此类似脚本标签的作者文本仍被转义，且重组后与原文逐字一致。

第一次真实 Next 集成检查用 `B_i` 作为正向正文词，却发现页面实际为 0 条；旧断言之所以通过，是因为它在 RSC 序列化的完整搜索文档中找到了文本。修正后改用真实正文词 Wrangler 验证 1 条正文证据，并把 B_i 固定为 0 条、无 mark 的反例。浏览器深色检查又发现 `<mark>` 继承 muted 文本导致对比偏弱，最终显式设置 ink；焦点样式检查发现通用 input `outline: 0` 的优先级覆盖全局规则，最终增加搜索输入专用选择器并用质量门锁定。

## 7. 验证证据

- 失败优先：`node --experimental-strip-types --test tests/search.test.mjs` 最初因 `createSearchTextSegments` 未导出而失败；
- 搜索定向测试 6/6 通过；修正 RSC 假阳性后的真实应用测试 20/20 通过；
- 浏览器核对桌面深色与真实 320px：Cloudflare 4 个可见 mark、3 条来源/原因，无横向溢出；Wrangler 为 1 条正文证据；B_i 为 0 条且无 mark；控制台 errors/warnings 均为空；
- 浏览器自动化不能合成 Tab 键，因此没有声称完成真实键盘遍历；本轮以语义 input、专用 `:focus-visible` CSS 和优先级质量测试锁定焦点契约；
- 功能提交前 `npm run release:check`：113.7 秒，485/485 单元测试、49 个构建页面、20/20 应用测试、九路 HTML 与七路发现预算全部 PASS、生产依赖审计 0；
- 功能提交：`a9ad890928eae109c7d908b6de2f19333e6795c1`；
- [Quality Gate #193](https://github.com/Zach424/MyBlog/actions/runs/31344153208) 与 [Production Smoke #186](https://github.com/Zach424/MyBlog/actions/runs/31344182434) 均成功；
- 稳定生产精确检查：Cloudflare 有 4 个真实 `<mark class="search-hit">` 和 3 个来源标签；Wrangler 为 1 条“正文”证据；B_i 为 0 条且没有 mark；
- 部署后完整生产 smoke：24 个 Sitemap URL、OAuth 302、三条搜索证据、九路 HTML 与七路发现预算全部通过；
- 稳定生产 `/search?q=cloudflare` 为 36194/13825 B raw/gzip，对 163840/17408 B 上限保有 +127646/+3583 B 余量；
- 归档与生产 smoke 自动化接入后的最终 `npm run release:check`：113.8 秒，485/485 单元测试、49 个构建页面、20/20 应用测试、九路 HTML 与七路发现预算全部 PASS、生产依赖审计 0；本地同路由为 35934/13812 B，余量 +127906/+3596 B。

## 8. 经验与教训

Next.js 响应 HTML 不只有用户可见 DOM，还可能包含 RSC 水合所需的序列化数据。搜索测试只用字符串包含关系会把索引中的词误当可见结果；必须同时断言结果计数、真实 `<mark>`、来源标签和反例无 mark，才能证明用户实际看到的内容。

规范化字符串的索引不能直接切原文。NFKC、组合重音和兼容字符会改变长度或组成；以 grapheme 为最小显示边界，再用规范化前缀长度建立单调映射，能同时兼顾搜索等价和作者原文保真。

新背景色不代表自动可读。`<mark>` 继承父级 muted 文本后，即使底线明显也可能达不到正文对比；显式文字 token、浅深色数值测试和实际浏览器检查缺一不可。焦点样式同样受 CSS specificity 影响，存在规则不等于实际生效。

## 9. 全局状态、风险与未解决问题

本轮后，站内搜索具备标准 OpenSearch 发现、服务端首屏、本地后续筛选、稳定 URL、可解释字段原因、证据来源和原文安全高亮。公开内容仍只有 4 条，完整纯文本索引随首屏序列化；当前生产 gzip 仍在冻结上限内，未来应让预算先报警，再决定分片或按需加载。

全局复核得到三个候选：

1. 详情页相关内容推荐：复用专题、共享标签与已验证引用/反向引用，最多 3 条并给出理由，直接改善搜索落地后的继续阅读；
2. 搜索类型筛选：在 URL 中增加 Article/TIL/Project 状态，但当前 4 条内容规模下筛选收益有限；
3. CSP nonce 可行性：`unsafe-inline` 仍是明确安全债，但影响全部 Next 流式渲染与缓存，应作为独立高风险架构迭代。

选择候选 1。它是读者可见、服务端可确定派生且无需外部 API 或新内容字段的增量；还能复用已验证知识关系，让搜索证据之后形成完整探索路径。候选 2 延后到内容规模增长，候选 3 继续独立评估。

## 10. 下一轮唯一主任务

为文章与项目详情增加确定性的相关内容推荐：只使用现有公开记录、专题、共享标签和已验证引用/反向引用关系，稳定计算分数与可见理由，最多展示 3 条；空集合时不渲染。服务端派生，不新增数据库、分析服务、客户端请求、内容字段或人工配置，并以纯函数、真实页面、320px/深色和生产预算验证。
