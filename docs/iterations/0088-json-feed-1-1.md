# Iteration 0088：JSON Feed 1.1

## 1. 范围与成功标准

本轮只扩展公开内容发现层，不改变 Markdown 事实源、网页 Studio、Obsidian 作者流程、RSS 兼容性、部署平台或任何外部账号。成功标准是：新增符合 JSON Feed 1.1 的 `/feed.json`；根页面输出可被订阅器发现的 `application/feed+json` alternate link；Feed 与 RSS 复用同一公开内容集合和稳定顺序；正文由既有 Markdown AST 纯文本管线生成；绝对 URL 随请求 origin 正确变化；草稿、未来内容与内部字段不能泄漏；本地、完整发布门、GitHub Actions 和真实 Vercel 生产冒烟全部通过。

## 2. 项目结构状态

- `app/feed.json/route.ts`：新增请求时生成的 JSON Feed Route Handler；
- `lib/discovery.ts`：新增 JSON Feed 1.1 生成器，并让 JSON Feed 与 RSS 共用稳定排序函数；
- `app/layout.tsx`：根 metadata 新增 `application/feed+json` alternate；
- `scripts/smoke-production.mjs`：生产冒烟新增首页发现、Feed 响应、字段、隐私、顺序和缓存契约；
- `tests/discovery.test.mjs`：新增生成器字段、纯文本、日期、封面、排序和不修改调用方测试；
- `tests/rendered-html.test.mjs`：新增真实路由、响应头、生产内容与 RSS/Sitemap 同源测试；
- `tests/quality-gates.test.mjs`、`tests/deployment-tools.test.mjs`：把 `/feed.json` 纳入安全基线与部署工具静态契约；
- `app/page.tsx`：把过期的 `23 routes` 证据修正为 `24 public URLs`，明确 Sitemap URL 与非 Sitemap Feed 端点不是同一计数；
- `README.md`、`docs/ARCHITECTURE.md`、`docs/CONTENT_MODEL.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md` 与文档索引同步更新；
- 内容 Markdown、CSS、客户端 bundle、Studio、Obsidian 插件、依赖版本和 workflow 均未改变。

## 3. 设计内容

本轮以机器可读发现为主，不在首页增加新的可见 CTA。订阅器从根 HTML 的 `<link rel="alternate" type="application/feed+json">` 自动发现；读者已有的页面和 RSS 入口保持不变。JSON 顶层提供站点标题、说明、首页、Feed URL、语言、作者和 256×256 icon；每个 item 提供稳定绝对 `id`/`url`、标题、摘要、纯文本正文、发布时间、可选修改时间、标签和可选封面。

Feed 使用格式化 JSON 和结尾换行，便于人工审阅与 Git/HTTP 取证。日期型 frontmatter 确定性映射为 UTC 零点 RFC 3339；这是缺少作者时分秒时的发布约定，不冒充精确发布时间。正文纯文本保留可见 raw HTML 内文、代码、公式源码和图片替代文本，移除 Markdown 标记与 HTML 标签。

## 4. 使用的技术

