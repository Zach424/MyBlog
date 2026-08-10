# Iteration 0118：搜索与知识图谱的更新日期语义

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0117 已让共享内容列表区分 PUBLISHED 与 UPDATED，但全局复盘发现两个探索界面仍在派生边界丢失 `updatedAt`：`SearchDocument` 和 `KnowledgeGraphNode` 只有 `publishedAt`，搜索结果与知识图节点因此把维护后的记录继续显示成首发日。

本轮只补齐探索数据链路与可见日期：搜索文档和图节点保留可选更新日，搜索结果、桌面 SVG 节点与移动孤立记录共同消费日期 presenter。成功还要求搜索相关性、首发决胜、空查询顺序、知识图排序和 archive 首发时间线保持不变；客户端边界只能增加可序列化的可选字符串，不新增请求、数据库、外部 API 或云配置。

## 2. 项目结构状态

- `lib/search.ts`：`SearchDocument` 增加可选 `updatedAt`，空查询原因由“最新记录”收紧为“首发顺序”；
- `lib/search-index.ts`：从统一内容记录向搜索文档传播更新日，仍按首发日排序；
- `lib/content/knowledge-graph.ts`：图节点增加可选更新日，节点比较器保持不变；
- `components/SearchExperience.tsx`：结果日期复用共享 presenter，显示 DATE MODE 与日期；
- `components/KnowledgeMap.tsx`：SVG 节点和孤立记录显示 `TYPE / DATE MODE / DATE`；
- `app/globals.css`：为搜索日期增加纵向层级，不改变结果网格断点；
- `tests/search.test.mjs`：覆盖更新日传播、首发排序和空查询原因；
- `tests/knowledge-graph.test.mjs`：覆盖更新日传播但不按更新日重排；
- `tests/rendered-html.test.mjs`：覆盖搜索、图谱和 archive 隔离的真实 SSR；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步架构、视觉、质量、生产证据、状态和下一主线；
- `docs/knowledge/0118-discovery-date-semantics.md`：新增 Obsidian 知识笔记；
- 本文件：归档本轮范围、实现、验证、上线、经验和风险。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、删除或暂存这些内容。

## 3. 设计内容

搜索结果的左侧信息改为：

```text
PROJECT
UPDATED
2026-08-06
```

类型继续使用 Signal 色，日期模式使用更弱的等宽文字，日期保持既有可读字号。空查询标题写作“按首发时间显示全部记录”，每行原因写作“首发顺序”；这两处明确告诉读者：看到 UPDATED 不代表列表已经按更新日排序。

桌面知识图节点使用一行紧凑文本：

```text
PROJECT / UPDATED / 2026-08-06
```

它仍为右侧 OUT/IN 计数和标题保留空间。`≤ 42rem` 时宽 SVG 按既有设计隐藏，完整关系账本继续承担引用方向；孤立记录用原生 HTML 保留同一日期语义。archive 仍显示“发布日期”，不进入这套探索展示。

## 4. 使用的技术

- TypeScript 可选字段和结构化纯对象；
- Next.js 16.3 Server/Client Component 可序列化 props 边界；
- React 19 客户端搜索与服务端 SVG/HTML；
- 共享 `getContentDatePresentation()` 纯函数；
- ISO 日期字符串、稳定首发排序和相关性决胜；
- 语义化 `<time dateTime>`、SVG `<text>` 与原生链接；
- CSS flex column 与现有颜色/字体 Token；
- Node test 失败优先、TypeScript、ESLint、Next production build；
- Playwright CLI 的 390×844 和 1280×900 深色真实浏览器；
- 十二路 HTML、七端点发现预算与 Vercel 生产 smoke；
- `research-iteration-loop` 管理执行、验证、复盘与下一步。

本轮没有新增 Next.js 路由、内容 schema 字段、客户端请求或第三方依赖。

## 5. 实现的功能

1. 搜索文档携带内容的可选 `updatedAt`；
2. 搜索结果显示 PUBLISHED/UPDATED 与真实日期；
3. 空查询明确说明按首发时间和首发顺序展示；
4. 查询结果仍按相关性、首发日和标题决胜；
5. 知识图节点携带内容的可选 `updatedAt`；
6. 桌面 SVG 节点显示 TYPE / DATE MODE / DATE；
7. 移动端孤立记录保留同一日期文本；
8. 知识图节点仍按 kind、首发日和标题排序；
9. archive 继续只使用发布日期和首发时间线；
10. 搜索客户端仍只接收可序列化的普通对象、字符串和数组。

## 6. 实现方法

先在搜索索引和知识图纯函数测试中构造“首发较早、更新较晚”的记录，并与“首发较新、没有更新”的记录并置。首次运行两个测试都失败：派生对象中的 `updatedAt` 为 `undefined`。这直接证明问题位于数据投影边界，而不是展示组件。

随后分别扩展 `SearchDocument` 与 `KnowledgeGraphNode`，在派生时复制可选字符串。排序表达式没有改动；测试同时断言首发较新的记录仍排在首发较早但更新较晚的记录之前，避免功能修复偷偷改变探索行为。

