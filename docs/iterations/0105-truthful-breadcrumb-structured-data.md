# Iteration 0105：真实路径结构化面包屑

## 1. 范围与成功标准

本轮只补齐文章、项目、专题和标签四类详情页的路径语义：读者看到的“首页 → 集合 → 当前标题”必须与搜索引擎读取的 Schema.org `BreadcrumbList` 来自同一份数据。每级名称、顺序和 URL 都要一致；URL 必须使用当前可信请求 origin 的绝对同源地址；未知 slug 的 404 不得输出一份看似有效的机器路径。

成功标准还包括：保持 Server Component、原生链接和无 JavaScript 可用性；当前项使用真实页面标题而不是 Article/TIL 或项目状态；320px 与桌面宽度都可读且无横向溢出；真实 Next HTML 和稳定生产分别验证四类正确路径、唯一 JSON-LD 与四类 404 关闭；有意增加的 HTML 重新建立带生产提交来源的九路 raw/gzip 基线。

## 2. 项目结构状态

- `lib/breadcrumbs.ts`：新增路径值类型与纯生成器，集中同源 URL、名称、层级、重复和 position 不变量；
- `components/BreadcrumbTrail.tsx`：新增共享 Server Component，从同一数组输出可见 `<nav>` 与 `StructuredData`；
- `app/posts/[slug]/page.tsx`、`app/projects/[slug]/page.tsx`、`app/series/[slug]/page.tsx`、`app/tags/[slug]/page.tsx`：四类详情在公开记录查找成功后接入同一边界；
- `app/globals.css`：上级路径禁止 flex 收缩，当前长标题可换行；
- `tests/breadcrumbs.test.mjs`：新增 4 项生成器与页面接入契约；`tests/rendered-html.test.mjs`：新增真实 Next HTML 的可见/机器路径和 404 契约，应用测试增至 21 项；
- `scripts/smoke-production.mjs`、`tests/deployment-tools.test.mjs`：生产站 exact-path 与未知 404 检查；`tests/quality-gates.test.mjs`：移动端 CSS 契约；
- `scripts/html-budget.mjs`、`tests/html-budget.test.mjs`：功能稳定上线后，以生产提交 `ccd494e3b54c2010fa2dfe44c69f46e0d4b237a1` 重新冻结九路基线；
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md` 与本文：同步结构、设计、技术、功能、方法、证据、经验和下一轮主线。

## 3. 设计内容

视觉继续使用 Commit Trace / Evidence Rail 的等宽文本、细规则和 `/` 分隔，不加入首页图标、胶囊或卡片。路径的最后一级就是页面真实标题，内容类型与项目状态仍留在既有 Content Header 眉题和事实栏中，各自承担不同语义。

```text
首页 / 文章、项目、专题或标签 / 当前真实标题
```

最初 320px 实拍虽然根页面没有横向溢出，但 flex 会把“首页”和“项目”压成逐字换行，技术上通过、阅读上失败。最终让上级链接和分隔符保持固定宽度，把剩余空间与换行责任交给当前长标题；320px 上当前标题两行，桌面恢复单行。颜色、字号、焦点和深色均复用现有 Token，不引入第二套视觉语言。

## 4. 使用的技术

- TypeScript 纯函数、只读路径值与原生 `URL`；
- Next.js 16.3 App Router Server Components 和请求 origin 解析；
- React 19 原生 `<nav>`、`<ol>`、`<a>`、`aria-current` 与服务端 `<script type="application/ld+json">`；
- Schema.org `BreadcrumbList` / `ListItem`，并遵循 Google Search Central 的结构化面包屑要求；
- CSS Flexbox、`flex-shrink`、`min-width` 与 `overflow-wrap`；
- Node.js test runner、真实 Next production server、Node zlib HTML 预算和生产 smoke；
- Chromium 320px/1440px 实际页面与 console 检查；
- `research-iteration-loop` skill 用于官方契约、失败优先、范围控制、稳定生产基线和归档闭环；`frontend-design` skill 在真实窄屏暴露可读性问题后用于调整信息层级；`browser` skill 用于实际页面、视口和 console 取证。实现前按仓库规则完整阅读本地 Next.js 16.3 JSON-LD、layouts/pages、server/client 与 dynamic page 指南。

参考：[Google Search Central Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)、[Google Search Central structured data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)。

## 5. 实现的功能

1. 四类详情页统一显示“首页 → 对应集合 → 当前真实标题”；
2. 每页从同一数组输出唯一 `BreadcrumbList`，每个 `ListItem` 都有稳定 `position`、可见同名 `name` 和绝对 `item`；
3. 生成器拒绝少于两级、空名称、非根相对路径、协议相对/外部地址、查询、fragment 与重复 URL；
4. 输入数组不被修改，位置严格从 1 开始并按可见顺序递增；
5. 页面先查找公开记录再解析 origin 和构造路径，四类未知详情均保持普通 404 且不泄漏结构化面包屑；
6. JSON-LD 使用原生服务端 script，并沿用 `<` 转义边界，不新增客户端组件、数据库、分析请求或 frontmatter 字段；
7. 生产冒烟逐级比较真实可见 `<nav>` 与 JSON-LD，而不是只搜索 RSC 字符串。

## 6. 实现方法

先依据 Google 官方 BreadcrumbList 契约和本地 Next.js JSON-LD 指南写生成器测试，首次运行得到预期的 `ERR_MODULE_NOT_FOUND`，证明失败来自尚不存在的实现。随后实现 `createBreadcrumbList()`：先验证站点 URL 和路径值，再用 `new URL(href, siteUrl)` 生成绝对地址，检查 origin、查询/fragment 和唯一性，最后生成从 1 起始的 `ListItem`。

共享 `BreadcrumbTrail` 接收页面已经用于显示的数组，同时渲染可见导航和 `StructuredData`，从结构上消除两份名称或路径漂移。四类页面都保留原有内容查询与 `notFound()` 顺序；文章/项目把原来末级的内容类型/状态改为真实标题，类型和状态仍由 Content Header 表达。

真实浏览器在 320px 揭示上级链接被 flex 压坏后，只调整层级职责：上级路径不收缩，当前项获得 `min-width: 0` 和任意长词换行。功能提交 `ccd494e` 上线、GitHub 质量门和生产 smoke 成功后，再从同一稳定生产快照测量九路响应，更新基线来源、测试和文档。

## 7. 验证证据

- 失败优先：新增面包屑单测首次运行因缺少 `lib/breadcrumbs.ts` 报 `ERR_MODULE_NOT_FOUND`；
- 自编生产门测试首次因正则中无效的 `\"` 在 Unicode 模式触发 `SyntaxError`，改用原始 `"` 字符后专项恢复 10/10；
- 生成器与部署工具专项：10/10；TypeScript 与 ESLint 均通过；
- 原生 Next 构建：49 个页面；真实应用测试：21/21；
- 功能提交前 `npm run release:check`：112.9 秒，492/492 单元测试、49 个构建页面、21/21 应用测试、九路 HTML 与七路发现预算全部 PASS、生产依赖审计 0；
- 浏览器 320px 项目页：根 `clientWidth/scrollWidth=305/305`，面包屑 `clientWidth/scrollWidth=273/273`；“首页”“项目”各为 22.54×15px 单行，当前标题为 174.65×30px 两行，console warning/error 为 0；
- 浏览器 1440×1000：根 `clientWidth/scrollWidth=1425/1425`，面包屑高度 60px，当前标题高度 15px 单行，console warning/error 为 0；
- 功能提交：`ccd494e feat(discovery): add truthful breadcrumb schema`；
- GitHub Actions：[Quality Gate #197](https://github.com/Zach424/MyBlog/actions/runs/31347998558) 与 [Verify Vercel Production #190](https://github.com/Zach424/MyBlog/actions/runs/31348029169) 均成功；
- 稳定生产再次运行 smoke：24 个 Sitemap 路由成功、OAuth 302；文章、项目、专题、标签四条代表详情的可见与机器路径逐级相同且每页恰有一个 `BreadcrumbList`，四条未知详情均为 404 且 `BreadcrumbList` 为零；
- 九路生产基线依次为 `/` 26417/5784、`/posts` 17862/4248、代表文章 51483/12179、代表项目 107727/24406、专题 17511/4160、标签 17332/4133、搜索 36194/13823、知识地图 35908/7241、关于页 14912/3848 B（raw/gzip）；推导 gzip 余量依次为 +2408、+2920、+3181、+5290、+3008、+3035、+3585、+2999、+2296 B；
- 七路结构化发现基线保持 3009/921、3278/755、20697/9876、3238/1241、4527/504、155/127、700/462 B（raw/gzip）；
- 基线与归档接入后的最终 `npm run release:check`：112.8 秒，492/492 单元测试、49 个构建页面、21/21 应用测试、九路 HTML 与七路发现预算全部 PASS、生产依赖审计 0；本地代表文章为 51252/12168 B、代表项目为 107427/24375 B（raw/gzip），gzip 余量分别为 +3192/+5321 B。

## 8. 经验与教训

1. 可见面包屑与 JSON-LD 必须共享同一数组；两套模板即使初始相同，也会在标题改名或层级变化后漂移；
2. 当前页身份应由真实标题表达，Article/TIL 和维护状态属于分类事实，不能替代页面名称；
3. “没有横向溢出”不等于移动端设计合格。flex 可以通过把短词压成逐字竖排制造假绿，必须检查实际盒尺寸和视觉可读性；
4. 404 的正确结构数据不是残缺面包屑，而是完全不输出；查找成功边界要先于 schema 构造；
5. 结构数据会同时增加可见 HTML 与 RSC/脚本载荷，预算仍要先部署有价值变化，再从稳定生产更新来源基线；
6. 自动门能证明语法和站内契约，不能保证 Google 一定展示富媒体结果，不能把“有效”描述成“获准展示”。

## 9. 全局状态、风险与未解决问题

全局复盘比较了三个候选：首页 `WebSite`、关于页 `ProfilePage`/`Person`、集合页 `ItemList`。首页 `WebSite` 能复用已经存在的站点标题、描述与可信 origin，先建立唯一站点身份，爆炸半径最小，因此选为下一轮。`ProfilePage`/`Person` 需要所有者确认公开姓名、头像和外部身份链接后才可信；普通集合 `ItemList` 对当前搜索展示的明确收益较弱，暂不为结构化而结构化。

面包屑现在覆盖四类详情并有本地/生产契约，但搜索引擎展示仍由其自身系统决定。后续若路径层级、域名或标题来源变化，必须同步检查可见导航、JSON-LD、canonical 与 HTML 基线。其余既有风险保持：首次真实 Obsidian 主题/本机代理人机验收、Decap 开发依赖上游高危项、Actions pin 主动复核，以及等待所有者选择的自定义域名、统计、评论和公开邮箱。

## 10. 下一轮唯一主任务

为首页补齐唯一 `WebSite` JSON-LD。复用 `SITE_TITLE`、`SITE_DESCRIPTION` 与可信请求 origin，输出稳定 `@id`、`name`、`url`、`description`、`inLanguage`；只在首页服务端输出，不增加 `SearchAction`、客户端代码、数据库或新的内容字段。
