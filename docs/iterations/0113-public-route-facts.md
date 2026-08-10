# Iteration 0113：公开路由单一事实源

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

本轮只修复首页运行事实与 Sitemap 公开集合之间的漂移。旧首页把 `25 public URLs` 和 `REV. 010` 直接写在组件里，而真实 Sitemap 已有 26 条 URL；继续手工把 25 改成 26 仍会保留第二份事实源。

成功标准是：静态页面、文章、项目、专题和标签通过一个纯函数生成公开路由清单；Sitemap 直接序列化该清单；首页 Evidence Rail 从同一清单读取总数，首屏日期从同一首页路由事实读取；重复路径失败关闭；首页继续是 Server Component，不新增 API 请求、Git 运行时读取、客户端状态、数据库或云配置；本地和生产必须同时证明首页数字等于 Sitemap URL 数量、首页日期等于 Sitemap 根 URL 的 `lastmod`。

## 2. 项目结构状态

- `lib/public-routes.ts`：新增公开路由事实模块，集中 10 条静态页面及文章、项目、专题、标签的动态投影；
- `lib/discovery.ts`：删除内联 Sitemap 路由数组，改为序列化 `createPublicRouteInventory()` 的输出；
- `app/page.tsx`：读取同一公开集合，派生 Evidence Rail URL 数量和 `LATEST` 日期；
- `tests/discovery.test.mjs`：锁定静态/动态顺序、总数、最新日期、首页日期一致性、唯一性和重复路径失败关闭；
- `tests/rendered-html.test.mjs`：同时读取真实首页与 Sitemap，按实际 Sitemap 数量匹配首页，比较首页 `LATEST` 与根 URL `lastmod`，并拒绝任何 `REV. <数字>`；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步结构、设计、发现、质量、运维、状态、风险和下一主线；
- `docs/knowledge/0113-public-route-single-source.md`：新增可在 Obsidian 直接阅读的本轮知识笔记；
- 本文件：记录范围、实现、验证、生产证据、经验与下一步。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、删除或暂存这些内容，提交继续使用显式路径。

## 3. 设计内容

视觉结构保持 iteration 0003 的 Commit Trace / Evidence Rail，不引入新的卡片、徽章或客户端动画。变化只发生在证据语义：`Guest · 26 public URLs · Sitemap synced` 不再是一句人工维护的口号，而是当前部署中公开路由清单的真实总数；`REV. 010` 被 `LATEST · 2026-08-06` 取代，日期来自所有公开文章与项目的最新 `updatedAt ?? publishedAt`，并与 Sitemap 首页 `lastmod` 相同。

空内容库不再显示伪造日期，而显示 `NO PUBLIC CONTENT`。长计数文案继续放在 Evidence Rail 既有元数据层；390×844 深色实测仍能自然换行、保持一个 H1 和零横向溢出。

## 4. 使用的技术

- Next.js 16.3 App Router Server Component 与 Route Handler；
- TypeScript 只读输入接口、判别日期来源与 `satisfies` 静态事实约束；
- 纯函数把 Markdown/Zod 已验证的 `PostRecord`、`ProjectRecord`、`SeriesIndexEntry`、`TagIndexEntry` 投影为路由事实；
- 原生 XML 字符串序列化与既有 SHA-256 条件响应边界；
- Node test 的失败优先夹具、真实 Next production HTTP 集成测试；
- TypeScript、ESLint、Next production build；
- Playwright CLI 桌面、390×844、深色、DOM、console 与根宽验收；
- Vercel Git 部署、稳定生产域名全路由 smoke、raw/gzip 双层预算；
- `research-iteration-loop` 约束本轮范围、验证、全局复盘与下一步。

按仓库 `AGENTS.md` 要求，改动前阅读了安装版本 Next.js 的 Route Handler 与 Sitemap 文件约定。现有自定义 `/sitemap.xml` Route Handler 继续保留，因为它已有最终正文 SHA-256 ETag、条件读取和生产预算契约；本轮只替换其路由数据来源。

## 5. 实现的功能

1. 10 条静态公开页面集中为 `STATIC_PUBLIC_ROUTE_FACTS`；
2. 文章、项目、专题和标签根据公开内容索引自动生成动态路由；
3. 每条路由同时携带 path、`lastModified`、`changeFrequency` 与 priority；
4. 总数等于最终路由数组长度，不再维护独立计数；
5. 最新公开日期同时驱动首页 `LATEST` 和 Sitemap 根 URL `lastmod`；
6. Sitemap 只负责把共享事实序列化为 XML；
7. 首页 Evidence Rail 显示与 Sitemap 同源的 26 条公开 URL；
8. 重复 path 立即抛出中文错误，避免静默生成重复 Sitemap；
9. 空文章或空项目集合允许对应日期缺省，不伪造发布日期；
10. 首页仍为纯服务端输出，没有新增 hydration、fetch、数据库或云服务。

当前公式为：`10 个静态页面 + 3 篇文章 + 1 个项目 + 1 个专题 + 11 个标签 = 26 条公开 URL`。404、Studio、OAuth、Feed、清单、Schema、OpenSearch 和单篇 Markdown 等可访问端点有意不进入可索引公开路由清单，因此“公开 URL 数量”在此严格指 Sitemap 集合，而不是服务器全部端点数量。

## 6. 实现方法