搜索客户端和知识图服务端组件都直接复用既有 presenter，不复制日期比较。搜索用原生 `<time>` 输出实际展示日；图节点用同一个 label/date 组合单行 SVG 文本，孤立记录每项只计算一次 presenter。浏览器复盘发现空查询行尾仍写“最新记录”，它与首发排序矛盾，因此改为“首发顺序”，并在单元和 SSR 中固定。

## 7. 验证证据

- 失败优先：搜索与知识图目标测试首次各因更新日丢失而失败；
- 目标测试：14/14，含共享日期 presenter；
- `npm run typecheck` 与 `npm run lint`：通过；
- `npm run test:unit`：521/521；
- `npm run build`：51 个页面；
- `npm run test:app`：29/29；
- 本地十二条 HTML 与七个发现端点预算：全部 PASS；
- 本地搜索：40961/14694 B；知识图：40257/8002 B（raw/gzip）；
- Playwright 390×844 深色搜索：4 个 UPDATED 日期、1 个 H1、根宽 390/390；
- Playwright 390×844 深色知识图：SVG 按断点隐藏，孤立记录为 `POST / UPDATED / 2026-08-04`，1 个 H1、根宽 390/390；
- Playwright 1280×900 深色知识图：四个 SVG 节点日期完整，根宽 1280/1280；
- 浏览器 console：0 errors；仅 1 条 Next.js CSS preload 延迟未使用警告；
- 搜索截图：`output/playwright/iteration-0118/.playwright-cli/page-2026-08-10T19-48-45-725Z.png`；
- 知识图截图：`output/playwright/iteration-0118/.playwright-cli/page-2026-08-10T19-50-43-650Z.png`；截图位于忽略目录，不进入 Git；
- 功能提交：`a0ddd5b`（`feat: align discovery update dates`），已推送 `main`；
- Vercel 搜索页在第 4 次有界轮询出现新语义；随后整组核对搜索、知识图与 archive 才运行 smoke；
- 稳定生产 smoke：26 routes、OAuth 302；十二条 HTML 与七个发现端点全部 PASS；
- 稳定生产搜索：41251/14704 B；知识图：40497/8013 B（raw/gzip），无需更新阈值。

## 8. 经验与教训

1. 数据字段在源记录中存在，不代表每个派生 view-model 都会自动保留；
2. 失败夹具应制造“更新日与首发排序相冲突”的记录，才能同时证明传播和排序不变量；
3. 展示更新时间与按更新时间排序是两个产品决策，必须分开建模和测试；
4. 空查询的标题、行尾原因和日期标签必须使用同一排序词汇；
5. Client Component 新增字段应保持最小、可序列化，不把完整内容记录或 Date 对象跨边界传递；
6. 共享 presenter 可以安全进入客户端模块，因为它只含纯数据和纯函数，不读取服务端资源；
7. SVG 节点适合紧凑单行日期，HTML 列表适合纵向层级，同一语义不要求相同 DOM；
8. 移动端隐藏图形时，关键事实必须在保留的原生 HTML 路径中仍可读；
9. 视觉复盘能发现测试未直接覆盖的文案矛盾，例如“最新记录”与首发排序；
10. 生产部署要等待相关页面整组收敛，不能只看到单一路由更新就宣布完成；
11. 可选标量对当前搜索传输影响很小，但仍必须用真实 gzip 预算证明；
12. archive 的独立首发职责继续通过反向断言保护，避免“统一”变成语义破坏；
13. Obsidian 知识笔记、项目状态与代码继续由同一 Git 历史保存。

## 9. 全局状态、风险与未解决问题

首页、About、项目 status、通用内容列表、搜索和知识图现在都从共享展示事实解释可变内容；搜索与图谱不再把维护后的内容标成首发日。搜索排序、知识图布局与 archive 时间线仍各自保持原有职责。

新的产品缺口由此更清楚：archive 只记录首次发布是正确设计，但站点还没有一个入口按事件展示“何时首次发布、何时真实更新”。下一轮可从同一公开记录纯派生 Published/Updated 活动流；`reviewedAt` 只证明复核，不应伪装成内容变化。新页面会增加公开路由和 HTML，必须同步公共路由事实、Sitemap、浏览器与预算证据。

搜索仍把四条完整纯文本记录和可选更新日序列化给客户端；当前余量充足，内容显著增长后再由预算驱动分片。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择，不进入自动主线。

## 10. 下一轮唯一主任务

新增纯服务端内容活动时间线：每条公开记录派生一次 PUBLISHED 事件，仅在 `updatedAt > publishedAt` 时再派生一次 UPDATED 事件；按事件日期倒序并用事件类型、内容类型、标题和 URL 稳定决胜。

提供从 archive/发现路径可进入的公开页面，接入共享路由事实与 Sitemap；保持 archive、搜索、知识图、frontmatter、机器发现接口和现有排序不变，不使用 `reviewedAt`、客户端请求、数据库或云配置。
