# Iteration 0125：RSS 标签分类语义对齐

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0124 的下一步原计划是“为 RSS 增加 `<category>`”，但代码审计发现 `createRssXml()` 已经输出分类：它把文章类型或 `Project` 和作者标签一起塞进无 `domain` 的 RSS category。JSON Feed 则只把 `record.tags` 输出为 `tags`。因此真实问题不是缺字段，而是同一公开内容在两种 Feed 中拥有两套分类语义。

本轮把 RSS category 收敛为作者已经维护的公开 tags：逐 item 数量、顺序和值都与对应 JSON Feed `tags` 一致；所有值经过 XML 转义；不发明 category domain；不改变 URL、GUID、首发/修改时间和条目排序。RSS 正文变化后必须推进格式修订时间、ETag 和生产体积基线，并由真实 Next 构建与稳定 Vercel 共同证明。

## 2. 项目结构状态

- `lib/discovery.ts`：RSS item 的 categories 改为只序列化 `record.tags`；
- `lib/feed-http.ts`：RSS 表示修订时间推进到 `2026-08-10T22:25:11Z`，注释改为准确的“正文契约批准时间”；
- `tests/discovery.test.mjs`：失败优先锁定文章、项目、同日更新记录的精确标签，并覆盖 XML 特殊字符；
- `tests/rendered-html.test.mjs`：逐 item 比较 RSS category 与 JSON Feed tags，同时更新日期条件契约；
- `scripts/smoke-production.mjs`：解码 XML 文本后逐 item 比较生产 RSS 与 JSON Feed，并继续检查 ETag、Last-Modified、GET/HEAD 和 304；
- `tests/deployment-tools.test.mjs`：锁定生产 smoke 的标签比较与专用失败边界；
- `scripts/discovery-budget.mjs`、`tests/discovery-budget.test.mjs`：以功能提交 `f9bd0d0` 的稳定生产响应重测七端点基线；
- 六份全局中文文档、`docs/knowledge/0125-feed-taxonomy-consistency.md` 与本文件：归档设计、实现、验证、风险和下一步。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

同一个标签事实源现在只做格式投影：

```text
ContentRecord.tags
├─ JSON Feed item.tags[]
└─ RSS item <category>...</category>*

内容类型 article / til / project
└─ 不混入无 domain 的 category
```

RSS 2.0 允许 item 出现零个或多个 category，并允许但不要求 `domain`。本站现有标签没有一套可声明的外部 taxonomy URI，因此不虚构 domain。项目类型仍由页面、清单和其他内容字段表达，不占用“读者主题标签”的语义位置。

## 4. 使用的技术与规范

- RSS 2.0 item category；
- JSON Feed 1.1 item tags；
- XML 实体转义与生产端最小文本解码；
- SHA-256 ETag、Last-Modified、条件 GET/HEAD；
- Next.js 16.3、Node test、ESLint、TypeScript、生产构建；
- Vercel 稳定生产 origin 与七端点 raw/gzip 冻结预算；
- `research-iteration-loop` 执行—验证—复盘流程。

