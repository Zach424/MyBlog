# Iteration 0123：清单与 Markdown 日期条件读取

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

`/content.json` 与文章/项目 `source.md` 已返回可靠 Last-Modified，但条件分支只处理 `If-None-Match`，所以客户端把响应日期原样放入 `If-Modified-Since` 仍会得到 200。本轮把已有日期事实接入 Iteration 0122 的通用条件响应路径，不改变日期值、正文或缓存契约。

成功标准是：同值日期返回空 304；旧日期和非 HTTP-date 返回完整 200；任何 `If-None-Match` 都优先；清单 version 1、源文投影、生产同步轮询、ETag、缓存和 404 不变；本地与稳定生产覆盖清单、文章源文和项目源文；无可靠日期端点不扩散；不新增 UI、依赖、账号、数据库、追踪、第三方服务或云配置。

## 2. 项目结构状态

- `lib/content-manifest.ts`：清单改用通用 SHA-256 条件响应助手，并传入既有最新公开日期；
- `lib/public-markdown.ts`：单篇源文改用同一助手，并传入既有 published/updated/reviewed 最大日期；
- `tests/content-manifest.test.mjs`、`tests/public-markdown.test.mjs`：失败优先覆盖日期 304、旧/坏日期 200 与 ETag 优先；
- `tests/rendered-html.test.mjs`：真实 Next 应用覆盖清单与代表源文；
- `scripts/smoke-production.mjs`：稳定生产覆盖清单、文章源文、项目源文及 Vercel 边缘语义；
- 六份全局文档、`docs/knowledge/0123-reuse-conditional-response-boundary.md` 与本文件：归档状态、方法和经验。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

本轮没有新增公开字段，只让既有字段变得可操作：

```text
200 响应 Last-Modified
  └─ 客户端回传 If-Modified-Since
       ├─ 无 If-None-Match 且日期命中 → 304
       ├─ 旧/坏日期                 → 200 + 原正文
       └─ 存在 If-None-Match         → 只按 ETag 决定
```

业务模块继续负责“正文、MIME、文件名、Link、noindex、日期事实”；通用助手负责“最终正文 ETag、日期规范校验、条件优先级、200/304”。这让 Feed、清单和 Markdown 不再复制条件控制流。

## 4. 使用的技术与规范

- Next.js 16.3 Route Handler；
- TypeScript、Web Request/Response/Headers；
- SHA-256 ETag、IMF-fixdate 与 `If-Modified-Since`；
- RFC 9110 条件优先级；
- Node test、ESLint、TypeScript、Next production build；
- Vercel 稳定生产 smoke、raw/gzip 冻结预算；
- `research-iteration-loop` 执行—验证—复盘流程。

规范证据继续使用：

- [RFC 9110 §13.1.3 If-Modified-Since](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3)；
- [RFC 9110 §13.2.2 Preconditions](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.2)；
- [RFC 9110 §5.6.7 Date/Time Formats](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7)。

## 5. 实现的功能

1. `/content.json` 支持 Last-Modified/`If-Modified-Since` 304；
2. 所有公开文章与项目 `source.md` 支持相同日期验证；
3. 旧日期和非 HTTP-date 保持完整 200；
4. 陈旧 ETag 与命中日期并存时仍返回 200；
5. 匹配 ETag 继续返回空 304；
6. 304 保留源站完整元数据，生产允许 Vercel 合法精简；
7. 清单生产同步继续用 ETag 轮询，不改变 version 1 协议；
8. 未知源文继续返回 `no-store` 404；
9. Schema、Sitemap、OpenSearch、robots 行为不变；
10. 正文、ETag 与传输预算不变。

## 6. 实现方法

先给清单和源文各加入同值 IMS 应返回 304 的断言。旧实现两处都得到 200，形成明确失败证据。随后删除两套“自己计算 ETag + 自己判断 `matchesIfNoneMatch`”控制流，只保留业务头和日期推导，再调用 `createSha256ConditionalResponse(request, body, headers, { lastModified })`。

单元测试同时固定旧日期、ISO 日期和“陈旧 ETag + 命中日期”；真实 Next 测试证明 Route Handler 接线正确；生产 smoke 对清单、代表文章和代表项目分别执行普通 GET、ETag 304、日期 304、旧/坏日期 200 与 ETag 优先，并容忍 Vercel 合法省略 304 的可选表示元数据。

## 7. 验证证据

- 失败优先：清单与源文日期请求均出现 `200 !== 304`；
- 聚焦单元测试：7/7；HTTP/清单/源文/部署聚焦测试：21/21；
- `npm run typecheck`：通过；
- `npm run lint`：通过；
- `npm run test:unit`：530/530；
- `npm run build`：52 个页面；
- `npm run test:app`：30/30；
- 功能提交：`3946c36`（`feat: validate dated content responses`），已推送并部署；
- 稳定生产 smoke：27 routes、OAuth 302，十三条 HTML 与七个发现端点全部 PASS；
- 清单、文章源文、项目源文：日期命中 304，旧/坏日期 200，陈旧 ETag 优先 200；
- 七端点生产实测仍为清单 3009/921、Schema 3278/755、JSON Feed 20697/9876、RSS 3536/1298、Sitemap 5059/532、robots 155/127、OpenSearch 700/462 B（raw/gzip）；
- 正文与 ETag 未变化，不需要预算重基线；
- `git diff --check`：通过。

## 8. 经验与教训

1. 返回 Last-Modified 不等于已经支持日期条件读取；
2. 协议字段必须通过往返测试证明可操作；
3. 业务模块应提供事实，通用边界应提供条件控制流；
4. 复用经过规范测试的助手比复制 ETag 分支更安全；
5. 陈旧 ETag + 新日期是证明优先级最有价值的反例；
6. 单元、真实框架和边缘生产分别证明不同层级；
7. 测试生产构建前必须重建 `.next`，不能把旧产物的 200 误判为新实现失败；
8. 响应决策变化不要求正文预算重基线；
9. Vercel 可精简 304 元数据，但不能改变验证器身份和零正文语义；
10. 归档和实现继续保存在同一 Obsidian/Git 历史。

## 9. 全局状态、风险与未解决问题

四类有可靠日期事实的公开资源现在都支持 ETag 优先、日期回退：JSON Feed、RSS、内容清单与单篇 Markdown。清单/源文继续沿用既有 UTC 零点日期语义，本轮没有借机改变公开验证器。生产同步仍只主动发送 ETag，这是更精确且已冻结的轮询协议。

Next.js 会为 GET Route Handler 自动提供 HEAD，但项目尚未把全部公开条件资源的 HEAD 200/304、无正文与边缘元数据纳入门禁。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择。

## 10. 下一轮唯一主任务

审计并锁定公开条件资源的 HEAD 等价语义：依据 Next.js 16.3 本地文档与 RFC 9110，验证 HEAD 200/304 均无正文，ETag/Last-Modified/Cache-Control 与 GET 等价，条件优先级不变；同步真实 Next、稳定生产与中文归档，不触及写入接口。
