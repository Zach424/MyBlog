# Iteration 0090：Markdown 源文条件读取

## 1. 范围与成功标准

本轮只补齐文章/项目公开 Markdown 源文的 HTTP 新鲜度验证，不改变 Git Markdown 事实源、Studio/Obsidian 写入流程、页面视觉、Feed 或部署平台。成功标准是：最终 UTF-8 源文具有确定性 SHA-256 ETag；公开日期事实派生稳定 `Last-Modified`；`If-None-Match` 支持强标签、弱标签、列表与 `*`；命中时返回零正文 304，不命中或畸形条件头返回完整 200；404 继续不可缓存；本地源站和真实 Vercel CDN 的等价语义分别进入自动测试与生产冒烟。

## 2. 项目结构状态

- `lib/public-markdown.ts`：在既有公开投影、URL 绝对化和响应工厂上增加 ETag、Last-Modified、实体标签解析、弱比较及 304 分支；
- `app/posts/[slug]/source.md/route.ts`、`app/projects/[slug]/source.md/route.ts`：路由结构不变，继续只调用共享公开源文响应工厂；
- `tests/public-markdown.test.mjs`：覆盖最终字节哈希、日期、内容/origin 变化、强弱/列表/通配条件、错值与畸形输入；
- `tests/rendered-html.test.mjs`：真实 Next 生产服务器覆盖 200/304 头、正文和哈希；
- `scripts/smoke-production.mjs`：生产站验证强或 CDN 弱化 ETag、相同 opaque digest、空 304、缓存及可选元数据一致性；
- `tests/deployment-tools.test.mjs`：锁定生产验证器只接受 `sha256-<64 hex>`，且强弱标签仅在摘要相同时等价；
- README、架构、内容模型、发现、质量和运维文档同步更新；页面组件、CSS、内容文件、Studio、Obsidian 插件和依赖版本均未改变。

## 3. 设计内容

本轮没有视觉改动，设计对象是协议边界。源站把最终响应体定义为表示身份，使用可读前缀的强标签 `"sha256-<digest>"`；浏览器或同步器把收到的标签原样放入下一次 `If-None-Match`。Vercel 为 Brotli 传输表示加上 `W/` 时，客户端仍比较引号内相同的 opaque tag，而不是假设强弱形式不会变化。

304 被设计成缓存复核信号，不是缩短版文档。源站本地测试锁定完整共享头，生产验证则遵守边缘平台和 HTTP 允许的归一化：必须有相同摘要 ETag、安全缓存策略和零正文；`Last-Modified`、canonical `Link`、`noindex` 若仍出现则必须与 200 一致，但边缘省略它们不判故障。这样既不掩盖内容身份漂移，也不把 CDN 合规行为当成产品回归。

## 4. 使用的技术

