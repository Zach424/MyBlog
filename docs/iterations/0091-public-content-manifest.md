# Iteration 0091：公开内容清单

## 1. 范围与成功标准

本轮只补齐公开内容的机器批量发现层，不改变 Git Markdown 事实源、Studio/Obsidian 写入流程、Feed 正文、Sitemap 搜索语义、页面视觉或部署平台。成功标准是：稳定 `/content.json` 一次枚举全部公开文章、TIL 与项目；提供同 origin HTML URL、Markdown URL 和与真实源文一致的 SHA-256 ETag；只输出明确公开字段；与 JSON Feed/RSS 使用同一记录集合和顺序；清单自身可缓存、可条件读取、可从根 HTML 发现；真实 Vercel 生产语义进入自动冒烟。

## 2. 项目结构状态

- `app/content.json/route.ts`：新增公开动态 Route Handler，只调用公开内容 getter 与共享响应工厂；
- `lib/content-manifest.ts`：新增版本 1 清单投影、稳定排序、逐项源文 ETag、清单响应头与条件 304；
- `lib/http-validators.ts`：从源文模块提取共享 SHA-256、实体标签列表解析、GET 弱比较与公共条件缓存策略；
- `lib/public-markdown.ts`：改为复用共享验证器，公开输出与迭代 0090 保持兼容；
- `app/layout.tsx`：新增 `/content.json` 的 `application/json` alternate，服务端暴露发现入口；
- `tests/content-manifest.test.mjs`：新增字段 allowlist、顺序、origin、逐项 ETag、响应头和 200/304 单元测试；
- `tests/rendered-html.test.mjs`：真实 Next 生产服务器逐项比对清单与全部源文，并核对 Feed/RSS/Sitemap 一致性；
- `scripts/smoke-production.mjs`：生产站覆盖清单 200/304、Vercel 强弱 ETag、全部源文摘要和首页发现；
- `package.json`、部署结构测试、README、架构、内容模型、发现、质量和运维文档同步更新；内容 Markdown、组件样式、Studio、Obsidian 插件与依赖版本未改变。

## 3. 设计内容

本轮没有视觉改动，设计对象是一个小而自描述的机器契约。顶层字段固定为 `version`、`home_url`、`manifest_url`、`language`、`items`；item 字段固定为 `id`、`kind`、`type`、`title`、`html_url`、`markdown_url`、`markdown_etag`、`published_at`、可选 `updated_at`、`reviewed_at`、`tags`。`id` 等于本站 HTML URL，项目公开 type 固定为 `project`。

清单刻意不成为第三个正文 Feed：不输出正文、摘要、canonical、草稿、featured、slug、源文件路径或派生统计。JSON Feed 继续服务订阅读者，清单只负责“有什么、在哪里、是否变化”，单篇 `source.md` 才承载 Markdown 结构。根 HTML 用 alternate 使工具无需阅读项目文档即可发现清单；清单自己声明 self/up Link、内联安全文件名和 `noindex`。

## 4. 使用的技术

- Next.js 16.3 原生 Route Handler、`Request`/`Response`/`Headers` 与 Metadata alternates；实现前通读仓库安装版本的 Route Handler API 和 CDN 缓存文档；
- Node.js `node:crypto`：清单正文与每篇最终可移植 Markdown 的 SHA-256；
- HTTP `If-None-Match`：共享强/弱实体标签、列表、通配符与 304 语义；
- 现有 `getAllContent()`、`createPublicMarkdown()`、`absoluteSiteUrl()`：复用公开边界、稳定排序语义与 origin 解析；
- JSON：两空格格式化、固定插入顺序、末尾换行，保证可读且可复现；
- `research-iteration-loop` skill：维持单一发现功能、失败优先、全量门禁、真实生产检查和全局风险归档。

## 5. 实现的功能

1. `/content.json` 一次返回当前 4 条公开文章/TIL/项目，顺序与 JSON Feed/RSS 完全一致；
2. 每项提供绝对 `html_url`、相邻 `markdown_url` 和对应最终源文的强 `markdown_etag`；
3. 文章保留 `article`/`til` 公开 type，项目使用 `project`，同时保留 post/project kind；
4. 日期只输出发布、可选更新和复核事实；标签保持内容契约顺序；
5. 草稿、未来内容和所有作者内部字段因公开 getter 与 item allowlist 双重边界不能进入清单；
6. 清单本身具有最终 JSON 字节强 ETag、全部公开日期事实的最新 Last-Modified、浏览器复核/CDN 缓存、`noindex` 和空 304；
7. 根 HTML 服务端输出 `application/json` alternate，工具可发现 `/content.json`；
8. 应用测试和生产冒烟请求清单中的全部 Markdown URL，逐项比较强弱归一化后的同一 SHA-256 opaque digest；
9. 清单不进入 Sitemap，不与搜索引擎 HTML 页面竞争收录，也不增加客户端 JavaScript。

## 6. 实现方法

先把生产 `/content.json` 的真实 404/no-store 记录为基线，再新增清单单元测试、应用 HTTP 契约、首页 alternate 和生产冒烟断言。首轮定向测试立即以 `ERR_MODULE_NOT_FOUND` 失败，准确证明 `lib/content-manifest.ts` 尚不存在。随后实现共享验证器、清单生成器和 Route Handler；源文模块只把既有私有 SHA-256/条件解析迁移到共享模块，没有改变响应协议。定向测试最终 12/12，全量应用测试再证明真实 Next 服务端输出。

