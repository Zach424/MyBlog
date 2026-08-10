# Iteration 0117：共享内容列表的更新日期语义

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0116 统一项目状态后，全局复盘发现通用 `ContentIndexList` 始终显示 `publishedAt`。MyBlog 项目实际更新到 2026-08-06，`/projects` 却仍显示 2026-07-18；文章、专题、标签和引用账本也有同样歧义。`/archive` 则有意回答“内容何时首次形成”，必须继续按首发日组织。

本轮只建立通用列表日期语义：`updatedAt` 严格晚于 `publishedAt` 时显示 UPDATED 与更新日；无更新或同日更新显示 PUBLISHED 与首发日；所有 `ContentIndexList` 消费者共同接入；archive 明确排除。成功还要求不改变排序、frontmatter、机器接口或客户端边界，覆盖纯投影、五类真实 SSR、390px 深色和稳定生产预算。

## 2. 项目结构状态

- `lib/content-presentation.ts`：新增内容日期纯 presenter，返回 PUBLISHED/UPDATED 与对应日期；
- `components/ContentViews.tsx`：`ContentIndexList` 为每条记录计算一次日期投影，渲染 TYPE / DATE MODE / DATE；
- `app/globals.css`：新增日期纵向布局和更弱的 date mode 字号/颜色；
- `tests/content-presentation.test.mjs`：新增晚更新、无更新、同日更新和输入不变测试；
- `tests/rendered-html.test.mjs`：覆盖 posts/projects/series/tags/引用账本，并反向锁定 archive 隔离；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步架构、视觉、质量、生产证据、状态和下一主线；
- `docs/knowledge/0117-published-versus-updated-dates.md`：新增 Obsidian 知识笔记；
- 本文件：归档本轮范围、实现、验证、上线、经验和风险。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、删除或暂存这些内容。

## 3. 设计内容

列表左侧元数据由两层变成三层：

```text
PROJECT
UPDATED
2026-08-06
```

类型继续用 Signal 色，UPDATED/PUBLISHED 使用更弱的等宽小字，日期保持既有字号。标签和日期在同一个语义化 `<time>` 内，`dateTime` 指向实际展示日。纵向堆叠复用原列宽，不为多一行信息压缩标题。

archive 保持 `07.18` 和无障碍“发布日期 2026-07-18”。它记录首次形成的工程时间线，而共享列表表达当前可阅读记录的最近维护状态；两种日期都真实，但回答的问题不同。

## 4. 使用的技术

- TypeScript 纯函数与 ISO 日期字典序；
- 经过 Zod 内容契约保证的 `publishedAt/updatedAt`；
- React Server Component 共享列表；
- 语义化 `<time dateTime>` 与可见 date mode；
- CSS flex column、现有字体和颜色 Token；
- Node test 失败优先、TypeScript、ESLint、Next production build；
- 真实 production-server HTTP 与十二路 HTML/七端点预算；
- Playwright CLI 390×844 深色页面、DOM、console 和截图；
- Vercel Git Production、边缘收敛轮询和整站 smoke；
- `research-iteration-loop` 管理执行、验证、复盘与下一步。

本轮没有新增 Next.js API、客户端组件、请求或数据字段。

## 5. 实现的功能

1. 晚于首发的 `updatedAt` 显示 UPDATED 和更新日；
2. 缺少 `updatedAt` 显示 PUBLISHED 和首发日；
3. `updatedAt === publishedAt` 仍显示 PUBLISHED，避免伪造一次后续维护；
4. `/posts` 列表显示文章真实更新日期；
5. `/projects` 列表显示项目真实更新日期；
6. 专题详情中的文章列表使用相同语义；
7. 标签详情中的混合内容列表使用相同语义；
8. 项目/文章详情的引用账本使用相同语义；
9. `/archive` 继续显示首发日期并按首发日组织；
10. 原有列表排序和所有机器接口保持不变。

## 6. 实现方法

先扩展既有 `tests/content-presentation.test.mjs`；首次运行因 `getContentDatePresentation` 不存在而失败。实现接受最小的 `{ publishedAt, updatedAt? }`，只在更新日严格更晚时选择 UPDATED，其他情况回到 PUBLISHED。日期已经由内容 contract 校验为固定 ISO 格式，因此纯函数可安全使用字典序比较。

`ContentIndexList` 的 map 从隐式返回改为块体：每条记录只调用一次 presenter，再把 label 和 date 放入同一 `<time>`。没有改变记录顺序、标题、链接或行尾 meta。CSS 新类只控制日期内部的纵向密度。

