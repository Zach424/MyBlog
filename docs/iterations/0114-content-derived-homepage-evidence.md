# Iteration 0114：首页内容事实证据栏

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0113 关闭了首页 URL 数量与日期的漂移，但 Evidence Rail 的 Building、Learned 和 Current focus 仍是手写文案。它们没有立即出错，却不会随新项目、项目状态或最新文章更新。本轮只把这三处改为现有公开内容事实的服务端投影。

成功标准是：精选项目驱动 Building 的标题、状态和技术栈摘要；最新公开文章驱动 Learned 的标题、类型、发布日期和标签摘要；Current focus 组合项目状态、最新内容类型与共享最新日期；空项目/空文章显示诚实占位；非法路由总数失败关闭；不新增 CMS 字段、客户端请求、Git 运行时读取、数据库或外部服务；长中文标题在 390px、深色和既有 HTML 预算中保持完整可读。

## 2. 项目结构状态

- `lib/homepage-evidence.ts`：新增首页证据纯投影，集中项目状态翻译、技术栈/标签摘要、空集合降级与 Current focus 组合；
- `app/page.tsx`：删除组件内三条手写 Evidence Rail 文案，向纯函数传入共享公开路由统计、精选项目和最新文章；
- `tests/homepage-evidence.test.mjs`：覆盖真实长标题投影、空内容集合和非法计数；
- `tests/rendered-html.test.mjs`：锁定真实内容元数据、Current focus，并拒绝旧手写文案；
- `package.json`：把新测试加入完整 `test:unit`；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步结构、设计、测试、运维、状态与下一主线；
- `docs/knowledge/0114-homepage-evidence-view-model.md`：新增 Obsidian 本轮知识笔记；
- 本文件：记录实现、上线证据、经验与风险。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、删除或暂存这些内容。

## 3. 设计内容

Evidence Rail 的三个状态角色继续保留：Verified 证明公开可达，Building 显示当前精选项目，Learned 显示最新学习记录。变化不是增加视觉组件，而是让文字与数据关系真实：

- Building value：`MyBlog — 把学习记录做成工程资产`；
- Building meta：`持续维护 · TypeScript · React · +3`；
- Learned value：`从零搭建可维护的个人技术博客`；
- Learned meta：`ARTICLE · 2026-07-18 · Next.js · +3`；
- Current focus：`持续维护项目 / 最新文章 / 2026-08-06`。

技术栈只显示前两项，其余用 `+N` 保持密度；标签只显示第一项与剩余数量。标题不截断，不用省略号隐藏作者事实；既有 Evidence Rail 宽度和换行规则负责适配。空库使用“等待首个公开项目”“等待首篇学习记录”“等待第一条公开记录”，不把缺数据伪装成正在构建。

## 4. 使用的技术

- Next.js 16.3 Server Component；
- TypeScript `Pick` 收窄首页真正需要的 Post/Project 字段；
- 纯函数 view-model、项目状态映射、稳定列表摘要和日期回退；
- 仓库现有 Markdown/Zod 公开记录与排序 getter；
- Node test 失败优先、真实 Next production HTTP 测试；
- TypeScript、ESLint、Next production build；
- Playwright CLI 做桌面、390×844、深色、DOM、console、根宽和局部截图；
- Vercel Git 部署与稳定域名全路由 smoke；
- 十二路 HTML 与七端点发现 raw/gzip 预算；
- `research-iteration-loop` 管理范围、验证、复盘和下一步。

本轮没有新增 Next API 或文件约定；沿用上一轮已阅读的安装版本 Server Component/Route Handler 边界，数据投影位于普通纯 TypeScript 模块中。

## 5. 实现的功能

1. Building 自动显示当前精选项目标题；
2. 项目 `planning/building/maintained/archived` 映射为规划中/构建中/持续维护/已归档；
3. 技术栈显示前两项和剩余 `+N`；
4. Learned 自动显示最新公开文章标题；
5. ARTICLE/TIL、发布日期、首标签和剩余标签数量自动派生；
6. Current focus 自动组合项目状态、最新内容类型和最新公开日期；
7. 无项目、无文章或全空集合都有明确中文/英文证据文本；
8. public route count 必须是非负整数，否则在 view-model 边界失败；
9. 首页不再包含“持续内容发布与维护”“权限变更也要做未登录验收”“公开运行 / 内容发布 / 维护反馈”三条手写状态；
10. 所有证据继续服务端输出，关闭 JavaScript 时仍完整可见。

## 6. 实现方法

先新增 `tests/homepage-evidence.test.mjs` 并登记进完整单元测试；首次目标运行因 `lib/homepage-evidence.ts` 不存在而按预期失败。实现时只通过 `Pick` 接收标题、类型/状态、日期、tags/stack，避免把正文、源路径或作者字段扩散到首页投影。