规范证据：[RSS 2.0 Specification](https://www.rssboard.org/rss-specification) 允许 item 的 `category` 出现任意次数，`domain` 为可选属性。

## 5. 实现的功能

1. RSS 每个 item 只输出 `record.tags`；
2. RSS category 与 JSON Feed tags 保持相同数量、顺序和值；
3. `article`、`til`、`Project` 不再伪装成无 domain 标签；
4. `&`、`<` 等特殊字符正确转义为合法 XML；
5. 生产 smoke 会解码 XML 实体后比较跨格式语义；
6. GUID、URL、`pubDate`、`dcterms:modified`、排序和频道事实不变；
7. RSS Last-Modified 更新为 `Mon, 10 Aug 2026 22:25:11 GMT`；
8. 最终正文继续派生强 SHA-256 ETag，Vercel 弱化时保持同一 opaque digest；
9. RSS 普通/条件 GET 与 HEAD、ETag/日期优先级继续通过既有门；
10. 新生产 RSS 为 3400/1284 B（raw/gzip），小于旧基线 3536/1298 B。

## 6. 实现方法

先审计真实实现而不是照抄路线图。审计发现旧 RSS 已经输出 `<category>`，于是先给现有生成器添加“只允许 tags”的断言；旧实现实际返回 `article + TypeScript`，测试以 7/8 失败，证明语义漂移存在。

实现只改一个事实边界：`createRssXml()` 从 `record.tags` 映射 category。单元层另外构造 `Data & <XML>` 标签证明 XML 转义；应用层把同一索引位置的 RSS item 与 JSON Feed item 对齐；生产层先把 XML 实体还原为文本，再比较数组，避免只比较转义后的字面形式。

RSS 正文契约改变后推进独立表示修订时间。第一次生产 smoke 正确命中尚未切换的旧部署并以“RSS 条目、标签或条件验证器异常”失败；Vercel 切换后第二次 smoke 全部通过。随后才把真实生产七端点值绑定到功能提交，而没有用本地输出或未部署提交自我放行。

## 7. 验证证据

- 失败优先：`tests/discovery.test.mjs` 旧实现实际得到 `["article", "TypeScript"]`，8 项中 1 项失败；
- `npm run lint`：通过；
- `npm run typecheck`：通过；
- `npm run test:unit`：530/530；
- `npm run build`：52 个页面；
- `npm run test:app`：31/31；
- 功能提交：`f9bd0d0`（`fix: align RSS categories with tags`），已推送并进入稳定生产；
- 稳定生产 smoke：27 routes、OAuth 302；RSS 标签、ETag、Last-Modified、条件 GET/HEAD 全部通过；
- 十三条 HTML 与七个发现端点预算全部 PASS；
- 生产重测：清单 3009/921、Schema 3278/755、JSON Feed 20697/9876、RSS 3400/1284、Sitemap 5059/532、robots 155/127、OpenSearch 700/462 B（raw/gzip）；
- 基线提交：`0b1f81d`（`test: rebaseline RSS discovery budget`），已推送；
- `git diff --check`：通过；
- 无 UI、客户端 JavaScript、依赖、账号、数据库、追踪或云配置变更。

## 8. 经验与教训

1. 路线图是待验证假设，不是当前实现的事实；
2. “字段已经存在”仍可能隐藏语义错误；
3. 内容类型和主题标签不是同一分类轴，不能因为都能写进字符串就混用；
4. 跨格式 Feed 应以同一个内容事实源逐项对齐；
5. RSS 的可选 `domain` 不能在没有真实 taxonomy URI 时虚构；
6. XML 测试既要验证转义后的合法正文，也要验证解码后的业务值；
7. 表示正文变化必须同步推进 Last-Modified 和 ETag 身份；
8. 部署探针先失败可以证明稳定域名仍在旧版本，不应误判为代码回归；
9. 生产基线必须在新正文上线后实测，并绑定造成本次变化的功能提交；
10. 删除错误冗余字段也属于有价值的产品变化，而且能缩小传输；
11. GUID、时间和排序不应被标签修复顺带改变；
12. Obsidian 状态、迭代和知识笔记继续与代码共享 Git 历史。

## 9. 全局状态、风险与未解决问题

RSS 与 JSON Feed 现在共享 URL 顺序、首发/修改时间和主题标签语义。阅读器可以选择不展示 category，本站只能保证标准输出与跨格式一致，不能保证第三方客户端的 UI。无 domain category 表达本站自由标签，而不是受控外部分类体系；将来若引入正式 taxonomy URI，需要单独迁移并验证兼容性。

当前只有一个全站 RSS。读者虽然能看到标签，却不能只订阅某个主题。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择。

## 10. 下一轮唯一主任务

为现有标签页增加主题级 RSS，例如 `/tags/[slug]/rss.xml`。端点只包含该标签的公开记录，复用全站 RSS 的生成、排序、标签、修改时间、ETag、条件 GET/HEAD 与缓存边界；标签页提供可见订阅入口和自动发现链接，未知标签返回真实 404。先阅读当前 Next 16.3 动态 Route Handler 文档，再失败优先完成路由、生产预算与中文归档。
