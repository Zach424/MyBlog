# Iteration 0115：内容驱动的 About 系统档案

> 本地实现、验证与归档：2026-08-11 · Vault：仓库根目录 · 生产交付待 GitHub 网络恢复

## 1. 范围与成功标准

Iteration 0114 关闭了首页可变状态的手写副本，但 `/about` 仍把“TypeScript、React、Next.js 与 Vercel”写死在 JSX 中，也没有展示实际文章、项目、专题、标签、公开 URL 或最新更新日期。本轮只把这些可变事实升级为由现有公开内容生成的系统档案；长期记录原则和 GitHub-only 联系边界保持稳定。

成功标准是：About Intro 显示真实记录总数、公开路由数和最新日期；第一格以语义化 `dl` 展示 posts/projects/series/tags、公开 URL 和最近更新，其中四类集合计数可导航；第三格显示精选项目完整标题、中文状态与完整 stack；零内容不发明日期、项目或技术；非法计数失败关闭；页面保持纯 Server Component、390px、深色和既有 HTML 预算，不新增 CMS 字段、客户端请求、Git 运行时读取、数据库或外部服务。

## 2. 项目结构状态

- `lib/about-profile.ts`：新增 About 专用纯 view-model，集中计数校验、Intro meta、系统事实和空项目降级；
- `lib/content-presentation.ts`：新增跨页面共享的项目 status 中文展示函数；
- `lib/homepage-evidence.ts`：改用共享项目状态函数，移除本地映射副本；
- `app/about/page.tsx`：读取公开 posts/projects/series/tags、路由清单与精选项目，渲染系统档案和当前项目基线；
- `app/globals.css`：新增事实 `dl`、项目链接和可换行 stack 标签样式；
- `tests/about-profile.test.mjs`：覆盖真实数据投影、空集合与非法计数；
- `tests/rendered-html.test.mjs`：锁定真实 About HTML 与完整 stack，并拒绝旧手写技术句；
- `package.json`：把新测试加入完整 `test:unit`；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步架构、视觉、质量、运维、全局状态与下一主线；
- `docs/knowledge/0115-about-system-profile-view-model.md`：新增 Obsidian 知识笔记；
- 本文件：记录本轮实现、验证、交付状态、经验和风险。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、删除或暂存这些内容。

## 3. 设计内容

About 继续使用既有四格规则线，而不是新增统计卡片或营销型个人介绍：

1. `01 / INVENTORY`：标题“公开系统档案”，以两列 `dl` 展示文章与 TIL 3、项目 1、专题 1、标签 11、公开 URL 26、最近更新 2026-08-06；前四个数字链接到对应集合；
2. `02 / METHOD`：保留“如何判断内容完成”和证据原则；
3. `03 / STACK`：标题改为“当前项目基线”，显示 MyBlog 完整标题、持续维护、Git/构建说明和 TypeScript/React/Next.js/Vercel/GitHub 五项标签；
4. `04 / CONTACT`：继续只提供 GitHub，不虚构邮箱或其他联系渠道。

Intro 的等宽 meta 为 `4 RECORDS / 26 ROUTES / UPDATED 2026-08-06`。计数使用结构与排版表达，不增加彩色仪表、图标或动画。桌面维持两列；移动端折为单列，事实内部仍为紧凑两列。项目标题完整保留，stack 使用 flex wrap；深色只使用既有 Canvas/Paper/Ink/Signal/Rule Token。

## 4. 使用的技术

- Next.js 16.3 Server Component；
- 仓库现有 Markdown/YAML/Zod 公开 getter；
- `createPublicRouteInventory()` 的 total/latestModified 单一事实源；
- TypeScript `Pick` 收窄 About 只需要的项目字段；
- 纯函数 view-model、非负整数不变量和防御性数组复制；
- 共享 project status presenter；
- 语义化 `dl/dt/dd`、`ul/li` 与内部 Next Link；
- CSS Grid、Flex wrap、既有 Token 和响应式断点；
- Node test 失败优先、TypeScript、ESLint、Next production build；
- 真实 production-server HTTP、raw/gzip 预算；
- Playwright CLI 桌面与 390×844 深色 DOM/console/截图；
- `research-iteration-loop` 管理范围、执行、验证、复盘和下一步。

本轮开始前已按仓库规则阅读安装版本 Next.js 文档；没有新增 Route Handler 或客户端边界。

## 5. 实现的功能

1. About Intro 自动显示公开记录总数、公开 URL 数和最新内容日期；
2. 自动显示文章/TIL、项目、专题、标签四类真实数量；
3. 四类集合计数可直接进入对应集合页；
4. 公开 URL 与最近更新明确显示为系统事实；
5. 自动选择现有 featured project，并显示稳定项目链接；
6. 项目状态使用共享中文语义，避免 About 与首页各维护映射；
7. 展示精选项目的完整 stack，不再维护另一份手写技术基线；
8. 空内容集合显示 `0 RECORDS`、`NO PUBLIC CONTENT`、“暂无公开内容”和“等待首个公开项目”；
9. 任一集合/路由计数为负数或小数时，view-model 失败关闭；
10. 方法论与 GitHub-only 联系入口原样保留；
11. 所有内容服务端输出，禁用 JavaScript 仍可读取和导航。

## 6. 实现方法

先新增 `tests/about-profile.test.mjs` 并把它登记到完整单元测试。首次目标运行因 `lib/about-profile.ts` 不存在而失败，证明测试确实命中新边界。随后实现 `createAboutProfile()`：输入只包含五个 count、可选 latestModified 和经过 `Pick` 收窄的 featured project；先一次验证所有 count，再生成稳定 meta、六条 facts 和项目正常/空状态。

