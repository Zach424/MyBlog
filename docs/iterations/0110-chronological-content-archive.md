# Iteration 0110：统一时间档案

> 实现与生产测量：2026-08-10 · 归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

本轮只解决一个读者缺口：现有文章、TIL 与项目分别可浏览，但缺少一个把所有学习记录和项目复盘放回时间顺序的长期入口。新增服务端 `/archive`，从 `getAllContent()` 的同一公开集合按年/月分组，显示真实发布日期、内容类型、标题与摘要；内容为空时提供明确说明。

成功标准是：排序与分组由纯函数确定，输入不被修改；同日记录使用标题和 URL 稳定决胜；页面无客户端请求、数据库或新 frontmatter；主导航、Sitemap、内部链接、真实 SSR、生产 smoke 与 HTML 预算都认识该路由；桌面、320px、浅色、深色和打印保持可读；功能部署后才测量并冻结真实生产基线。

明确不做：年份筛选、分页、客户端搜索、访问统计、集合 `ItemList` JSON-LD、云配置和作者手工维护字段。当前只有四条公开内容，先建立可增长的语义骨架，不为未来规模预造交互。

## 2. 项目结构状态

- `lib/content/archive.ts`：新增 `createContentArchive(records)`，输出 year → month → entries 与每年计数；
- `lib/content/index.ts`：公开导出时间档案纯函数和类型；
- `app/archive/page.tsx`：新增 metadata、canonical、面包屑、时间账本、空状态与继续发现导航；
- `app/globals.css`：新增年份 spine、月份 tick、记录行、`55rem`/`42rem` 响应式与打印规则；
- `components/SiteChrome.tsx`：主导航新增“档案”；
- `app/sitemap.ts`：把 `/archive` 纳入公开路由；
- `scripts/smoke-production.mjs`：生产冒烟验证档案 HTML 与 Sitemap；公开路由最低数量同步增长；
- `scripts/html-budget.mjs`：关键 HTML 路由从九条扩展为十条，并冻结 `/archive` 基线；
- `scripts/discovery-budget.mjs`：以同一稳定生产提交重新确认发现端点基线，更新包含档案 URL 的 Sitemap 字节；
- `tests/content-archive.test.mjs`：覆盖跨年/月、混合类型、同日决胜、输入不变和空集合；
- `tests/rendered-html.test.mjs`、`tests/quality-gates.test.mjs`、预算测试：覆盖真实 SSR、导航、Sitemap、页面语义、预算来源与恰好一次路由覆盖；
- `package.json`：把档案纯函数测试纳入 `test:unit`；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md` 与本文件：同步架构、视觉、发现、质量、运维、全局状态、经验和下一步。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、删除或暂存这些内容，归档提交只包含本轮维护的权威状态与迭代文档。

## 3. 设计内容

档案页把既有 Commit Trace / Evidence Rail 延展成真实的长期 ledger，而不是复制集合页卡片。桌面左侧年份 marker 与纵向 spine 负责跨年定位，右侧月份 tick 承接记录；每条记录依次显示 `MM.DD`、Article/TIL/Project、标题、摘要和 Signal 箭头。视觉只复用 Paper、Ink、Muted、Signal、Trace、Rule 与既有字体角色，没有新增色板、渐变、圆角卡片或仪表盘统计。

信息层级是“年份 → 月份 → 日期/类型 → 标题/摘要”。真实 DOM 使用 `ol`、`section`、`h2`/`h3`、`time` 与原生链接；年份和月份计数来自同一分组结果，不在 JSX 中重复计算。`≤55rem` 把年份头与月份账本上下排列，`≤42rem` 把日期/类型放在标题上方并允许摘要自然换行。320px 的根 `scrollWidth` 与 `clientWidth` 都为 320，没有页面级横向滚动。

深色模式只替换现有 Token。打印媒体隐藏站点 header、footer 与“继续发现”，保留年份、月份、日期、类型、标题和摘要；年份/月组使用 `break-inside: avoid-page`，而不是为纸面建立第二套内容。浏览器检查确认打印计算样式生效、站点 header 隐藏。

## 4. 使用的技术

- Next.js 16.3 App Router、React 19 Server Component 与静态 metadata；
- TypeScript 只读输入、显式 `ContentArchiveYear` / `ContentArchiveMonth` 输出；
- `Map` 的稳定插入顺序与 `localeCompare("zh-CN")` / `localeCompare("en")`；
- 原生 HTML `ol`、`section`、`time[datetime]`、breadcrumb 与 canonical；
- 现有 CSS Token、媒体查询、系统深色偏好与 print media；
- Node.js test runner、TypeScript、ESLint、Next production build 与真实 HTTP 应用测试；
- Playwright/站内 Chromium 做桌面、320px、深浅色、打印、DOM 宽度和 console 验收；
- `Buffer.byteLength` 与 Node zlib 对十路 HTML、七个发现端点做 raw/gzip 确定性预算；
- GitHub Actions Quality Gate、Vercel 原生 Git 部署与稳定域名生产 smoke；
- `research-iteration-loop` skill 约束单一范围、失败优先、生产测量和全局复盘；`frontend-design` skill 让档案页沿用既有视觉语言而非生成通用卡片；`playwright` 与 browser skill 用于真实页面和部署证据验证。

本轮按仓库 `AGENTS.md` 要求，在写代码前阅读了安装版本的 Next.js layouts/pages、linking/navigation 与 metadata 指南，未依赖旧版本记忆推断路由约定。

## 5. 实现的功能

1. 公开 Article、TIL 与 Project 进入一个统一时间档案；
2. 年份与月份均按发布日期倒序，记录同样 newest first；
3. 同日记录先按中文标题、再按规范 URL 稳定排序；
4. 纯函数复制输入后排序，不改变调用方记录顺序；
5. 每年、每月显示真实条目计数；
6. 每条链接输出机器可读 `dateTime` 与读者可见 `MM.DD`；
7. 记录类型由 `kind/type` 映射为 Article、TIL 或 Project；
8. 空公开集合显示可恢复说明，不渲染空年份骨架；
9. 页面提供 `/archive` canonical、可见面包屑及文章/项目/知识地图下一跳；
10. 主导航和 Sitemap 公开档案入口，生产公开路由数从 24 增至 25；
11. 档案页纳入真实 SSR、内部链接、生产 smoke 与第十条 HTML 预算；
12. 桌面、320px、深浅色与打印共用同一语义 DOM，无档案专用客户端 bundle。

## 6. 实现方法

先写 `tests/content-archive.test.mjs`，使用跨 2025/2026、跨 07/08 月、文章/TIL/项目和同日同标题夹具表达排序契约。第一次运行因 `lib/content/archive.ts` 不存在而按预期失败，证明测试先于实现。实现只在复制的数组上排序，再顺序写入 `Map<year, Map<month, entries>>`；因为输入日期已经由内容契约保证 `YYYY-MM-DD`，年/月只需安全切片，不在档案层重复日期解析与校验。

排序比较器依次比较 `publishedAt` 倒序、`title` 的 `zh-CN` 顺序和 `url` 的 `en` 顺序。年份和月份不再二次排序，而是利用已经倒序遍历后的首次插入顺序，从而让排序规则只有一个权威入口。输出计数由每年各月长度求和；页面只消费结果。

页面保持纯服务端：`getAllContent()` 取得公开记录，`createContentArchive()` 生成投影，JSX 输出语义账本。CSS 以年份 spine 与月份 tick 把“时间”变成结构，不改变其他集合页。主导航和 Sitemap 接入后，先由真实 Next 测试锁定可见链接、`time`、类型和 canonical，再由 Chromium 检查响应式与打印。

功能提交部署成功后，才从稳定生产 origin 测量十路 HTML 与七个发现端点。随后把 `/archive` 的 20374/4742 B 和受新导航影响的其他页面一起冻结到功能提交 `49e92a61`；Sitemap 因新增一条 URL 更新为 4703/512 B。基线提交自身不作为测量来源，避免预算用尚未部署的输出自我放行。

## 7. 验证证据

- 失败优先：第一次档案目标测试以 `ERR_MODULE_NOT_FOUND` 失败；实现后 3/3 通过；
- 完整 `npm run release:check`：464.7 秒，505/505 单元测试、TypeScript、ESLint、50 个构建页面、24/24 应用测试、内容/媒体/外链门全部通过，production dependency vulnerabilities 为 0；
- 浏览器桌面与 320px：页面显示 4 条真实链接，`scrollWidth === clientWidth === 320`；
- 浏览器深色：系统偏好下 Token 与文字层级正常；
- 浏览器打印：档案组 `break-inside: avoid-page`，站点 header 和继续发现链接隐藏；
- 浏览器 console：0 errors、0 warnings；
- 截图证据保存在未跟踪的 `output/playwright/archive-0110-desktop.png`、`archive-0110-320-light.png`、`archive-0110-320-dark.png`、`archive-0110-320-print.png`，按仓库规则不提交；
- 功能提交：`49e92a61a6f66bafd5316eb291c0599818209671 feat(archive): publish chronological content ledger`；
- 基线提交：`744a6931e0ebde34dd356b0c27ca85bc34168eab test(performance): baseline chronological archive`；
- GitHub：[Quality Gate #208](https://github.com/Zach424/MyBlog/actions/runs/31357226358) 1m32s、[Quality Gate #209](https://github.com/Zach424/MyBlog/actions/runs/31357648265) 1m25s，均成功；
- Vercel：[Verify Vercel production #200](https://github.com/Zach424/MyBlog/actions/runs/31357264863) 35s、[Verify Vercel production #201](https://github.com/Zach424/MyBlog/actions/runs/31357677620) 42s，均成功；
- 最终稳定生产 smoke：25 routes、OAuth 302；十路 HTML 与七个发现端点全部 PASS；
- 十路稳定生产基线（raw/gzip B）：`/` 27407/6016、`/posts` 17960/4265、代表文章 51963/12277、代表项目 108127/24492、`/archive` 20374/4742、专题 17609/4182、标签 17430/4155、搜索 36292/13846、知识地图 36006/7265、关于页 15010/3869；
- 七端点基线（raw/gzip B）：清单 3009/921、Schema 3278/755、JSON Feed 20697/9876、RSS 3238/1241、Sitemap 4703/512、robots 155/127、OpenSearch 700/462。

## 8. 经验与教训

1. 时间档案的核心不是页面，而是唯一、可测试的排序契约；先把年/月和同日决胜变成纯函数，页面才不会在不同渲染位置产生不同顺序；
2. 已验证的 `YYYY-MM-DD` 应直接作为可排序事实使用，档案层重复解析时区只会引入无价值差异；
3. `Map` 插入顺序可以消除第二套 year/month sort，但前提是整个输入先通过同一比较器排序并有测试锁定；
4. 小内容库仍需要真实空状态和跨年夹具，不能因为生产目前只有一个月就把未来边界留给人工发现；
5. 档案视觉最适合复用 Commit Trace 的年份 spine 与 Evidence Rail 的规则线；如果改成通用卡片墙，会丢失本站最重要的“记录形成过程”语义；
6. 新增一个导航链接会让所有共享站点框架的 HTML 都增长，所以基线更新必须测量完整路由集，不只测新页面；
7. Sitemap 的 176/8 B 增长是新增公开 URL 的直接证据，仍必须从部署后的最终 XML测量并绑定功能 SHA；
8. 打印验证不能只看 CSS 文件存在；需要真实媒体计算样式或 PDF 证明站点框架隐藏、正文保留和分页边界生效；
9. 浏览器 console 中第三方站点的遥测超时与博客页面 console 是不同证据面，档案验收以本地/生产博客标签页的零错误为准；
10. 并行工作区里的其他文档改动属于用户资产；本轮提交按路径显式选择自己的档案文件，不用 `git add .` 混入未知内容。

## 9. 全局状态、风险与未解决问题

博客现在同时具备类型入口（文章/项目/专题/标签）、关系入口（知识地图/继续阅读）、文本入口（搜索）与时间入口（档案）。写作仍由 Studio 或 Obsidian 产生 Git 变更，Vercel 自动交付；档案只投影公开记录，不改变发布模型。内容、机器清单、Feed、Sitemap、源文与页面继续共享同一 Markdown/Git 事实源。

档案当前生产数据只有 2026 年 8 月四条记录，不能据此证明大规模页面仍有良好扫描效率；跨年/月和同日边界已由夹具证明，HTML 体积由预算持续观察。内容显著增长前不加入客户端筛选、分页、年份导航或增量接口。若未来添加更新历史，需要先区分“首次发布时序”和“事实复核时序”，不能把 `updatedAt` 静默混进现有发布日期账本。

集合 `ItemList`、作者 `ProfilePage`、外部 canonical 和统计仍没有足够事实来源或产品价值，本轮继续不扩充。首次真实 Obsidian 主题/本机代理的人机验收、自定义域名、统计、评论和公开邮箱仍属于所有者选择，不阻塞当前生产。

## 10. 下一轮唯一主任务

新增服务端 `/subscribe` 订阅与开放接口说明页：把现有 RSS、JSON Feed、OpenSearch、公开内容清单/Schema 与单篇 Markdown 的受众、用途、格式、更新语义和入口集中成读者可见的 Evidence Rail；页脚从直接 RSS 改为“订阅”入口，页内使用原生链接直达各端点。接入 Sitemap、内部链接健康检查、真实 SSR、生产 smoke、320px/深浅色/打印与 HTML/发现预算。

保持既有协议与 Markdown/Git 单一事实源，不新增数据库、客户端请求、云配置、统计、邮箱、作者字段或另一套订阅数据。
