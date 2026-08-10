# Iteration 0106：首页 WebSite 站点身份

## 1. 范围与成功标准

本轮只解决域名根首页的站点身份：用 Schema.org `WebSite` 明确声明这个站点的名称、根 URL、描述和语言，并让它与现有 metadata、Open Graph、页头品牌和根文档语言共享事实。Google 的站点名称契约要求该节点只出现在域名或子域名根首页，因此内部集合、详情、搜索、知识地图和关于页都必须为零。

成功标准还包括：`url` 规范到可信请求 origin 的根，`@id` 稳定为 `<root>#website`；只接受 HTTP(S) 且拒绝凭据；不修改输入；没有事实来源时不虚构 `alternateName`、`potentialAction` 或 `SearchAction`；保持 Server Component 和原生 JSON-LD script，不增加可见 UI、客户端代码、数据库或内容字段；真实 Next、浏览器与稳定生产都验证唯一性和关闭边界，HTML 增长重新绑定已部署提交。

## 2. 项目结构状态

- `lib/website.ts`：新增站点根规范化与 `WebSite` 纯生成器；
- `lib/site.ts`：新增 `SITE_LANGUAGE`，与已有 `SITE_TITLE`、`SITE_DESCRIPTION` 组成站点事实源；
- `app/layout.tsx`：根 `<html lang>` 改为复用 `SITE_LANGUAGE`；
- `app/page.tsx`：首页 Server Component 读取可信请求 origin，并作为唯一页面接入 `StructuredData`；
- `tests/website.test.mjs`：新增 3 项生成器、安全边界和首页接入契约；单元测试总数增至 495；
- `tests/rendered-html.test.mjs`：新增真实 HTML 唯一首页节点与八类内部页关闭测试；应用测试总数增至 22；
- `scripts/smoke-production.mjs`、`tests/deployment-tools.test.mjs`：生产站精确字段、唯一性、非首页零节点和无 SearchAction 检查；
- `scripts/html-budget.mjs`、`tests/html-budget.test.mjs`：功能稳定上线后，以生产提交 `62e89439308043f6fa3e12bf4d49c0cc1ad7923a` 重新冻结九路基线；
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md` 与本文：同步结构、设计、技术、功能、方法、证据、经验和下一轮主线。

## 3. 设计内容

本轮没有增加可见组件。首页页头已经把 `Zach424` 与 `Engineering Notes` 分层呈现，metadata 和 `og:site_name` 已使用 `Zach424 / Engineering Notes`；机器身份直接复用这份长期名称，不再增加“SEO 徽章”、说明卡或第二个品牌区。描述复用首页的长期产品承诺，语言复用根文档 `zh-CN`，结构数据只补充机器理解，不争夺 Commit Trace / Evidence Rail 的视觉层级。

```text
可见身份：Zach424 / Engineering Notes
机器身份：https://<current-origin>/#website
出现范围：仅域名根首页
```

真实浏览器截图与改动前视觉一致，脚本不占据布局；页面根宽仍无横向溢出。当前没有经过所有者确认的简称，也不存在需要远程执行的站内搜索 API，所以省略可选字段比填入推测值更符合工程档案的证据原则。

## 4. 使用的技术

- TypeScript 纯函数、原生 `URL` 与共享站点常量；
- Next.js 16.3 App Router Server Components、`headers()` 和原生 `<script type="application/ld+json">`；
- Schema.org `WebSite`，遵循 Google Search Central 站点名称技术要求；
- React 19 既有 `StructuredData` 的 `<` 转义边界；
- Node.js test runner、真实 Next production server、Node zlib HTML 预算和生产 smoke；
- in-app Chromium DOM、视觉、横向溢出与 console 检查；
- `research-iteration-loop` skill 用于重新锚定、官方契约、失败优先、稳定生产基线和归档闭环；`browser` skill 用于确认结构数据位于真实 DOM 且不影响页面视觉。实现前按仓库规则完整阅读本地 Next.js 16.3 JSON-LD、layouts/pages 与 server/client 指南。

参考：[Google Search Central：Site names](https://developers.google.com/search/docs/appearance/site-names)、[Schema.org WebSite](https://schema.org/WebSite)。Google 明确说明站点名称不受 Rich Results Test 支持，语法验证应使用 Schema Markup Validator。

## 5. 实现的功能

1. 域名根首页输出恰好一个 `WebSite`；
2. `name`、`description`、`inLanguage` 分别复用 `SITE_TITLE`、`SITE_DESCRIPTION`、`SITE_LANGUAGE`；
3. `url` 无论输入是否带路径、查询或 fragment，都规范为当前 origin 根地址；
4. `@id` 固定为规范根地址加 `#website`，为后续结构化图关联提供稳定节点；
5. 非 HTTP(S) URL 与包含用户名/密码的 URL 失败关闭，调用方 URL 对象不被修改；
6. 根 `<html lang>` 和机器 `inLanguage` 共享同一常量；
7. 文章/项目/专题/标签、集合、搜索、知识地图和关于页均不输出 `WebSite`；
8. 明确不生成 `alternateName`、`potentialAction` 和 `SearchAction`。

## 6. 实现方法

先阅读 Google 站点名称契约与本地 Next JSON-LD 指南，再写 `tests/website.test.mjs`。首次运行得到预期的 `ERR_MODULE_NOT_FOUND`，证明新测试确实约束尚不存在的实现。随后在 `canonicalSiteRoot()` 中检查协议和凭据，并用 `new URL("/", siteUrl)` 生成不修改输入的根 URL；`createWebsiteStructuredData()` 只从共享站点事实构造固定字段顺序的对象。