SSR 首次失败不是页面逻辑问题，而是测试期望小写 `datetime`；真实 React 输出在当前生产服务器中为 `dateTime`。断言改为匹配实际 HTML 后，29/29 应用测试通过。测试同时要求 archive 不出现 `.content-index-date`，避免未来为了复用组件破坏时间线语义。

## 7. 验证证据

- 失败优先：目标测试先因日期 presenter 导出不存在而失败；
- presenter 目标测试：3/3（含原 status 测试）；
- `npm run typecheck` 与 `npm run lint`：通过；
- `npm run test:unit`：519/519；
- `npm run build`：51 个页面；
- `npm run test:app`：首次 28/29，修正真实 `dateTime` 属性匹配后 29/29；
- 本地十二条 HTML 与七个发现端点预算：全部 PASS；
- 本地 `/posts`：22925/5091 B；项目详情：113375/25375 B（raw/gzip）；
- Playwright `/projects`：UPDATED 2026-08-06，1 个 H1、零横向溢出；
- Playwright `/posts`：UPDATED 2026-08-05，1 个 H1、零横向溢出；
- Playwright `/archive`：共享日期组件 0，首条仍为“发布日期 2026-07-18”，1 个 H1、零横向溢出；
- 浏览器 console：0 errors；仅 1 条 Next.js CSS preload 延迟未使用警告；
- 项目截图：`output/playwright/iteration-0117/.playwright-cli/page-2026-08-10T19-28-13-300Z.png`；
- 文章截图：`output/playwright/iteration-0117/.playwright-cli/page-2026-08-10T19-28-34-166Z.png`；截图位于忽略目录，不进入 Git；
- 功能提交：`c73eb2c`（`feat: surface content update dates`），已推送 `main`；
- Vercel 初次轮询出现 `/projects` 新、`/posts` 旧的边缘混合版本；下一次整组检查为 5/5 UPDATED 且 archive 隔离后才运行 smoke；
- 稳定生产 smoke：26 routes、OAuth 302；十二条 HTML 与七个发现端点全部 PASS；
- 稳定生产 `/posts`：23165/5101 B；项目详情：113705/25393 B；专题：22707/5112 B；标签：22560/5109 B（raw/gzip），无需更新阈值。

## 8. 经验与教训

1. 显示一个较新的日期但不说明 UPDATED，会把维护日伪装成首发日；
2. date mode 和日期必须一起投影，组件不应自行猜标签；
3. 同日 `updatedAt` 不代表发生过可见的后续维护，应保持 PUBLISHED；
4. 固定格式 ISO 日期在已验证边界内可用字典序比较，不需要重复日期库；
5. 列表的“当前可读版本日期”和 archive 的“首次形成日期”是两种合法语义，不能强行统一；
6. 复用组件的影响面要从调用者审计，而不是只看 `/posts` 和 `/projects`；
7. 引用账本同样是内容列表，更新日能帮助判断引用证据的新鲜度；
8. 三层元数据纵向堆叠比横向塞入长字符串更适合窄列；
9. 纯函数测试负责不存在的真实数据状态，SSR 负责当前仓库的真实记录；
10. HTML 属性断言必须遵循实际渲染输出，不能把浏览器 DOM 规范化形式想当然地套给源响应；
11. 测试失败先检查 actual，可避免为了错误断言改坏正确组件；
12. Vercel 稳定域名短时可返回混合边缘版本，应整组收敛后再跑生产门；
13. 生产预算要观察所有复用页，不能只测最初提出需求的集合；
14. Obsidian 知识笔记与状态归档仍由同一 Git 提交保存。

## 9. 全局状态、风险与未解决问题

首页、About、项目 status 和通用内容列表的可变展示事实现在都有共享投影。读者在集合、专题、标签和引用账本中能看到最近维护日，同时仍能在 archive 回到首发时间线。

搜索结果和知识地图节点仍是剩余分叉：`SearchDocument` 与 `KnowledgeGraphNode` 只携带 `publishedAt`，对应组件也直接显示首发日。下一轮需要增加可选 `updatedAt` 并复用 presenter，但必须保留现有搜索相关性、首发决胜和知识图排序，避免用显示变化偷换探索行为。搜索索引会序列化给客户端，字段增长必须受 `/search` gzip 预算约束。

本机 Git/Node 客户端显式继承系统代理的运维边界继续有效。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择，不进入自动主线。

## 10. 下一轮唯一主任务

让搜索结果和知识地图节点携带可选 `updatedAt`，通过 `getContentDatePresentation()` 显示 PUBLISHED/UPDATED 与实际日期；搜索排名/首发决胜和知识图排序继续使用既有 publishedAt。

覆盖索引/图投影、搜索序列化、SSR/客户端水合、390px、深色和 HTML 预算；不改变 frontmatter、机器发现接口、客户端请求、数据库或云配置。