`summarize()` 复制数组前 N 项并附加剩余数量，不修改内容记录。Current focus 优先使用上一轮公开路由清单的 `latestModified`；夹具或其他调用方未提供时，再从传入项目/文章的 `updatedAt ?? publishedAt` 取最大值。没有任何内容事实时返回显式等待状态。

首页继续一次读取公开 posts/projects/series/tags：路由清单负责 Verified 数量和日期，`getFeaturedProject()` 与 `posts[0]` 进入新的 view-model，组件只 map 最终三项并渲染 currentFocus。真实 HTML 测试既验证新值，也明确拒绝旧文案，防止未来重构悄悄恢复静态状态。

## 7. 验证证据

- 失败优先：目标测试先因首页证据模块不存在而失败；
- 目标测试：3/3；
- `npm run typecheck` 与 `npm run lint` 通过；
- `npm run test:unit`：513/513；
- `npm run build`：51 个页面；
- `npm run test:app`：26/26；
- 本地十二条 HTML 和七个发现端点预算全部 PASS；
- Playwright：桌面语义快照包含三条真实证据；390×844 深色为 1 个 H1、零横向溢出，项目/文章长标题完整换行；
- 局部截图：`output/playwright/iteration-0114/.playwright-cli/element-2026-08-10T18-29-22-851Z.png`（忽略目录，不进入 Git）；
- 控制台：0 errors；1 条 Next.js CSS preload 延迟未使用警告，与本轮逻辑无关；
- 功能提交：`047ef40`（`feat: derive homepage evidence from content`），已推送 `main`；
- 稳定生产页面已出现项目、文章与 Current focus 新事实，旧文案为零；
- 稳定生产 smoke：26 routes、OAuth 302；十二条 HTML 与七个发现端点全部 PASS；首页 32163/6814 B（raw/gzip），相对基线 raw +119 B、gzip -53 B，无需更新阈值。

## 8. 经验与教训

1. “状态文案”只要指向内容对象，就应该保存对象事实而不是保存另一份摘要；
2. view-model 是内容契约与视觉组件之间的合适边界：它收窄字段、翻译状态、控制密度，组件只渲染；
3. 摘要列表应展示前 N 项和剩余数量，既不复制完整长列表，也不假装只有可见两项；
4. 标题属于作者事实，不应为了侧栏整齐在数据层截断；响应式 CSS 应承担换行；
5. 空状态与正常状态必须由同一函数输出，否则空库往往又回到组件手写；
6. Current focus 不需要新增 CMS 字段；项目状态、内容类型和日期已经足以表达可证明的当前上下文；
7. 公开路由总数虽然来自上游共享模块，消费边界仍应验证基本数值不变量；
8. 测试既要断言新事实，也要拒绝旧静态句子，才能证明漂移源真正移除；
9. 本轮 raw 略增而 gzip 下降，说明重复内容的服务端投影没有形成传输风险；不能只看未压缩字节判断价值；
10. Browser DOM 断言证明语义，局部截图证明长标题密度，两者不能互相替代；
11. 内容驱动不等于客户端动态加载；构建/请求时服务端投影同样能保持自动更新；
12. Obsidian 状态、迭代档案和知识笔记继续是 Vault 内同一组 Git 文件，推送即完成版本归档。

## 9. 全局状态、风险与未解决问题

首页的 URL 数量、最新日期、项目状态、技术栈摘要、最新文章、标签摘要和 Current focus 现在全部来自公开内容/路由事实。首页仅剩长期品牌承诺和 Verified 标签等稳定文案，不再人工维护随内容变化的运行数字或主题。

项目状态和最新文章依赖内容作者及时维护 `status`、`updatedAt` 与 `publishedAt`；这是现有内容契约的责任，不是首页第二套数据。技术栈/标签摘要按原数组顺序展示，契约目前把顺序视为作者意图；未来若要按重要性排序，应先定义字段语义而不是在首页猜测。`getFeaturedProject()` 在没有 featured 项目时会选择第一项，本轮保留既有选择规则。

全局复盘发现 `/about` 的“当前技术基线”仍硬编码 TypeScript、React、Next.js 与 Vercel，内容说明也没有真实 posts/projects/series/tags/公开路由统计；它是下一处可见事实漂移风险。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱继续需要所有者操作或选择，不进入自动主线。

## 10. 下一轮唯一主任务

把 `/about` 从静态介绍升级为内容驱动的公开系统档案：从公开文章、项目、专题、标签、路由清单和精选项目派生真实规模、最新日期、项目状态与技术栈；保留记录原则和 GitHub 联系边界，覆盖空集合、长 stack、SSR、390px 与现有 HTML 预算。

不新增作者字段、客户端请求、Git 运行时读取、数据库、统计或云服务；about 页面只展示当前仓库已能证明的事实。