先修改单元测试，让它导入尚不存在的 `lib/public-routes.ts`；旧实现按预期以 `ERR_MODULE_NOT_FOUND` 失败。再建立 `createPublicRouteInventory()`：静态事实声明日期来源为 site/posts/projects，运行时从公开记录计算三个最新日期；动态项继续复用已验证记录的规范 URL 和索引 slug；生成完成后遍历 Set，发现重复路径即失败关闭。

随后从 `lib/discovery.ts` 删除原有 60 余行 Sitemap 内联数组，让 `createSitemapXml()` 只序列化共享 `routes`。首页一次读取 posts/projects/series/tags，复用相同输入得到 `total` 与 `latestModified`；Evidence Rail 文案在服务端组装，空库不再回退到手写日期。

真实 HTML 测试不把 26 再写成新的固定真相：它并行请求首页与 `/sitemap.xml`，解析实际 `<loc>` 数量后匹配首页，并比较根 URL 的 `<lastmod>` 与 `LATEST`。`>=26` 只用于保护既有公开覆盖不意外缩小；消费者一致性使用精确相等。这样新增文章、标签或公开页面时，测试会验证两端同步，而不是要求每次手工改断言。

## 7. 验证证据

- 失败优先：目标单元测试先因 `lib/public-routes.ts` 不存在而失败；
- 目标测试：`tests/discovery.test.mjs` 7/7；
- `npm run typecheck` 与 `npm run lint` 通过；
- `npm run test:unit`：510/510；
- `npm run build`：51 个页面；
- `npm run test:app`：26/26；
- 本地 HTML 预算十二条 PASS，发现端点预算七条 PASS；
- Playwright：桌面和 390×844 均显示 `Guest · 26 public URLs · Sitemap synced`、`LATEST · 2026-08-06`、1 个 H1、零横向溢出；深色截图正常；
- 控制台：0 errors；1 条 Next.js 生成 CSS preload 延迟未使用警告，与本轮逻辑无关；
- 功能提交：`28449b9d`（`feat: derive homepage from public route facts`），已推送 `main`；
- 稳定生产首页已显示共享事实，旧 `25 public URLs` 已消失；
- 稳定生产 smoke：26 routes、OAuth 302，十二条 HTML 与七个结构化发现端点全部 PASS；首页为 32048/6866 B、Sitemap 为 4882/524 B（raw/gzip），均在既有带来源预算内。

浏览器截图保存在本地忽略目录 `output/playwright/iteration-0113/.playwright-cli/page-2026-08-10T18-13-07-257Z.png`，不进入 Git 发布资产。

## 8. 经验与教训

1. 可见状态只要能从产品事实推导，就不应再维护第二份文字常量；
2. 单一事实源不是“所有东西放进一个大文件”，而是把同一语义的生成边界收口，消费者只做各自格式化；
3. Sitemap 数量与服务器所有可访问端点数量不同，指标名称必须说明集合边界；
4. 最新日期应取公开内容事实，而不是迭代编号、构建时间或 Git 提交时间；
5. `updatedAt ?? publishedAt` 与 Sitemap 已有语义一致，比首页只看最新文章发布日期更真实；
6. 测试消费者之间的关系，比在两个测试里分别写死同一个数字更能防止漂移；
7. 路由唯一性不能只依赖内容 schema；静态页与动态 URL 的跨集合冲突应在最终清单边界再次失败关闭；
8. 空集合应该输出明确未知状态，而不是为了视觉完整伪造日期；
9. 数据来源重构不一定需要改变视觉，证据可信度本身就是产品质量；
10. 生产烟测显示首页 raw 仅比旧基线增加 4 B、gzip 反而减少 1 B，不需要重新冻结预算；
11. Next 动态页面在 Vercel 的 `Cache-Control` 仍可能被平台收敛为 `private, no-cache, no-store`，不能仅凭 `next.config` 声明推断边缘缓存行为；
12. 仓库根作为 Obsidian Vault 时，状态、迭代档案和知识笔记是同一份物理文件，不需要复制同步，也不会产生两个版本。

## 9. 全局状态、风险与未解决问题

首页与 Sitemap 的公开 URL 数量和最新日期漂移已经关闭。当前公开阅读、发现、写作、Obsidian、交付、恢复和性能预算保持稳定；功能没有引入新运行时依赖或外部服务。

`STATIC_PUBLIC_ROUTE_FACTS` 目前只服务于可索引路由，不代表 API、Studio 或错误页；未来新增可索引静态页面时必须把它加入该清单。动态内容 URL 仍依赖内容契约和索引生成，路由事实模块不替代 slug、重定向、媒体或关系校验。生产 `Cache-Control` 实测仍由 Next/Vercel 动态渲染策略决定，本轮不把公开路由事实误扩展成缓存配置事实。

首页 Evidence Rail 的 Verified 项已经数据驱动，但 Building、Learned 和 Current focus 仍是手写叙述；它们未发生数字漂移，却可能在长期内容演进后失去代表性。首次真实 Obsidian 主题/本机代理人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者选择或操作，继续不作为自动开发阻塞项。

## 10. 下一轮唯一主任务

让首页 Evidence Rail 剩余的 Building、Learned 与 Current focus 从现有公开项目和最新文章派生：项目状态/技术栈表达正在构建，最新文章标题/类型表达最近学习，当前焦点复用这些真实内容事实；保留既有视觉层级和服务端边界，并为长中文标题、空项目/空文章、390px 与 HTML 预算补充验证。

不新增 CMS 字段、客户端请求、Git 运行时读取、分析服务或数据库；若现有内容字段不足以表达事实，优先诚实降级而不是发明元数据。