每个 `markdown_etag` 都直接对 `createPublicMarkdown(siteUrl, record)` 的最终字节计算，而不是复制字段拼接或读取源文件摘要。这样清单和源文共享公开投影、URL 绝对化和序列化事实。清单自身先生成完整 JSON，再哈希并判断 `If-None-Match`；Last-Modified 从所有记录的 published/updated/reviewed 日期中取最大值。排序对副本执行，调用方数组不被修改。

生产冒烟把清单、JSON Feed、RSS 和 Sitemap 放在同一验证阶段：清单 id 顺序必须等于 Feed/RSS，Sitemap 的内容 URL 集合继续一致；随后并发读取清单中的全部源文，允许 Vercel 改变 ETag 强弱形式，但不允许摘要变化。清单 304 使用与源文相同的“源站严格、边缘等价”验证策略。

## 7. 验证证据

- 上线前生产基线：`/content.json` 返回 HTML 404，`private, no-cache, no-store, max-age=0, must-revalidate`；
- 失败优先：`node --experimental-strip-types --test tests/content-manifest.test.mjs` 因缺少 `lib/content-manifest.ts` 返回 `ERR_MODULE_NOT_FOUND`；
- 定向修复：清单、源文和部署工具测试 12/12；
- 完整 `npm run release:check`：410/410 单元测试、TypeScript、47/47 构建路由、20/20 真实应用检查、九条 HTML raw/gzip 预算、生产依赖审计 0；Current 1、Historical 3、inbox 0、根暂存媒体 0、外链本地问题 0；
- 功能提交：`fa5bf9f`；
- [Quality Gate #168](https://github.com/Zach424/MyBlog/actions/runs/31327124002) 与 [Production Smoke #161](https://github.com/Zach424/MyBlog/actions/runs/31327159229) 均成功；
- 手动稳定生产冒烟：24 条 Sitemap 路由、OAuth 302、九条实际 origin HTML 预算、清单/Feed/RSS/全部源文契约全绿；
- 真实生产清单：200、3,009 字节、version 1、4 items、Brotli、`X-Vercel-Cache: HIT`、客户端缓存 `public, max-age=0`；
- 生产 200 ETag 为 `W/"sha256-88aa…ebbb"`，Last-Modified 为 `Thu, 06 Aug 2026 00:00:00 GMT`；同标签条件读取返回 304、0 字节和相同摘要的强 ETag，边缘省略 Last-Modified，符合既有等价验证契约。

## 8. 经验与教训

索引与正文应保持分工。把全文再次放入清单会复制 JSON Feed 的体积问题，也会迫使同步器为判断“是否变化”先下载全部内容；地址加摘要足以完成发现和增量决策。清单 item 的 ETag 必须通过真实源文生成器得到，不能从作者文件、Git 提交或日期猜测，否则绝对 URL、公开字段序列化和正文改写的任何变化都会失配。

共享协议实现比复制代码更重要。若源文与清单各自解析 `If-None-Match`，它们很容易在弱标签、列表或畸形值上分叉；本轮先抽取验证器，再让两类响应共同使用。迁移后的既有源文测试仍全部通过，证明重构没有以新功能为代价破坏迭代 0090。

`markdown_etag` 记录的是源站最终表示身份，Vercel 传输时仍可能因 Brotli 显示为弱标签。客户端应比较 opaque digest，而不是要求强弱前缀逐字相同。域名变化总会改变清单 URL；只有源文实际含当前 origin URL 时，其正文摘要才随之变化，不能把“通常会变”误写成无条件协议。

## 9. 全局状态、风险与未解决问题

公开读取链路现在形成四层：Sitemap 负责搜索引擎 HTML 路由，JSON Feed/RSS 负责订阅，`content.json` 负责批量机器发现和变化摘要，单篇 `source.md` 负责结构化 Markdown。它们都从同一公开 getter 派生，不需要数据库、对象存储、第三方同步服务、账号或写入 API；作者仍可独立使用 Studio、Obsidian 发布器或普通 Git。

当前清单是项目自定义 version 1 契约，尚未发布独立 JSON Schema，也没有面向其他语言的生成客户端。4 条记录仅 3.0 KiB，但每次源站生成清单需要遍历所有公开记录并生成全部可移植 Markdown；CDN 已限制正常成本，内容规模明显增长后仍要按实测响应体、CPU 和构建时间决定是否缓存派生结果或分页，不能提前复杂化。

清单已经让消费者能判断生产内容，但当前仓库还没有一个作者可直接运行的只读检查器，将生产清单与本地待发布内容对比成 deployed/pending/missing/unexpected。Obsidian 插件也尚未把生产部署确认作为原生命令显示；现有 Git 回执只证明推送，不等于 Vercel 已接收同一内容。既有 Decap 开发依赖高危项、Actions pin 主动复核、真实 Obsidian 主题首次使用、自定义域名、统计、评论和公开邮箱等风险保持不变。

## 10. 下一轮唯一主任务

新增只读的生产内容同步检查器，并把它接入现有 Obsidian 作者命令。核心 CLI 从本地公开内容生成同一 origin 的期望清单，受限请求生产 `/content.json`，按 id 与 `markdown_etag` 输出 deployed、pending、missing、unexpected 和协议错误；默认不改文件、不提交、不推送，网络失败与清单不可信必须失败关闭。先用离线 fixture 锁定比较器、排序、摘要、超时/状态/格式错误和零写入，再增加显式实时检查与 Obsidian 可读摘要；不接入账号、数据库、第三方 API 或外部通知。
