# Iteration 0006：搜索、订阅与站点发现

- 日期：2026-07-18
- 状态：完成

## 1. 范围与成功标准

本轮只完成发布发现能力：静态站内搜索、RSS 2.0、Sitemap 和 robots，并把这些入口接入全局导航、页脚和元数据。桌面/移动浏览器验收、性能/安全审计与 Cloudflare 部署留到下一轮。

成功标准：搜索覆盖文章、TIL 与项目，查询可分享且不上传；RSS/Sitemap/robots 只使用公开内容并根据请求主机生成绝对 URL；XML 可解析；生产 Worker 路由、缓存头和内容数量有测试证据；全局文档更新后独立提交并推送。

## 2. 项目结构状态

```text
app/
  search/page.tsx
  rss.xml/route.ts
  sitemap.xml/route.ts
  robots.txt/route.ts
components/
  SearchExperience.tsx
lib/
  discovery.ts
  search.ts
  site.ts
tests/
  search.test.mjs
  discovery.test.mjs
  rendered-html.test.mjs
docs/
  DISCOVERY.md
  iterations/0006-discovery-and-feeds.md
```

既有 `lib/content` 仍是唯一内容解析边界，只新增 `getAllContent()` 作为跨文章与项目的公开集合入口。`layout.tsx` 改为复用全站 URL 解析器并输出 RSS autodiscovery。全局导航加入搜索，页脚加入搜索、RSS 与源码入口。

## 3. 设计内容

搜索页不建立新的卡片视觉语言，而是延续归档编号行、事实标签和工程证据层级。页面唯一强动作是大尺寸搜索输入；前缀 `/` 表示在工程日志内检索，不模拟终端。Indexed 和 Matched 都来自真实公开文档数量。

结果行显示内容类型、日期、标题、命中上下文、标签与命中字段。空查询展示全部公开内容，零结果明确建议缩短关键词、检查拼写或使用技术标签。移动端把命中信息移到标题下方，保留完整语义和足够触控区域。

## 4. 使用的技术

- React 19 `useDeferredValue`、`useMemo`、`useEffect`：保持输入响应、派生匹配与可分享 URL；
- Unicode NFKC：统一全角/半角和大小写查询；
- 原生 TypeScript：Markdown 纯文本转换、AND 查询、字段加权与稳定排序，无新增搜索依赖；
- 原生 `Response`：输出 RSS/XML/robots 和明确 Content-Type、Cache-Control；
- RSS 2.0、Atom self link、Sitemap 0.9 与标准 robots 文本；
- Vinext/Vite/Cloudflare Worker：同一构建产物验证页面和三个 API 路由。

为让 Node 的 TypeScript strip-types 单测直接加载跨模块代码，`tsconfig` 启用 `allowImportingTsExtensions`，纯模块的相对运行时导入显式使用 `.ts`；项目仍保持 `noEmit` 和 bundler 模块解析。

## 5. 实现的功能

- 搜索标题、标签、摘要和正文，多个词使用 AND 语义；
- 标题/标签匹配优先于摘要/正文，同分结果稳定排序；
- 支持中文、英文、大小写和全角字符规范化；
- 搜索建议、真实索引/匹配计数、正文上下文和可恢复空状态；
- `?q=` 服务端首屏结果与浏览器端 URL 同步；
- 4 条公开内容的 RSS 订阅，包含绝对 GUID、分类和发布日期；
- 23 个公开 URL 的 Sitemap，包含内容、专题和标签详情；
- robots 允许抓取并指向当前主机的 Sitemap；
- 根页面 RSS autodiscovery、页脚 RSS 入口和全局搜索入口；
- 三个发布端点使用缓存策略，不依赖数据库或运行时文件系统。

## 6. 实现方法

`createSearchDocuments()` 只接收已经过滤的 `ContentRecord[]`。Markdown 先转成纯文本，再连同元数据序列化给客户端；搜索函数保持纯函数，因此单测和客户端使用完全相同的规范化、打分和排序逻辑。

