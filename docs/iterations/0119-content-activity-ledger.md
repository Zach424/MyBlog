# Iteration 0119：内容活动时间线

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0118 已让列表、搜索和知识图正确显示内容的首发/更新日期，但 `/archive` 有意只回答“内容何时首次形成”。本轮新增独立的 `/activity`，让读者按事件查看首次发布和真实更新，同时不改变 archive、搜索、知识图、frontmatter 与机器发现协议。

成功标准是：每条公开记录恰好派生一次 PUBLISHED；只有 `updatedAt > publishedAt` 才再派生一次 UPDATED；同日事件有确定性顺序；`reviewedAt` 永不产生事件；页面完全服务端渲染、进入 Sitemap 和 HTML 预算，不增加客户端请求、数据库、Cloudflare 或其他云配置。

## 2. 项目结构状态

- `lib/content/activity.ts`：新增活动事件、日期分组、计数与稳定排序纯函数；
- `lib/content/index.ts`：从内容边界导出活动模型；
- `app/activity/page.tsx`：新增纯 Server Component 页面、Metadata、事件 key、按日账本和继续发现入口；
- `app/archive/page.tsx`：增加“查看发布与更新活动”链接，archive 本身仍只显示首发；
- `lib/public-routes.ts`：登记 `/activity`，公开路由总数由 26 增至 27；
- `app/globals.css`：新增 diff rail、实心/双环节点、桌面与 390px 响应式样式；
- `scripts/smoke-production.mjs`：生产检查活动计数、事件模式、零 REVIEWED 与 Sitemap；
- `scripts/html-budget.mjs`：把 `/activity` 纳入第十三条真实生产 HTML 基线；
- `tests/content-activity.test.mjs`：覆盖事件派生、相等日期、决胜、输入不变和空集合；
- `tests/discovery.test.mjs`、`tests/rendered-html.test.mjs`、`tests/quality-gates.test.mjs`、`tests/html-budget.test.mjs`：锁定路由、SSR、导航、Sitemap 和预算；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/OPERATIONS.md`、`docs/QUALITY.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步架构、设计、运行、质量、状态和下一主线；
- `docs/knowledge/0119-event-ledger-semantics.md`：新增 Obsidian 知识笔记；
- 本文件：归档本轮完整证据。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

页面沿用 Commit Trace / Evidence Rail，但把视觉签名收紧为一条 diff rail：

```text
●  PUBLISHED   内容首次公开
◎  UPDATED     事实发生后续变化
```

桌面以左侧超大 `MM.DD` 日期和右侧事件轨迹组成双栏。手机把日期折成横向标记，把事件收为节点、元数据、正文三列。Signal 实心节点表示起点，Signal + Trace 双环表示变化；REVIEWED 只在顶部说明中出现，不进入轨迹。

页面复用既有 Canvas/Ink/Signal/Trace、display/mono 字体、规则线和深色 Token，不使用统计卡片、渐变、阴影、装饰图表或客户端动画。`/archive` 仍是首次发布日期档案，仅增加一个进入活动账本的链接。

## 4. 使用的技术

- Next.js 16.3 App Router、Metadata 与 Server Component；
- React 19 原生语义 HTML；
- TypeScript 判别联合、只读 view-model 与纯函数；
- 仓库 Markdown/YAML/Zod 已验证的 `ContentRecord`；
- ISO 日期字符串、`localeCompare` 与稳定多级决胜；
- 原生 `<ol>`、`<time dateTime>`、链接和 ARIA 标签；
- CSS Grid、伪元素轨迹、响应式与既有主题 Token；
- Node test 失败优先、ESLint、TypeScript、Next production build；
- Playwright CLI 真实 Chromium；
- Vercel GitHub Integration 与稳定生产 smoke；
- `Buffer.byteLength`、Node `gzipSync` 与十三路 HTML 预算；
- `research-iteration-loop` 的执行—验证—复盘节奏。

本轮没有增加 npm 依赖、Client Component、API Route、数据库、账户、追踪或 Cloudflare。

## 5. 实现的功能

1. 每条公开文章、TIL、项目产生一次 PUBLISHED 事件；
2. 仅当更新日严格晚于首发日时产生 UPDATED；
3. 同日 UPDATED 先于 PUBLISHED，随后按中文标题和英文 URL 决胜；
4. 事件按日倒序分组，并派生 records/events/days/published/updated 计数；
5. 当前四条公开记录生成 8 个事件和 5 个日期组；
6. `/activity` 输出 canonical、Open Graph、面包屑、事件说明和继续发现链接；
7. PUBLISHED 使用实心节点，UPDATED 使用空心双环；
8. `reviewedAt` 明确只表示复核，不制造活动；
9. `/archive` 可进入活动页，但自身排序和日期语义不变；
10. `/activity` 进入共享公开路由与 Sitemap，总数变为 27；
11. 生产 smoke 检查 4/4/0 事件模式与 27 路由；
12. `/activity` 进入第十三条 HTML raw/gzip 预算。

## 6. 实现方法

