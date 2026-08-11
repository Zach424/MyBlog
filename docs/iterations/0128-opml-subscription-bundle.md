# Iteration 0128：OPML 聚合订阅包

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0126–0127 已让每个公开标签和专题拥有独立 RSS，但读者仍要逐页收集地址。本轮新增 `/feeds.opml`，把全站 RSS、全部公开标签 RSS 和全部公开专题 RSS 组织成一次导入的 OPML 2.0 文档，并在 `/subscribe` 提供不依赖 JavaScript 的可见下载入口。

成功标准是：端点只消费现有公开索引，不维护第二份频道清单；当前精确输出 1 个根 RSS、11 个标签 RSS 和 1 个专题 RSS；分组与内部顺序稳定，所有订阅 URL 为当前 origin 的绝对地址；XML 符合 [OPML 2.0 specification](https://opml.org/spec2.opml)，属性安全转义；响应具有准确 MIME、文件名、Link、`noindex`、缓存、最终正文 SHA-256 ETag 和 GET/HEAD 条件读取；端点不进入 Sitemap。只有在功能进入稳定生产后，才增加第十条发现传输预算。

## 2. 项目结构状态

- `lib/opml.ts`：新增 OPML 2.0 纯生成器和 HTTP 响应边界；
- `app/feeds.opml/route.ts`：新增聚合 Route Handler，把公开标签/专题索引映射为订阅描述；
- `lib/subscriptions.ts`：在根 RSS 后增加 OPML 通道，目录由五条扩为六条；
- `app/subscribe/page.tsx`：更新页面说明，继续由共享目录自动渲染；
- `tests/opml.test.mjs`：覆盖分组、排序、属性、输入不变、XML 转义和空分组；
- `tests/subscriptions.test.mjs`：锁定六通道顺序、路径与动作；
- `tests/rendered-html.test.mjs`：覆盖 SSR、真实 Route Handler、公开 URL 集合、Sitemap 排除、ETag 条件请求和 HEAD；
- `scripts/smoke-production.mjs`：在线解析并验证 OPML，订阅集合从 Sitemap 公开标签/专题页推导；
- `scripts/discovery-budget.mjs`：增加 `/feeds.opml` 的稳定生产 raw/gzip 基线；
- `tests/deployment-tools.test.mjs`、`tests/discovery-budget.test.mjs`：锁定 smoke 行为、来源提交和预算数值；
- 六份全局中文文档、`docs/knowledge/0128-optional-time-metadata-must-be-provable.md` 与本文件：归档结构、设计、技术、功能、方法、证据、风险和经验。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

```text
公开订阅索引
├─ root RSS ───────────────┐
├─ 11 × public tag RSS ────┼─ createSubscriptionOpml()
└─ 1 × public series RSS ──┘          │
                                      ├─ 全部更新
                                      ├─ 按标签
                                      └─ 按专题
                                              │
                                              └─ /feeds.opml
```

OPML 是频道目录，不是内容副本。leaf 保留频道标题、说明、RSS 地址和对应 HTML 语境，不复制任何文章正文。根组固定在最前，标签与专题分别按 `zh-CN` 标题、英文 slug 稳定决胜；生成器复制输入后排序，避免污染调用方索引。

`/subscribe` 继续使用 Commit Trace switchboard，只增加第 2 个 Port“OPML 2.0 / 一次导入全部订阅”。它不增加账号、邮件表单、订阅状态或第三方阅读器集成。OPML 不进入 Sitemap，因为它不是可索引阅读页；可见目录已经提供人工发现。

## 4. 使用的技术与规范

- Next.js 16.3 App Router 与 Route Handler；
- TypeScript、Node Web `Response`、Web Crypto 兼容的 SHA-256 边界；
- [OPML 2.0 specification](https://opml.org/spec2.opml)：`opml/head/body`、必填 outline `text`、订阅 outline 的 `type`/`xmlUrl` 与允许嵌套；
- XML 1.0 属性转义：`&`、`"`、`'`、`<`、`>`；
- `text/x-opml; charset=utf-8`、附件文件名、HTTP Link、`X-Robots-Tag`；
- SHA-256 ETag、`If-None-Match`、GET/HEAD、200/304；
- Node test、ESLint、TypeScript、Next production build；
- Python `xml.etree.ElementTree` 独立 XML 解析复核；
- Vercel 稳定生产 origin、UTF-8 raw 与 Node zlib gzip 双层预算；
- `research-iteration-loop` 的执行—验证—全局复盘—下一步流程。

实现前完整阅读当前 Next 16.3 本地 Route Handler 与 route 文件约定文档，并核对 OPML 2.0 官方规范，没有依赖旧版本框架记忆或非官方字段表。

## 5. 实现的功能

1. 新增公开端点 `/feeds.opml`；
2. 文档声明 `version="2.0"`，head 包含站点 title、owner、GitHub ownerId 和规范 docs URL；
3. 根订阅、标签订阅、专题订阅形成三个稳定分组；
4. 当前精确包含 13 个唯一订阅 leaf；
5. 每个 leaf 至少拥有 `text`、`type="rss"` 和绝对 `xmlUrl`；
6. 同时补充 `title`、`description`、`htmlUrl`、`language="zh-CN"` 和 `version="RSS"`；
7. 标签和专题按标题、slug 稳定排序，且不修改输入数组；
8. XML 特殊字符在属性边界统一转义；
9. 空标签或空专题集合不输出空分组；
10. `/subscribe` 增加第六条 OPML 可见通道；
11. 响应提供准确 MIME、`zach424-subscriptions.opml` 文件名、self/up Link 与 `noindex`；
12. 最终 UTF-8 正文派生强 SHA-256 ETag，并支持条件 GET/HEAD；
13. 有意省略 OPML 日期与 HTTP Last-Modified；
14. OPML 不进入 Sitemap；
15. `/feeds.opml` 进入第十条结构化发现传输预算。

## 6. 实现方法

先写失败优先证据：OPML/订阅/部署定向测试在旧实现中为 7/10，因为生成器不存在、生产 smoke 不认识 `/feeds.opml`、目录仍缺 OPML；真实应用测试为 31/34，因为页面只有五条通道、端点返回 404、HEAD 矩阵没有该目标。这些失败分别证明纯函数、可见入口和真实 HTTP 边界均存在产品缺口。

实现采用两层边界。`createSubscriptionOpml(siteUrl, { tags, series })` 只负责确定性 XML；Route Handler 只从 `getTagIndex()` / `getSeriesIndex()` 选择 `slug`、`title`、`count` 并传入。响应 helper 再集中缓存、下载文件名、Link、`noindex`、ETag 与 304，避免页面、路由和 smoke 各自复制协议事实。

测试不把“13”作为唯一事实。单元测试用带特殊字符和打乱顺序的夹具证明序列化契约；真实应用与生产 smoke 从 Sitemap 中提取全部公开标签/专题页面，再拼出预期 RSS 地址，与 OPML 的 `xmlUrl` 集合做精确相等和唯一性比较。这样新增标签或专题后，OPML 会随同一索引增长，测试不会因为第二份手写清单假绿。

OPML 规范允许 `dateCreated` 和 `dateModified`，但没有要求存在。仓库当前能证明正文内容，却不能证明这个聚合表示的精确修改瞬间；因此不使用构建时间、部署时间或任意文件 mtime，改由正文 SHA-256 ETag 表达字节身份。生产部署第 7 次探测从旧 404 切换为新 200；完整 smoke 通过后再冻结预算。

## 7. 验证证据

- 失败优先：OPML/订阅/部署定向测试旧实现 7/10，真实应用旧实现 31/34；
- 定向实现测试：11/11；
- `npm run lint`：通过；
- `npm run typecheck`：通过；
- `npm run test:unit`：534/534；
- `npm run build`：65 个生成页面，包含 `/feeds.opml`；
- `npm run test:app`：34/34；
- Python 独立解析特殊字符夹具：`xml=opml version=2.0 feeds=3`；
- 功能提交：`d0f2165`（`feat: export grouped OPML subscriptions`），已推送并进入稳定生产；
- 稳定生产 smoke：27 routes、OAuth 302，六通道目录与 OPML 全部协议断言通过；
- 稳定生产 OPML：13 个 leaf、5193/962 B（raw/gzip）；
- 正文 SHA-256：`6344a8a82167b1d35b3d55e9f3679dc43cca9b72c31823d74ac8d1e72b7c7ce8`；
- 线上强 ETag：`"sha256-6344a8a82167b1d35b3d55e9f3679dc43cca9b72c31823d74ac8d1e72b7c7ce8"`；
- OPML raw/gzip 上限：10240/2048 B，线上余量分别为 +5047/+1086 B；
- 十个结构化发现端点全部 PASS；
- 预算提交：`e33f395`（`test: baseline OPML discovery budget`），已推送；
- 无依赖、客户端 JavaScript、账号、数据库、追踪、第三方服务或云配置变更。

## 8. 经验与教训

1. 一个频道一个 Feed 解决精确订阅，OPML 解决首次设置与迁移，两者是互补产品任务；
2. 聚合目录必须消费频道索引，不能维护第二份手写 URL 清单；
3. OPML 的分组可表达信息架构，但第三方阅读器可以展平它，产品承诺应落在 leaf 完整性；
4. 稳定排序要显式写出语言和决胜字段，不能依赖文件系统遍历；
5. XML 属性转义应集中在生成器边界，不能相信标题或 slug 永远没有特殊字符；
6. 规范允许的字段不等于应该填，时间元数据必须有可证明来源；
7. 对无可靠时间的确定性资源，正文 digest 足以支持缓存验证；
8. GET、条件 GET、HEAD、条件 HEAD 与 Sitemap 排除应作为一个协议闭环；
9. 真实集合断言应从公开索引/Sitemap派生，而不是把当前数量写死为第二份事实；
10. `text/x-opml` 和下载文件名使浏览器动作明确，不需要客户端脚本；
11. OPML 不是 HTML 页面，不应为了路由总数进入 Sitemap；
12. 先部署功能、再从稳定 origin 冻结预算，避免用本地或未上线正文自我放行；
13. 低 raw、高压缩率的 XML 仍需 raw/gzip 双门，分别捕捉文档膨胀和传输熵；
14. Obsidian 状态、迭代、知识笔记与代码继续共享同一 Git 历史。

## 9. 全局状态、风险与未解决问题

OPML 已覆盖当前全部公开 RSS，并会随公开标签/专题索引自动增长；当前读者可从 `/subscribe` 下载并导入。但第三方阅读器对 OPML 分组、标题和 `version="RSS"` 的展示并不一致，可能把目录展平；本站只能保证文档合法、leaf 完整、URL 可达。

现有根 RSS 有意按首次发布日期排序，逐条更新只放在 `dcterms:modified` 扩展中。部分阅读器会忽略该扩展，因此旧文章真实更新未必重新出现在收件箱顶部。这是下一轮可独立解决的协议缺口。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱继续需要所有者操作或选择，不阻塞当前生产。

## 10. 下一轮唯一主任务

提供按 `updatedAt ?? publishedAt` 倒序的 Atom 1.0 更新订阅，使用标准 `<published>` 与 `<updated>` 区分首次发布和真实修改，并保持现有 RSS 的首发顺序、GUID、`pubDate` 和 `dcterms:modified` 语义不变。新端点应复用公开内容集合、SHA-256 条件响应、GET/HEAD、`noindex` 和生产预算；完成协议设计后再决定加入 `/subscribe` 与 OPML 的准确方式，不增加账号、数据库、追踪、邮件投递或第三方服务。