输入变化通过 deferred query 计算结果。URL 使用 `history.replaceState` 更新，避免每次按键触发服务端导航；直接打开带 `?q=` 的地址时，服务端仍输出对应首屏结果，分享与刷新行为一致。

`discovery.ts` 提供无框架依赖的 XML/文本生成器。路由处理器只负责解析公开站点 URL、传入内容索引和设置响应头。RSS、Sitemap 与页面查询因此不会形成三套内容过滤逻辑。所有 XML 数据在输出前统一转义。

`site.ts` 把标题、摘要和域名推导集中起来。显式站点环境变量优先，其次读取反向代理头，最后使用请求或本地回退；逗号分隔的代理头只采用首个值。

## 7. 验证证据

- 内容与目录单测：6/6 通过；
- 搜索单测：3/3 通过，覆盖 Markdown 清理、权重、AND、NFKC、空查询和零结果；
- 发布发现单测：3/3 通过，覆盖代理主机、XML 转义、绝对 URL、Sitemap 与 robots；
- `npm run lint` 与 `npm run typecheck`：通过；
- `npm run build`：通过，Vinext 路由表识别 `/search` 和 3 个 API 端点；
- Worker 集成测试：7/7 通过，新增可分享搜索、RSS、Sitemap、robots、Content-Type 和内容数量验证；
- 本地 HTTP：搜索、RSS、Sitemap、robots 均返回 200；RSS 4 项、Sitemap 23 个 URL，可由 XML 解析器读取；
- 未压缩产物：client 1,518,174 bytes，server 2,663,594 bytes；相对上一轮分别增加约 11 KB 与 30 KB；
- 完整 `npm test`、差异格式与 16 份 Markdown 文档链接在提交前通过。

第一次直接运行发布模块单测时，Node 无法解析 `discovery.ts` 内省略扩展名的相对 TypeScript 导入；Vite 和类型检查原本都能解析。通过显式 `.ts` 导入并启用只适用于 no-emit 的 TypeScript 选项解决，没有引入额外运行器。

第一次完整 Worker 回归发现 Vinext 会把 RSS alternate 的对象描述符序列化为 `[object Object]`。将 Metadata 值收敛为框架同样支持的字符串 URL 后，生成的 autodiscovery 地址恢复为真实 `/rss.xml`；集成测试保留该断言，防止兼容回归。

## 8. 经验与教训

- 搜索、RSS 和 Sitemap 必须消费同一“已公开内容”集合，否则草稿过滤、项目收录和更新时间会快速漂移；
- 对当前内容规模，构建期轻量索引比引入外部搜索服务更可维护，也避免收集查询隐私；
- 搜索结果需要解释命中位置，只有标题列表会让正文匹配显得随机；
- 直接访问查询 URL 的服务端结果是可分享搜索的关键证据，不能只验证客户端纯函数；
- XML 端点必须测试真实 Worker Content-Type、绝对主机和解析结果，而不只比较字符串片段；
- Node 原生 TypeScript strip 与 bundler 的解析边界不同，纯模块测试要显式处理相对扩展名。

## 9. 全局状态、风险与未解决问题

- 工程、内容、设计系统与核心阅读路径：done；
- 搜索、订阅、Sitemap、robots 和基础 SEO：done；
- 上线候选验收：pending；
- Cloudflare 生产部署、域名、监控、回滚与维护手册：pending。

风险：搜索索引会随正文总量进入客户端，内容规模明显增长后需要设置体积阈值或分片；当前未压缩 server 约 2.66 MB，真实上传包仍待部署工具确认；搜索输入、响应式折行、键盘顺序、对比度和无 JavaScript 退化尚未做浏览器验收；最终域名与联系方式公开范围仍未确定。

## 10. 下一轮唯一主任务

完成上线候选质量验收：系统检查桌面/移动关键流程、键盘与无障碍、HTML/SEO、性能预算、缓存和安全响应头，输出可复现报告并冻结部署前风险。