先写 `tests/content-activity.test.mjs`，首轮因 `lib/content/activity.ts` 不存在而失败，证明测试确实锁住新边界。夹具故意包含晚更新、同日更新、同日跨模式与反向输入顺序，以同时证明过滤、排序和输入不变。

活动模型先把每条记录展开为一到两个普通对象，再统一排序并用 `Map` 按日期分组。事件 id 使用 `mode:url`，不会引入数据库身份；模式顺序只在相同日期生效。`reviewedAt` 根本不进入投影，而不是先生成再隐藏。

页面只调用公开内容 getter 与纯投影，直接输出语义 DOM。CSS 首次实现使全局文件超过 100 KB 质量门；本轮删除了不必要的打印专用重复规则、中等断点重复布局和非必要位移动效，最终在不提高阈值的情况下把源文件压到 99,995 B。

HTML 预算分两次提交：先部署功能提交并从稳定生产域名测量真实响应，再把活动页与同批十三条路由写入预算。这样基线绑定已经上线的 `5fb508c`，而不是用本地输出自我放行。

## 7. 验证证据

- 失败优先：新活动模块不存在时目标测试失败；
- 目标活动测试：3/3；
- `npm run lint`：通过；
- `npm run test:unit`：524/524；
- `npm run build`：52 个页面；
- `npm run test:app`：30/30；
- 全局 CSS：99,995 B，仍低于 100 KB 硬门；
- Playwright 390×844 深色：根宽 390/390、5 日、4 PUBLISHED、4 UPDATED、0 REVIEWED、0 console errors；
- Playwright 1280×900 深色：根宽 1280/1280，首项为 `2026-08-06` 的 MyBlog 更新；
- 浏览器仅有 1 条 Next.js CSS preload 延迟未使用警告；
- 手机截图：`output/playwright/iteration-0119/.playwright-cli/page-2026-08-10T20-21-39-395Z.png`；
- 桌面截图：`output/playwright/iteration-0119/.playwright-cli/page-2026-08-10T20-22-19-545Z.png`；截图位于忽略目录，不进入 Git；
- 功能提交：`5fb508c`（`feat: add content activity ledger`），已推送并部署；
- 预算提交：`0138ad0`（`test: budget content activity route`），已推送；
- 稳定生产 smoke：27 routes、OAuth 302；十三条 HTML 与七个发现端点全部 PASS；
- 生产 `/activity`：37888/6401 B（raw/gzip），推导 gzip 上限 9216 B；
- 生产 Sitemap：27 条 URL；
- archive、搜索、知识图、frontmatter 和机器发现接口的反向断言继续通过。

## 8. 经验与教训

1. “发布日期”和“活动事件”是两个不同读者问题，应共享源事实但使用独立 view-model；
2. 复核日期不能因为看起来像时间戳就自动成为公开变化事件；
3. `updatedAt > publishedAt` 应在投影边界过滤，页面无需重复比较；
4. 同日排序必须显式声明模式顺序，否则输入顺序会泄漏到页面；
5. 事件模型应保存最小公开事实，不把完整内容记录传给 UI；
6. 分组最好发生在排序之后，Map 的插入顺序即可保留全局日期顺序；
7. 语义 HTML 账本比客户端时间轴库更适合当前规模、SEO 和无 JavaScript 阅读；
8. 视觉节点应表达事件差异，而不是只靠颜色；
9. 新页面的生产预算必须先部署、后实测、再冻结来源；
10. 质量门暴露的不只是功能错误：本轮同时发现日期组预期错误、预算路由登记位置错误和 CSS 超限；
11. 不应为通过体积门提高阈值；删除重复样式比预算豁免更可维护；
12. 公开路由总数必须继续来自共享清单，About、首页和 Sitemap 才不会漂移；
13. 页面增长策略应由真实事件数与传输预算驱动，当前不需要分页或筛选；
14. Obsidian 知识笔记、项目状态与实现证据继续保存在同一 Git 历史。

## 9. 全局状态、风险与未解决问题

读者现在可分别使用 `/archive` 回看首次形成时间，使用 `/activity` 回看发布与真实更新事件。搜索和知识图继续显示当前版本日期但保持原发现顺序；三个视图职责不再混淆。

活动页的事件数最多约为公开记录数的两倍，当前只有 8 项，服务端 HTML 和 gzip 余量充足。内容显著增长后应先观察第十三路预算，再决定按年导航、分页或服务端分段；不要提前加入客户端筛选。全局 CSS 仅比 100 KB 硬门少 5 B，下一轮任何视觉新增都必须先复用或提炼现有样式，不能继续线性追加。

首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择，不进入自动主线。

## 10. 下一轮唯一主任务

在首页增加纯服务端“最近活动”摘要，直接复用 `createContentActivity()` 的前三个事件并链接完整 `/activity`。保持首页既有 Building/Learned/Current focus、活动排序、archive、搜索、知识图和机器接口不变；优先提炼现有 CSS，不能突破 100 KB，也不新增客户端请求、数据库、追踪或云配置。
