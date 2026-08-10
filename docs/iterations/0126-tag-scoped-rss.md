# Iteration 0126：标签级 RSS 订阅

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0125 已让全站 RSS category 与 JSON Feed tags 共用同一标签事实源，但读者仍只能订阅全部内容。本轮为每个公开标签增加 `/tags/[slug]/rss.xml`：订阅源只包含具有该标签的公开文章与项目，复用根 RSS 的条目序列化、排序、标签、首发/修改时间、SHA-256 ETag、Last-Modified、条件 GET/HEAD 与缓存语义。

对应标签页必须同时提供可见订阅链接和 `application/rss+xml` 自动发现元数据；未知标签必须是不可缓存、不可索引、无 ETag/Last-Modified 的真实 404。Feed 不进入 Sitemap，因此站点公开页面路由总数继续保持 27。上线后必须用稳定 Vercel 响应建立第八条结构化发现预算，而不是用本地输出自我放行。

## 2. 项目结构状态

- `lib/discovery.ts`：`createRssXml()` 新增可选 channel title、description、home path 与 feed path，根 RSS 默认值保持不变；
- `lib/rss.ts`：集中 RSS MIME、缓存头、正文生成、Feed Last-Modified 与 SHA-256 条件响应；
- `app/rss.xml/route.ts`：改为复用共享 RSS 响应边界；
- `app/tags/[slug]/rss.xml/route.ts`：从公开标签索引生成静态参数与标签投影，未知标签显式返回安全 404；
- `app/tags/[slug]/page.tsx`：增加可见“订阅此标签 RSS”链接和绝对 alternate metadata；
- `next.config.ts`：把旧 `/tags/:path*` 页面缓存规则收窄为 `/tags` 与 `/tags/:slug`，避免覆盖协议子路由自己的成功/错误缓存；
- `tests/discovery.test.mjs`、`tests/rendered-html.test.mjs`：覆盖 scoped channel、内容子集、顺序、标签、日期、发现链接、条件 GET/HEAD 和未知标签；
- `scripts/smoke-production.mjs`、`tests/deployment-tools.test.mjs`：把同一契约带到稳定生产；
- `scripts/discovery-budget.mjs`、`tests/discovery-budget.test.mjs`：新增代表端点 `/tags/typescript/rss.xml` 的稳定生产 raw/gzip 基线；
- 六份全局中文文档、`docs/knowledge/0126-route-specific-cache-boundaries.md` 与本文件：归档设计、技术、实现、验证、风险和经验。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

标签 RSS 是同一公开内容索引的只读投影，不是第二套内容系统：

```text
public ContentRecord[]
        │
        ├─ root RSS                 → 全部公开记录
        └─ getTagBySlug(slug).items → 该标签公开记录
                    │
                    └─ shared RSS serializer / HTTP validators

/tags/typescript
├─ 可见链接 → /tags/typescript/rss.xml
└─ alternate application/rss+xml
```

频道标题使用 `<标签> — <站点标题>`，频道主页指回标签页，Atom self 指向标签 Feed。条目仍使用规范内容 URL 作为 GUID，不产生标签专属内容身份。端点通过 Link header 同时声明 self 与上级 HTML 页面，并以 `noindex` 避免把机器投影当作搜索落地页。

Sitemap 只枚举可作为页面访问的公开 HTML 路由；Feed 由 HTML alternate、可见链接和协议 Link 发现，不为每个标签扩大 Sitemap。

## 4. 使用的技术与规范

- Next.js 16.3 App Router、动态 Route Handler 与异步 `params`；
- `generateStaticParams()` 公开标签参数生成；
- Next `headers()` 路径匹配和“后匹配覆盖前匹配”规则；
- RSS 2.0、Atom self link、Dublin Core Terms modified；
- SHA-256 ETag、Last-Modified、`If-None-Match` / `If-Modified-Since`；
- GET/HEAD 表示元数据等价与零正文 304；
- Node test、ESLint、TypeScript、Next production build；
- Vercel 稳定生产 origin 与 raw/Node gzip 双层发现预算；
- `research-iteration-loop` 执行—验证—复盘流程。

实现前完整阅读当前 Next 16.3 本地 Route Handler、route、dynamic routes、`generateStaticParams`、`dynamicParams` 和 next.config headers 文档，未依赖旧版本记忆。

## 5. 实现的功能

1. 每个公开标签都有 `/tags/<slug>/rss.xml`；
2. Feed 只包含具有该标签的公开记录；
3. 条目顺序、GUID、`pubDate`、`dcterms:modified` 与 categories 复用根 RSS 契约；
4. TypeScript Feed 当前精确包含代表文章与 MyBlog 项目两条记录；
5. 标签页同时提供可见订阅动作和 HTML alternate 自动发现；
6. 响应声明准确 MIME、内联文件名、self/up Link 与 `X-Robots-Tag: noindex`；
7. 最终 UTF-8 正文派生 SHA-256 ETag；
8. 普通/条件 GET 和 HEAD 支持 ETag、日期命中及 ETag 优先；
9. 未知标签 GET/HEAD 返回 `no-store` 404、零公开验证器；
10. 标签 Feed 不进入 Sitemap，公开路由数仍为 27；
11. 根 `/rss.xml` 通过共享 helper 保持原正文和既有表示修订时间；
12. 代表标签 Feed 进入第八条发现传输预算。

