# Iteration 0127：专题 RSS 与排序语义

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0126 已让标签拥有独立 RSS，本轮为每个公开专题增加 `/series/[slug]/rss.xml`。专题存在两种都合理但不能混淆的顺序：专题详情是学习目录，应保持作者声明的 `series.order`；订阅源是变化流，应按首发时间倒序，让刚发布或后来插入的章节先进入阅读器。

成功标准是：专题页仍显示第 1→2 章，同时提供可见 RSS 链接和 `application/rss+xml` alternate；Feed 只含该专题公开记录，并复用根/标签 RSS 的 GUID、时间、标签、SHA-256 ETag、Last-Modified、条件 GET/HEAD 与缓存契约；未知专题返回无验证器 `no-store` 404；Feed 不进入 Sitemap，公开页面路由仍为 27。功能稳定上线后，才以实际 Vercel 字节冻结第九条发现预算。

## 2. 项目结构状态

- `app/series/[slug]/page.tsx`：保留章节升序列表，增加专题 RSS 可见入口和 metadata alternate；
- `app/series/[slug]/rss.xml/route.ts`：新增动态 Route Handler、公开专题静态参数、scoped channel 和 self/up 响应关系；
- `lib/rss.ts`：新增 `createRssNotFoundResponse()`，统一标签与专题 Feed 的安全 404；
- `app/tags/[slug]/rss.xml/route.ts`：改用共享 404，不改变已知标签正文；
- `next.config.ts`：把 `/series/:path*` 收窄为 `/series` 与 `/series/:slug`，避免 HTML 配置覆盖协议成功/错误缓存；
- `scripts/smoke-production.mjs`：增加页面章节顺序、专题 Feed 顺序、item 对齐、条件请求、HEAD、未知专题与 Sitemap 排除验证；
- `scripts/discovery-budget.mjs`：增加代表专题 Feed 的稳定生产 raw/gzip 基线；
- `tests/discovery.test.mjs`：锁定章节升序输入不会被改变，RSS 输出仍为最新首发优先；
- `tests/rendered-html.test.mjs`：覆盖发现、精确内容集合、两种排序、响应头、条件请求、404、HEAD 和九端点预算；
- `tests/deployment-tools.test.mjs`、`tests/discovery-budget.test.mjs`：固定生产 smoke 和来源基线；
- 六份全局中文文档、`docs/knowledge/0127-syllabus-order-vs-subscription-order.md` 与本文件：归档设计、技术、方法、验证、风险和经验。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

```text
public series.posts（作者章节顺序）
              │
              ├─ HTML detail → series.order 升序 → 从头学习
              └─ RSS route   → publishedAt 倒序 → 发现新章节
                                  │
                                  └─ shared RSS item/HTTP boundary
```

专题页面是 syllabus，Feed 是 inbox。频道标题为 `<专题标题> — <站点标题>`，频道主页指向专题页，Atom self 指向专题 Feed；item GUID 继续使用内容规范 URL，不产生专题专属内容身份。页面的可见链接、head alternate 和响应 Link header 服务不同消费者，但必须指向同一资源。

Feed 不进入 Sitemap，因为它不是新的可索引页面；读者通过专题语境或协议元数据发现它。根 RSS 与标签 RSS 的正文格式没有变化，因此不人为推进既有 RSS 表示修订时间。

## 4. 使用的技术与规范

- Next.js 16.3 App Router、动态 Route Handler、异步 `params` 与 `generateStaticParams()`；
- Next `headers()` 精确路径匹配和同名响应头覆盖规则；
- RSS 2.0、Atom self link、Dublin Core Terms modified；
- SHA-256 ETag、Last-Modified、`If-None-Match` / `If-Modified-Since`；
- GET/HEAD 与 200/304/404 表示语义；
- Node test、ESLint、TypeScript、Next production build；
- Vercel 稳定生产 origin、UTF-8 raw 和 Node zlib gzip 双层预算；
- `research-iteration-loop` 的执行—验证—全局复盘—下一步流程。

实现前完整阅读当前 Next 16.3 本地 Route Handler、route、dynamic routes、`generateStaticParams` 与 next.config headers 文档，没有依赖旧版本记忆。

## 5. 实现的功能

1. 每个公开专题拥有 `/series/<slug>/rss.xml`；
2. 专题页继续按 `series.order` 显示章节；
3. 专题 Feed 按 `publishedAt` 最新优先；
4. Feed 只包含该专题公开文章，当前代表专题精确包含 2 章；
5. item GUID、`pubDate`、`dcterms:modified` 和 categories 与 JSON Feed 同一记录对齐；
6. 专题页提供可见订阅动作和自动发现 alternate；
7. 响应声明准确 MIME、内联文件名、self/up Link 与 `noindex`；
8. 最终 UTF-8 正文派生 SHA-256 ETag，并支持 ETag/日期 GET 与 HEAD；
9. 未知专题 GET/HEAD 返回共享的 `no-store` 404，不生成 ETag/Last-Modified；
10. 专题 Feed 不进入 Sitemap，公开路由数保持 27；
11. 标签 Feed 改用共享 404 helper，但成功正文和表示修订不变；
12. 代表专题 Feed 进入第九条结构化发现传输预算。