首页改为 async Server Component，用 `resolveSiteUrl(await headers())` 获取与 metadata、Feed、清单一致的可信 origin，再交给既有 `StructuredData`；根布局只复用 `SITE_LANGUAGE`，不承载 `WebSite`，因此内部页不会继承节点。真实 HTML 测试并行请求八类内部路由，生产 smoke 也在既有关键页面循环中逐页检查零节点。

第一次应用测试为 21/22：运行时 HTML 已正确输出 `lang="zh-CN"`，但既有源码质量断言仍要求根布局硬编码该字符串。修复方式不是回退单一事实源，而是让源码断言要求 `SITE_LANGUAGE` 和 `<html lang={SITE_LANGUAGE}>`，同时保留首页运行时的精确 `lang="zh-CN"` 检查。功能提交 `62e8943` 上线并通过独立 Actions 后，才从稳定生产响应重测九路基线。

## 7. 验证证据

- 失败优先：新增测试首次因缺少 `lib/website.ts` 报 `ERR_MODULE_NOT_FOUND`；
- 实现后生成器与部署工具专项 9/9，通过 TypeScript 与 ESLint；
- 原生 Next 构建成功并生成 49 个页面；首次应用测试 21/22，修正旧硬编码源码断言后为 22/22；
- 浏览器首页：`WebSite=1`，JSON-LD 类型只有 `WebSite`，`lang=zh-CN`，title 与 name 均为 `Zach424 / Engineering Notes`，根 `clientWidth/scrollWidth=1265/1265`；文章页类型为 `BlogPosting + BreadcrumbList`、`WebSite=0`、根宽同样为 1265/1265，console 日志为空；截图确认视觉未变化；
- 功能提交前 `npm run release:check`：193.5 秒，495/495 单元测试、49 个构建页面、22/22 应用测试、九路 HTML 与七路发现预算全部 PASS、生产依赖审计 0；
- 功能提交：`62e8943 feat(discovery): publish homepage website identity`；
- GitHub Actions：[Quality Gate #199](https://github.com/Zach424/MyBlog/actions/runs/31349618719) 与 [Verify Vercel Production #192](https://github.com/Zach424/MyBlog/actions/runs/31349646923) 均成功；
- 稳定生产 smoke：24 个 Sitemap 路由成功、OAuth 302；首页唯一 `WebSite` 精确使用生产 origin，八类内部路由全部为零，并继续通过面包屑、搜索、推荐、发现端点、源文、缓存与安全检查；
- 九路生产基线依次为 `/` 27309/5994、`/posts` 17862/4249、代表文章 51483/12175、代表项目 107727/24404、专题 17511/4162、标签 17332/4134、搜索 36194/13826、知识地图 35908/7240、关于页 14912/3848 B（raw/gzip）；推导 gzip 余量依次为 +2198、+2919、+3185、+5292、+3006、+3034、+3582、+3000、+2296 B；
- 七路结构化发现基线保持 3009/921、3278/755、20697/9876、3238/1241、4527/504、155/127、700/462 B（raw/gzip）；
- 新基线聚焦回归 16/16、应用测试 22/22；基线与归档接入后的最终 `npm run release:check`：264.0 秒，495/495 单元测试、49 个构建页面、22/22 应用测试、九路 HTML 与七路发现预算全部 PASS、生产依赖审计 0；本地首页为 27099/5980 B（raw/gzip），gzip 余量 +2212 B。

## 8. 经验与教训

1. 站点身份应该复用可见品牌、metadata、Open Graph 和语言事实，而不是在 JSON-LD 中另造一套 SEO 名称；
2. `WebSite` 放进根 layout 看似省事，却会让每个内部页面都冒充站点首页；页面级唯一边界比全局注入更重要；
3. 可选字段不是越多越好。没有经过确认的简称和远程动作时，省略 `alternateName`/`SearchAction` 比推测更可信；
4. 运行时正确与源码契约正确是两层证据。把 `lang` 提升为共享常量后，应更新旧的源码门，同时继续保留真实 HTML 的精确输出检查；
5. 站点名称结构数据只表达搜索引擎偏好，不是展示保证，而且这一功能不能用 Rich Results Test 验证；
6. 不可见脚本仍会增加 HTML/RSC 载荷，必须像可见功能一样经过稳定生产测量和来源基线。

## 9. 全局状态、风险与未解决问题

全局复盘比较了三个候选：把文章/项目节点连接到 `WebSite`、为关于页增加 `ProfilePage`/`Person`、为集合页增加 `ItemList`。现有 `BlogPosting` 与 `SoftwareSourceCode` 已有真实 canonical，可在不增加公开个人事实的情况下用稳定 `@id` 和 `isPartOf` 连接到本轮站点节点，形成一致结构化图，因此选为下一轮。`ProfilePage`/`Person` 仍等待所有者确认公开姓名、头像和外部身份集合；普通集合 `ItemList` 对当前搜索展示的明确收益较弱，继续暂缓。

Google 会综合 `WebSite`、`og:site_name`、title、首页可见文字和站外引用决定站点名称，本轮只能证明偏好表达正确。自定义域名启用时，根 URL、`@id`、canonical、Open Graph、Feed、清单和全部生产基线都要重测。其余既有风险保持：首次真实 Obsidian 主题/本机代理人机验收、Decap 开发依赖上游高危项、Actions pin 主动复核，以及等待所有者选择的统计、评论和公开邮箱。

## 10. 下一轮唯一主任务

让文章 `BlogPosting` 与项目 `SoftwareSourceCode` 使用各自 canonical 的稳定 `@id`，并以 `isPartOf: { "@id": "<root>#website" }` 引用首页站点身份。复用同一纯生成器派生站点节点 ID，保持服务端输出、现有可见页面与字段不变，不新增 Person/ProfilePage、客户端代码、数据库或内容字段。