## 6. 实现方法

先给 `createRssXml()` 写 scoped channel 失败测试，并给生产 smoke 写路由与错误信息静态约束。旧实现忽略 channel 选项且 smoke 不认识标签 Feed，定向测试以 13/15 失败，证明缺口存在。

随后把“正文生成 + HTTP 响应”拆成两层：`createRssXml()` 只负责可配置频道与共享 item 序列化；`createRssResponse()` 负责 MIME、缓存、Last-Modified 与条件验证器。根路由和标签路由都调用同一响应函数，标签路由只提供过滤后的 `tag.items` 与频道元数据。

第一次真实应用测试暴露 `/tags/:path*` 的 HTML 缓存规则把成功 Feed 改成 CDN 专用缓存。按 Next 16.3 headers 文档增加更具体规则后，第二次测试又证明它也会覆盖未知标签的 `no-store`。最终修复不是继续叠加例外，而是把父级 HTML 规则收窄到实际页面 `/tags` 和 `/tags/:slug`，让 RSS 成功与 404 都由 Route Handler 自己拥有协议语义。

功能提交部署后，第 6 次稳定域名探测从旧版 404 切换为新 200。完整生产 smoke 通过后再测量 TypeScript Feed 为 2059/923 B（raw/gzip），把基线来源绑定造成功能变化的 `d4e26b8`，并以独立预算提交接入本地和生产恰好一次覆盖门。

## 7. 验证证据

- 失败优先：定向发现/部署测试旧实现 13/15，通过实现后 15/15；
- 缓存边界回归：应用测试先后捕获成功 Feed 被改写、未知 404 被改写两种错误；
- `npm run lint`：通过；
- `npm run typecheck`：通过；
- `npm run test:unit`：531/531；
- `npm run build`：63 个生成页面，包含动态 `/tags/[slug]/rss.xml`；
- `npm run test:app`：32/32；
- 功能提交：`d4e26b8`（`feat: publish tag-specific RSS feeds`），已推送并进入稳定生产；
- 稳定生产 smoke：27 routes、OAuth 302；标签页发现、标签 Feed、未知标签、条件 GET/HEAD 全部通过；
- TypeScript Feed：2 items、2059/923 B、SHA-256 `355110d23b2e3d75e4d542302281811180613affdeebc803dc731ab7a5075e11`；
- 八个发现端点全部 PASS；标签 Feed 上限为 7168/2048 B；
- 预算提交：`4bda63a`（`test: baseline tag RSS discovery budget`），已推送；
- `git diff --check`：通过；
- 无依赖、客户端 JavaScript、账号、数据库、追踪、第三方服务或云配置变更。

## 8. 经验与教训

1. 动态子路由不能默认继承父页面的缓存意图；
2. next.config headers 会覆盖 Route Handler 返回头，错误分支也不例外；
3. 更具体的覆盖规则不一定安全，因为它同样命中未知资源；
4. 页面缓存规则应匹配页面形状，而不是吞掉整个未来命名空间；
5. 共享 RSS 必须抽取 item/HTTP 边界，不能复制根路由后再逐步漂移；
6. 标签 Feed 的 item GUID 应保持内容规范身份，不创建投影专属身份；
7. HTML 自动发现、可见链接与 HTTP Link 各服务不同消费者，三者应对齐；
8. Feed 无需进入 Sitemap；机器端点数量不应冒充公开页面路由增长；
9. 未知资源的 `no-store`、无验证器必须用真实 GET 和 HEAD 分别证明；
10. Vercel 弱化压缩表示 ETag 时仍应比较同一 opaque SHA-256；
11. 新预算只能在新功能稳定上线后测量，并绑定功能提交；
12. 新投影复用既有 RSS 正文规则时不应虚构根 Feed 的格式修订变化；
13. 构建页面数增长来自公开标签静态参数，应与 Sitemap 路由数分开解释；
14. Obsidian 状态、迭代与知识笔记继续和实现共享同一 Git 历史。

## 9. 全局状态、风险与未解决问题

标签 RSS 已从单一示例路由推广为所有公开标签的动态投影，但自动质量门只选择 TypeScript 作为稳定代表，依靠共享生成器和参数索引覆盖其余标签。标签改名会改变标签页和 Feed URL；当前 slug 由内容索引稳定派生，尚无标签 slug 重定向注册表。

Feed 数量会随标签数增长，但每个响应只包含匹配内容；当前不预生成到 Sitemap，也不引入数据库或持久缓存。阅读器能否展示 category、修改时间或自动发现仍由第三方客户端决定。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱继续需要所有者操作或选择。

## 10. 下一轮唯一主任务

为专题详情增加 `/series/[slug]/rss.xml`。专题是有顺序的学习路径，Feed 应只包含该专题公开记录，并复用本轮共享 RSS 响应、页面可见/自动发现、未知专题 `no-store` 404、条件 GET/HEAD 和生产预算边界；同时明确 Feed 使用全站时间倒序还是专题章节顺序，先用产品语义测试锁定再实现。