- Node.js `node:crypto`：对最终 UTF-8 响应体计算 SHA-256；
- Next.js 16.3 Route Handler 与原生 `Request`/`Response`/`Headers`：读取条件头并生成 200、304、404；实现前已通读仓库安装版本的 Route Handler、`generateEtags` 与 CDN 缓存文档；
- HTTP 条件请求：`If-None-Match` 的 GET 弱比较、实体标签列表、通配符与 304 语义；
- Vercel CDN：允许压缩表示弱化 ETag，并验证平台消费 `s-maxage` 后客户端仍看到等价的 `public, max-age=0`；
- 规范依据：[RFC 9110：304 Not Modified](https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified)、[RFC 9110：If-None-Match](https://www.rfc-editor.org/rfc/rfc9110.html#field.if-none-match) 与 [Vercel Cache-Control 响应头文档](https://vercel.com/docs/headers/cache-control-headers)；
- `research-iteration-loop` skill：维持单一协议功能、失败优先、全量门禁、线上复核和全局风险更新的完整闭环。

## 5. 实现的功能

1. 成功源文响应的 ETag 为最终 UTF-8 字节的 SHA-256，公开字段、正文、序列化或请求 origin 改变都会改变标签；
2. `Last-Modified` 取 `publishedAt`、`updatedAt`、`reviewedAt` 中最新日期的 UTC 零点，明确作为日粒度辅助事实；
3. `If-None-Match` 接受精确强标签、`W/` 弱标签、逗号列表和 `*`，按 GET 弱比较命中；
4. 命中返回状态 304 与空正文；错值、无效或未闭合实体标签返回完整 200；
5. 200 与源站 304 共享内容验证器、缓存、canonical 和 `noindex` 响应构造；
6. 未知、草稿和未来内容仍为 `no-store`/`noindex` 404，不生成公开验证器；
7. 生产冒烟接受 Vercel 将强标签规范化为弱标签，但拒绝摘要变化、非法标签、304 正文、危险缓存或仍存在的元数据漂移；
8. Obsidian 与其他同步器现在可以保存上次 ETag，只在源文真正变化时下载完整 Markdown。

## 6. 实现方法

先扩展单元、真实应用和生产冒烟测试，不修改实现。首轮定向测试 8 项中 6 项通过、2 项按预期失败，证明现有源文没有 ETag；实现摘要、日期、解析器和响应分支后定向测试变为 8/8。实体标签解析逐字符处理引号外逗号，避免用简单 `split(',')` 猜测列表；匹配时先规范化可选 `W/`，只对同一 opaque tag 做弱比较。

第一次上线后，Quality Gate #165 成功，但 Production Smoke #158 失败。直接检查真实响应发现：200 为 Brotli 编码，Vercel 把 `"sha256-…"` 输出成 `W/"sha256-…"`；带该值复核得到零正文 304，opaque digest 相同，但边缘又把 304 的 ETag 输出为强形式并省略 Last-Modified、Link 与 robots 元数据。依据 RFC 9110 和平台行为复核后，没有修改源站契约，而是先为生产比较器补失败测试，再让它比较强弱标签中的同一摘要，并将 304 表示元数据设为“若出现则必须一致”。修正后的定向测试 9/9、完整门禁和线上工作流全部恢复通过。

## 7. 验证证据

- 上线前生产基线：源文 200、4,144 字节，无 ETag/Last-Modified，第二次请求仍下载完整 4,144 字节；
- 失败优先：首轮定向 6/8，两个失败都指向缺失 ETag；实现后 8/8；针对 CDN 归一化的新测试先因缺少导出失败，修正后部署工具定向测试 9/9；
- 最终完整 `npm run release:check`：407/407 单元测试、TypeScript、46/46 页面、20/20 真实应用检查、九条 HTML raw/gzip 预算、生产依赖审计 0；Current 1、Historical 3、inbox 0、根暂存媒体 0、外链本地问题 0；
- 功能提交：`f5e6c16`（源文 ETag、Last-Modified 与条件读取）；
- 生产归一化修正提交：`3c25820`（强弱 ETag 等价与最小 304 验证）；
- [Quality Gate #165](https://github.com/Zach424/MyBlog/actions/runs/31325412078) 成功；[Production Smoke #158](https://github.com/Zach424/MyBlog/actions/runs/31325440692) 失败并保留为真实 CDN 差异证据；
- [Quality Gate #166](https://github.com/Zach424/MyBlog/actions/runs/31325920449) 与 [Production Smoke #159](https://github.com/Zach424/MyBlog/actions/runs/31325949204) 修正后成功；
- 手动稳定生产复跑：24 条 Sitemap 路由、OAuth 302、九条实际 origin HTML 预算、文章/项目源文与条件 304 全部通过；
- 真实生产样本：200 的 ETag 为 `W/"sha256-7448…be43"`、Last-Modified 为 `Wed, 05 Aug 2026 00:00:00 GMT`；条件请求返回 304、零正文、相同摘要的强标签，并由边缘省略非必要表示元数据。

## 8. 经验与教训

源站响应不是最终传输表示。压缩、缓存和边缘复核都可能改变标签强弱或裁剪 304 元数据，因此测试必须分两层：本地真实 Next 服务器证明我们生成的严格契约，生产冒烟证明平台对外提供的等价协议。把两层写成同一组逐字符串断言，会产生“规范越严格、线上越容易误报”的反效果。

失败的 Production Smoke 不应被删除或淡化。它证明了测试确实能发现未建模的部署边界，也让“为什么允许弱标签、为什么 Last-Modified 在 304 可缺省”有可追溯证据。修复验证器时仍要保留硬边界：标签格式必须是 SHA-256，opaque digest 必须相同，正文必须为空，缓存必须安全，可选头出现时不得漂移。

`Last-Modified` 只精确到内容模型的日期粒度，不能代替字节身份；同步器应优先保存 ETag。生成摘要必须在全部 frontmatter、正文和绝对 URL 已确定之后进行，否则 origin 或序列化变化会错误复用旧标签。

## 9. 全局状态、风险与未解决问题

公开读取层现在具有 HTML、JSON Feed 1.1、RSS、单篇可移植 Markdown 和高效条件读取。它不需要数据库、对象存储、第三方同步服务或写入 API，且没有给客户端 bundle 增加代码。作者写入仍只通过 Studio、Obsidian 发布器或普通 Git，公开源文端点保持只读。

源文仍不是作者原文件的无损 round-trip；YAML 注释、键顺序和内部写作字段不会保留，raw HTML 属性不参加 URL 改写。`Last-Modified` 是日粒度，ETag 会因 origin 改变，因此自定义域名切换后同步器会合理地看到一次全量变化。CDN 对 304 的元数据裁剪属于平台行为，若未来迁移主机必须重新运行生产冒烟而不能假设完全相同。Decap 开发依赖高危项、Actions pin 主动复核、真实 Obsidian 主题首次使用、自定义域名、统计、评论和公开邮箱等既有风险保持不变。

当前单篇地址已适合“已知 URL 的增量复核”，但 Obsidian/自动化工具仍要先从 Sitemap、Feed 或 HTML 猜测有哪些内容及其 Markdown 地址；还没有一个只读、机器可读、一次请求即可枚举全部公开内容和源文验证器的清单。

## 10. 下一轮唯一主任务

新增确定性的公开内容清单 `/content.json`，让 Obsidian/自动化工具一次发现全部公开文章与项目。清单 version 1 只从公开 getter 派生，稳定排序并输出 kind、title、HTML URL、Markdown URL、公开日期、标签和与同 origin 源文一致的 Markdown ETag；草稿、未来内容、内部路径与作者字段不能出现。清单自身提供安全缓存与条件读取，并进入单元、真实应用、Sitemap/Feed 一致性和生产冒烟；先写失败测试，再实现，不增加数据库、外部同步服务、账号或写入 API。
