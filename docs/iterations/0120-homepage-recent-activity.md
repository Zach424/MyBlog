# Iteration 0120：首页最近活动摘要

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0119 已上线完整 `/activity`，但回访读者必须主动进入活动页才能知道最近发生了什么。本轮在首页 Current focus 与最近记录之间加入一个紧凑的“最近活动”入口，直接复用同一事件模型的前三项，不再复制更新判断、日期排序或事件模式。

成功标准是：首页服务端渲染恰好三条最新事件；当前顺序为 MyBlog、维护博客文章、项目章程文章，日期依次为 2026-08-06、2026-08-05、2026-08-04，模式均为 UPDATED；存在进入完整 `/activity` 的原生链接；Building/Learned/Current focus、archive、搜索、知识图和机器接口不变；桌面与手机无横向溢出；不能突破 100 KB 全局 CSS 门，也不新增客户端请求、数据库、追踪、第三方服务或云配置。

## 2. 项目结构状态

- `app/page.tsx`：直接消费 `createContentActivity()`，展平日期组并取前三项，输出首页 Change Set；
- `app/home-activity.module.css`：新增首页横向/纵向三节点轨道；
- `app/activity/page.tsx`：改用路由级 CSS Module，并保留稳定的 `data-activity-*` 语义标记；
- `app/activity/activity.module.css`：承接原全局活动页专属样式；
- `app/globals.css`：删除活动页专属规则，全局体积由 99,995 B 降至 95,383 B；
- `tests/rendered-html.test.mjs`：新增首页三事件失败优先契约，并把活动页断言从类名改为语义属性；
- `scripts/smoke-production.mjs`：生产检查首页三项顺序、模式与完整账本链接，并以语义属性复核活动页；
- `scripts/html-budget.mjs`、`tests/html-budget.test.mjs`：以已部署功能提交重测十三条生产 HTML 基线；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/OPERATIONS.md`、`docs/QUALITY.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步架构、设计、运行、质量、状态和下一主线；
- `docs/knowledge/0120-derived-home-summary-and-scoped-css.md`：新增 Obsidian 经验笔记；
- 本文件：归档本轮完整证据。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

首页新增段落的唯一视觉签名是 `CHANGE SET / 03 LATEST` 三节点轨道：

```text
◎ UPDATED 2026-08-06 ── ◎ UPDATED 2026-08-05 ── ◎ UPDATED 2026-08-04
```

宽屏将三个事件排成横向轨道；模式与日期使用 Canvas 底色为轨道留出文字缺口，避免规则线穿过标签。手机端把同一轨道转为纵向，节点、模式/日期、类型/序号和标题保持原顺序。PUBLISHED 继续使用实心 Signal 节点，UPDATED 继续使用双环节点，因此摘要与完整活动页共享同一视觉语义。

页面只复用现有 Canvas/Ink/Signal/Trace、display/mono 字体和直角规则线，不增加卡片、阴影、渐变、统计、图标、动画或新色板。该段位于 Current focus 之后、最近记录之前，承担“最近变化入口”而不是替代首页既有证据或内容列表。

## 4. 使用的技术

- Next.js 16.3 App Router 与纯 Server Component；
- React 19 原生 `<section>`、`<ol>`、`<time>` 与链接；
- 既有 TypeScript `ContentActivity` 只读事件模型；
- CSS Modules、Grid、伪元素轨道与现有主题 Token；
- 稳定 `data-home-activity-*` / `data-activity-*` 测试边界；
- Node test 失败优先、ESLint、TypeScript、Next production build；
- Playwright CLI 真实 Chromium；
- Vercel GitHub Integration 与稳定生产 smoke；
- `Buffer.byteLength`、Node `gzipSync` 与十三路 HTML 预算；
- `research-iteration-loop`、`frontend-design` 与 `playwright` skill 的执行—验证—复盘流程。

本轮没有增加 npm 依赖、Client Component、API Route、内容字段、数据库、账户、分析脚本或外部服务。

## 5. 实现的功能

1. 首页显示同一知识库最新三次真实活动；
2. 三项来自完整活动模型全局排序后的前三项，不按日期组截断；
3. 每项显示 PUBLISHED/UPDATED、ISO 日期、内容类型、序号、标题和原生详情链接；
4. 当前三项全为 UPDATED，日期和标题顺序由 SSR 与生产 smoke 锁定；
5. “完整活动账本”直达 `/activity`；
6. 桌面为横向 Change Set，手机为纵向 Change Set；
7. 活动页样式从全局 CSS 隔离到路由级 Module；
8. 活动页与首页测试不依赖构建期哈希类名；
9. 完整活动页仍保持 5 个日期组、8 个事件、4 PUBLISHED 与 4 UPDATED；
10. 十三条生产 HTML 基线以已部署功能提交统一重测。

## 6. 实现方法

先在 `tests/rendered-html.test.mjs` 写首页断言：要求 `data-home-activity="latest-three"`、三个事件、三条 UPDATED、精确标题/日期顺序和 `/activity` 链接。旧首页首次运行该目标测试时因区域不存在而失败，证明测试确实约束新功能。

实现没有新建第二个首页事件 helper。页面先执行 `createContentActivity([...posts, ...projects])`，再对已经按日期和模式排好的 `days` 执行 `flatMap`，最后 `slice(0, 3)`。这保证“最新三项”跨日期组工作，同时不复制 `updatedAt > publishedAt`、同日 UPDATED 优先或标题/URL 决胜规则。

全局 CSS 在上一轮只剩 5 B 余量，继续追加会使质量门失效。本轮把活动页 263 行专属规则完整迁入 `activity.module.css`，再把首页 197 行新轨道放入独立 Module。跨页面 Token 与基础布局仍留在 `globals.css`；最终全局文件下降 4,612 B，而不是提高 100 KB 阈值。

