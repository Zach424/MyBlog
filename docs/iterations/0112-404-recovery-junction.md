# Iteration 0112：404 恢复路口

> 实现、生产修复、测量与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

本轮只解决未知 URL 的读者恢复问题。旧页面虽然返回真实 HTTP 404 和 `no-store`，但只有一句说明与“返回首页”，读者无法直接沿搜索、时间、文章或项目重新定位内容。新页面必须继续是错误响应，而不是把不存在的地址伪装成首页。

成功标准是：未知路由返回 404、`no-store` 和 `robots=noindex`；可见文档只有一个 H1；四条原生链接分别指向 `/search`、`/archive`、`/posts`、`/projects`；不使用自动跳转、客户端请求、数据库或外部服务；桌面、390px、深浅色和打印均可读；本地真实 Next、生产 smoke 和 HTML 预算都覆盖固定 404。

## 2. 项目结构状态

- `app/not-found.tsx`：从最小说明升级为服务端恢复路口，显式输出 `noindex`、HTTP 状态账本、四条恢复路径和首页兜底；
- `app/not-found.module.css`：新增页面局部桌面、`55rem`/`42rem`、深色继承和 A4 打印规则；
- `app/globals.css`：删除旧 404 全局规则，专属样式不再消耗全局 CSS 预算或污染其他页面；
- `tests/rendered-html.test.mjs`：覆盖真实 404、单 H1、noindex、四条链接、无 refresh 与零 BreadcrumbList；
- `tests/quality-gates.test.mjs`：覆盖安全缓存、404 语义，并把固定未知路由纳入第十二条 HTML 预算；
- `tests/print-layout.test.mjs`：锁定纯服务端边界、路径集合、打印分页和纸面 URL；
- `scripts/smoke-production.mjs`：生产环境验证固定 404 的状态、缓存、noindex、恢复路径、无跳转与体积；
- `scripts/html-budget.mjs`、`tests/html-budget.test.mjs`：把关键 HTML 从十一条扩展为十二条，冻结同一生产提交的完整基线；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md` 与本文件：同步结构、设计、方法、证据、风险和下一主线。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、删除或暂存这些内容，所有提交继续按路径显式选择。

## 3. 设计内容

页面采用“断裂的工程轨迹 + 四路恢复账本”，不是通用错误卡片。首段用超大橙色 `404` 作为断点标记，右侧明确“这条轨迹在这里中断”，并把 `404 / Not Found` 与 `No redirect` 作为可见事实。第二段把恢复动作按 `KEYWORD / TIME / NOTES / BUILDS` 排列，让读者按自己仍掌握的信息选择入口。

桌面使用两列规则线结构，首屏能看到错误事实和前两条恢复路径；中等宽度折为上下布局，移动端再把路径条目收敛成单列文字与箭头。深色模式完全复用站点 Token，不增加独立主题。打印隐藏站点框架和交互箭头，保留 404、说明、状态、四条路径及每条 `href`，每个恢复项避免跨页断裂。

## 4. 使用的技术

- Next.js 16.3 App Router `not-found.tsx` 文件约定与 React 19 Server Component；
- React 19 文档元标签提升：组件显式输出 `robots=noindex`，消除本地 Next 与 Vercel 实际 HTML 的差异；
- CSS Module 局部作用域、站点现有 Token、响应式媒体查询与 print media；
- 原生 `<nav>`、列表、定义列表与 `next/link`，无客户端岛；
- Node test、TypeScript、ESLint、Next production build、真实 HTTP 应用测试；
- Playwright CLI 做桌面、390×844、深色、打印、DOM、console 与根宽验收；
- `Buffer.byteLength` 与 Node zlib 对十二条 HTML 做 raw/gzip 预算；
- GitHub Actions Quality Gate、Vercel Git 部署和稳定域名生产 smoke；
- `research-iteration-loop`、`frontend-design`、`playwright` 与 browser skill 分别约束迭代证据、视觉方向、真实浏览器和线上工作流核验。

按仓库 `AGENTS.md` 要求，改动前完整阅读了安装版本 Next.js 的 not-found、错误处理、metadata/OG 与 CSS 指南；CSS Module 迁移直接采用该版本的局部样式约定。

## 5. 实现的功能

1. 未知 URL 显示完整品牌化 404 恢复页；
2. 保持真实 HTTP 404，不进行首页重定向或 meta refresh；
3. 保持 `private, no-cache, no-store` 响应边界；
4. 显式输出 `robots=noindex`，生产 HTML 不再依赖运行环境自动注入；
5. 页面只有一个 H1，且未知详情不输出 BreadcrumbList 或内容结构化身份；
6. 提供搜索知识库、按时间回溯、浏览文章、浏览项目四条真实恢复路径；
7. 保留返回首页作为最后兜底；
8. 404 页面为纯服务端 HTML，没有 hydration 交互或客户端请求；
9. 支持桌面、中等宽度、390px、系统深色与 A4 打印；
10. 专属 CSS 迁入 Module，全局 CSS 从 99,818 B 降至 93,810 B；
11. 固定 `/definitely-missing` 纳入本地和生产 smoke；
12. 关键 HTML 预算从十一条扩展为十二条。

## 6. 实现方法

先在 `tests/rendered-html.test.mjs` 写恢复路口契约，并对旧生产构建运行目标测试；第一次因新 H1 不存在而失败。实现页面后，CSS 最初放在全局文件，使 `globals.css` 达到 99,818 B，只剩 182 B 预算。根据 Next 当前 CSS 指南，把所有 404 选择器迁入 `not-found.module.css`，只保留测试/烟测使用的稳定语义 marker；全局 CSS 恢复约 6 KiB 余量。

功能提交 `366a36f` 的 Quality Gate 成功，但首次 Vercel smoke 失败。直接对稳定生产域名运行相同脚本后，定位到状态、缓存、文案和四条路径都正确，只有生产初始 HTML 缺少框架文档承诺自动注入的 `noindex`；本地构建则存在该标签。修复提交 `c2e1d96` 在服务端组件中显式输出 meta，由 React 提升到 head，随后线上固定 404 恢复为一个 `noindex`，生产 smoke 通过。

功能稳定后测量提交 `c2e1d96818305d1a58e7b4713f5cc5d7e940273c` 的十二条生产响应；固定 404 为 25,370/4,459 B（raw/gzip）。基线提交 `928c0bf` 更新全部十二条来源一致的数值，并让生产 smoke 在预算覆盖断言前复用同一次固定 404 响应，避免随机路径长度改变体积证据。

## 7. 验证证据

- 失败优先：旧构建缺少新 H1，目标 404 测试按预期失败；
- `npm run typecheck`、`npm run lint`、`npm run build` 均通过，构建 51 个页面；
- `npm run test:unit`：509/509；
- `npm run test:app`：26/26；
- Playwright 桌面/移动/深色：HTTP 404、1 个 H1、4 条链接、根宽零溢出；打印模式确认 header 隐藏、路径 `break-inside: avoid-page` 与纸面 `href`；
- 浏览器 console：仅文档自身 404 网络记录，0 warnings、无应用 JavaScript 错误；
- 功能提交：`366a36f0e21a8855b6a414849b82011fa3907219 feat: publish 404 recovery junction`；
- 生产差异修复：`c2e1d96818305d1a58e7b4713f5cc5d7e940273c fix: make 404 noindex explicit`；
- 基线提交：`928c0bfe4e0113516cc47b9bd995d3ba76fafd17 test(performance): baseline 404 recovery page`；
- GitHub：[Quality Gate #215](https://github.com/Zach424/MyBlog/actions/runs/31414526358)、[#216](https://github.com/Zach424/MyBlog/actions/runs/31415242651) 与基线 [#217](https://github.com/Zach424/MyBlog/actions/runs/31415804221) 成功；首次 [Verify Vercel production #207](https://github.com/Zach424/MyBlog/actions/runs/31414580914) 因线上缺少 noindex 失败，修复后的 [#208](https://github.com/Zach424/MyBlog/actions/runs/31415296255) 与基线 [#209](https://github.com/Zach424/MyBlog/actions/runs/31415864476) 成功；
- 稳定生产 smoke：26 routes、OAuth 302，十二条 HTML 与七个发现端点全部 PASS；
- 十二条稳定生产基线（raw/gzip B）：`/` 32044/6867、`/posts` 22532/5054、代表文章 56639/13122、代表项目 112803/25247、`/archive` 24933/5503、`/subscribe` 33680/6487、专题 22285/5077、标签 22106/5051、搜索 40955/14650、知识地图 40537/8004、关于 19658/4719、固定 404 25370/4459。

## 8. 经验与教训

1. “返回 404”与“帮助读者恢复”是两个契约，错误页仍属于信息架构；
2. 不要把未知地址自动重定向到首页，否则会制造软 404 并抹掉输入错误证据；
3. 恢复路径应按读者仍掌握的线索组织，而不是堆叠站点导航副本；
4. 语义 marker 与样式作用域可以分离：稳定 class 供测试识别，CSS Module 负责真正的视觉规则；
5. 全局 CSS 剩余 182 B 已经是架构风险，局部样式不应靠提高阈值解决；
6. 框架文档声称的自动行为仍必须在真实托管环境验证，本地存在不等于边缘 HTML 一致；
7. 生产 smoke 首次失败是有价值的阻断证据，应定位和修复，不能删除 noindex 断言让门变绿；
8. 固定错误路径比带时间戳的随机路径更适合作为体积基线，因为 RSC 载荷会携带请求路径；
9. 404 不进入 Sitemap，但仍应进入 HTML 预算；发现集合与性能覆盖集合不是同一个概念；
10. 打印错误页有实际价值：旧链接或审计记录导出时仍应保留错误事实和恢复地址；
11. 全量生产重新测量可以保证同一 provenance，不应只给新路由追加来自另一提交的孤立数值；
12. 用户并行文档仍通过显式路径暂存完整保留。

## 9. 全局状态、风险与未解决问题

公开阅读现在同时具备类型、关系、文本、时间、开放接口和未知地址恢复入口。404 不新增公开内容或 Sitemap URL，生产仍为 26 条公开路由；写作和交付模型保持 Studio/Obsidian → Git → Vercel。

显式 meta 在本地 Node 输出中会与 Next 自动注入形成两个相同 `noindex`，Vercel 生产最终 HTML 为一个。相同指令不会改变索引语义，但这证明源站与适配器行为存在差异；版本升级时必须继续以生产响应为准。404 当前继承根 metadata 的首页 canonical，这是 Next 根级 not-found 的既有行为；真实 404 状态足以表明资源不存在，本轮没有启用实验性的 global-not-found 或重构根布局来只改 canonical。

全局复盘发现首页仍硬编码 `25 public URLs` 与 `REV. 010`，而当前 Sitemap 已有 26 条 URL。这不是 404 缺陷，但已经是可见事实漂移，优先级高于在四条内容规模上增加筛选、阅读历史或 PWA。首次真实 Obsidian 主题/本机代理验收、自定义域名、统计、评论和公开邮箱仍需要所有者选择，不作为自动下一轮。

## 10. 下一轮唯一主任务

建立单一的公开路由事实清单，让 Sitemap 与首页 Evidence Rail 共同派生公开 URL 数量；移除硬编码 `25 public URLs` 和没有来源的 `REV. 010`，改用真实内容日期/路由统计，并用测试阻止两处再次漂移。

保持首页为 Server Component，不增加 API 请求、Git 运行时读取、客户端状态、数据库或云配置；完成后重新测量受共享事实影响的 HTML 与 Sitemap 证据。