## 6. 实现方法

先写失败优先证据：共享 RSS 单元测试用章节升序输入要求 GUID 以最新首发优先，同时证明输入数组未被修改；应用测试要求专题页面出现 alternate/可见链接并能请求新路由；生产 smoke 静态测试要求认识专题 Feed 与未知专题错误。旧实现的定向发现/部署测试为 15/16，应用测试为 31/33，证明缺口来自真实功能而不是测试自洽。

实现时没有复制 RSS serializer。新路由只负责从 `getSeriesBySlug()` 取得公开集合并提供 channel 元数据，`createRssResponse()` 继续生成 MIME、正文、日期和条件响应；共享 `createRssXml()` 自身按首发时间倒序，因此自然把章节序列投影为变化流。专题 HTML 仍直接消费已经按 `series.order` 排好的集合。

未知标签与专题的相同错误语义抽成 `createRssNotFoundResponse()`。同时把专题父级 HTML 缓存从 `/series/:path*` 收窄为两个真实页面形状，让 Route Handler 独立拥有已知 RSS 与未知 RSS 的最终缓存头。

功能提交部署后，第 9 次生产探测从旧 404 切换为新 200。完整生产 smoke 通过后实测专题 Feed 为 2065/983 B（raw/gzip），正文 SHA-256 为 `5a25cdeb2506aa0d0a4efa730ba0aae52c81bdf218e642d9210efe092a8b24cd`；随后独立接入预算，来源绑定造成功能变化且已经上线的 `cf3c631`。

## 7. 验证证据

- 失败优先：发现/部署定向测试旧实现 15/16，应用测试旧实现 31/33；
- `npm run lint`：通过；
- `npm run typecheck`：通过；
- `npm run test:unit`：532/532；
- `npm run build`：64 个生成页面，包含 `/series/[slug]/rss.xml`；
- `npm run test:app`：33/33；
- 功能提交：`cf3c631`（`feat: publish series-specific RSS feeds`），已推送并进入稳定生产；
- 稳定生产 smoke：27 routes、OAuth 302；页面/Feed 两种排序、成功/未知专题、条件 GET/HEAD 全部通过；
- 代表专题 Feed：2 items、2065/983 B、SHA-256 `5a25cdeb2506aa0d0a4efa730ba0aae52c81bdf218e642d9210efe092a8b24cd`；
- 九个发现端点全部 PASS；专题 Feed 上限为 7168/2048 B；
- 预算提交：`3982113`（`test: baseline series RSS discovery budget`），已推送；
- `git diff --check`：通过；
- 无依赖、客户端 JavaScript、账号、数据库、追踪、第三方服务或云配置变更。

## 8. 经验与教训

1. 同一数据集合不一定只有一个正确顺序，排序必须服务具体用户任务；
2. 页面目录和订阅流共享事实源，但不应强行共享呈现顺序；
3. 语义测试应同时断言两个投影，避免未来“统一排序”造成回归；
4. scoped Feed 应保持内容规范 GUID，不创建新内容身份；
5. 新 Route Handler 应只提供投影参数，继续复用稳定 serializer 与 HTTP 边界；
6. 相同错误协议可以共享 helper，但成功 channel 元数据必须保留语境；
7. 父级 `:path*` 缓存规则会预占未来协议命名空间，标签和专题都验证了这一点；
8. 已知 200、条件 304 与未知 404 的 GET/HEAD 必须成套验证；
9. Feed 不进入 Sitemap，不代表它不可发现；可见链接、alternate 和 Link 已覆盖发现；
10. 新投影复用现有正文格式时，不应虚构根/标签 Feed 的表示修订；
11. 构建生成页面数增长与 Sitemap 页面数是两种不同指标；
12. 预算必须在真实部署后测量，并绑定造成功能字节变化的稳定提交；
13. 本地与边缘缓存头可能等价而不逐字相同，应验证 HTTP 语义；
14. Obsidian 状态、迭代、知识笔记与代码继续共享同一 Git 历史。

## 9. 全局状态、风险与未解决问题

专题 RSS 已对所有公开专题动态生效，但自动预算选择 `build-my-blog` 作为稳定代表，其他专题依赖同一生成器和参数索引。专题章节若补发旧日期，Feed 位置由 `publishedAt` 决定；若未来需要“作者手动置顶通知”，那是新的公开字段与产品语义，不能复用 `series.order` 偷渡。

当前全站、标签、专题 Feed 仍分散在各自页面。读者可以逐个订阅，但还不能一次导入所有频道。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱继续需要所有者操作或选择，不阻塞当前生产。

## 10. 下一轮唯一主任务

提供 OPML 2.0 聚合订阅导出，把全站 RSS、全部公开标签 Feed 和全部公开专题 Feed 组织为稳定分组的一次导入包。端点必须复用现有公开索引、绝对 URL、条件响应、`noindex` 与生产预算，并在 `/subscribe` 提供可见入口；不增加账号、数据库、追踪、邮件投递或第三方服务。
