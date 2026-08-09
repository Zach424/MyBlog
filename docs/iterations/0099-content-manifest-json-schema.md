# Iteration 0099：公开内容清单 JSON Schema

## 1. 范围与成功标准

本轮只关闭 Iteration 0098 状态复盘中“`/content.json` 是项目自定义契约，但外部客户端必须阅读 TypeScript 或复制私有 parser 才能验证结构”的缺口。目标是发布同源、机器可读的 JSON Schema，不修改内容 Markdown、发布写事务、Obsidian sealed receipt/handoff、生产同步状态机、Studio、Vercel 配置或任何外部服务。

成功标准是：新增 `/content.schema.json`，使用 JSON Schema Draft 2020-12 严格描述 version 1 清单结构；清单与 Schema 使用注册的 `describedby` / `describes` Link relation 双向发现；端点具备准确 MIME、安全文件名、SHA-256 ETag、分层缓存、空 304 和 `noindex`；标准 validator 必须接受真实清单并拒绝代表性结构漂移；本地真实 Next 应用、生产冒烟、GitHub Quality Gate 与 Vercel production status 全部通过。

## 2. 项目结构状态

- `app/content.schema.json/route.ts`：新增原生 Request/Response GET Route Handler；
- `lib/content-manifest-schema.ts`：生成 origin-scoped Draft 2020-12 Schema、最终 JSON 字节与条件响应；
- `lib/content-manifest.ts`：清单 Link 增加 `rel="describedby"` Schema 发现；
- `lib/http-validators.ts`：复用既有 SHA-256 ETag、If-None-Match 弱比较和公开条件缓存策略，没有复制协议实现；
- `tests/content-manifest-schema.test.mjs`：新增确定性结构、响应头/304、Ajv 真实清单和九类反例；
- `tests/content-manifest.test.mjs`：锁定清单 self/describedby/up Link；
- `tests/rendered-html.test.mjs`：真实 Next 进程检查 Schema 200/304、origin、关键结构与 SHA-256；
- `scripts/smoke-production.mjs` / `tests/deployment-tools.test.mjs`：生产端同时核对清单、Schema 与双向关系；
- `package.json` / `package-lock.json`：固定开发依赖 `ajv@8.20.0` 并把新测试加入全门；Ajv 不进入生产 dependencies；
- README、架构、内容模型、发现、运维、质量、状态、路线图与本归档同步更新；内容、Studio、插件 bundle、workflow 和部署配置未改变。

## 3. 设计内容

Schema 的 `$id`、`home_url`、`manifest_url` 和 URL pattern 都由当前受信请求 origin 生成，不写死 Vercel 域名。顶层 exact allowlist 固定 `version/home_url/manifest_url/language/items`；item exact allowlist 固定公开 kind/type、标题、HTML/Markdown URL、源文 ETag、发布/更新/复核日和标签。`additionalProperties: false`、必填字段、枚举、唯一标签与 `oneOf` 共同拒绝静默漂移；post 只能配 article/til，project 只能配 project。

HTTP 发现采用已经注册的 Link relation，而不是发明私有响应字段。`/content.json` 的 Link 顺序为 self → describedby → up，`/content.schema.json` 为 self → describes → up。Schema 不加入 Sitemap，也不在根 HTML 再加一个读者可见入口；客户端先按现有 alternate 找到清单，再从响应 Link 发现描述契约。

Schema 有意只承诺可移植结构。`id === html_url`、`markdown_url === html_url + /source.md`、跨条目 id 唯一、稳定排序和真实日历日期等关系不变量无法由当前通用 Schema 精确完整表达，继续由 `lib/content/production-sync.ts` 的严格 parser 失败关闭。通过 Schema 不是生产清单可信的充分条件。

## 4. 使用的技术

- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)：`$schema`、`$id`、`$defs`、`oneOf`、const/enum/pattern/uniqueItems 与严格对象结构；
- [IANA Link Relation registry](https://www.iana.org/assignments/link-relations/link-relations.xhtml)：`describedby` 与 `describes` 双向发现；
- [Ajv 8.20.0](https://github.com/ajv-validator/ajv/releases/tag/v8.20.0)：仅在 Node 测试中编译 Draft 2020-12 Schema；
- Web 标准 Request、Response、Headers 与 Next.js 16.3 Route Handler；
- 既有 `createSha256Etag`、`matchesIfNoneMatch`、`PUBLIC_CONDITIONAL_CACHE_CONTROL` 与受信 origin 解析；
- `research-iteration-loop` skill：单一缺口、失败优先、定向验证、完整门、真实生产、全局复盘和唯一下一任务。

## 5. 实现的功能

1. `GET /content.schema.json` 返回 `application/schema+json; charset=utf-8`；
2. `$schema` 固定 Draft 2020-12，`$id` 固定为当前 origin 的 `/content.schema.json`；
3. version、home、manifest、language 与全部 item 字段都有机器约束；
4. HTML/Markdown URL pattern 限定为当前 origin 下的稳定 post/project slug 路由；
5. Markdown ETag 只接受精确强 SHA-256 token，日期只接受稳定 `YYYY-MM-DD` token；
6. 未知顶层/item 字段、缺失必填、kind/type 错配、跨 origin/不安全 URL、坏 ETag/日期与重复标签被 validator 拒绝；
7. 清单以 `describedby` 指向 Schema，Schema 以 `describes` 指回清单；
8. Schema 最终 UTF-8 字节生成强 ETag，弱/强 `If-None-Match` 命中返回空 304；
9. 200/304 共享 `Cache-Control`、ETag、Link 与 `X-Robots-Tag: noindex`；
10. 本地应用和真实生产烟测同时覆盖协议，Vercel 弱化/精简边缘响应时继续比较相同 opaque SHA-256 身份和等价缓存。

## 6. 实现方法

失败优先先添加 `tests/content-manifest-schema.test.mjs` 并导入尚不存在的 `lib/content-manifest-schema.ts`，测试按预期以 `ERR_MODULE_NOT_FOUND` 失败。随后实现纯 document/string/response 三层函数和 Route Handler，使结构与 HTTP 测试通过。再固定 Ajv 8.20.0，用真实 `createContentManifestDocument` 结果编译验证，并逐个 clone/mutate 构造反例。

开发中出现一次测试自身错误：kind/type 错配用例把真实 post 的 type 改成了它原本已经是的 `article`，因此 candidate 仍合法。修正为 `project` 后，该用例真正违反 post 分支并失败；这说明反例测试必须先证明 mutation 改变了语义，不能只依赖标签描述。

HTTP 集成先在本地生产构建中加入 Schema 请求和条件请求，再扩展生产烟测。清单与 Schema 共用既有缓存/ETag helper；Schema 不伪造没有内容日期事实的 Last-Modified。文档明确区分 Schema 可表达的结构与严格 parser 才能证明的关系语义。

## 7. 验证证据

- 失败优先：新测试最初以 `ERR_MODULE_NOT_FOUND` 找不到 `lib/content-manifest-schema.ts`；
- Schema 定向测试：3/3 通过，包含确定性文档、200/304 与 Ajv 真实/反例验证；
- 清单 + Schema + 部署工具定向回归：11/11 通过；
- 独立 TypeScript、Next build 和真实应用测试：48 个构建页面，20/20 通过；
- 首次完整 `npm run release:check`：119.5 秒，471/471 单元测试、48 个构建页面、20/20 应用测试、九路 HTML raw/gzip 预算全 PASS、生产依赖审计 0；
- 状态、路线图与本归档写入后第二次完整 `npm run release:check`：110.4 秒，同样保持 471/471、48 个构建页面、20/20、九路预算全 PASS 与生产依赖审计 0；
- 内容事实保持：公开 4、Current 1、Historical 3、草稿 0、根暂存附件 0、本地外链问题 0；
- 功能提交：`9865a57f13985602af40cc052085f6137c58b555`；
- [Quality Gate #185](https://github.com/Zach424/MyBlog/actions/runs/31339348063) 与 [Production Smoke #178](https://github.com/Zach424/MyBlog/actions/runs/31339376510) 均成功；
- 本机独立生产冒烟：24 个 Sitemap URL、OAuth 302、九路 HTML 预算全部 PASS；
- 生产 Schema：3278 B，ETag `"sha256-a51d1d61aaa1a4c16845cc38cfd4a59f39e5f8c6699bb1291ca4136c44478429"`，`application/schema+json`、同源 `$id`、version 1、两种 item 组合、self/describes/up Link、`noindex` 和条件 304 均成立；
- 同次生产测量：`/content.json` 3009 B，`/feed.json` 20697 B。

## 8. 经验与教训

“有严格 TypeScript parser”与“公开机器契约”是两件事。前者保护本站和专用 Obsidian 客户端，后者让未知语言、通用 validator 和未来自动化不用复制内部实现；两者叠加比互相替代更可靠。

Schema 的严格程度应停在它能诚实表达的位置。用 regex 可以限制同源路由形状，却不能证明两个字段彼此相等；`uniqueItems` 只能阻止整项完全重复，不能保证不同对象的 id 唯一。把关系不变量继续留给严格 parser，并在文档中公开边界，比写一个看似完整但实际漏检的 Schema 更安全。

协议发现优先复用注册关系和 HTTP metadata。双向 Link 不污染清单正文，也让内容版本字段继续只表达内容协议版本。条件响应则应复用已验证 helper；新端点不应重新发明 ETag 解析和 CDN 缓存规则。

## 9. 全局复盘与候选任务

本轮结束后按项目状态、测试输出、真实生产和风险表复盘了三个不依赖人工或外部服务的候选：

1. 为结构化发现端点建立确定性 raw/gzip 传输预算；当前 JSON Feed 20697 B、清单 3009 B、Schema 3278 B，已有线性增长风险但没有阈值与逐端点覆盖；
2. 为 Schema 增加显式兼容性/历史版本策略；当前只有 version 1 且没有实际升级需求，提前增加版本路由会扩大维护面；
3. 让专用 Obsidian 同步器运行通用 Schema validator；现有 parser 更严格，额外抓取 Schema 会增加网络失败面而没有关闭新的已知缺口。

选择候选 1。它有真实体积证据，能在协议不变的前提下把“以后观察增长”变成可执行门禁；候选 2 等首次真实协议演进再做，候选 3 保持专用严格 parser 即可。

## 10. 风险、回滚与下一轮

Schema 是公开 version 1 契约的一部分，未来新增字段不能直接绕过 `additionalProperties: false`；必须显式评估兼容性并同步版本、Schema、parser、客户端和文档。Schema URL pattern 绑定当前 origin，因此域名变化会生成不同 `$id`/const/pattern/ETag，这是预期的表示变化。Ajv 是开发依赖，不改变公开服务端攻击面；Decap 开发树中既有的上游审计项未因本轮消失，生产依赖审计仍为 0。

回滚本轮功能可执行 `git revert 9865a57f13985602af40cc052085f6137c58b555`。它会移除 Schema 路由、双向 Link、Ajv 测试依赖和生产烟测扩展；不会迁移内容、数据库、插件或外部配置。

下一轮唯一主任务：为 `/content.json`、`/content.schema.json`、`/feed.json`、`/rss.xml`、`/sitemap.xml` 与 `/robots.txt` 建立确定性 raw/gzip 传输预算。以当前真实输出为有来源基线，定义可解释的余量/取整规则和完整覆盖断言，让本地真实 Next 应用与生产冒烟逐端点报告并失败关闭；只测量增长，不提前分页、裁剪正文或改变公开协议。