浏览器首次桌面检查发现横向轨道穿过 UPDATED 与日期文字。修复没有移动事件结构，而是让标签使用 Canvas 底色遮断轨道，保留节点连续性和移动端布局。复测时还发现本地旧 `next start` 进程在构建期间持有旧 CSS 指纹，导致 HTML 引用已删除 chunk；确认监听进程属于当前仓库后停止、静态重建并以新隔离会话复测，最终 0 console errors。这个过程避免把验证环境漂移误判为 CSS 实现错误。

HTML 预算继续采用“先部署、后测量、再冻结”。功能提交 `c54535e` 上线并通过完整生产 smoke 后，才以该响应更新十三条基线；预算提交 `67a127a` 不改变产品代码。

## 7. 验证证据

- 失败优先：首页摘要不存在时目标 SSR 测试按预期失败；
- `npm run typecheck`：通过；
- `npm run lint`：通过；
- `npm run test:unit`：524/524；
- `npm run build`：52 个页面；
- `npm run test:app`：30/30；
- 全局 CSS：95,383 B，低于 100 KB 硬门并恢复 4,612 B 余量；
- Playwright 390×844 首页：根宽 390、3 个事件、三条 UPDATED、纵向轨道、0 console errors；
- Playwright 1280×900 首页：根宽 1280、3 个事件、横向轨道标签不被穿线、0 console errors；
- Playwright 390×844 活动页：5 日、8 事件、4 PUBLISHED、4 UPDATED、根宽 390、0 console errors；
- Chromium 仅出现 Next.js CSS preload 延迟未使用 warning；最终没有 CSS MIME、404 或 JavaScript 错误；
- 手机首页截图：`.playwright-cli/page-2026-08-10T20-56-32-579Z.png`；
- 桌面首页截图：`.playwright-cli/page-2026-08-10T21-02-36-115Z.png`；
- 手机活动页截图：`.playwright-cli/page-2026-08-10T21-03-28-252Z.png`；截图位于忽略目录，不进入 Git；
- 功能提交：`c54535e`（`feat: surface recent content activity`），已推送并部署；
- 预算提交：`67a127a`（`test: rebaseline homepage activity HTML`），已推送；
- 稳定生产 smoke：27 routes、OAuth 302；十三条 HTML 与七个发现端点全部 PASS；
- 生产首页：38722/7641 B（raw/gzip），推导 gzip 上限 10240 B；
- 生产活动页：41778/6507 B（raw/gzip），推导 gzip 上限 9216 B；
- Building/Learned/Current focus、archive、搜索、知识图、frontmatter 与机器接口反向断言继续通过。

## 8. 经验与教训

1. 摘要应截取已经排好的事件流，而不是分别从日期组取第一项；
2. 同一纯投影可以服务完整账本和首页摘要，页面只决定展示数量；
3. CSS Module 哈希是实现细节，生产契约应使用稳定语义属性；
4. 全局 CSS 接近硬门时，应先按路由责任拆分，而不是提高阈值；
5. 路由级 CSS 能回收全局预算，但仍会进入对应页面传输，应继续测量真实 HTML/CSS；
6. 横向时间轨的线条不能穿过等宽标签；用画布底色留出缺口比随意移动文字更稳定；
7. 手机和桌面可以共享同一 DOM，只通过轨道方向改变信息组织；
8. 浏览器 CSS 404 可能来自构建目录与常驻生产进程的指纹漂移，先核对端口进程和 chunk 文件再修改代码；
9. 构建前应停止读取同一 `.next` 的本地 `next start`，避免验证环境自相矛盾；
10. 视觉检查不仅确认“能显示”，还应检查规则线是否穿字、节点是否对齐和标题是否自然换行；
11. 首页摘要增长属于有价值的产品变化，仍必须以已部署版本重测全部冻结路由；
12. 新入口不应暗中改变 archive、搜索或机器 Feed 的排序职责；
13. Obsidian 知识笔记、项目状态与实现证据继续保存在同一 Git 历史。

## 9. 全局状态、风险与未解决问题

读者现在无需离开首页即可知道知识库最近三次变化，并可进入完整活动账本。活动模型仍是单一事实投影，首页只做有界截取；内容增长不会要求维护第二份列表。

当前首页新增 820 B 左右 gzip 成本，仍有约 2.5 KiB 余量；活动页也有约 2.7 KiB 余量。全局 CSS 重新获得 4,612 B 空间，但这不是继续无界追加全局规则的许可；新页面专属视觉仍应优先使用路由级 Module。活动模型每条记录最多保留一次最新 UPDATED，不是完整 Git 修订历史；如需逐次变更日志，应先重新定义内容事实来源，不能把单个 `updatedAt` 伪装成所有版本。

RSS item 仍只声明首发 `pubDate`，而 JSON Feed 已有 `date_modified`。订阅读者能否在 RSS 中可靠感知更新尚未闭环，需要先核对规范和阅读器兼容性。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择，不进入自动主线。

## 10. 下一轮唯一主任务

让 RSS 订阅读者获得可验证的内容更新语义。先研究 RSS 2.0 与 Atom 官方规范，确认逐 item 修改时间的合法扩展方式；若证据成立，只为 `updatedAt > publishedAt` 的条目增加修改时间，保持 guid、pubDate、首发排序、频道 lastBuildDate 与 JSON Feed date_modified 不变，并同步发现端点测试、生产 smoke、预算与中文归档。不新增数据库、账户、追踪、第三方服务或云配置。