- [JSON Feed 1.1 官方规范](https://www.jsonfeed.org/version/1.1/)：使用推荐 MIME `application/feed+json`，顶层必需 `version`、`title`、`items`，item 使用稳定 `id` 与 `content_text`；
- Next.js 16.3 Route Handler 的原生 `Request`/`Response`，以及 Metadata `alternates.types`；实现前读取仓库内当前版本文档 `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`、`03-api-reference/03-file-conventions/route.md` 与 `04-functions/generate-metadata.md`；
- 既有 `getAllContent()`：统一过滤草稿与未来内容；
- 既有 `markdownToPlainText()`：复用搜索使用的 mdast 语义，避免第二套正则 Markdown 解析；
- 既有 `resolveSiteUrl()` / `absoluteSiteUrl()`：本地、Preview 与稳定生产共用请求时 origin；
- [Vercel Cache-Control 官方文档](https://vercel.com/docs/caching/cache-control-headers)：Vercel CDN 会消费 `stale-while-revalidate`，因此源响应与客户端可见响应具有不同但等价的缓存头表现。

## 5. 实现的功能

1. `GET /feed.json` 返回 JSON Feed 1.1 和 `application/feed+json; charset=utf-8`；
2. Feed 当前包含 4 条公开文章/TIL/项目，顺序与 RSS GUID 完全一致；
3. 每条 item 的 `id` 与 `url` 相同且为当前 origin 的稳定绝对 URL；
4. Markdown 正文转换为非空 `content_text`，无可见正文时回退公开摘要；
5. `publishedAt` 和可选 `updatedAt` 输出 RFC 3339 日期；
6. 项目封面输出为绝对 `banner_image`，无封面记录不伪造字段；
7. Feed 不输出 `draft`、`sourcePath` 或原始 `body` 字段；
8. 根页面输出 Feed autodiscovery，RSS alternate 保持兼容；
9. 源响应声明一小时 fresh 与 24 小时 SWR；生产验证接受 Vercel 消费 SWR 后的 `public, max-age=3600`，但拒绝错误 TTL、`private`、`no-store` 或错误 SWR；
10. 生产冒烟验证 Feed 与首页、RSS、Sitemap、稳定 origin、安全头、OAuth 和 HTML 双层预算共同工作。

## 6. 实现方法

先修改发现、渲染、质量和部署测试，不加入实现。首次定向结果为 3 项中 2 项失败：缺少 `createJsonFeed` 导出，生产脚本也没有 `/feed.json`。实现生成器后 7 项中 5 项通过；其中一项夹具揭示共享纯文本管线会移除 `<span>` 标签但保留可见内文，测试随真实语义修正。HTTP 接入前应用测试为 16/19，明确暴露路由 404、根 metadata 缺失和安全基线 404；加入 Route Handler 与 metadata 后定向 7/7、应用 19/19。

第一次功能提交上线后，Feed 内容、MIME、4 条 item 和 RSS 顺序均正确，但自动 Production Smoke 因要求完整 `stale-while-revalidate` 响应头而失败。逐项取证发现 Vercel 客户端响应为 `public, max-age=3600`；官方文档确认 CDN 会消费 SWR。随后先加入缓存策略回归测试，首次因缺少 `hasJsonFeedCachePolicy` 导出失败，再实现无顺序依赖的指令解析：允许源响应与 Vercel 归一化响应，仍对不安全或错误策略失败关闭。修正提交重新触发完整自动验收并成功。

## 7. 验证证据

- 生成器/部署失败优先：首次 1/3 通过、2/3 失败；生成器接入后 5/7 通过、2/7 失败；HTTP 接入前应用 16/19；
- 缓存回归失败优先：`tests/deployment-tools.test.mjs` 首次因缺少命名导出失败，最终 3/3；
- 最终定向：发现与部署工具 7/7；缓存修正后部署工具 3/3；
- 静态门：Next 类型生成、TypeScript、ESLint 与 `git diff --check` 全部通过；
- 完整 `npm run release:check`：400/400 单元测试、46/46 页面构建、19/19 应用测试、生产依赖审计 0；Current 1、Historical 3、inbox 0、根暂存媒体 0、外链本地问题 0；
- 本地应用 HTML 预算：9/9；首页 raw `25,761/163,840`、gzip `5,743/8,192`；最大项目页 raw `100,193/163,840`、gzip `23,350/28,672`；
- 稳定生产 Feed：20,697 字节、4 条 item、MIME 正确、客户端缓存头 `public, max-age=3600`；
- 稳定生产 `production:smoke`：24 条 Sitemap URL、OAuth 302、九条 HTML 预算全通过；
- 功能提交：`a55e68bc172c92be26ebdebb456667e6fc25efd4`；缓存契约修正：`8114e0859fac883ea77733dbd99968826428c2bb`；
- [Quality Gate #159](https://github.com/Zach424/MyBlog/actions/runs/31092156541) 成功；首次 [Production Smoke #152](https://github.com/Zach424/MyBlog/actions/runs/31092209143) 按预期暴露缓存验证器问题并失败；修正后的 [Quality Gate](https://github.com/Zach424/MyBlog/actions/runs/31322381543) 与 [Production Smoke](https://github.com/Zach424/MyBlog/actions/runs/31322410233) 均成功。

## 8. 经验与教训

共享解析器的语义必须由测试描述真实行为，而不是由夹具作者猜测。`markdownToPlainText` 对 raw HTML 的策略是去标签、留可见内文；把内文也预期为消失会制造错误契约。JSON Feed 与 RSS 直接比较稳定 URL 顺序，比各自只检查数量更能证明两者来自同一公开索引。

HTTP 客户端的表示也可能误导。PowerShell `Invoke-WebRequest` 会因 `application/feed+json` 把 `.Content` 暴露为 `System.Byte[]`；直接 `ConvertFrom-Json` 会显示空字段，显式 UTF-8 解码后得到完整 20,697 字节与 4 条 item。更重要的是，生产 CDN 可能合法改写可见响应头；冒烟应验证语义不变量，并为官方明确的代理归一化保留边界，而不是机械比较只能在源站看到的字符串。

日期只有日粒度时，UTC 零点是可复现约定，不是事实精度提升。Feed 提供全文纯文本提升订阅器和自动化消费价值，但也意味着所有公开正文会在单个响应中完整复制；必须随着内容增长监控体积。

## 9. 全局状态、风险与未解决问题

公开发现层现在包含本地搜索、JSON Feed 1.1、RSS、Sitemap、robots、JSON-LD 和内容级社交元数据，全部复用同一 Git Markdown 事实源。作者、阅读、媒体、Studio、Obsidian、自动部署和恢复边界保持稳定；本轮没有账号、云服务、数据库、第三方 SDK 或客户端 JavaScript 增量。

当前 Feed 只有 4 条、20.7 KiB，不需要分页；随着全文增长，单响应下载和生成成本会线性增长，达到有证据的阈值后应评估分页、最近 N 条或仅摘要策略，不能提前增加复杂度。`content_text` 有意丢失 Markdown 格式结构，不替代原始 Markdown 导出。根 alternate 由根 metadata 提供，子页面可以有自己的 alternates，不应误称每个页面都重复发现链接。Vercel 缓存归一化已进入测试，但 CDN 平台契约以后变化仍需生产冒烟兜底。既有 Decap 开发依赖上游高危项、Actions pin 主动复核、真实 Obsidian 主题首次使用，以及等待所有者选择的自定义域名、统计、评论和公开邮箱保持不变。

## 10. 下一轮唯一主任务

实现公开内容的规范 Markdown 源文端点与详情页入口，让读者、Obsidian 和自动化工具在不访问 GitHub 仓库结构的前提下取得单篇可移植源文。先定义 `/posts/[slug]/source.md` 与 `/projects/[slug]/source.md` 的公开字段 allowlist、`text/markdown; charset=utf-8`、安全文件名、canonical、站内链接/本地媒体绝对化、草稿/未来内容 404、缓存和不泄漏 `draft`/源路径的契约；详情页增加可访问的“查看 Markdown 源文”链接和 `text/markdown` alternate。先写生成器、路由、metadata、可见入口、404、隐私与生产冒烟失败测试，再实现；不接入账号、数据库、云存储或第三方 API。