项目 status 翻译没有复制进新模块，而是提取到 `lib/content-presentation.ts`；首页原映射随即改为调用同一函数，既有首页测试继续证明行为未变。About 页面一次读取公开集合，使用相同集合生成路由清单，再把数量和精选项目交给纯函数；组件不解释计数、不排序 stack，也不读取自己的 HTTP 输出。

事实网格使用真正的 `dl`，集合数字使用 Link，非导航事实保持纯文本。项目 stack 复制后原序输出，把数组顺序视为作者意图；CSS 只负责 wrap，不在数据层截断。SSR 测试既要求新事实存在，也拒绝旧的中文顿号技术句，避免后续重构恢复第二份技术栈。

## 7. 验证证据

- 失败优先：目标测试先因 About profile 模块不存在而失败；
- About + 首页目标测试：6/6；
- `npm run typecheck` 与 `npm run lint`：通过；
- `npm run test:unit`：516/516；
- `npm run build`：51 个页面；
- `npm run test:app`：27/27；
- 本地十二条 HTML 与七个发现端点预算：全部 PASS；
- 本地 `/about`：21571/5094 B（raw/gzip），阈值 163840/7168 B；
- Playwright 桌面：真实 meta、六项档案、精选项目与完整 stack 均可见，1 个 H1、无横向溢出；
- Playwright 390×844 深色：宽高与 dark media 均确认，1 个 H1、无横向溢出，项目标题和五项 stack 完整；
- 浏览器 console：0 errors；1–2 条 Next.js CSS preload 延迟未使用警告，与本轮逻辑无关；
- 桌面截图：`output/playwright/iteration-0115/.playwright-cli/page-2026-08-10T18-44-04-860Z.png`；
- 移动首屏截图：`output/playwright/iteration-0115/.playwright-cli/page-2026-08-10T18-45-36-189Z.png`；
- 移动项目局部截图：`output/playwright/iteration-0115/.playwright-cli/page-2026-08-10T18-47-52-282Z.png`；以上均在忽略目录，不进入 Git；
- 功能提交：`ca21c5c`（`feat: derive about profile from content`）；
- 交付状态：本地 `HEAD` 比 `origin/main` 领先 1；GitHub 网页 HTTPS 返回 200，但 Git for Windows HTTPS push 连续 443 timeout，尚不能诚实记录 Vercel 部署或稳定生产 smoke。

## 8. 经验与教训

1. About 页不是只能写稳定自述；其中凡是数量、日期、状态和技术栈，仍应遵守事实单一来源；
2. 长期原则可以是文案，随内容变化的站点画像必须是投影；
3. 页面 view-model 接受计数而不是完整正文，可以明确最小权限边界，也更容易构造空集合测试；
4. 共享枚举的人类标签应该独立于某个页面，否则第二个消费者出现时会立即复制映射；
5. 机器接口继续保留原始 status enum，公开页面的人类语言属于展示层；
6. 统计数字应该链接到能解释它们的集合，只有无法导航的总量和日期保持纯文本；
7. 完整 stack 的权威来源是项目 frontmatter，About 不应维护“精选技术”副本；
8. 数据层不截断长标题和 stack，密度问题由可换行布局解决；
9. 空集合不能只把数字变成 0，还要同时取消日期与项目陈述；
10. 防御性复制能保证 view-model 不把调用者数组直接泄漏给 UI；
11. SSR 既断言新事实又拒绝旧句子，才能证明第二份真相确实删除；
12. 本地生产测试和浏览器截图不能替代稳定生产证据；Git push 失败时必须明确记录交付缺口；
13. GitHub 网页可达不代表 Git 客户端传输可用，网络诊断要区分协议/客户端；
14. Obsidian 状态、迭代档案和知识笔记仍是同一 Vault 中的 Git 文件，不需要再复制到另一个目录。

## 9. 全局状态、风险与未解决问题

首页与 About 中会随内容变化的数量、日期、项目、学习、焦点和技术栈均已有公开事实来源。About 现在能让读者同时判断“这个站点有多少可读对象”“最近何时更新”“当前项目用什么构建”，而不把静态自述当作运行状态。

新投影依赖作者继续正确维护 frontmatter；这是内容契约责任，不是 About 第二套数据。stack 保留作者顺序，尚未定义权重。状态中文翻译已经共享，但全局审计发现首页项目卡、项目集合和项目详情仍分别输出 `Maintained`、`MAINTAINED` 与 `Project / maintained`，这成为下一处展示语义分叉。

当前唯一交付缺口是 Git for Windows 无法连接 GitHub 443；本地提交、测试和文档均完整，但不能把远端 `ddb1384` 或旧 Vercel 页面写成新功能上线。恢复后必须依次 push、确认 `origin/main`、等待稳定域名出现 `4 RECORDS / 26 ROUTES`，再跑完整生产 smoke 并更新本档案、Operations、Roadmap 与 Status。

首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱继续需要所有者操作或选择，不进入自动主线。

## 10. 下一轮唯一主任务

统一所有公开项目表面的 status 展示语义：首页项目卡、项目集合列表和项目详情复用 `lib/content-presentation.ts`，输出一致的人类标签与稳定机器标签；保持内容 contract、Markdown/source、清单、Studio 和 Schema 中的原始 enum 不变。

覆盖 planning/building/maintained/archived 四种状态、SSR、390px、深色和既有 HTML 预算；不新增作者字段、客户端请求、Git 运行时读取、数据库或云配置。开始该功能前，先完成本轮 push 与稳定生产收敛。
